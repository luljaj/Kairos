/**
 * Server-authoritative state. The only writer. See plan/02-state-and-backend.md.
 *
 * Rules:
 * - Every change goes through `mutate()` (commands, voice updates, model results, sim ticks).
 * - Never `await` inside a mutator: compute async things first, then apply in one
 *   synchronous step that re-checks preconditions.
 * - `mutate` bumps `state.revision`, notifies listeners, and schedules a debounced
 *   snapshot write to web/data/state.json. Callers bump entity revisions via `touch()`.
 */
import fs from "node:fs";
import path from "node:path";
import { DispatchState, type CommandResult } from "@/lib/contracts";
import { initialState } from "./fixtures";

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "state.json");
const PERSIST_DEBOUNCE_MS = 500;
const SEEN_COMMANDS_MAX = 500;

type Listener = (state: DispatchState) => void;

type Store = {
  state: DispatchState;
  listeners: Set<Listener>;
  /** commandId -> original result, insertion-ordered (oldest first) for LRU eviction. */
  seenCommands: Map<string, CommandResult>;
  persistTimer: ReturnType<typeof setTimeout> | null;
};

declare global {
  var __dispatch: Store | undefined;
}

function loadSnapshotOrFixtures(): DispatchState {
  try {
    const raw = fs.readFileSync(SNAPSHOT_PATH, "utf8");
    const parsed = DispatchState.safeParse(JSON.parse(raw));
    if (parsed.success) {
      console.log(`[store] restored snapshot at revision ${parsed.data.revision}`);
      return parsed.data;
    }
    console.warn("[store] snapshot invalid, loading fixtures:", parsed.error.issues.slice(0, 3));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[store] could not read snapshot, loading fixtures:", err);
    }
  }
  return initialState();
}

/** globalThis singleton so dev-mode HMR doesn't create a second store. */
export function getStore(): Store {
  globalThis.__dispatch ??= {
    state: loadSnapshotOrFixtures(),
    listeners: new Set(),
    seenCommands: new Map(),
    persistTimer: null,
  };
  return globalThis.__dispatch;
}

export function getState(): DispatchState {
  return getStore().state;
}

export function subscribe(listener: Listener): () => void {
  const store = getStore();
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

/** Bump an entity's revision and updatedAt (if it has one). */
export function touch<T extends { revision: number; updatedAt?: string }>(entity: T, now: string): T {
  entity.revision++;
  if ("updatedAt" in entity) entity.updatedAt = now;
  return entity;
}

/**
 * Apply a synchronous change. The mutator returns `false` to signal "nothing
 * changed" (no revision bump, no broadcast). Must not be async.
 */
export function mutate<R>(fn: (state: DispatchState) => R | false): R | false {
  const store = getStore();
  const result = fn(store.state);
  if (result === false) return false;
  if (result instanceof Promise) throw new Error("mutate() callback must be synchronous");
  store.state.revision++;
  notify(store);
  schedulePersist(store);
  return result;
}

/** Replace the whole state (reset). */
export function replaceState(next: DispatchState): void {
  const store = getStore();
  // Keep revision monotonic so clients never see it go backwards.
  next.revision = store.state.revision + 1;
  store.state = next;
  notify(store);
  schedulePersist(store);
}

function notify(store: Store) {
  for (const l of store.listeners) {
    try {
      l(store.state);
    } catch (err) {
      console.error("[store] listener failed", err);
    }
  }
}

function schedulePersist(store: Store) {
  if (store.persistTimer) return;
  store.persistTimer = setTimeout(() => {
    store.persistTimer = null;
    try {
      fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
      const tmp = `${SNAPSHOT_PATH}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(store.state));
      fs.renameSync(tmp, SNAPSHOT_PATH); // atomic on the same filesystem
    } catch (err) {
      console.error("[store] snapshot write failed", err);
    }
  }, PERSIST_DEBOUNCE_MS);
}

// --- command de-duplication ------------------------------------------------

export function seenCommand(commandId: string): CommandResult | undefined {
  return getStore().seenCommands.get(commandId);
}

export function rememberCommand(commandId: string, result: CommandResult): void {
  const seen = getStore().seenCommands;
  seen.set(commandId, result);
  while (seen.size > SEEN_COMMANDS_MAX) {
    const oldest = seen.keys().next().value;
    if (oldest === undefined) break;
    seen.delete(oldest);
  }
}

// --- ids ---------------------------------------------------------------------

export function newId(prefix: "call" | "task" | "rec" | "req"): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

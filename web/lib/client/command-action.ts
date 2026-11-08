import type { CommandResult } from "@/lib/contracts";
import type { CommandInput } from "./useDispatchState";

export type CommandAction = { command: CommandInput; id: string };
/** A synchronous guard closes the gap before React renders a disabled button. */
export function createCommandRunner(
  send: (command: CommandInput, id: string) => Promise<CommandResult>,
) {
  let generation = 0;
  let running = false;
  let uncertain: CommandAction | null = null;
  return {
    reset() {
      generation++;
      uncertain = null;
      running = false;
    },
    async run(command: CommandInput, retry = false) {
      if (running || (uncertain && !retry)) return null;
      const action = retry ? uncertain : { command, id: crypto.randomUUID() };
      if (!action) return null;
      const started = generation;
      running = true;
      try {
        const result = await send(action.command, action.id);
        if (started !== generation) return null;
        uncertain = null;
        return { action, result };
      } catch {
        if (started !== generation) return null;
        uncertain = action;
        return { action, result: null };
      } finally {
        if (started === generation) running = false;
      }
    },
  };
}

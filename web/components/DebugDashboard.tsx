"use client";

/**
 * Placeholder dashboard for backend work. The real UI (plan/04) replaces this;
 * it shows the live snapshot and a few demo controls.
 */
import { ACUITY_DISCLAIMER, careLevelOf } from "@/lib/contracts";
import { sendCommand, useDispatchState } from "@/lib/client/useDispatchState";

const SCENARIOS = ["busy-first-call", "fall-unconscious", "breathing-charlie"];

export function DebugDashboard() {
  const { state, connection } = useDispatchState();

  const startScripted = (scenario: string) =>
    fetch("/api/demo/scripted-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, speed: 2 }),
    });

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 font-mono text-sm">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-base font-semibold">Dispatch backend (debug view)</h1>
        <span className="rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-800">
          {connection} · rev {state?.revision ?? "–"}
        </span>
        {SCENARIOS.map((s) => (
          <button
            key={s}
            className="rounded border px-2 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            onClick={() => startScripted(s)}
          >
            ▶ {s}
          </button>
        ))}
        <button
          className="rounded border border-red-400 px-2 py-0.5 text-red-600"
          onClick={() => sendCommand({ type: "reset_demo" })}
        >
          Reset demo
        </button>
      </header>

      {state && (
        <div className="grid gap-4 md:grid-cols-2">
          <section>
            <h2 className="mb-2 font-semibold">Fleet</h2>
            <ul className="space-y-1">
              {Object.values(state.ambulances).map((a) => (
                <li key={a.id}>
                  {a.name} · {careLevelOf(a, state.crew)} · {a.status}
                  {a.activeTaskId && ` · active ${a.activeTaskId}`}
                  {a.queuedTaskIds.length > 0 && ` · queue [${a.queuedTaskIds.join(", ")}]`}
                </li>
              ))}
            </ul>
            <h2 className="mt-4 mb-2 font-semibold">Calls</h2>
            <ul className="space-y-3">
              {Object.values(state.calls).map((c) => (
                <li key={c.id} className="rounded border p-2">
                  <div>
                    {c.id} · {c.status} · factsRev {c.factsRevision}
                  </div>
                  <div>{c.location.text ?? "location unknown"}</div>
                  <div>{c.facts.chiefComplaint ?? "complaint unknown"}</div>
                  {(() => {
                    const rec = c.recommendationSetId ? state.recommendations[c.recommendationSetId] : null;
                    if (!rec) return null;
                    return (
                      <div className="mt-1">
                        <div>
                          Suggested acuity: {rec.acuity ?? rec.status} ({rec.source})
                        </div>
                        {rec.acuityReason && (
                          <div className="text-xs text-zinc-500">Why: {rec.acuityReason}</div>
                        )}
                      </div>
                    );
                  })()}
                  {!c.taskId && (
                    <div className="mt-1 flex gap-1">
                      {Object.values(state.ambulances).map((a) => (
                        <button
                          key={a.id}
                          className="rounded border px-1.5"
                          onClick={() =>
                            sendCommand({ type: "manual_assign", callId: c.id, ambulanceId: a.id, confirmMismatch: true })
                          }
                        >
                          assign {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {c.taskId && (
                    <button
                      className="mt-1 rounded border px-1.5"
                      onClick={() => sendCommand({ type: "advance_phase", taskId: c.taskId! })}
                    >
                      advance phase ({state.tasks[c.taskId]?.status} / {state.tasks[c.taskId]?.phase ?? "–"})
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Raw state</h2>
            <pre className="max-h-[75vh] overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
              {JSON.stringify(state, null, 2)}
            </pre>
          </section>
        </div>
      )}

      <footer className="mt-auto text-xs text-zinc-500">{ACUITY_DISCLAIMER}</footer>
    </div>
  );
}

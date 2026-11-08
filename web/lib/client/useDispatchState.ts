"use client";

import { useEffect, useState } from "react";
import { CommandResult, DispatchState, type Command } from "@/lib/contracts";

export type ConnectionState = "connecting" | "open" | "reconnecting";

/** Keep the last validated snapshot while EventSource reconnects. */
export function useDispatchState() {
  const [state, setState] = useState<DispatchState | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("state", (event) => {
      try {
        const snapshot = DispatchState.parse(
          JSON.parse((event as MessageEvent<string>).data),
        );
        setState(snapshot);
        setConnection("open");
        setConnectionError(null);
      } catch {
        setConnection("reconnecting");
        setConnectionError(
          "Invalid state update. Waiting for a valid snapshot; dispatch is disabled.",
        );
      }
    });
    es.onerror = () => {
      setConnection("reconnecting");
      setConnectionError(
        "Connection interrupted. Showing the last snapshot; dispatch is disabled.",
      );
    };
    return () => es.close();
  }, []);
  return { state, connection, connectionError };
}

export type CommandInput = Command extends infer C
  ? C extends Command
    ? Omit<C, "commandId">
    : never
  : never;

/** The caller owns the logical action ID, including uncertain network retries. */
export async function sendCommand(
  cmd: CommandInput,
  commandId: string = crypto.randomUUID(),
): Promise<CommandResult> {
  const response = await fetch("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...cmd, commandId }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = CommandResult.parse(await response.json());
  if (!response.ok && result.ok)
    throw new Error("Invalid command acknowledgement");
  return result;
}

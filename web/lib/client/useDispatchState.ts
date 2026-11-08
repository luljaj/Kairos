"use client";

import { useEffect, useState } from "react";
import type { Command, CommandResult, DispatchState } from "@/lib/contracts";

export type ConnectionState = "connecting" | "open" | "reconnecting";

/** Opens the SSE stream and keeps the latest full snapshot. No client persistence. */
export function useDispatchState(): { state: DispatchState | null; connection: ConnectionState } {
  const [state, setState] = useState<DispatchState | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("state", (e) => {
      setState(JSON.parse((e as MessageEvent<string>).data) as DispatchState);
      setConnection("open");
    });
    es.onerror = () => setConnection("reconnecting"); // EventSource retries on its own
    return () => es.close();
  }, []);

  return { state, connection };
}

type CommandInput = Command extends infer C ? (C extends Command ? Omit<C, "commandId"> : never) : never;

/** One commandId per call: retrying the same logical click should reuse the id. */
export async function sendCommand(
  cmd: CommandInput,
  commandId: string = crypto.randomUUID(),
): Promise<CommandResult> {
  const res = await fetch("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...cmd, commandId }),
  });
  return (await res.json()) as CommandResult;
}

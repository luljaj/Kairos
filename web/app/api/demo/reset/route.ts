import { applyCommand } from "@/lib/server/commands";

export async function POST() {
  return Response.json(applyCommand({ commandId: crypto.randomUUID(), type: "reset_demo" }));
}

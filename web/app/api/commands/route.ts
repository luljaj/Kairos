import { Command } from "@/lib/contracts";
import { applyCommand } from "@/lib/server/commands";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Command.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid", message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }
  return Response.json(applyCommand(parsed.data));
}

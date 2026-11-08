import { UpdateIncidentBody } from "@/lib/contracts";
import { checkToolSecret, ingestIncident } from "@/lib/server/voice";

export async function POST(req: Request) {
  if (!checkToolSecret(req)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  console.log("[voice] update-incident", JSON.stringify(body));
  const parsed = UpdateIncidentBody.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }
  const callId = await ingestIncident(parsed.data);
  return Response.json({ ok: true, callId });
}

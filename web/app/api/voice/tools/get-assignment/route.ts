import { GetAssignmentBody } from "@/lib/contracts";
import { checkToolSecret, getAssignment } from "@/lib/server/voice";

export async function POST(req: Request) {
  if (!checkToolSecret(req)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const parsed = GetAssignmentBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }
  return Response.json(getAssignment(parsed.data.conversationId));
}

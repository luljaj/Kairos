import { getState } from "@/lib/server/store";
import { estimateAvailability } from "@/lib/server/eta";
import { getRoute } from "@/lib/server/routing";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = getState();
  const unit = state.ambulances[params.get("ambulanceId") ?? ""];
  const call = state.calls[params.get("callId") ?? ""];
  const from = unit ? estimateAvailability(state, unit).releasePoint : null;
  if (!from || !call?.location.coords) return Response.json({ error: "Route unavailable" }, { status: 404 });
  return Response.json(await getRoute(from, call.location.coords));
}

# 04 — Dashboard (Next.js UI)

Owner: friend (likely). Reads state from `GET /api/events` (SSE, full snapshot) and sends `POST /api/commands` (see 02). Use `MODEL_MODE=mock` and the scripted caller until the real pieces land.

## Stack

- Next.js App Router, TypeScript, client components for the dashboard.
- Tailwind for styling; shadcn/ui optional for buttons, dialogs, popovers.
- Mapbox GL JS via `react-map-gl` (or direct). Token in `NEXT_PUBLIC_MAPBOX_TOKEN`.
- State: one `useDispatchState()` hook that opens the EventSource and keeps the latest snapshot. No client persistence. Selection/hover/UI preferences are local React state (optionally `localStorage`).

## Layout

```text
┌───────────────┬───────────────────────────────────────────┐
│ Incident cards│                                           │
│ (newest top)  │                 Map                       │
│───────────────│                                           │
│ Fleet list    │           [ dispatch pill ]               │
└───────────────┴───────────────────────────────────────────┘
 footer: connection state · model source · acuity disclaimer · Reset demo
```

## Incident card

- Location text (confidence badge), chief complaint, key facts as chips; unknowns shown as "unknown", not hidden.
- Status: Intake (pulsing while the call is live) → Gathering details (`needs_more_info`, list of missing fields) → Awaiting decision → Assigned (unit + ETA) / Queued (unit + wait).
- Acuity badge: letter + "suggested" or "set by dispatcher". Click to override.
- Edit button: inline form for location and facts → `edit_incident`.
- Transcript expander only if transcript entries exist.

## Dispatch pill

Appears for the selected call when its latest recommendation is `ready`.

- Recommended unit, arrival estimate, acuity, model reason, source tag (`fine-tuned` / `base` / `fallback`).
- If the recommended unit isn't the fastest suitable one, show "Fastest: Medic 1 · 4 min" next to it.
- **Send ambulance** → `accept_recommendation`. Disabled while the request is in flight (one command ID per click).
- **Alternatives** → list of all candidates in backend order with ETA, care level, suitability reason. Mismatched units have a warning; choosing one opens a confirm ("BLS crew for a Delta call — send anyway?") and sends `confirmMismatch: true`. Unavailable units are greyed with their reason.
- Stale set: greyed, "Refreshing…".

## Map

- Incident pins coloured by acuity; ambulances as icons coloured by status.
- Active routes drawn for busy units.
- Hover an available unit with a call selected: dashed preview route + travel time.
- Hover a busy unit: its current route solid, assigned call, "free in ~N min".
- Click a unit: follow camera, open crew panel.
- Selecting a call highlights its unit and vice versa.

## Crew panel

Names (initials avatar, no headshots), roles, qualifications as badges, months of service, care level, current task, ordered queue with cancel buttons (reorder is a stretch goal).

## Demo controls

Footer or a hidden `?demo=1` panel: Reset demo, Start scripted call (scenario picker), Advance phase on selected task, sim speed.

## Done when

- Full flow works in mock mode with scripted calls: card fills live, pill appears, accept, unit moves along route, completes.
- Mismatch confirm, queued assignment, acuity override and stale refresh are all visible.
- Refreshing the page loses nothing.

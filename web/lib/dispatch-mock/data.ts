import routesJson from "./routes.json";

export type LngLat = [number, number];
export type Route = { coords: LngLat[]; duration: number; distance: number };
export const ROUTES = routesJson as unknown as Record<
  "m3_transport" | "m2_to_incident" | "m1_to_incident" | "m3_to_incident",
  Route
>;

export type CareLevel = "ALS" | "BLS";
export type UnitStatus = "available" | "en_route" | "transporting" | "on_scene";

export type CrewMember = { name: string; role: string; cert: string };

export type Unit = {
  id: string;
  name: string;
  care: CareLevel;
  station: string;
  home: LngLat;
  crew: CrewMember[];
};

export const UNITS: Unit[] = [
  {
    id: "amb-1",
    name: "Medic 1",
    care: "BLS",
    station: "Station 1 · Court St",
    home: [-75.917242, 42.099634],
    crew: [
      { name: "Jordan Pike", role: "Driver", cert: "EMT" },
      { name: "Sam Okafor", role: "Crew chief", cert: "EMT" },
    ],
  },
  {
    id: "amb-2",
    name: "Medic 2",
    care: "ALS",
    station: "Station 2 · Front St",
    home: [-75.947728, 42.110517],
    crew: [
      { name: "Riley Chen", role: "Driver", cert: "EMT" },
      { name: "Avery Santos", role: "Crew chief", cert: "Paramedic" },
    ],
  },
  {
    id: "amb-3",
    name: "Medic 3",
    care: "ALS",
    station: "Station 3 · Vestal",
    home: [-75.972, 42.087],
    crew: [
      { name: "Casey Novak", role: "Driver", cert: "AEMT" },
      { name: "Morgan Reyes", role: "Crew chief", cert: "Paramedic" },
    ],
  },
];

export type Acuity = "Alpha" | "Bravo" | "Charlie" | "Delta" | "Echo";

export type TranscriptLine = {
  at: number; // seconds after mount
  speaker: "caller" | "assistant";
  text: string;
};

export type Fact = { label: string; value: string; at: number; flag?: boolean; signal?: string };

export type Call = {
  id: string;
  title: string;
  location: string;
  area: string;
  coords: LngLat;
  acuity: Acuity;
  startedAt: string;
  stage: "intake" | "gathering" | "awaiting" | "assigned";
  transcript: TranscriptLine[];
  facts: Fact[];
  missing?: string[];
};

export const INCIDENT: LngLat = [-75.96953, 42.0878];

export const CALLS: Call[] = [
  {
    id: "call-0412",
    title: "Unresponsive after fall",
    location: "Glenn G. Bartle Library, 2nd floor",
    area: "Binghamton University",
    coords: INCIDENT,
    acuity: "Delta",
    startedAt: "02:37",
    stage: "awaiting",
    transcript: [
      { at: 0.2, speaker: "assistant", text: "911, what's the address of your emergency?" },
      { at: 1.4, speaker: "caller", text: "Bartle Library, the second floor by the study rooms. Someone just collapsed." },
      { at: 3.2, speaker: "assistant", text: "Is the person awake and talking to you?" },
      { at: 4.4, speaker: "caller", text: "No, he's not answering. He hit his head on the table going down." },
      { at: 6.2, speaker: "assistant", text: "Is he breathing normally?" },
      { at: 7.4, speaker: "caller", text: "He's breathing but it sounds weird, kind of snoring. He's maybe twenty." },
      { at: 9.2, speaker: "assistant", text: "Help is being arranged. Stay with him and don't move his neck." },
    ],
    facts: [
      { label: "Location", value: "Bartle Library, 2F", at: 1.8 },
      { label: "Conscious", value: "No", at: 4.8, flag: true, signal: "Unresponsive" },
      { label: "Head strike", value: "Yes", at: 4.8, flag: true, signal: "Head strike" },
      { label: "Breathing", value: "Abnormal", at: 7.8, flag: true, signal: "Snoring respirations" },
      { label: "Age", value: "~20", at: 7.8, signal: "Male, ~20" },
    ],
  },
  {
    id: "call-0411",
    title: "Asthma, short of breath",
    location: "9 Chenango Ct",
    area: "North Side",
    coords: [-75.912, 42.118],
    acuity: "Charlie",
    startedAt: "02:34",
    stage: "gathering",
    transcript: [
      { at: 0, speaker: "caller", text: "My roommate's having an asthma attack and her inhaler isn't helping." },
      { at: 0, speaker: "assistant", text: "Can she speak in full sentences?" },
    ],
    facts: [
      { label: "Age", value: "21", at: 0 },
      { label: "Conscious", value: "Yes", at: 0 },
      { label: "Breathing", value: "Difficult", at: 0, flag: true, signal: "Short of breath" },
    ],
    missing: ["Can speak", "Lip colour"],
  },
  {
    id: "call-0409",
    title: "Chest pain, 64F",
    location: "Vestal Pkwy E",
    area: "Vestal",
    coords: [-75.9905, 42.0935],
    acuity: "Delta",
    startedAt: "02:11",
    stage: "assigned",
    transcript: [],
    facts: [],
  },
];

export type Hospital = { id: string; name: string; short: string; coords: LngLat; er: boolean };

/** Real Binghamton-area hospitals (Mapbox Search Box geocodes). */
export const HOSPITALS: Hospital[] = [
  { id: "lourdes", name: "Our Lady of Lourdes Memorial Hospital", short: "Lourdes", coords: [-75.93624, 42.09159], er: true },
  { id: "general", name: "UHS Binghamton General Hospital", short: "Binghamton General", coords: [-75.9149, 42.08677], er: true },
  { id: "wilson", name: "UHS Wilson Medical Center", short: "Wilson Medical", coords: [-75.95324, 42.10837], er: true },
];
export const HOSPITAL = HOSPITALS[0];

export type TriageOption = {
  unitId: string;
  routeKey: keyof typeof ROUTES;
  etaMin: number;
  waitMin?: number;
  verdict: "recommended" | "mismatch" | "queued";
  reason: string;
};

/** ETA uses the road time with lights and sirens (~0.72 of normal traffic). */
const eta = (k: keyof typeof ROUTES) => Math.round((ROUTES[k].duration * 0.72) / 60);

export const TRIAGE: TriageOption[] = [
  {
    unitId: "amb-2",
    routeKey: "m2_to_incident",
    etaMin: eta("m2_to_incident"),
    verdict: "recommended",
    reason: "Closest ALS unit. Paramedic on board for an unresponsive patient with a head strike.",
  },
  {
    unitId: "amb-1",
    routeKey: "m1_to_incident",
    etaMin: eta("m1_to_incident"),
    verdict: "mismatch",
    reason: "BLS crew for a Delta call. Arrives later and can't manage the airway at ALS level.",
  },
  {
    unitId: "amb-3",
    routeKey: "m3_to_incident",
    etaMin: eta("m3_to_incident"),
    waitMin: 6,
    verdict: "queued",
    reason: "Best crew for this call, but transporting to Lourdes. Free in about 6 min.",
  },
];

export const unitById = (id: string) => UNITS.find((u) => u.id === id)!;

export const ACUITY_TONE: Record<Acuity, "critical" | "urgent" | "routine"> = {
  Echo: "critical",
  Delta: "critical",
  Charlie: "urgent",
  Bravo: "routine",
  Alpha: "routine",
};

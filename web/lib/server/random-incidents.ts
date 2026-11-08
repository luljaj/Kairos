import { ScenarioFixture, type IncidentFacts } from "@/lib/contracts";

// Curated fictional scenes keep caller facts coherent; randomness chooses the
// scene, location and age rather than independently mixing incompatible symptoms.
const scenes: { title: string; complaint: string; facts: Partial<IncidentFacts>; detail: string }[] = [
  { title: "Ankle injury", complaint: "Tripped on the steps and may have broken an ankle", facts: { conscious: true, breathingNormally: true, severeBleeding: false, traumaMechanism: "fall from standing" }, detail: "They are awake and breathing normally. Their ankle hurts and they cannot put weight on it." },
  { title: "Minor cut", complaint: "Small cut on a hand, bleeding has stopped", facts: { conscious: true, breathingNormally: true, severeBleeding: false }, detail: "They are awake, breathing normally, and the small cut has stopped bleeding." },
  { title: "Breathing difficulty", complaint: "Asthma and wheezing, still able to talk", facts: { conscious: true, breathingNormally: false, severeBleeding: false }, detail: "They are awake and can still talk, but are wheezing and short of breath." },
  { title: "Chest pain", complaint: "Chest pressure with sweating and nausea", facts: { conscious: true, breathingNormally: true, chestPain: true, severeBleeding: false }, detail: "They are awake and breathing normally, but have chest pressure, sweating and nausea." },
  { title: "Seizure ended", complaint: "Had a seizure that just ended", facts: { conscious: true, breathingNormally: true, severeBleeding: false }, detail: "The shaking has stopped. They are awake now and breathing normally." },
];
const locations = [
  { text: "Campus library entrance (fictional demo incident)", coords: { lat: 42.0893, lng: -75.9698 } },
  { text: "Downtown Binghamton storefront (fictional demo incident)", coords: { lat: 42.0995, lng: -75.9165 } },
  { text: "Johnson City residence (fictional demo incident)", coords: { lat: 42.1105, lng: -75.948 } },
  { text: "Vestal residence (fictional demo incident)", coords: { lat: 42.079, lng: -75.985 } },
  { text: "Riverside walkway (fictional demo incident)", coords: { lat: 42.096, lng: -75.9235 } },
];

export function randomIncidents(count: 1 | 3, random = Math.random): ScenarioFixture[] {
  const remainingScenes = [...scenes], remainingLocations = [...locations];
  const take = <T,>(items: T[]) => items.splice(Math.floor(random() * items.length), 1)[0];
  return Array.from({ length: count }, (_, i) => {
    const scene = take(remainingScenes), location = take(remainingLocations);
    const age = 40 + Math.floor(random() * 40);
    return ScenarioFixture.parse({
      id: `random-${i}`, title: scene.title, callerNumber: null,
      location: { ...location, confidence: "confirmed" },
      steps: [
        { atSeconds: i * 6, locationText: location.text,
          facts: { chiefComplaint: scene.complaint, callerRelation: "bystander" },
          transcript: [{ role: "caller", text: `I'm at ${location.text}. ${scene.complaint}.` }] },
        { atSeconds: i * 6 + 4,
          facts: { ...scene.facts, patientAge: age, patientCount: 1 },
          transcript: [{ role: "caller", text: `${scene.detail} They are ${age} years old.` }] },
      ],
      expected: { acuity: null, recommendedAmbulanceId: null },
    });
  });
}

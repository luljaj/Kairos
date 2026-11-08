/** Fixed caller scripts; each appends a call to the current demo. */
export const PREMADE_INCIDENTS = [
  {
    "id": "ankle-injury",
    "label": "Campus ankle injury · Incident",
    "description": "A campus stairway fall with a possible fracture; awake and breathing normally."
  },
  {
    "id": "minor-cut",
    "label": "Minor hand cut · Incident",
    "description": "A small hand cut with bleeding stopped; a low-acuity contrast to the serious calls."
  },
  {
    "id": "chest-pressure",
    "label": "Chest pressure and sweating · Incident",
    "description": "Chest pressure followed by age and associated symptoms; compare the resulting crew assessment."
  },
  {
    "id": "seizure-ended",
    "label": "Seizure just ended · Incident",
    "description": "A witnessed seizure has ended; the caller supplies current consciousness and breathing."
  },
  {
    "id": "collapse-not-breathing",
    "label": "Collapse, then critical update · Incident",
    "description": "An initially unclear collapse becomes an unconscious, abnormal-breathing incident as facts arrive."
  },
  {
    "id": "vehicle-rollover",
    "label": "Vehicle rollover · Incident",
    "description": "A single-patient rollover with a conscious patient; demonstrates the mechanism of injury in the assessment."
  }
] as const;

export const premadeIncident = (id: string) => PREMADE_INCIDENTS.find((item) => item.id === id);

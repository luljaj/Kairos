export const RANDOM_INCIDENT_OPTIONS = [
  { id: "random-incident", label: "Random incident", description: "Adds a random fictional call at a local demo location. Keeps the current fleet and existing calls." },
  { id: "random-burst", label: "Random three incidents", description: "Adds three different fictional calls over 12 seconds, with varied locations and staged details. Keeps current assignments. Clear cancels the remaining calls." },
] as const;

export const randomIncidentOption = (id: string) => RANDOM_INCIDENT_OPTIONS.find((item) => item.id === id);

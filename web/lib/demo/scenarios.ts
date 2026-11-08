/** Shared labels for fleet setups exposed by the existing demo endpoint. */
export const FLEET_DEMO_SCENARIOS = [
  {
    id: "fleet-spread",
    label: "Fleet · returning from hospitals",
    description: "Medic 1 returning from Lourdes and Medic 2 from Wilson, both available for dispatch; Medic 3 on scene in Vestal. Starts a fall intake.",
    intake: "fall-unconscious",
  },
  {
    id: "fleet-mixed",
    label: "Fleet · mixed active incidents",
    description: "Medic 1 ready at the squad room, Medic 2 transporting, Medic 3 on scene. Starts a breathing difficulty intake.",
    intake: "breathing-charlie",
  },
  {
    id: "fleet-busy",
    label: "Fleet · all busy with a queue",
    description: "All units working: en route, transporting, and on scene, with another job queued for Medic 3. Starts a fall intake.",
    intake: "fall-unconscious",
  },
] as const;

export const fleetDemoScenario = (id: string) => FLEET_DEMO_SCENARIOS.find((item) => item.id === id);

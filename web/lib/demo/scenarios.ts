/** Shared judge demos. IDs stay stable for existing links and API clients. */
export const FLEET_DEMO_SCENARIOS = [
  {
    id: "fleet-spread",
    label: "A second caller arrives · Scenario",
    description: "Medic 1 and Medic 2 are returning from hospitals; Medic 3 is on a call. A new fall intake arrives while the dispatcher is busy.",
    demonstrate: "Compare the closer BLS crew with an available ALS crew, review the assessment, then approve a response.",
    intake: "fall-unconscious",
  },
  {
    id: "fleet-mixed",
    label: "Available versus suitable · Scenario",
    description: "Medic 1 is ready at base. Medic 2 is transporting from Vestal and Medic 3 is on scene. A breathing difficulty call arrives.",
    demonstrate: "Compare care level, available-in time, and travel time. Assign a busy ALS unit to show a queued response without interrupting its patient transport.",
    intake: "breathing-charlie",
  },
  {
    id: "fleet-busy",
    label: "Nearby, but already committed · Scenario",
    description: "All units are working. Medic 3 is near the new incident, but has an active patient and another job queued.",
    demonstrate: "Inspect Medic 3’s queue and compare total arrival estimates. Approve an assignment and show that existing commitments remain intact.",
    intake: "fall-unconscious",
  },
  {
    id: "fleet-experience",
    label: "A more experienced crew · Scenario",
    description: "Two available ALS crews are returning from Lourdes with similar arrival estimates. Medic 3’s chief has 66 months of service versus Medic 2’s 41; Medic 1 is BLS at base.",
    demonstrate: "Compare both ALS crews and the model’s recommendation. This fictional rubric permits up to 60 extra seconds for a chief with 24+ more months of experience on a Delta/Echo call. The live model decides; fallback only ranks by capability and arrival.",
    intake: "crew-experience",
  },
] as const;

export const fleetDemoScenario = (id: string) => FLEET_DEMO_SCENARIOS.find((item) => item.id === id);

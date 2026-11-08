/** Derived (not stored) facts about the fleet. Pure; safe on client and server. */
import type { CareLevel } from "./common";
import type { Ambulance, CrewMember } from "./entities";

type CrewLookup = Record<string, CrewMember>;

function crewOf(amb: Ambulance, crew: CrewLookup): CrewMember[] {
  return amb.crewIds.map((id) => crew[id]).filter((c): c is CrewMember => c !== undefined);
}

/** ALS if any crew member has both nys_paramedic and hf_als_cleared. */
export function careLevelOf(amb: Ambulance, crew: CrewLookup): CareLevel {
  return crewOf(amb, crew).some(
    (c) => c.qualifications.includes("nys_paramedic") && c.qualifications.includes("hf_als_cleared"),
  )
    ? "ALS"
    : "BLS";
}

/** Has a cleared driver and a cleared crew chief. */
export function crewCompleteOf(amb: Ambulance, crew: CrewLookup): boolean {
  const members = crewOf(amb, crew);
  return (
    members.some((c) => c.role === "driver" && c.qualifications.includes("hf_driver_cleared")) &&
    members.some((c) => c.role === "crew_chief" && c.qualifications.includes("hf_crew_chief_cleared"))
  );
}

export function crewChiefOf(amb: Ambulance, crew: CrewLookup): CrewMember | null {
  return crewOf(amb, crew).find((c) => c.role === "crew_chief") ?? null;
}

/** Selectable = not out of service and crew complete. Facts, not judgement. */
export function selectability(
  amb: Ambulance,
  crew: CrewLookup,
): { selectable: boolean; unavailableReason: string | null } {
  if (amb.status === "out_of_service") return { selectable: false, unavailableReason: "Out of service" };
  if (!crewCompleteOf(amb, crew)) return { selectable: false, unavailableReason: "Crew incomplete" };
  return { selectable: true, unavailableReason: null };
}

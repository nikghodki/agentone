import type { Persona } from "@shared/types";

import studentData from "../../personas/student.json";
import professionalData from "../../personas/professional.json";
import parentData from "../../personas/parent.json";
import smallBusinessData from "../../personas/small-business.json";

const ALL_PERSONAS: Persona[] = [
  studentData as Persona,
  professionalData as Persona,
  parentData as Persona,
  smallBusinessData as Persona,
];

export function loadPersonas(): Persona[] {
  return ALL_PERSONAS;
}

export function getPersonaById(id: string): Persona | undefined {
  return ALL_PERSONAS.find((p) => p.id === id);
}

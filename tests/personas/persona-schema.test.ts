import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import type { Persona } from "../../src/shared/types";

const PERSONAS_DIR = path.join(__dirname, "../../src/personas");

function loadPersona(filename: string): Persona {
  const raw = fs.readFileSync(path.join(PERSONAS_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

describe("persona JSON files", () => {
  const files = ["student.json", "professional.json", "parent.json", "small-business.json"];

  for (const file of files) {
    describe(file, () => {
      it("has required top-level fields", () => {
        const p = loadPersona(file);
        expect(p.id).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(p.icon).toBeTruthy();
        expect(p.system_prompt).toBeTruthy();
        expect(Array.isArray(p.tasks)).toBe(true);
        expect(Array.isArray(p.discovery_queue)).toBe(true);
      });

      it("has at least 4 tasks", () => {
        const p = loadPersona(file);
        expect(p.tasks.length).toBeGreaterThanOrEqual(4);
      });

      it("every task has a valid guided_flow with fields and prompt_template", () => {
        const p = loadPersona(file);
        for (const task of p.tasks) {
          expect(task.id).toBeTruthy();
          expect(task.title).toBeTruthy();
          expect(task.guided_flow).toBeDefined();
          expect(Array.isArray(task.guided_flow.fields)).toBe(true);
          expect(task.guided_flow.fields.length).toBeGreaterThan(0);
          expect(task.guided_flow.prompt_template).toBeTruthy();
          for (const field of task.guided_flow.fields) {
            expect(["choice", "textarea", "text"]).toContain(field.type);
            expect(field.label).toBeTruthy();
            if (field.type === "choice") {
              expect(Array.isArray(field.options)).toBe(true);
              expect(field.options!.length).toBeGreaterThan(0);
            }
          }
        }
      });
    });
  }
});

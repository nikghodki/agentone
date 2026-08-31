import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { FRAMEWORKS, seedFrameworkRegistry } from "../../src/main/framework-registry";
import type { FrameworkMeta } from "../../src/shared/v2-types";

describe("framework-registry", () => {
  describe("FRAMEWORKS constant", () => {
    it("has exactly 3 entries", () => {
      expect(FRAMEWORKS).toHaveLength(3);
    });

    it("has ids openclaw, zeptoclaw, and hermes", () => {
      const ids = FRAMEWORKS.map((fw) => fw.id).sort();
      expect(ids).toEqual(["hermes", "openclaw", "zeptoclaw"]);
    });

    it("each framework has a non-empty name", () => {
      FRAMEWORKS.forEach((fw) => {
        expect(fw.name).toBeTruthy();
        expect(typeof fw.name).toBe("string");
      });
    });

    it("each framework has exactly 5 features", () => {
      FRAMEWORKS.forEach((fw) => {
        expect(fw.features).toHaveLength(5);
        fw.features.forEach((feature) => {
          expect(typeof feature).toBe("string");
          expect(feature.length).toBeGreaterThan(0);
        });
      });
    });

    it("openclaw is marked as default", () => {
      const openclaw = FRAMEWORKS.find((fw) => fw.id === "openclaw");
      expect(openclaw).toBeDefined();
      expect(openclaw?.isDefault).toBe(true);
    });

    it("zeptoclaw and hermes are not marked as default", () => {
      const zeptoclaw = FRAMEWORKS.find((fw) => fw.id === "zeptoclaw");
      const hermes = FRAMEWORKS.find((fw) => fw.id === "hermes");
      expect(zeptoclaw?.isDefault).not.toBe(true);
      expect(hermes?.isDefault).not.toBe(true);
    });

    it("each framework has an installRecipe", () => {
      FRAMEWORKS.forEach((fw) => {
        expect(fw.installRecipe).toBeDefined();
        expect(typeof fw.installRecipe).toBe("object");
      });
    });
  });

  describe("seedFrameworkRegistry", () => {
    let testDb: Database.Database;

    beforeEach(() => {
      // Create in-memory test database
      testDb = new Database(":memory:");
      testDb.pragma("journal_mode = WAL");
      testDb.pragma("foreign_keys = ON");

      // Create the frameworks table (mimicking the real schema)
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS frameworks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          features TEXT NOT NULL,
          install_recipe TEXT NOT NULL,
          is_default INTEGER DEFAULT 0
        );
      `);
    });

    it("seeds all 3 frameworks into the database", () => {
      const dbWrapper = {
        seedFrameworks: (list: FrameworkMeta[]) => {
          for (const fw of list) {
            testDb
              .prepare(
                `INSERT OR REPLACE INTO frameworks (id, name, features, install_recipe, is_default)
                 VALUES (?, ?, ?, ?, ?)`
              )
              .run(
                fw.id,
                fw.name,
                JSON.stringify(fw.features),
                JSON.stringify(fw.installRecipe),
                fw.isDefault ? 1 : 0
              );
          }
        },
        getFrameworks: (): FrameworkMeta[] => {
          return testDb
            .prepare("SELECT * FROM frameworks")
            .all()
            .map((row: any) => {
              let features: string[] = [];
              let installRecipe: Record<string, unknown> = {};
              try {
                features = JSON.parse(row.features);
              } catch {
                features = [];
              }
              try {
                installRecipe = JSON.parse(row.install_recipe);
              } catch {
                installRecipe = {};
              }
              return {
                id: row.id,
                name: row.name,
                features,
                installRecipe,
                isDefault: row.is_default === 1,
              };
            });
        },
      };

      seedFrameworkRegistry(dbWrapper as any);

      const seeded = dbWrapper.getFrameworks();
      expect(seeded).toHaveLength(3);
      expect(seeded.map((fw) => fw.id).sort()).toEqual(["hermes", "openclaw", "zeptoclaw"]);

      // Verify data integrity
      const openclaw = seeded.find((fw) => fw.id === "openclaw");
      expect(openclaw?.name).toBeTruthy();
      expect(openclaw?.features).toHaveLength(5);
      expect(openclaw?.isDefault).toBe(true);
    });
  });
});

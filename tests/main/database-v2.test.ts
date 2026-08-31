import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "../../src/main/database";
import fs from "fs"; import path from "path"; import os from "os";

describe("Database v2 entities", () => {
  let db: Database; let p: string;
  beforeEach(() => { p = path.join(os.tmpdir(), `a1-v2-${Date.now()}.db`); db = new Database(p); db.initialize(); });
  afterEach(() => { db.close(); if (fs.existsSync(p)) fs.unlinkSync(p); });

  it("seeds and reads frameworks", () => {
    db.seedFrameworks([{ id: "openclaw", name: "OpenClaw", features: ["a","b","c","d","e"], installRecipe: {} }]);
    const f = db.getFrameworks();
    expect(f).toHaveLength(1); expect(f[0].id).toBe("openclaw"); expect(f[0].features).toHaveLength(5);
  });
  it("creates and lists deployments", () => {
    db.seedFrameworks([{ id: "openclaw", name: "OpenClaw", features: [], installRecipe: {} }]);
    const d = db.createDeployment({ frameworkId: "openclaw", location: "local", remoteUrl: null, modelBackendId: null });
    expect(d.id).toBeDefined(); expect(db.getDeployments()[0].frameworkId).toBe("openclaw");
  });
  it("saves and reads a model backend without the raw secret", () => {
    db.saveModelBackend({ id: "b1", kind: "cloud", provider: "anthropic", baseUrl: null, protocol: "v1/messages", model: "claude-sonnet-5", secretRef: "kc:anthropic" });
    expect(db.getModelBackend("b1")?.secretRef).toBe("kc:anthropic");
  });
  it("records and lists capabilities", () => {
    db.seedFrameworks([{ id: "openclaw", name: "OpenClaw", features: [], installRecipe: {} }]);
    const d = db.createDeployment({ frameworkId: "openclaw", location: "local", remoteUrl: null, modelBackendId: null });
    db.recordCapability({ deploymentId: d.id, type: "mcp", name: "web-search", source: "clawhub" });
    expect(db.getCapabilities(d.id)[0].name).toBe("web-search");
  });
});

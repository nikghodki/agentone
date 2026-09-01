import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "../../src/main/database";
import fs from "fs";
import path from "path";
import os from "os";

describe("Database", () => {
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `agentone-test-${Date.now()}.db`);
    db = new Database(dbPath);
    db.initialize();
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  describe("profile", () => {
    it("returns null when no profile exists", () => {
      expect(db.getProfile()).toBeNull();
    });

    it("saves and retrieves a profile", () => {
      const profile = {
        persona: "student",
        priorities: ["summarize", "quiz"],
        licenseKey: null,
        licenseValidUntil: null,
      };
      db.saveProfile(profile);
      const result = db.getProfile();
      expect(result).toEqual(profile);
    });

    it("updates existing profile on save", () => {
      db.saveProfile({ persona: "student", priorities: [], licenseKey: null, licenseValidUntil: null });
      db.saveProfile({ persona: "professional", priorities: ["emails"], licenseKey: "key123", licenseValidUntil: "2027-01-01" });
      const result = db.getProfile();
      expect(result?.persona).toBe("professional");
      expect(result?.licenseKey).toBe("key123");
    });
  });

  describe("conversations", () => {
    it("creates a conversation and retrieves it", () => {
      const conv = db.createConversation("draft_email");
      expect(conv.id).toBeDefined();
      expect(conv.taskId).toBe("draft_email");
      const all = db.getConversations(10);
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(conv.id);
    });

    it("creates freeform conversation with null taskId", () => {
      const conv = db.createConversation(null);
      expect(conv.taskId).toBeNull();
    });

    it("returns conversations ordered by updatedAt desc", () => {
      const c1 = db.createConversation("task_a");
      const c2 = db.createConversation("task_b");
      const all = db.getConversations(10);
      expect(all[0].id).toBe(c2.id);
      expect(all[1].id).toBe(c1.id);
    });

    it("respects limit", () => {
      db.createConversation("a");
      db.createConversation("b");
      db.createConversation("c");
      expect(db.getConversations(2)).toHaveLength(2);
    });
  });

  describe("messages", () => {
    it("saves and retrieves messages for a conversation", () => {
      const conv = db.createConversation(null);
      db.saveMessage({ id: "m1", conversationId: conv.id, role: "user", content: "Hello" });
      db.saveMessage({ id: "m2", conversationId: conv.id, role: "assistant", content: "Hi there!" });
      const msgs = db.getMessages(conv.id);
      expect(msgs).toHaveLength(2);
      expect(msgs[0].role).toBe("user");
      expect(msgs[1].role).toBe("assistant");
    });
  });

  describe("task usage", () => {
    it("records and retrieves task usage stats", () => {
      db.recordTaskUsage({ taskId: "draft_email", persona: "professional", startedAt: new Date().toISOString(), completed: true, durationSeconds: 30 });
      db.recordTaskUsage({ taskId: "draft_email", persona: "professional", startedAt: new Date().toISOString(), completed: true, durationSeconds: 45 });
      db.recordTaskUsage({ taskId: "brainstorm", persona: "professional", startedAt: new Date().toISOString(), completed: true, durationSeconds: 60 });
      const stats = db.getTaskUsageStats();
      const emailStat = stats.find((s) => s.taskId === "draft_email");
      expect(emailStat?.count).toBe(2);
    });
  });

  describe("daily generation count", () => {
    it("starts at 0", () => {
      expect(db.getDailyGenerationCount()).toBe(0);
    });

    it("increments count", () => {
      db.incrementDailyGenerationCount();
      db.incrementDailyGenerationCount();
      expect(db.getDailyGenerationCount()).toBe(2);
    });
  });

  describe("model backends", () => {
    it("persists and reads back a model backend with extra config", () => {
      db.saveModelBackend({
        id: "mb1", kind: "cloud", provider: "azure", baseUrl: null,
        protocol: "v1/chat/completions", model: "gpt-4o",
        secretRef: "backend:mb1",
        extra: { deployment: "gpt4o", apiVersion: "2024-06-01", resourceUrl: "https://r.openai.azure.com" },
      });
      const got = db.getModelBackend("mb1");
      expect(got?.extra).toEqual({ deployment: "gpt4o", apiVersion: "2024-06-01", resourceUrl: "https://r.openai.azure.com" });
    });

    it("reads back null extra when none provided", () => {
      db.saveModelBackend({
        id: "mb2", kind: "ollama", provider: null, baseUrl: "http://127.0.0.1:11434",
        protocol: "v1/chat/completions", model: "llama3.2:3b", secretRef: null,
      });
      expect(db.getModelBackend("mb2")?.extra ?? null).toBeNull();
    });

    it("adds extra_json column to a pre-existing table without it (migration)", () => {
      // Simulate an old DB: create model_backends WITHOUT extra_json, then initialize() again.
      const raw = (db as any).db as import("better-sqlite3").Database;
      raw.exec("DROP TABLE IF EXISTS model_backends");
      raw.exec(`CREATE TABLE model_backends (id TEXT PRIMARY KEY, kind TEXT, provider TEXT, base_url TEXT, protocol TEXT, model TEXT, secret_ref TEXT)`);
      db.initialize(); // must ALTER-add extra_json, not throw
      db.saveModelBackend({ id: "mb3", kind: "cloud", provider: "bedrock", baseUrl: null, protocol: "v1/messages", model: "anthropic.claude-3-5-sonnet-20240620-v1:0", secretRef: "backend:mb3", extra: { region: "us-east-1" } });
      expect(db.getModelBackend("mb3")?.extra).toEqual({ region: "us-east-1" });
    });
  });

  describe("capabilities", () => {
    it("removeCapability deletes only the matching capability row", () => {
      db.seedFrameworks([{ id: "hermes", name: "Hermes", features: ["a","b","c","d","e"], installRecipe: {} }]);
      const dep = db.createDeployment({ frameworkId: "hermes", location: "local", remoteUrl: null, modelBackendId: null });
      db.recordCapability({ deploymentId: dep.id, type: "skill", name: "web-search", source: "marketplace" });
      db.recordCapability({ deploymentId: dep.id, type: "mcp", name: "fs", source: "marketplace" });

      db.removeCapability(dep.id, "skill", "web-search");

      const remaining = db.getCapabilities(dep.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]).toMatchObject({ type: "mcp", name: "fs" });
    });

    it("removeCapability is a no-op when the row does not exist", () => {
      db.seedFrameworks([{ id: "hermes", name: "Hermes", features: ["a","b","c","d","e"], installRecipe: {} }]);
      const dep = db.createDeployment({ frameworkId: "hermes", location: "local", remoteUrl: null, modelBackendId: null });
      expect(() => db.removeCapability(dep.id, "skill", "nope")).not.toThrow();
      expect(db.getCapabilities(dep.id)).toHaveLength(0);
    });
  });
});

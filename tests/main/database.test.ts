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
});

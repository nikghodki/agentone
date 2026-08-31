import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../../src/main/rate-limiter";
import { Database } from "../../src/main/database";
import fs from "fs";
import path from "path";
import os from "os";

describe("RateLimiter", () => {
  let db: Database;
  let dbPath: string;
  const limiter = new RateLimiter(20);

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `agentone-rl-test-${Date.now()}.db`);
    db = new Database(dbPath);
    db.initialize();
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("allows generation for free user under limit", () => {
    expect(limiter.canGenerate(db, "free")).toBe(true);
  });

  it("blocks generation for free user at limit", () => {
    for (let i = 0; i < 20; i++) limiter.recordGeneration(db);
    expect(limiter.canGenerate(db, "free")).toBe(false);
  });

  it("always allows generation for pro user", () => {
    for (let i = 0; i < 100; i++) limiter.recordGeneration(db);
    expect(limiter.canGenerate(db, "pro")).toBe(true);
  });

  it("reports remaining generations correctly", () => {
    for (let i = 0; i < 5; i++) limiter.recordGeneration(db);
    expect(limiter.getRemainingGenerations(db, "free")).toBe(15);
  });

  it("reports unlimited for pro users", () => {
    expect(limiter.getRemainingGenerations(db, "pro")).toBe("unlimited");
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "../../src/main/database";
import { Secrets } from "../../src/main/secrets";
import { handleSaveModelBackend } from "../../src/main/ipc-handlers";
import fs from "fs";
import path from "path";
import os from "os";

// Fake encryptor: reversible, no Electron needed
const fakeEnc = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(s, "utf8"),
  decryptString: (b: Buffer) => b.toString("utf8"),
};

describe("saveModelBackend IPC handler", () => {
  let db: Database;
  let secrets: Secrets;
  let dbPath: string;
  let secretsPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `a1-backend-${Date.now()}.db`);
    secretsPath = path.join(os.tmpdir(), `a1-secrets-${Date.now()}.json`);
    db = new Database(dbPath);
    db.initialize();
    secrets = new Secrets(secretsPath, fakeEnc as any);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(secretsPath)) fs.unlinkSync(secretsPath);
  });

  it("saves backend with API key → persists config + secret", () => {
    const draft = {
      kind: "cloud",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      protocol: "v1/messages",
      model: "claude-3-5-sonnet-20241022",
    };
    const apiKey = "sk-ant-api03-abcdef1234567890";

    const id = handleSaveModelBackend(db, secrets, draft, apiKey);

    // Backend persisted with non-null secretRef
    const backend = db.getModelBackend(id);
    expect(backend).toBeDefined();
    expect(backend?.kind).toBe("cloud");
    expect(backend?.provider).toBe("anthropic");
    expect(backend?.model).toBe("claude-3-5-sonnet-20241022");
    expect(backend?.secretRef).toBe(`backend:${id}`);

    // Secret stored and retrievable
    expect(secrets.get(`backend:${id}`)).toBe(apiKey);

    // Raw key never in the DB row
    const raw = JSON.stringify(backend);
    expect(raw).not.toContain(apiKey);
  });

  it("saves backend without API key → secretRef null, no secret stored", () => {
    const draft = {
      kind: "ollama",
      provider: null,
      baseUrl: "http://localhost:11434",
      protocol: "v1/chat/completions",
      model: "llama3.2",
    };

    const id = handleSaveModelBackend(db, secrets, draft);

    // Backend persisted with null secretRef
    const backend = db.getModelBackend(id);
    expect(backend).toBeDefined();
    expect(backend?.kind).toBe("ollama");
    expect(backend?.secretRef).toBeNull();

    // No secret stored
    expect(secrets.get(`backend:${id}`)).toBeNull();
  });

  it("saves backend with empty string API key → secretRef null", () => {
    const draft = {
      kind: "custom",
      provider: null,
      baseUrl: "http://localhost:8000",
      protocol: "v1/chat/completions",
      model: "my-model",
    };

    const id = handleSaveModelBackend(db, secrets, draft, "");

    // Backend persisted with null secretRef
    const backend = db.getModelBackend(id);
    expect(backend?.secretRef).toBeNull();

    // No secret stored
    expect(secrets.get(`backend:${id}`)).toBeNull();
  });

  it("returns a usable id", () => {
    const draft = {
      kind: "cloud",
      provider: "openai",
      baseUrl: "https://api.openai.com",
      protocol: "v1/chat/completions",
      model: "gpt-4",
    };
    const apiKey = "sk-proj-xyz";

    const id = handleSaveModelBackend(db, secrets, draft, apiKey);

    // ID is a valid UUID
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    // Backend retrievable by ID
    const backend = db.getModelBackend(id);
    expect(backend).toBeDefined();
    expect(backend?.id).toBe(id);
  });

  it("persists extra config and stores a JSON multi-part secret via Secrets", () => {
    const id = handleSaveModelBackend(
      db,
      secrets,
      { kind: "cloud", provider: "bedrock", baseUrl: null, protocol: "v1/messages",
        model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        extra: { region: "us-east-1" } },
      JSON.stringify({ accessKeyId: "AKIA...", secretAccessKey: "shh" })
    );
    const saved = db.getModelBackend(id)!;
    expect(saved.extra).toEqual({ region: "us-east-1" });
    expect(saved.secretRef).toBe(`backend:${id}`);
    // Secret is retrievable and NOT in the DB row (only the ref is)
    expect(JSON.parse(secrets.get(saved.secretRef!)!)).toEqual({ accessKeyId: "AKIA...", secretAccessKey: "shh" });
  });

  it("stores no secretRef when no secret provided", () => {
    const id = handleSaveModelBackend(
      db,
      secrets,
      { kind: "llamacpp", provider: null, baseUrl: "http://127.0.0.1:8080/v1",
        protocol: "v1/chat/completions", model: "qwen2.5-1.5b" }, undefined);
    expect(db.getModelBackend(id)?.secretRef).toBeNull();
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Secrets } from "../../src/main/secrets";
import fs from "fs";
import path from "path";
import os from "os";

// Fake encryptor: reversible, no Electron needed
const fakeEnc = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(s, "utf8"),
  decryptString: (b: Buffer) => b.toString("utf8"),
};

describe("Secrets", () => {
  describe("in-memory mode", () => {
    it("stores and retrieves a secret by ref", () => {
      const s = new Secrets(":memory:", fakeEnc as any);
      s.set("kc:anthropic", "sk-abc");
      expect(s.get("kc:anthropic")).toBe("sk-abc");
    });

    it("returns null for unknown ref", () => {
      const s = new Secrets(":memory:", fakeEnc as any);
      expect(s.get("nope")).toBeNull();
    });

    it("deletes a secret", () => {
      const s = new Secrets(":memory:", fakeEnc as any);
      s.set("k", "v");
      s.delete("k");
      expect(s.get("k")).toBeNull();
    });
  });

  describe("file-based persistence", () => {
    let filePath: string;

    beforeEach(() => {
      filePath = path.join(os.tmpdir(), `agentone-secrets-test-${Date.now()}.json`);
    });

    afterEach(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    it("persists a secret across instances", () => {
      // First instance: set a secret
      const s1 = new Secrets(filePath, fakeEnc as any);
      s1.set("api-key", "sk-12345");

      // Second instance: load from same file
      const s2 = new Secrets(filePath, fakeEnc as any);
      expect(s2.get("api-key")).toBe("sk-12345");
    });

    it("stores only base64 ciphertext on disk", () => {
      const s = new Secrets(filePath, fakeEnc as any);
      s.set("secret", "my-password");

      // Read the raw file
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(fileContent);

      // Verify the value is base64, not the raw secret
      expect(parsed.secret).toBeDefined();
      expect(parsed.secret).not.toBe("my-password");

      // Base64 decode it to verify it matches the encrypted value
      const decodedBuffer = Buffer.from(parsed.secret, "base64");
      expect(decodedBuffer.toString("utf8")).toBe("my-password");
    });

    it("handles corrupt JSON file gracefully", () => {
      // Write invalid JSON to the file
      fs.writeFileSync(filePath, "{ invalid json }", "utf-8");

      // Create a Secrets instance pointing to the corrupt file
      const s = new Secrets(filePath, fakeEnc as any);

      // Should not throw, should return null for any ref
      expect(s.get("anything")).toBeNull();

      // Should be able to set a new secret (store starts empty)
      s.set("new-key", "new-value");
      expect(s.get("new-key")).toBe("new-value");
    });

    it("handles missing file gracefully", () => {
      // File does not exist yet
      expect(fs.existsSync(filePath)).toBe(false);

      // Create a Secrets instance pointing to non-existent file
      const s = new Secrets(filePath, fakeEnc as any);

      // Should not throw, should return null
      expect(s.get("anything")).toBeNull();

      // Should create file on first set
      s.set("key", "value");
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});

import { describe, it, expect } from "vitest";
import { Secrets } from "../../src/main/secrets";

// Fake encryptor: reversible, no Electron needed
const fakeEnc = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(s, "utf8"),
  decryptString: (b: Buffer) => b.toString("utf8"),
};

describe("Secrets", () => {
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

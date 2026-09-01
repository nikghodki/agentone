import { describe, it, expect } from "vitest";
import { ZeptoclawAdapter } from "../../src/main/frameworks/zeptoclaw-adapter";
import { Secrets } from "../../src/main/secrets";
import { createAdapter } from "../../src/main/ipc-handlers";

/**
 * Mock encryptor for testing (same as in secrets.test.ts).
 */
const mockEncryptor = {
  isEncryptionAvailable: () => true,
  encryptString: (text: string) => Buffer.from(text, "utf-8"),
  decryptString: (buf: Buffer) => buf.toString("utf-8"),
};

/**
 * Unit test for the adapter factory logic.
 * Tests that:
 * - "zeptoclaw" returns a ZeptoclawAdapter instance
 * - Unsupported frameworks throw clear errors
 */
describe("Adapter Factory", () => {
  it("should create ZeptoclawAdapter for frameworkId 'zeptoclaw'", () => {
    const secrets = new Secrets(":memory:", mockEncryptor);
    const adapter = createAdapter("zeptoclaw", secrets);
    expect(adapter).toBeInstanceOf(ZeptoclawAdapter);
  });

  it("should throw clear error for unsupported framework 'openclaw'", () => {
    const secrets = new Secrets(":memory:", mockEncryptor);
    expect(() => createAdapter("openclaw", secrets)).toThrow(
      'Framework "openclaw" is not yet supported. Only "zeptoclaw" is currently wired for deployment.'
    );
  });

  it("should throw clear error for unsupported framework 'hermes'", () => {
    const secrets = new Secrets(":memory:", mockEncryptor);
    expect(() => createAdapter("hermes", secrets)).toThrow(
      'Framework "hermes" is not yet supported. Only "zeptoclaw" is currently wired for deployment.'
    );
  });
});

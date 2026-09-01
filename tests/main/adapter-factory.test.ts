import { describe, it, expect } from "vitest";
import { ZeptoclawAdapter } from "../../src/main/frameworks/zeptoclaw-adapter";
import { HermesAdapter } from "../../src/main/frameworks/hermes-adapter";
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
 * - "hermes" returns a HermesAdapter instance
 * - Unsupported frameworks throw clear errors
 */
describe("Adapter Factory", () => {
  it("should create ZeptoclawAdapter for frameworkId 'zeptoclaw'", () => {
    const secrets = new Secrets(":memory:", mockEncryptor);
    const adapter = createAdapter("zeptoclaw", secrets);
    expect(adapter).toBeInstanceOf(ZeptoclawAdapter);
  });

  it("should create HermesAdapter for frameworkId 'hermes'", () => {
    const secrets = new Secrets(":memory:", mockEncryptor);
    const adapter = createAdapter("hermes", secrets);
    expect(adapter).toBeInstanceOf(HermesAdapter);
  });

  it("should throw clear error for unsupported framework 'openclaw'", () => {
    const secrets = new Secrets(":memory:", mockEncryptor);
    expect(() => createAdapter("openclaw", secrets)).toThrow(
      'Framework "openclaw" is not yet supported. Only "zeptoclaw" and "hermes" are currently wired for deployment.'
    );
  });

  it("should throw clear error for unknown framework", () => {
    const secrets = new Secrets(":memory:", mockEncryptor);
    expect(() => createAdapter("unknown-framework", secrets)).toThrow(
      'Framework "unknown-framework" is not yet supported. Only "zeptoclaw" and "hermes" are currently wired for deployment.'
    );
  });
});

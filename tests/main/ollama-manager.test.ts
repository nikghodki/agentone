import { describe, it, expect, vi, beforeEach } from "vitest";
import { OllamaManager } from "../../src/main/ollama-manager";

// These test the logic without actually running Ollama.
// Integration tests with real Ollama require it to be installed.

describe("OllamaManager", () => {
  let manager: OllamaManager;

  beforeEach(() => {
    manager = new OllamaManager("/fake/ollama", "/fake/models");
  });

  it("generates a random port between 11500-12500", () => {
    const port = manager.getPort();
    expect(port).toBeGreaterThanOrEqual(11500);
    expect(port).toBeLessThanOrEqual(12500);
  });

  it("reports not ready before start", async () => {
    const ready = await manager.isReady();
    expect(ready).toBe(false);
  });

  it("builds correct Ollama API URL", () => {
    const url = manager.getBaseUrl();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });
});

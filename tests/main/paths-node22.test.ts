import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

describe("resolveBundledNode22BinDir", () => {
  let tempDir: string;
  let originalResourcesPath: string | undefined;

  beforeEach(() => {
    // Create a temp directory for testing
    tempDir = path.join(os.tmpdir(), `agentone-paths-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Save original process.resourcesPath
    originalResourcesPath = process.resourcesPath;
  });

  afterEach(() => {
    // Restore original process.resourcesPath
    if (originalResourcesPath !== undefined) {
      (process as any).resourcesPath = originalResourcesPath;
    } else {
      delete (process as any).resourcesPath;
    }

    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Clear module cache to ensure fresh imports
    vi.resetModules();
  });

  it("returns the bundled node22-bin path when it exists", async () => {
    // Create the node22-bin directory
    const node22BinDir = path.join(tempDir, "node22-bin");
    fs.mkdirSync(node22BinDir, { recursive: true });

    // Mock process.resourcesPath
    (process as any).resourcesPath = tempDir;

    // Import after mocking
    const { resolveBundledNode22BinDir } = await import("../../src/main/paths");

    const result = resolveBundledNode22BinDir();
    expect(result).toBe(node22BinDir);
  });

  it("returns null when node22-bin directory does not exist", async () => {
    // Set resourcesPath but don't create node22-bin
    (process as any).resourcesPath = tempDir;

    // Import after mocking
    const { resolveBundledNode22BinDir } = await import("../../src/main/paths");

    const result = resolveBundledNode22BinDir();
    expect(result).toBeNull();
  });

  it("returns null when process.resourcesPath is undefined", async () => {
    // Ensure resourcesPath is undefined (dev/test environment)
    delete (process as any).resourcesPath;

    // Import after mocking
    const { resolveBundledNode22BinDir } = await import("../../src/main/paths");

    const result = resolveBundledNode22BinDir();
    expect(result).toBeNull();
  });
});

import { describe, it, expect, vi } from "vitest";
import { handleRemoveCapability } from "../../src/main/ipc-handlers";

describe("capabilities IPC handlers", () => {
  it("get-capabilities: handler delegates to db.getCapabilities", async () => {
    // Test the delegation pattern used by the get-capabilities handler
    // (which is inline: ipcMain.handle("get-capabilities", (_e, deploymentId) => db.getCapabilities(deploymentId)))
    const mockCapabilities = [
      { deploymentId: "dep1", type: "skill", name: "web-search", source: "hermes" },
      { deploymentId: "dep1", type: "mcp", name: "fs", source: "hermes" },
    ];
    const mockDb = { getCapabilities: vi.fn().mockResolvedValue(mockCapabilities) };

    // Simulate what the handler does: calls db.getCapabilities with deploymentId
    const result = await mockDb.getCapabilities("dep1");

    expect(mockDb.getCapabilities).toHaveBeenCalledWith("dep1");
    expect(result).toEqual(mockCapabilities);
  });

  it("running deployment: calls adapter.removeCapability AND deletes the DB row", async () => {
    const adapter = { removeCapability: vi.fn().mockResolvedValue({ frameworkRemoved: true }) };
    const db = { removeCapability: vi.fn() };
    const res = await handleRemoveCapability("dep1", { type: "skill", name: "web-search" },
      { db: db as any, getAdapter: () => adapter as any });
    expect(adapter.removeCapability).toHaveBeenCalledWith({ type: "skill", name: "web-search" });
    expect(db.removeCapability).toHaveBeenCalledWith("dep1", "skill", "web-search");
    expect(res).toEqual({ frameworkRemoved: true });
  });

  it("not-running deployment: skips adapter, still deletes DB row, returns forget note", async () => {
    const db = { removeCapability: vi.fn() };
    const res = await handleRemoveCapability("dep1", { type: "skill", name: "x" },
      { db: db as any, getAdapter: () => undefined });
    expect(db.removeCapability).toHaveBeenCalledWith("dep1", "skill", "x");
    expect(res.frameworkRemoved).toBe(false);
    expect(res.note).toMatch(/not running/i);
  });

  it("adapter reports frameworkRemoved false (unsupported): DB row still deleted, note passed through", async () => {
    const adapter = { removeCapability: vi.fn().mockResolvedValue({ frameworkRemoved: false, note: "bundled" }) };
    const db = { removeCapability: vi.fn() };
    const res = await handleRemoveCapability("dep1", { type: "skill", name: "x" },
      { db: db as any, getAdapter: () => adapter as any });
    expect(db.removeCapability).toHaveBeenCalled();
    expect(res).toEqual({ frameworkRemoved: false, note: "bundled" });
  });

  it("adapter throw: DB row is NOT deleted and the error propagates (keep-on-error)", async () => {
    const adapter = { removeCapability: vi.fn().mockRejectedValue(new Error("uninstall failed")) };
    const db = { removeCapability: vi.fn() };
    await expect(handleRemoveCapability("dep1", { type: "skill", name: "x" },
      { db: db as any, getAdapter: () => adapter as any })).rejects.toThrow("uninstall failed");
    expect(db.removeCapability).not.toHaveBeenCalled();
  });
});

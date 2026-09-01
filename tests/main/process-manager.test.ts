import { describe, it, expect, vi } from "vitest";
import { ProcessManager } from "../../src/main/frameworks/process-manager";
import { EventEmitter } from "events";

function fakeChild() { const c: any = new EventEmitter(); c.pid = 1234; c.kill = vi.fn(() => c.emit("exit", 0)); c.stdout = new EventEmitter(); c.stderr = new EventEmitter(); return c; }

describe("ProcessManager", () => {
  it("starts a process via the injected spawnFn and reports running", () => {
    const child = fakeChild(); const spawnFn = vi.fn(() => child);
    const pm = new ProcessManager(spawnFn as any);
    pm.start("zeptoclaw", ["serve"], { env: { PATH: "/x" } });
    expect(spawnFn).toHaveBeenCalledWith("zeptoclaw", ["serve"], expect.objectContaining({ env: { PATH: "/x" } }));
    expect(pm.isRunning()).toBe(true);
  });
  it("waitUntilReady resolves once check returns true", async () => {
    const pm = new ProcessManager(vi.fn(() => fakeChild()) as any);
    pm.start("x", [], {});
    let n = 0; await expect(pm.waitUntilReady(async () => ++n >= 3, { timeoutMs: 1000, intervalMs: 1 })).resolves.toBeUndefined();
    expect(n).toBe(3);
  });
  it("waitUntilReady rejects on timeout", async () => {
    const pm = new ProcessManager(vi.fn(() => fakeChild()) as any);
    pm.start("x", [], {});
    await expect(pm.waitUntilReady(async () => false, { timeoutMs: 20, intervalMs: 5 })).rejects.toThrow(/timeout/i);
  });
  it("stop kills the child and reports not running", async () => {
    const child = fakeChild(); const pm = new ProcessManager(vi.fn(() => child) as any);
    pm.start("x", [], {}); await pm.stop();
    expect(child.kill).toHaveBeenCalled(); expect(pm.isRunning()).toBe(false);
  });
  it("captures spawn error and sets not-running without throwing uncaught", () => {
    const child = fakeChild(); const pm = new ProcessManager(vi.fn(() => child) as any);
    pm.start("x", [], {});
    expect(pm.isRunning()).toBe(true);
    // Emit error (simulating ENOENT, EACCES, etc.)
    const testError = new Error("ENOENT: command not found");
    child.emit("error", testError);
    // Should be marked not-running
    expect(pm.isRunning()).toBe(false);
    // Should store the error
    expect(pm.getLastError()).toBe(testError);
    // Should null out child
    expect(pm.getChild()).toBe(null);
  });
  it("getChild returns null when not running", () => {
    const child = fakeChild(); const pm = new ProcessManager(vi.fn(() => child) as any);
    pm.start("x", [], {});
    expect(pm.getChild()).toBe(child);
    // Simulate exit
    child.emit("exit", 0);
    expect(pm.isRunning()).toBe(false);
    expect(pm.getChild()).toBe(null);
  });
});

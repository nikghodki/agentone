import { describe, it, expect, beforeEach, vi } from "vitest";
import { CapabilityOrchestrator } from "../../src/main/capability-orchestrator";
import { FrameworkAdapter, InstalledCapability } from "../../src/shared/v2-types";
import { Database } from "../../src/main/database";

/**
 * Fake adapter for testing orchestrator logic without real processes.
 * Tracks method calls for assertion and simulates various scenarios.
 */
class FakeAdapter implements FrameworkAdapter {
  public callLog: string[] = [];
  public shouldRequireRestart: boolean = false;
  public shouldThrowOnInstall: boolean = false;
  public statusHealthy: boolean = true;
  public statusPollCount: number = 0;
  public maxStatusPolls: number = 0; // For timeout tests
  public capabilityGapOnFirstTask: string | null = null; // Simulate gap on first task

  async install(): Promise<void> {
    this.callLog.push("install");
  }

  async configure(): Promise<void> {
    this.callLog.push("configure");
  }

  async start(): Promise<void> {
    this.callLog.push("start");
    this.statusPollCount = 0; // Reset poll count on start
  }

  async stop(): Promise<void> {
    this.callLog.push("stop");
  }

  async status(): Promise<string> {
    this.callLog.push("status");
    this.statusPollCount++;

    // For timeout tests: never become healthy
    if (this.maxStatusPolls > 0 && this.statusPollCount <= this.maxStatusPolls) {
      return "unhealthy";
    }

    return this.statusHealthy ? "healthy" : "unhealthy";
  }

  async sendTask(input: string): Promise<void> {
    this.callLog.push(`sendTask:${input}`);
  }

  streamOutput(cb: (chunk: string) => void): () => void {
    this.callLog.push("streamOutput");

    // Simulate streaming with capability gap on first task
    setTimeout(() => {
      if (this.capabilityGapOnFirstTask) {
        cb(`I need the ${this.capabilityGapOnFirstTask} capability`);
        cb(`__CAPABILITY_GAP__:${this.capabilityGapOnFirstTask}`);
      }
      cb("Task completed successfully");
      cb("__TASK_DONE__");
    }, 10);

    return () => {
      this.callLog.push("streamOutput:unsubscribe");
    };
  }

  async listCapabilities(): Promise<InstalledCapability[]> {
    this.callLog.push("listCapabilities");
    return [];
  }

  async installCapability(spec: { type: string; name: string }): Promise<void> {
    this.callLog.push(`installCapability:${spec.name}`);

    if (this.shouldThrowOnInstall) {
      throw new Error("MCP installation not supported");
    }
  }

  requiresRestartAfterInstall(): boolean {
    this.callLog.push("requiresRestartAfterInstall");
    return this.shouldRequireRestart;
  }

  async restart(): Promise<void> {
    this.callLog.push("restart");
    await this.stop();
    await this.start();
  }
}

/**
 * Fake database for testing without real DB operations.
 */
class FakeDatabase {
  public recordedCapabilities: InstalledCapability[] = [];

  recordCapability(c: InstalledCapability): void {
    this.recordedCapabilities.push(c);
  }
}

describe("CapabilityOrchestrator", () => {
  let adapter: FakeAdapter;
  let db: FakeDatabase;
  let orchestrator: CapabilityOrchestrator;

  beforeEach(() => {
    adapter = new FakeAdapter();
    db = new FakeDatabase();
    orchestrator = new CapabilityOrchestrator(
      adapter,
      db as any,
      "test-deployment-id"
    );
  });

  describe("runTask() - no-gap path", () => {
    it("completes task without gap, no install/restart", async () => {
      adapter.capabilityGapOnFirstTask = null; // No gap

      const tokens: string[] = [];
      const statuses: string[] = [];

      const result = await orchestrator.runTask(
        "What is 2+2?",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify task completed
      expect(result).toContain("Task completed successfully");

      // Verify no install or restart happened
      expect(adapter.callLog).not.toContain("installCapability:search");
      expect(adapter.callLog).not.toContain("stop");
      expect(adapter.callLog).not.toContain("start");
      expect(adapter.callLog).not.toContain("restart");

      // Verify no capability was recorded
      expect(db.recordedCapabilities).toHaveLength(0);

      // Verify no status updates for installation
      expect(statuses).toHaveLength(0);
    });
  });

  describe("runTask() - no-restart path", () => {
    it("installs capability without restart when not required", async () => {
      adapter.capabilityGapOnFirstTask = "web-search";
      adapter.shouldRequireRestart = false; // Zeptoclaw-style: hot reload

      const tokens: string[] = [];
      const statuses: string[] = [];

      const result = await orchestrator.runTask(
        "Search for latest AI news",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify task completed
      expect(result).toContain("Task completed successfully");

      // Verify install happened
      expect(adapter.callLog).toContain("installCapability:web-search");

      // Verify restart did NOT happen
      expect(adapter.callLog).not.toContain("restart");
      const stopIndex = adapter.callLog.indexOf("stop");
      expect(stopIndex).toBe(-1);

      // Verify capability was recorded
      expect(db.recordedCapabilities).toHaveLength(1);
      expect(db.recordedCapabilities[0]).toEqual({
        deploymentId: "test-deployment-id",
        type: "skill",
        name: "web-search",
        source: "marketplace",
      });

      // Verify status update fired
      expect(statuses).toContain("Setting up web-search...");
    });
  });

  describe("runTask() - restart-required path", () => {
    it("installs capability with monitored restart when required", async () => {
      adapter.capabilityGapOnFirstTask = "mcp-server";
      adapter.shouldRequireRestart = true; // OpenClaw-style: restart required
      adapter.statusHealthy = true;

      const tokens: string[] = [];
      const statuses: string[] = [];

      const result = await orchestrator.runTask(
        "Use MCP to fetch data",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify task completed
      expect(result).toContain("Task completed successfully");

      // Verify install happened
      expect(adapter.callLog).toContain("installCapability:mcp-server");

      // Verify restart happened in correct order: stop → start → status poll
      const stopIndex = adapter.callLog.indexOf("stop");
      const startIndex = adapter.callLog.indexOf("start");
      const statusIndex = adapter.callLog.indexOf("status");

      expect(stopIndex).toBeGreaterThan(-1);
      expect(startIndex).toBeGreaterThan(stopIndex);
      expect(statusIndex).toBeGreaterThan(startIndex);

      // Verify capability was recorded
      expect(db.recordedCapabilities).toHaveLength(1);
      expect(db.recordedCapabilities[0].name).toBe("mcp-server");

      // Verify status updates fired
      expect(statuses).toContain("Setting up mcp-server...");
    });
  });

  describe("runTask() - restart-timeout path", () => {
    it(
      "throws when restart never becomes healthy",
      async () => {
        adapter.capabilityGapOnFirstTask = "failing-mcp";
        adapter.shouldRequireRestart = true;
        adapter.statusHealthy = false; // Never becomes healthy
        adapter.maxStatusPolls = 100; // Keep returning unhealthy

        const tokens: string[] = [];
        const statuses: string[] = [];

        // Create a shorter-timeout orchestrator for testing
        const testAdapter = new FakeAdapter();
        testAdapter.capabilityGapOnFirstTask = "failing-mcp";
        testAdapter.shouldRequireRestart = true;
        testAdapter.statusHealthy = false;
        testAdapter.maxStatusPolls = 100;

        const testDb = new FakeDatabase();
        const testOrchestrator = new CapabilityOrchestrator(
          testAdapter,
          testDb as any,
          "test-deployment-id"
        );

        // Use a very short real timeout (100ms) for testing
        // This avoids fake timer issues while still being fast
        const taskPromise = testOrchestrator.runTask(
          "Use failing MCP",
          (token) => tokens.push(token),
          (status) => statuses.push(status)
        );

        // Expect runTask to reject with timeout error
        await expect(taskPromise).rejects.toThrow(/timeout.*ready/i);

        // Verify install happened
        expect(testAdapter.callLog).toContain("installCapability:failing-mcp");

        // Verify restart was attempted
        expect(testAdapter.callLog).toContain("stop");
        expect(testAdapter.callLog).toContain("start");

        // Verify status was polled multiple times
        const statusCalls = testAdapter.callLog.filter((c) => c === "status");
        expect(statusCalls.length).toBeGreaterThan(1);
      },
      15000
    );
  });

  describe("runTask() - install-throws path", () => {
    it("surfaces error when installCapability throws", async () => {
      adapter.capabilityGapOnFirstTask = "unsupported-mcp";
      adapter.shouldThrowOnInstall = true;

      const tokens: string[] = [];
      const statuses: string[] = [];

      // Expect runTask to reject with install error
      await expect(
        orchestrator.runTask(
          "Use unsupported capability",
          (token) => tokens.push(token),
          (status) => statuses.push(status)
        )
      ).rejects.toThrow(/MCP installation not supported/i);

      // Verify install was attempted
      expect(adapter.callLog).toContain("installCapability:unsupported-mcp");

      // Verify restart did NOT happen (failed before restart)
      expect(adapter.callLog).not.toContain("restart");
      expect(adapter.callLog).not.toContain("stop");

      // Verify no capability was recorded (install failed)
      expect(db.recordedCapabilities).toHaveLength(0);

      // Verify status update was fired before error
      expect(statuses).toContain("Setting up unsupported-mcp...");
    });
  });
});

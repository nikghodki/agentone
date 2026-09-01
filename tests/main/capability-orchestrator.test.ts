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
  public capabilityGaps: string[] = []; // For multi-gap tests
  public persistentGap: string | null = null; // For persistent-gap test
  public taskCounter: number = 0; // Track how many times sendTask was called
  public preflightGap: { type: "skill" | "mcp" | "plugin"; name: string } | null = null; // For pre-flight detection
  public hasDetectGap: boolean = false; // Whether detectGap method exists

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
    this.taskCounter++;
  }

  streamOutput(cb: (chunk: string) => void): () => void {
    this.callLog.push("streamOutput");

    // Simulate streaming based on test scenario
    setTimeout(() => {
      // Persistent gap test: always emit the same gap
      if (this.persistentGap) {
        cb(`I need the ${this.persistentGap} capability`);
        cb(`__CAPABILITY_GAP__:${this.persistentGap}`);
        // Never emit DONE, just the gap
        return;
      }

      // Multi-gap test: emit gaps based on task counter
      if (this.capabilityGaps.length > 0) {
        const gapIndex = this.taskCounter - 1;
        if (gapIndex < this.capabilityGaps.length) {
          const gap = this.capabilityGaps[gapIndex];
          cb(`I need the ${gap} capability`);
          cb(`__CAPABILITY_GAP__:${gap}`);
          return; // Don't emit DONE yet, need to install and retry
        } else {
          // All gaps handled, emit success
          cb("Task completed successfully with all capabilities");
          cb("__TASK_DONE__");
          return;
        }
      }

      // Single gap test (legacy)
      if (this.capabilityGapOnFirstTask) {
        if (this.taskCounter === 1) {
          cb(`I need the ${this.capabilityGapOnFirstTask} capability`);
          cb(`__CAPABILITY_GAP__:${this.capabilityGapOnFirstTask}`);
          return; // Don't emit DONE yet
        }
      }

      // Default: emit success
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

  async detectGap?(input: string): Promise<{ type: "skill" | "mcp" | "plugin"; name: string } | null> {
    if (!this.hasDetectGap) {
      // If detectGap is not enabled, this method shouldn't exist
      return null;
    }

    this.callLog.push(`detectGap:${input}`);

    if (this.preflightGap) {
      const gap = this.preflightGap;
      this.preflightGap = null; // Return gap once, then null
      return gap;
    }

    return null;
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

  describe("runTask() - multi-gap path", () => {
    it("handles multiple gaps in sequence, installs all, returns full result", async () => {
      // Simulate task that needs TWO capabilities
      adapter.capabilityGaps = ["web-search", "mcp:database"];
      adapter.shouldRequireRestart = false;

      const tokens: string[] = [];
      const statuses: string[] = [];

      const result = await orchestrator.runTask(
        "Search web and query database",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify task completed with full result
      expect(result).toContain("Task completed successfully with all capabilities");

      // Verify both capabilities were installed
      expect(adapter.callLog).toContain("installCapability:web-search");
      expect(adapter.callLog).toContain("installCapability:database");

      // Verify both were recorded in DB
      expect(db.recordedCapabilities).toHaveLength(2);
      expect(db.recordedCapabilities[0]).toEqual({
        deploymentId: "test-deployment-id",
        type: "skill",
        name: "web-search",
        source: "marketplace",
      });
      expect(db.recordedCapabilities[1]).toEqual({
        deploymentId: "test-deployment-id",
        type: "mcp",
        name: "database",
        source: "marketplace",
      });

      // Verify both status updates fired
      expect(statuses).toContain("Setting up web-search...");
      expect(statuses).toContain("Setting up database...");

      // Verify task was sent 3 times: initial + after gap1 + after gap2
      const sendTaskCalls = adapter.callLog.filter((c) => c.startsWith("sendTask:"));
      expect(sendTaskCalls.length).toBe(3);
    });
  });

  describe("runTask() - persistent-gap path", () => {
    it("throws when same gap persists after install (re-install guard)", async () => {
      // Simulate gap that never goes away (wrong name, config not reloaded, etc.)
      adapter.persistentGap = "broken-skill";
      adapter.shouldRequireRestart = false;

      const tokens: string[] = [];
      const statuses: string[] = [];

      // Expect runTask to reject with re-install guard error
      await expect(
        orchestrator.runTask(
          "Use broken skill",
          (token) => tokens.push(token),
          (status) => statuses.push(status)
        )
      ).rejects.toThrow(/already installed this run but the gap persists/i);

      // Verify install was attempted once
      expect(adapter.callLog).toContain("installCapability:broken-skill");

      // Verify it was NOT installed twice (guard worked)
      const installCalls = adapter.callLog.filter((c) => c === "installCapability:broken-skill");
      expect(installCalls.length).toBe(1);

      // Verify it was recorded once
      expect(db.recordedCapabilities).toHaveLength(1);

      // Verify status update fired once
      const statusCalls = statuses.filter((s) => s.includes("broken-skill"));
      expect(statusCalls.length).toBe(1);
    });
  });

  describe("parseGap() type validation", () => {
    it("defaults to skill when no type prefix provided", async () => {
      adapter.capabilityGapOnFirstTask = "web-search";
      adapter.shouldRequireRestart = false;

      const tokens: string[] = [];
      const statuses: string[] = [];

      await orchestrator.runTask(
        "Search the web",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify it was installed as skill type
      expect(db.recordedCapabilities[0].type).toBe("skill");
    });

    it("accepts valid type prefix (mcp)", async () => {
      adapter.capabilityGaps = ["mcp:database"];
      adapter.shouldRequireRestart = false;

      const tokens: string[] = [];
      const statuses: string[] = [];

      await orchestrator.runTask(
        "Query database",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify it was installed as mcp type
      expect(db.recordedCapabilities[0].type).toBe("mcp");
      expect(db.recordedCapabilities[0].name).toBe("database");
    });

    it("accepts valid type prefix (plugin)", async () => {
      adapter.capabilityGaps = ["plugin:custom-tool"];
      adapter.shouldRequireRestart = false;

      const tokens: string[] = [];
      const statuses: string[] = [];

      await orchestrator.runTask(
        "Use custom tool",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify it was installed as plugin type
      expect(db.recordedCapabilities[0].type).toBe("plugin");
      expect(db.recordedCapabilities[0].name).toBe("custom-tool");
    });

    it("defaults to skill when invalid type prefix provided", async () => {
      adapter.capabilityGaps = ["invalid-type:my-capability"];
      adapter.shouldRequireRestart = false;

      const tokens: string[] = [];
      const statuses: string[] = [];

      await orchestrator.runTask(
        "Use capability",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify it defaulted to skill type (not "invalid-type")
      expect(db.recordedCapabilities[0].type).toBe("skill");
      expect(db.recordedCapabilities[0].name).toBe("my-capability");
    });

    it("handles colons in capability name correctly", async () => {
      adapter.capabilityGaps = ["mcp:scope:my-server"];
      adapter.shouldRequireRestart = false;

      const tokens: string[] = [];
      const statuses: string[] = [];

      await orchestrator.runTask(
        "Use scoped MCP",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify type is mcp and name includes the colon
      expect(db.recordedCapabilities[0].type).toBe("mcp");
      expect(db.recordedCapabilities[0].name).toBe("scope:my-server");
    });
  });

  describe("runTask() - pre-flight detection (Phase 2b)", () => {
    it("calls detectGap before sendTask when adapter supports it", async () => {
      adapter.hasDetectGap = true;
      adapter.preflightGap = { type: "skill", name: "web-search" };
      adapter.shouldRequireRestart = false;

      const tokens: string[] = [];
      const statuses: string[] = [];

      const result = await orchestrator.runTask(
        "Search for AI news",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify task completed
      expect(result).toContain("Task completed successfully");

      // Verify detectGap was called BEFORE sendTask
      const detectGapIndex = adapter.callLog.findIndex((c) => c.startsWith("detectGap:"));
      const sendTaskIndex = adapter.callLog.findIndex((c) => c.startsWith("sendTask:"));

      expect(detectGapIndex).toBeGreaterThan(-1);
      expect(sendTaskIndex).toBeGreaterThan(-1);
      expect(detectGapIndex).toBeLessThan(sendTaskIndex);

      // Verify install happened before sendTask
      const installIndex = adapter.callLog.findIndex((c) => c === "installCapability:web-search");
      expect(installIndex).toBeGreaterThan(detectGapIndex);
      expect(installIndex).toBeLessThan(sendTaskIndex);

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

    it("skips pre-flight when adapter does not support detectGap", async () => {
      // Don't set hasDetectGap or preflightGap
      adapter.hasDetectGap = false;
      adapter.capabilityGapOnFirstTask = null;

      const tokens: string[] = [];
      const statuses: string[] = [];

      const result = await orchestrator.runTask(
        "What is 2+2?",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify task completed
      expect(result).toContain("Task completed successfully");

      // Verify detectGap was NOT called (method doesn't exist)
      const detectGapCalls = adapter.callLog.filter((c) => c.startsWith("detectGap:"));
      expect(detectGapCalls).toHaveLength(0);

      // Verify no install happened
      const installCalls = adapter.callLog.filter((c) => c.startsWith("installCapability:"));
      expect(installCalls).toHaveLength(0);

      // Verify no capability was recorded
      expect(db.recordedCapabilities).toHaveLength(0);
    });

    it("pre-flight detection with restart-required capability", async () => {
      adapter.hasDetectGap = true;
      adapter.preflightGap = { type: "mcp", name: "database" };
      adapter.shouldRequireRestart = true;
      adapter.statusHealthy = true;

      const tokens: string[] = [];
      const statuses: string[] = [];

      const result = await orchestrator.runTask(
        "Query the database",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify task completed
      expect(result).toContain("Task completed successfully");

      // Verify install happened with restart
      expect(adapter.callLog).toContain("installCapability:database");
      expect(adapter.callLog).toContain("stop");
      expect(adapter.callLog).toContain("start");

      // Verify order: detectGap → install → restart → sendTask
      const detectGapIndex = adapter.callLog.findIndex((c) => c.startsWith("detectGap:"));
      const installIndex = adapter.callLog.findIndex((c) => c === "installCapability:database");
      const stopIndex = adapter.callLog.findIndex((c) => c === "stop");
      const sendTaskIndex = adapter.callLog.findIndex((c) => c.startsWith("sendTask:"));

      expect(detectGapIndex).toBeLessThan(installIndex);
      expect(installIndex).toBeLessThan(stopIndex);
      expect(stopIndex).toBeLessThan(sendTaskIndex);

      // Verify capability was recorded
      expect(db.recordedCapabilities).toHaveLength(1);
      expect(db.recordedCapabilities[0].type).toBe("mcp");
      expect(db.recordedCapabilities[0].name).toBe("database");
    });

    it("combines pre-flight and stream-marker detection", async () => {
      adapter.hasDetectGap = true;
      adapter.preflightGap = { type: "skill", name: "first-skill" };
      // After first gap is installed, task will emit another gap via stream marker
      adapter.capabilityGaps = ["second-skill"];
      adapter.shouldRequireRestart = false;

      const tokens: string[] = [];
      const statuses: string[] = [];

      const result = await orchestrator.runTask(
        "Use multiple skills",
        (token) => tokens.push(token),
        (status) => statuses.push(status)
      );

      // Verify task completed
      expect(result).toContain("Task completed successfully with all capabilities");

      // Verify both gaps were handled
      expect(adapter.callLog).toContain("installCapability:first-skill");
      expect(adapter.callLog).toContain("installCapability:second-skill");

      // Verify both were recorded
      expect(db.recordedCapabilities).toHaveLength(2);
      expect(db.recordedCapabilities[0].name).toBe("first-skill");
      expect(db.recordedCapabilities[1].name).toBe("second-skill");

      // Verify detectGap was called before first sendTask
      const detectGapIndex = adapter.callLog.findIndex((c) => c.startsWith("detectGap:"));
      const firstSendTaskIndex = adapter.callLog.findIndex((c) => c.startsWith("sendTask:"));
      expect(detectGapIndex).toBeLessThan(firstSendTaskIndex);
    });
  });
});

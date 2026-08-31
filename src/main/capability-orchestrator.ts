import { FrameworkAdapter, InstalledCapability } from "../shared/v2-types";
import { Database } from "./database";

/**
 * Gap signal contract: The orchestrator detects capability gaps by parsing
 * special markers in the adapter's output stream:
 * - `__CAPABILITY_GAP__:<name>` - signals a capability gap (defaults to skill type)
 * - `__CAPABILITY_GAP__:<type>:<name>` - signals a capability gap with explicit type (skill|mcp|plugin)
 * - `__TASK_DONE__` - signals task completion
 *
 * This is framework-agnostic: any adapter can emit these markers to trigger
 * the capability installation loop.
 */

interface ParsedGap {
  type: string;
  name: string;
}

export class CapabilityOrchestrator {
  private adapter: FrameworkAdapter;
  private db: Database;
  private deploymentId: string;
  private taskTimeoutMs: number;

  constructor(
    adapter: FrameworkAdapter,
    db: Database,
    deploymentId: string,
    taskTimeoutMs: number = 30000
  ) {
    this.adapter = adapter;
    this.db = db;
    this.deploymentId = deploymentId;
    this.taskTimeoutMs = taskTimeoutMs;
  }

  /**
   * Run a task through the adapter with automatic capability installation.
   *
   * Handles MULTIPLE gaps per task: loops until task completes or a gap error occurs.
   * Each iteration:
   * 1. Send/resume task and stream output
   * 2. If __TASK_DONE__ → return accumulated output
   * 3. If __CAPABILITY_GAP__ → install, record, restart if needed, loop back to step 1
   *
   * Includes re-install guard: tracks installed capabilities per run; if the same
   * gap recurs after install, throws an error instead of looping forever.
   *
   * @param input - Task input/prompt
   * @param onToken - Callback for each output token
   * @param onStatus - Callback for status updates (e.g., "Setting up X...")
   * @returns Final task output
   */
  async runTask(
    input: string,
    onToken: (token: string) => void,
    onStatus: (status: string) => void
  ): Promise<string> {
    let output = "";
    const installedThisRun = new Set<string>(); // Re-install guard

    // Loop until task completes or error
    while (true) {
      let gapDetected: ParsedGap | null = null;
      let taskDone = false;

      // Send the task (first iteration) or resume (after gap install)
      await this.adapter.sendTask(input);

      // Stream output and detect gaps/completion
      const unsubscribe = this.adapter.streamOutput((chunk: string) => {
        // Check for capability gap marker
        if (chunk.startsWith("__CAPABILITY_GAP__:")) {
          const gapString = chunk.replace("__CAPABILITY_GAP__:", "").trim();
          gapDetected = this.parseGap(gapString);
          return; // Don't emit this marker to the caller
        }

        // Check for task done marker
        if (chunk === "__TASK_DONE__") {
          taskDone = true;
          return; // Don't emit this marker to the caller
        }

        // Regular output - accumulate and emit
        output += chunk + "\n";
        onToken(chunk);
      });

      // Wait for task to complete or gap to be detected
      await this.waitForTaskOrGap(() => taskDone || gapDetected !== null);

      // Clean up stream subscription
      unsubscribe();

      // If task done, return result
      if (taskDone) {
        return output.trim();
      }

      // Gap detected - handle installation
      // TypeScript: at this point, gapDetected must be non-null (otherwise waitForTaskOrGap timed out)
      if (!gapDetected) {
        throw new Error("Internal error: neither gap nor done detected");
      }

      const gap: ParsedGap = gapDetected;
      const capabilityKey = `${gap.type}:${gap.name}`;

      // Re-install guard: if we already installed this capability, throw error
      if (installedThisRun.has(capabilityKey)) {
        throw new Error(
          `Capability "${gap.name}" was already installed this run but the gap persists. ` +
          `The adapter may not have reloaded the capability, or the name/type may be incorrect.`
        );
      }

      // Install the capability
      try {
        onStatus(`Setting up ${gap.name}...`);

        await this.adapter.installCapability({
          type: gap.type,
          name: gap.name,
        });

        // Record in database
        this.db.recordCapability({
          deploymentId: this.deploymentId,
          type: gap.type as "mcp" | "plugin" | "skill",
          name: gap.name,
          source: "marketplace",
        });

        // Mark as installed this run
        installedThisRun.add(capabilityKey);

        // Check if restart is required
        const needsRestart = this.adapter.requiresRestartAfterInstall();

        if (needsRestart) {
          // Monitored restart: stop → start → poll status
          await this.adapter.stop();
          await this.adapter.start();

          // Poll status until healthy with timeout
          await this.waitUntilHealthy();
        }

        // Loop back to re-issue the task
      } catch (error) {
        // Surface installation errors clearly
        throw error;
      }
    }
  }

  /**
   * Parse a capability gap string into type and name.
   * Supports:
   * - `<name>` → defaults to skill type
   * - `<type>:<name>` → explicit type (skill|mcp|plugin)
   */
  private parseGap(gapString: string): ParsedGap {
    const parts = gapString.split(":");
    if (parts.length === 1) {
      // No type prefix, default to skill
      return { type: "skill", name: parts[0] };
    } else if (parts.length === 2) {
      // Type prefix provided
      const type = parts[0];
      const name = parts[1];
      return { type, name };
    } else {
      // More than one colon, treat everything after first colon as name
      const type = parts[0];
      const name = parts.slice(1).join(":");
      return { type, name };
    }
  }

  /**
   * Wait for a condition to be true (task done or gap detected).
   * Polls with a short interval. Single timeout mechanism.
   */
  private async waitForTaskOrGap(check: () => boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);
      };

      const poll = () => {
        if (settled) return;

        if (check()) {
          settled = true;
          cleanup();
          resolve();
        }
      };

      const interval = setInterval(poll, 50); // Poll every 50ms
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("Timeout waiting for task completion"));
      }, this.taskTimeoutMs);

      // Start first poll immediately
      poll();
    });
  }

  /**
   * Poll adapter.status() until it returns "healthy" or timeout.
   * Throws on timeout with a clear error.
   */
  private async waitUntilHealthy(): Promise<void> {
    const timeoutMs = 10000; // 10 second timeout
    const intervalMs = 500; // Poll every 500ms

    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);
      };

      const poll = () => {
        if (settled) return;

        // Call status check (async)
        this.adapter
          .status()
          .then((status) => {
            if (settled) return;

            if (status === "healthy") {
              settled = true;
              cleanup();
              resolve();
            }
          })
          .catch(() => {
            // Status check threw, continue polling
          });
      };

      const interval = setInterval(poll, intervalMs);
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          new Error(
            "Timeout waiting for adapter to be ready after restart. " +
            "The adapter may have failed to start or is taking too long to initialize."
          )
        );
      }, timeoutMs);

      // Start first poll immediately
      poll();
    });
  }
}

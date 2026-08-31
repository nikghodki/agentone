import { FrameworkAdapter, InstalledCapability } from "../shared/v2-types";
import { Database } from "./database";

/**
 * Gap signal contract: The orchestrator detects capability gaps by parsing
 * special markers in the adapter's output stream:
 * - `__CAPABILITY_GAP__:<name>` - signals a capability gap
 * - `__TASK_DONE__` - signals task completion
 *
 * This is framework-agnostic: any adapter can emit these markers to trigger
 * the capability installation loop.
 */

export class CapabilityOrchestrator {
  private adapter: FrameworkAdapter;
  private db: Database;
  private deploymentId: string;

  constructor(
    adapter: FrameworkAdapter,
    db: Database,
    deploymentId: string
  ) {
    this.adapter = adapter;
    this.db = db;
    this.deploymentId = deploymentId;
  }

  /**
   * Run a task through the adapter with automatic capability installation.
   *
   * Flow:
   * 1. Send task to adapter and stream output
   * 2. On capability gap detected:
   *    a. Report status to caller
   *    b. Install the capability
   *    c. Record it in the database
   *    d. If restart required: monitored restart (stop → start → poll status → resume)
   *    e. If no restart: resume immediately
   *    f. Re-issue the task
   * 3. Return accumulated output
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
    let gapDetected: string | null = null;
    let taskDone = false;

    // Send the task
    await this.adapter.sendTask(input);

    // Stream output and detect gaps
    const unsubscribe = this.adapter.streamOutput((chunk: string) => {
      // Check for capability gap marker
      if (chunk.startsWith("__CAPABILITY_GAP__:")) {
        gapDetected = chunk.replace("__CAPABILITY_GAP__:", "").trim();
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

    // If no gap, task is done
    if (!gapDetected) {
      return output.trim();
    }

    // Gap detected - handle installation and restart
    const capabilityName = gapDetected;

    try {
      // Report status
      onStatus(`Setting up ${capabilityName}...`);

      // Install the capability
      await this.adapter.installCapability({
        type: "skill", // Default to skill; could be enhanced to parse type
        name: capabilityName,
      });

      // Record in database
      this.db.recordCapability({
        deploymentId: this.deploymentId,
        type: "skill",
        name: capabilityName,
        source: "marketplace",
      });

      // Check if restart is required
      const needsRestart = this.adapter.requiresRestartAfterInstall();

      if (needsRestart) {
        // Monitored restart: stop → start → poll status
        await this.adapter.stop();
        await this.adapter.start();

        // Poll status until healthy with timeout
        await this.waitUntilHealthy();
      }

      // Resume: re-issue the task
      // (In a real implementation, this would recurse or loop)
      // For now, just send the task again and stream the rest
      await this.adapter.sendTask(input);

      taskDone = false;
      const unsubscribe2 = this.adapter.streamOutput((chunk: string) => {
        if (chunk === "__TASK_DONE__") {
          taskDone = true;
          return;
        }
        output += chunk + "\n";
        onToken(chunk);
      });

      await this.waitForTaskOrGap(() => taskDone);
      unsubscribe2();

      return output.trim();
    } catch (error) {
      // Surface installation errors clearly
      throw error;
    }
  }

  /**
   * Wait for a condition to be true (task done or gap detected).
   * Polls with a short interval to avoid blocking.
   */
  private async waitForTaskOrGap(check: () => boolean): Promise<void> {
    const startTime = Date.now();
    const timeoutMs = 30000; // 30 second timeout

    return new Promise<void>((resolve, reject) => {
      const poll = () => {
        if (check()) {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
          return;
        }

        if (Date.now() - startTime >= timeoutMs) {
          clearInterval(interval);
          clearTimeout(timeout);
          reject(new Error("Timeout waiting for task completion"));
        }
      };

      const interval = setInterval(poll, 50); // Poll every 50ms
      const timeout = setTimeout(() => {
        clearInterval(interval);
        reject(new Error("Timeout waiting for task completion"));
      }, timeoutMs);

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

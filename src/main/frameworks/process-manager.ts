import { spawn, ChildProcess, SpawnOptions } from "child_process";

/**
 * ProcessManager spawns and monitors sandboxed child processes.
 *
 * CRITICAL SANDBOXING: Callers MUST pass an explicit, minimal env via opts.env.
 * Do NOT rely on inheriting a mutated host PATH — this prevents a framework
 * process from hijacking host runtimes (real CVE spike finding).
 */
export class ProcessManager {
  private child: ChildProcess | null = null;
  private running = false;
  private spawnFn: typeof spawn;

  constructor(spawnFn: typeof spawn = spawn) {
    this.spawnFn = spawnFn;
  }

  /**
   * Start a child process with the given command, args, and options.
   * The env is passed explicitly (not inherited) to maintain sandboxing.
   */
  start(
    cmd: string,
    args: string[],
    opts: { env?: Record<string, string>; cwd?: string }
  ): void {
    if (this.running) {
      throw new Error("Process already running");
    }

    const spawnOpts: SpawnOptions = {
      env: opts.env || {},
      cwd: opts.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    };

    this.child = this.spawnFn(cmd, args, spawnOpts);
    this.running = true;

    // Mark as not running when process exits
    this.child.on("exit", () => {
      this.running = false;
    });
  }

  /**
   * Stop the child process gracefully (SIGTERM) with fallback to SIGKILL.
   */
  async stop(): Promise<void> {
    if (!this.child || !this.running) {
      return;
    }

    return new Promise<void>((resolve) => {
      const child = this.child!;

      // Set up exit handler
      const onExit = () => {
        this.running = false;
        resolve();
      };
      child.once("exit", onExit);

      // Send SIGTERM first
      child.kill("SIGTERM");

      // Set up SIGKILL fallback after grace period
      const killTimer = setTimeout(() => {
        if (this.running) {
          child.kill("SIGKILL");
        }
      }, 5000); // 5 second grace period

      // Clean up timer if process exits early
      child.once("exit", () => clearTimeout(killTimer));
    });
  }

  /**
   * Check if the child process is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Poll a readiness check until it returns true or timeout.
   * Throws on timeout.
   */
  async waitUntilReady(
    check: () => Promise<boolean>,
    opts: { timeoutMs: number; intervalMs: number }
  ): Promise<void> {
    const startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const poll = async () => {
        try {
          const ready = await check();
          if (ready) {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve();
            return;
          }
        } catch (error) {
          // Check function threw, continue polling
        }

        // Check for timeout
        if (Date.now() - startTime >= opts.timeoutMs) {
          clearInterval(interval);
          clearTimeout(timeout);
          reject(new Error("Timeout waiting for process to be ready"));
        }
      };

      const interval = setInterval(poll, opts.intervalMs);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        reject(new Error("Timeout waiting for process to be ready"));
      }, opts.timeoutMs);

      // Start first poll immediately
      poll();
    });
  }
}

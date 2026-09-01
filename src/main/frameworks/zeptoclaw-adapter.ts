import { promises as fs } from "fs";
import * as path from "path";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import { Readable } from "stream";
import {
  FrameworkAdapter,
  ModelBackendConfig,
  InstalledCapability,
  ChatMessage,
} from "../../shared/v2-types";
import { ProcessManager } from "./process-manager";
import { Secrets } from "../secrets";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

/**
 * Default probe function to check if a binary exists.
 */
async function defaultProbe(binaryName: string): Promise<boolean> {
  try {
    await execAsync(`which ${binaryName}`);
    return true;
  } catch {
    return false;
  }
}

interface ExecResult {
  stdout: string;
  stderr: string;
}

type ExecFunction = (cmd: string) => Promise<ExecResult>;
type ExecWithArgsFunction = (cmd: string, args: string[]) => Promise<ExecResult>;

/**
 * ZeptoclawAdapter implements the FrameworkAdapter interface for ZeptoClaw.
 * This adapter handles installation verification and model backend configuration.
 *
 * Verified installation: brew install qhkm/tap/zeptoclaw
 * Config path: ~/.zeptoclaw/config.json
 * Ref: docs/research/verified/zeptoclaw.md
 */
export class ZeptoclawAdapter implements FrameworkAdapter {
  private configDir: string;
  private probe: (binaryName: string) => Promise<boolean>;
  private processManager: ProcessManager;
  private secrets: Secrets | null;
  private execFn: ExecFunction;
  private execWithArgsFn: ExecWithArgsFunction;
  private currentBackend: ModelBackendConfig | null = null;

  /**
   * @param configDir - Directory where zeptoclaw config.json lives (injectable for tests)
   * @param probe - Function to check if binary exists (injectable for tests)
   * @param processManager - ProcessManager for spawning child processes (injectable for tests)
   * @param secrets - Secrets store for API keys (injectable for tests)
   * @param execFn - Function to execute shell commands (injectable for tests)
   * @param execWithArgs - Function to execute commands with arg array (injectable for tests, defaults to execFile)
   */
  constructor(
    configDir: string = path.join(process.env.HOME || "~", ".zeptoclaw"),
    probe: (binaryName: string) => Promise<boolean> = defaultProbe,
    processManager?: ProcessManager,
    secrets?: Secrets | null,
    execFn?: ExecFunction,
    execWithArgs?: ExecWithArgsFunction
  ) {
    this.configDir = configDir;
    this.probe = probe;
    this.processManager = processManager || new ProcessManager();
    this.secrets = secrets !== undefined ? secrets : null;
    this.execFn = execFn || (execAsync as ExecFunction);
    this.execWithArgsFn = execWithArgs || this.defaultExecWithArgs.bind(this);
  }

  /**
   * Default implementation of execWithArgs using execFile (no shell parsing).
   * This prevents command injection by passing arguments as an array.
   */
  private async defaultExecWithArgs(cmd: string, args: string[]): Promise<ExecResult> {
    const { stdout, stderr } = await execFileAsync(cmd, args);
    return { stdout, stderr };
  }

  /**
   * Validate capability name to prevent command injection.
   * Allows alphanumeric, dots, underscores, @, forward slashes, and hyphens.
   * This supports scoped/marketplace names like @scope/skill-name.
   *
   * SECURITY: Defense-in-depth against command injection. Even though we use
   * argument arrays (no shell parsing), validation provides an extra layer.
   */
  private validateCapabilityName(name: string): void {
    const safePattern = /^[A-Za-z0-9._@/-]+$/;
    if (!safePattern.test(name)) {
      throw new Error(
        `Invalid capability name: "${name}". ` +
        `Only alphanumeric characters and ._@/- are allowed.`
      );
    }
  }

  /**
   * Verify zeptoclaw is installed. Per verified doc, it's installed via brew.
   * This is idempotent - just checks that the binary exists.
   */
  async install(): Promise<void> {
    const exists = await this.probe("zeptoclaw");
    if (!exists) {
      throw new Error(
        "zeptoclaw binary not found. Install via: brew install qhkm/tap/zeptoclaw"
      );
    }
    // Binary exists, installation verified
  }

  /**
   * Configure zeptoclaw to use the given model backend.
   * Writes ~/.zeptoclaw/config.json with provider settings.
   *
   * Per verified doc schema:
   * {
   *   "agents": { "defaults": { "model": "..." } },
   *   "providers": { "<provider>": { "api_base": "...", "model": "..." } }
   * }
   *
   * SECURITY: Never writes secrets - those are injected via env at start (Task 3).
   */
  async configure(backend: ModelBackendConfig): Promise<void> {
    // Store backend for use in start()
    this.currentBackend = backend;

    // Ensure config directory exists
    await fs.mkdir(this.configDir, { recursive: true });

    // Map ModelBackendConfig to zeptoclaw config format
    const config: Record<string, unknown> = {
      agents: {
        defaults: {
          model: backend.model,
        },
      },
      providers: this.buildProviderConfig(backend),
    };

    const configPath = path.join(this.configDir, "config.json");
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  /**
   * Build the providers section of zeptoclaw config based on backend kind.
   */
  private buildProviderConfig(
    backend: ModelBackendConfig
  ): Record<string, unknown> {
    switch (backend.kind) {
      case "ollama":
        return {
          ollama: {
            api_base: backend.baseUrl,
            model: backend.model,
          },
        };

      case "llamacpp":
      case "vllm":
      case "custom":
        // Custom/vllm/llamacpp use OpenAI-compatible provider with custom base URL
        return {
          openai: {
            api_base: backend.baseUrl,
            model: backend.model,
          },
        };

      case "cloud":
        // For cloud providers, use the named provider
        if (backend.provider === "anthropic") {
          return {
            anthropic: {
              model: backend.model,
            },
          };
        } else if (backend.provider === "openai") {
          return {
            openai: {
              model: backend.model,
            },
          };
        } else {
          // Default to openrouter or generic cloud provider
          return {
            [backend.provider || "openrouter"]: {
              model: backend.model,
            },
          };
        }

      default:
        throw new Error(`Unsupported backend kind: ${backend.kind}`);
    }
  }

  /**
   * Start zeptoclaw agent process via ProcessManager.
   * Uses sandboxed env with API key injected from Secrets.
   *
   * Per verified doc: `zeptoclaw agent` (interactive mode)
   */
  async start(): Promise<void> {
    // Build sandboxed env with EXPLICIT PATH (no host PATH inheritance)
    // Standard bin dirs for zeptoclaw's built-in tools (git, shell, etc.)
    const env: Record<string, string> = {
      HOME: process.env.HOME || "",
      PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
    };

    // Inject API key from secrets if needed
    if (this.currentBackend?.secretRef && this.secrets) {
      const apiKey = this.secrets.get(this.currentBackend.secretRef);
      if (apiKey) {
        // Map provider to env var name
        const envVarName = this.getApiKeyEnvVar(this.currentBackend.provider);
        env[envVarName] = apiKey;
      }
    }

    // Spawn zeptoclaw agent
    this.processManager.start("zeptoclaw", ["agent"], { env });
  }

  /**
   * Stop the zeptoclaw agent process.
   */
  async stop(): Promise<void> {
    await this.processManager.stop();
  }

  /**
   * Check if zeptoclaw is healthy via version check AND process liveness.
   * Per verified doc: `zeptoclaw --version` returns "zeptoclaw 0.9.2"
   *
   * IMPORTANT: Also checks that the spawned process is actually running.
   * A dead/failed start() should report unhealthy even if the binary exists.
   */
  async status(): Promise<string> {
    // First check process liveness
    if (!this.processManager.isRunning()) {
      const lastError = this.processManager.getLastError();
      if (lastError) {
        return `unhealthy: process not running (${lastError.message})`;
      }
      return "unhealthy: process not running";
    }

    // Then check binary availability
    try {
      const result = await this.execFn("zeptoclaw --version");
      if (result.stdout.includes("zeptoclaw")) {
        return "healthy";
      }
      return "unhealthy: unexpected version output";
    } catch (error) {
      return `unhealthy: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Send a task/prompt to the running zeptoclaw agent via stdin.
   */
  async sendTask(input: string): Promise<void> {
    const child = this.processManager.getChild();
    if (!child || !child.stdin) {
      throw new Error("Process not running or stdin not available");
    }

    child.stdin.write(`${input}\n`);
  }

  /**
   * Stream output from the running zeptoclaw agent.
   * Parses stdout with buffering (reuses pattern from openai-compatible.ts).
   * Filters out spinner animation.
   *
   * Returns an unsubscribe function.
   */
  streamOutput(cb: (chunk: string) => void): () => void {
    const child = this.processManager.getChild();
    if (!child || !child.stdout) {
      throw new Error("Process not running or stdout not available");
    }

    let buffer = "";
    const decoder = new TextDecoder();

    const onData = (chunk: Buffer) => {
      // Decode chunk and append to buffer
      buffer += decoder.decode(chunk, { stream: true });

      // Split on newlines and carriage returns
      const lines = buffer.split(/[\n\r]+/);

      // Keep the last (potentially incomplete) line in buffer
      buffer = lines.pop() || "";

      // Process complete lines
      for (const line of lines) {
        if (!line.trim()) continue;

        // Filter out spinner animation
        if (this.isSpinnerLine(line)) continue;

        // Emit the line
        cb(line);
      }
    };

    const onEnd = () => {
      // Flush remaining buffer
      if (buffer.trim() && !this.isSpinnerLine(buffer)) {
        cb(buffer);
      }
    };

    const stdout = child.stdout;

    stdout.on("data", onData);
    stdout.once("end", onEnd);

    // Return unsubscribe function
    return () => {
      stdout.off("data", onData);
      stdout.off("end", onEnd);
    };
  }

  /**
   * Check if a line is a spinner animation (should be filtered).
   * Per verified doc: "  ⠋ Thinking..." with animation characters.
   * Only matches lines that START with a spinner glyph (after trimming).
   */
  private isSpinnerLine(line: string): boolean {
    // Spinner characters: ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏
    // Match only if the trimmed line STARTS with a spinner glyph
    const trimmed = line.trim();
    return /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(trimmed);
  }

  /**
   * Map provider name to API key env var name.
   */
  private getApiKeyEnvVar(provider: string | null): string {
    switch (provider) {
      case "anthropic":
        return "ANTHROPIC_API_KEY";
      case "openai":
        return "OPENAI_API_KEY";
      case "openrouter":
        return "OPENROUTER_API_KEY";
      default:
        return "API_KEY";
    }
  }

  /**
   * List installed capabilities (skills).
   * Per verified doc: `zeptoclaw skills list` returns:
   * Skills:
   *   - skill-name (workspace, ready)
   *
   * SECURITY: Uses argument array to prevent command injection.
   */
  async listCapabilities(): Promise<InstalledCapability[]> {
    const result = await this.execWithArgsFn("zeptoclaw", ["skills", "list"]);
    const lines = result.stdout.split("\n");
    const capabilities: InstalledCapability[] = [];

    for (const line of lines) {
      // Match lines like "  - skill-name (workspace, ready)"
      const match = line.match(/^\s*-\s+(\S+)\s+\(/);
      if (match) {
        const skillName = match[1];
        capabilities.push({
          deploymentId: "zeptoclaw-local", // Single deployment for now
          type: "skill",
          name: skillName,
          source: "zeptoclaw",
        });
      }
    }

    return capabilities;
  }

  /**
   * Install a capability (skill or MCP).
   * Per verified doc:
   * - Skills: `zeptoclaw skills install <skill-name>`
   * - MCP: No CLI command, must edit config manually (not supported)
   *
   * SECURITY: Two-layer defense against command injection:
   * 1. Validates name against strict pattern (no shell metacharacters)
   * 2. Uses argument array (execFile) instead of shell string interpolation
   */
  async installCapability(spec: {
    type: string;
    name: string;
  }): Promise<void> {
    // Layer 1: Validate name (defense-in-depth)
    this.validateCapabilityName(spec.name);

    if (spec.type === "mcp") {
      throw new Error(
        "MCP server installation not supported via CLI. Edit ~/.zeptoclaw/config.json manually."
      );
    }

    if (spec.type === "skill") {
      // Layer 2: Use argument array (no shell parsing)
      await this.execWithArgsFn("zeptoclaw", ["skills", "install", spec.name]);
      return;
    }

    throw new Error(`Unsupported capability type: ${spec.type}`);
  }

  /**
   * Check if restart is required after capability installation.
   * Per verified doc: Zeptoclaw skills hot-reload, so NO restart is required.
   */
  requiresRestartAfterInstall(): boolean {
    return false;
  }

  /**
   * Restart the zeptoclaw agent: stop then start.
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
}

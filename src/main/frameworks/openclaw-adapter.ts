import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  FrameworkAdapter,
  ModelBackendConfig,
  InstalledCapability,
} from "../../shared/v2-types";

const execFileAsync = promisify(execFile);

/**
 * Default probe function to check if a binary exists.
 */
async function defaultProbe(binaryName: string): Promise<boolean> {
  try {
    await execFileAsync("which", [binaryName]);
    return true;
  } catch {
    return false;
  }
}

interface ExecResult {
  stdout: string;
  stderr: string;
}

type ExecWithArgsFunction = (
  cmd: string,
  args: string[],
  opts?: { env?: Record<string, string> }
) => Promise<ExecResult>;

/**
 * OpenclawAdapter implements the FrameworkAdapter interface for OpenClaw.
 *
 * TASK 1 SCOPE: install() + configure() only (other methods stub to throw).
 *
 * Verified installation: npm install -g openclaw@latest via nvm Node 22
 * Config path: ~/.openclaw/openclaw.json (JSON format)
 * Ref: docs/research/verified/openclaw-config-spike.md (THE recipe)
 *
 * CRITICAL GUARDRAIL (Ruling O1):
 * OpenClaw requires Node 22+, but host is Node 16. Any openclaw CLI call
 * MUST use isolated Node 22 with sandboxed PATH that:
 * - Includes the nvm Node 22 bin directory
 * - EXCLUDES ~/.local/bin (poisoned by hermes's Node 26 symlinks)
 * - Does NOT inherit process.env.PATH
 * Host node -v MUST remain v16.16.0.
 */
export class OpenclawAdapter implements FrameworkAdapter {
  private configDir: string;
  private probe: (binaryName: string) => Promise<boolean>;
  private execWithArgsFn: ExecWithArgsFunction;
  private currentBackend: ModelBackendConfig | null = null;

  /**
   * @param configDir - Directory where openclaw.json lives (injectable for tests)
   * @param probe - Function to check if binary exists (injectable for tests)
   * @param execWithArgs - Function to execute commands with arg array (injectable for tests)
   */
  constructor(
    configDir: string = path.join(os.homedir(), ".openclaw"),
    probe: (binaryName: string) => Promise<boolean> = defaultProbe,
    execWithArgs?: ExecWithArgsFunction
  ) {
    this.configDir = configDir;
    this.probe = probe;
    this.execWithArgsFn = execWithArgs || this.defaultExecWithArgs.bind(this);
  }

  /**
   * Default implementation of execWithArgs using execFile (no shell parsing).
   * This prevents command injection by passing arguments as an array.
   *
   * Uses Node 22 sandbox with explicit PATH per Ruling O1.
   */
  private async defaultExecWithArgs(
    cmd: string,
    args: string[],
    opts?: { env?: Record<string, string> }
  ): Promise<ExecResult> {
    const env = opts?.env || this.buildSandboxedEnv();
    const { stdout, stderr } = await execFileAsync(cmd, args, { env });
    return { stdout, stderr };
  }

  /**
   * Build sandboxed environment for openclaw CLI calls.
   * Per Ruling O1: Explicit PATH with Node 22, EXCLUDES ~/.local/bin.
   *
   * Per spike doc: Use nvm's Node 22 from the spike directory.
   * Format: export NVM_DIR="$(pwd)/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22
   *
   * For production use, we construct an explicit PATH with the nvm Node 22 bin.
   */
  private buildSandboxedEnv(): Record<string, string> {
    const homeDir = os.homedir();

    // Per spike: nvm Node 22 is at /Users/nikhil/workspace/flashlearn/spikes/openclaw-test/.nvm/versions/node/v22.23.2/bin
    // For the adapter, we'll use the same nvm installation from the spike directory
    const spikeNvmNodePath = path.join(
      homeDir,
      "workspace/flashlearn/spikes/openclaw-test/.nvm/versions/node/v22.23.2/bin"
    );

    return {
      HOME: homeDir,
      // CRITICAL: Explicit PATH with Node 22, NO ~/.local/bin (H1 guardrail)
      PATH: `${spikeNvmNodePath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
    };
  }

  /**
   * Get the absolute path to the openclaw binary.
   * Uses the nvm Node 22 installation from the spike directory.
   */
  private getOpenclawBinary(): string {
    const homeDir = os.homedir();
    const spikeNvmNodePath = path.join(
      homeDir,
      "workspace/flashlearn/spikes/openclaw-test/.nvm/versions/node/v22.23.2/bin"
    );
    return path.join(spikeNvmNodePath, "openclaw");
  }

  /**
   * Verify openclaw is installed and run migration + plugin setup.
   * Per verified recipe:
   * 1. Check binary exists (throw clear error with install command if not)
   * 2. Run `openclaw doctor --fix` (config migration, idempotent)
   * 3. Run `openclaw plugins install ollama` (idempotent)
   *
   * All commands use arg-array exec (injection-safe) with Node 22 sandbox.
   */
  async install(): Promise<void> {
    const exists = await this.probe("openclaw");
    if (!exists) {
      throw new Error(
        "openclaw binary not found. Install via: npm install -g openclaw@latest (requires Node 22+)"
      );
    }

    const openclawBinary = this.getOpenclawBinary();
    const env = this.buildSandboxedEnv();

    // Run doctor --fix (config migration, idempotent)
    await this.execWithArgsFn(openclawBinary, ["doctor", "--fix"], { env });

    // Install ollama plugin (idempotent)
    await this.execWithArgsFn(openclawBinary, ["plugins", "install", "ollama"], { env });
  }

  /**
   * Configure openclaw to use the given model backend.
   * Writes ~/.openclaw/openclaw.json with the 3-part structure from the recipe:
   *
   * PART 1: models.providers.<provider> (TOP-LEVEL)
   *   - api: "ollama"
   *   - baseUrl: "http://localhost:11434/v1"
   *   - models: [{ id: "llama3.2:3b", name: "Llama 3.2 3B" }]
   *
   * PART 2: agents.defaults.models["<provider>/<model>"]
   *   - alias: "Llama 3.2 3B (Local)"
   *
   * PART 3: agents.defaults.model.primary + modelPolicy.allow
   *   - model.primary: "ollama/llama3.2:3b"
   *   - modelPolicy.allow: ["ollama/llama3.2:3b"]
   *
   * PART 4 (bonus): plugins.entries.ollama + plugins.allow
   *   - plugins.entries.ollama.enabled: true
   *   - plugins.allow: ["ollama"]
   *
   * CRITICAL: DEEP-MERGES with existing config to preserve install()'s work.
   * install() runs `openclaw doctor --fix` (config migration) and
   * `openclaw plugins install ollama`, which populate meta.lastTouchedVersion,
   * gateway config, etc. We must NOT clobber those keys.
   *
   * SECURITY: Never writes secrets - those are injected via env at start (Task 2).
   * Uses JSON.stringify for escaping (handles special characters automatically).
   * Idempotent (deep-merge preserves unrelated keys).
   */
  async configure(backend: ModelBackendConfig): Promise<void> {
    // Store backend for use in start() (Task 2)
    this.currentBackend = backend;

    // Ensure config directory exists
    await fs.mkdir(this.configDir, { recursive: true });

    const configPath = path.join(this.configDir, "openclaw.json");

    // Read existing config (preserve install/migration settings)
    let existing: Record<string, unknown> = {};
    try {
      const existingContent = await fs.readFile(configPath, "utf-8");
      existing = JSON.parse(existingContent);
    } catch {
      // File doesn't exist or is invalid, start fresh
    }

    // Build the 3-part + plugin config structure
    const built = this.buildOpenclawConfig(backend);

    // DEEP-MERGE: replace/merge ONLY the model-wiring keys, keep everything else
    const builtAgents = built.agents as any;
    const builtPlugins = built.plugins as any;
    const existingAgents = existing.agents as any;
    const existingPlugins = existing.plugins as any;

    const merged = {
      ...existing,
      // PART 1: Replace models.providers (model backend config)
      models: built.models,
      // PART 2+3: Merge agents.defaults (preserve other agent config)
      agents: {
        ...(existingAgents || {}),
        defaults: {
          ...(existingAgents?.defaults || {}),
          models: builtAgents.defaults.models,
          model: builtAgents.defaults.model,
          modelPolicy: builtAgents.defaults.modelPolicy,
        },
      },
      // PART 4: Merge plugins (preserve existing plugins + add ollama)
      plugins: {
        ...(existingPlugins || {}),
        entries: {
          ...(existingPlugins?.entries || {}),
          ...builtPlugins.entries,
        },
        allow: Array.from(new Set([
          ...(existingPlugins?.allow || []),
          ...builtPlugins.allow,
        ])),
      },
    };

    await fs.writeFile(configPath, JSON.stringify(merged, null, 2), "utf-8");
  }

  /**
   * Build openclaw config structure based on backend.
   * Implements the 3-part recipe + plugin config.
   */
  private buildOpenclawConfig(backend: ModelBackendConfig): Record<string, unknown> {
    const provider = backend.provider || "ollama";
    const modelId = backend.model;
    const modelFullId = `${provider}/${modelId}`;
    const modelName = this.generateModelName(modelId);

    return {
      // PART 1: models.providers.<provider> (TOP-LEVEL)
      models: {
        providers: {
          [provider]: {
            api: provider, // "ollama" for Ollama
            baseUrl: backend.baseUrl,
            models: [
              {
                id: modelId,
                name: modelName,
              },
            ],
          },
        },
      },

      // PART 2 + 3: agents.defaults (models, model.primary, modelPolicy.allow)
      agents: {
        defaults: {
          models: {
            [modelFullId]: {
              alias: `${modelName} (Local)`,
            },
          },
          model: {
            primary: modelFullId,
          },
          modelPolicy: {
            allow: [modelFullId],
          },
        },
      },

      // PART 4: plugins (bonus)
      plugins: {
        entries: {
          [provider]: {
            enabled: true,
          },
        },
        allow: [provider],
      },
    };
  }

  /**
   * Generate a human-readable model name from the model ID.
   * Examples:
   * - "llama3.2:3b" -> "Llama 3.2 3B"
   * - "mistral:latest" -> "Mistral Latest"
   */
  private generateModelName(modelId: string): string {
    // Split on colon to separate model name from variant
    const [modelPart, variantPart] = modelId.split(":");

    // For the model part, add space before digits that follow letters
    // "llama3.2" -> "llama 3.2"
    const modelWithSpaces = modelPart.replace(/([a-z])(\d)/gi, "$1 $2");
    // Capitalize first letter: "llama 3.2" -> "Llama 3.2"
    const modelName = modelWithSpaces.charAt(0).toUpperCase() + modelWithSpaces.slice(1);

    if (!variantPart) {
      return modelName;
    }

    // For variant part, uppercase if it looks like a size (3b, 7b, etc)
    const variant = variantPart.match(/^\d+[a-z]$/)
      ? variantPart.toUpperCase()
      : variantPart.charAt(0).toUpperCase() + variantPart.slice(1);

    return `${modelName} ${variant}`;
  }

  // ========================================================================
  // TASK 2-3: Stub methods (throw "not implemented in this task")
  // ========================================================================

  async start(): Promise<void> {
    throw new Error("start() not implemented in this task (Task 2)");
  }

  async stop(): Promise<void> {
    throw new Error("stop() not implemented in this task (Task 2)");
  }

  async status(): Promise<string> {
    throw new Error("status() not implemented in this task (Task 2)");
  }

  async sendTask(input: string): Promise<void> {
    throw new Error("sendTask() not implemented in this task (Task 2)");
  }

  streamOutput(cb: (chunk: string) => void): () => void {
    throw new Error("streamOutput() not implemented in this task (Task 2)");
  }

  async listCapabilities(): Promise<InstalledCapability[]> {
    throw new Error("listCapabilities() not implemented in this task (Task 3)");
  }

  async installCapability(spec: {
    type: string;
    name: string;
  }): Promise<void> {
    throw new Error("installCapability() not implemented in this task (Task 3)");
  }

  requiresRestartAfterInstall(): boolean {
    // Stub: return false (actual implementation in Task 3)
    return false;
  }

  async restart(): Promise<void> {
    throw new Error("restart() not implemented in this task (Task 3)");
  }

  async detectGap(input: string): Promise<{ type: "skill" | "mcp" | "plugin"; name: string } | null> {
    throw new Error("detectGap() not implemented in this task (Task 3)");
  }
}

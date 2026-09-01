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
import { ProcessManager } from "./process-manager";
import { Secrets } from "../secrets";

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
  private processManager: ProcessManager;
  private secrets: Secrets | null;
  private currentBackend: ModelBackendConfig | null = null;
  private node22BinDir: string;

  /**
   * @param configDir - Directory where openclaw.json lives (injectable for tests)
   * @param probe - Function to check if binary exists (injectable for tests)
   * @param execWithArgs - Function to execute commands with arg array (injectable for tests)
   * @param processManager - ProcessManager for spawning child processes (injectable for tests)
   * @param secrets - Secrets store for API keys (injectable for tests)
   * @param node22BinDir - Node 22 bin directory (injectable for tests/production)
   */
  constructor(
    configDir: string = path.join(os.homedir(), ".openclaw"),
    probe: (binaryName: string) => Promise<boolean> = defaultProbe,
    execWithArgs?: ExecWithArgsFunction,
    processManager?: ProcessManager,
    secrets?: Secrets | null,
    node22BinDir?: string
  ) {
    this.configDir = configDir;
    this.probe = probe;
    this.execWithArgsFn = execWithArgs || this.defaultExecWithArgs.bind(this);
    this.processManager = processManager || new ProcessManager();
    this.secrets = secrets !== undefined ? secrets : null;

    // FIX 1: Resolve Node-22 bin directory from (1) constructor param, (2) env var, (3) dev fallback
    this.node22BinDir = this.resolveNode22BinDir(node22BinDir);
  }

  /**
   * Resolve Node-22 bin directory in priority order:
   * 1. Explicit constructor parameter (for tests and production injection)
   * 2. Environment variable OPENCLAW_NODE22_BIN_DIR
   * 3. Dev-only fallback to spike nvm path
   */
  private resolveNode22BinDir(explicitPath?: string): string {
    // Priority 1: Explicit constructor parameter
    if (explicitPath) {
      return explicitPath;
    }

    // Priority 2: Environment variable
    const envPath = process.env.OPENCLAW_NODE22_BIN_DIR;
    if (envPath) {
      return envPath;
    }

    // Priority 3: Dev-only fallback
    // TODO(prod): production must bundle Node 22 and inject node22BinDir (constructor) or set OPENCLAW_NODE22_BIN_DIR. This dev fallback only works on the original dev box.
    const homeDir = os.homedir();
    return path.join(
      homeDir,
      "workspace/flashlearn/spikes/openclaw-test/.nvm/versions/node/v22.23.2/bin"
    );
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
   * Uses the resolved node22BinDir (injectable, env var, or dev fallback).
   */
  private buildSandboxedEnv(): Record<string, string> {
    const homeDir = os.homedir();

    return {
      HOME: homeDir,
      // CRITICAL: Explicit PATH with Node 22, NO ~/.local/bin (Ruling O1 guardrail)
      PATH: `${this.node22BinDir}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
    };
  }

  /**
   * Get the absolute path to the openclaw binary.
   * Uses the resolved node22BinDir (injectable, env var, or dev fallback).
   */
  private getOpenclawBinary(): string {
    return path.join(this.node22BinDir, "openclaw");
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
  // TASK 2: Lifecycle methods - start/stop/status/sendTask/streamOutput
  // ========================================================================

  /**
   * Start openclaw adapter (lightweight readiness check).
   *
   * VERIFIED MODEL: openclaw runs one-shot per task via `--message` flag, NOT as
   * a persistent stdin-driven process. start() verifies the binary and config are
   * usable, but does NOT spawn a long-lived process.
   *
   * Per verified doc: `openclaw agent --local --message "<prompt>"` (one-shot spawn)
   */
  async start(): Promise<void> {
    // Lightweight readiness check: verify binary exists and config is valid
    const openclawBinary = this.getOpenclawBinary();

    try {
      // Check binary is accessible
      const result = await this.execWithArgsFn(openclawBinary, ["--version"]);
      // Case-insensitive check (real output is "OpenClaw" with capital C)
      if (!result.stdout.toLowerCase().includes("openclaw")) {
        throw new Error("Unexpected version output");
      }
    } catch (error) {
      throw new Error(
        `openclaw binary not ready: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // TODO: could also validate config with `openclaw config validate` here
  }

  /**
   * Stop any in-flight task process.
   */
  async stop(): Promise<void> {
    await this.processManager.stop();
  }

  /**
   * Check if openclaw is ready to run tasks.
   * Per verified doc: `openclaw --version` returns "OpenClaw 2026.8.1..." (capital C)
   *
   * Status reflects "ready to run tasks" rather than a long-lived process.
   * Uses absolute path to openclaw binary for consistency.
   */
  async status(): Promise<string> {
    try {
      const openclawBinary = this.getOpenclawBinary();
      const result = await this.execWithArgsFn(openclawBinary, ["--version"]);
      // FIX 2: Case-insensitive check (real output is "OpenClaw" with capital C)
      if (result.stdout.toLowerCase().includes("openclaw")) {
        return "healthy";
      }
      return "unhealthy: unexpected version output";
    } catch (error) {
      return `unhealthy: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Send a task/prompt to openclaw via one-shot `--message` spawn.
   *
   * VERIFIED MODEL (from spike): spawn FRESH one-shot process per task:
   * `openclaw agent --local --message "<input>"`
   *
   * Uses arg-array (injection-safe - input as single argv, NOT shell-interpolated).
   * Uses Node-22 sandboxed env (explicit PATH excludes ~/.local/bin).
   * Stores child so streamOutput can attach to its stdout.
   */
  async sendTask(input: string): Promise<void> {
    // Build sandboxed env with EXPLICIT PATH (no host PATH inheritance)
    const env = this.buildSandboxedEnv();

    // Inject API key from secrets if needed
    if (this.currentBackend?.secretRef && this.secrets) {
      const apiKey = this.secrets.get(this.currentBackend.secretRef);
      if (apiKey) {
        // Map provider to env var name
        const envVarName = this.getApiKeyEnvVar(this.currentBackend.provider);
        env[envVarName] = apiKey;
      }
    }

    // Use absolute path to openclaw binary
    const openclawBinary = this.getOpenclawBinary();

    // Spawn one-shot process with --message flag (arg-array, injection-safe)
    // input is passed as a single argv element, so shell metacharacters are safe
    this.processManager.start(openclawBinary, ["agent", "--local", "--message", input], { env });
  }

  /**
   * Stream output from the current task process (spawned by sendTask).
   * Parses stdout with line buffering to handle tokens split across chunks.
   * Translates openclaw's completion signal into __TASK_DONE__.
   *
   * Per verified doc: completion is signaled by a line matching:
   * "[agents/agent-command] [agent] run <uuid> ended with stopReason=stop"
   * (or other terminal stopReasons: end_turn, max_tokens, etc.)
   *
   * ANCHORED stopReason detection: only matches the actual openclaw log line,
   * not model output that happens to contain that phrase.
   *
   * Emits __TASK_DONE__ exactly once per task (when stopReason line appears).
   *
   * Filters out log/spinner noise with ANCHORED match.
   *
   * Returns an unsubscribe function.
   */
  streamOutput(cb: (chunk: string) => void): () => void {
    const child = this.processManager.getChild();
    if (!child || !child.stdout) {
      throw new Error("Process not running or stdout not available");
    }

    let buffer = "";
    let taskDoneEmitted = false; // Ensure __TASK_DONE__ emitted exactly once
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

        // Check if this is a completion signal (stopReason line)
        // ANCHORED: only match the actual openclaw log line structure
        if (this.isStopReasonLine(line)) {
          // Emit __TASK_DONE__ exactly once and don't emit the line itself
          if (!taskDoneEmitted) {
            cb("__TASK_DONE__");
            taskDoneEmitted = true;
          }
          continue;
        }

        // Filter out log lines (openclaw's internal logs)
        if (this.isLogLine(line)) continue;

        // Emit the line (agent response content)
        cb(line);
      }
    };

    const onEnd = () => {
      // Flush remaining buffer
      if (buffer.trim() && !this.isLogLine(buffer) && !this.isStopReasonLine(buffer)) {
        cb(buffer);
      }
      // Ensure __TASK_DONE__ is emitted even if stopReason line was missed
      if (!taskDoneEmitted) {
        cb("__TASK_DONE__");
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
   * Check if a line is a stopReason completion signal.
   * Per verified doc: "[agents/agent-command] [agent] run <uuid> ended with stopReason=stop"
   *
   * ANCHORED pattern: matches only the actual openclaw log line structure,
   * not model output that happens to contain "ended with stopReason=".
   *
   * Pattern: [component] [agent] run <uuid> ended with stopReason=<reason>
   */
  private isStopReasonLine(line: string): boolean {
    const trimmed = line.trim();
    // Match openclaw's specific log line format (anchored to start)
    return /^\[[\w/-]+\]\s+\[agent\]\s+run\s+[\w-]+\s+ended with stopReason=/.test(trimmed);
  }

  /**
   * Check if a line is an openclaw internal log (should be filtered).
   * Openclaw logs are prefixed with [component] tags.
   * Only match lines that START with [ to avoid filtering legitimate content.
   */
  private isLogLine(line: string): boolean {
    const trimmed = line.trim();
    // Match lines starting with [component] tags (openclaw internal logs)
    // But don't filter lines that just happen to contain brackets
    return /^\[[\w/-]+\]/.test(trimmed);
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
   * Parse box-drawing table format used by openclaw CLI (E2E Finding F1/F2).
   *
   * Real format:
   * ```
   * Skills (23/56 ready)
   * ┌──────────┬──────────────────────────┬─────────────┬──────────────────┐
   * │ Status   │ Skill                    │ Description │ Source           │
   * ├──────────┼──────────────────────────┼─────────────┼──────────────────┤
   * │ ✓ ready  │ add-model-provider       │ ...         │ openclaw-custodian │
   * │ disabled │ 🔐 1password             │ ...         │ openclaw-bundled   │
   * ```
   *
   * Extracts names from nameCol where statusCol indicates ready/installed.
   * Strips emoji/glyph prefixes from names.
   */
  private parseCapabilityTable(
    stdout: string,
    options: {
      statusCol: number;   // 0-indexed column with status (e.g., "✓ ready", "disabled")
      nameCol: number;     // 0-indexed column with capability name
      readyIndicators: string[];  // Status values that mean "installed/ready"
    }
  ): string[] {
    const lines = stdout.split("\n");
    const capabilities: string[] = [];

    for (const line of lines) {
      // Skip non-data rows: summary, box borders, header
      if (!line.includes("│")) continue;
      if (line.includes("Status") || line.includes("Skill") || line.includes("Server")) continue;

      // Split on column separator
      const columns = line.split("│").map(col => col.trim());

      // Need at least statusCol and nameCol
      if (columns.length <= Math.max(options.statusCol, options.nameCol)) continue;

      const status = columns[options.statusCol + 1]; // +1 because split produces empty first element
      const name = columns[options.nameCol + 1];

      // Skip if status column is empty (continuation row) or not ready.
      // Use exact/prefix match (NOT substring) so a future status like
      // "not ready" / "unready" can't falsely satisfy the "ready" indicator.
      if (
        !status ||
        !options.readyIndicators.some(
          indicator => status === indicator || status.startsWith(indicator)
        )
      ) {
        continue;
      }

      // Skip if name is empty (continuation row)
      if (!name) continue;

      // Strip emoji and other leading glyphs from name
      // Pattern: remove emoji, symbols, and spaces at the start
      const bareName = name.replace(/^[\p{Emoji}\p{Symbol}\s🔐📝]+/u, "").trim();

      if (bareName) {
        capabilities.push(bareName);
      }
    }

    return capabilities;
  }

  /**
   * List installed capabilities (skills AND MCP servers).
   * Per E2E verification (openclaw-e2e.md):
   * - Skills: `openclaw skills list` returns box-drawing table with Status/Skill columns
   * - MCP: `openclaw mcp list` returns box-drawing table OR "No OpenClaw-managed MCP servers..." message
   *
   * Returns ONLY ready/connected capabilities (excludes disabled/not_connected).
   * This ensures detectGap can correctly identify missing capabilities.
   *
   * SECURITY: Uses argument array to prevent command injection.
   */
  async listCapabilities(): Promise<InstalledCapability[]> {
    const openclawBinary = this.getOpenclawBinary();
    const capabilities: InstalledCapability[] = [];

    // F1: Parse installed skills (REAL table format from E2E)
    const skillsResult = await this.execWithArgsFn(openclawBinary, ["skills", "list"]);
    const skillNames = this.parseCapabilityTable(skillsResult.stdout, {
      statusCol: 0,  // First column after split
      nameCol: 1,    // Second column after split
      readyIndicators: ["✓ ready", "ready"],
    });

    for (const skillName of skillNames) {
      capabilities.push({
        deploymentId: "openclaw-local",
        type: "skill",
        name: skillName,
        source: "openclaw",
      });
    }

    // F2: Parse connected MCP servers (REAL format from E2E)
    const mcpResult = await this.execWithArgsFn(openclawBinary, ["mcp", "list"]);

    // Handle "No OpenClaw-managed MCP servers" message (E2E Finding F2)
    if (mcpResult.stdout.includes("No OpenClaw-managed MCP servers")) {
      return capabilities; // No MCP servers configured
    }

    // POPULATED mcp list format UNVERIFIED (E2E had 0 servers); parser assumes same
    // box-table shape as skills list — confirm in a later live run.
    const mcpNames = this.parseCapabilityTable(mcpResult.stdout, {
      statusCol: 0,
      nameCol: 1,
      readyIndicators: ["✓ ready", "ready", "connected"],
    });

    for (const serverName of mcpNames) {
      capabilities.push({
        deploymentId: "openclaw-local",
        type: "mcp",
        name: serverName,
        source: "openclaw",
      });
    }

    return capabilities;
  }

  /**
   * Install a capability (skill, MCP, or plugin).
   * Per verified doc (openclaw-config-spike.md section 5):
   * - Skills: `openclaw skills install <name>`
   * - MCP: `openclaw mcp add <name> --url <url>` OR `openclaw mcp add <name> --command <cmd> --arg <arg1> --arg <arg2>`
   * - Plugins: `openclaw plugins install <name>`
   *
   * SECURITY: Two-layer defense against command injection:
   * 1. Validates name against strict pattern (no shell metacharacters)
   * 2. Uses argument array (execFile) instead of shell string interpolation
   */
  async installCapability(spec: {
    type: string;
    name: string;
    url?: string;
    command?: string;
    args?: string[];
  }): Promise<void> {
    // Layer 1: Validate name (defense-in-depth)
    this.validateCapabilityName(spec.name);

    const openclawBinary = this.getOpenclawBinary();

    if (spec.type === "skill") {
      // Layer 2: Use argument array (no shell parsing)
      await this.execWithArgsFn(openclawBinary, ["skills", "install", spec.name]);
      return;
    }

    if (spec.type === "mcp") {
      // CRITICAL: openclaw MCP add REQUIRES --url OR --command (E2E Finding F3)
      // Per E2E: `openclaw mcp add <name>` alone FAILS
      if (spec.url) {
        await this.execWithArgsFn(openclawBinary, ["mcp", "add", spec.name, "--url", spec.url]);
      } else if (spec.command) {
        const args = ["mcp", "add", spec.name, "--command", spec.command];
        if (spec.args) {
          for (const arg of spec.args) {
            args.push("--arg", arg);
          }
        }
        await this.execWithArgsFn(openclawBinary, args);
      } else {
        throw new Error(
          `openclaw MCP install requires a url or command for '${spec.name}'; name alone is insufficient`
        );
      }
      return;
    }

    if (spec.type === "plugin") {
      await this.execWithArgsFn(openclawBinary, ["plugins", "install", spec.name]);
      return;
    }

    throw new Error(`Unsupported capability type: ${spec.type}`);
  }

  /**
   * Check if restart is required after capability installation.
   *
   * Per verified doc (openclaw-config-spike.md section 5):
   * "Restart Required: NO - `openclaw mcp reload` provides hot-reload functionality"
   *
   * Evidence from spike:
   * - Skills: hot-reload (no restart needed)
   * - MCP: hot-reload via `openclaw mcp reload` command
   *
   * RETURN FALSE: openclaw hot-reloads both skills and MCP servers.
   */
  requiresRestartAfterInstall(): boolean {
    return false;
  }

  /**
   * Restart the openclaw adapter: stop then start.
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Remove a capability (skill, MCP, or plugin).
   * Per verified doc:
   * - MCP: `openclaw mcp unset <name>` then `openclaw mcp reload` (hot-reload)
   * - Plugins: `openclaw plugins uninstall <name>`
   * - Skills: NOT supported (bundled) → return frameworkRemoved false with note
   *
   * SECURITY: Two-layer defense against command injection:
   * 1. Validates name against strict pattern (no shell metacharacters)
   * 2. Uses argument array (execFile) instead of shell string interpolation
   */
  async removeCapability(spec: { type: string; name: string }): Promise<{ frameworkRemoved: boolean; note?: string }> {
    this.validateCapabilityName(spec.name);
    const bin = this.getOpenclawBinary();
    const env = this.buildSandboxedEnv();
    if (spec.type === "mcp") {
      await this.execWithArgsFn(bin, ["mcp", "unset", spec.name], { env });
      await this.execWithArgsFn(bin, ["mcp", "reload"], { env });   // hot-reload (verified)
      return { frameworkRemoved: true };
    }
    if (spec.type === "plugin") { await this.execWithArgsFn(bin, ["plugins", "uninstall", spec.name], { env }); return { frameworkRemoved: true }; }
    if (spec.type === "skill")  { return { frameworkRemoved: false, note: "OpenClaw skills are bundled and can only be disabled, not uninstalled via CLI — removed from AgentOne's list only." }; }
    throw new Error(`Unsupported capability type: ${spec.type}`);
  }

  /**
   * Check if a task references an unavailable capability.
   * Returns the gap spec if found, null otherwise.
   *
   * This implements pre-flight gap detection (Approach A from the recipe):
   * - Parses task for @skill-name references → checks against installed skills + MCP
   * - Supports scoped names like @scope/skill-name
   *
   * SECURITY: Uses argument array for all CLI calls.
   */
  async detectGap(taskInput: string): Promise<{ type: "skill" | "mcp" | "plugin"; name: string } | null> {
    // Get current installed capabilities (installed-only, both skills + MCP)
    const installed = await this.listCapabilities();
    const capabilityNames = new Set(installed.map(c => c.name));

    // Parse task for capability references
    // Pattern: @skill-name or @scope/skill-name
    // Use same safe chars as validateCapabilityName: [A-Za-z0-9._@/-]+
    const skillMatch = taskInput.match(/@([A-Za-z0-9._@/-]+)/);
    if (skillMatch) {
      const skillName = skillMatch[1];
      if (!capabilityNames.has(skillName)) {
        return { type: "skill", name: skillName };
      }
    }

    return null;
  }
}

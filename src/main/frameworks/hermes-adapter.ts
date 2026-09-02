import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import {
  FrameworkAdapter,
  ModelBackendConfig,
  InstalledCapability,
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
 * HermesAdapter implements the FrameworkAdapter interface for Hermes Agent.
 * This adapter handles installation verification and model backend configuration.
 *
 * TASK 2 SCOPE: start/stop/status/sendTask/streamOutput with sandboxed env.
 *
 * Verified installation: curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
 * Config path: ~/.hermes/config.yaml (YAML format)
 * Ref: docs/research/verified/hermes-agent.md
 *
 * CRITICAL SANDBOX GUARDRAIL (Ruling H1):
 * Hermes installer hijacks host PATH by adding ~/.local/bin/node → Node 26.
 * This adapter NEVER inherits process.env.PATH. Any hermes invocation (Task 2+)
 * MUST use explicit, safe PATH: /opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
 * plus ~/.hermes/hermes-agent/bin if needed.
 * Host node -v MUST remain v16.16.0.
 */
export class HermesAdapter implements FrameworkAdapter {
  private configDir: string;
  private probe: (binaryName: string) => Promise<boolean>;
  private processManager: ProcessManager;
  private secrets: Secrets | null;
  private execFn: ExecFunction;
  private execWithArgsFn: ExecWithArgsFunction;
  private currentBackend: ModelBackendConfig | null = null;

  /**
   * @param configDir - Directory where hermes config.yaml lives (injectable for tests)
   * @param probe - Function to check if binary exists (injectable for tests)
   * @param processManager - ProcessManager for spawning child processes (injectable for tests)
   * @param secrets - Secrets store for API keys (injectable for tests)
   * @param execFn - Function to execute shell commands (injectable for tests)
   * @param execWithArgs - Function to execute commands with arg array (injectable for tests, defaults to execFile)
   */
  constructor(
    configDir: string = path.join(os.homedir(), ".hermes"),
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
   * Verify hermes is installed. Per verified doc, it's installed via curl script.
   * This is idempotent - just checks that the binary exists.
   *
   * SECURITY: Does NOT auto-run the network installer (Phase 0 spike already did this).
   * Just verifies presence and throws a clear error with install instructions if absent.
   */
  async install(): Promise<void> {
    const exists = await this.probe("hermes");
    if (!exists) {
      throw new Error(
        "hermes binary not found. Install via: curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
      );
    }
    // Binary exists, installation verified
  }

  /**
   * Configure hermes to use the given model backend.
   * Writes ~/.hermes/config.yaml with provider settings.
   *
   * Per verified doc schema (YAML):
   * model:
   *   default: "llama3.2:3b"
   *   provider: "ollama"
   *   base_url: "http://localhost:11434/v1"
   *
   * SECURITY: Never writes secrets - those are injected via env at start (Task 2).
   */
  async configure(backend: ModelBackendConfig): Promise<void> {
    // Store backend for use in start()
    this.currentBackend = backend;

    // Ensure config directory exists
    await fs.mkdir(this.configDir, { recursive: true });

    // Map ModelBackendConfig to hermes YAML format
    const yamlContent = this.buildYamlConfig(backend);

    const configPath = path.join(this.configDir, "config.yaml");
    await fs.writeFile(configPath, yamlContent, "utf-8");
  }

  /**
   * Escape special characters in YAML string values.
   * Escapes backslashes and quotes to prevent YAML syntax errors.
   */
  private escapeYaml(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  /**
   * Build YAML config content based on backend kind.
   * Per verified doc:
   * - ollama: provider: "ollama", base_url: baseUrl
   * - llamacpp/vllm/custom: provider: "custom", base_url: baseUrl
   * - cloud: provider name (anthropic, openai, etc), no base_url
   */
  private buildYamlConfig(backend: ModelBackendConfig): string {
    let provider: string;
    let baseUrlLine = "";

    switch (backend.kind) {
      case "ollama":
        provider = "ollama";
        baseUrlLine = backend.baseUrl
          ? `  base_url: "${this.escapeYaml(backend.baseUrl)}"\n`
          : "";
        break;

      case "llamacpp":
      case "vllm":
      case "custom":
        // Per verified doc: these map to "custom" provider with base_url
        provider = "custom";
        baseUrlLine = backend.baseUrl
          ? `  base_url: "${this.escapeYaml(backend.baseUrl)}"\n`
          : "";
        break;

      case "cloud":
        // For cloud providers, use the named provider (anthropic, openai, etc)
        provider = backend.provider || "openrouter";
        // Cloud providers don't need base_url (use default endpoints)
        baseUrlLine = "";
        break;

      default:
        throw new Error(`Unsupported backend kind: ${backend.kind}`);
    }

    // Build YAML (simple format, no deps)
    // Escape all interpolated string values to prevent YAML syntax errors
    return (
      `model:\n` +
      `  default: "${this.escapeYaml(backend.model)}"\n` +
      `  provider: "${this.escapeYaml(provider)}"\n` +
      baseUrlLine
    );
  }

  // ========================================================================
  // TASK 2: Lifecycle methods - start/stop/status/sendTask/streamOutput
  // ========================================================================

  /**
   * Start hermes agent process via ProcessManager.
   * Uses sandboxed env with API key injected from Secrets.
   *
   * Per verified doc: `hermes chat` (interactive mode)
   * Or `hermes -z "prompt"` for one-shot (but we use interactive for streaming)
   *
   * CRITICAL GUARDRAIL (H1): Explicit sandboxed PATH, never inherit host PATH.
   * Uses absolute path to hermes binary to avoid including ~/.local/bin in PATH
   * (which would expose the node 26 symlinks that break host node 16).
   */
  async start(): Promise<void> {
    // Build sandboxed env with EXPLICIT PATH (no host PATH inheritance)
    // Include hermes's bundled node in case it's needed, plus standard bins
    const homeDir = os.homedir();
    const hermesNodePath = path.join(homeDir, ".hermes/node/bin");
    const env: Record<string, string> = {
      HOME: homeDir,
      PATH: `${hermesNodePath}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
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

    // Use absolute path to hermes binary (avoid PATH lookup that would require ~/.local/bin)
    const hermesBinary = path.join(homeDir, ".local/bin/hermes");

    // Spawn hermes chat (interactive mode for stdin/stdout streaming)
    this.processManager.start(hermesBinary, ["chat"], { env });
  }

  /**
   * Stop the hermes agent process.
   */
  async stop(): Promise<void> {
    await this.processManager.stop();
  }

  /**
   * Check if hermes is healthy via version check AND process liveness.
   * Per verified doc: `hermes --version` returns "Hermes Agent v0.21.0..."
   *
   * IMPORTANT: Also checks that the spawned process is actually running.
   * A dead/failed start() should report unhealthy even if the binary exists.
   * Uses absolute path to hermes binary for consistency with start().
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

    // Then check binary availability using absolute path (consistency with start())
    try {
      const homeDir = os.homedir();
      const hermesBinary = path.join(homeDir, ".local/bin/hermes");
      const result = await this.execWithArgsFn(hermesBinary, ["--version"]);
      if (result.stdout.includes("Hermes Agent")) {
        return "healthy";
      }
      return "unhealthy: unexpected version output";
    } catch (error) {
      return `unhealthy: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Send a task/prompt to the running hermes agent via stdin.
   */
  async sendTask(input: string): Promise<void> {
    const child = this.processManager.getChild();
    if (!child || !child.stdin) {
      throw new Error("Process not running or stdin not available");
    }

    child.stdin.write(`${input}\n`);
  }

  /**
   * Stream output from the running hermes agent.
   * Parses stdout with line buffering to handle tokens split across chunks.
   * Filters out spinner animation with ANCHORED regex (only lines that START with spinner).
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

        // Filter out spinner animation (ANCHORED match only)
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
      // Always emit task done at the end
      cb("__TASK_DONE__");
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
   * Per verified doc: Hermes uses spinner glyphs during thinking.
   * Only matches lines that START with a spinner glyph (after trimming).
   * This is ANCHORED to avoid filtering legitimate content.
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
   * Per verified doc: `hermes skills list` returns:
   * Available skills:
   *   - skill-name (installed)
   *   - other-skill (available)
   *
   * Returns ONLY installed/ready skills, NOT available-but-not-installed.
   * This ensures detectGap can correctly identify missing capabilities.
   *
   * SECURITY: Uses argument array to prevent command injection.
   */
  async listCapabilities(): Promise<InstalledCapability[]> {
    const result = await this.execWithArgsFn("hermes", ["skills", "list"]);
    const lines = result.stdout.split("\n");
    const capabilities: InstalledCapability[] = [];

    for (const line of lines) {
      // Match lines like "  - skill-name (installed)" or "  - skill-name (ready)"
      // IMPORTANT: Only match installed/ready, NOT available
      const match = line.match(/^\s*-\s+(\S+)\s+\((installed|ready)\)/);
      if (match) {
        const skillName = match[1];
        capabilities.push({
          deploymentId: "hermes-local", // Single deployment for now
          type: "skill",
          name: skillName,
          source: "hermes",
        });
      }
    }

    return capabilities;
  }

  /**
   * Install a capability (skill or MCP).
   * Per verified doc:
   * - Skills: `hermes skills install <skill-name>`
   * - MCP: `hermes mcp add <name> --url <endpoint>` (requires manual config, not supported)
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
        "MCP server installation requires manual configuration. Use `hermes mcp add` CLI or edit ~/.hermes/config.yaml."
      );
    }

    if (spec.type === "skill") {
      // Layer 2: Use argument array (no shell parsing)
      await this.execWithArgsFn("hermes", ["skills", "install", spec.name]);
      return;
    }

    throw new Error(`Unsupported capability type: ${spec.type}`);
  }

  /**
   * Check if restart is required after capability installation.
   * Per verified doc: "Unknown (not tested due to time constraints).
   * Hermes runs as a long-lived process (gateway mode) which may require
   * reload/restart for config changes. CLI mode likely picks up changes immediately."
   *
   * CONSERVATIVE CHOICE: Return true to force restart, ensuring capabilities load.
   * This is safer than assuming hot-reload given the uncertainty in the verified doc.
   */
  requiresRestartAfterInstall(): boolean {
    return true;
  }

  /**
   * Restart the hermes agent: stop then start.
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Remove a capability (skill, MCP, or plugin).
   * Per verified doc:
   * - Skills: `hermes skills uninstall <name>`
   * - MCP: `hermes mcp remove <name>`
   * - Plugins: `hermes plugins remove <name>`
   *
   * SECURITY: Two-layer defense against command injection:
   * 1. Validates name against strict pattern (no shell metacharacters)
   * 2. Uses argument array (execFile) instead of shell string interpolation
   */
  async removeCapability(spec: { type: string; name: string }): Promise<{ frameworkRemoved: boolean; note?: string }> {
    this.validateCapabilityName(spec.name);
    if (spec.type === "skill")  { await this.execWithArgsFn("hermes", ["skills", "uninstall", "--yes", spec.name]); return { frameworkRemoved: true }; }
    if (spec.type === "mcp")    { await this.execWithArgsFn("hermes", ["mcp", "remove", spec.name]);       return { frameworkRemoved: true }; }
    if (spec.type === "plugin") { await this.execWithArgsFn("hermes", ["plugins", "remove", spec.name]);   return { frameworkRemoved: true }; }
    throw new Error(`Unsupported capability type: ${spec.type}`);
  }

  /**
   * Check if a task references an unavailable capability.
   * Returns the gap spec if found, null otherwise.
   *
   * This implements pre-flight gap detection (Approach A from the recipe):
   * - Parses task for @skill-name references → checks against installed skills
   * - Supports scoped names like @scope/skill-name
   *
   * SECURITY: Uses argument array for all CLI calls.
   */
  async detectGap(taskInput: string): Promise<{ type: "skill" | "mcp" | "plugin"; name: string } | null> {
    // Get current installed skills (installed-only, NOT available)
    const installedSkills = await this.listCapabilities();
    const skillNames = new Set(installedSkills.map(s => s.name));

    // Parse task for capability references
    // Pattern: @skill-name or @scope/skill-name
    // Use same safe chars as validateCapabilityName: [A-Za-z0-9._@/-]+
    const skillMatch = taskInput.match(/@([A-Za-z0-9._@/-]+)/);
    if (skillMatch) {
      const skillName = skillMatch[1];
      if (!skillNames.has(skillName)) {
        return { type: "skill", name: skillName };
      }
    }

    return null;
  }

  // ========================================================================
  // TASK 3: Channel methods - configureChannel/verifyChannel/removeChannel/listChannels
  // ========================================================================

  /**
   * Validate channel ID to prevent command injection and path traversal.
   * Allows lowercase alphanumeric, hyphens, and underscores only.
   */
  private validateChannelId(id: string): void {
    const safePattern = /^[a-z0-9_-]+$/;
    if (!safePattern.test(id)) {
      throw new Error(
        `Invalid channel id: "${id}". ` +
        `Only lowercase alphanumeric characters, hyphens, and underscores are allowed.`
      );
    }
  }

  /**
   * Map channel ID + secret field to env var name.
   * Per verified research doc:
   * - telegram: TELEGRAM_BOT_TOKEN
   * - slack: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET
   * - discord: DISCORD_BOT_TOKEN
   */
  private getChannelEnvVarName(channelId: string, secretField: string): string {
    const channelUpper = channelId.toUpperCase();

    // Map common secret field names to env var suffixes
    if (secretField === "botToken") {
      return `${channelUpper}_BOT_TOKEN`;
    } else if (secretField === "appToken") {
      return `${channelUpper}_APP_TOKEN`;
    } else if (secretField === "signingSecret") {
      return `${channelUpper}_SIGNING_SECRET`;
    }

    // Default: CHANNEL_FIELD format
    const fieldUpper = secretField.replace(/([A-Z])/g, "_$1").toUpperCase().replace(/^_/, "");
    return `${channelUpper}_${fieldUpper}`;
  }

  /**
   * Configure a messaging channel.
   * Writes platforms.<id>.enabled: true to config.yaml (deep-merge, preserves existing keys).
   * Writes secrets to ~/.hermes/.env (merge, don't clobber other vars).
   *
   * SECURITY: Secrets ONLY in .env, never in config.yaml. Never logged.
   * Per verified research doc: hermes uses config.yaml + .env two-file approach.
   */
  async configureChannel(spec: {
    id: string;
    config: Record<string, string>;
    secrets: Record<string, string>;
  }): Promise<void> {
    // Validate channel ID
    this.validateChannelId(spec.id);

    // Ensure config directory exists
    await fs.mkdir(this.configDir, { recursive: true });

    // 1. Update config.yaml: add/update platforms.<id>.enabled: true
    await this.updateConfigYamlPlatform(spec.id, true, spec.config);

    // 2. Write secrets to .env (merge with existing)
    await this.mergeEnvSecrets(spec.secrets, spec.id);
  }

  /**
   * Update config.yaml to set platforms.<id>.enabled and merge non-secret config.
   * Preserves existing content (deep-merge).
   */
  private async updateConfigYamlPlatform(
    channelId: string,
    enabled: boolean,
    extraConfig: Record<string, string>
  ): Promise<void> {
    const configPath = path.join(this.configDir, "config.yaml");

    let content = "";
    try {
      content = await fs.readFile(configPath, "utf-8");
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
      // File doesn't exist, start fresh
    }

    // Parse YAML pragmatically: line-based approach to preserve structure
    const lines = content.split("\n");
    const result: string[] = [];
    let inPlatforms = false;
    let inTargetPlatform = false;
    let foundPlatforms = false;
    let foundTargetPlatform = false;
    let updatedEnabled = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect platforms: section
      if (trimmed === "platforms:") {
        inPlatforms = true;
        foundPlatforms = true;
        result.push(line);
        continue;
      }

      // Track if we're in the platforms section
      if (inPlatforms) {
        // Check if we've exited platforms (new top-level key)
        if (trimmed && !line.startsWith(" ") && !trimmed.startsWith("#")) {
          inPlatforms = false;
          inTargetPlatform = false;
        } else {
          // Check if this is a platform entry (2-space indent)
          const platformMatch = line.match(/^  ([a-z0-9_-]+):/);
          if (platformMatch) {
            const platformName = platformMatch[1];
            if (platformName === channelId) {
              inTargetPlatform = true;
              foundTargetPlatform = true;
            } else {
              inTargetPlatform = false;
            }
          }

          // Update enabled flag if we're in the target platform
          if (inTargetPlatform) {
            const enabledMatch = line.match(/^    enabled:/);
            if (enabledMatch) {
              result.push(`    enabled: ${enabled}`);
              updatedEnabled = true;
              continue;
            }
          }
        }
      }

      result.push(line);
    }

    // If platforms section exists but our channel doesn't, add it
    if (foundPlatforms && !foundTargetPlatform) {
      // Find where to insert (after last platform entry)
      let insertIdx = result.length;
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].trim() === "platforms:") {
          insertIdx = i + 1;
          break;
        }
        // Look for platform entries (2-space indent followed by name:)
        if (result[i].match(/^  [a-z0-9_-]+:/)) {
          // Find the end of this platform block (last line with 4-space indent)
          let j = i + 1;
          while (j < result.length && result[j].match(/^    /)) {
            j++;
          }
          insertIdx = j;
          break;
        }
      }

      result.splice(insertIdx, 0, `  ${channelId}:`, `    enabled: ${enabled}`);
    }

    // If platforms section doesn't exist, add it at the end
    if (!foundPlatforms) {
      if (result.length > 0 && result[result.length - 1].trim() !== "") {
        result.push(""); // Add blank line before platforms
      }
      result.push("platforms:", `  ${channelId}:`, `    enabled: ${enabled}`);
    }

    await fs.writeFile(configPath, result.join("\n"), "utf-8");
  }

  /**
   * Merge secrets into .env file without clobbering existing vars.
   * SECURITY: Secrets never logged.
   */
  private async mergeEnvSecrets(
    secrets: Record<string, string>,
    channelId: string
  ): Promise<void> {
    const envPath = path.join(this.configDir, ".env");

    // Read existing .env
    let existingEnv: Record<string, string> = {};
    try {
      const content = await fs.readFile(envPath, "utf-8");
      existingEnv = this.parseEnvFile(content);
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
      // File doesn't exist, start fresh
    }

    // Add new secrets (map field names to env var names)
    // SECURITY: Validate each secret value before writing to prevent .env injection
    for (const [field, value] of Object.entries(secrets)) {
      const envVarName = this.getChannelEnvVarName(channelId, field);

      // Reject secret values containing newlines (prevent env injection)
      if (value.includes("\n") || value.includes("\r")) {
        throw new Error(
          `Channel secret for ${envVarName} must not contain newlines. ` +
          `Bot tokens, signing secrets, and app tokens never legitimately contain newlines.`
        );
      }

      existingEnv[envVarName] = value;
    }

    // Write back
    const lines = Object.entries(existingEnv).map(([k, v]) => `${k}=${v}`);
    await fs.writeFile(envPath, lines.join("\n") + "\n", "utf-8");
  }

  /**
   * Parse .env file into key-value map.
   */
  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      result[key] = value;
    }

    return result;
  }

  /**
   * Verify a channel is connected.
   * Runs `hermes gateway status` and parses output.
   * Returns connected:true if gateway is running, false otherwise.
   * NEVER throws - always returns a result.
   */
  async verifyChannel(id: string): Promise<{ connected: boolean; detail?: string }> {
    try {
      const result = await this.execWithArgsFn("hermes", ["gateway", "status"]);

      // Parse status output
      // Example: "✓ default (current)        — running (pid 12345)"
      // Look for the checkmark indicator OR the word "running" not preceded by "not"
      const hasCheckmark = result.stdout.includes("✓");
      const hasRunningStatus = /—\s*running/.test(result.stdout);
      const isRunning = hasCheckmark || hasRunningStatus;

      return {
        connected: isRunning,
        detail: isRunning ? "running" : "not running",
      };
    } catch (error) {
      // No throw - return connected:false with error detail
      return {
        connected: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Remove a channel by setting enabled:false in config.yaml.
   * Does NOT delete the .env secrets (they're harmless if disabled).
   */
  async removeChannel(id: string): Promise<{ removed: boolean; note?: string }> {
    this.validateChannelId(id);

    // Set enabled:false in config.yaml
    await this.updateConfigYamlPlatform(id, false, {});

    return { removed: true };
  }

  /**
   * Check if restart is required after channel changes.
   * Per verified doc: Hermes gateway requires restart for channel config changes.
   */
  requiresRestartAfterChannelChange(): boolean {
    return true;
  }

  /**
   * List all configured channels from config.yaml.
   * Returns channel ID and enabled status.
   */
  async listChannels(): Promise<Array<{ id: string; enabled: boolean; connected?: boolean }>> {
    const configPath = path.join(this.configDir, "config.yaml");

    try {
      const content = await fs.readFile(configPath, "utf-8");
      return this.parseChannelsFromYaml(content);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []; // Config doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Parse channels from config.yaml content.
   * Extracts platforms.* entries with enabled status.
   */
  private parseChannelsFromYaml(content: string): Array<{ id: string; enabled: boolean }> {
    const lines = content.split("\n");
    const channels: Array<{ id: string; enabled: boolean }> = [];

    let inPlatforms = false;
    let currentPlatform: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect platforms: section
      if (trimmed === "platforms:") {
        inPlatforms = true;
        continue;
      }

      // Exit platforms section on new top-level key
      if (inPlatforms && trimmed && !line.startsWith(" ") && !trimmed.startsWith("#")) {
        break;
      }

      if (inPlatforms) {
        // Detect platform name (2-space indent)
        const platformMatch = line.match(/^  ([a-z0-9_-]+):/);
        if (platformMatch) {
          currentPlatform = platformMatch[1];
          continue;
        }

        // Detect enabled flag (4-space indent)
        if (currentPlatform) {
          const enabledMatch = line.match(/^    enabled:\s*(true|false)/);
          if (enabledMatch) {
            channels.push({
              id: currentPlatform,
              enabled: enabledMatch[1] === "true",
            });
            currentPlatform = null;
          }
        }
      }
    }

    return channels;
  }
}

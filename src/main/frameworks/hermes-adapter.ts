import { promises as fs } from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import {
  FrameworkAdapter,
  ModelBackendConfig,
  InstalledCapability,
} from "../../shared/v2-types";

const execAsync = promisify(exec);

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

/**
 * HermesAdapter implements the FrameworkAdapter interface for Hermes Agent.
 * This adapter handles installation verification and model backend configuration.
 *
 * TASK 1 SCOPE: install() + configure() only. Tasks 2-3 implement lifecycle methods.
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

  /**
   * @param configDir - Directory where hermes config.yaml lives (injectable for tests)
   * @param probe - Function to check if binary exists (injectable for tests)
   */
  constructor(
    configDir: string = path.join(process.env.HOME || "~", ".hermes"),
    probe: (binaryName: string) => Promise<boolean> = defaultProbe
  ) {
    this.configDir = configDir;
    this.probe = probe;
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
  // NOT IMPLEMENTED IN TASK 1 - Tasks 2-3 will implement lifecycle methods
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
    throw new Error("sendTask() not implemented in this task (Task 3)");
  }

  streamOutput(cb: (chunk: string) => void): () => void {
    throw new Error("streamOutput() not implemented in this task (Task 3)");
  }

  async listCapabilities(): Promise<InstalledCapability[]> {
    throw new Error("listCapabilities() not implemented in this task (Task 4)");
  }

  async installCapability(spec: {
    type: string;
    name: string;
  }): Promise<void> {
    throw new Error(
      "installCapability() not implemented in this task (Task 4)"
    );
  }

  requiresRestartAfterInstall(): boolean {
    throw new Error(
      "requiresRestartAfterInstall() not implemented in this task (Task 4)"
    );
  }

  async restart(): Promise<void> {
    throw new Error("restart() not implemented in this task (Task 2)");
  }
}

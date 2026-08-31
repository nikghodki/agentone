import { promises as fs } from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import {
  FrameworkAdapter,
  ModelBackendConfig,
  InstalledCapability,
  ChatMessage,
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

  /**
   * @param configDir - Directory where zeptoclaw config.json lives (injectable for tests)
   * @param probe - Function to check if binary exists (injectable for tests)
   */
  constructor(
    configDir: string = path.join(process.env.HOME || "~", ".zeptoclaw"),
    probe: (binaryName: string) => Promise<boolean> = defaultProbe
  ) {
    this.configDir = configDir;
    this.probe = probe;
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

  // Below methods are stubs for Tasks 3-4 (start, stop, streaming, capabilities)

  async start(): Promise<void> {
    throw new Error("start() not yet implemented (Task 3)");
  }

  async stop(): Promise<void> {
    throw new Error("stop() not yet implemented (Task 3)");
  }

  async status(): Promise<string> {
    throw new Error("status() not yet implemented (Task 3)");
  }

  async sendTask(_input: string): Promise<void> {
    throw new Error("sendTask() not yet implemented (Task 3)");
  }

  streamOutput(_cb: (chunk: string) => void): () => void {
    throw new Error("streamOutput() not yet implemented (Task 3)");
  }

  async listCapabilities(): Promise<InstalledCapability[]> {
    throw new Error("listCapabilities() not yet implemented (Task 4)");
  }

  async installCapability(_spec: {
    type: string;
    name: string;
  }): Promise<void> {
    throw new Error("installCapability() not yet implemented (Task 4)");
  }

  async restart(): Promise<void> {
    throw new Error("restart() not yet implemented (Task 3)");
  }
}

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { HermesAdapter } from "../../src/main/frameworks/hermes-adapter";
import { ModelBackendConfig } from "../../src/shared/v2-types";

describe("HermesAdapter", () => {
  let tempDir: string;
  let configPath: string;
  let adapter: HermesAdapter;

  beforeEach(async () => {
    // Create a temp directory for test config
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hermes-test-"));
    configPath = path.join(tempDir, "config.yaml");
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("configure()", () => {
    it("writes config file with Ollama backend", async () => {
      adapter = new HermesAdapter(tempDir);

      const backend: ModelBackendConfig = {
        id: "ollama-local",
        kind: "ollama",
        provider: "ollama",
        baseUrl: "http://localhost:11434/v1",
        protocol: "v1/chat/completions",
        model: "llama3.2:3b",
        secretRef: null,
      };

      await adapter.configure(backend);

      // Verify config file exists
      const configContent = await fs.readFile(configPath, "utf-8");

      // Parse YAML manually (simple parse for test - hermes uses YAML)
      // Per verified doc schema:
      // model:
      //   default: "llama3.2:3b"
      //   provider: "ollama"
      //   base_url: "http://localhost:11434/v1"
      expect(configContent).toContain("model:");
      expect(configContent).toContain('default: "llama3.2:3b"');
      expect(configContent).toContain('provider: "ollama"');
      expect(configContent).toContain('base_url: "http://localhost:11434/v1"');
    });

    it("writes config file with custom OpenAI-compatible backend (vllm)", async () => {
      adapter = new HermesAdapter(tempDir);

      const backend: ModelBackendConfig = {
        id: "custom-vllm",
        kind: "vllm",
        provider: null,
        baseUrl: "http://localhost:8000/v1",
        protocol: "v1/chat/completions",
        model: "meta-llama/Llama-3-8b",
        secretRef: "vllm-api-key",
      };

      await adapter.configure(backend);

      const configContent = await fs.readFile(configPath, "utf-8");

      // Per verified doc: vllm maps to "custom" provider with base_url
      expect(configContent).toContain("model:");
      expect(configContent).toContain('default: "meta-llama/Llama-3-8b"');
      expect(configContent).toContain('provider: "custom"');
      expect(configContent).toContain('base_url: "http://localhost:8000/v1"');
    });

    it("writes config file with llamacpp backend", async () => {
      adapter = new HermesAdapter(tempDir);

      const backend: ModelBackendConfig = {
        id: "llamacpp-local",
        kind: "llamacpp",
        provider: null,
        baseUrl: "http://localhost:8080/v1",
        protocol: "v1/chat/completions",
        model: "llama-2-7b",
        secretRef: null,
      };

      await adapter.configure(backend);

      const configContent = await fs.readFile(configPath, "utf-8");

      // Per verified doc: llamacpp maps to "custom" provider
      expect(configContent).toContain('provider: "custom"');
      expect(configContent).toContain('base_url: "http://localhost:8080/v1"');
      expect(configContent).toContain('default: "llama-2-7b"');
    });

    it("is idempotent - overwrites config cleanly", async () => {
      adapter = new HermesAdapter(tempDir);

      const backend1: ModelBackendConfig = {
        id: "ollama-1",
        kind: "ollama",
        provider: "ollama",
        baseUrl: "http://localhost:11434/v1",
        protocol: "v1/chat/completions",
        model: "llama3.2:3b",
        secretRef: null,
      };

      const backend2: ModelBackendConfig = {
        id: "ollama-2",
        kind: "ollama",
        provider: "ollama",
        baseUrl: "http://localhost:11434/v1",
        protocol: "v1/chat/completions",
        model: "mistral:latest",
        secretRef: null,
      };

      // First configure
      await adapter.configure(backend1);
      let configContent = await fs.readFile(configPath, "utf-8");
      expect(configContent).toContain('default: "llama3.2:3b"');

      // Second configure - should overwrite
      await adapter.configure(backend2);
      configContent = await fs.readFile(configPath, "utf-8");
      expect(configContent).toContain('default: "mistral:latest"');
      expect(configContent).not.toContain("llama3.2:3b");
    });

    it("never writes secrets to config file", async () => {
      adapter = new HermesAdapter(tempDir);

      const backend: ModelBackendConfig = {
        id: "anthropic-cloud",
        kind: "cloud",
        provider: "anthropic",
        baseUrl: null,
        protocol: "v1/messages",
        model: "claude-3-5-sonnet-20241022",
        secretRef: "anthropic-api-key",
      };

      await adapter.configure(backend);

      const configContent = await fs.readFile(configPath, "utf-8");

      // Positive assertions: verify config contains expected provider and model
      expect(configContent).toContain('provider: "anthropic"');
      expect(configContent).toContain('default: "claude-3-5-sonnet-20241022"');

      // Negative assertions: verify no secret values appear in the config
      expect(configContent).not.toContain("api_key");
      expect(configContent).not.toContain("apiKey");
      expect(configContent).not.toContain("secret");
      expect(configContent).not.toContain("token");

      // secretRef is just a reference, should not be in config either
      expect(configContent).not.toContain("anthropic-api-key");
    });

    it("creates config directory if it doesn't exist", async () => {
      const nonExistentDir = path.join(tempDir, "nested", "config");
      adapter = new HermesAdapter(nonExistentDir);

      const backend: ModelBackendConfig = {
        id: "ollama-local",
        kind: "ollama",
        provider: "ollama",
        baseUrl: "http://localhost:11434/v1",
        protocol: "v1/chat/completions",
        model: "llama3.2:3b",
        secretRef: null,
      };

      await adapter.configure(backend);

      // Verify directory was created and config exists
      const configPath = path.join(nonExistentDir, "config.yaml");
      const configContent = await fs.readFile(configPath, "utf-8");
      expect(configContent).toContain('default: "llama3.2:3b"');
    });

    it("escapes special characters in YAML values", async () => {
      adapter = new HermesAdapter(tempDir);

      const backend: ModelBackendConfig = {
        id: "custom-escaped",
        kind: "custom",
        provider: null,
        baseUrl: 'http://localhost:8000/v1?token="secret"&path=\\data',
        protocol: "v1/chat/completions",
        model: 'model-with-"quotes"-and-\\backslash',
        secretRef: null,
      };

      await adapter.configure(backend);

      const configContent = await fs.readFile(configPath, "utf-8");

      // Verify escaped quotes and backslashes in model name
      expect(configContent).toContain('default: "model-with-\\"quotes\\"-and-\\\\backslash"');

      // Verify escaped quotes and backslashes in base_url
      expect(configContent).toContain('base_url: "http://localhost:8000/v1?token=\\"secret\\"&path=\\\\data"');

      // Verify the config is still valid YAML (no syntax errors from unescaped chars)
      expect(configContent).toContain('provider: "custom"');
    });
  });

  describe("install()", () => {
    it("resolves when binary is present", async () => {
      // Mock probe function that returns true (binary exists)
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(adapter.install()).resolves.toBeUndefined();
      expect(mockProbe).toHaveBeenCalledWith("hermes");
    });

    it("throws with install instructions when binary is not present", async () => {
      // Mock probe function that returns false (binary missing)
      const mockProbe = vi.fn().mockResolvedValue(false);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(adapter.install()).rejects.toThrow(
        /hermes binary not found/i
      );

      // Verify error includes install command from verified doc
      try {
        await adapter.install();
      } catch (error) {
        expect((error as Error).message).toContain("curl -fsSL");
        expect((error as Error).message).toContain("hermes-agent.nousresearch.com");
      }
    });

    it("is idempotent - multiple calls succeed when binary present", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await adapter.install();
      await adapter.install();

      expect(mockProbe).toHaveBeenCalledTimes(2);
    });
  });

  describe("not-yet-implemented methods (Task 2-3)", () => {
    it("start() throws not implemented", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(adapter.start()).rejects.toThrow(/not implemented in this task/i);
    });

    it("stop() throws not implemented", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(adapter.stop()).rejects.toThrow(/not implemented in this task/i);
    });

    it("status() throws not implemented", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(adapter.status()).rejects.toThrow(/not implemented in this task/i);
    });

    it("sendTask() throws not implemented", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(adapter.sendTask("test")).rejects.toThrow(/not implemented in this task/i);
    });

    it("streamOutput() throws not implemented", () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      expect(() => adapter.streamOutput(() => {})).toThrow(/not implemented in this task/i);
    });

    it("listCapabilities() throws not implemented", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(adapter.listCapabilities()).rejects.toThrow(/not implemented in this task/i);
    });

    it("installCapability() throws not implemented", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(adapter.installCapability({ type: "skill", name: "test" })).rejects.toThrow(/not implemented in this task/i);
    });

    it("requiresRestartAfterInstall() throws not implemented", () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      expect(() => adapter.requiresRestartAfterInstall()).toThrow(/not implemented in this task/i);
    });

    it("restart() throws not implemented", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(adapter.restart()).rejects.toThrow(/not implemented in this task/i);
    });
  });
});

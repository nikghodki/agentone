import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { ZeptoclawAdapter } from "../../src/main/frameworks/zeptoclaw-adapter";
import { ModelBackendConfig } from "../../src/shared/v2-types";

describe("ZeptoclawAdapter", () => {
  let tempDir: string;
  let configPath: string;
  let adapter: ZeptoclawAdapter;

  beforeEach(async () => {
    // Create a temp directory for test config
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "zeptoclaw-test-"));
    configPath = path.join(tempDir, "config.json");
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("configure()", () => {
    it("writes config file with Ollama backend", async () => {
      adapter = new ZeptoclawAdapter(tempDir);

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
      const config = JSON.parse(configContent);

      // Verify structure matches zeptoclaw schema from verified doc
      expect(config).toHaveProperty("agents");
      expect(config.agents).toHaveProperty("defaults");
      expect(config.agents.defaults).toHaveProperty("model", "llama3.2:3b");

      expect(config).toHaveProperty("providers");
      expect(config.providers).toHaveProperty("ollama");
      expect(config.providers.ollama).toHaveProperty("api_base", "http://localhost:11434/v1");
      expect(config.providers.ollama).toHaveProperty("model", "llama3.2:3b");
    });

    it("writes config file with custom OpenAI-compatible backend", async () => {
      adapter = new ZeptoclawAdapter(tempDir);

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
      const config = JSON.parse(configContent);

      // For custom/vllm/llamacpp, use openai provider with custom base_url
      expect(config.agents.defaults.model).toBe("meta-llama/Llama-3-8b");
      expect(config.providers).toHaveProperty("openai");
      expect(config.providers.openai).toHaveProperty("api_base", "http://localhost:8000/v1");
      expect(config.providers.openai).toHaveProperty("model", "meta-llama/Llama-3-8b");
    });

    it("writes config file with cloud provider (Anthropic)", async () => {
      adapter = new ZeptoclawAdapter(tempDir);

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
      const config = JSON.parse(configContent);

      expect(config.agents.defaults.model).toBe("claude-3-5-sonnet-20241022");
      expect(config.providers).toHaveProperty("anthropic");
      expect(config.providers.anthropic).toHaveProperty("model", "claude-3-5-sonnet-20241022");
    });

    it("is idempotent - overwrites config cleanly", async () => {
      adapter = new ZeptoclawAdapter(tempDir);

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
      let config = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(config.agents.defaults.model).toBe("llama3.2:3b");

      // Second configure - should overwrite
      await adapter.configure(backend2);
      config = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(config.agents.defaults.model).toBe("mistral:latest");
    });

    it("never writes secrets to config file", async () => {
      adapter = new ZeptoclawAdapter(tempDir);

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

      // Verify no secret values appear in the config
      expect(configContent).not.toContain("api_key");
      expect(configContent).not.toContain("apiKey");
      expect(configContent).not.toContain("secret");
      expect(configContent).not.toContain("token");

      // secretRef is just a reference, should not be in config either
      expect(configContent).not.toContain("anthropic-api-key");
    });
  });

  describe("install()", () => {
    it("resolves when binary is present", async () => {
      // Mock probe function that returns true (binary exists)
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe);

      await expect(adapter.install()).resolves.toBeUndefined();
      expect(mockProbe).toHaveBeenCalledWith("zeptoclaw");
    });

    it("throws when binary is not present", async () => {
      // Mock probe function that returns false (binary missing)
      const mockProbe = vi.fn().mockResolvedValue(false);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe);

      await expect(adapter.install()).rejects.toThrow(
        /zeptoclaw binary not found/i
      );
      expect(mockProbe).toHaveBeenCalledWith("zeptoclaw");
    });

    it("is idempotent - multiple calls succeed when binary present", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe);

      await adapter.install();
      await adapter.install();

      expect(mockProbe).toHaveBeenCalledTimes(2);
    });
  });
});

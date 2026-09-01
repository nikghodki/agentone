import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { OpenclawAdapter } from "../../src/main/frameworks/openclaw-adapter";
import { ModelBackendConfig } from "../../src/shared/v2-types";

describe("OpenclawAdapter", () => {
  let tempDir: string;
  let configPath: string;
  let adapter: OpenclawAdapter;

  beforeEach(async () => {
    // Create a temp directory for test config
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-test-"));
    configPath = path.join(tempDir, "openclaw.json");
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("configure()", () => {
    it("writes config file with 3-part Ollama structure (models.providers + agents.defaults)", async () => {
      adapter = new OpenclawAdapter(tempDir);

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

      // PART 1: models.providers.ollama (TOP-LEVEL)
      expect(config.models).toBeDefined();
      expect(config.models.providers).toBeDefined();
      expect(config.models.providers.ollama).toBeDefined();
      expect(config.models.providers.ollama.api).toBe("ollama");
      expect(config.models.providers.ollama.baseUrl).toBe("http://localhost:11434/v1");
      expect(config.models.providers.ollama.models).toEqual([
        { id: "llama3.2:3b", name: "Llama 3.2 3B" },
      ]);

      // PART 2: agents.defaults.models["ollama/llama3.2:3b"]
      expect(config.agents).toBeDefined();
      expect(config.agents.defaults).toBeDefined();
      expect(config.agents.defaults.models).toBeDefined();
      expect(config.agents.defaults.models["ollama/llama3.2:3b"]).toBeDefined();
      expect(config.agents.defaults.models["ollama/llama3.2:3b"].alias).toBe("Llama 3.2 3B (Local)");

      // PART 3: model.primary + modelPolicy.allow
      expect(config.agents.defaults.model).toBeDefined();
      expect(config.agents.defaults.model.primary).toBe("ollama/llama3.2:3b");
      expect(config.agents.defaults.modelPolicy).toBeDefined();
      expect(config.agents.defaults.modelPolicy.allow).toEqual(["ollama/llama3.2:3b"]);

      // PART 4 (bonus): plugins.entries.ollama + plugins.allow
      expect(config.plugins).toBeDefined();
      expect(config.plugins.entries).toBeDefined();
      expect(config.plugins.entries.ollama).toBeDefined();
      expect(config.plugins.entries.ollama.enabled).toBe(true);
      expect(config.plugins.allow).toContain("ollama");
    });

    it("is idempotent - overwrites config cleanly", async () => {
      adapter = new OpenclawAdapter(tempDir);

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
      let config = JSON.parse(configContent);
      expect(config.models.providers.ollama.models[0].id).toBe("llama3.2:3b");
      expect(config.agents.defaults.model.primary).toBe("ollama/llama3.2:3b");

      // Second configure - should overwrite
      await adapter.configure(backend2);
      configContent = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(configContent);
      expect(config.models.providers.ollama.models[0].id).toBe("mistral:latest");
      expect(config.agents.defaults.model.primary).toBe("ollama/mistral:latest");
      expect(configContent).not.toContain("llama3.2:3b");
    });

    it("never writes secrets to config file", async () => {
      adapter = new OpenclawAdapter(tempDir);

      const backend: ModelBackendConfig = {
        id: "ollama-with-secret",
        kind: "ollama",
        provider: "ollama",
        baseUrl: "http://localhost:11434/v1",
        protocol: "v1/chat/completions",
        model: "llama3.2:3b",
        secretRef: "ollama-api-key",
      };

      await adapter.configure(backend);

      const configContent = await fs.readFile(configPath, "utf-8");

      // Negative assertions: verify no secret values appear in the config
      expect(configContent).not.toContain("api_key");
      expect(configContent).not.toContain("apiKey");
      expect(configContent).not.toContain("secret");
      expect(configContent).not.toContain("token");

      // secretRef is just a reference, should not be in config either
      expect(configContent).not.toContain("ollama-api-key");
    });

    it("creates config directory if it doesn't exist", async () => {
      const nonExistentDir = path.join(tempDir, "nested", "config");
      adapter = new OpenclawAdapter(nonExistentDir);

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
      const configPath = path.join(nonExistentDir, "openclaw.json");
      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);
      expect(config.agents.defaults.model.primary).toBe("ollama/llama3.2:3b");
    });

    it("escapes special characters in JSON values", async () => {
      adapter = new OpenclawAdapter(tempDir);

      const backend: ModelBackendConfig = {
        id: "custom-escaped",
        kind: "ollama",
        provider: "ollama",
        baseUrl: 'http://localhost:8000/v1?token="secret"&path=\\data',
        protocol: "v1/chat/completions",
        model: 'model-with-"quotes"-and-\\backslash',
        secretRef: null,
      };

      await adapter.configure(backend);

      const configContent = await fs.readFile(configPath, "utf-8");

      // JSON.stringify handles escaping automatically, so verify the config is valid JSON
      const config = JSON.parse(configContent);
      expect(config.models.providers.ollama.baseUrl).toBe('http://localhost:8000/v1?token="secret"&path=\\data');
      expect(config.models.providers.ollama.models[0].id).toBe('model-with-"quotes"-and-\\backslash');
    });
  });

  describe("install()", () => {
    it("runs doctor --fix + plugins install ollama when binary is present", async () => {
      // Mock probe function that returns true (binary exists)
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, mockProbe, mockExecWithArgs);

      await adapter.install();

      expect(mockProbe).toHaveBeenCalledWith("openclaw");

      // Verify doctor --fix was called with arg array
      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["doctor", "--fix"],
        expect.any(Object)
      );

      // Verify plugins install ollama was called with arg array
      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["plugins", "install", "ollama"],
        expect.any(Object)
      );
    });

    it("uses Node 22 sandbox with explicit PATH (no ~/.local/bin)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, mockProbe, mockExecWithArgs);

      await adapter.install();

      // Verify both commands used sandboxed env with explicit PATH
      const calls = mockExecWithArgs.mock.calls;
      for (const call of calls) {
        const opts = call[2];
        expect(opts.env).toBeDefined();
        expect(opts.env.PATH).toBeDefined();

        // CRITICAL: PATH must NOT contain ~/.local/bin (poisoned by hermes)
        expect(opts.env.PATH).not.toContain("~/.local/bin");
        expect(opts.env.PATH).not.toContain(".local/bin");

        // PATH must be explicit (not equal to process.env.PATH)
        expect(opts.env.PATH).not.toBe(process.env.PATH);

        // PATH must include nvm Node 22 + standard bins
        expect(opts.env.PATH).toContain("/usr/bin");
      }
    });

    it("throws with install instructions when binary is not present", async () => {
      // Mock probe function that returns false (binary missing)
      const mockProbe = vi.fn().mockResolvedValue(false);
      adapter = new OpenclawAdapter(tempDir, mockProbe);

      await expect(adapter.install()).rejects.toThrow(
        /openclaw binary not found/i
      );

      // Verify error includes install command from verified doc
      try {
        await adapter.install();
      } catch (error) {
        expect((error as Error).message).toContain("npm install -g openclaw");
      }
    });

    it("is idempotent - multiple calls succeed when binary present", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, mockProbe, mockExecWithArgs);

      await adapter.install();
      await adapter.install();

      expect(mockProbe).toHaveBeenCalledTimes(2);
      // doctor --fix and plugins install should run both times (they're idempotent)
      expect(mockExecWithArgs).toHaveBeenCalledTimes(4); // 2 calls * 2 commands
    });
  });

  describe("stub methods (Task 2-3)", () => {
    it("throws not implemented for start()", async () => {
      adapter = new OpenclawAdapter(tempDir);
      await expect(adapter.start()).rejects.toThrow(/not implemented/i);
    });

    it("throws not implemented for stop()", async () => {
      adapter = new OpenclawAdapter(tempDir);
      await expect(adapter.stop()).rejects.toThrow(/not implemented/i);
    });

    it("throws not implemented for status()", async () => {
      adapter = new OpenclawAdapter(tempDir);
      await expect(adapter.status()).rejects.toThrow(/not implemented/i);
    });

    it("throws not implemented for sendTask()", async () => {
      adapter = new OpenclawAdapter(tempDir);
      await expect(adapter.sendTask("test")).rejects.toThrow(/not implemented/i);
    });

    it("throws not implemented for streamOutput()", () => {
      adapter = new OpenclawAdapter(tempDir);
      expect(() => adapter.streamOutput(() => {})).toThrow(/not implemented/i);
    });

    it("throws not implemented for listCapabilities()", async () => {
      adapter = new OpenclawAdapter(tempDir);
      await expect(adapter.listCapabilities()).rejects.toThrow(/not implemented/i);
    });

    it("throws not implemented for installCapability()", async () => {
      adapter = new OpenclawAdapter(tempDir);
      await expect(adapter.installCapability({ type: "skill", name: "test" })).rejects.toThrow(/not implemented/i);
    });

    it("throws not implemented for restart()", async () => {
      adapter = new OpenclawAdapter(tempDir);
      await expect(adapter.restart()).rejects.toThrow(/not implemented/i);
    });

    it("throws not implemented for detectGap()", async () => {
      adapter = new OpenclawAdapter(tempDir);
      await expect(adapter.detectGap?.("test")).rejects.toThrow(/not implemented/i);
    });

    it("returns false for requiresRestartAfterInstall() (not implemented)", () => {
      adapter = new OpenclawAdapter(tempDir);
      expect(adapter.requiresRestartAfterInstall()).toBe(false);
    });
  });
});

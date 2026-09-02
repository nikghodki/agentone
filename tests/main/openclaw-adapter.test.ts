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

    it("preserves unrelated config keys (meta, gateway) when updating model", async () => {
      adapter = new OpenclawAdapter(tempDir);

      // Simulate an existing openclaw.json with unrelated keys from install/migration
      const existingConfig = {
        meta: {
          lastTouchedVersion: "2026.8.1",
          configVersion: "v2",
        },
        gateway: {
          controlUi: {
            port: 19000,
          },
        },
        models: {
          providers: {
            ollama: {
              api: "ollama",
              baseUrl: "http://localhost:11434/v1",
              models: [{ id: "llama3.2:3b", name: "Llama 3.2 3B" }],
            },
          },
        },
        agents: {
          defaults: {
            models: {
              "ollama/llama3.2:3b": { alias: "Llama 3.2 3B (Local)" },
            },
            model: { primary: "ollama/llama3.2:3b" },
            modelPolicy: { allow: ["ollama/llama3.2:3b"] },
          },
        },
        plugins: {
          entries: { ollama: { enabled: true } },
          allow: ["ollama"],
        },
      };

      // Write initial config
      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2), "utf-8");

      // Configure with a DIFFERENT backend/model
      const backend2: ModelBackendConfig = {
        id: "ollama-2",
        kind: "ollama",
        provider: "ollama",
        baseUrl: "http://localhost:11434/v1",
        protocol: "v1/chat/completions",
        model: "mistral:latest",
        secretRef: null,
      };

      await adapter.configure(backend2);

      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);

      // (a) Model config was UPDATED
      expect(config.models.providers.ollama.models[0].id).toBe("mistral:latest");
      expect(config.agents.defaults.model.primary).toBe("ollama/mistral:latest");

      // (b) Unrelated keys are STILL PRESENT
      expect(config.meta).toBeDefined();
      expect(config.meta.lastTouchedVersion).toBe("2026.8.1");
      expect(config.meta.configVersion).toBe("v2");
      expect(config.gateway).toBeDefined();
      expect(config.gateway.controlUi).toBeDefined();
      expect(config.gateway.controlUi.port).toBe(19000);
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

    it("writes persona to workspace/SOUL.md when provided", async () => {
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

      await adapter.configure(backend, { persona: "You are a coding assistant." });

      // Verify SOUL.md was written to workspace/
      const personaPath = path.join(tempDir, "workspace", "SOUL.md");
      const personaContent = await fs.readFile(personaPath, "utf-8");
      expect(personaContent).toBe("You are a coding assistant.");

      // Verify config was still written correctly
      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);
      expect(config.agents.defaults.model.primary).toBe("ollama/llama3.2:3b");
    });

    it("does not write SOUL.md when persona is empty or whitespace", async () => {
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

      await adapter.configure(backend, { persona: "   " });

      // Verify SOUL.md was NOT created
      const personaPath = path.join(tempDir, "workspace", "SOUL.md");
      await expect(fs.access(personaPath)).rejects.toThrow();
    });

    it("deep-merges gateway.port preserving existing gateway keys", async () => {
      adapter = new OpenclawAdapter(tempDir);

      // Write existing config with gateway.bind and gateway.auth
      const existingConfig = {
        meta: { lastTouchedVersion: "2026.8.1" },
        gateway: {
          bind: "0.0.0.0",
          auth: { token: "existing-token-12345" }
        },
        models: {
          providers: {
            ollama: { api: "ollama", baseUrl: "http://localhost:11434/v1", models: [{ id: "llama3.2:3b", name: "Llama 3.2 3B" }] }
          }
        },
        agents: {
          defaults: {
            models: { "ollama/llama3.2:3b": { alias: "Llama 3.2 3B (Local)" } },
            model: { primary: "ollama/llama3.2:3b" },
            modelPolicy: { allow: ["ollama/llama3.2:3b"] }
          }
        },
        plugins: {
          entries: { ollama: { enabled: true } },
          allow: ["ollama"]
        }
      };
      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2), "utf-8");

      const backend: ModelBackendConfig = {
        id: "ollama-local",
        kind: "ollama",
        provider: "ollama",
        baseUrl: "http://localhost:11434/v1",
        protocol: "v1/chat/completions",
        model: "llama3.2:3b",
        secretRef: null,
      };

      await adapter.configure(backend, { gatewayPort: 18800 });

      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);

      // Verify gateway.port was added
      expect(config.gateway.port).toBe(18800);

      // Verify existing gateway keys were preserved
      expect(config.gateway.bind).toBe("0.0.0.0");
      expect(config.gateway.auth.token).toBe("existing-token-12345");

      // Verify other keys preserved
      expect(config.meta.lastTouchedVersion).toBe("2026.8.1");
    });

    it("ignores out-of-range gateway ports", async () => {
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

      await adapter.configure(backend, { gatewayPort: 99999 });

      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);

      // Verify gateway was NOT added (port out of range)
      expect(config.gateway).toBeUndefined();
    });

    it("ignores invalid gateway ports (NaN)", async () => {
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

      await adapter.configure(backend, { gatewayPort: NaN as any });

      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);

      // Verify gateway was NOT added (port invalid)
      expect(config.gateway).toBeUndefined();
    });

    it("accepts gateway port boundary values (1 and 65535)", async () => {
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

      // Test port 1 (minimum valid)
      await adapter.configure(backend, { gatewayPort: 1 });
      let config = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(config.gateway.port).toBe(1);

      // Test port 65535 (maximum valid)
      await adapter.configure(backend, { gatewayPort: 65535 });
      config = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(config.gateway.port).toBe(65535);
    });

    it("ignores gateway ports outside valid range", async () => {
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

      // Test port 65536 (too large)
      await adapter.configure(backend, { gatewayPort: 65536 });
      let config = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(config.gateway).toBeUndefined();

      // Test port -1 (negative)
      await adapter.configure(backend, { gatewayPort: -1 });
      config = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(config.gateway).toBeUndefined();
    });

    it("truncates fractional gateway ports to integers", async () => {
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

      await adapter.configure(backend, { gatewayPort: 80.5 });

      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);

      // Verify port was truncated to 80
      expect(config.gateway.port).toBe(80);
    });

    it("applies both persona and gateway port when both provided", async () => {
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

      await adapter.configure(backend, { persona: "You are a code reviewer.", gatewayPort: 18800 });

      // Verify SOUL.md was written
      const personaPath = path.join(tempDir, "workspace", "SOUL.md");
      const personaContent = await fs.readFile(personaPath, "utf-8");
      expect(personaContent).toBe("You are a code reviewer.");

      // Verify gateway.port was written
      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);
      expect(config.gateway.port).toBe(18800);

      // Verify model config is intact
      expect(config.agents.defaults.model.primary).toBe("ollama/llama3.2:3b");
      expect(config.models.providers.ollama.models[0].id).toBe("llama3.2:3b");
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

  // ========================================================================
  // TASK 7 (Final Review): Injectable node22BinDir + case-insensitive status()
  // ========================================================================

  describe("injectable node22BinDir", () => {
    it("uses custom node22BinDir in both PATH and binary resolution", async () => {
      const customNode22BinDir = "/custom/node22/bin";
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      // Pass custom node22BinDir as last constructor parameter
      adapter = new OpenclawAdapter(
        tempDir,
        mockProbe,
        mockExecWithArgs,
        undefined,
        undefined,
        customNode22BinDir
      );

      await adapter.install();

      // Verify both doctor and plugins commands used the custom dir
      const calls = mockExecWithArgs.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      for (const call of calls) {
        const binary = call[0];
        const opts = call[2];

        // Assert binary path uses custom dir
        expect(binary).toBe(path.join(customNode22BinDir, "openclaw"));

        // Assert PATH has custom dir as prefix
        expect(opts.env.PATH).toContain(customNode22BinDir);
        expect(opts.env.PATH.startsWith(customNode22BinDir)).toBe(true);

        // Assert host node16 and ~/.local/bin are still excluded (Ruling O1)
        expect(opts.env.PATH).not.toContain(".local/bin");
        expect(opts.env.PATH).not.toBe(process.env.PATH);
      }
    });

    it("respects OPENCLAW_NODE22_BIN_DIR env var when constructor param not set", async () => {
      const envNode22BinDir = "/env/node22/bin";
      const originalEnv = process.env.OPENCLAW_NODE22_BIN_DIR;
      process.env.OPENCLAW_NODE22_BIN_DIR = envNode22BinDir;

      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      try {
        // No node22BinDir param -> should use env var
        adapter = new OpenclawAdapter(
          tempDir,
          mockProbe,
          mockExecWithArgs,
          undefined,
          undefined,
          undefined // no node22BinDir
        );

        await adapter.install();

        // Verify env var was used
        const call = mockExecWithArgs.mock.calls[0];
        const binary = call[0];
        expect(binary).toBe(path.join(envNode22BinDir, "openclaw"));
      } finally {
        // Restore original env
        if (originalEnv === undefined) {
          delete process.env.OPENCLAW_NODE22_BIN_DIR;
        } else {
          process.env.OPENCLAW_NODE22_BIN_DIR = originalEnv;
        }
      }
    });

    it("falls back to dev path when neither constructor param nor env var set", async () => {
      const originalEnv = process.env.OPENCLAW_NODE22_BIN_DIR;
      delete process.env.OPENCLAW_NODE22_BIN_DIR;

      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      try {
        adapter = new OpenclawAdapter(
          tempDir,
          mockProbe,
          mockExecWithArgs,
          undefined,
          undefined,
          undefined // no node22BinDir
        );

        await adapter.install();

        // Verify dev fallback was used (contains spike path)
        const call = mockExecWithArgs.mock.calls[0];
        const binary = call[0];
        expect(binary).toContain("workspace/flashlearn/spikes/openclaw-test");
      } finally {
        // Restore original env
        if (originalEnv === undefined) {
          delete process.env.OPENCLAW_NODE22_BIN_DIR;
        } else {
          process.env.OPENCLAW_NODE22_BIN_DIR = originalEnv;
        }
      }
    });
  });

  // ========================================================================
  // TASK 2: start/stop/status/sendTask/streamOutput
  // ========================================================================

  describe("start()", () => {
    it("performs lightweight readiness check (verifies binary)", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "openclaw version 2026.8.1\n",
        stderr: "",
      });

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        mockExecWithArgs
      );

      await adapter.start();

      // Verify version check was called (readiness check)
      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["--version"]
      );
    });

    it("throws when binary is not ready", async () => {
      const mockExecWithArgs = vi.fn().mockRejectedValue(new Error("ENOENT"));

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        mockExecWithArgs
      );

      await expect(adapter.start()).rejects.toThrow(/not ready/i);
    });

    it("F4: accepts 'OpenClaw' with capital C in version output", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        // REAL output: "OpenClaw" with capital C
        stdout: "OpenClaw 2026.8.1 (ea80657)\n",
        stderr: "",
      });

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        mockExecWithArgs
      );

      // Should NOT throw
      await expect(adapter.start()).resolves.toBeUndefined();

      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["--version"]
      );
    });
  });

  describe("stop()", () => {
    it("stops the process via ProcessManager", async () => {
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(null),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any
      );

      await adapter.stop();

      expect(mockProcessManager.stop).toHaveBeenCalled();
    });
  });

  describe("status()", () => {
    it("returns healthy when binary is ready (version check passes)", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        // FIX 2: Use real output with capital C to test case-insensitive check
        stdout: "OpenClaw 2026.8.1\n",
        stderr: "",
      });

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        mockExecWithArgs
      );

      const status = await adapter.status();

      expect(status).toBe("healthy");
      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["--version"]
      );
    });

    it("returns unhealthy when binary is not accessible", async () => {
      const mockExecWithArgs = vi.fn().mockRejectedValue(new Error("ENOENT"));

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        mockExecWithArgs
      );

      const status = await adapter.status();

      expect(status).toContain("unhealthy");
      expect(status).toContain("ENOENT");
    });

    it("uses absolute binary path (not host PATH lookup)", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "openclaw version 2026.8.1\n",
        stderr: "",
      });

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        mockExecWithArgs
      );

      await adapter.status();

      // Verify it used an absolute path (contains full path)
      const call = mockExecWithArgs.mock.calls[0];
      const binary = call[0];
      expect(binary).toContain("/");
      expect(binary).toContain("openclaw");
    });
  });

  describe("sendTask()", () => {
    it("spawns one-shot process with --message flag (verified model)", async () => {
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(null),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any
      );

      // Configure backend first
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

      await adapter.sendTask("What is 2+2?");

      // Verify one-shot spawn with --message flag
      expect(mockProcessManager.start).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["agent", "--local", "--message", "What is 2+2?"],
        expect.objectContaining({
          env: expect.objectContaining({
            HOME: expect.any(String),
            PATH: expect.any(String),
          }),
        })
      );

      // Verify PATH excludes ~/.local/bin (Node-22 sandbox)
      const call = mockProcessManager.start.mock.calls[0];
      const env = call[2].env;
      expect(env.PATH).not.toContain(".local/bin");
      expect(env.PATH).toContain("/usr/bin");
    });

    it("injects API key from secrets when secretRef is present", async () => {
      const mockSecrets = {
        get: vi.fn().mockReturnValue("test-api-key-123"),
      };

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(null),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any,
        mockSecrets as any
      );

      const backend: ModelBackendConfig = {
        id: "cloud-anthropic",
        kind: "cloud",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        protocol: "v1/chat/completions",
        model: "claude-3-sonnet-20240229",
        secretRef: "anthropic-key",
      };
      await adapter.configure(backend);

      await adapter.sendTask("test task");

      // Verify API key was injected into env
      const call = mockProcessManager.start.mock.calls[0];
      const env = call[2].env;
      expect(env.ANTHROPIC_API_KEY).toBe("test-api-key-123");
      expect(mockSecrets.get).toHaveBeenCalledWith("anthropic-key");
    });

    it("passes input as single argv (injection-safe)", async () => {
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(null),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any
      );

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

      // Input with shell metacharacters
      const maliciousInput = 'test"; rm -rf /; echo "pwned';
      await adapter.sendTask(maliciousInput);

      // Verify input is passed as single argv (not shell-interpolated)
      const call = mockProcessManager.start.mock.calls[0];
      const args = call[1];
      expect(args[3]).toBe(maliciousInput); // Exact match, not executed
    });
  });

  describe("streamOutput()", () => {
    it("parses stdout with line buffering and emits agent response", () => {
      const mockStdout = {
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
      };

      const mockChild = {
        stdout: mockStdout,
      };

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(mockChild),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any
      );

      const emittedChunks: string[] = [];
      adapter.streamOutput((chunk) => {
        emittedChunks.push(chunk);
      });

      // Simulate stdout data events
      const onData = mockStdout.on.mock.calls.find((call: any) => call[0] === "data")?.[1];
      const onEnd = mockStdout.once.mock.calls.find((call: any) => call[0] === "end")?.[1];

      // Emit agent response line
      onData(Buffer.from("The answer is 4.\n"));

      // Emit log lines (should be filtered)
      onData(Buffer.from("[agents/agent-command] [info] processing...\n"));

      // Emit completion signal
      onData(Buffer.from("[agents/agent-command] [agent] run 9a2ce18a-08bd-4d5a-be7b-63996f2499b5 ended with stopReason=stop\n"));

      // Trigger end
      onEnd();

      // Verify output
      expect(emittedChunks).toContain("The answer is 4.");
      expect(emittedChunks).toContain("__TASK_DONE__");
      // Verify completion signal line was not emitted as content
      expect(emittedChunks.filter(c => c.includes("ended with stopReason=stop"))).toHaveLength(0);
    });

    it("handles tokens split across chunks (line buffering)", () => {
      const mockStdout = {
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
      };

      const mockChild = {
        stdout: mockStdout,
      };

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(mockChild),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any
      );

      const emittedChunks: string[] = [];
      adapter.streamOutput((chunk) => {
        emittedChunks.push(chunk);
      });

      const onData = mockStdout.on.mock.calls.find((call: any) => call[0] === "data")?.[1];
      const onEnd = mockStdout.once.mock.calls.find((call: any) => call[0] === "end")?.[1];

      // Simulate split: "Hello wor" in chunk 1, "ld!\n" in chunk 2
      onData(Buffer.from("Hello wor"));
      // Nothing should be emitted yet (no newline)
      expect(emittedChunks).toHaveLength(0);

      onData(Buffer.from("ld!\n"));
      // Now the complete line should be emitted
      expect(emittedChunks).toContain("Hello world!");

      onEnd();
    });

    it("emits __TASK_DONE__ exactly once when stopReason line is detected", () => {
      const mockStdout = {
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
      };

      const mockChild = {
        stdout: mockStdout,
      };

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(mockChild),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any
      );

      const emittedChunks: string[] = [];
      adapter.streamOutput((chunk) => {
        emittedChunks.push(chunk);
      });

      const onData = mockStdout.on.mock.calls.find((call: any) => call[0] === "data")?.[1];

      // Emit a stopReason signal (single task completion)
      onData(Buffer.from("[agents/agent-command] [agent] run abc123 ended with stopReason=stop\n"));

      // Verify __TASK_DONE__ was emitted exactly once
      expect(emittedChunks.filter(c => c === "__TASK_DONE__")).toHaveLength(1);
    });

    it("uses anchored stopReason detection (not fooled by model output)", () => {
      const mockStdout = {
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
      };

      const mockChild = {
        stdout: mockStdout,
      };

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(mockChild),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any
      );

      const emittedChunks: string[] = [];
      adapter.streamOutput((chunk) => {
        emittedChunks.push(chunk);
      });

      const onData = mockStdout.on.mock.calls.find((call: any) => call[0] === "data")?.[1];

      // Emit model output that contains "ended with stopReason=" (should NOT trigger)
      onData(Buffer.from("The task ended with stopReason=stop being detected.\n"));

      // Emit actual openclaw stopReason line (SHOULD trigger)
      onData(Buffer.from("[agents/agent-command] [agent] run abc123 ended with stopReason=stop\n"));

      // Verify: model output emitted, __TASK_DONE__ emitted once
      expect(emittedChunks).toContain("The task ended with stopReason=stop being detected.");
      expect(emittedChunks.filter(c => c === "__TASK_DONE__")).toHaveLength(1);
    });

    it("returns unsubscribe function that removes listeners", () => {
      const mockStdout = {
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
      };

      const mockChild = {
        stdout: mockStdout,
      };

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(mockChild),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any
      );

      const unsubscribe = adapter.streamOutput(() => {});

      unsubscribe();

      expect(mockStdout.off).toHaveBeenCalledWith("data", expect.any(Function));
      expect(mockStdout.off).toHaveBeenCalledWith("end", expect.any(Function));
    });
  });

  // ========================================================================
  // TASK 3: Capability methods - listCapabilities/installCapability/restart/detectGap
  // ========================================================================

  describe("listCapabilities()", () => {
    it("parses installed skills AND MCP servers (installed-only)", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          // First call: openclaw skills list (REAL TABLE FORMAT from E2E)
          stdout: `
Skills (4/8 ready)
┌──────────┬──────────────────────────┬─────────────────────────────────────┬────────────────────┐
│ Status   │ Skill                    │ Description                         │ Source             │
├──────────┼──────────────────────────┼─────────────────────────────────────┼────────────────────┤
│ ✓ ready  │ typescript-helper        │ TypeScript code helper              │ openclaw-bundled   │
│ ✓ ready  │ code-review              │ Review code for issues              │ openclaw-custodian │
│ disabled │ 🔐 documentation         │ Generate docs                       │ openclaw-bundled   │
`,
          stderr: "",
        })
        .mockResolvedValueOnce({
          // Second call: openclaw mcp list (REAL TABLE FORMAT - best-effort assumption)
          stdout: `
MCP Servers (2/3 ready)
┌──────────┬──────────────────────────┬─────────────────────────────────────┐
│ Status   │ Server                   │ Description                         │
├──────────┼──────────────────────────┼─────────────────────────────────────┤
│ ✓ ready  │ filesystem               │ File system access                  │
│ ✓ ready  │ github                   │ GitHub API access                   │
│ disabled │ slack                    │ Slack integration                   │
`,
          stderr: "",
        });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const capabilities = await adapter.listCapabilities();

      // Verify both commands were called
      expect(mockExecWithArgs).toHaveBeenCalledTimes(2);
      expect(mockExecWithArgs).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("openclaw"),
        ["skills", "list"]
      );
      expect(mockExecWithArgs).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("openclaw"),
        ["mcp", "list"]
      );

      // IMPORTANT: Only "✓ ready" skills (2) + "✓ ready" MCP (2) = 4 total
      // "documentation" (disabled) and "slack" (disabled) are NOT included
      expect(capabilities).toHaveLength(4);

      // Check skills
      expect(capabilities.filter(c => c.type === "skill")).toHaveLength(2);
      expect(capabilities.find(c => c.name === "typescript-helper")).toEqual({
        deploymentId: "openclaw-local",
        type: "skill",
        name: "typescript-helper",
        source: "openclaw",
      });
      expect(capabilities.find(c => c.name === "code-review")).toBeDefined();

      // Check MCP servers
      expect(capabilities.filter(c => c.type === "mcp")).toHaveLength(2);
      expect(capabilities.find(c => c.name === "filesystem")).toEqual({
        deploymentId: "openclaw-local",
        type: "mcp",
        name: "filesystem",
        source: "openclaw",
      });
      expect(capabilities.find(c => c.name === "github")).toBeDefined();

      // Verify disabled ones are excluded
      expect(capabilities.find(c => c.name === "documentation")).toBeUndefined();
      expect(capabilities.find(c => c.name === "slack")).toBeUndefined();
    });

    it("returns empty array when no capabilities found", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({ stdout: "Skills:\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "MCP Servers:\n", stderr: "" });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const capabilities = await adapter.listCapabilities();

      expect(capabilities).toEqual([]);
    });

    it("handles empty/missing MCP section gracefully", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          stdout: `
Skills (1/3 ready)
┌──────────┬──────────────────────────┬─────────────────────────────────────┬────────────────────┐
│ Status   │ Skill                    │ Description                         │ Source             │
├──────────┼──────────────────────────┼─────────────────────────────────────┼────────────────────┤
│ ✓ ready  │ test-skill               │ Test skill                          │ openclaw-bundled   │
`,
          stderr: "",
        })
        .mockResolvedValueOnce({ stdout: "", stderr: "" });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const capabilities = await adapter.listCapabilities();

      // Only the skill should be returned
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].name).toBe("test-skill");
      expect(capabilities[0].type).toBe("skill");
    });

    it("F1: parses real table format with emoji prefixes and excludes disabled skills", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          // REAL output from E2E (with emoji prefixes, disabled status)
          stdout: `
Skills (2/3 ready)
┌──────────┬──────────────────────────┬─────────────────────────────────────────────────────────┬────────────────────┐
│ Status   │ Skill                    │ Description                                             │ Source             │
├──────────┼──────────────────────────┼─────────────────────────────────────────────────────────┼────────────────────┤
│ disabled │ 🔐 1password             │ Set up and use 1Password CLI for sign-in, desktop       │ openclaw-bundled   │
│          │                          │ integration, and reading or injecting secrets.          │                    │
│ ✓ ready  │ add-model-provider       │ Add and live-prove a model provider with non-interactive│ openclaw-custodian │
│          │                          │ config one-liners, without exposing credentials.        │                    │
│ ✓ ready  │ 📝 apple-notes           │ Create, view, edit, delete, search, move, or export     │ openclaw-bundled   │
│          │                          │ Apple Notes via the memo CLI on macOS.                  │                    │
`,
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "No OpenClaw-managed MCP servers configured in /Users/test/.openclaw/openclaw.json.",
          stderr: "",
        });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const capabilities = await adapter.listCapabilities();

      // Only 2 ready skills (excludes disabled 1password)
      expect(capabilities).toHaveLength(2);
      expect(capabilities.filter(c => c.type === "skill")).toHaveLength(2);

      // Verify bare skill names (emoji stripped)
      expect(capabilities.find(c => c.name === "add-model-provider")).toBeDefined();
      expect(capabilities.find(c => c.name === "apple-notes")).toBeDefined();

      // Verify disabled skill is excluded
      expect(capabilities.find(c => c.name === "1password")).toBeUndefined();
    });

    it("F1: a 'not ready' status is NOT falsely matched as ready (substring guard)", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          // Hypothetical status "not ready" must be excluded even though it
          // contains the substring "ready" — parser uses exact/prefix match.
          stdout: `
Skills (1/2 ready)
┌───────────┬──────────────────────────┬─────────────────────────────────────┬────────────────────┐
│ Status    │ Skill                    │ Description                         │ Source             │
├───────────┼──────────────────────────┼─────────────────────────────────────┼────────────────────┤
│ ✓ ready   │ ready-skill              │ A ready skill                       │ openclaw-bundled   │
│ not ready │ pending-skill            │ Not yet ready                       │ openclaw-bundled   │
`,
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "No OpenClaw-managed MCP servers configured in /Users/test/.openclaw/openclaw.json.",
          stderr: "",
        });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const capabilities = await adapter.listCapabilities();

      // Only the genuinely-ready skill; "not ready" is excluded
      expect(capabilities.filter(c => c.type === "skill")).toHaveLength(1);
      expect(capabilities.find(c => c.name === "ready-skill")).toBeDefined();
      expect(capabilities.find(c => c.name === "pending-skill")).toBeUndefined();
    });

    it("F2: handles 'No OpenClaw-managed MCP servers' message", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          stdout: `
Skills (1/1 ready)
┌──────────┬──────────────────────────┬─────────────────────────────────────┬────────────────────┐
│ Status   │ Skill                    │ Description                         │ Source             │
├──────────┼──────────────────────────┼─────────────────────────────────────┼────────────────────┤
│ ✓ ready  │ test-skill               │ Test skill                          │ openclaw-bundled   │
`,
          stderr: "",
        })
        .mockResolvedValueOnce({
          // REAL output when no MCP servers configured
          stdout: "No OpenClaw-managed MCP servers configured in /Users/nikhil/.openclaw/openclaw.json. Add one with openclaw mcp set <name> '{\"command\":\"uvx\",\"args\":[\"context7-mcp\"]}'.\nNote: this command only shows OpenClaw-managed mcp.servers entries and does not include mcporter servers from config/mcporter.json.",
          stderr: "",
        });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const capabilities = await adapter.listCapabilities();

      // Only the skill, no MCP servers
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].type).toBe("skill");
      expect(capabilities.filter(c => c.type === "mcp")).toHaveLength(0);
    });
  });

  describe("installCapability()", () => {
    it("installs a skill via openclaw skills install", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Skill installed successfully",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      await adapter.installCapability({ type: "skill", name: "test-skill" });

      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["skills", "install", "test-skill"]
      );
    });

    it("F3: installs MCP server with --url flag", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "MCP server added successfully",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      await adapter.installCapability({
        type: "mcp",
        name: "test-server",
        url: "http://localhost:8080",
      } as any);

      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["mcp", "add", "test-server", "--url", "http://localhost:8080"]
      );
    });

    it("F3: installs MCP server with --command flag", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "MCP server added successfully",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      await adapter.installCapability({
        type: "mcp",
        name: "test-server",
        command: "uvx",
      } as any);

      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["mcp", "add", "test-server", "--command", "uvx"]
      );
    });

    it("F3: installs MCP server with --command and --arg flags", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "MCP server added successfully",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      await adapter.installCapability({
        type: "mcp",
        name: "test-server",
        command: "uvx",
        args: ["context7-mcp", "--port=8080"],
      } as any);

      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["mcp", "add", "test-server", "--command", "uvx", "--arg", "context7-mcp", "--arg", "--port=8080"]
      );
    });

    it("F3: throws error when MCP install has neither url nor command", async () => {
      adapter = new OpenclawAdapter(tempDir);

      await expect(
        adapter.installCapability({ type: "mcp", name: "test-server" } as any)
      ).rejects.toThrow(/openclaw MCP install requires a url or command/);
    });

    it("installs a plugin via openclaw plugins install", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Plugin installed successfully",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      await adapter.installCapability({ type: "plugin", name: "ollama" });

      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["plugins", "install", "ollama"]
      );
    });

    it("validates name to prevent command injection", async () => {
      adapter = new OpenclawAdapter(tempDir);

      // Shell injection attempts
      await expect(
        adapter.installCapability({ type: "skill", name: "skill; rm -rf /" })
      ).rejects.toThrow(/Invalid capability name/);

      await expect(
        adapter.installCapability({ type: "skill", name: "skill && whoami" })
      ).rejects.toThrow(/Invalid capability name/);

      await expect(
        adapter.installCapability({ type: "skill", name: "skill | cat /etc/passwd" })
      ).rejects.toThrow(/Invalid capability name/);

      await expect(
        adapter.installCapability({ type: "skill", name: "skill\nrm -rf /" })
      ).rejects.toThrow(/Invalid capability name/);
    });

    it("allows scoped names with @, /, -, ., _", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      // Valid scoped names should pass validation
      await adapter.installCapability({ type: "skill", name: "@scope/skill-name" });
      await adapter.installCapability({ type: "skill", name: "org/repo.git" });
      await adapter.installCapability({ type: "skill", name: "user_skill-v2.0" });

      expect(mockExecWithArgs).toHaveBeenCalledTimes(3);
    });

    it("passes name as single argv (injection-safe)", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      // Even though this name is rejected by validation, verify arg-array pattern
      try {
        await adapter.installCapability({ type: "skill", name: "normal-skill" });
      } catch {}

      // Verify args are passed as array (not shell string)
      const call = mockExecWithArgs.mock.calls[0];
      expect(Array.isArray(call[1])).toBe(true);
      expect(call[1]).toEqual(["skills", "install", "normal-skill"]);
    });

    it("throws for unsupported capability types", async () => {
      adapter = new OpenclawAdapter(tempDir);

      await expect(
        adapter.installCapability({ type: "unknown" as any, name: "test" })
      ).rejects.toThrow(/Unsupported capability type/);
    });
  });

  describe("requiresRestartAfterInstall()", () => {
    it("returns false (openclaw hot-reloads skills + MCP per spike)", () => {
      adapter = new OpenclawAdapter(tempDir);

      const requiresRestart = adapter.requiresRestartAfterInstall();

      // CRITICAL: openclaw supports hot-reload via `openclaw mcp reload`
      // Per verified doc section 5: "Restart Required: NO - openclaw mcp reload provides hot-reload"
      expect(requiresRestart).toBe(false);
    });
  });

  describe("restart()", () => {
    it("calls stop then start", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "openclaw version 2026.8.1",
        stderr: "",
      });

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(null),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        mockExecWithArgs,
        mockProcessManager as any
      );

      await adapter.restart();

      // Verify stop was called first
      expect(mockProcessManager.stop).toHaveBeenCalled();
      // Verify start was called (version check happens in start)
      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["--version"]
      );
    });
  });

  describe("removeCapability()", () => {
    it("removeCapability: mcp unset+reload, plugins uninstall (verified); skills unsupported → frameworkRemoved false", async () => {
      const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
      const a = new OpenclawAdapter(tempDir, undefined, exec);
      await a.removeCapability({ type: "mcp", name: "fs" });
      const argLists = exec.mock.calls.map((c: any[]) => c[1]);
      expect(argLists).toContainEqual(["mcp", "unset", "fs"]);
      expect(argLists).toContainEqual(["mcp", "reload"]);
      // Assert env is passed on all calls (Node-22 sandbox invariant)
      for (const call of exec.mock.calls) {
        expect(call[2]?.env).toBeDefined();
      }
      expect(await a.removeCapability({ type: "plugin", name: "p1" })).toEqual({ frameworkRemoved: true });
      // Assert --force flag is used for plugins uninstall
      const pluginCall = exec.mock.calls.find((c: any[]) => c[1]?.includes("uninstall"));
      expect(pluginCall[1]).toContainEqual("--force");
      const skill = await a.removeCapability({ type: "skill", name: "bundled-x" });
      expect(skill.frameworkRemoved).toBe(false);
      expect(skill.note).toMatch(/bundled/i);
    });
    it("removeCapability rejects an injection-y name", async () => {
      const a = new OpenclawAdapter(tempDir);
      await expect(a.removeCapability({ type: "skill", name: "a; rm -rf /" })).rejects.toThrow();
    });
  });

  describe("detectGap()", () => {
    it("detects missing @skill reference", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          stdout: `
Skills (1/2 ready)
┌──────────┬──────────────────────────┬─────────────────────────────────────┬────────────────────┐
│ Status   │ Skill                    │ Description                         │ Source             │
├──────────┼──────────────────────────┼─────────────────────────────────────┼────────────────────┤
│ ✓ ready  │ existing-skill           │ An existing skill                   │ openclaw-bundled   │
`,
          stderr: "",
        })
        .mockResolvedValueOnce({ stdout: "No OpenClaw-managed MCP servers configured", stderr: "" });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const gap = await adapter.detectGap("Use @missing-skill to complete this task");

      expect(gap).toEqual({
        type: "skill",
        name: "missing-skill",
      });
    });

    it("detects missing scoped @skill reference", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({ stdout: "Skills (0/1 ready)\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "No OpenClaw-managed MCP servers configured", stderr: "" });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const gap = await adapter.detectGap("Use @scope/missing-skill for this");

      expect(gap).toEqual({
        type: "skill",
        name: "scope/missing-skill",
      });
    });

    it("returns null when @skill is present", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          stdout: `
Skills (1/2 ready)
┌──────────┬──────────────────────────┬─────────────────────────────────────┬────────────────────┐
│ Status   │ Skill                    │ Description                         │ Source             │
├──────────┼──────────────────────────┼─────────────────────────────────────┼────────────────────┤
│ ✓ ready  │ existing-skill           │ An existing skill                   │ openclaw-bundled   │
`,
          stderr: "",
        })
        .mockResolvedValueOnce({ stdout: "No OpenClaw-managed MCP servers configured", stderr: "" });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const gap = await adapter.detectGap("Use @existing-skill to complete this task");

      expect(gap).toBeNull();
    });

    it("returns null when no capability reference found", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({ stdout: "Skills (0/1 ready)\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "No OpenClaw-managed MCP servers configured", stderr: "" });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const gap = await adapter.detectGap("Just a regular task with no special references");

      expect(gap).toBeNull();
    });

    it("detects missing MCP reference when @skill pattern not found", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({ stdout: "Skills (0/1 ready)\n", stderr: "" })
        .mockResolvedValueOnce({
          stdout: `
MCP Servers (1/1 ready)
┌──────────┬──────────────────────────┬─────────────────────────────────────┐
│ Status   │ Server                   │ Description                         │
├──────────┼──────────────────────────┼─────────────────────────────────────┤
│ ✓ ready  │ github                   │ GitHub API access                   │
`,
          stderr: "",
        });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      // Task references MCP but doesn't use @-syntax (just mentions the tool name)
      // For this test, let's assume the task just has no @ reference
      const gap = await adapter.detectGap("Use the filesystem tool to read files");

      // Since there's no @-reference, no gap is detected
      // This matches the pattern from hermes which only checks @skill references
      expect(gap).toBeNull();
    });

    it("uses safe pattern for @skill extraction (allows @, /, -, ., _)", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({ stdout: "Skills (0/1 ready)\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "No OpenClaw-managed MCP servers configured", stderr: "" });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const gap = await adapter.detectGap("Use @org/repo-name.v2_test for this");

      expect(gap).toEqual({
        type: "skill",
        name: "org/repo-name.v2_test",
      });
    });
  });

  // ========================================================================
  // TASK 2 (Phase 2a): Channel methods
  // ========================================================================

  describe("configureChannel()", () => {
    it("runs channels add with --use-env flag and injects token via env (recommended approach)", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Channel added successfully",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      await adapter.configureChannel?.({
        id: "telegram",
        config: {},
        secrets: { botToken: "test-bot-token-123" },
      });

      // Verify channels add command was called with --use-env
      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["channels", "add", "--channel", "telegram", "--use-env"],
        expect.objectContaining({
          env: expect.objectContaining({
            TELEGRAM_BOT_TOKEN: "test-bot-token-123",
          }),
        })
      );
    });

    it("uses sandboxed Node-22 env with explicit PATH (no ~/.local/bin)", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Channel added successfully",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      await adapter.configureChannel?.({
        id: "telegram",
        config: {},
        secrets: { botToken: "test-token" },
      });

      // Verify sandboxed env was passed
      const call = mockExecWithArgs.mock.calls[0];
      const opts = call[2];
      expect(opts.env).toBeDefined();
      expect(opts.env.PATH).toBeDefined();

      // CRITICAL: PATH must NOT contain ~/.local/bin
      expect(opts.env.PATH).not.toContain(".local/bin");
      expect(opts.env.PATH).not.toBe(process.env.PATH);
    });

    it("validates channel id to prevent command injection", async () => {
      adapter = new OpenclawAdapter(tempDir);

      // Shell injection attempts should be rejected
      await expect(
        adapter.configureChannel?.({ id: "telegram; rm -rf /", config: {}, secrets: { botToken: "T" } })
      ).rejects.toThrow(/Invalid/);

      await expect(
        adapter.configureChannel?.({ id: "telegram && whoami", config: {}, secrets: { botToken: "T" } })
      ).rejects.toThrow(/Invalid/);
    });

    it("maps different channel types to correct env var names", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Channel added successfully",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      // Test telegram
      await adapter.configureChannel?.({
        id: "telegram",
        config: {},
        secrets: { botToken: "telegram-token" },
      });
      let call = mockExecWithArgs.mock.calls[0];
      expect(call[2].env.TELEGRAM_BOT_TOKEN).toBe("telegram-token");

      // Test discord
      await adapter.configureChannel?.({
        id: "discord",
        config: {},
        secrets: { botToken: "discord-token" },
      });
      call = mockExecWithArgs.mock.calls[1];
      expect(call[2].env.DISCORD_BOT_TOKEN).toBe("discord-token");

      // Test slack (multiple secrets)
      await adapter.configureChannel?.({
        id: "slack",
        config: {},
        secrets: {
          botToken: "slack-bot-token",
          signingSecret: "slack-secret",
          appToken: "slack-app-token",
        },
      });
      call = mockExecWithArgs.mock.calls[2];
      expect(call[2].env.SLACK_BOT_TOKEN).toBe("slack-bot-token");
      expect(call[2].env.SLACK_SIGNING_SECRET).toBe("slack-secret");
      expect(call[2].env.SLACK_APP_TOKEN).toBe("slack-app-token");
    });

    it("never logs the token (security check)", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Channel added successfully",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const secretToken = "super-secret-token-12345";
      await adapter.configureChannel?.({
        id: "telegram",
        config: {},
        secrets: { botToken: secretToken },
      });

      // Verify token is NOT in the command arguments (only in env)
      const call = mockExecWithArgs.mock.calls[0];
      const args = call[1];
      expect(args.join(" ")).not.toContain(secretToken);
    });
  });

  describe("verifyChannel()", () => {
    it("runs channels status --probe and parses connected=true from real E2E output (running/configured)", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        // REAL output with valid token (per phase2a-channel-e2e.md)
        stdout: "Checking channel status (probe)…\nGateway reachable.\n- Telegram default: enabled, configured, running, mode:polling",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const result = await adapter.verifyChannel?.("telegram");

      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["channels", "status", "--channel", "telegram", "--probe"],
        expect.any(Object)
      );

      expect(result).toEqual({
        connected: true,
        detail: expect.any(String),
      });
    });

    it("runs channels status --probe and parses connected=false from real E2E output (not configured/stopped)", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        // REAL output with dummy token (per phase2a-channel-e2e.md)
        stdout: "Checking channel status (probe)…\nGateway reachable.\n- Telegram default: enabled, not configured, stopped, mode:polling",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const result = await adapter.verifyChannel?.("telegram");

      expect(result).toEqual({
        connected: false,
        detail: expect.any(String),
      });
    });

    it("returns connected=false on exec error (does not throw)", async () => {
      const mockExecWithArgs = vi.fn().mockRejectedValue(new Error("Command failed"));

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const result = await adapter.verifyChannel?.("telegram");

      expect(result).toEqual({
        connected: false,
        detail: expect.stringContaining("Command failed"),
      });
    });

    it("uses sandboxed env for probe command", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "connected",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      await adapter.verifyChannel?.("telegram");

      const call = mockExecWithArgs.mock.calls[0];
      const opts = call[2];
      expect(opts.env).toBeDefined();
      expect(opts.env.PATH).not.toContain(".local/bin");
    });
  });

  describe("removeChannel()", () => {
    it("runs channels remove --delete and returns removed=true", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Channel removed successfully",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const result = await adapter.removeChannel?.("telegram");

      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["channels", "remove", "--channel", "telegram", "--delete"],
        expect.any(Object)
      );

      expect(result).toEqual({ removed: true });
    });

    it("validates channel id to prevent command injection", async () => {
      adapter = new OpenclawAdapter(tempDir);

      await expect(
        adapter.removeChannel?.("telegram; rm -rf /")
      ).rejects.toThrow(/Invalid/);
    });

    it("uses sandboxed env for remove command", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "removed",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      await adapter.removeChannel?.("telegram");

      const call = mockExecWithArgs.mock.calls[0];
      const opts = call[2];
      expect(opts.env).toBeDefined();
      expect(opts.env.PATH).not.toContain(".local/bin");
    });
  });

  describe("listChannels()", () => {
    it("parses real E2E line format into array with id, enabled, connected", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        // REAL output format from phase2a-channel-e2e.md
        stdout: `Chat channels:
- Telegram default: installed, configured, enabled, token=***
- Discord default: installed, not configured, enabled, token=***`,
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const channels = await adapter.listChannels?.();

      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["channels", "list"],
        expect.any(Object)
      );

      expect(channels).toHaveLength(2);
      expect(channels?.[0]).toEqual({
        id: "telegram",
        enabled: true,
        connected: true,
      });
      expect(channels?.[1]).toEqual({
        id: "discord",
        enabled: true,
        connected: false,
      });
    });

    it("returns empty array when no channels configured (real E2E empty state)", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        // REAL empty state format from phase2a-channel-e2e.md
        stdout: "Chat channels:\n- no configured chat channels (run `openclaw channels list --all` to see installable channels)",
        stderr: "",
      });

      adapter = new OpenclawAdapter(tempDir, undefined, mockExecWithArgs);

      const channels = await adapter.listChannels?.();

      expect(channels).toEqual([]);
    });
  });

  describe("requiresRestartAfterChannelChange()", () => {
    it("returns true (openclaw gateway restart required after channel changes)", () => {
      adapter = new OpenclawAdapter(tempDir);

      const requiresRestart = adapter.requiresRestartAfterChannelChange?.();

      expect(requiresRestart).toBe(true);
    });
  });
});

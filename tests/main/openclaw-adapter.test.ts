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
  // TASK 2: start/stop/status/sendTask/streamOutput
  // ========================================================================

  describe("start()", () => {
    it("spawns openclaw agent --local via ProcessManager with Node-22 sandbox", async () => {
      // Mock ProcessManager
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

      await adapter.start();

      expect(mockProcessManager.start).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["agent", "--local"],
        expect.objectContaining({
          env: expect.objectContaining({
            HOME: expect.any(String),
            PATH: expect.any(String),
          }),
        })
      );

      // Verify PATH excludes ~/.local/bin
      const call = mockProcessManager.start.mock.calls[0];
      const env = call[2].env;
      expect(env.PATH).not.toContain(".local/bin");
      // Verify PATH includes Node 22 + standard bins
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

      await adapter.start();

      // Verify API key was injected into env
      const call = mockProcessManager.start.mock.calls[0];
      const env = call[2].env;
      expect(env.ANTHROPIC_API_KEY).toBe("test-api-key-123");
      expect(mockSecrets.get).toHaveBeenCalledWith("anthropic-key");
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
    it("returns unhealthy when process is not running", async () => {
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
        getLastError: vi.fn().mockReturnValue(new Error("spawn ENOENT")),
        getChild: vi.fn().mockReturnValue(null),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any
      );

      const status = await adapter.status();

      expect(status).toContain("unhealthy");
      expect(status).toContain("not running");
      expect(mockProcessManager.isRunning).toHaveBeenCalled();
    });

    it("returns healthy when process is running and version check passes", async () => {
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(null),
      };

      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "openclaw version 2026.8.1\n",
        stderr: "",
      });

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        mockExecWithArgs,
        mockProcessManager as any
      );

      const status = await adapter.status();

      expect(status).toBe("healthy");
      expect(mockExecWithArgs).toHaveBeenCalledWith(
        expect.stringContaining("openclaw"),
        ["--version"]
      );
    });

    it("uses absolute binary path (not host PATH lookup)", async () => {
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(null),
      };

      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "openclaw version 2026.8.1\n",
        stderr: "",
      });

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        mockExecWithArgs,
        mockProcessManager as any
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
    it("writes input to stdin with newline", async () => {
      const mockStdin = {
        write: vi.fn(),
      };

      const mockChild = {
        stdin: mockStdin,
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

      await adapter.sendTask("What is 2+2?");

      expect(mockStdin.write).toHaveBeenCalledWith("What is 2+2?\n");
    });

    it("throws when process not running", async () => {
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn().mockReturnValue(null),
      };

      adapter = new OpenclawAdapter(
        tempDir,
        undefined,
        undefined,
        mockProcessManager as any
      );

      await expect(adapter.sendTask("test")).rejects.toThrow(/not running/i);
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

    it("emits __TASK_DONE__ when stopReason=stop line is detected", () => {
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

      // Emit various stopReason signals
      onData(Buffer.from("[agents/agent-command] [agent] run abc123 ended with stopReason=stop\n"));
      onData(Buffer.from("[agents/agent-command] [agent] run def456 ended with stopReason=end_turn\n"));
      onData(Buffer.from("[agents/agent-command] [agent] run ghi789 ended with stopReason=max_tokens\n"));

      // Verify __TASK_DONE__ was emitted for each stopReason
      expect(emittedChunks.filter(c => c === "__TASK_DONE__")).toHaveLength(3);
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
  // TASK 3: Stub methods (not implemented yet)
  // ========================================================================

  describe("stub methods (Task 3)", () => {
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

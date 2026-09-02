import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { EventEmitter } from "stream";
import { HermesAdapter } from "../../src/main/frameworks/hermes-adapter";
import { ModelBackendConfig } from "../../src/shared/v2-types";
import { ProcessManager } from "../../src/main/frameworks/process-manager";
import { Secrets } from "../../src/main/secrets";

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

    it("writes persona to SOUL.md (not workspace/SOUL.md) when provided", async () => {
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

      await adapter.configure(backend, { persona: "You are a security researcher." });

      // Verify SOUL.md was written to configDir root (NOT workspace/)
      const personaPath = path.join(tempDir, "SOUL.md");
      const personaContent = await fs.readFile(personaPath, "utf-8");
      expect(personaContent).toBe("You are a security researcher.");

      // Verify config.yaml was still written correctly
      const configContent = await fs.readFile(configPath, "utf-8");
      expect(configContent).toContain('default: "llama3.2:3b"');
    });

    it("does not write SOUL.md when persona is empty or whitespace", async () => {
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

      await adapter.configure(backend, { persona: "  " });

      // Verify SOUL.md was NOT created
      const personaPath = path.join(tempDir, "SOUL.md");
      await expect(fs.access(personaPath)).rejects.toThrow();
    });

    it("does NOT add gateway/port key to config.yaml (intentional no-op)", async () => {
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

      // Configure with gatewayPort
      await adapter.configure(backend, { gatewayPort: 8090 });

      const configContent = await fs.readFile(configPath, "utf-8");

      // Verify gateway/port was NOT added (hermes has no verified bind-port key)
      expect(configContent).not.toContain("gateway");
      expect(configContent).not.toContain("port");
      expect(configContent).not.toContain("8090");

      // Verify config is byte-identical to no-options case for port dimension
      const adapter2 = new HermesAdapter(path.join(tempDir, "alt"));
      await adapter2.configure(backend);
      const altConfigContent = await fs.readFile(path.join(tempDir, "alt", "config.yaml"), "utf-8");
      expect(configContent).toBe(altConfigContent);
    });

    it("applies persona even when gatewayPort is also provided", async () => {
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

      // Provide both persona and gatewayPort
      await adapter.configure(backend, { persona: "You are a DevOps expert.", gatewayPort: 8090 });

      // Verify persona was written
      const personaPath = path.join(tempDir, "SOUL.md");
      const personaContent = await fs.readFile(personaPath, "utf-8");
      expect(personaContent).toBe("You are a DevOps expert.");

      // Verify config.yaml still does NOT contain port
      const configContent = await fs.readFile(configPath, "utf-8");
      expect(configContent).not.toContain("gateway");
      expect(configContent).not.toContain("port");
      expect(configContent).not.toContain("8090");
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

  // ========================================================================
  // TASK 2: Lifecycle methods - start/stop/status/sendTask/streamOutput
  // ========================================================================

  describe("start()", () => {
    it("spawns hermes chat with sandboxed explicit PATH (H1 guardrail)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(),
        getLastError: vi.fn(),
        getChild: vi.fn(),
      } as unknown as ProcessManager;

      // Configure with Ollama backend
      const backend: ModelBackendConfig = {
        id: "ollama-local",
        kind: "ollama",
        provider: "ollama",
        baseUrl: "http://localhost:11434/v1",
        protocol: "v1/chat/completions",
        model: "llama3.2:3b",
        secretRef: null,
      };

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);
      await adapter.configure(backend);
      await adapter.start();

      // Verify spawn was called with hermes chat
      expect(mockProcessManager.start).toHaveBeenCalledOnce();
      const [cmd, args, opts] = (mockProcessManager.start as any).mock.calls[0];
      // Should use absolute path to avoid PATH lookup (H1 guardrail)
      expect(cmd).toContain(".local/bin/hermes");
      expect(path.isAbsolute(cmd)).toBe(true);
      expect(args).toEqual(["chat"]);

      // CRITICAL: Verify PATH is EXPLICIT and sandboxed (H1 guardrail)
      expect(opts.env.PATH).toBeDefined();
      // Should contain hermes's bundled node + standard bins
      expect(opts.env.PATH).toContain(".hermes/node/bin");
      expect(opts.env.PATH).toContain("/usr/bin");
      // Should NOT equal process.env.PATH (sandboxed)
      expect(opts.env.PATH).not.toBe(process.env.PATH);
      // Should NOT contain ~/.local/bin (hermes's PATH hijack)
      expect(opts.env.PATH).not.toContain("~/.local/bin");
    });

    it("injects API key from Secrets when backend has secretRef", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(),
        getLastError: vi.fn(),
        getChild: vi.fn(),
      } as unknown as ProcessManager;

      const mockSecrets = {
        get: vi.fn().mockReturnValue("sk-test-anthropic-key"),
      } as unknown as Secrets;

      const backend: ModelBackendConfig = {
        id: "anthropic-cloud",
        kind: "cloud",
        provider: "anthropic",
        baseUrl: null,
        protocol: "v1/messages",
        model: "claude-3-5-sonnet-20241022",
        secretRef: "anthropic-api-key",
      };

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager, mockSecrets);
      await adapter.configure(backend);
      await adapter.start();

      // Verify API key was injected via env
      const [, , opts] = (mockProcessManager.start as any).mock.calls[0];
      expect(mockSecrets.get).toHaveBeenCalledWith("anthropic-api-key");
      expect(opts.env.ANTHROPIC_API_KEY).toBe("sk-test-anthropic-key");
    });
  });

  describe("stop()", () => {
    it("calls ProcessManager.stop()", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(),
        getLastError: vi.fn(),
        getChild: vi.fn(),
      } as unknown as ProcessManager;

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);
      await adapter.stop();

      expect(mockProcessManager.stop).toHaveBeenCalledOnce();
    });
  });

  describe("status()", () => {
    it("returns unhealthy when process is not running", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
        getLastError: vi.fn().mockReturnValue(null),
        getChild: vi.fn(),
      } as unknown as ProcessManager;

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);
      const status = await adapter.status();

      expect(status).toBe("unhealthy: process not running");
      expect(mockProcessManager.isRunning).toHaveBeenCalledOnce();
    });

    it("returns unhealthy with error message when process failed to start", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockError = new Error("ENOENT: hermes not found");
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
        getLastError: vi.fn().mockReturnValue(mockError),
        getChild: vi.fn(),
      } as unknown as ProcessManager;

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);
      const status = await adapter.status();

      expect(status).toBe("unhealthy: process not running (ENOENT: hermes not found)");
    });

    it("returns healthy when process is running and version check succeeds", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn(),
        getChild: vi.fn(),
      } as unknown as ProcessManager;

      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Hermes Agent v0.21.0 (2026.8.31) · upstream 8dbf07e9",
        stderr: "",
      });

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager, null, undefined, mockExecWithArgs);
      const status = await adapter.status();

      expect(status).toBe("healthy");
      // Should use absolute path to hermes binary for consistency with start()
      const homeDir = os.homedir();
      const expectedBinary = path.join(homeDir, ".local/bin/hermes");
      expect(mockExecWithArgs).toHaveBeenCalledWith(expectedBinary, ["--version"]);
    });

    it("returns unhealthy when version check fails", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn(),
        getChild: vi.fn(),
      } as unknown as ProcessManager;

      const mockExecWithArgs = vi.fn().mockRejectedValue(new Error("command not found"));

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager, null, undefined, mockExecWithArgs);
      const status = await adapter.status();

      expect(status).toContain("unhealthy: command not found");
    });
  });

  describe("sendTask()", () => {
    it("writes task to stdin when process is running", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockStdin = {
        write: vi.fn(),
      };
      const mockChild = {
        stdin: mockStdin,
        stdout: new EventEmitter(),
      };
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(),
        getLastError: vi.fn(),
        getChild: vi.fn().mockReturnValue(mockChild),
      } as unknown as ProcessManager;

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);
      await adapter.sendTask("What is 2+2?");

      expect(mockStdin.write).toHaveBeenCalledWith("What is 2+2?\n");
    });

    it("throws when process is not running", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(),
        getLastError: vi.fn(),
        getChild: vi.fn().mockReturnValue(null),
      } as unknown as ProcessManager;

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);

      await expect(adapter.sendTask("test")).rejects.toThrow(/Process not running/i);
    });
  });

  describe("streamOutput()", () => {
    it("emits tokens from stdout and __TASK_DONE__ at end", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockStdout = new EventEmitter();
      const mockChild = {
        stdin: { write: vi.fn() },
        stdout: mockStdout,
      };
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(),
        getLastError: vi.fn(),
        getChild: vi.fn().mockReturnValue(mockChild),
      } as unknown as ProcessManager;

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);

      const emitted: string[] = [];
      const unsubscribe = adapter.streamOutput((chunk) => emitted.push(chunk));

      // Emit data chunks
      mockStdout.emit("data", Buffer.from("The answer is "));
      mockStdout.emit("data", Buffer.from("4.\n"));
      mockStdout.emit("end");

      expect(emitted).toEqual(["The answer is 4.", "__TASK_DONE__"]);

      unsubscribe();
    });

    it("handles tokens split across chunks (line buffering)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockStdout = new EventEmitter();
      const mockChild = {
        stdin: { write: vi.fn() },
        stdout: mockStdout,
      };
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(),
        getLastError: vi.fn(),
        getChild: vi.fn().mockReturnValue(mockChild),
      } as unknown as ProcessManager;

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);

      const emitted: string[] = [];
      adapter.streamOutput((chunk) => emitted.push(chunk));

      // Emit token split across multiple chunks (cross-chunk boundary)
      mockStdout.emit("data", Buffer.from("First line\nSecond li"));
      mockStdout.emit("data", Buffer.from("ne split\nThird line"));
      mockStdout.emit("data", Buffer.from("\n"));
      mockStdout.emit("end");

      // Verify: no dropped tokens, split token reassembled correctly
      expect(emitted).toEqual([
        "First line",
        "Second line split",
        "Third line",
        "__TASK_DONE__",
      ]);
    });

    it("filters spinner lines with ANCHORED match only", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockStdout = new EventEmitter();
      const mockChild = {
        stdin: { write: vi.fn() },
        stdout: mockStdout,
      };
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(),
        getLastError: vi.fn(),
        getChild: vi.fn().mockReturnValue(mockChild),
      } as unknown as ProcessManager;

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);

      const emitted: string[] = [];
      adapter.streamOutput((chunk) => emitted.push(chunk));

      // Emit spinner line (should be filtered) + real content
      mockStdout.emit("data", Buffer.from("  ⠋ Thinking...\n"));
      mockStdout.emit("data", Buffer.from("Real answer here\n"));
      mockStdout.emit("data", Buffer.from("More content with ⠋ in middle\n"));
      mockStdout.emit("end");

      // Verify: spinner line filtered, but line with spinner in middle kept
      expect(emitted).toEqual([
        "Real answer here",
        "More content with ⠋ in middle",
        "__TASK_DONE__",
      ]);
    });

    it("throws when process is not running", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(),
        getLastError: vi.fn(),
        getChild: vi.fn().mockReturnValue(null),
      } as unknown as ProcessManager;

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);

      expect(() => adapter.streamOutput(() => {})).toThrow(/Process not running/i);
    });
  });

  // ========================================================================
  // TASK 3: Capability methods - listCapabilities/installCapability/restart/detectGap
  // ========================================================================

  describe("listCapabilities()", () => {
    it("parses hermes skills list output and returns ONLY installed skills", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: `
Available skills:
  - claude-code (installed)
  - obsidian (installed)
  - apple-notes (available)
`,
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      const capabilities = await adapter.listCapabilities();

      expect(mockExecWithArgs).toHaveBeenCalledWith("hermes", ["skills", "list"]);
      // IMPORTANT: Only 2 skills returned (installed), NOT 3 (apple-notes is available, not installed)
      expect(capabilities).toHaveLength(2);
      expect(capabilities[0]).toEqual({
        deploymentId: "hermes-local",
        type: "skill",
        name: "claude-code",
        source: "hermes",
      });
      expect(capabilities[1].name).toBe("obsidian");
      // apple-notes is NOT included (it's available but not installed)
    });

    it("returns empty array when no skills found", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Available skills:\n",
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      const capabilities = await adapter.listCapabilities();

      expect(capabilities).toEqual([]);
    });
  });

  describe("installCapability()", () => {
    it("installs a skill with validated name", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Skill installed successfully",
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      await adapter.installCapability({ type: "skill", name: "test-skill" });

      expect(mockExecWithArgs).toHaveBeenCalledWith("hermes", [
        "skills",
        "install",
        "test-skill",
      ]);
    });

    it("rejects malicious names with shell metacharacters", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

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
        adapter.installCapability({ type: "skill", name: "skill`whoami`" })
      ).rejects.toThrow(/Invalid capability name/);

      await expect(
        adapter.installCapability({ type: "skill", name: "skill$(whoami)" })
      ).rejects.toThrow(/Invalid capability name/);
    });

    it("accepts safe names with allowed characters", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      // Valid patterns from real hermes skills
      await adapter.installCapability({ type: "skill", name: "claude-code" });
      await adapter.installCapability({ type: "skill", name: "@scope/skill-name" });
      await adapter.installCapability({ type: "skill", name: "skill_underscore" });
      await adapter.installCapability({ type: "skill", name: "skill.dot" });

      expect(mockExecWithArgs).toHaveBeenCalledTimes(4);
    });

    it("throws clear error for unsupported MCP installation", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(
        adapter.installCapability({ type: "mcp", name: "test-mcp" })
      ).rejects.toThrow(/MCP server installation requires manual/);
    });

    it("throws for unsupported capability type", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(
        adapter.installCapability({ type: "unknown" as any, name: "test" })
      ).rejects.toThrow(/Unsupported capability type/);
    });
  });

  describe("requiresRestartAfterInstall()", () => {
    it("returns true (conservative choice due to uncertainty)", () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Per verified doc: restart behavior is unknown/untested
      // Conservative choice: require restart to ensure capabilities load
      expect(adapter.requiresRestartAfterInstall()).toBe(true);
    });
  });

  describe("restart()", () => {
    it("calls stop then start in sequence", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const callOrder: string[] = [];
      const mockProcessManager = {
        start: vi.fn(() => callOrder.push("start")),
        stop: vi.fn(async () => callOrder.push("stop")),
        isRunning: vi.fn(),
        getLastError: vi.fn(),
        getChild: vi.fn(),
      } as unknown as ProcessManager;

      const backend: ModelBackendConfig = {
        id: "ollama-local",
        kind: "ollama",
        provider: "ollama",
        baseUrl: "http://localhost:11434/v1",
        protocol: "v1/chat/completions",
        model: "llama3.2:3b",
        secretRef: null,
      };

      adapter = new HermesAdapter(tempDir, mockProbe, mockProcessManager);
      await adapter.configure(backend);
      await adapter.restart();

      expect(callOrder).toEqual(["stop", "start"]);
      expect(mockProcessManager.stop).toHaveBeenCalledOnce();
      expect(mockProcessManager.start).toHaveBeenCalledOnce();
    });
  });

  describe("removeCapability()", () => {
    it("removeCapability uninstalls skill/mcp/plugin via the verified hermes CLIs", async () => {
      const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
      const a = new HermesAdapter(undefined, undefined, undefined, undefined, undefined, exec);
      expect(await a.removeCapability({ type: "skill", name: "web-search" })).toEqual({ frameworkRemoved: true });
      expect(exec).toHaveBeenCalledWith("hermes", ["skills", "uninstall", "--yes", "web-search"]);
      await a.removeCapability({ type: "mcp", name: "fs" });
      expect(exec).toHaveBeenCalledWith("hermes", ["mcp", "remove", "fs"]);
      await a.removeCapability({ type: "plugin", name: "p1" });
      expect(exec).toHaveBeenCalledWith("hermes", ["plugins", "remove", "p1"]);
    });
    it("removeCapability rejects an injection-y name", async () => {
      const a = new HermesAdapter(undefined, undefined, undefined, undefined, undefined, vi.fn());
      await expect(a.removeCapability({ type: "skill", name: "a; rm -rf /" })).rejects.toThrow();
    });
  });

  describe("detectGap()", () => {
    it("detects missing skill referenced with @skill-name", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: `
Available skills:
  - claude-code (installed)
`,
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      const gap = await adapter.detectGap("Please use @obsidian to create a note");

      expect(gap).toEqual({ type: "skill", name: "obsidian" });
    });

    it("returns null when skill is available", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: `
Available skills:
  - claude-code (installed)
  - obsidian (installed)
`,
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      const gap = await adapter.detectGap("Please use @obsidian to create a note");

      expect(gap).toBeNull();
    });

    it("returns null when no capability references found", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Available skills:\n",
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      const gap = await adapter.detectGap("Just a regular task with no skills");

      expect(gap).toBeNull();
    });

    it("detects gap for available-but-not-installed skill (CRITICAL)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: `
Available skills:
  - claude-code (installed)
  - obsidian (available)
`,
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      // obsidian is available but NOT installed → should be detected as gap
      const gap = await adapter.detectGap("Please use @obsidian to create a note");

      expect(gap).toEqual({ type: "skill", name: "obsidian" });
    });

    it("detects scoped skill names like @scope/skill-name", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: `
Available skills:
  - claude-code (installed)
`,
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      const gap = await adapter.detectGap("Use @scope/custom-skill for this");

      expect(gap).toEqual({ type: "skill", name: "scope/custom-skill" });
    });
  });

  // ========================================================================
  // TASK 3: Channel methods - configureChannel/verifyChannel/removeChannel/listChannels
  // ========================================================================

  describe("configureChannel()", () => {
    it("writes platforms.telegram.enabled in config.yaml AND secret to .env", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await adapter.configureChannel({
        id: "telegram",
        config: {},
        secrets: { botToken: "xoxb-test-telegram-token" },
      });

      // Verify config.yaml has platforms.telegram.enabled: true
      const configContent = await fs.readFile(configPath, "utf-8");
      expect(configContent).toContain("platforms:");
      expect(configContent).toContain("telegram:");
      expect(configContent).toContain("enabled: true");

      // Verify .env has TELEGRAM_BOT_TOKEN (secret not in config)
      const envPath = path.join(tempDir, ".env");
      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("TELEGRAM_BOT_TOKEN=xoxb-test-telegram-token");

      // Verify secret NOT in config.yaml
      expect(configContent).not.toContain("xoxb-test-telegram-token");
    });

    it("preserves existing config.yaml content (deep-merge)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Write initial config with model section
      const initialConfig = `model:
  default: "llama3.2:3b"
  provider: "ollama"
  base_url: "http://localhost:11434/v1"
`;
      await fs.writeFile(configPath, initialConfig, "utf-8");

      // Add telegram channel
      await adapter.configureChannel({
        id: "telegram",
        config: {},
        secrets: { botToken: "test-token" },
      });

      const configContent = await fs.readFile(configPath, "utf-8");

      // Verify model section is preserved
      expect(configContent).toContain('default: "llama3.2:3b"');
      expect(configContent).toContain('provider: "ollama"');
      expect(configContent).toContain('base_url: "http://localhost:11434/v1"');

      // Verify platforms section added
      expect(configContent).toContain("platforms:");
      expect(configContent).toContain("telegram:");
      expect(configContent).toContain("enabled: true");
    });

    it("merges into existing .env without clobbering other vars", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Write initial .env with existing var
      const envPath = path.join(tempDir, ".env");
      await fs.writeFile(envPath, "ANTHROPIC_API_KEY=sk-existing\n", "utf-8");

      // Add telegram channel
      await adapter.configureChannel({
        id: "telegram",
        config: {},
        secrets: { botToken: "test-token" },
      });

      const envContent = await fs.readFile(envPath, "utf-8");

      // Verify existing var preserved
      expect(envContent).toContain("ANTHROPIC_API_KEY=sk-existing");

      // Verify new var added
      expect(envContent).toContain("TELEGRAM_BOT_TOKEN=test-token");
    });

    it("validates channel id to prevent injection", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await expect(
        adapter.configureChannel({
          id: "telegram; rm -rf /",
          config: {},
          secrets: { botToken: "test" },
        })
      ).rejects.toThrow(/Invalid channel/);
    });

    it("never logs secret values", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const consoleSpy = vi.spyOn(console, "log");
      const consoleErrorSpy = vi.spyOn(console, "error");

      adapter = new HermesAdapter(tempDir, mockProbe);

      await adapter.configureChannel({
        id: "telegram",
        config: {},
        secrets: { botToken: "secret-token-12345" },
      });

      // Verify secret never logged
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("secret-token-12345")
      );
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("secret-token-12345")
      );

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("configures slack with multiple env vars", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      await adapter.configureChannel({
        id: "slack",
        config: {},
        secrets: {
          botToken: "xoxb-slack-bot",
          appToken: "xapp-slack-app",
          signingSecret: "slack-signing-secret",
        },
      });

      // Verify config has platforms.slack.enabled
      const configContent = await fs.readFile(configPath, "utf-8");
      expect(configContent).toContain("slack:");
      expect(configContent).toContain("enabled: true");

      // Verify .env has all three tokens
      const envPath = path.join(tempDir, ".env");
      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("SLACK_BOT_TOKEN=xoxb-slack-bot");
      expect(envContent).toContain("SLACK_APP_TOKEN=xapp-slack-app");
      expect(envContent).toContain("SLACK_SIGNING_SECRET=slack-signing-secret");
    });

    it("rejects secret values containing newlines (prevent env injection)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Test \n injection attempt
      await expect(
        adapter.configureChannel({
          id: "telegram",
          config: {},
          secrets: { botToken: "valid-token\nMALICIOUS_KEY=evil" },
        })
      ).rejects.toThrow(/must not contain newlines/);

      // Test \r injection attempt
      await expect(
        adapter.configureChannel({
          id: "telegram",
          config: {},
          secrets: { botToken: "valid-token\rMALICIOUS_KEY=evil" },
        })
      ).rejects.toThrow(/must not contain newlines/);

      // Verify .env was not written/corrupted
      const envPath = path.join(tempDir, ".env");
      try {
        await fs.readFile(envPath, "utf-8");
        // If file exists, it should not contain the malicious content
        const envContent = await fs.readFile(envPath, "utf-8");
        expect(envContent).not.toContain("MALICIOUS_KEY");
      } catch (error: any) {
        // File doesn't exist is also acceptable (rejected before write)
        expect(error.code).toBe("ENOENT");
      }
    });
  });

  describe("verifyChannel()", () => {
    it("parses gateway status and returns connected:true when running", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: `Gateways:
  ✓ default (current)        — running (pid 12345)
`,
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      const result = await adapter.verifyChannel("telegram");

      expect(mockExecWithArgs).toHaveBeenCalledWith("hermes", ["gateway", "status"]);
      expect(result.connected).toBe(true);
      expect(result.detail).toContain("running");
    });

    it("returns connected:false when gateway not running (no throw)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: `Gateways:
  ✗ default (current)        — not running
`,
        stderr: "",
      });

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      const result = await adapter.verifyChannel("telegram");

      expect(result.connected).toBe(false);
      expect(result.detail).toContain("not running");
    });

    it("returns connected:false on exec failure (no throw)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockExecWithArgs = vi
        .fn()
        .mockRejectedValue(new Error("hermes command not found"));

      adapter = new HermesAdapter(
        tempDir,
        mockProbe,
        undefined,
        null,
        undefined,
        mockExecWithArgs
      );

      const result = await adapter.verifyChannel("telegram");

      expect(result.connected).toBe(false);
      expect(result.detail).toContain("not found");
    });
  });

  describe("removeChannel()", () => {
    it("sets platforms.<id>.enabled to false in config.yaml", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Setup: create config with enabled telegram
      const initialConfig = `platforms:
  telegram:
    enabled: true
`;
      await fs.writeFile(configPath, initialConfig, "utf-8");

      // Remove telegram
      const result = await adapter.removeChannel("telegram");

      expect(result.removed).toBe(true);

      // Verify enabled set to false
      const configContent = await fs.readFile(configPath, "utf-8");
      expect(configContent).toContain("telegram:");
      expect(configContent).toContain("enabled: false");
      expect(configContent).not.toContain("enabled: true");
    });

    it("preserves other platforms when removing one", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Setup: config with telegram and slack
      const initialConfig = `platforms:
  telegram:
    enabled: true
  slack:
    enabled: true
`;
      await fs.writeFile(configPath, initialConfig, "utf-8");

      // Remove telegram only
      await adapter.removeChannel("telegram");

      const configContent = await fs.readFile(configPath, "utf-8");

      // Telegram disabled
      expect(configContent).toContain("telegram:");
      expect(configContent).toMatch(/telegram:[\s\S]*?enabled: false/);

      // Slack still enabled
      expect(configContent).toContain("slack:");
      expect(configContent).toMatch(/slack:[\s\S]*?enabled: true/);
    });
  });

  describe("requiresRestartAfterChannelChange()", () => {
    it("returns true (restart required)", () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      expect(adapter.requiresRestartAfterChannelChange()).toBe(true);
    });
  });

  describe("listChannels()", () => {
    it("parses config.yaml platforms and returns enabled channels", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Setup: config with platforms (telegram, slack) and top-level discord (FIXED: was wrongly under platforms)
      const config = `platforms:
  telegram:
    enabled: true
  slack:
    enabled: false
discord:
  require_mention: true
  auto_thread: false
`;
      await fs.writeFile(configPath, config, "utf-8");

      const channels = await adapter.listChannels();

      expect(channels).toHaveLength(3);
      expect(channels).toContainEqual({ id: "telegram", enabled: true });
      expect(channels).toContainEqual({ id: "slack", enabled: false });
      expect(channels).toContainEqual({ id: "discord", enabled: true });
    });

    it("returns empty array when no platforms configured", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Setup: config without platforms section
      const config = `model:
  default: "llama3.2:3b"
`;
      await fs.writeFile(configPath, config, "utf-8");

      const channels = await adapter.listChannels();

      expect(channels).toEqual([]);
    });

    it("returns empty array when config.yaml does not exist", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // No config file created
      const channels = await adapter.listChannels();

      expect(channels).toEqual([]);
    });

    // Task 3 (Slice 2c): Discord top-level section + listChannels surfaces it
    it("listChannels surfaces top-level discord section (NOT platforms.discord)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Setup: config with platforms.slack AND top-level discord
      const config = `platforms:
  slack:
    enabled: true
discord:
  require_mention: true
  auto_thread: false
`;
      await fs.writeFile(configPath, config, "utf-8");

      const channels = await adapter.listChannels();

      // Should list both slack (platforms) and discord (top-level)
      expect(channels).toHaveLength(2);
      expect(channels).toContainEqual({ id: "slack", enabled: true });
      expect(channels).toContainEqual({ id: "discord", enabled: true });
    });
  });

  // Task 3 (Slice 2c): Discord special handling
  describe("configureChannel() discord top-level", () => {
    it("writes top-level discord section (NOT platforms.discord) + token to .env", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Seed existing config with model and platforms
      const initialConfig = `model:
  default: "llama3.2:3b"
platforms:
  slack:
    enabled: true
`;
      await fs.writeFile(configPath, initialConfig, "utf-8");

      // Configure discord channel
      await adapter.configureChannel({
        id: "discord",
        config: {},
        secrets: { botToken: "discord-bot-token-123" }
      });

      // Verify config has TOP-LEVEL discord section (NOT platforms.discord)
      const configContent = await fs.readFile(configPath, "utf-8");
      expect(configContent).toContain("discord:");
      expect(configContent).toMatch(/^discord:/m); // Top-level (starts at line beginning)
      expect(configContent).toContain("require_mention:");
      expect(configContent).toContain("auto_thread:");
      expect(configContent).toContain("reactions:");

      // Verify platforms section still exists and NOT modified
      expect(configContent).toContain("platforms:");
      expect(configContent).toContain("slack:");
      expect(configContent).toContain("enabled: true");

      // Verify NO platforms.discord (discord should be at top-level, not indented under platforms)
      // Check that discord: appears at line start (top-level), not with 2-space indent (under platforms)
      expect(configContent).not.toMatch(/^  discord:/m);

      // Verify token in .env (NOT in config.yaml)
      const envPath = path.join(tempDir, ".env");
      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("DISCORD_BOT_TOKEN=discord-bot-token-123");

      // Verify token NOT in config.yaml
      expect(configContent).not.toContain("discord-bot-token-123");
    });

    it("configureChannel discord preserves existing discord sub-keys", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Seed config with existing discord section (custom settings)
      const initialConfig = `model:
  default: "llama3.2:3b"
discord:
  require_mention: false
  auto_thread: true
  reactions: true
  free_response_channels: "channel1,channel2"
`;
      await fs.writeFile(configPath, initialConfig, "utf-8");

      // Configure discord again (should preserve existing settings)
      await adapter.configureChannel({
        id: "discord",
        config: {},
        secrets: { botToken: "new-token" }
      });

      const configContent = await fs.readFile(configPath, "utf-8");

      // Verify existing settings preserved
      expect(configContent).toContain("require_mention: false");
      expect(configContent).toContain("auto_thread: true");
      expect(configContent).toContain("reactions: true");
      expect(configContent).toContain("free_response_channels: \"channel1,channel2\"");
    });

    it("configureChannel slack unchanged (uses platforms path)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Configure slack (should use platforms.slack path)
      await adapter.configureChannel({
        id: "slack",
        config: {},
        secrets: {
          botToken: "xoxb-slack",
          appToken: "xapp-slack",
          signingSecret: "slack-secret"
        }
      });

      const configContent = await fs.readFile(configPath, "utf-8");

      // Verify platforms.slack written (NOT top-level slack)
      expect(configContent).toContain("platforms:");
      expect(configContent).toMatch(/platforms:[\s\S]*slack:/);
      expect(configContent).toMatch(/slack:[\s\S]*enabled: true/);

      // Verify env vars
      const envPath = path.join(tempDir, ".env");
      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("SLACK_BOT_TOKEN=xoxb-slack");
      expect(envContent).toContain("SLACK_APP_TOKEN=xapp-slack");
      expect(envContent).toContain("SLACK_SIGNING_SECRET=slack-secret");
    });
  });

  describe("removeChannel() discord top-level", () => {
    it("removeChannel disables top-level discord section (NOT platforms.discord)", async () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new HermesAdapter(tempDir, mockProbe);

      // Setup: config with top-level discord
      const initialConfig = `model:
  default: "llama3.2:3b"
discord:
  require_mention: true
  auto_thread: false
  reactions: true
platforms:
  slack:
    enabled: true
`;
      await fs.writeFile(configPath, initialConfig, "utf-8");

      // Remove discord
      const result = await adapter.removeChannel("discord");

      expect(result.removed).toBe(true);

      const configContent = await fs.readFile(configPath, "utf-8");

      // Verify discord section disabled (set enabled: false) OR removed
      // Implementation can choose either approach; test for enabled: false
      if (configContent.includes("discord:")) {
        expect(configContent).toMatch(/discord:[\s\S]*enabled: false/);
      }

      // Verify platforms.slack still exists and enabled
      expect(configContent).toContain("platforms:");
      expect(configContent).toContain("slack:");
      expect(configContent).toMatch(/slack:[\s\S]*enabled: true/);
    });
  });
});

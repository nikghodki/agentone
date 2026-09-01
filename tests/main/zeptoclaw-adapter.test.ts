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

  describe("start() / stop() / status()", () => {
    it("start() spawns zeptoclaw agent with sandboxed env and API key", async () => {
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
      };

      const mockProbe = vi.fn().mockResolvedValue(true);
      const mockSecrets = {
        get: vi.fn().mockReturnValue("test-api-key-12345"),
      };

      adapter = new ZeptoclawAdapter(tempDir, mockProbe, mockProcessManager as any, mockSecrets as any);

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
      await adapter.start();

      // Verify ProcessManager.start was called with correct args
      expect(mockProcessManager.start).toHaveBeenCalledOnce();
      const [cmd, args, opts] = mockProcessManager.start.mock.calls[0];

      expect(cmd).toBe("zeptoclaw");
      expect(args).toEqual(["agent"]);

      // Verify sandboxed env with EXPLICIT PATH (no host PATH inheritance)
      expect(opts.env).toBeDefined();
      expect(opts.env.PATH).toBe("/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin");
      expect(opts.env.ANTHROPIC_API_KEY).toBe("test-api-key-12345");

      // Verify secrets.get was called with the secretRef
      expect(mockSecrets.get).toHaveBeenCalledWith("anthropic-api-key");
    });

    it("stop() calls ProcessManager.stop()", async () => {
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(true),
      };

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, mockProcessManager as any);

      await adapter.stop();

      expect(mockProcessManager.stop).toHaveBeenCalledOnce();
    });

    it("status() returns healthy when version check succeeds and process is running", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        stdout: "zeptoclaw 0.9.2\n",
        stderr: "",
      });

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getLastError: vi.fn().mockReturnValue(null),
      };

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, mockProcessManager as any, null as any, mockExec);

      const result = await adapter.status();

      expect(result).toBe("healthy");
      expect(mockExec).toHaveBeenCalledWith("zeptoclaw --version");
    });

    it("status() returns error when version check fails", async () => {
      const mockExec = vi.fn().mockRejectedValue(new Error("Command not found"));

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, null as any, null as any, mockExec);

      const result = await adapter.status();

      expect(result).toContain("unhealthy");
    });

    it("status() returns unhealthy when process is not running", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        stdout: "zeptoclaw 0.9.2\n",
        stderr: "",
      });

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
        getLastError: vi.fn().mockReturnValue(null),
      };

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, mockProcessManager as any, null as any, mockExec);

      const result = await adapter.status();

      // Should report unhealthy even though version check would pass
      expect(result).toContain("unhealthy");
      expect(result).toContain("process not running");
      // Version check should NOT have been called (short-circuit on liveness check)
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("status() includes error message when process failed to spawn", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        stdout: "zeptoclaw 0.9.2\n",
        stderr: "",
      });

      const spawnError = new Error("ENOENT: command not found");
      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
        getLastError: vi.fn().mockReturnValue(spawnError),
      };

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, mockProcessManager as any, null as any, mockExec);

      const result = await adapter.status();

      expect(result).toContain("unhealthy");
      expect(result).toContain("process not running");
      expect(result).toContain("ENOENT");
    });
  });

  describe("sendTask() / streamOutput()", () => {
    it("parses token stream with buffering across newline boundaries", async () => {
      const { Readable } = await import("stream");

      // Create a fake child process with stdin/stdout
      const fakeStdout = new Readable({
        read() {},
      });
      const fakeStdin = {
        write: vi.fn(),
        end: vi.fn(),
      };

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getChild: vi.fn().mockReturnValue({
          stdout: fakeStdout,
          stdin: fakeStdin,
        }),
      };

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, mockProcessManager as any);

      // Start streaming
      const lines: string[] = [];
      const unsubscribe = adapter.streamOutput((chunk) => {
        lines.push(chunk);
      });

      // Emit token stream with lines split across chunk boundaries
      // This tests real cross-newline buffering
      fakeStdout.push("Hello wor");        // Partial line
      fakeStdout.push("ld\nHow are");      // Complete first line + partial second
      fakeStdout.push(" you?\n");          // Complete second line
      fakeStdout.push(null);               // End stream

      // Wait for stream to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify both lines were delivered correctly (none dropped, none merged wrong)
      // Plus __TASK_DONE__ marker at end
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe("Hello world");
      expect(lines[1]).toBe("How are you?");
      expect(lines[2]).toBe("__TASK_DONE__");

      // Cleanup
      unsubscribe();
    });

    it("sendTask() writes input to stdin", async () => {
      const fakeStdin = {
        write: vi.fn(),
        end: vi.fn(),
      };

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getChild: vi.fn().mockReturnValue({
          stdin: fakeStdin,
        }),
      };

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, mockProcessManager as any);

      await adapter.sendTask("What is 2+2?");

      expect(fakeStdin.write).toHaveBeenCalledWith("What is 2+2?\n");
    });

    it("streamOutput() filters out spinner animation lines only", async () => {
      const { Readable } = await import("stream");

      const fakeStdout = new Readable({
        read() {},
      });

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getChild: vi.fn().mockReturnValue({
          stdout: fakeStdout,
        }),
      };

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, mockProcessManager as any);

      const lines: string[] = [];
      adapter.streamOutput((chunk) => {
        lines.push(chunk);
      });

      // Emit stream with spinner lines and legitimate content
      fakeStdout.push("  ⠋ Thinking...\n");           // Real spinner - should be filtered
      fakeStdout.push("⠹ Working\n");                 // Real spinner - should be filtered
      fakeStdout.push("The answer is 4\n");           // Legitimate - keep
      fakeStdout.push("I was Thinking about it\n");   // Legitimate (mid-content) - keep
      fakeStdout.push("The result is ⠋ braille\n");  // Legitimate (mid-content) - keep
      fakeStdout.push(null);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify only spinner lines were filtered
      // Plus __TASK_DONE__ marker at end
      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe("The answer is 4");
      expect(lines[1]).toBe("I was Thinking about it");
      expect(lines[2]).toBe("The result is ⠋ braille");
      expect(lines[3]).toBe("__TASK_DONE__");
    });
  });

  describe("capabilities (Task 4)", () => {
    it("listCapabilities() parses zeptoclaw skills list output", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: `Skills:
  - search-duckduckgo (workspace, ready)
  - github-integration (workspace, ready)
  - jira-connector (workspace, ready)`,
        stderr: "",
      });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      const capabilities = await adapter.listCapabilities();

      // Verify exec was called with argument array (no shell parsing)
      expect(mockExecWithArgs).toHaveBeenCalledWith("zeptoclaw", ["skills", "list"]);

      // Verify capabilities were parsed correctly
      expect(capabilities).toHaveLength(3);
      expect(capabilities[0]).toEqual({
        deploymentId: expect.any(String),
        type: "skill",
        name: "search-duckduckgo",
        source: "zeptoclaw",
      });
      expect(capabilities[1]).toEqual({
        deploymentId: expect.any(String),
        type: "skill",
        name: "github-integration",
        source: "zeptoclaw",
      });
      expect(capabilities[2]).toEqual({
        deploymentId: expect.any(String),
        type: "skill",
        name: "jira-connector",
        source: "zeptoclaw",
      });
    });

    it("listCapabilities() returns empty array when no skills installed", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Skills:\n",
        stderr: "",
      });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      const capabilities = await adapter.listCapabilities();

      expect(capabilities).toEqual([]);
    });

    it("installCapability() runs verified install command for skill with arg array", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Skill installed successfully\n",
        stderr: "",
      });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      await adapter.installCapability({ type: "skill", name: "my-skill" });

      // Verify command was called with argument array (no shell parsing)
      expect(mockExecWithArgs).toHaveBeenCalledWith("zeptoclaw", ["skills", "install", "my-skill"]);
    });

    it("installCapability() accepts scoped capability names", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: "Skill installed successfully\n",
        stderr: "",
      });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      // Test various valid scoped/marketplace names
      await adapter.installCapability({ type: "skill", name: "@acme/web-search" });
      await adapter.installCapability({ type: "skill", name: "org.example.skill-name" });
      await adapter.installCapability({ type: "skill", name: "github/user/repo" });

      expect(mockExecWithArgs).toHaveBeenCalledWith("zeptoclaw", ["skills", "install", "@acme/web-search"]);
      expect(mockExecWithArgs).toHaveBeenCalledWith("zeptoclaw", ["skills", "install", "org.example.skill-name"]);
      expect(mockExecWithArgs).toHaveBeenCalledWith("zeptoclaw", ["skills", "install", "github/user/repo"]);
    });

    it("installCapability() rejects malicious names with shell metacharacters", async () => {
      const mockExecWithArgs = vi.fn();
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      // Test various command injection attempts
      await expect(
        adapter.installCapability({ type: "skill", name: "foo; echo pwned" })
      ).rejects.toThrow(/Invalid capability name/);

      await expect(
        adapter.installCapability({ type: "skill", name: "foo && bar" })
      ).rejects.toThrow(/Invalid capability name/);

      await expect(
        adapter.installCapability({ type: "skill", name: "foo | cat /etc/passwd" })
      ).rejects.toThrow(/Invalid capability name/);

      await expect(
        adapter.installCapability({ type: "skill", name: "foo`rm -rf /`" })
      ).rejects.toThrow(/Invalid capability name/);

      await expect(
        adapter.installCapability({ type: "skill", name: "foo$(whoami)" })
      ).rejects.toThrow(/Invalid capability name/);

      await expect(
        adapter.installCapability({ type: "skill", name: "foo\nbar" })
      ).rejects.toThrow(/Invalid capability name/);

      // Verify exec was NEVER called (validation blocked it)
      expect(mockExecWithArgs).not.toHaveBeenCalled();
    });

    it("installCapability() throws for unsupported MCP type", async () => {
      const mockExecWithArgs = vi.fn();
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      await expect(
        adapter.installCapability({ type: "mcp", name: "my-server" })
      ).rejects.toThrow(/MCP server installation not supported/i);

      // Should not have called exec
      expect(mockExecWithArgs).not.toHaveBeenCalled();
    });

    it("requiresRestartAfterInstall() returns false (hot reload)", () => {
      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe);

      expect(adapter.requiresRestartAfterInstall()).toBe(false);
    });

    it("restart() calls stop then start in order", async () => {
      const callOrder: string[] = [];

      const mockProcessManager = {
        start: vi.fn().mockImplementation(() => {
          callOrder.push("start");
        }),
        stop: vi.fn().mockImplementation(() => {
          callOrder.push("stop");
          return Promise.resolve();
        }),
        isRunning: vi.fn().mockReturnValue(true),
      };

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, mockProcessManager as any);

      await adapter.restart();

      // Verify stop was called before start
      expect(callOrder).toEqual(["stop", "start"]);
      expect(mockProcessManager.stop).toHaveBeenCalledOnce();
      expect(mockProcessManager.start).toHaveBeenCalledOnce();
    });
  });

  describe("removeCapability()", () => {
    it("removeCapability returns frameworkRemoved false with a note for every type (no CLI uninstall)", async () => {
      const exec = vi.fn();
      const a = new ZeptoclawAdapter(undefined, undefined, exec);
      for (const type of ["skill", "mcp", "plugin"] as const) {
        const r = await a.removeCapability({ type, name: "x" });
        expect(r.frameworkRemoved).toBe(false);
        expect(r.note).toMatch(/does not support/i);
      }
      expect(exec).not.toHaveBeenCalled();   // never shells out
    });
  });

  describe("gap detection (Phase 2b)", () => {
    it("getDisabledTools() parses [-] lines from tools list", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: `Tools:
  [+] read_file
      Read a file from workspace

  [-] message
      Send proactive messages to channels
      Setup: Configure at least one channel (telegram, slack, discord)

  [-] r8r
      Execute R8r deterministic workflows
      Setup: Set R8R_API_URL env var

  [+] shell
      Execute shell commands`,
        stderr: "",
      });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      const disabled = await (adapter as any).getDisabledTools();

      // Verify exec was called with argument array
      expect(mockExecWithArgs).toHaveBeenCalledWith("zeptoclaw", ["tools", "list"]);

      // Verify only disabled tools were parsed
      expect(disabled).toHaveLength(2);
      expect(disabled).toContain("message");
      expect(disabled).toContain("r8r");
    });

    it("getDisabledTools() returns empty array when all tools enabled", async () => {
      const mockExecWithArgs = vi.fn().mockResolvedValue({
        stdout: `Tools:
  [+] read_file
  [+] shell`,
        stderr: "",
      });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      const disabled = await (adapter as any).getDisabledTools();

      expect(disabled).toEqual([]);
    });

    it("detectGap() returns skill gap when task references absent @skill", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          stdout: `Tools:
  [+] read_file`,
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: `Skills:
  - existing-skill (workspace, ready)`,
          stderr: "",
        });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      const gap = await adapter.detectGap!("Please use @web-search to find latest news");

      expect(gap).toEqual({ type: "skill", name: "web-search" });
    });

    it("detectGap() returns tool gap when task references disabled tool", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          stdout: `Tools:
  [+] read_file
  [-] r8r
      Execute R8r workflows`,
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: `Skills:`,
          stderr: "",
        });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      const gap = await adapter.detectGap!("Execute r8r workflow for deployment");

      expect(gap).toEqual({ type: "mcp", name: "r8r" });
    });

    it("detectGap() returns null when referenced capability is available", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          stdout: `Tools:
  [+] read_file`,
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: `Skills:
  - web-search (workspace, ready)`,
          stderr: "",
        });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      const gap = await adapter.detectGap!("Please use @web-search to find latest news");

      expect(gap).toBeNull();
    });

    it("detectGap() returns null when no capability references found", async () => {
      const mockExecWithArgs = vi.fn()
        .mockResolvedValueOnce({
          stdout: `Tools:
  [+] read_file
  [-] r8r`,
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: `Skills:`,
          stderr: "",
        });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(
        tempDir,
        mockProbe,
        null as any,
        null as any,
        null as any,
        mockExecWithArgs
      );

      const gap = await adapter.detectGap!("What is 2+2?");

      expect(gap).toBeNull();
    });

    it("streamOutput() emits __TASK_DONE__ at end", async () => {
      const { Readable } = await import("stream");

      const fakeStdout = new Readable({
        read() {},
      });

      const mockProcessManager = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        getChild: vi.fn().mockReturnValue({
          stdout: fakeStdout,
        }),
      };

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, mockProcessManager as any);

      const chunks: string[] = [];
      adapter.streamOutput((chunk) => {
        chunks.push(chunk);
      });

      // Emit some output then end
      fakeStdout.push("Task result line 1\n");
      fakeStdout.push("Task result line 2\n");
      fakeStdout.push(null); // End stream

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify output was captured and __TASK_DONE__ was appended
      expect(chunks).toContain("Task result line 1");
      expect(chunks).toContain("Task result line 2");
      expect(chunks).toContain("__TASK_DONE__");
      expect(chunks[chunks.length - 1]).toBe("__TASK_DONE__");
    });
  });
});

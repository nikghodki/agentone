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

      // Verify sandboxed env with API key
      expect(opts.env).toBeDefined();
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

    it("status() returns healthy when version check succeeds", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        stdout: "zeptoclaw 0.9.2\n",
        stderr: "",
      });

      const mockProbe = vi.fn().mockResolvedValue(true);
      adapter = new ZeptoclawAdapter(tempDir, mockProbe, null as any, null as any, mockExec);

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
  });

  describe("sendTask() / streamOutput()", () => {
    it("parses token stream with buffering, including split tokens", async () => {
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
      const tokens: string[] = [];
      const unsubscribe = adapter.streamOutput((chunk) => {
        tokens.push(chunk);
      });

      // Emit token stream with one token split across two chunks
      // This tests the buffering logic
      fakeStdout.push("Hello ");
      fakeStdout.push("wor");  // Split "world" across chunks
      fakeStdout.push("ld!");
      fakeStdout.push(null);  // End stream

      // Wait for stream to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify tokens were received in order
      expect(tokens.join("")).toBe("Hello world!");

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

    it("streamOutput() filters out spinner animation", async () => {
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

      const tokens: string[] = [];
      adapter.streamOutput((chunk) => {
        tokens.push(chunk);
      });

      // Emit stream with spinner (should be filtered)
      fakeStdout.push("  ⠋ Thinking...");
      fakeStdout.push("\rThe answer is 4");
      fakeStdout.push(null);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify spinner was filtered out
      const output = tokens.join("");
      expect(output).not.toContain("⠋");
      expect(output).not.toContain("Thinking");
      expect(output).toContain("The answer is 4");
    });
  });
});

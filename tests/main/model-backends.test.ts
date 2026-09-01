import { describe, it, expect, beforeEach } from "vitest";
import type { ChatMessage, ModelBackendConfig } from "../../src/shared/v2-types";
import { ReadableStream } from "stream/web";

// We'll import the backend once it's implemented
// For now, we'll define a type to work against
type OpenAICompatibleBackend = {
  chat(messages: ChatMessage[], onToken: (t: string) => void): Promise<string>;
};

// Helper to create a fake SSE ReadableStream
function createSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

// Helper to create a fake fetch that returns SSE data
function createFakeFetch(chunks: string[], ok: boolean = true, statusText: string = "OK") {
  return async (_url: string, _options?: RequestInit): Promise<Response> => {
    return {
      ok,
      statusText,
      body: createSSEStream(chunks),
    } as Response;
  };
}

describe("OpenAICompatibleBackend", () => {
  let BackendClass: new (config: ModelBackendConfig, apiKey: string | null, fetchFn?: typeof fetch) => OpenAICompatibleBackend;

  beforeEach(async () => {
    // Dynamic import to ensure the module is loaded fresh
    const module = await import("../../src/main/model-backends/openai-compatible");
    BackendClass = (module as any).OpenAICompatibleBackend;
  });

  it("should accumulate tokens in order and call onToken per delta", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n',
      'data: {"choices":[{"delta":{"content":"!"}}]}\n',
      'data: [DONE]\n',
    ];

    const fakeFetch = createFakeFetch(chunks);
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "ollama",
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      protocol: "v1/chat/completions",
      model: "llama2",
      secretRef: null,
    };

    const backend = new BackendClass(config, null, fakeFetch as any);

    const tokens: string[] = [];
    const result = await backend.chat(
      [{ role: "user", content: "test" }],
      (token) => tokens.push(token)
    );

    expect(tokens).toEqual(["Hello", " world", "!"]);
    expect(result).toBe("Hello world!");
  });

  it("should handle JSON split across chunk boundaries", async () => {
    // This is the CRITICAL test: a JSON object split mid-object across two chunks
    const chunks = [
      'data: {"choices":[{"delta":{"conte',  // Split in the middle of "content"
      'nt":"First"}}]}\n',
      'data: {"choices":[{"delta":{"content":" second"}}]}\n',
      'data: [DONE]\n',
    ];

    const fakeFetch = createFakeFetch(chunks);
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "ollama",
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      protocol: "v1/chat/completions",
      model: "llama2",
      secretRef: null,
    };

    const backend = new BackendClass(config, null, fakeFetch as any);

    const tokens: string[] = [];
    const result = await backend.chat(
      [{ role: "user", content: "test" }],
      (token) => tokens.push(token)
    );

    expect(tokens).toEqual(["First", " second"]);
    expect(result).toBe("First second");
  });

  it("should handle multiple complete lines in a single chunk", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"A"}}]}\ndata: {"choices":[{"delta":{"content":"B"}}]}\n',
      'data: {"choices":[{"delta":{"content":"C"}}]}\n',
      'data: [DONE]\n',
    ];

    const fakeFetch = createFakeFetch(chunks);
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "ollama",
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      protocol: "v1/chat/completions",
      model: "llama2",
      secretRef: null,
    };

    const backend = new BackendClass(config, null, fakeFetch as any);

    const tokens: string[] = [];
    const result = await backend.chat(
      [{ role: "user", content: "test" }],
      (token) => tokens.push(token)
    );

    expect(tokens).toEqual(["A", "B", "C"]);
    expect(result).toBe("ABC");
  });

  it("should handle empty delta content", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{}}]}\n',
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
      'data: {"choices":[{"delta":{"content":""}}]}\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n',
      'data: [DONE]\n',
    ];

    const fakeFetch = createFakeFetch(chunks);
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "ollama",
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      protocol: "v1/chat/completions",
      model: "llama2",
      secretRef: null,
    };

    const backend = new BackendClass(config, null, fakeFetch as any);

    const tokens: string[] = [];
    const result = await backend.chat(
      [{ role: "user", content: "test" }],
      (token) => tokens.push(token)
    );

    expect(tokens).toEqual(["Hello", " world"]);
    expect(result).toBe("Hello world");
  });

  it("should throw an error on non-ok response", async () => {
    const fakeFetch = createFakeFetch([], false, "Internal Server Error");
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "ollama",
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      protocol: "v1/chat/completions",
      model: "llama2",
      secretRef: null,
    };

    const backend = new BackendClass(config, null, fakeFetch as any);

    await expect(
      backend.chat([{ role: "user", content: "test" }], () => {})
    ).rejects.toThrow("Internal Server Error");
  });

  it("should handle a line split across three chunks", async () => {
    // Even more extreme: split across three chunks
    const chunks = [
      'data: {"choices":[{"del',
      'ta":{"content":"Sp',
      'lit"}}]}\n',
      'data: [DONE]\n',
    ];

    const fakeFetch = createFakeFetch(chunks);
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "ollama",
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      protocol: "v1/chat/completions",
      model: "llama2",
      secretRef: null,
    };

    const backend = new BackendClass(config, null, fakeFetch as any);

    const tokens: string[] = [];
    const result = await backend.chat(
      [{ role: "user", content: "test" }],
      (token) => tokens.push(token)
    );

    expect(tokens).toEqual(["Split"]);
    expect(result).toBe("Split");
  });
});

describe("AnthropicMessagesBackend", () => {
  let BackendClass: new (config: ModelBackendConfig, apiKey: string | null, fetchFn?: typeof fetch) => any;

  beforeEach(async () => {
    const module = await import("../../src/main/model-backends/anthropic-messages");
    BackendClass = (module as any).AnthropicMessagesBackend;
  });

  it("should accumulate tokens in order from content_block_delta events", async () => {
    const chunks = [
      'event: message_start\ndata: {"type":"message_start"}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":" world"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"!"}}\n\n',
      'event: content_block_stop\ndata: {"type":"content_block_stop"}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];

    const fakeFetch = createFakeFetch(chunks);
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "cloud",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      protocol: "v1/messages",
      model: "claude-3-sonnet-20240229",
      secretRef: "anthropic-key",
    };

    const backend = new BackendClass(config, "sk-ant-test-key", fakeFetch as any);

    const tokens: string[] = [];
    const result = await backend.chat(
      [{ role: "user", content: "test" }],
      (token) => tokens.push(token)
    );

    expect(tokens).toEqual(["Hello", " world", "!"]);
    expect(result).toBe("Hello world!");
  });

  it("should handle events split across chunk boundaries", async () => {
    const chunks = [
      'event: content_block_delta\ndata: {"type":"content_block_del',
      'ta","delta":{"text":"First"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":" second"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];

    const fakeFetch = createFakeFetch(chunks);
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "cloud",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      protocol: "v1/messages",
      model: "claude-3-sonnet-20240229",
      secretRef: "anthropic-key",
    };

    const backend = new BackendClass(config, "sk-ant-test-key", fakeFetch as any);

    const tokens: string[] = [];
    const result = await backend.chat(
      [{ role: "user", content: "test" }],
      (token) => tokens.push(token)
    );

    expect(tokens).toEqual(["First", " second"]);
    expect(result).toBe("First second");
  });

  it("should send x-api-key header", async () => {
    const chunks = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"OK"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];

    let capturedHeaders: any = null;
    const fakeFetch = async (_url: string, options?: RequestInit): Promise<Response> => {
      capturedHeaders = options?.headers;
      return {
        ok: true,
        statusText: "OK",
        body: createSSEStream(chunks),
      } as Response;
    };

    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "cloud",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      protocol: "v1/messages",
      model: "claude-3-sonnet-20240229",
      secretRef: "anthropic-key",
    };

    const backend = new BackendClass(config, "sk-ant-real-key", fakeFetch as any);

    await backend.chat([{ role: "user", content: "test" }], () => {});

    expect(capturedHeaders).toHaveProperty("x-api-key", "sk-ant-real-key");
    expect(capturedHeaders).toHaveProperty("anthropic-version", "2023-06-01");
  });

  it("should throw an error on non-ok response", async () => {
    const fakeFetch = createFakeFetch([], false, "Unauthorized");
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "cloud",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      protocol: "v1/messages",
      model: "claude-3-sonnet-20240229",
      secretRef: "anthropic-key",
    };

    const backend = new BackendClass(config, "sk-ant-test-key", fakeFetch as any);

    await expect(
      backend.chat([{ role: "user", content: "test" }], () => {})
    ).rejects.toThrow("Unauthorized");
  });
});

describe("AzureOpenAIBackend", () => {
  let BackendClass: new (config: ModelBackendConfig, apiKey: string | null, fetchFn?: typeof fetch) => any;

  beforeEach(async () => {
    const module = await import("../../src/main/model-backends/azure-openai");
    BackendClass = (module as any).AzureOpenAIBackend;
  });

  it("Azure backend builds deployment URL with api-version and uses api-key header", async () => {
    const calls: any[] = [];
    const fakeFetch = async (url: string, opts: any) => { calls.push({ url, opts }); return { ok: true, body: createSSEStream(['data: {"choices":[{"delta":{"content":"hi"}}]}\n\n', "data: [DONE]\n\n"]) } as any; };
    const cfg = { id: "a", kind: "cloud", provider: "azure", baseUrl: null, protocol: "v1/chat/completions", model: "gpt-4o",
      secretRef: "backend:a", extra: { resourceUrl: "https://r.openai.azure.com", deployment: "gpt4o", apiVersion: "2024-06-01" } };
    const backend = new BackendClass(cfg as any, "AZKEY", fakeFetch as any);
    const out = await backend.chat([{ role: "user", content: "yo" }], () => {});
    expect(calls[0].url).toBe("https://r.openai.azure.com/openai/deployments/gpt4o/chat/completions?api-version=2024-06-01");
    expect(calls[0].opts.headers["api-key"]).toBe("AZKEY");
    expect(calls[0].opts.headers["Authorization"]).toBeUndefined();
    expect(out).toBe("hi");
  });

  it("Azure backend throws clear error when extra config is missing required fields", async () => {
    const fakeFetch = async () => ({ ok: true, body: null } as any);

    // Missing extra entirely
    const cfg1 = { id: "a", provider: "azure", protocol: "v1/chat/completions", model: "gpt-4o" };
    await expect(async () => {
      const backend = new BackendClass(cfg1 as any, "key", fakeFetch as any);
      await backend.chat([{ role: "user", content: "test" }], () => {});
    }).rejects.toThrow("Azure backend requires extra.resourceUrl, extra.deployment, and extra.apiVersion");

    // Missing deployment
    const cfg2 = { id: "a", provider: "azure", extra: { resourceUrl: "https://r", apiVersion: "v" } };
    await expect(async () => {
      const backend = new BackendClass(cfg2 as any, "key", fakeFetch as any);
      await backend.chat([{ role: "user", content: "test" }], () => {});
    }).rejects.toThrow("Azure backend requires extra.resourceUrl, extra.deployment, and extra.apiVersion");
  });
});

describe("createBackend", () => {
  let createBackend: any;
  let mockSecrets: any;

  beforeEach(async () => {
    const module = await import("../../src/main/model-backends/index");
    createBackend = module.createBackend;

    // Mock Secrets
    mockSecrets = {
      get: (ref: string) => {
        if (ref === "anthropic-key") return "sk-ant-resolved";
        if (ref === "openai-key") return "sk-openai-resolved";
        return null;
      },
    };
  });

  it("should return AnthropicMessagesBackend for v1/messages protocol", async () => {
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "cloud",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      protocol: "v1/messages",
      model: "claude-3-sonnet-20240229",
      secretRef: "anthropic-key",
    };

    const mockFetch = async () => ({ ok: true, body: null } as any);
    const backend = createBackend(config, mockSecrets, mockFetch as any);

    expect(backend.constructor.name).toBe("AnthropicMessagesBackend");
  });

  it("should return OpenAICompatibleBackend for v1/chat/completions protocol", async () => {
    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "ollama",
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      protocol: "v1/chat/completions",
      model: "llama2",
      secretRef: "openai-key",
    };

    const mockFetch = async () => ({ ok: true, body: null } as any);
    const backend = createBackend(config, mockSecrets, mockFetch as any);

    expect(backend.constructor.name).toBe("OpenAICompatibleBackend");
  });

  it("should resolve Anthropic API key via Secrets and inject x-api-key header (E2E)", async () => {
    const chunks = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"OK"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];

    let capturedHeaders: any = null;
    const fakeFetch = async (_url: string, options?: RequestInit): Promise<Response> => {
      capturedHeaders = options?.headers;
      return {
        ok: true,
        statusText: "OK",
        body: createSSEStream(chunks),
      } as Response;
    };

    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "cloud",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      protocol: "v1/messages",
      model: "claude-3-sonnet-20240229",
      secretRef: "anthropic-key", // mockSecrets.get("anthropic-key") returns "sk-ant-resolved"
    };

    // Real end-to-end test: createBackend resolves key, backend uses it
    const backend = createBackend(config, mockSecrets, fakeFetch as any);

    await backend.chat([{ role: "user", content: "test" }], () => {});

    expect(capturedHeaders).toHaveProperty("x-api-key", "sk-ant-resolved");
  });

  it("should resolve OpenAI API key via Secrets and inject Authorization header (E2E)", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"OK"}}]}\n',
      'data: [DONE]\n',
    ];

    let capturedHeaders: any = null;
    const fakeFetch = async (_url: string, options?: RequestInit): Promise<Response> => {
      capturedHeaders = options?.headers;
      return {
        ok: true,
        statusText: "OK",
        body: createSSEStream(chunks),
      } as Response;
    };

    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "cloud",
      provider: "openai",
      baseUrl: "https://api.openai.com",
      protocol: "v1/chat/completions",
      model: "gpt-4",
      secretRef: "openai-key", // mockSecrets.get("openai-key") returns "sk-openai-resolved"
    };

    const backend = createBackend(config, mockSecrets, fakeFetch as any);

    await backend.chat([{ role: "user", content: "test" }], () => {});

    expect(capturedHeaders).toHaveProperty("Authorization", "Bearer sk-openai-resolved");
  });

  it("should send NO auth headers when secretRef is null (local backends)", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"OK"}}]}\n',
      'data: [DONE]\n',
    ];

    let capturedHeaders: any = null;
    const fakeFetch = async (_url: string, options?: RequestInit): Promise<Response> => {
      capturedHeaders = options?.headers;
      return {
        ok: true,
        statusText: "OK",
        body: createSSEStream(chunks),
      } as Response;
    };

    const config: ModelBackendConfig = {
      id: "test-backend",
      kind: "ollama",
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      protocol: "v1/chat/completions",
      model: "llama2",
      secretRef: null,
    };

    const backend = createBackend(config, mockSecrets, fakeFetch as any);

    await backend.chat([{ role: "user", content: "test" }], () => {});

    expect(capturedHeaders).not.toHaveProperty("Authorization");
    expect(capturedHeaders).not.toHaveProperty("x-api-key");
  });

  it("createBackend routes provider=azure to AzureOpenAIBackend and provider=openrouter to OpenAI-compatible", async () => {
    const { AzureOpenAIBackend } = await import("../../src/main/model-backends/azure-openai");
    const { OpenAICompatibleBackend } = await import("../../src/main/model-backends/openai-compatible");

    const secrets = { get: () => "k" } as any;
    const mockFetch = async () => ({ ok: true, body: null } as any);
    const azure = createBackend({ provider: "azure", protocol: "v1/chat/completions", extra: { resourceUrl: "https://r", deployment: "d", apiVersion: "v" } } as any, secrets, mockFetch as any);
    expect(azure).toBeInstanceOf(AzureOpenAIBackend);
    const or = createBackend({ provider: "openrouter", protocol: "v1/chat/completions", baseUrl: "https://openrouter.ai/api" } as any, secrets, mockFetch as any);
    expect(or).toBeInstanceOf(OpenAICompatibleBackend);
  });
});

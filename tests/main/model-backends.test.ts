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
  let BackendClass: new (config: ModelBackendConfig, fetchFn?: typeof fetch) => OpenAICompatibleBackend;

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

    const backend = new BackendClass(config, fakeFetch as any);

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

    const backend = new BackendClass(config, fakeFetch as any);

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

    const backend = new BackendClass(config, fakeFetch as any);

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

    const backend = new BackendClass(config, fakeFetch as any);

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

    const backend = new BackendClass(config, fakeFetch as any);

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

    const backend = new BackendClass(config, fakeFetch as any);

    const tokens: string[] = [];
    const result = await backend.chat(
      [{ role: "user", content: "test" }],
      (token) => tokens.push(token)
    );

    expect(tokens).toEqual(["Split"]);
    expect(result).toBe("Split");
  });
});

import type { ModelBackend, ChatMessage, ModelBackendConfig } from "../../shared/v2-types";

/**
 * Parses an SSE stream from OpenAI-compatible endpoints.
 * Handles chunk boundaries, accumulates tokens, and returns the full response.
 *
 * @param body - ReadableStream from the fetch response
 * @param onToken - Callback for each token delta
 * @returns Promise that resolves to the full accumulated response
 */
export async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onToken: (token: string) => void
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // Flush any remaining multibyte characters
      buffer += decoder.decode();
      break;
    }

    // Append new chunk to buffer
    buffer += decoder.decode(value, { stream: true });

    // Split on newlines
    const lines = buffer.split("\n");

    // Keep the last (potentially incomplete) line in buffer
    buffer = lines.pop() || "";

    // Process complete lines
    for (const line of lines) {
      if (!line.trim()) continue;

      // SSE format: "data: {json}" or "data: [DONE]"
      if (!line.startsWith("data: ")) continue;

      const dataContent = line.slice(6); // Remove "data: " prefix

      // Ignore the [DONE] sentinel
      if (dataContent === "[DONE]") continue;

      try {
        const data = JSON.parse(dataContent);
        const content = data.choices?.[0]?.delta?.content;

        if (content) {
          fullResponse += content;
          onToken(content);
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  // Process any remaining buffer after stream ends
  if (buffer.trim()) {
    if (buffer.startsWith("data: ")) {
      const dataContent = buffer.slice(6);
      if (dataContent !== "[DONE]") {
        try {
          const data = JSON.parse(dataContent);
          const content = data.choices?.[0]?.delta?.content;

          if (content) {
            fullResponse += content;
            onToken(content);
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  return fullResponse;
}

/**
 * OpenAI-compatible backend for /v1/chat/completions streaming.
 * Supports: Ollama, llama.cpp, vLLM, OpenAI, OpenRouter, Azure.
 *
 * SSE format:
 * - Lines: `data: {json}`
 * - Sentinel: `data: [DONE]`
 * - Delta path: `choices[0].delta.content`
 */
export class OpenAICompatibleBackend implements ModelBackend {
  private config: ModelBackendConfig;
  private apiKey: string | null;
  private fetchFn: typeof fetch;

  constructor(config: ModelBackendConfig, apiKey: string | null, fetchFn?: typeof fetch) {
    this.config = config;
    this.apiKey = apiKey;
    this.fetchFn = fetchFn || fetch;
  }

  async chat(messages: ChatMessage[], onToken: (t: string) => void): Promise<string> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { "Authorization": `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Chat request failed: ${response.status} ${response.statusText}`);
    }

    return parseSSEStream(response.body, onToken);
  }
}

import type { ModelBackend, ChatMessage, ModelBackendConfig } from "../../shared/v2-types";

/**
 * Anthropic Messages API backend for /v1/messages streaming.
 *
 * SSE format:
 * - Event lines: `event: content_block_delta`
 * - Data lines: `data: {json}`
 * - Delta path: `delta.text`
 * - Sentinel: `event: message_stop`
 */
export class AnthropicMessagesBackend implements ModelBackend {
  private config: ModelBackendConfig;
  private apiKey: string | null;
  private fetchFn: typeof fetch;

  constructor(config: ModelBackendConfig, apiKey: string | null, fetchFn?: typeof fetch) {
    this.config = config;
    this.apiKey = apiKey;
    this.fetchFn = fetchFn || fetch;
  }

  async chat(messages: ChatMessage[], onToken: (t: string) => void): Promise<string> {
    const url = `${this.config.baseUrl}/v1/messages`;

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Chat request failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let buffer = "";
    let currentEvent = ""; // Track current event across chunks

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Append new chunk to buffer
      buffer += decoder.decode(value, { stream: true });

      // Split on newlines
      const lines = buffer.split("\n");

      // Keep the last (potentially incomplete) line in buffer
      buffer = lines.pop() || "";

      // Process complete lines
      for (const line of lines) {
        if (!line.trim()) continue;

        // SSE format: "event: <type>" or "data: {json}"
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7); // Remove "event: " prefix
        } else if (line.startsWith("data: ")) {
          const dataContent = line.slice(6); // Remove "data: " prefix

          // Only process content_block_delta events
          if (currentEvent === "content_block_delta") {
            try {
              const data = JSON.parse(dataContent);
              const text = data.delta?.text;

              if (text) {
                fullResponse += text;
                onToken(text);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }
    }

    // Process any remaining buffer after stream ends
    if (buffer.trim()) {
      const lines = buffer.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
        } else if (line.startsWith("data: ")) {
          const dataContent = line.slice(6);

          if (currentEvent === "content_block_delta") {
            try {
              const data = JSON.parse(dataContent);
              const text = data.delta?.text;

              if (text) {
                fullResponse += text;
                onToken(text);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    }

    return fullResponse;
  }
}

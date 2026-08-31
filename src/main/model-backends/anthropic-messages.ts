import type { ModelBackend, ChatMessage, ModelBackendConfig } from "../../shared/v2-types";

/**
 * Process a single SSE line and extract text delta if present.
 * @returns Object with updated currentEvent and text delta (if any)
 */
function processLine(line: string, currentEvent: string): { currentEvent: string; text: string | null } {
  if (!line.trim()) {
    return { currentEvent, text: null };
  }

  // SSE format: "event: <type>" or "data: {json}"
  if (line.startsWith("event: ")) {
    return { currentEvent: line.slice(7), text: null };
  } else if (line.startsWith("data: ")) {
    const dataContent = line.slice(6);

    // Only process content_block_delta events
    if (currentEvent === "content_block_delta") {
      try {
        const data = JSON.parse(dataContent);
        const text = data.delta?.text;
        return { currentEvent, text: text || null };
      } catch {
        // Skip malformed JSON lines
        return { currentEvent, text: null };
      }
    }
  }

  return { currentEvent, text: null };
}

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
      throw new Error(`Chat request failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let buffer = "";
    let currentEvent = ""; // Track current event across chunks

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
        const result = processLine(line, currentEvent);
        currentEvent = result.currentEvent;

        if (result.text) {
          fullResponse += result.text;
          onToken(result.text);
        }
      }
    }

    // Process any remaining buffer after stream ends
    if (buffer.trim()) {
      const lines = buffer.split("\n");
      for (const line of lines) {
        const result = processLine(line, currentEvent);
        currentEvent = result.currentEvent;

        if (result.text) {
          fullResponse += result.text;
          onToken(result.text);
        }
      }
    }

    return fullResponse;
  }
}

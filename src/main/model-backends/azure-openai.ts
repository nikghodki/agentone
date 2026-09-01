import type { ModelBackend, ChatMessage, ModelBackendConfig } from "../../shared/v2-types";
import { parseSSEStream } from "./openai-compatible";

/**
 * Azure OpenAI backend for chat completions streaming.
 * Uses Azure-specific URL structure and api-key header authentication.
 *
 * URL format: {resourceUrl}/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}
 * Auth: api-key header (NOT Bearer Authorization)
 */
export class AzureOpenAIBackend implements ModelBackend {
  private config: ModelBackendConfig;
  private apiKey: string | null;
  private fetchFn: typeof fetch;

  constructor(config: ModelBackendConfig, apiKey: string | null, fetchFn?: typeof fetch) {
    this.config = config;
    this.apiKey = apiKey;
    this.fetchFn = fetchFn || fetch;
  }

  async chat(messages: ChatMessage[], onToken: (t: string) => void): Promise<string> {
    const { resourceUrl, deployment, apiVersion } = this.config.extra as {
      resourceUrl: string;
      deployment: string;
      apiVersion: string;
    };

    const url = `${resourceUrl}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { "api-key": this.apiKey } : {}),
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

import type { ModelBackend, ModelBackendConfig } from "../../shared/v2-types";
import type { Secrets } from "../secrets";
import { OpenAICompatibleBackend } from "./openai-compatible";
import { AnthropicMessagesBackend } from "./anthropic-messages";
import { AzureOpenAIBackend } from "./azure-openai";

/**
 * Creates a ModelBackend instance based on the protocol specified in the config.
 * Resolves API keys from the Secrets store and injects them into the appropriate backend.
 *
 * @param cfg - The model backend configuration
 * @param secrets - The Secrets store for resolving API keys
 * @param fetchFn - Optional fetch function for testing
 * @returns A ModelBackend instance (OpenAICompatibleBackend or AnthropicMessagesBackend)
 */
export function createBackend(cfg: ModelBackendConfig, secrets: Secrets, fetchFn?: typeof fetch): ModelBackend {
  // Resolve API key from secrets if secretRef is provided
  const apiKey = cfg.secretRef ? secrets.get(cfg.secretRef) : null;

  // Provider-specific routing (before protocol check)
  if (cfg.provider === "azure") {
    return new AzureOpenAIBackend(cfg, apiKey, fetchFn);
  }

  // Select backend based on protocol
  if (cfg.protocol === "v1/messages") {
    return new AnthropicMessagesBackend(cfg, apiKey, fetchFn);
  } else {
    // Default to OpenAI-compatible for "v1/chat/completions"
    // Handles: OpenAI, OpenRouter, Ollama, llama.cpp, vLLM, etc.
    return new OpenAICompatibleBackend(cfg, apiKey, fetchFn);
  }
}

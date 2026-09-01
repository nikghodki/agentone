import type { ModelBackendKind, ModelProtocol } from "@shared/v2-types";

interface ModelBackendDraft {
  kind: ModelBackendKind;
  provider: string | null;
  baseUrl: string | null;
  protocol: ModelProtocol;
  model: string;
  extra?: Record<string, unknown> | null;
}

interface FormFields {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  apiKey: string;
  resourceUrl: string;
  deployment: string;
  apiVersion: string;
  modelPath: string;
}

interface SaveArgs {
  draft: ModelBackendDraft;
  secret?: string;
}

/**
 * Pure helper that builds the arguments for saveModelBackend from the draft and form state.
 * - bedrock: extra = { region }, secret = JSON.stringify({accessKeyId, secretAccessKey})
 * - azure: extra = { resourceUrl, deployment, apiVersion }, secret = apiKey
 * - openrouter/anthropic/openai: secret = apiKey, no extra
 * - managed llamacpp: no secret; if modelPath given -> extra = { modelPath }, else no extra
 * - custom: secret = apiKey (if provided), no extra
 */
export function buildSaveArgs(draft: ModelBackendDraft, form: FormFields): SaveArgs {
  const provider = draft.provider;

  // Bedrock: region -> extra, two keys -> JSON secret
  if (provider === "bedrock") {
    return {
      draft: { ...draft, extra: { region: form.region } },
      secret: JSON.stringify({
        accessKeyId: form.accessKeyId,
        secretAccessKey: form.secretAccessKey,
      }),
    };
  }

  // Azure: resourceUrl/deployment/apiVersion -> extra, api-key -> secret
  if (provider === "azure") {
    return {
      draft: {
        ...draft,
        extra: {
          resourceUrl: form.resourceUrl,
          deployment: form.deployment,
          apiVersion: form.apiVersion,
        },
      },
      secret: form.apiKey,
    };
  }

  // Managed llama.cpp: optional modelPath -> extra, no secret
  if (draft.kind === "llamacpp") {
    const extra = form.modelPath ? { modelPath: form.modelPath } : null;
    return { draft: { ...draft, extra } };
  }

  // Custom: optional api-key -> secret, no extra
  if (draft.kind === "custom") {
    const secret = form.apiKey || undefined;
    return { draft: { ...draft, extra: null }, secret };
  }

  // Anthropic/OpenAI/OpenRouter: api-key -> secret, no extra
  // (kind === "cloud" and provider is anthropic/openai/openrouter)
  return {
    draft: { ...draft, extra: null },
    secret: form.apiKey || undefined,
  };
}

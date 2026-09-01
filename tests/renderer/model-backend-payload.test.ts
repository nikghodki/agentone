import { describe, it, expect } from "vitest";
import { buildSaveArgs } from "../../src/renderer/pages/model-backend-payload";

describe("buildSaveArgs", () => {
  it("bedrock: region -> extra, two keys -> JSON secret", () => {
    const { draft, secret } = buildSaveArgs(
      { kind: "cloud", provider: "bedrock", protocol: "v1/messages", model: "anthropic.claude-3-5-sonnet-20240620-v1:0", baseUrl: null, extra: null },
      { region: "us-east-1", accessKeyId: "AKID", secretAccessKey: "sk", apiKey: "", resourceUrl: "", deployment: "", apiVersion: "", modelPath: "" }
    );
    expect(draft.extra).toEqual({ region: "us-east-1" });
    expect(JSON.parse(secret!)).toEqual({ accessKeyId: "AKID", secretAccessKey: "sk" });
  });

  it("azure: resourceUrl/deployment/apiVersion -> extra, key -> secret", () => {
    const { draft, secret } = buildSaveArgs(
      { kind: "cloud", provider: "azure", protocol: "v1/chat/completions", model: "gpt-4o", baseUrl: null, extra: null },
      { region: "", accessKeyId: "", secretAccessKey: "", apiKey: "AZ", resourceUrl: "https://r.openai.azure.com", deployment: "gpt4o", apiVersion: "2024-06-01", modelPath: "" }
    );
    expect(draft.extra).toEqual({ resourceUrl: "https://r.openai.azure.com", deployment: "gpt4o", apiVersion: "2024-06-01" });
    expect(secret).toBe("AZ");
  });

  it("openrouter: bearer key -> secret, no extra", () => {
    const { draft, secret } = buildSaveArgs(
      { kind: "cloud", provider: "openrouter", protocol: "v1/chat/completions", model: "meta-llama/llama-3.1-8b", baseUrl: "https://openrouter.ai/api", extra: null },
      { region: "", accessKeyId: "", secretAccessKey: "", apiKey: "OR", resourceUrl: "", deployment: "", apiVersion: "", modelPath: "" }
    );
    expect(draft.extra ?? null).toBeNull();
    expect(secret).toBe("OR");
  });

  it("managed llamacpp: no secret, optional local model path -> extra.modelPath", () => {
    const { draft, secret } = buildSaveArgs(
      { kind: "llamacpp", provider: null, protocol: "v1/chat/completions", model: "qwen2.5-1.5b", baseUrl: null, extra: null },
      { region: "", accessKeyId: "", secretAccessKey: "", apiKey: "", resourceUrl: "", deployment: "", apiVersion: "", modelPath: "/my/model.gguf" }
    );
    expect(draft.extra).toEqual({ modelPath: "/my/model.gguf" });
    expect(secret).toBeUndefined();
  });
});

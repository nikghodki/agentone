import React from "react";
import { useAppStore } from "../../store";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { Callout } from "../../components/ui/Callout";
import type { ModelProtocol } from "@shared/v2-types";

const PROVIDER_INSTRUCTIONS = {
  anthropic: {
    text: "Get your API key from console.anthropic.com. Create a new key in the API Keys section.",
  },
  openai: {
    text: "Get your API key from platform.openai.com/api-keys. Create a new secret key.",
  },
  openrouter: {
    text: "Get your API key from openrouter.ai/keys. Sign in and generate a new key.",
  },
  azure: {
    text: "Get your credentials from your Azure OpenAI resource in the Azure portal. You'll need the resource URL, deployment name, API version, and API key.",
  },
  bedrock: {
    text: "Get your AWS credentials from AWS IAM. You'll need an Access Key ID, Secret Access Key, and the region where your Bedrock service is enabled.",
  },
};

export function ModelCloudStep() {
  const modelBackendDraft = useAppStore((s) => s.modelBackendDraft);
  const setModelBackendDraft = useAppStore((s) => s.setModelBackendDraft);
  const cloudForm = useAppStore((s) => s.cloudForm);
  const patchWizard = useAppStore((s) => s.patchWizard);

  const currentProvider = modelBackendDraft.provider || "anthropic";

  const handleProviderChange = (provider: string) => {
    // Mirror the logic from ModelBackendPage.handleProviderChange
    let baseUrl = null;
    let protocol: ModelProtocol = "v1/chat/completions";

    if (provider === "openrouter") {
      baseUrl = "https://openrouter.ai/api";
      protocol = "v1/chat/completions";
    } else if (provider === "anthropic") {
      protocol = "v1/messages";
    } else if (provider === "bedrock") {
      protocol = "v1/messages";
    }

    setModelBackendDraft({
      kind: "cloud",
      provider,
      baseUrl,
      protocol,
    });
  };

  const handleFieldChange = (field: keyof typeof cloudForm, value: string) => {
    patchWizard({
      cloudForm: { [field]: value },
    });
  };

  const handleModelChange = (value: string) => {
    setModelBackendDraft({ model: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Configure your cloud model
        </h2>
        <p className="text-slate-600">
          Connect to a cloud provider to access powerful language models.
        </p>
      </div>

      <Select
        label="Provider"
        value={currentProvider}
        onChange={(e) => handleProviderChange(e.target.value)}
      >
        <option value="anthropic">Anthropic</option>
        <option value="openai">OpenAI</option>
        <option value="openrouter">OpenRouter</option>
        <option value="azure">Azure OpenAI</option>
        <option value="bedrock">AWS Bedrock</option>
      </Select>

      {/* Guided instruction callout */}
      <Callout tone="info">
        {PROVIDER_INSTRUCTIONS[currentProvider as keyof typeof PROVIDER_INSTRUCTIONS].text}
      </Callout>

      {/* Provider-specific fields */}
      <div className="space-y-4">
        {/* Bedrock fields */}
        {currentProvider === "bedrock" && (
          <>
            <Input
              label="Region"
              value={cloudForm.region}
              onChange={(e) => handleFieldChange("region", e.target.value)}
              placeholder="us-east-1"
              helper="AWS region where Bedrock is enabled"
            />
            <Input
              label="Access Key ID"
              value={cloudForm.accessKeyId}
              onChange={(e) => handleFieldChange("accessKeyId", e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              helper="Your AWS Access Key ID"
            />
            <Input
              label="Secret Access Key"
              type="password"
              value={cloudForm.secretAccessKey}
              onChange={(e) => handleFieldChange("secretAccessKey", e.target.value)}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              helper="Your AWS Secret Access Key"
            />
            <Input
              label="Model"
              value={modelBackendDraft.model}
              onChange={(e) => handleModelChange(e.target.value)}
              placeholder="anthropic.claude-3-5-sonnet-20240620-v1:0"
              helper="The Bedrock model ID"
            />
          </>
        )}

        {/* Azure fields */}
        {currentProvider === "azure" && (
          <>
            <Input
              label="Resource URL"
              value={cloudForm.resourceUrl}
              onChange={(e) => handleFieldChange("resourceUrl", e.target.value)}
              placeholder="https://your-resource.openai.azure.com"
              helper="Your Azure OpenAI resource endpoint"
            />
            <Input
              label="Deployment"
              value={cloudForm.deployment}
              onChange={(e) => handleFieldChange("deployment", e.target.value)}
              placeholder="gpt-4o"
              helper="Your deployment name"
            />
            <Input
              label="API Version"
              value={cloudForm.apiVersion}
              onChange={(e) => handleFieldChange("apiVersion", e.target.value)}
              placeholder="2024-06-01"
              helper="Azure OpenAI API version"
            />
            <Input
              label="API Key"
              type="password"
              value={cloudForm.apiKey}
              onChange={(e) => handleFieldChange("apiKey", e.target.value)}
              placeholder="your-azure-api-key"
              helper="Your Azure OpenAI API key"
            />
          </>
        )}

        {/* Anthropic / OpenAI / OpenRouter fields */}
        {(currentProvider === "anthropic" ||
          currentProvider === "openai" ||
          currentProvider === "openrouter") && (
          <>
            <Input
              label="API Key"
              type="password"
              value={cloudForm.apiKey}
              onChange={(e) => handleFieldChange("apiKey", e.target.value)}
              placeholder={
                currentProvider === "openrouter"
                  ? "sk-or-v1-..."
                  : currentProvider === "openai"
                  ? "sk-..."
                  : "sk-ant-api03-..."
              }
              helper="Your API key from the provider"
            />
            <Input
              label="Model"
              value={modelBackendDraft.model}
              onChange={(e) => handleModelChange(e.target.value)}
              placeholder={
                currentProvider === "anthropic"
                  ? "claude-3-5-sonnet-20241022"
                  : currentProvider === "openai"
                  ? "gpt-4o"
                  : "meta-llama/llama-3.1-8b"
              }
              helper="The model identifier"
            />
          </>
        )}
      </div>
    </div>
  );
}

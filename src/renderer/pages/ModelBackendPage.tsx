import React, { useState } from "react";
import { useAppStore } from "../store";
import type { ModelBackendKind, ModelProtocol } from "@shared/v2-types";
import { buildSaveArgs } from "./model-backend-payload";

export function ModelBackendPage() {
  const draft = useAppStore((s) => s.modelBackendDraft);
  const setModelBackendDraft = useAppStore((s) => s.setModelBackendDraft);
  const selectedFrameworkId = useAppStore((s) => s.selectedFrameworkId);

  // Form state for provider-specific fields
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [deployment, setDeployment] = useState("");
  const [apiVersion, setApiVersion] = useState("");
  const [modelPath, setModelPath] = useState("");

  const handleKindChange = (kind: ModelBackendKind) => {
    // Reset fields when switching kind
    setModelBackendDraft({
      kind,
      provider: kind === "cloud" ? "anthropic" : null,
      // cloud always resets provider to "anthropic" (above), so baseUrl starts null here;
      // handleProviderChange sets the correct baseUrl when the user picks a provider.
      baseUrl: kind === "ollama" ? "http://localhost:11434" : null,
      protocol: kind === "cloud" ? "v1/messages" : "v1/chat/completions",
      model: "",
      extra: null,
    });
  };

  const handleProviderChange = (provider: string) => {
    // Set sensible defaults when provider changes
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

    setModelBackendDraft({ provider, baseUrl, protocol });
  };

  const handleFinish = async () => {
    try {
      // Build the payload using the pure helper
      const { draft: finalDraft, secret } = buildSaveArgs(draft, {
        region,
        accessKeyId,
        secretAccessKey,
        apiKey,
        resourceUrl,
        deployment,
        apiVersion,
        modelPath,
      });

      // Save the model backend + secret, get the real backend ID
      const backendId = await window.electronAPI.saveModelBackend(finalDraft, secret);

      // Store the backend ID
      useAppStore.getState().setModelBackendId(backendId);

      // Deploy the framework with the real model backend ID
      const deploymentResult = await window.electronAPI.deployFramework(
        selectedFrameworkId,
        backendId
      );

      // Set the current deployment and navigate to task page
      useAppStore.getState().setCurrentDeploymentId(deploymentResult.id);
      useAppStore.getState().setView("task");
    } catch (err) {
      console.error("Deploy failed:", err);
      alert("Failed to deploy framework. See console for details.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-8">
      <div className="max-w-3xl w-full">
        <h1 className="text-3xl font-bold text-white mb-2">Configure Model Backend</h1>
        <p className="text-zinc-400 mb-8">
          Choose how {selectedFrameworkId} will connect to language models.
        </p>

        {/* Backend Kind Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-3">Backend Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleKindChange("ollama")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                draft.kind === "ollama"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
              }`}
            >
              <div className="font-semibold text-white">Local (Ollama)</div>
              <div className="text-sm text-zinc-400">Run models locally</div>
            </button>

            <button
              onClick={() => handleKindChange("llamacpp")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                draft.kind === "llamacpp"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
              }`}
            >
              <div className="font-semibold text-white">Managed llama.cpp</div>
              <div className="text-sm text-zinc-400">We run it for you</div>
            </button>

            <button
              onClick={() => handleKindChange("custom")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                draft.kind === "custom"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
              }`}
            >
              <div className="font-semibold text-white">Custom Endpoint</div>
              <div className="text-sm text-zinc-400">Your own API</div>
            </button>

            <button
              onClick={() => handleKindChange("cloud")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                draft.kind === "cloud"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
              }`}
            >
              <div className="font-semibold text-white">Cloud Provider</div>
              <div className="text-sm text-zinc-400">Anthropic / OpenAI / etc</div>
            </button>
          </div>
        </div>

        {/* Conditional Fields */}
        <div className="space-y-4 mb-8">
          {/* Cloud Provider Selection */}
          {draft.kind === "cloud" && (
            <div>
              <label htmlFor="provider-select" className="block text-sm font-medium text-zinc-300 mb-2">Provider</label>
              <select
                id="provider-select"
                value={draft.provider || "anthropic"}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="azure">Azure OpenAI</option>
                <option value="bedrock">AWS Bedrock</option>
              </select>
            </div>
          )}

          {/* Base URL (for custom only; managed llamacpp doesn't need it) */}
          {draft.kind === "custom" && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Base URL</label>
              <input
                type="text"
                value={draft.baseUrl || ""}
                onChange={(e) => setModelBackendDraft({ baseUrl: e.target.value })}
                placeholder="http://localhost:8000"
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Managed llama.cpp: optional local model path */}
          {draft.kind === "llamacpp" && (
            <div>
              <label htmlFor="model-path-input" className="block text-sm font-medium text-zinc-300 mb-2">
                Local Model Path (optional)
              </label>
              <input
                id="model-path-input"
                type="text"
                value={modelPath}
                onChange={(e) => setModelPath(e.target.value)}
                placeholder="/path/to/your/model.gguf"
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-zinc-500 mt-1">Leave empty to use a default model</p>
            </div>
          )}

          {/* Azure-specific fields */}
          {draft.kind === "cloud" && draft.provider === "azure" && (
            <>
              <div>
                <label htmlFor="resource-url-input" className="block text-sm font-medium text-zinc-300 mb-2">
                  Resource URL
                </label>
                <input
                  id="resource-url-input"
                  type="text"
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="https://your-resource.openai.azure.com"
                  className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="deployment-input" className="block text-sm font-medium text-zinc-300 mb-2">
                  Deployment
                </label>
                <input
                  id="deployment-input"
                  type="text"
                  value={deployment}
                  onChange={(e) => setDeployment(e.target.value)}
                  placeholder="gpt-4o"
                  className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="api-version-input" className="block text-sm font-medium text-zinc-300 mb-2">
                  API Version
                </label>
                <input
                  id="api-version-input"
                  type="text"
                  value={apiVersion}
                  onChange={(e) => setApiVersion(e.target.value)}
                  placeholder="2024-06-01"
                  className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          {/* Bedrock-specific fields */}
          {draft.kind === "cloud" && draft.provider === "bedrock" && (
            <>
              <div>
                <label htmlFor="region-input" className="block text-sm font-medium text-zinc-300 mb-2">
                  Region
                </label>
                <input
                  id="region-input"
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="us-east-1"
                  className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="access-key-id-input" className="block text-sm font-medium text-zinc-300 mb-2">
                  Access Key ID
                </label>
                <input
                  id="access-key-id-input"
                  type="text"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="secret-access-key-input" className="block text-sm font-medium text-zinc-300 mb-2">
                  Secret Access Key
                </label>
                <input
                  id="secret-access-key-input"
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          {/* Protocol Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Protocol</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="v1/messages"
                  checked={draft.protocol === "v1/messages"}
                  onChange={(e) =>
                    setModelBackendDraft({ protocol: e.target.value as ModelProtocol })
                  }
                  className="mr-2"
                />
                <span className="text-zinc-300">v1/messages (Anthropic)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="v1/chat/completions"
                  checked={draft.protocol === "v1/chat/completions"}
                  onChange={(e) =>
                    setModelBackendDraft({ protocol: e.target.value as ModelProtocol })
                  }
                  className="mr-2"
                />
                <span className="text-zinc-300">v1/chat/completions (OpenAI)</span>
              </label>
            </div>
          </div>

          {/* Model Name/ID */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Model</label>
            <input
              type="text"
              value={draft.model}
              onChange={(e) => setModelBackendDraft({ model: e.target.value })}
              placeholder={
                draft.kind === "cloud"
                  ? "claude-3-5-sonnet-20241022"
                  : draft.kind === "ollama"
                    ? "llama3.2"
                    : "model-name"
              }
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* API Key (for cloud providers that use a single key, and custom) */}
          {(draft.kind === "cloud" &&
            draft.provider !== "bedrock" &&
            draft.provider !== "azure") ||
          draft.kind === "custom" ? (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                API Key {draft.kind === "custom" ? "(optional)" : ""}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  draft.kind === "cloud"
                    ? draft.provider === "openrouter"
                      ? "sk-or-v1-..."
                      : "sk-ant-api03-..."
                    : "API key (if required)"
                }
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          ) : null}

          {/* Azure API Key (shown after Azure-specific fields) */}
          {draft.kind === "cloud" && draft.provider === "azure" && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="your-azure-api-key"
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => useAppStore.getState().setView("v2-framework-select")}
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleFinish}
            disabled={!draft.model}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            Finish Setup
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useAppStore } from "../store";
import type { ModelBackendKind, ModelProtocol } from "@shared/v2-types";

export function ModelBackendPage() {
  const draft = useAppStore((s) => s.modelBackendDraft);
  const setModelBackendDraft = useAppStore((s) => s.setModelBackendDraft);
  const selectedFrameworkId = useAppStore((s) => s.selectedFrameworkId);
  const [apiKey, setApiKey] = useState("");

  const handleKindChange = (kind: ModelBackendKind) => {
    // Reset fields when switching kind
    setModelBackendDraft({
      kind,
      provider: kind === "cloud" ? "anthropic" : null,
      baseUrl: kind === "ollama" ? "http://localhost:11434" : null,
      protocol: kind === "cloud" ? "v1/messages" : "v1/chat/completions",
      model: "",
    });
  };

  const handleFinish = async () => {
    try {
      // Save the model backend + API key, get the real backend ID
      const backendId = await window.electronAPI.saveModelBackend(draft, apiKey);

      // Store the backend ID
      useAppStore.getState().setModelBackendId(backendId);

      // Deploy the framework with the real model backend ID
      const deployment = await window.electronAPI.deployFramework(
        selectedFrameworkId,
        backendId
      );

      // Set the current deployment and navigate to task page
      useAppStore.getState().setCurrentDeploymentId(deployment.id);
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
                draft.kind === "llamacpp" || draft.kind === "vllm"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
              }`}
            >
              <div className="font-semibold text-white">Advanced Local</div>
              <div className="text-sm text-zinc-400">llama.cpp / vLLM</div>
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
              <div className="text-sm text-zinc-400">Anthropic / OpenAI</div>
            </button>
          </div>
        </div>

        {/* Conditional Fields */}
        <div className="space-y-4 mb-8">
          {/* Cloud Provider Selection */}
          {draft.kind === "cloud" && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Provider</label>
              <select
                value={draft.provider || "anthropic"}
                onChange={(e) => setModelBackendDraft({ provider: e.target.value })}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
          )}

          {/* Base URL (for all except ollama which has default) */}
          {(draft.kind === "llamacpp" ||
            draft.kind === "vllm" ||
            draft.kind === "custom" ||
            draft.kind === "cloud") && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Base URL</label>
              <input
                type="text"
                value={draft.baseUrl || ""}
                onChange={(e) => setModelBackendDraft({ baseUrl: e.target.value })}
                placeholder={
                  draft.kind === "cloud"
                    ? "https://api.anthropic.com"
                    : "http://localhost:8000"
                }
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
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

          {/* API Key (only for cloud and custom) */}
          {(draft.kind === "cloud" || draft.kind === "custom") && (
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
                    ? "sk-ant-api03-..."
                    : "API key (if required)"
                }
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

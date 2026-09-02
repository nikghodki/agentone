import React, { useEffect } from "react";
import { useAppStore } from "../../store";
import { RadioCardGroup, RadioCard } from "../../components/ui/RadioCardGroup";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

// Curated local models
const CURATED_MODELS = [
  { value: "llama3.2:3b", label: "Llama 3.2 3B (Recommended)" },
  { value: "llama3.1:8b", label: "Llama 3.1 8B" },
  { value: "mistral:7b", label: "Mistral 7B" },
  { value: "phi3:mini", label: "Phi-3 Mini" },
  { value: "qwen2.5:7b", label: "Qwen 2.5 7B" },
];

const DEFAULT_MODEL = "llama3.2:3b";

export function ModelLocalStep() {
  const modelBackendDraft = useAppStore((s) => s.modelBackendDraft);
  const setModelBackendDraft = useAppStore((s) => s.setModelBackendDraft);

  const [selectedOption, setSelectedOption] = React.useState<string>("default");
  const [customBaseUrl, setCustomBaseUrl] = React.useState<string>("");
  const [customApiKey, setCustomApiKey] = React.useState<string>("");
  const [customProtocol, setCustomProtocol] = React.useState<string>("v1/chat/completions");
  const [chosenModel, setChosenModel] = React.useState<string>(DEFAULT_MODEL);

  // Initialize with recommended default on mount
  useEffect(() => {
    // Set default model if not already set
    if (!modelBackendDraft.model) {
      setModelBackendDraft({
        kind: "ollama",
        provider: null,
        baseUrl: null,
        protocol: "v1/chat/completions",
        model: DEFAULT_MODEL,
      });
    } else {
      // Restore state from draft
      if (modelBackendDraft.kind === "custom" && modelBackendDraft.baseUrl) {
        setSelectedOption("custom");
        setCustomBaseUrl(modelBackendDraft.baseUrl);
        setCustomProtocol(modelBackendDraft.protocol);
      } else if (modelBackendDraft.model && modelBackendDraft.model !== DEFAULT_MODEL) {
        setSelectedOption("choose");
        setChosenModel(modelBackendDraft.model);
      }
    }
  }, []);

  const handleOptionChange = (value: string) => {
    setSelectedOption(value);

    if (value === "default") {
      // Recommended default: Ollama with curated model
      setModelBackendDraft({
        kind: "ollama",
        provider: null,
        baseUrl: null,
        protocol: "v1/chat/completions",
        model: DEFAULT_MODEL,
      });
    } else if (value === "choose") {
      // Choose a model: Ollama with selected model from list
      setModelBackendDraft({
        kind: "ollama",
        provider: null,
        baseUrl: null,
        protocol: "v1/chat/completions",
        model: chosenModel,
      });
    } else if (value === "custom") {
      // Custom endpoint: will be populated by inputs
      setModelBackendDraft({
        kind: "custom",
        provider: null,
        baseUrl: customBaseUrl || null,
        protocol: customProtocol as "v1/chat/completions" | "v1/messages",
        model: "",
      });
    }
  };

  const handleModelChange = (model: string) => {
    setChosenModel(model);
    setModelBackendDraft({
      kind: "ollama",
      provider: null,
      baseUrl: null,
      protocol: "v1/chat/completions",
      model,
    });
  };

  const handleCustomBaseUrlChange = (url: string) => {
    setCustomBaseUrl(url);
    setModelBackendDraft({
      kind: "custom",
      provider: null,
      baseUrl: url || null,
      protocol: customProtocol as "v1/chat/completions" | "v1/messages",
      model: modelBackendDraft.model,
    });
  };

  const handleCustomProtocolChange = (protocol: string) => {
    setCustomProtocol(protocol);
    setModelBackendDraft({
      kind: "custom",
      provider: null,
      baseUrl: customBaseUrl || null,
      protocol: protocol as "v1/chat/completions" | "v1/messages",
      model: modelBackendDraft.model,
    });
  };

  const options: RadioCard[] = [
    {
      value: "default",
      title: "Recommended default",
      description: `Managed Ollama with ${DEFAULT_MODEL}. Zero configuration needed.`,
      badge: "Easiest",
    },
    {
      value: "choose",
      title: "Choose a model",
      description: "Select from a curated list of local models.",
    },
    {
      value: "custom",
      title: "Custom endpoint",
      description: "Connect to a model hosted at a custom URL.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Configure your local model
        </h2>
        <p className="text-slate-600">
          Choose how you want to set up your local model backend.
        </p>
      </div>

      <RadioCardGroup
        options={options}
        value={selectedOption}
        onChange={handleOptionChange}
        columns={1}
      />

      {selectedOption === "choose" && (
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <Select
            label="Select model"
            value={chosenModel}
            onChange={(e) => handleModelChange(e.target.value)}
            helper="Pick a model from our curated list"
          >
            {CURATED_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {selectedOption === "custom" && (
        <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
          <Input
            label="Base URL"
            value={customBaseUrl}
            onChange={(e) => handleCustomBaseUrlChange(e.target.value)}
            placeholder="http://localhost:11434"
            helper="The URL where your model server is running"
          />

          <Input
            label="API Key"
            type="password"
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            placeholder="Optional"
            helper="Leave empty if your endpoint doesn't require authentication"
          />

          <Select
            label="Protocol"
            value={customProtocol}
            onChange={(e) => handleCustomProtocolChange(e.target.value)}
            helper="The API protocol your endpoint uses"
          >
            <option value="v1/chat/completions">OpenAI Chat Completions (v1/chat/completions)</option>
            <option value="v1/messages">Anthropic Messages (v1/messages)</option>
          </Select>
        </div>
      )}
    </div>
  );
}

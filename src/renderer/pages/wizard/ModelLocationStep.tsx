import React, { useEffect } from "react";
import { useAppStore } from "../../store";
import { RadioCardGroup, RadioCard } from "../../components/ui/RadioCardGroup";

export function ModelLocationStep() {
  const modelBackendDraft = useAppStore((s) => s.modelBackendDraft);
  const setModelBackendDraft = useAppStore((s) => s.setModelBackendDraft);
  const [selectedLocation, setSelectedLocation] = React.useState<string | null>(null);

  // Initialize selection based on current draft
  useEffect(() => {
    if (modelBackendDraft.kind === "cloud") {
      setSelectedLocation("cloud");
    } else if (modelBackendDraft.kind) {
      setSelectedLocation("local");
    }
  }, []);

  const handleChange = (value: string) => {
    setSelectedLocation(value);

    if (value === "local") {
      // Set kind to ollama for local models
      setModelBackendDraft({
        kind: "ollama",
        provider: null,
        baseUrl: null,
        protocol: "v1/chat/completions",
      });
    } else if (value === "cloud") {
      // Set kind to cloud for cloud models
      setModelBackendDraft({
        kind: "cloud",
        provider: null,
      });
    }
  };

  const options: RadioCard[] = [
    {
      value: "local",
      title: "Local model",
      description: "Runs privately on your machine. No account or key needed.",
      features: [
        "Complete privacy",
        "No internet required",
        "Free to use",
        "Runs on your hardware",
      ],
    },
    {
      value: "cloud",
      title: "Cloud model",
      description: "Use a hosted provider with your own API key. Faster, larger models.",
      features: [
        "High performance",
        "Access to larger models",
        "No local hardware requirements",
        "Pay-per-use pricing",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Choose where to run your model
        </h2>
        <p className="text-slate-600">
          You can run models locally on your machine or use a cloud provider.
        </p>
      </div>

      <RadioCardGroup
        options={options}
        value={selectedLocation}
        onChange={handleChange}
        columns={2}
      />
    </div>
  );
}

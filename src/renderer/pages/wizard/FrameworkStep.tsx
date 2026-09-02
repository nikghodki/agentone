import React, { useEffect, useState } from "react";
import { useAppStore } from "../../store";
import { RadioCardGroup, RadioCard } from "../../components/ui/RadioCardGroup";
import type { FrameworkMeta } from "@shared/v2-types";

export function FrameworkStep() {
  const [frameworks, setFrameworks] = useState<FrameworkMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedFrameworkId = useAppStore((s) => s.selectedFrameworkId);
  const setFramework = useAppStore((s) => s.setFramework);

  useEffect(() => {
    async function loadFrameworks() {
      try {
        const data = await window.electronAPI.getFrameworks();
        setFrameworks(data);

        // Default to the isDefault framework if nothing is selected
        const defaultFramework = data.find((f) => f.isDefault);
        if (defaultFramework && !selectedFrameworkId) {
          setFramework(defaultFramework.id);
        }
      } catch (error) {
        console.error("Failed to load frameworks:", error);
      } finally {
        setLoading(false);
      }
    }

    loadFrameworks();
  }, []);

  const handleChange = (value: string) => {
    setFramework(value);
  };

  if (loading) {
    return (
      <div className="text-center text-slate-500">
        Loading frameworks...
      </div>
    );
  }

  const options: RadioCard[] = frameworks.map((framework) => ({
    value: framework.id,
    title: framework.name,
    features: framework.features.slice(0, 5), // Top 5 features
    badge: framework.isDefault ? "Recommended" : undefined,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Choose your agent framework
        </h2>
        <p className="text-slate-600">
          Select the framework that best fits your needs. Each comes with its own strengths and capabilities.
        </p>
      </div>

      <RadioCardGroup
        options={options}
        value={selectedFrameworkId}
        onChange={handleChange}
        columns={3}
      />
    </div>
  );
}

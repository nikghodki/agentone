import { useEffect, useState } from "react";
import { useAppStore } from "../store";
import type { FrameworkMeta } from "@shared/v2-types";

export function FrameworkSelectPage() {
  const [frameworks, setFrameworks] = useState<FrameworkMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedFrameworkId = useAppStore((s) => s.selectedFrameworkId);
  const setFramework = useAppStore((s) => s.setFramework);
  const setView = useAppStore((s) => s.setView);

  useEffect(() => {
    async function loadFrameworks() {
      try {
        const data = await window.electronAPI.getFrameworks();
        setFrameworks(data);
      } catch (err) {
        console.error("Failed to load frameworks:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFrameworks();
  }, []);

  const handleContinue = () => {
    setView("v2-model-backend");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <p className="text-zinc-400">Loading frameworks...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-8">
      <div className="max-w-5xl w-full">
        <h1 className="text-3xl font-bold text-white mb-2">Choose Your Agent Framework</h1>
        <p className="text-zinc-400 mb-8">
          Select the AI agent framework that best fits your workflow.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {frameworks.map((fw) => (
            <button
              key={fw.id}
              onClick={() => setFramework(fw.id)}
              className={`p-6 rounded-lg border-2 text-left transition-all ${
                selectedFrameworkId === fw.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
              }`}
            >
              <h2 className="text-xl font-semibold text-white mb-4">{fw.name}</h2>
              <ul className="space-y-2">
                {fw.features.slice(0, 5).map((feature, idx) => (
                  <li key={idx} className="text-sm text-zinc-400 flex items-start">
                    <span className="text-blue-400 mr-2">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

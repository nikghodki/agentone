import React, { useState } from "react";
import { useAppStore } from "../../store";
import { Callout } from "../../components/ui/Callout";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Input } from "../../components/ui/Input";

// Map framework IDs to display names
const FRAMEWORK_NAMES: Record<string, string> = {
  openclaw: "OpenClaw",
  zeptoclaw: "ZeptoClaw",
  hermes: "Hermes",
};

export function ConfigStep() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selectedFrameworkId = useAppStore((s) => s.selectedFrameworkId);
  const frameworkConfig = useAppStore((s) => s.frameworkConfig);
  const patchWizard = useAppStore((s) => s.patchWizard);

  const frameworkName = FRAMEWORK_NAMES[selectedFrameworkId] || selectedFrameworkId;

  const handlePersonaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    patchWizard({
      frameworkConfig: { persona: e.target.value },
    });
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const port = parseInt(e.target.value, 10);
    patchWizard({
      frameworkConfig: { port: isNaN(port) ? undefined : port },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Framework Configuration
        </h2>
        <p className="text-slate-600">
          {frameworkName} is ready to use with recommended defaults.
        </p>
      </div>

      <Callout tone="info">
        <strong>{frameworkName}</strong> needs no additional setup — we'll use
        recommended defaults (loopback, auto-generated tokens, auto workspace).
      </Callout>

      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full justify-between"
        >
          <span>Advanced (optional)</span>
          <span className="text-slate-400">
            {advancedOpen ? "▲" : "▼"}
          </span>
        </Button>

        {advancedOpen && (
          <div className="space-y-4 border-l-2 border-slate-200 pl-4">
            <Textarea
              label="Persona / System Prompt"
              placeholder="You are a helpful assistant..."
              helper="Customize the agent's behavior and personality"
              value={frameworkConfig.persona || ""}
              onChange={handlePersonaChange}
              rows={4}
            />

            <Input
              label="Gateway Port"
              type="number"
              placeholder="8080"
              helper="Port for the framework gateway (leave empty for default)"
              value={frameworkConfig.port?.toString() || ""}
              onChange={handlePortChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

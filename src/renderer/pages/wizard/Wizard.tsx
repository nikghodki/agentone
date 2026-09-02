import React from "react";
import { useAppStore, WizardStep } from "../../store";
import { WizardLayout } from "../../components/WizardLayout";

// Map wizard steps to the 4 visible groups in StepProgress
function getStepProgressKey(wizardStep: WizardStep): string {
  switch (wizardStep) {
    case "framework":
      return "framework";
    case "config":
      return "setup";
    case "model-location":
    case "model-local":
    case "model-cloud":
      return "model";
    case "deploy":
      return "deploy";
    default:
      return "framework";
  }
}

// Get the next step in the linear flow
function getNextStep(current: WizardStep, modelChoice?: "local" | "cloud"): WizardStep | null {
  switch (current) {
    case "framework":
      return "config";
    case "config":
      return "model-location";
    case "model-location":
      // Branch based on model choice (placeholder heuristic for now)
      return modelChoice === "cloud" ? "model-cloud" : "model-local";
    case "model-local":
    case "model-cloud":
      return "deploy";
    case "deploy":
      return null; // End of wizard
    default:
      return null;
  }
}

// Get the previous step in the linear flow
function getPreviousStep(current: WizardStep): WizardStep | null {
  switch (current) {
    case "framework":
      return null; // First step
    case "config":
      return "framework";
    case "model-location":
      return "config";
    case "model-local":
    case "model-cloud":
      return "model-location";
    case "deploy":
      // Return to the model step we came from (placeholder: always local for now)
      return "model-local";
    default:
      return null;
  }
}

export function Wizard() {
  const wizardStep = useAppStore((s) => s.wizardStep);
  const setWizardStep = useAppStore((s) => s.setWizardStep);

  const handleBack = () => {
    const prev = getPreviousStep(wizardStep);
    if (prev) {
      setWizardStep(prev);
    }
  };

  const handleContinue = () => {
    const next = getNextStep(wizardStep, "local"); // Default to local for now
    if (next) {
      setWizardStep(next);
    }
  };

  const canGoBack = getPreviousStep(wizardStep) !== null;
  const stepProgressKey = getStepProgressKey(wizardStep);

  // Placeholder content for each step (Tasks 4-7 will implement the real steps)
  return (
    <WizardLayout
      current={stepProgressKey}
      title={`Step: ${wizardStep}`}
      canContinue={true} // Enable for placeholder testing
      onBack={canGoBack ? handleBack : undefined}
      onContinue={handleContinue}
    >
      <div className="text-slate-700">
        <p>Current wizard step: <strong>{wizardStep}</strong></p>
        <p className="text-sm text-slate-500 mt-2">
          Placeholder — real step UI will be implemented in Tasks 4-7
        </p>
      </div>
    </WizardLayout>
  );
}

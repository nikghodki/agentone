import React from "react";
import { useAppStore, WizardStep } from "../../store";
import { WizardLayout } from "../../components/WizardLayout";
import { FrameworkStep } from "./FrameworkStep";
import { ConfigStep } from "./ConfigStep";

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
  const selectedFrameworkId = useAppStore((s) => s.selectedFrameworkId);
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

  // Determine if current step is ready to continue
  const canContinue = (() => {
    switch (wizardStep) {
      case "framework":
        return selectedFrameworkId !== null && selectedFrameworkId !== "";
      case "config":
        return true; // Config step is always ready (no required fields)
      default:
        return true; // Other steps will implement their own readiness logic
    }
  })();

  // Render the appropriate step component
  const renderStep = () => {
    switch (wizardStep) {
      case "framework":
        return <FrameworkStep />;
      case "config":
        return <ConfigStep />;
      default:
        return (
          <div className="text-slate-700">
            <p>Current wizard step: <strong>{wizardStep}</strong></p>
            <p className="text-sm text-slate-500 mt-2">
              Placeholder — will be implemented in Tasks 5-7
            </p>
          </div>
        );
    }
  };

  return (
    <WizardLayout
      current={stepProgressKey}
      title={`Step: ${wizardStep}`}
      canContinue={canContinue}
      onBack={canGoBack ? handleBack : undefined}
      onContinue={handleContinue}
    >
      {renderStep()}
    </WizardLayout>
  );
}

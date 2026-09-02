import React from "react";
import { useAppStore, WizardStep } from "../../store";
import { WizardLayout } from "../../components/WizardLayout";
import { FrameworkStep } from "./FrameworkStep";
import { ConfigStep } from "./ConfigStep";
import { ModelLocationStep } from "./ModelLocationStep";
import { ModelLocalStep } from "./ModelLocalStep";
import { ModelCloudStep } from "./ModelCloudStep";
import { DeployStep } from "./DeployStep";
import { ChannelStep } from "./ChannelStep";

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
    case "channel":
      return "deploy";
    default:
      return "framework";
  }
}

// Get the next step in the linear flow
function getNextStep(current: WizardStep, modelBackendKind?: string): WizardStep | null {
  switch (current) {
    case "framework":
      return "config";
    case "config":
      return "model-location";
    case "model-location":
      // Branch based on model backend kind set by ModelLocationStep
      return modelBackendKind === "cloud" ? "model-cloud" : "model-local";
    case "model-local":
    case "model-cloud":
      return "deploy";
    case "deploy":
      return "channel";
    case "channel":
      return null; // End of wizard
    default:
      return null;
  }
}

// Get the previous step in the linear flow
function getPreviousStep(current: WizardStep, modelBackendKind?: string): WizardStep | null {
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
      // Return to the model step we came from, inferred from modelBackendDraft.kind
      return modelBackendKind === "cloud" ? "model-cloud" : "model-local";
    case "channel":
      return "deploy";
    default:
      return null;
  }
}

export function Wizard() {
  const wizardStep = useAppStore((s) => s.wizardStep);
  const selectedFrameworkId = useAppStore((s) => s.selectedFrameworkId);
  const modelBackendDraft = useAppStore((s) => s.modelBackendDraft);
  const setWizardStep = useAppStore((s) => s.setWizardStep);

  const handleBack = () => {
    const prev = getPreviousStep(wizardStep, modelBackendDraft.kind);
    if (prev) {
      setWizardStep(prev);
    }
  };

  const handleContinue = () => {
    const next = getNextStep(wizardStep, modelBackendDraft.kind);
    if (next) {
      setWizardStep(next);
    }
  };

  const canGoBack = getPreviousStep(wizardStep, modelBackendDraft.kind) !== null;
  const stepProgressKey = getStepProgressKey(wizardStep);

  // Determine if current step is ready to continue
  const canContinue = (() => {
    switch (wizardStep) {
      case "framework":
        return selectedFrameworkId !== null && selectedFrameworkId !== "";
      case "config":
        return true; // Config step is always ready (no required fields)
      case "model-location":
        return modelBackendDraft.kind !== null && modelBackendDraft.kind !== "";
      case "model-local":
        return modelBackendDraft.model !== null && modelBackendDraft.model !== "";
      case "model-cloud":
        return modelBackendDraft.model !== null && modelBackendDraft.model !== "";
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
      case "model-location":
        return <ModelLocationStep />;
      case "model-local":
        return <ModelLocalStep />;
      case "model-cloud":
        return <ModelCloudStep />;
      case "deploy":
        return <DeployStep />;
      case "channel":
        return <ChannelStep />;
      default:
        return (
          <div className="text-slate-700">
            <p>Current wizard step: <strong>{wizardStep}</strong></p>
            <p className="text-sm text-slate-500 mt-2">
              Placeholder
            </p>
          </div>
        );
    }
  };

  return (
    <WizardLayout
      current={stepProgressKey}
      canContinue={canContinue}
      onBack={canGoBack ? handleBack : undefined}
      onContinue={wizardStep === "deploy" || wizardStep === "channel" ? undefined : handleContinue}
    >
      {renderStep()}
    </WizardLayout>
  );
}

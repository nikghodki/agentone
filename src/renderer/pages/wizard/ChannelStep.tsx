import React, { useState } from "react";
import { useAppStore } from "../../store";
import { ChannelSetupForm } from "../../components/ChannelSetupForm";
import { Button } from "../../components/ui/Button";

export function ChannelStep() {
  const currentDeploymentId = useAppStore((s) => s.currentDeploymentId);
  const selectedFrameworkId = useAppStore((s) => s.selectedFrameworkId);
  const setWizardStep = useAppStore((s) => s.setWizardStep);

  const [hasConnected, setHasConnected] = useState(false);

  const handleConnected = (channelId: string) => {
    setHasConnected(true);
  };

  const handleSkip = () => {
    setWizardStep("use-case");
  };

  const handleContinue = () => {
    setWizardStep("use-case");
  };

  if (!currentDeploymentId) {
    return (
      <div className="text-slate-700">
        <p>No deployment found. Please deploy first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Connect a Channel
        </h2>
        <p className="text-slate-600">
          Set up a messaging channel to interact with your agent (optional).
        </p>
      </div>

      <ChannelSetupForm
        deploymentId={currentDeploymentId}
        frameworkId={selectedFrameworkId}
        onConnected={handleConnected}
      />

      {/* Action buttons */}
      <div className="flex gap-3 justify-end border-t border-slate-200 pt-4">
        <Button variant="secondary" onClick={handleSkip}>
          Skip
        </Button>
        {hasConnected && (
          <Button variant="primary" onClick={handleContinue}>
            Continue to app
          </Button>
        )}
      </div>
    </div>
  );
}

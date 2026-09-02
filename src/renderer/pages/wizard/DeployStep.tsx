import React, { useState, useEffect } from "react";
import { useAppStore } from "../../store";
import { buildSaveArgs } from "../model-backend-payload";
import { Button } from "../../components/ui/Button";
import { Callout } from "../../components/ui/Callout";
import { ProgressBar } from "../../components/ui/ProgressBar";

type DeployState = "idle" | "deploying" | "error" | "success";

export function DeployStep() {
  const selectedFrameworkId = useAppStore((s) => s.selectedFrameworkId);
  const modelBackendDraft = useAppStore((s) => s.modelBackendDraft);
  const cloudForm = useAppStore((s) => s.cloudForm);
  const setModelBackendId = useAppStore((s) => s.setModelBackendId);
  const setCurrentDeploymentId = useAppStore((s) => s.setCurrentDeploymentId);
  const setWizardStep = useAppStore((s) => s.setWizardStep);

  const [deployState, setDeployState] = useState<DeployState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string>("");

  useEffect(() => {
    // Subscribe to task status updates for progress tracking
    const unsubscribe = window.electronAPI.onTaskStatus((status: string) => {
      setProgressLabel(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleDeploy = async () => {
    setDeployState("deploying");
    setError(null);
    setProgressLabel(`Installing ${selectedFrameworkId}...`);

    try {
      // Step 1: Build save arguments (handles cloud/custom/local uniformly)
      const { draft, secret } = buildSaveArgs(modelBackendDraft, cloudForm);

      // Step 2: Save model backend and get the ID
      setProgressLabel("Saving model configuration...");
      const backendId = await window.electronAPI.saveModelBackend(draft, secret);
      setModelBackendId(backendId);

      // Step 3: Deploy the framework with the model backend
      setProgressLabel(`Deploying ${selectedFrameworkId}...`);
      const deployment = await window.electronAPI.deployFramework(
        selectedFrameworkId,
        backendId
      );

      // Step 4: Update store and navigate to channel step
      setCurrentDeploymentId(deployment.id);
      setDeployState("success");
      setWizardStep("channel");
    } catch (err) {
      console.error("Deploy failed:", err);
      setDeployState("error");
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Ready to Deploy
        </h2>
        <p className="text-slate-600">
          Install {selectedFrameworkId} and connect it to your model backend.
        </p>
      </div>

      {/* Error callout with retry button */}
      {deployState === "error" && error && (
        <Callout tone="error">
          <div className="space-y-3">
            <p className="font-medium">Deployment failed</p>
            <p className="text-sm">{error}</p>
            <Button variant="primary" onClick={handleDeploy}>
              Retry
            </Button>
          </div>
        </Callout>
      )}

      {/* Progress bar during deployment */}
      {deployState === "deploying" && (
        <div className="space-y-3">
          <ProgressBar
            value={0}
            indeterminate
            label={progressLabel || "Deploying..."}
          />
        </div>
      )}

      {/* Primary deploy button (only shown when idle) */}
      {deployState === "idle" && (
        <div className="flex justify-center">
          <Button
            variant="primary"
            onClick={handleDeploy}
            disabled={!selectedFrameworkId || !modelBackendDraft.model}
          >
            Install & Deploy
          </Button>
        </div>
      )}
    </div>
  );
}

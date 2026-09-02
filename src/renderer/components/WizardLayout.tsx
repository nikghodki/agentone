import React from "react";
import { StepProgress, Step } from "./ui/StepProgress";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";

export interface WizardLayoutProps {
  steps?: Step[];
  current: string;
  title?: string;
  canContinue: boolean;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  children: React.ReactNode;
}

const DEFAULT_STEPS: Step[] = [
  { key: "framework", label: "Framework" },
  { key: "setup", label: "Setup" },
  { key: "model", label: "Model" },
  { key: "deploy", label: "Deploy" },
];

export function WizardLayout({
  steps = DEFAULT_STEPS,
  current,
  title,
  canContinue,
  onBack,
  onContinue,
  continueLabel = "Continue",
  children,
}: WizardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-3xl px-4">
        {/* Step Progress Header */}
        <div className="mb-8">
          <StepProgress steps={steps} current={current} />
        </div>

        {/* Content Card */}
        <Card className="mb-6">
          {children}
        </Card>

        {/* Footer with Back/Continue */}
        <div className="flex items-center justify-between">
          <div>
            {onBack && (
              <Button variant="ghost" onClick={onBack}>
                Back
              </Button>
            )}
          </div>
          {onContinue && (
            <Button
              variant="primary"
              onClick={onContinue}
              disabled={!canContinue}
            >
              {continueLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

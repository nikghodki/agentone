import React from "react";

export interface Step {
  key: string;
  label: string;
}

export interface StepProgressProps {
  steps: Step[];
  current: string;
}

export function StepProgress({ steps, current }: StepProgressProps) {
  const currentIndex = steps.findIndex((step) => step.key === current);

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <React.Fragment key={step.key}>
            {index > 0 && (
              <div
                className={`h-0.5 w-8 ${
                  isCompleted ? "bg-primary" : "bg-slate-200"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  isCurrent
                    ? "bg-primary text-white"
                    : isCompleted
                    ? "bg-primary text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {isCompleted ? "✓" : index + 1}
              </div>
              <div
                className={`text-xs ${
                  isCurrent
                    ? "text-slate-900 font-medium"
                    : isPending
                    ? "text-slate-500"
                    : "text-slate-700"
                }`}
              >
                {step.label}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

import React from "react";

export interface ProgressBarProps {
  value: number;
  label?: string;
  indeterminate?: boolean;
}

export function ProgressBar({
  value,
  label,
  indeterminate = false,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      {label && (
        <div className="text-sm text-slate-700 mb-2 font-medium">{label}</div>
      )}
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full bg-primary transition-all duration-300 ${
            indeterminate ? "animate-pulse" : ""
          }`}
          style={{ width: indeterminate ? "100%" : `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={indeterminate ? undefined : clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

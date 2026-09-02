import React from "react";

export type CalloutTone = "info" | "success" | "warning" | "error";

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  tone: CalloutTone;
  title?: string;
}

export function Callout({
  tone,
  title,
  className = "",
  children,
  ...props
}: CalloutProps) {
  const toneClasses = {
    info: "bg-indigo-50 text-indigo-900 border-indigo-200",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    error: "bg-rose-50 text-rose-900 border-rose-200",
  };

  const iconClasses = {
    info: "text-indigo-600",
    success: "text-emerald-600",
    warning: "text-amber-600",
    error: "text-rose-600",
  };

  return (
    <div
      className={`rounded-lg border p-4 ${toneClasses[tone]} ${className}`}
      role="alert"
      {...props}
    >
      {title && (
        <div className={`font-medium mb-1 ${iconClasses[tone]}`}>{title}</div>
      )}
      <div className="text-sm">{children}</div>
    </div>
  );
}

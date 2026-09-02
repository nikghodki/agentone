import React from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  helper?: string;
  error?: string;
}

export function Textarea({
  label,
  helper,
  error,
  className = "",
  id,
  ...props
}: TextareaProps) {
  const textareaId =
    id || `textarea-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={textareaId}
        className="text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <textarea
        id={textareaId}
        className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          hasError
            ? "border-rose-500 focus:border-rose-500"
            : "border-slate-300 focus:border-indigo-500"
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-rose-600">{error}</span>}
      {!error && helper && (
        <span className="text-xs text-slate-500">{helper}</span>
      )}
    </div>
  );
}

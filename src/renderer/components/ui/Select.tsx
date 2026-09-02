import React from "react";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  helper?: string;
  error?: string;
}

export function Select({
  label,
  helper,
  error,
  className = "",
  id,
  children,
  ...props
}: SelectProps) {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={selectId}
        className="text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <select
        id={selectId}
        className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          hasError
            ? "border-rose-500 focus:border-rose-500"
            : "border-slate-300 focus:border-indigo-500"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-rose-600">{error}</span>}
      {!error && helper && (
        <span className="text-xs text-slate-500">{helper}</span>
      )}
    </div>
  );
}

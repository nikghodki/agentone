import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    "rounded-lg px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors";

  const variantClasses = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary:
      "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {}

export function Badge({ className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-primary-subtle px-2.5 py-0.5 text-xs font-medium text-primary ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

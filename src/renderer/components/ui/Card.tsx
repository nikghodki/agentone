import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({
  hover = false,
  className = "",
  children,
  ...props
}: CardProps) {
  const hoverClass = hover ? "hover:shadow-md" : "";
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm p-6 ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

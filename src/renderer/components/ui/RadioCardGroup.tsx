import React from "react";

export interface RadioCard {
  value: string;
  title: string;
  description?: string;
  features?: string[];
  badge?: string;
}

export interface RadioCardGroupProps {
  options: RadioCard[];
  value: string | null;
  onChange: (value: string) => void;
  columns?: 1 | 2 | 3;
}

export function RadioCardGroup({
  options,
  value,
  onChange,
  columns = 1,
}: RadioCardGroupProps) {
  const handleKeyDown = (
    e: React.KeyboardEvent,
    option: RadioCard,
    index: number
  ) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(option.value);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (index + 1) % options.length;
      const nextElement = document.querySelector(
        `[data-radio-index="${nextIndex}"]`
      ) as HTMLElement;
      nextElement?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (index - 1 + options.length) % options.length;
      const prevElement = document.querySelector(
        `[data-radio-index="${prevIndex}"]`
      ) as HTMLElement;
      prevElement?.focus();
    }
  };

  const gridColsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  };

  return (
    <div
      className={`grid gap-4 ${gridColsClass[columns]}`}
      role="radiogroup"
    >
      {options.map((option, index) => {
        const isSelected = value === option.value;
        return (
          <div
            key={option.value}
            data-radio-index={index}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            className={`cursor-pointer rounded-lg p-4 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isSelected
                ? "border-2 border-primary bg-primary-subtle"
                : "border border-slate-200 hover:border-slate-300 bg-white"
            }`}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, option, index)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-slate-900">{option.title}</div>
              {option.badge && (
                <span className="inline-flex items-center rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-medium text-primary">
                  {option.badge}
                </span>
              )}
            </div>
            {option.description && (
              <div className="mt-1 text-sm text-slate-600">
                {option.description}
              </div>
            )}
            {option.features && option.features.length > 0 && (
              <ul className="mt-3 space-y-1">
                {option.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-slate-600"
                  >
                    <span className="text-emerald-600 mt-0.5">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

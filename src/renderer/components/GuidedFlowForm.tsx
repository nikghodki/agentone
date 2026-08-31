import { useState } from "react";
import type { GuidedFlow, FlowField } from "@shared/types";

interface GuidedFlowFormProps {
  flow: GuidedFlow;
  onSubmit: (values: Record<string, string>) => void;
  isGenerating: boolean;
}

export function GuidedFlowForm({ flow, onSubmit, isGenerating }: GuidedFlowFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  function setValue(label: string, value: string) {
    setValues((prev) => ({ ...prev, [label]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const requiredFieldsFilled = flow.fields
    .filter((f) => !f.optional)
    .every((f) => (values[f.label] ?? "").trim() !== "");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {flow.fields.map((field) => (
        <FieldRenderer
          key={field.label}
          field={field}
          value={values[field.label] ?? ""}
          onChange={(v) => setValue(field.label, v)}
        />
      ))}
      <button
        type="submit"
        disabled={!requiredFieldsFilled || isGenerating}
        className="mt-2 px-6 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-start"
      >
        {isGenerating ? "Generating..." : "Generate ✨"}
      </button>
    </form>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FlowField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        {field.label}
        {field.optional && <span className="text-zinc-600 ml-1">(optional)</span>}
      </label>
      {field.type === "choice" && field.options && (
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                value === opt
                  ? "border-blue-500 bg-blue-500/10 text-blue-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {field.type === "textarea" && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none resize-y"
        />
      )}
      {field.type === "text" && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
}

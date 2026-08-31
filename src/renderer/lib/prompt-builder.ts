import type { GuidedFlow } from "@shared/types";

function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
}

export function buildPrompt(flow: GuidedFlow, values: Record<string, string>): string {
  let result = flow.prompt_template;

  result = result.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key: string, content: string) => {
      const value = values[key];
      if (!value || value.trim() === "") return "";
      return content;
    }
  );

  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

export function collectFlowValues(
  flow: GuidedFlow,
  formData: Record<string, string>
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of flow.fields) {
    const key = labelToKey(field.label);
    values[key] = formData[field.label] ?? "";
  }
  return values;
}

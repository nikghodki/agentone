import React, { useState } from "react";
import { useCasesForFramework, UseCase, buildPrompt } from "../../shared/use-cases";
import { RadioCardGroup, RadioCard } from "./ui/RadioCardGroup";
import { Input } from "./ui/Input";
import { Textarea } from "./ui/Textarea";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { useAppStore } from "../store";

export function UseCaseBuilder() {
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<string | null>(
    null
  );
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Get selected framework from store
  const selectedFrameworkId = useAppStore((state) => state.selectedFrameworkId);

  // Filter use cases by framework
  const filteredUseCases = useCasesForFramework(selectedFrameworkId);

  const selectedUseCase = filteredUseCases.find((uc) => uc.id === selectedUseCaseId);

  // Convert filtered use cases to RadioCard format
  const useCaseCards: RadioCard[] = filteredUseCases.map((uc) => ({
    value: uc.id,
    title: uc.title,
    description: uc.description,
  }));

  const handleUseCaseSelect = (id: string) => {
    setSelectedUseCaseId(id);
    setFieldValues({});
    setCopied(false);
  };

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({
      ...prev,
      [key]: value,
    }));
    setCopied(false);
  };

  const generatedPrompt = selectedUseCase
    ? buildPrompt(selectedUseCase, fieldValues)
    : "";

  // Check if all required fields are filled
  const allRequiredFieldsFilled = selectedUseCase
    ? selectedUseCase.fields
        .filter((field) => !field.optional)
        .every((field) => {
          const value = (fieldValues[field.key] || "").trim();
          return value.length > 0;
        })
    : false;

  const handleCopy = async () => {
    try {
      // Try clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(generatedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback: create a textarea and select it
        const textarea = document.createElement("textarea");
        textarea.value = generatedPrompt;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Use case selection */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          Choose a use case
        </h3>
        <RadioCardGroup
          options={useCaseCards}
          value={selectedUseCaseId}
          onChange={handleUseCaseSelect}
          columns={2}
        />
      </div>

      {/* Fields and prompt preview */}
      {selectedUseCase && (
        <div className="space-y-6">
          {/* Input fields */}
          <Card>
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-slate-900">
                Customize your prompt
              </h4>
              {selectedUseCase.fields.map((field) => {
                const value = fieldValues[field.key] || "";
                const label = field.optional
                  ? `${field.label} (optional)`
                  : field.label;

                if (field.type === "textarea") {
                  return (
                    <Textarea
                      key={field.key}
                      label={label}
                      placeholder={field.placeholder}
                      value={value}
                      onChange={(e) =>
                        handleFieldChange(field.key, e.target.value)
                      }
                      rows={3}
                    />
                  );
                } else if (field.type === "select") {
                  return (
                    <Select
                      key={field.key}
                      label={label}
                      value={value}
                      onChange={(e) =>
                        handleFieldChange(field.key, e.target.value)
                      }
                    >
                      <option value="">Select {field.label.toLowerCase()}</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  );
                } else {
                  return (
                    <Input
                      key={field.key}
                      label={label}
                      type="text"
                      placeholder={field.placeholder}
                      value={value}
                      onChange={(e) =>
                        handleFieldChange(field.key, e.target.value)
                      }
                    />
                  );
                }
              })}
            </div>
          </Card>

          {/* Prompt preview */}
          <Card>
            <div className="space-y-3">
              <h4 className="text-md font-semibold text-slate-900">
                Your prompt
              </h4>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm text-slate-700 whitespace-pre-wrap">
                {generatedPrompt || "Fill in the fields to see your prompt"}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  {allRequiredFieldsFilled
                    ? "Paste this prompt to your agent in your messaging app."
                    : "Fill in required fields to copy."}
                </p>
                <Button
                  onClick={handleCopy}
                  disabled={!allRequiredFieldsFilled}
                  variant={copied ? "secondary" : "primary"}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

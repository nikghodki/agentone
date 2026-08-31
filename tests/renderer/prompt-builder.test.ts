import { describe, it, expect } from "vitest";
import { buildPrompt } from "../../src/renderer/lib/prompt-builder";
import type { GuidedFlow } from "../../src/shared/types";

describe("buildPrompt", () => {
  it("replaces template variables with field values", () => {
    const flow: GuidedFlow = {
      fields: [
        { type: "choice", label: "Tone", options: ["Professional", "Casual"] },
        { type: "textarea", label: "Key points" },
      ],
      prompt_template: "Write a {{tone}} email. Key points: {{key_points}}",
    };
    const values = { tone: "Professional", key_points: "Meeting moved to Friday" };
    const result = buildPrompt(flow, values);
    expect(result).toBe("Write a Professional email. Key points: Meeting moved to Friday");
  });

  it("removes conditional blocks when optional field is empty", () => {
    const flow: GuidedFlow = {
      fields: [
        { type: "textarea", label: "Reply to", optional: true },
        { type: "textarea", label: "Key points" },
      ],
      prompt_template: "Write an email.{{#if reply_to}} Replying to: {{reply_to}}{{/if}} Points: {{key_points}}",
    };
    const values = { reply_to: "", key_points: "Budget update" };
    const result = buildPrompt(flow, values);
    expect(result).toBe("Write an email. Points: Budget update");
  });

  it("keeps conditional blocks when optional field has value", () => {
    const flow: GuidedFlow = {
      fields: [
        { type: "textarea", label: "Reply to", optional: true },
        { type: "textarea", label: "Key points" },
      ],
      prompt_template: "Write an email.{{#if reply_to}} Replying to: {{reply_to}}{{/if}} Points: {{key_points}}",
    };
    const values = { reply_to: "Hi team, are we on track?", key_points: "Yes" };
    const result = buildPrompt(flow, values);
    expect(result).toBe("Write an email. Replying to: Hi team, are we on track? Points: Yes");
  });
});

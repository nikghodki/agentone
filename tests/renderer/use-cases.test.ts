import { describe, it, expect } from "vitest";
import { USE_CASES, buildPrompt, UseCase } from "../../src/shared/use-cases";

describe("buildPrompt", () => {
  const sampleUseCase: UseCase = {
    id: "test",
    title: "Test",
    description: "Test",
    category: "test",
    fields: [
      { key: "topic", label: "Topic", type: "text" },
      { key: "detail", label: "Detail", type: "textarea", optional: true },
    ],
    template: "Research {topic} and provide {detail}.",
  };

  it("substitutes provided values into placeholders", () => {
    const result = buildPrompt(sampleUseCase, {
      topic: "AI agents",
      detail: "examples",
    });
    expect(result).toBe("Research AI agents and provide examples.");
  });

  it("trims values before substitution", () => {
    const result = buildPrompt(sampleUseCase, {
      topic: "  AI agents  ",
      detail: "  examples  ",
    });
    expect(result).toBe("Research AI agents and provide examples.");
  });

  it("collapses optional empty field without leftover placeholder", () => {
    const uc: UseCase = {
      ...sampleUseCase,
      template: "Research {topic}. Include {detail}",
    };
    const result = buildPrompt(uc, { topic: "AI agents", detail: "" });

    // Should not contain {detail} or "Include "
    expect(result).not.toContain("{detail}");
    expect(result).not.toContain("Include ");
    expect(result).toContain("AI agents");
  });

  it("removes optional placeholder cleanly without dangling artifacts", () => {
    const uc: UseCase = {
      ...sampleUseCase,
      fields: [
        { key: "topic", label: "Topic", type: "text" },
        { key: "tone", label: "Tone", type: "text", optional: true },
      ],
      template: "Write about {topic}{tone}.",
    };
    const result = buildPrompt(uc, { topic: "AI", tone: "" });

    expect(result).toBe("Write about AI.");
    expect(result).not.toContain("{tone}");
  });

  it("keeps filled optional field value", () => {
    const result = buildPrompt(sampleUseCase, {
      topic: "AI agents",
      detail: "detailed examples",
    });
    expect(result).toContain("detailed examples");
  });

  it("handles multiple empty optional fields", () => {
    const uc: UseCase = {
      ...sampleUseCase,
      fields: [
        { key: "topic", label: "Topic", type: "text" },
        { key: "opt1", label: "Opt1", type: "text", optional: true },
        { key: "opt2", label: "Opt2", type: "text", optional: true },
      ],
      template: "Topic: {topic}. {opt1} {opt2}",
    };
    const result = buildPrompt(uc, { topic: "Test", opt1: "", opt2: "" });

    expect(result).not.toContain("{opt1}");
    expect(result).not.toContain("{opt2}");
    expect(result).toContain("Test");
  });

  it("preserves trailing sentence when optional field is empty (no clause deletion)", () => {
    const uc: UseCase = {
      ...sampleUseCase,
      fields: [
        { key: "x", label: "X", type: "text" },
        { key: "opt", label: "Opt", type: "text", optional: true },
      ],
      template: "Do X. {opt} Do Y.",
    };
    const result = buildPrompt(uc, { x: "something", opt: "" });

    expect(result).toBe("Do X. Do Y.");
    expect(result).not.toContain("{opt}");
    expect(result).not.toContain("  "); // No double space
  });

  it("write-code use case with empty language keeps 'Explain how it works'", () => {
    const writeCode = USE_CASES.find((uc) => uc.id === "write-code");
    expect(writeCode).toBeDefined();

    const result = buildPrompt(writeCode!, {
      task: "sort an array",
      language: "",
    });

    expect(result).toContain("Explain how it works");
    expect(result).not.toContain("{language}");
    expect(result).not.toContain("  "); // No double space
    expect(result).not.toMatch(/\s\./); // No space before period
  });

  it("preserves newlines and paragraph breaks in multiline content (Important 1)", () => {
    const uc: UseCase = {
      ...sampleUseCase,
      fields: [{ key: "content", label: "Content", type: "textarea" }],
      template: "Process this:\n\n{content}",
    };
    const multilineValue = "First paragraph\n\nSecond paragraph\n  indented line";
    const result = buildPrompt(uc, { content: multilineValue });

    expect(result).toContain("\n\n"); // Paragraph break preserved
    expect(result).toContain("First paragraph");
    expect(result).toContain("Second paragraph");
    expect(result).toContain("indented line");
  });

  it("optional-segment syntax: removes whole segment when field empty (Important 2)", () => {
    const uc: UseCase = {
      ...sampleUseCase,
      fields: [
        { key: "task", label: "Task", type: "text" },
        { key: "tone", label: "Tone", type: "text", optional: true },
      ],
      template: "Do this[[ with {tone} tone]]: {task}",
    };
    const result = buildPrompt(uc, { task: "write code", tone: "" });

    expect(result).toBe("Do this: write code");
    expect(result).not.toContain("with");
    expect(result).not.toContain("tone");
    expect(result).not.toContain("{tone}");
  });

  it("optional-segment syntax: keeps segment when field filled (Important 2)", () => {
    const uc: UseCase = {
      ...sampleUseCase,
      fields: [
        { key: "task", label: "Task", type: "text" },
        { key: "tone", label: "Tone", type: "text", optional: true },
      ],
      template: "Do this[[ with {tone} tone]]: {task}",
    };
    const result = buildPrompt(uc, { task: "write code", tone: "formal" });

    expect(result).toBe("Do this with formal tone: write code");
    expect(result).not.toContain("[[");
    expect(result).not.toContain("]]");
  });

  it("write-code with filled language reads correctly (Important 2)", () => {
    const writeCode = USE_CASES.find((uc) => uc.id === "write-code");
    expect(writeCode).toBeDefined();

    const result = buildPrompt(writeCode!, {
      task: "sort an array",
      language: "Python",
    });

    expect(result).toContain("Python");
    expect(result).toContain("Explain how it works");
    expect(result).not.toContain("code in in"); // No duplication
    expect(result).not.toContain("codePython"); // Has space
  });
});

describe("USE_CASES catalog", () => {
  it("has approximately 10 entries", () => {
    expect(USE_CASES.length).toBeGreaterThanOrEqual(8);
    expect(USE_CASES.length).toBeLessThanOrEqual(12);
  });

  it("each use case has required fields", () => {
    USE_CASES.forEach((uc) => {
      expect(uc.id).toBeTruthy();
      expect(uc.title).toBeTruthy();
      expect(uc.description).toBeTruthy();
      expect(uc.category).toBeTruthy();
      expect(Array.isArray(uc.fields)).toBe(true);
      expect(uc.fields.length).toBeGreaterThan(0);
      expect(uc.template).toBeTruthy();
    });
  });

  it("every template placeholder has a matching field key (no orphan placeholders)", () => {
    USE_CASES.forEach((uc) => {
      // Extract all {placeholder} patterns from template
      const placeholders = uc.template.match(/\{(\w+)\}/g) || [];
      const placeholderKeys = placeholders.map((p) =>
        p.replace(/[{}]/g, "")
      );

      // Get all field keys
      const fieldKeys = uc.fields.map((f) => f.key);

      // Every placeholder must have a matching field
      placeholderKeys.forEach((key) => {
        expect(
          fieldKeys,
          `Use case "${uc.id}" has orphan placeholder {${key}}`
        ).toContain(key);
      });
    });
  });

  it("fields have valid types", () => {
    const validTypes = ["text", "textarea", "select"];
    USE_CASES.forEach((uc) => {
      uc.fields.forEach((field) => {
        expect(validTypes).toContain(field.type);
        if (field.type === "select") {
          expect(Array.isArray(field.options)).toBe(true);
          expect(field.options!.length).toBeGreaterThan(0);
        }
      });
    });
  });
});

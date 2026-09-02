import { describe, it, expect } from "vitest";
import { USE_CASES, buildPrompt, UseCase, useCasesForFramework } from "../../src/shared/use-cases";

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

  it("summarize use case assembles prompt correctly", () => {
    const summarize = USE_CASES.find((uc) => uc.id === "summarize");
    expect(summarize).toBeDefined();

    const result = buildPrompt(summarize!, {
      content: "Long article about AI developments...",
    });

    expect(result).toContain("Long article about AI developments");
    expect(result).toContain("Summarize this for me");
    expect(result).not.toContain("{content}");
    expect(result).not.toContain("  "); // No double space
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

  it("reply-message use case with select field assembles correctly", () => {
    const replyMessage = USE_CASES.find((uc) => uc.id === "reply-message");
    expect(replyMessage).toBeDefined();

    const result = buildPrompt(replyMessage!, {
      message: "Can we meet tomorrow?",
      intent: "say yes and suggest 2pm",
      tone: "friendly",
    });

    expect(result).toContain("Can we meet tomorrow?");
    expect(result).toContain("say yes and suggest 2pm");
    expect(result).toContain("friendly");
    expect(result).not.toContain("{message}");
    expect(result).not.toContain("{intent}");
    expect(result).not.toContain("{tone}");
  });
});

describe("USE_CASES catalog", () => {
  it("has approximately 13 entries (10 universal + 3 tailored)", () => {
    expect(USE_CASES.length).toBeGreaterThanOrEqual(10);
    expect(USE_CASES.length).toBeLessThanOrEqual(15);
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

describe("Per-framework tailored use cases", () => {
  it("catalog has 13 use cases (10 universal + 3 tailored)", () => {
    expect(USE_CASES.length).toBe(13);
  });

  it("first 10 use cases have NO frameworks field (universal)", () => {
    const first10 = USE_CASES.slice(0, 10);
    first10.forEach((uc) => {
      expect(
        uc.frameworks === undefined || uc.frameworks.length === 0,
        `Use case "${uc.id}" should be universal (no frameworks field)`
      ).toBe(true);
    });
  });

  it("browse-url tailored for hermes exists with correct structure", () => {
    const browseUrl = USE_CASES.find((uc) => uc.id === "browse-url");
    expect(browseUrl).toBeDefined();
    expect(browseUrl!.title).toBe("Look something up on a live website");
    expect(browseUrl!.category).toBe("research");
    expect(browseUrl!.frameworks).toEqual(["hermes"]);
    expect(browseUrl!.fields.length).toBe(2);
    expect(browseUrl!.fields[0].key).toBe("url");
    expect(browseUrl!.fields[1].key).toBe("task");
    expect(browseUrl!.template).toContain("{url}");
    expect(browseUrl!.template).toContain("{task}");
  });

  it("remember-info tailored for zeptoclaw exists with correct structure", () => {
    const rememberInfo = USE_CASES.find((uc) => uc.id === "remember-info");
    expect(rememberInfo).toBeDefined();
    expect(rememberInfo!.title).toBe("Remember this for me");
    expect(rememberInfo!.category).toBe("personal");
    expect(rememberInfo!.frameworks).toEqual(["zeptoclaw"]);
    expect(rememberInfo!.fields.length).toBe(1);
    expect(rememberInfo!.fields[0].key).toBe("info");
    expect(rememberInfo!.template).toContain("{info}");
  });

  it("terminal-task tailored for openclaw exists with correct structure", () => {
    const terminalTask = USE_CASES.find((uc) => uc.id === "terminal-task");
    expect(terminalTask).toBeDefined();
    expect(terminalTask!.title).toBe("Get something done on my computer");
    expect(terminalTask!.category).toBe("productivity");
    expect(terminalTask!.frameworks).toEqual(["openclaw"]);
    expect(terminalTask!.fields.length).toBe(1);
    expect(terminalTask!.fields[0].key).toBe("task");
    expect(terminalTask!.template).toContain("{task}");
  });

  it("useCasesForFramework(hermes) returns universal + browse-url only", () => {
    const result = useCasesForFramework("hermes");

    // Should include all 10 universal cases
    expect(result.length).toBe(11);

    // Should include browse-url
    const hasBrowseUrl = result.some((uc) => uc.id === "browse-url");
    expect(hasBrowseUrl).toBe(true);

    // Should NOT include the other tailored cases
    const hasRememberInfo = result.some((uc) => uc.id === "remember-info");
    const hasTerminalTask = result.some((uc) => uc.id === "terminal-task");
    expect(hasRememberInfo).toBe(false);
    expect(hasTerminalTask).toBe(false);
  });

  it("useCasesForFramework(zeptoclaw) returns universal + remember-info only", () => {
    const result = useCasesForFramework("zeptoclaw");

    // Should include all 10 universal + 1 tailored
    expect(result.length).toBe(11);

    // Should include remember-info
    const hasRememberInfo = result.some((uc) => uc.id === "remember-info");
    expect(hasRememberInfo).toBe(true);

    // Should NOT include the other tailored cases
    const hasBrowseUrl = result.some((uc) => uc.id === "browse-url");
    const hasTerminalTask = result.some((uc) => uc.id === "terminal-task");
    expect(hasBrowseUrl).toBe(false);
    expect(hasTerminalTask).toBe(false);
  });

  it("useCasesForFramework(openclaw) returns universal + terminal-task only", () => {
    const result = useCasesForFramework("openclaw");

    // Should include all 10 universal + 1 tailored
    expect(result.length).toBe(11);

    // Should include terminal-task
    const hasTerminalTask = result.some((uc) => uc.id === "terminal-task");
    expect(hasTerminalTask).toBe(true);

    // Should NOT include the other tailored cases
    const hasBrowseUrl = result.some((uc) => uc.id === "browse-url");
    const hasRememberInfo = result.some((uc) => uc.id === "remember-info");
    expect(hasBrowseUrl).toBe(false);
    expect(hasRememberInfo).toBe(false);
  });

  it("useCasesForFramework(unknown) returns only the 10 universal cases", () => {
    const result = useCasesForFramework("unknown-framework");

    // Should only include universal cases
    expect(result.length).toBe(10);

    // Should NOT include any tailored cases
    const hasBrowseUrl = result.some((uc) => uc.id === "browse-url");
    const hasRememberInfo = result.some((uc) => uc.id === "remember-info");
    const hasTerminalTask = result.some((uc) => uc.id === "terminal-task");
    expect(hasBrowseUrl).toBe(false);
    expect(hasRememberInfo).toBe(false);
    expect(hasTerminalTask).toBe(false);
  });
});

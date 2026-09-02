export interface UseCaseField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
  optional?: boolean;
}

export interface UseCase {
  id: string;
  title: string;
  description: string;
  category: string;
  fields: UseCaseField[];
  template: string;
  frameworks?: string[];  // absent/empty = universal (shown for all frameworks)
}

export const USE_CASES: UseCase[] = [
  {
    id: "research",
    title: "Research a topic",
    description: "Get comprehensive information on any subject with sources",
    category: "research",
    fields: [
      {
        key: "topic",
        label: "Topic",
        type: "text",
        placeholder: "e.g., quantum computing, climate change",
      },
      {
        key: "depth",
        label: "Depth",
        type: "select",
        options: ["a quick overview", "detailed analysis", "comprehensive report"],
      },
    ],
    template: "Research {topic} and give me {depth} with sources.",
  },
  {
    id: "summarize",
    title: "Summarize a document",
    description: "Get concise summaries of long content or URLs",
    category: "research",
    fields: [
      {
        key: "content",
        label: "Content or URL",
        type: "textarea",
        placeholder: "Paste text or provide a URL to summarize",
      },
      {
        key: "length",
        label: "Length",
        type: "select",
        options: ["brief", "moderate", "detailed"],
      },
    ],
    template: "Summarize the following in a {length} format:\n\n{content}",
  },
  {
    id: "draft-message",
    title: "Draft an email or message",
    description: "Compose professional or casual messages",
    category: "writing",
    fields: [
      {
        key: "purpose",
        label: "Purpose",
        type: "text",
        placeholder: "e.g., follow-up meeting, project update",
      },
      {
        key: "tone",
        label: "Tone",
        type: "select",
        options: ["professional", "casual", "friendly", "formal"],
      },
      {
        key: "details",
        label: "Key details",
        type: "textarea",
        placeholder: "Any specific points to include",
        optional: true,
      },
    ],
    template: "Draft a {tone} message for {purpose}. {details}",
  },
  {
    id: "write-code",
    title: "Write and explain code",
    description: "Generate code snippets with explanations",
    category: "coding",
    fields: [
      {
        key: "task",
        label: "Task",
        type: "textarea",
        placeholder: "Describe what the code should do",
      },
      {
        key: "language",
        label: "Language",
        type: "text",
        placeholder: "e.g., Python, JavaScript, TypeScript",
        optional: true,
      },
    ],
    template: "Write code[[ in {language}]] to {task}. Explain how it works.",
  },
  {
    id: "debug",
    title: "Debug an error",
    description: "Get help understanding and fixing errors",
    category: "coding",
    fields: [
      {
        key: "error",
        label: "Error message or code",
        type: "textarea",
        placeholder: "Paste the error message or problematic code",
      },
      {
        key: "context",
        label: "Context",
        type: "textarea",
        placeholder: "What were you trying to do?",
        optional: true,
      },
    ],
    template: "Help me debug this error: {error} {context}",
  },
  {
    id: "plan-project",
    title: "Plan a project or checklist",
    description: "Break down goals into actionable steps",
    category: "planning",
    fields: [
      {
        key: "goal",
        label: "Goal",
        type: "text",
        placeholder: "e.g., launch a website, organize an event",
      },
      {
        key: "constraints",
        label: "Constraints",
        type: "textarea",
        placeholder: "Timeline, budget, or other limitations",
        optional: true,
      },
    ],
    template: "Create a detailed plan to {goal}. {constraints}",
  },
  {
    id: "brainstorm",
    title: "Brainstorm ideas",
    description: "Generate creative solutions and options",
    category: "creative",
    fields: [
      {
        key: "topic",
        label: "Topic",
        type: "text",
        placeholder: "What do you need ideas for?",
      },
      {
        key: "count",
        label: "Number of ideas",
        type: "select",
        options: ["5", "10", "15"],
      },
    ],
    template: "Brainstorm {count} creative ideas for {topic}.",
  },
  {
    id: "analyze-data",
    title: "Analyze data or CSV",
    description: "Get insights from structured data",
    category: "analysis",
    fields: [
      {
        key: "data",
        label: "Data or description",
        type: "textarea",
        placeholder: "Paste CSV data or describe the dataset",
      },
      {
        key: "question",
        label: "Question",
        type: "text",
        placeholder: "What do you want to learn from this data?",
        optional: true,
      },
    ],
    template: "Analyze this data and provide insights: {data} {question}",
  },
  {
    id: "rewrite-text",
    title: "Rewrite or adjust tone",
    description: "Transform text to match a different style",
    category: "writing",
    fields: [
      {
        key: "text",
        label: "Text",
        type: "textarea",
        placeholder: "Paste the text to rewrite",
      },
      {
        key: "target",
        label: "Target tone or style",
        type: "select",
        options: ["more professional", "more casual", "simpler", "more detailed"],
      },
    ],
    template: "Rewrite this text to be {target}:\n\n{text}",
  },
  {
    id: "answer-from-notes",
    title: "Answer questions from notes",
    description: "Extract answers from your documents or notes",
    category: "research",
    fields: [
      {
        key: "notes",
        label: "Notes or documents",
        type: "textarea",
        placeholder: "Paste your notes, documents, or context",
      },
      {
        key: "question",
        label: "Question",
        type: "text",
        placeholder: "What do you want to know?",
      },
    ],
    template: "Based on these notes:\n\n{notes}\n\nAnswer: {question}",
  },
  {
    id: "browse-url",
    title: "Browse a live web page",
    description: "Open and interact with web pages using browser tools",
    category: "research",
    fields: [
      {
        key: "url",
        label: "Page URL",
        type: "text",
        placeholder: "https://…",
      },
      {
        key: "task",
        label: "What should the agent do?",
        type: "textarea",
        placeholder: "e.g. summarize the pricing tiers",
      },
    ],
    template: "Open the web page at {url} and {task}. Summarize what you find with the key details.",
    frameworks: ["hermes"],
  },
  {
    id: "remember-info",
    title: "Remember something for later",
    description: "Store information in long-term memory",
    category: "productivity",
    fields: [
      {
        key: "info",
        label: "What to remember",
        type: "textarea",
        placeholder: "e.g. My project deadline is Oct 3",
      },
    ],
    template: "Remember the following for future reference: {info}. Store it in your long-term memory and confirm.",
    frameworks: ["zeptoclaw"],
  },
  {
    id: "terminal-task",
    title: "Automate a terminal task",
    description: "Execute terminal commands to accomplish tasks",
    category: "coding",
    fields: [
      {
        key: "task",
        label: "Terminal task",
        type: "textarea",
        placeholder: "e.g. find and delete all .tmp files in ~/downloads",
      },
    ],
    template: "Using your terminal tool, {task}. Show the commands you run and the result.",
    frameworks: ["openclaw"],
  },
];

export function buildPrompt(
  useCase: UseCase,
  values: Record<string, string>
): string {
  let result = useCase.template;

  // Step 1: Handle optional segments [[ ... ]]
  // Find all segments and process them
  result = result.replace(/\[\[(.*?)\]\]/g, (match, content) => {
    // Extract field references inside this segment
    const fieldRefsInSegment = content.match(/\{(\w+)\}/g) || [];
    const fieldKeysInSegment = fieldRefsInSegment.map((ref: string) =>
      ref.replace(/[{}]/g, "")
    );

    // Check if ALL fields in this segment are empty
    const allEmpty = fieldKeysInSegment.every((key: string) => {
      const value = (values[key] || "").trim();
      return !value;
    });

    if (allEmpty) {
      // Remove the entire segment
      return "";
    } else {
      // Keep the content but remove the [[ ]] markers
      return content;
    }
  });

  // Step 2: Substitute filled values with trimmed values
  useCase.fields.forEach((field) => {
    const value = (values[field.key] || "").trim();
    if (value) {
      result = result.replace(new RegExp(`\\{${field.key}\\}`, "g"), value);
    }
  });

  // Step 3: Remove empty optional field placeholders (just the token itself)
  useCase.fields.forEach((field) => {
    const value = (values[field.key] || "").trim();
    if (!value && field.optional) {
      // Simply remove the placeholder
      result = result.replace(new RegExp(`\\{${field.key}\\}`, "g"), "");
    }
  });

  // Step 4: Normalize whitespace and punctuation (preserve newlines!)
  result = result
    .replace(/[ \t]{2,}/g, " ")              // Collapse runs of spaces/tabs (NOT newlines)
    .replace(/\s+([.,!?;:])/g, "$1")         // Remove space before punctuation
    .replace(/\n{3,}/g, "\n\n")              // Max two consecutive newlines
    .trim();

  return result;
}

export function useCasesForFramework(frameworkId: string): UseCase[] {
  return USE_CASES.filter((uc) => {
    // Universal cases (no frameworks field or empty array) are shown for all frameworks
    if (!uc.frameworks || uc.frameworks.length === 0) {
      return true;
    }
    // Framework-specific cases are shown only for that framework
    return uc.frameworks.includes(frameworkId);
  });
}

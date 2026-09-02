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
    template: "Write code to {task}. {language} Explain how it works.",
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
];

export function buildPrompt(
  useCase: UseCase,
  values: Record<string, string>
): string {
  let result = useCase.template;

  // Step 1: Substitute all filled values (required and optional)
  useCase.fields.forEach((field) => {
    const value = (values[field.key] || "").trim();
    if (value) {
      result = result.replace(new RegExp(`\\{${field.key}\\}`, "g"), value);
    }
  });

  // Step 2: Remove optional empty placeholders with smart cleanup
  useCase.fields.forEach((field) => {
    const value = (values[field.key] || "").trim();
    if (!value && field.optional) {
      const placeholderRegex = `\\{${field.key}\\}`;

      // Try different removal patterns in order of specificity

      // Pattern 1: Sentence after period (e.g., ". Include {detail}")
      result = result.replace(
        new RegExp(`\\.\\s+[^.!?]*${placeholderRegex}[^.!?]*`, "g"),
        "."
      );

      // Pattern 2: Beginning of new line/sentence with capital letter
      result = result.replace(
        new RegExp(`\\n+\\s*[A-Z][^.!?\\n]*${placeholderRegex}[^.!?]*`, "g"),
        ""
      );

      // Pattern 3: After newline (for paragraph breaks)
      result = result.replace(
        new RegExp(`\\n+[^\\n]*${placeholderRegex}[^\\n]*`, "g"),
        ""
      );

      // Pattern 4: Just the placeholder itself
      result = result.replace(new RegExp(placeholderRegex, "g"), "");
    }
  });

  // Step 3: Clean up whitespace and punctuation artifacts
  result = result
    .replace(/\s{2,}/g, " ")            // Multiple spaces -> single space
    .replace(/\s+\n/g, "\n")            // Trailing space before newline
    .replace(/\n{3,}/g, "\n\n")         // Multiple newlines -> double newline
    .replace(/\s+([.,!?])/g, "$1")      // Space before punctuation
    .replace(/\.\s*\./g, ".")           // Double periods
    .replace(/^\s+|\s+$/g, "")          // Trim start and end
    .trim();

  return result;
}

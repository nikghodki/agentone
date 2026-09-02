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
    id: "plan-day",
    title: "Plan my day",
    description: "Turn your to-dos into a realistic, prioritized plan",
    category: "planning",
    fields: [
      {
        key: "tasks",
        label: "What's on your plate today?",
        type: "textarea",
        placeholder: "Everything you're hoping to get done — just dump it here",
      },
      {
        key: "fixed",
        label: "Fixed commitments",
        type: "text",
        placeholder: "e.g. 2pm dentist, standup at 9:30",
        optional: true,
      },
    ],
    template:
      "Here's everything on my plate today:\n\n{tasks}[[\n\nFixed commitments I have to work around: {fixed}]]\n\nHelp me plan the day: prioritize what matters most, lay it out in a realistic order with rough time blocks, and tell me what to drop or push if it won't all fit.",
  },
  {
    id: "reply-message",
    title: "Reply to a message for me",
    description: "Get a ready-to-send reply in the tone you want",
    category: "communication",
    fields: [
      {
        key: "message",
        label: "The message you received",
        type: "textarea",
        placeholder: "Paste the message you need to reply to",
      },
      {
        key: "intent",
        label: "What do you want to say back?",
        type: "text",
        placeholder: "e.g. say yes but push the date to next week",
      },
      {
        key: "tone",
        label: "Tone",
        type: "select",
        options: ["friendly", "professional", "direct", "warm", "apologetic"],
      },
    ],
    template:
      "Someone sent me this:\n\n{message}\n\nWrite a reply that does this: {intent}. Tone: {tone}. Make it sound natural and ready to send as-is.",
  },
  {
    id: "decide",
    title: "Help me make a decision",
    description: "Weigh your options and get a clear recommendation",
    category: "decisions",
    fields: [
      {
        key: "decision",
        label: "What are you deciding?",
        type: "text",
        placeholder: "e.g. which job offer to take",
      },
      {
        key: "options",
        label: "Your options",
        type: "textarea",
        placeholder: "List the options you're weighing",
      },
      {
        key: "priorities",
        label: "What matters most to you?",
        type: "text",
        placeholder: "e.g. work-life balance, pay, growth",
        optional: true,
      },
    ],
    template:
      "I'm trying to decide: {decision}\n\nMy options:\n{options}[[\n\nWhat matters most to me: {priorities}]]\n\nWeigh the tradeoffs honestly and give me a clear recommendation with a short reason why.",
  },
  {
    id: "explain-simply",
    title: "Explain something simply",
    description: "Make sense of anything confusing, fast",
    category: "learning",
    fields: [
      {
        key: "topic",
        label: "What should I explain?",
        type: "textarea",
        placeholder: "Paste the text, or describe the thing you want explained",
      },
      {
        key: "level",
        label: "How should I explain it?",
        type: "select",
        options: [
          "like I'm busy",
          "like I'm 12",
          "in a beginner-friendly way",
          "with more depth",
        ],
      },
    ],
    template:
      "Explain this {level}:\n\n{topic}\n\nFinish with the one thing I actually need to know or do about it.",
  },
  {
    id: "brain-dump-to-checklist",
    title: "Turn my brain-dump into a checklist",
    description: "Get everything out of your head and organized",
    category: "planning",
    fields: [
      {
        key: "braindump",
        label: "Brain-dump",
        type: "textarea",
        placeholder: "Dump everything on your mind, however messy",
      },
    ],
    template:
      "Here's a messy brain-dump of everything in my head:\n\n{braindump}\n\nTurn it into a clean, organized checklist — group related items together and put the most important things first.",
  },
  {
    id: "tough-message",
    title: "Draft a message I'm avoiding",
    description: "Write the awkward message you've been putting off",
    category: "communication",
    fields: [
      {
        key: "situation",
        label: "Who's it for and what's going on?",
        type: "textarea",
        placeholder: "e.g. telling my landlord the rent will be a few days late",
      },
      {
        key: "goal",
        label: "What do you need to happen?",
        type: "text",
        placeholder: "e.g. buy myself until Friday without drama",
      },
      {
        key: "tone",
        label: "Tone",
        type: "select",
        options: ["polite", "firm", "warm", "apologetic"],
      },
    ],
    template:
      "I need to send a message I've been avoiding.\n\nSituation: {situation}\nWhat I need to happen: {goal}\n\nDraft it for me — {tone}, clear, and not awkward. Ready to send.",
  },
  {
    id: "research-choice",
    title: "Research before I buy or commit",
    description: "Get a shortlist and the tradeoffs before you spend",
    category: "decisions",
    fields: [
      {
        key: "subject",
        label: "What are you considering?",
        type: "text",
        placeholder: "e.g. a budget espresso machine, a CRM for a small team",
      },
      {
        key: "context",
        label: "Your needs / budget",
        type: "textarea",
        placeholder: "e.g. under $300, easy to clean, for daily use",
        optional: true,
      },
    ],
    template:
      "I'm researching {subject} before I commit.[[\n\nMy needs and constraints: {context}]]\n\nGive me a shortlist of solid options, the key tradeoffs between them, what to watch out for, and which one you'd pick and why.",
  },
  {
    id: "summarize",
    title: "Summarize this for me",
    description: "TL;DR, key points, and action items from anything long",
    category: "productivity",
    fields: [
      {
        key: "content",
        label: "Paste the text, notes, or a link",
        type: "textarea",
        placeholder: "Paste an article, email thread, notes, or a URL",
      },
    ],
    template:
      "Summarize this for me:\n\n{content}\n\nGive me a 2–3 sentence TL;DR first, then the key points as bullets, then any action items or next steps I should take.",
  },
  {
    id: "prep-for",
    title: "Prep me for something",
    description: "Walk in ready for a meeting, call, or interview",
    category: "productivity",
    fields: [
      {
        key: "event",
        label: "What's coming up?",
        type: "text",
        placeholder: "e.g. a first call with a new client, a job interview",
      },
      {
        key: "details",
        label: "Any details",
        type: "textarea",
        placeholder: "Who's involved, what it's about, anything on your mind",
        optional: true,
      },
    ],
    template:
      "I have this coming up: {event}[[\n\nDetails: {details}]]\n\nHelp me prepare: what should I know going in, what smart questions should I ask, and what's the one outcome I should aim for?",
  },
  {
    id: "rewrite-text",
    title: "Make my writing better",
    description: "Polish anything you've written",
    category: "communication",
    fields: [
      {
        key: "text",
        label: "What you wrote",
        type: "textarea",
        placeholder: "Paste your draft",
      },
      {
        key: "goal",
        label: "Make it",
        type: "select",
        options: ["clearer", "shorter", "warmer", "more professional", "more confident"],
      },
    ],
    template:
      "Rewrite this to be {goal}, keeping what I mean and my voice:\n\n{text}",
  },
  {
    id: "browse-url",
    title: "Look something up on a live website",
    description: "Have the agent open a page and pull out what you need",
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
        label: "What do you want to know from it?",
        type: "textarea",
        placeholder: "e.g. the pricing tiers and what's included in each",
      },
    ],
    template:
      "Open the web page at {url} and find this for me: {task}. Give me the key details and a quick take.",
    frameworks: ["hermes"],
  },
  {
    id: "remember-info",
    title: "Remember this for me",
    description: "Have the agent hold on to something for later",
    category: "personal",
    fields: [
      {
        key: "info",
        label: "What should it remember?",
        type: "textarea",
        placeholder: "e.g. My partner's birthday is March 14 and she loves peonies",
      },
    ],
    template:
      "Remember this for me: {info}. Store it in your long-term memory and confirm you've got it.",
    frameworks: ["zeptoclaw"],
  },
  {
    id: "terminal-task",
    title: "Get something done on my computer",
    description: "Have the agent handle a task using its terminal tool",
    category: "productivity",
    fields: [
      {
        key: "task",
        label: "What do you want done?",
        type: "textarea",
        placeholder: "e.g. organize my Downloads folder into subfolders by file type",
      },
    ],
    template:
      "Using your terminal tool, {task}. Walk me through what you did.",
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

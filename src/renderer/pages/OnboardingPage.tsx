import { useState } from "react";
import { useAppStore } from "../store";

const PERSONAS = [
  { id: "student", name: "Student", icon: "🎓", desc: "Homework, studying, essays" },
  { id: "professional", name: "Working Professional", icon: "💼", desc: "Emails, meetings, productivity" },
  { id: "parent", name: "Parent / Family", icon: "❤️", desc: "Kids, homework help, planning" },
  { id: "small-business", name: "Small Business Owner", icon: "🏪", desc: "Marketing, customer service, content" },
];

const PRIORITIES_BY_PERSONA: Record<string, string[]> = {
  student: ["Summarize lecture notes", "Study for exams", "Write better essays", "Get homework help", "Proofread my writing", "Learn new concepts", "Stay organized"],
  professional: ["Save time on emails", "Write better documents", "Prepare for meetings", "Analyze data & reports", "Brainstorm ideas", "Learn new skills", "Stay organized"],
  parent: ["Help kids with homework", "Explain things to my kids", "Plan family activities", "Communicate with school", "Meal planning", "Stay organized"],
  "small-business": ["Write product descriptions", "Handle customer reviews", "Create social media content", "Draft professional messages", "Marketing ideas", "Save time on admin"],
};

export function OnboardingPage() {
  const { view, selectPersona, selectedPersonaId, setPriorities, setView } = useAppStore();
  const [selectedPriorities, setLocalPriorities] = useState<string[]>([]);

  const isPersonaStep = view === "onboarding-persona";

  async function handlePersonaSelect(id: string) {
    selectPersona(id);
    setView("onboarding-priorities");
  }

  function togglePriority(p: string) {
    setLocalPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : prev.length < 3 ? [...prev, p] : prev
    );
  }

  async function handleFinish() {
    if (!selectedPersonaId) return;
    setPriorities(selectedPriorities);

    await window.electronAPI.dbSaveProfile({
      persona: selectedPersonaId,
      priorities: selectedPriorities,
      licenseKey: null,
      licenseValidUntil: null,
    });

    setView("dashboard");
  }

  if (isPersonaStep) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h2 className="text-2xl font-bold mb-2">Who are you?</h2>
        <p className="text-zinc-400 mb-8">This helps me suggest the right things for you.</p>
        <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePersonaSelect(p.id)}
              className="flex items-center gap-3 p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-blue-500 hover:bg-zinc-800 transition-colors text-left"
            >
              <span className="text-2xl">{p.icon}</span>
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-zinc-500">{p.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const priorities = PRIORITIES_BY_PERSONA[selectedPersonaId || "student"] || [];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h2 className="text-2xl font-bold mb-2">What matters most?</h2>
      <p className="text-zinc-400 mb-8">Pick up to 3 — I'll prioritize these for you.</p>
      <div className="flex flex-col gap-2 max-w-md w-full mb-8">
        {priorities.map((p) => (
          <button
            key={p}
            onClick={() => togglePriority(p)}
            className={`p-3 rounded-lg border text-left text-sm transition-colors ${
              selectedPriorities.includes(p)
                ? "border-blue-500 bg-blue-500/10 text-blue-300"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        onClick={handleFinish}
        disabled={selectedPriorities.length === 0}
        className="px-6 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}

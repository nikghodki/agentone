import { useState } from "react";
import { useAppStore } from "../store";
import { getPersonaById } from "../lib/persona-loader";
import { buildPrompt, collectFlowValues } from "../lib/prompt-builder";
import { GuidedFlowForm } from "../components/GuidedFlowForm";
import { StreamingText } from "../components/StreamingText";
import { useLLM } from "../hooks/use-llm";

export function GuidedTaskPage() {
  const { guidedTaskContext, setView, isGenerating, streamingText, clearStreamingText } =
    useAppStore();
  const { generate } = useLLM();
  const [result, setResult] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!guidedTaskContext) {
    setView("dashboard");
    return null;
  }

  const persona = getPersonaById(guidedTaskContext.personaId);
  const task = persona?.tasks.find((t) => t.id === guidedTaskContext.taskId);

  if (!persona || !task) {
    setView("dashboard");
    return null;
  }

  async function handleSubmit(formValues: Record<string, string>) {
    setResult(null);
    clearStreamingText();

    const values = collectFlowValues(task!.guided_flow, formValues);
    const prompt = buildPrompt(task!.guided_flow, values);

    const conv = await window.electronAPI.dbCreateConversation(task!.id);
    setConversationId(conv.id);

    await window.electronAPI.dbRecordTaskUsage({
      taskId: task!.id,
      persona: persona!.id,
      startedAt: new Date().toISOString(),
      completed: true,
      durationSeconds: null,
    });

    const fullResult = await generate(prompt, persona!.system_prompt, conv.id);
    setResult(fullResult);
  }

  async function handleRegenerate() {
    if (!conversationId) return;
    clearStreamingText();
    setResult(null);
    const fullResult = await generate("Please regenerate the previous response with a different approach.", persona!.system_prompt, conversationId);
    setResult(fullResult);
  }

  function handleCopy() {
    const text = result || streamingText;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <button
          onClick={() => { clearStreamingText(); setView("dashboard"); }}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium">{task.title}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        <GuidedFlowForm
          flow={task.guided_flow}
          onSubmit={handleSubmit}
          isGenerating={isGenerating}
        />

        {/* Streaming / Result */}
        <div className="mt-6">
          <StreamingText />
        </div>

        {/* Action buttons */}
        {result && !isGenerating && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
            <button
              onClick={handleRegenerate}
              className="px-4 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              Regenerate
            </button>
            <button
              onClick={() => {
                if (conversationId) {
                  useAppStore.getState().setCurrentConversationId(conversationId);
                  clearStreamingText();
                  setView("chat");
                }
              }}
              className="px-4 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              Edit in chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

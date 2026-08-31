import { useAppStore } from "../store";

export function StreamingText() {
  const text = useAppStore((s) => s.streamingText);
  const isGenerating = useAppStore((s) => s.isGenerating);

  if (!text && !isGenerating) return null;

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
      <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
        {text}
        {isGenerating && (
          <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  if (role === "system") return null;

  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
          role === "user"
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import { useAppStore } from "../store";
import { getPersonaById } from "../lib/persona-loader";
import { ChatMessage } from "../components/ChatMessage";
import { ChatInput } from "../components/ChatInput";
import { useLLM } from "../hooks/use-llm";
import type { Message } from "@shared/types";

const SUGGESTIONS = [
  "Rewrite this paragraph to sound more confident",
  "What are 5 ways to improve my morning routine?",
  "Explain quantum computing like I'm 10",
];

export function ChatPage() {
  const {
    currentConversationId,
    setCurrentConversationId,
    selectedPersonaId,
    setView,
    isGenerating,
    streamingText,
    clearStreamingText,
  } = useAppStore();

  const { generate } = useLLM();
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipLoadRef = useRef(false);

  const persona = selectedPersonaId ? getPersonaById(selectedPersonaId) : null;
  const systemPrompt = persona?.system_prompt || "You are a helpful AI assistant.";

  useEffect(() => {
    async function loadMessages() {
      if (currentConversationId && !skipLoadRef.current) {
        const msgs = await window.electronAPI.dbGetMessages(currentConversationId);
        setMessages(msgs);
      }
    }
    loadMessages();
  }, [currentConversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  async function handleSend(text: string) {
    let convId = currentConversationId;
    setErrorMsg(null);
    try {
      if (!convId) {
        skipLoadRef.current = true;
        const conv = await window.electronAPI.dbCreateConversation(null);
        convId = conv.id;
        setCurrentConversationId(convId);
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        conversationId: convId,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      clearStreamingText();

      const result = await generate(text, systemPrompt, convId);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        conversationId: convId,
        role: "assistant",
        content: result,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      clearStreamingText();
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong.");
    } finally {
      skipLoadRef.current = false;
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <button
          onClick={() => {
            clearStreamingText();
            setCurrentConversationId(null);
            setView("dashboard");
          }}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium">Chat</h2>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 && !isGenerating && (
          <div className="text-center text-zinc-500 mt-20">
            <p className="text-lg mb-2">Ask me anything</p>
            <p className="text-sm">Or try one of the suggestions below</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}

        {isGenerating && streamingText && (
          <ChatMessage role="assistant" content={streamingText + "█"} />
        )}

        {errorMsg && (
          <div className="mt-4 bg-red-950 border border-red-800 rounded-xl p-4 text-red-200">
            <span className="mr-2">⚠️</span>{errorMsg}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isGenerating}
        suggestions={messages.length === 0 ? SUGGESTIONS : undefined}
      />
    </div>
  );
}

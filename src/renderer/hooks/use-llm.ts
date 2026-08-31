import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store";

export function useLLM() {
  const {
    setIsGenerating,
    appendStreamingText,
    clearStreamingText,
    setRemainingGenerations,
  } = useAppStore();

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  const generate = useCallback(
    async (prompt: string, systemPrompt: string, conversationId: string): Promise<string> => {
      clearStreamingText();
      setIsGenerating(true);

      unsubRef.current = window.electronAPI.onGenerateToken((token) => {
        appendStreamingText(token);
      });

      try {
        const result = await window.electronAPI.generate(prompt, systemPrompt, conversationId);
        const remaining = await window.electronAPI.getRemainingGenerations();
        setRemainingGenerations(remaining);
        return result;
      } finally {
        setIsGenerating(false);
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
      }
    },
    [clearStreamingText, setIsGenerating, appendStreamingText, setRemainingGenerations]
  );

  return { generate };
}

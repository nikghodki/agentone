import { create } from "zustand";
import type { Persona, Conversation } from "@shared/types";
import type { ModelBackendKind, ModelProtocol } from "@shared/v2-types";

export type AppView =
  | "setup"
  | "onboarding-persona"
  | "onboarding-priorities"
  | "dashboard"
  | "guided-task"
  | "chat"
  | "settings"
  | "v2-framework-select"
  | "v2-model-backend";

interface GuidedTaskContext {
  personaId: string;
  taskId: string;
}

interface ModelBackendDraft {
  kind: ModelBackendKind;
  provider: string | null;
  baseUrl: string | null;
  protocol: ModelProtocol;
  model: string;
}

interface AppState {
  view: AppView;
  selectedPersonaId: string | null;
  selectedPriorities: string[];
  personas: Persona[];
  conversations: Conversation[];
  ollamaStatus: "not_installed" | "downloading_model" | "starting" | "ready" | "error";
  modelDownloadProgress: number;
  remainingGenerations: number | "unlimited";
  guidedTaskContext: GuidedTaskContext | null;
  currentConversationId: string | null;
  isGenerating: boolean;
  streamingText: string;

  // v2 onboarding state
  selectedFrameworkId: string;
  modelBackendDraft: ModelBackendDraft;

  setView: (view: AppView) => void;
  selectPersona: (id: string) => void;
  setPriorities: (priorities: string[]) => void;
  setPersonas: (personas: Persona[]) => void;
  setOllamaStatus: (status: AppState["ollamaStatus"]) => void;
  setModelDownloadProgress: (progress: number) => void;
  setRemainingGenerations: (count: number | "unlimited") => void;
  openGuidedTask: (personaId: string, taskId: string) => void;
  setCurrentConversationId: (id: string | null) => void;
  setIsGenerating: (val: boolean) => void;
  appendStreamingText: (token: string) => void;
  clearStreamingText: () => void;
  setConversations: (convs: Conversation[]) => void;

  // v2 onboarding actions
  setFramework: (id: string) => void;
  setModelBackendDraft: (partial: Partial<ModelBackendDraft>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "setup",
  selectedPersonaId: null,
  selectedPriorities: [],
  personas: [],
  conversations: [],
  ollamaStatus: "not_installed",
  modelDownloadProgress: 0,
  remainingGenerations: 20,
  guidedTaskContext: null,
  currentConversationId: null,
  isGenerating: false,
  streamingText: "",

  // v2 onboarding initial state
  selectedFrameworkId: "openclaw",
  modelBackendDraft: {
    kind: "ollama",
    provider: null,
    baseUrl: null,
    protocol: "v1/chat/completions",
    model: "",
  },

  setView: (view) => set({ view }),
  selectPersona: (id) => set({ selectedPersonaId: id }),
  setPriorities: (priorities) => set({ selectedPriorities: priorities }),
  setPersonas: (personas) => set({ personas }),
  setOllamaStatus: (status) => set({ ollamaStatus: status }),
  setModelDownloadProgress: (progress) => set({ modelDownloadProgress: progress }),
  setRemainingGenerations: (count) => set({ remainingGenerations: count }),
  openGuidedTask: (personaId, taskId) =>
    set({ guidedTaskContext: { personaId, taskId }, view: "guided-task" }),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  setIsGenerating: (val) => set({ isGenerating: val }),
  appendStreamingText: (token) => set((s) => ({ streamingText: s.streamingText + token })),
  clearStreamingText: () => set({ streamingText: "" }),
  setConversations: (convs) => set({ conversations: convs }),

  // v2 onboarding actions
  setFramework: (id) => set({ selectedFrameworkId: id }),
  setModelBackendDraft: (partial) =>
    set((s) => ({ modelBackendDraft: { ...s.modelBackendDraft, ...partial } })),
}));

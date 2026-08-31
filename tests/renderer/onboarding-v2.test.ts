import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock window.electronAPI
const mockAPI = {
  getFrameworks: vi.fn().mockResolvedValue([
    { id: "openclaw", name: "OpenClaw", features: ["Feature 1"], installRecipe: {}, isDefault: true },
    { id: "zeptoclaw", name: "ZeptoClaw", features: ["Feature 2"], installRecipe: {} },
    { id: "hermes", name: "Hermes Agent", features: ["Feature 3"], installRecipe: {} },
  ]),
};
(globalThis as any).window = { electronAPI: mockAPI };

// Must import after mock is set
const { useAppStore } = await import("../../src/renderer/store");

describe("v2 onboarding store", () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      selectedFrameworkId: "openclaw",
      modelBackendDraft: {
        kind: "ollama",
        provider: null,
        baseUrl: null,
        protocol: "v1/chat/completions",
        model: "",
      },
    });
  });

  it("initializes with openclaw as default framework", () => {
    const state = useAppStore.getState();
    expect(state.selectedFrameworkId).toBe("openclaw");
  });

  it("setFramework updates the selected framework", () => {
    const { setFramework } = useAppStore.getState();
    setFramework("hermes");
    expect(useAppStore.getState().selectedFrameworkId).toBe("hermes");
  });

  it("setModelBackendDraft merges partial updates", () => {
    const { setModelBackendDraft } = useAppStore.getState();

    // Initial state has kind: "ollama"
    expect(useAppStore.getState().modelBackendDraft.kind).toBe("ollama");

    // Merge update to cloud provider
    setModelBackendDraft({ kind: "cloud", provider: "anthropic" });

    const draft = useAppStore.getState().modelBackendDraft;
    expect(draft.kind).toBe("cloud");
    expect(draft.provider).toBe("anthropic");
    expect(draft.protocol).toBe("v1/chat/completions"); // Preserved from initial
  });

  it("setModelBackendDraft handles multiple partial updates", () => {
    const { setModelBackendDraft } = useAppStore.getState();

    setModelBackendDraft({ kind: "custom" });
    expect(useAppStore.getState().modelBackendDraft.kind).toBe("custom");

    setModelBackendDraft({ baseUrl: "http://localhost:8000" });
    expect(useAppStore.getState().modelBackendDraft.baseUrl).toBe("http://localhost:8000");
    expect(useAppStore.getState().modelBackendDraft.kind).toBe("custom"); // Previous value preserved

    setModelBackendDraft({ protocol: "v1/messages", model: "claude-3-sonnet" });
    const draft = useAppStore.getState().modelBackendDraft;
    expect(draft.protocol).toBe("v1/messages");
    expect(draft.model).toBe("claude-3-sonnet");
    expect(draft.kind).toBe("custom"); // Still preserved
  });
});

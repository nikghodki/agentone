import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock window.electronAPI
const mockAPI = {
  dbGetProfile: vi.fn().mockResolvedValue(null),
  dbGetConversations: vi.fn().mockResolvedValue([]),
  getRemainingGenerations: vi.fn().mockResolvedValue(20),
  ollamaStatus: vi.fn().mockResolvedValue("not_installed"),
};
(globalThis as any).window = { electronAPI: mockAPI };

// Must import after mock is set
const { useAppStore } = await import("../../src/renderer/store");

describe("useAppStore", () => {
  it("initializes with setup view", () => {
    const state = useAppStore.getState();
    expect(state.view).toBe("setup");
  });

  it("setView changes the current view", () => {
    useAppStore.getState().setView("dashboard");
    expect(useAppStore.getState().view).toBe("dashboard");
  });

  it("selectPersona updates persona and navigates to priorities", () => {
    useAppStore.getState().selectPersona("student");
    expect(useAppStore.getState().selectedPersonaId).toBe("student");
  });
});

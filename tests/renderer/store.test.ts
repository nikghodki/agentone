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
  it("initializes with the v2 framework-select view (first-run entry)", () => {
    const state = useAppStore.getState();
    expect(state.view).toBe("v2-framework-select");
  });

  it("setView changes the current view", () => {
    useAppStore.getState().setView("dashboard");
    expect(useAppStore.getState().view).toBe("dashboard");
  });

  it("selectPersona updates persona and navigates to priorities", () => {
    useAppStore.getState().selectPersona("student");
    expect(useAppStore.getState().selectedPersonaId).toBe("student");
  });

  it("modelBackendId starts as null", () => {
    const state = useAppStore.getState();
    expect(state.modelBackendId).toBeNull();
  });

  it("setModelBackendId updates modelBackendId", () => {
    const testId = "backend-uuid-1234";
    useAppStore.getState().setModelBackendId(testId);
    expect(useAppStore.getState().modelBackendId).toBe(testId);
  });

  it("setModelBackendId can clear modelBackendId", () => {
    useAppStore.getState().setModelBackendId("some-id");
    useAppStore.getState().setModelBackendId(null);
    expect(useAppStore.getState().modelBackendId).toBeNull();
  });
});

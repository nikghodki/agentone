import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock window.electronAPI
const mockAPI = {
  dbGetProfile: vi.fn().mockResolvedValue(null),
  dbGetConversations: vi.fn().mockResolvedValue([]),
  getRemainingGenerations: vi.fn().mockResolvedValue(20),
  ollamaStatus: vi.fn().mockResolvedValue("not_installed"),
  deployFramework: vi.fn().mockResolvedValue({ id: "dep-1" }),
  sendTask: vi.fn().mockResolvedValue(undefined),
  onTaskToken: vi.fn().mockReturnValue(() => {}),
  onTaskStatus: vi.fn().mockReturnValue(() => {}),
};
(globalThis as any).window = { electronAPI: mockAPI };

// Must import after mock is set
const { useAppStore } = await import("../../src/renderer/store");

describe("Task flow store", () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      currentDeploymentId: null,
      taskStreamText: "",
      taskStatus: null,
    });
  });

  it("setCurrentDeploymentId updates deployment ID", () => {
    useAppStore.getState().setCurrentDeploymentId("dep-123");
    expect(useAppStore.getState().currentDeploymentId).toBe("dep-123");
  });

  it("appendTaskStreamText appends tokens to stream", () => {
    useAppStore.getState().appendTaskStreamText("Hello");
    useAppStore.getState().appendTaskStreamText(" ");
    useAppStore.getState().appendTaskStreamText("World");
    expect(useAppStore.getState().taskStreamText).toBe("Hello World");
  });

  it("clearTaskStreamText resets stream to empty", () => {
    useAppStore.getState().appendTaskStreamText("Some text");
    useAppStore.getState().clearTaskStreamText();
    expect(useAppStore.getState().taskStreamText).toBe("");
  });

  it("setTaskStatus updates the status", () => {
    useAppStore.getState().setTaskStatus("Setting up mcp-server...");
    expect(useAppStore.getState().taskStatus).toBe("Setting up mcp-server...");
  });

  it("clearTaskStatus resets status to null", () => {
    useAppStore.getState().setTaskStatus("Installing...");
    useAppStore.getState().clearTaskStatus();
    expect(useAppStore.getState().taskStatus).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { useAppStore } from "../../src/renderer/store";

// Mock window.electronAPI
const mockSaveModelBackend = vi.fn();
const mockDeployFramework = vi.fn();
const mockOnTaskStatus = vi.fn(() => () => {}); // Returns cleanup function
const mockOnModelDownloadProgress = vi.fn(() => () => {});

const mockAPI = {
  saveModelBackend: mockSaveModelBackend,
  deployFramework: mockDeployFramework,
  onTaskStatus: mockOnTaskStatus,
  onModelDownloadProgress: mockOnModelDownloadProgress,
};

(globalThis as any).window = { electronAPI: mockAPI };

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();

  // Reset store to clean state
  useAppStore.setState({
    wizardStep: "deploy",
    selectedFrameworkId: "zeptoclaw",
    modelBackendDraft: {
      kind: "cloud",
      provider: "anthropic",
      baseUrl: null,
      protocol: "v1/messages",
      model: "claude-3-5-sonnet-20241022",
      extra: null,
    },
    cloudForm: {
      apiKey: "sk-ant-test-key",
      resourceUrl: "",
      deployment: "",
      apiVersion: "",
      region: "",
      accessKeyId: "",
      secretAccessKey: "",
      modelPath: "",
    },
  });
});

describe("DeployStep", () => {
  it("deploys: saveModelBackend then deployFramework with the returned id, shows progress, routes to task", async () => {
    const { DeployStep } = await import("../../src/renderer/pages/wizard/DeployStep");

    // Mock successful deployment
    mockSaveModelBackend.mockResolvedValue("backend-id-123");
    mockDeployFramework.mockResolvedValue({ id: "deployment-id-456" });

    const { unmount } = render(<DeployStep />);

    // Should show the deploy button
    const deployButton = screen.getByRole("button", { name: /Install & Deploy/i });
    expect(deployButton).toBeTruthy();

    // Click the deploy button
    fireEvent.click(deployButton);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should call saveModelBackend with correct arguments
    expect(mockSaveModelBackend).toHaveBeenCalledWith(
      {
        kind: "cloud",
        provider: "anthropic",
        baseUrl: null,
        protocol: "v1/messages",
        model: "claude-3-5-sonnet-20241022",
        extra: null,
      },
      "sk-ant-test-key"
    );

    // Should then call deployFramework with the framework ID and backend ID
    expect(mockDeployFramework).toHaveBeenCalledWith("zeptoclaw", "backend-id-123");

    // Should update store state
    const state = useAppStore.getState();
    expect(state.modelBackendId).toBe("backend-id-123");
    expect(state.currentDeploymentId).toBe("deployment-id-456");
    expect(state.view).toBe("task");

    unmount();
  });

  it("shows an error callout + Retry when deploy fails", async () => {
    const { DeployStep } = await import("../../src/renderer/pages/wizard/DeployStep");

    // Mock failed deployment
    mockSaveModelBackend.mockResolvedValue("backend-id-123");
    mockDeployFramework.mockRejectedValue(new Error("Network error"));

    const { unmount } = render(<DeployStep />);

    // Click the deploy button
    const deployButton = screen.getByRole("button", { name: /Install & Deploy/i });
    fireEvent.click(deployButton);

    // Wait for error to appear
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should show error callout
    expect(screen.getByText(/Network error/i)).toBeTruthy();

    // Should show retry button
    const retryButton = screen.getByRole("button", { name: /Retry/i });
    expect(retryButton).toBeTruthy();

    // Reset mocks for retry
    mockDeployFramework.mockResolvedValue({ id: "deployment-id-789" });

    // Click retry button
    fireEvent.click(retryButton);

    // Wait for retry to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should call deployFramework again
    expect(mockDeployFramework).toHaveBeenCalledTimes(2);

    // Should eventually succeed
    const state = useAppStore.getState();
    expect(state.currentDeploymentId).toBe("deployment-id-789");

    unmount();
  });

  it("handles saveModelBackend failure", async () => {
    const { DeployStep } = await import("../../src/renderer/pages/wizard/DeployStep");

    // Mock saveModelBackend failure
    mockSaveModelBackend.mockRejectedValue(new Error("Failed to save backend"));

    const { unmount } = render(<DeployStep />);

    // Click the deploy button
    const deployButton = screen.getByRole("button", { name: /Install & Deploy/i });
    fireEvent.click(deployButton);

    // Wait for error to appear
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should show error callout
    expect(screen.getByText(/Failed to save backend/i)).toBeTruthy();

    // Should show retry button
    const retryButton = screen.getByRole("button", { name: /Retry/i });
    expect(retryButton).toBeTruthy();

    unmount();
  });
});

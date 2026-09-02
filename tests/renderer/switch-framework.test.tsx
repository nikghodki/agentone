// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TaskPage } from "../../src/renderer/pages/TaskPage";
import { useAppStore } from "../../src/renderer/store";

// Mock electronAPI
const mockRemoveDeployment = vi.fn();
const mockSendTask = vi.fn();
const mockOnTaskToken = vi.fn(() => () => {});
const mockOnTaskStatus = vi.fn(() => () => {});

beforeEach(() => {
  vi.clearAllMocks();

  // Mock window.electronAPI
  (global as any).window = {
    electronAPI: {
      removeDeployment: mockRemoveDeployment,
      sendTask: mockSendTask,
      onTaskToken: mockOnTaskToken,
      onTaskStatus: mockOnTaskStatus,
    },
  };
});

describe("TaskPage Switch Framework", () => {
  it("switch framework tears down and restarts the wizard", async () => {
    // Set up initial state: a running deployment
    useAppStore.setState({
      currentDeploymentId: "dep1",
      view: "task",
    });

    mockRemoveDeployment.mockResolvedValue(undefined);

    const { container, getByText } = render(<TaskPage />);

    // Find and click the "Switch framework" button in the header
    const switchButtons = container.querySelectorAll("button");
    const headerSwitchButton = Array.from(switchButtons).find(
      (btn) => btn.textContent?.trim() === "Switch framework"
    );
    expect(headerSwitchButton).toBeTruthy();

    fireEvent.click(headerSwitchButton!);

    // Wait a tick for modal to render
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Find the modal confirmation button (looks for the red button with "Switch framework")
    const allButtons = container.querySelectorAll("button");
    const modalConfirmButton = Array.from(allButtons).find(
      (btn) =>
        btn.textContent?.trim() === "Switch framework" &&
        btn.className.includes("bg-red-600")
    );
    expect(modalConfirmButton).toBeTruthy();

    // Click the confirm button in the modal
    fireEvent.click(modalConfirmButton!);

    // Wait for async operations to complete
    await waitFor(() => {
      expect(mockRemoveDeployment).toHaveBeenCalledWith("dep1");
    }, { container: document.body });

    // Verify wizard is reset and view is switched to wizard
    expect(useAppStore.getState().view).toBe("wizard");
    expect(useAppStore.getState().currentDeploymentId).toBe(null);
    expect(useAppStore.getState().wizardStep).toBe("framework");
  });
});

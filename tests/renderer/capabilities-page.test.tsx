// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CapabilitiesPage } from "../../src/renderer/pages/CapabilitiesPage";
import { useAppStore } from "../../src/renderer/store";

// Mock window.electronAPI
const mockAPI = {
  getCapabilities: vi.fn(),
  removeCapability: vi.fn(),
};
(globalThis as any).window = { electronAPI: mockAPI };

describe("CapabilitiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm using vi.stubGlobal
    vi.stubGlobal("confirm", vi.fn(() => true));
    // Set a deployment ID in the store
    useAppStore.setState({ currentDeploymentId: "deployment-123" });
  });

  it("lists capabilities and removes one, then refetches", async () => {
    // Mock initial capabilities list
    mockAPI.getCapabilities.mockResolvedValueOnce([
      { deploymentId: "deployment-123", type: "skill", name: "test-skill", source: "/path/to/skill" },
      { deploymentId: "deployment-123", type: "mcp", name: "test-mcp", source: "npm:@test/mcp" },
    ]);

    // Mock remove call and refetch
    mockAPI.removeCapability.mockResolvedValueOnce({ frameworkRemoved: true });
    mockAPI.getCapabilities.mockResolvedValueOnce([
      { deploymentId: "deployment-123", type: "mcp", name: "test-mcp", source: "npm:@test/mcp" },
    ]);

    render(<CapabilitiesPage />);

    // Wait for initial load using findByText which waits automatically
    expect(await screen.findByText("test-skill")).toBeTruthy();
    expect(screen.getByText("test-mcp")).toBeTruthy();

    // Click the first Remove button (for test-skill)
    const removeButtons = screen.getAllByText("Remove");
    fireEvent.click(removeButtons[0]);

    // Give async operations time to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Check removeCapability was called correctly
    expect(mockAPI.removeCapability).toHaveBeenCalledWith("deployment-123", {
      type: "skill",
      name: "test-skill",
    });

    // Verify refetch happened
    expect(mockAPI.getCapabilities).toHaveBeenCalledTimes(2);

    // After refetch, test-skill should be gone
    expect(screen.queryByText("test-skill")).toBeNull();
    expect(screen.getByText("test-mcp")).toBeTruthy();
  });

  it("shows note when frameworkRemoved is false", async () => {
    // Mock initial capabilities
    mockAPI.getCapabilities.mockResolvedValueOnce([
      { deploymentId: "deployment-123", type: "plugin", name: "test-plugin", source: "plugin-source" },
    ]);

    // Mock remove with frameworkRemoved: false and a note
    mockAPI.removeCapability.mockResolvedValueOnce({
      frameworkRemoved: false,
      note: "This framework only supports installing plugins, not removing them.",
    });
    mockAPI.getCapabilities.mockResolvedValueOnce([
      { deploymentId: "deployment-123", type: "plugin", name: "test-plugin", source: "plugin-source" },
    ]);

    render(<CapabilitiesPage />);

    // Wait for initial load using findByText
    expect(await screen.findByText("test-plugin")).toBeTruthy();

    // Click Remove
    const removeButton = screen.getByText("Remove");
    fireEvent.click(removeButton);

    // Wait for the note to appear using findByText
    expect(await screen.findByText(/This framework only supports installing plugins, not removing them/)).toBeTruthy();
  });
});

// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChannelsPage } from "../../src/renderer/pages/ChannelsPage";
import { useAppStore } from "../../src/renderer/store";

// Mock window.electronAPI
const mockAPI = {
  listChannels: vi.fn(),
  removeChannel: vi.fn(),
  configureChannel: vi.fn(),
};
(globalThis as any).window = { electronAPI: mockAPI };

describe("ChannelsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    useAppStore.setState({
      currentDeploymentId: "deployment-123",
      selectedFrameworkId: "openclaw",
    });
  });

  it("lists channels on mount with status badges", async () => {
    mockAPI.listChannels.mockResolvedValueOnce([
      { id: "telegram", enabled: true, connected: true },
      { id: "slack", enabled: true, connected: false },
    ]);

    render(<ChannelsPage />);

    // Wait for channels to load
    expect(await screen.findByText("Telegram")).toBeTruthy();
    expect(screen.getByText("Slack")).toBeTruthy();

    // Should show status badges
    const enabledBadges = screen.getAllByText("Enabled");
    expect(enabledBadges.length).toBe(2);

    const connectedBadge = screen.getByText("Connected");
    expect(connectedBadge).toBeTruthy();
  });

  it("shows empty state when no channels", async () => {
    mockAPI.listChannels.mockResolvedValueOnce([]);

    render(<ChannelsPage />);

    expect(await screen.findByText("No channels connected yet.")).toBeTruthy();
  });

  it("removes channel on confirm and refetches", async () => {
    // Initial list
    mockAPI.listChannels.mockResolvedValueOnce([
      { id: "telegram", enabled: true, connected: true },
    ]);

    // After removal
    mockAPI.removeChannel.mockResolvedValueOnce({ removed: true });
    mockAPI.listChannels.mockResolvedValueOnce([]);

    render(<ChannelsPage />);

    // Wait for initial load
    expect(await screen.findByText("Telegram")).toBeTruthy();

    // Click Remove button
    const removeButton = screen.getByText("Remove");
    fireEvent.click(removeButton);

    // Give async operations time to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify removeChannel was called
    expect(mockAPI.removeChannel).toHaveBeenCalledWith("deployment-123", "telegram");

    // Verify refetch happened
    expect(mockAPI.listChannels).toHaveBeenCalledTimes(2);

    // Should show empty state after removal
    expect(await screen.findByText("No channels connected yet.")).toBeTruthy();
  });

  it("shows Add channel control that reveals ChannelSetupForm", async () => {
    mockAPI.listChannels.mockResolvedValueOnce([]);

    render(<ChannelsPage />);

    // Wait for empty state
    await screen.findByText("No channels connected yet.");

    // Should have an "Add channel" button
    const addButton = screen.getByRole("button", { name: /Add channel/i });
    fireEvent.click(addButton);

    // ChannelSetupForm should be visible (shows "Select a channel")
    expect(await screen.findByText(/Select a channel/i)).toBeTruthy();
  });

  it("shows error state when listChannels fails", async () => {
    mockAPI.listChannels.mockRejectedValueOnce(new Error("Network error"));

    render(<ChannelsPage />);

    expect(await screen.findByText(/Failed to load channels/i)).toBeTruthy();
  });
});

describe("TaskPage - Channels button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      currentDeploymentId: "deployment-123",
      view: "task",
    });

    // Mock the electronAPI for TaskPage
    (globalThis as any).window = {
      electronAPI: {
        onTaskToken: vi.fn(() => () => {}),
        onTaskStatus: vi.fn(() => () => {}),
        removeDeployment: vi.fn(),
      },
    };
  });

  it("has a Channels button that sets view to channels", async () => {
    const { TaskPage } = await import("../../src/renderer/pages/TaskPage");
    render(<TaskPage />);

    const channelsButton = screen.getByRole("button", { name: /Channels/i });
    fireEvent.click(channelsButton);

    const state = useAppStore.getState();
    expect(state.view).toBe("channels");
  });
});

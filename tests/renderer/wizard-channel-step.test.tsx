// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { useAppStore } from "../../src/renderer/store";

// Mock window.electronAPI
const mockConfigureChannel = vi.fn();

const mockAPI = {
  configureChannel: mockConfigureChannel,
};

(globalThis as any).window = { electronAPI: mockAPI };

beforeEach(() => {
  vi.clearAllMocks();

  // Reset store to clean state
  useAppStore.setState({
    wizardStep: "channel",
    selectedFrameworkId: "openclaw",
    currentDeploymentId: "dep-123",
    view: "wizard",
  });
});

describe("ChannelStep", () => {
  it("renders ChannelSetupForm with current deploymentId and frameworkId", async () => {
    const { ChannelStep } = await import("../../src/renderer/pages/wizard/ChannelStep");

    render(<ChannelStep />);

    // Should show channel setup UI (telegram option)
    expect(screen.getByText("Telegram")).toBeTruthy();
  });

  it("Skip action sets wizardStep to use-case", async () => {
    const { ChannelStep } = await import("../../src/renderer/pages/wizard/ChannelStep");

    render(<ChannelStep />);

    // Should have a Skip button
    const skipButton = screen.getByRole("button", { name: /Skip/i });
    fireEvent.click(skipButton);

    // Should set wizardStep to use-case
    const state = useAppStore.getState();
    expect(state.wizardStep).toBe("use-case");
  });

  it("Continue to app action sets wizardStep to use-case after connect", async () => {
    const { ChannelStep } = await import("../../src/renderer/pages/wizard/ChannelStep");
    const { waitFor } = await import("@testing-library/react");

    mockConfigureChannel.mockResolvedValue({ connected: true });

    const { container } = render(<ChannelStep />);

    // Pick telegram and connect
    const telegramCard = screen.getByText("Telegram").closest("[role='radio']");
    fireEvent.click(telegramCard!);

    const botTokenInput = screen.getByLabelText("Bot Token");
    fireEvent.change(botTokenInput, { target: { value: "test-token" } });

    const connectButton = screen.getByRole("button", { name: /Connect/i });
    fireEvent.click(connectButton);

    // Wait for connection to complete and Continue button to appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Continue to app/i })).toBeTruthy();
    }, { container });

    // Click Continue
    const continueButton = screen.getByRole("button", { name: /Continue to app/i });
    fireEvent.click(continueButton);

    // Should set wizardStep to use-case
    const state = useAppStore.getState();
    expect(state.wizardStep).toBe("use-case");
  });
});

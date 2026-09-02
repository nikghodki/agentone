// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
});

describe("ChannelSetupForm", () => {
  it("filters channels by frameworkId: openclaw shows telegram/slack/discord (all have openclaw after 2c)", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="openclaw"
      />
    );

    // Should show telegram, slack, discord (all have openclaw in frameworks after 2c)
    expect(screen.getByText("Telegram")).toBeTruthy();
    expect(screen.getByText("Slack")).toBeTruthy();
    expect(screen.getByText("Discord")).toBeTruthy();
    expect(screen.getByText("WhatsApp Web")).toBeTruthy();

    // Should NOT show WhatsApp Cloud (frameworks still empty)
    expect(screen.queryByText("WhatsApp Cloud")).toBeFalsy();
  });

  it("picking telegram shows botToken masked field + instructions", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="openclaw"
      />
    );

    // Click telegram card
    const telegramCard = screen.getByText("Telegram").closest("[role='radio']");
    expect(telegramCard).toBeTruthy();
    fireEvent.click(telegramCard!);

    // Should show botToken field (masked)
    const botTokenInput = screen.getByLabelText("Bot Token") as HTMLInputElement;
    expect(botTokenInput).toBeTruthy();
    expect(botTokenInput.type).toBe("password");

    // Should show instructions callout (using getAllByText since it appears in both RadioCard description and Callout)
    const instructions = screen.getAllByText(/Create a bot using @BotFather on Telegram/i);
    expect(instructions.length).toBeGreaterThan(0);
  });

  it("Connect calls configureChannel with correct args", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    mockConfigureChannel.mockResolvedValue({ connected: true });

    const { container } = render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="openclaw"
      />
    );

    // Pick telegram
    const telegramCard = screen.getByText("Telegram").closest("[role='radio']");
    fireEvent.click(telegramCard!);

    // Fill in botToken
    const botTokenInput = screen.getByLabelText("Bot Token");
    fireEvent.change(botTokenInput, { target: { value: "test-token-123" } });

    // Click Connect
    const connectButton = screen.getByRole("button", { name: /Connect/i });
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockConfigureChannel).toHaveBeenCalledWith("dep1", {
        id: "telegram",
        config: {},
        secrets: { botToken: "test-token-123" },
      });
    }, { container });
  });

  it("shows success Callout when connected:true", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    mockConfigureChannel.mockResolvedValue({ connected: true });

    const { container } = render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="openclaw"
      />
    );

    // Pick telegram and fill field
    const telegramCard = screen.getByText("Telegram").closest("[role='radio']");
    fireEvent.click(telegramCard!);
    const botTokenInput = screen.getByLabelText("Bot Token");
    fireEvent.change(botTokenInput, { target: { value: "test-token-123" } });

    // Click Connect
    const connectButton = screen.getByRole("button", { name: /Connect/i });
    fireEvent.click(connectButton);

    // Should show success callout
    await waitFor(() => {
      expect(screen.getByText(/Connected successfully/i)).toBeTruthy();
    }, { container });
  });

  it("shows warning Callout with detail when connected:false", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    mockConfigureChannel.mockResolvedValue({
      connected: false,
      detail: "Invalid bot token provided",
    });

    const { container } = render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="openclaw"
      />
    );

    // Pick telegram and fill field
    const telegramCard = screen.getByText("Telegram").closest("[role='radio']");
    fireEvent.click(telegramCard!);
    const botTokenInput = screen.getByLabelText("Bot Token");
    fireEvent.change(botTokenInput, { target: { value: "bad-token" } });

    // Click Connect
    const connectButton = screen.getByRole("button", { name: /Connect/i });
    fireEvent.click(connectButton);

    // Should show warning callout with detail
    await waitFor(() => {
      expect(screen.getByText(/Invalid bot token provided/i)).toBeTruthy();
    }, { container });
  });

  it("calls onConnected callback after configureChannel", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    mockConfigureChannel.mockResolvedValue({ connected: true });
    const onConnected = vi.fn();

    const { container } = render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="openclaw"
        onConnected={onConnected}
      />
    );

    // Pick telegram and fill field
    const telegramCard = screen.getByText("Telegram").closest("[role='radio']");
    fireEvent.click(telegramCard!);
    const botTokenInput = screen.getByLabelText("Bot Token");
    fireEvent.change(botTokenInput, { target: { value: "test-token" } });

    // Click Connect
    const connectButton = screen.getByRole("button", { name: /Connect/i });
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(onConnected).toHaveBeenCalledWith("telegram");
    }, { container });
  });

  it("shows 'No channels available' when frameworkId has no channels", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="unknown-framework"
      />
    );

    // Should show no channels callout
    expect(screen.getByText(/No channels available for this framework yet/i)).toBeTruthy();
  });
});

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

  // Task 4: credential channel with optional fields
  it("credential channel (slack) renders all fields including optional signingSecret with hint", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="hermes"
      />
    );

    // Pick slack
    const slackCard = screen.getByText("Slack").closest("[role='radio']");
    fireEvent.click(slackCard!);

    // Should show all three fields
    expect(screen.getByLabelText("Bot Token")).toBeTruthy();
    expect(screen.getByLabelText("App Token")).toBeTruthy();
    expect(screen.getByLabelText("Signing Secret (optional)")).toBeTruthy();

    // Optional field should have "(optional)" hint in label
    const signingSecretInput = screen.getByLabelText("Signing Secret (optional)");
    expect(signingSecretInput).toBeTruthy();
  });

  it("credential channel (slack): Connect enabled with only required fields filled, signingSecret blank", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    mockConfigureChannel.mockResolvedValue({ connected: true });

    const { container } = render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="hermes"
      />
    );

    // Pick slack
    const slackCard = screen.getByText("Slack").closest("[role='radio']");
    fireEvent.click(slackCard!);

    // Fill only required fields (botToken + appToken)
    const botTokenInput = screen.getByLabelText("Bot Token");
    const appTokenInput = screen.getByLabelText("App Token");
    fireEvent.change(botTokenInput, { target: { value: "xoxb-test" } });
    fireEvent.change(appTokenInput, { target: { value: "xapp-test" } });

    // Leave signingSecret blank - Connect should still be enabled
    const connectButton = screen.getByRole("button", { name: /Connect/i }) as HTMLButtonElement;
    expect(connectButton.disabled).toBe(false);

    // Click Connect - should call with botToken + appToken only
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockConfigureChannel).toHaveBeenCalledWith("dep1", {
        id: "slack",
        config: {},
        secrets: { botToken: "xoxb-test", appToken: "xapp-test" },
      });
    }, { container });
  });

  it("qr channel (whatsapp_web) renders guided instructions and no secret inputs", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="openclaw"
      />
    );

    // Pick whatsapp_web
    const whatsappCard = screen.getByText("WhatsApp Web").closest("[role='radio']");
    fireEvent.click(whatsappCard!);

    // Should NOT show any labeled inputs (no Bot Token, App Token, etc.)
    expect(screen.queryByLabelText("Bot Token")).toBeFalsy();
    expect(screen.queryByLabelText("App Token")).toBeFalsy();

    // Should show "Done" button (purely guided, no configureChannel calls)
    expect(screen.getByRole("button", { name: /Done/i })).toBeTruthy();
  });

  it("qr channel (whatsapp_web): renders guided pairing instructions with per-framework command and does NOT call configureChannel", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="hermes"
      />
    );

    // Pick whatsapp_web
    const whatsappCard = screen.getByText("WhatsApp Web").closest("[role='radio']");
    fireEvent.click(whatsappCard!);

    // Should show guided pairing callout
    expect(screen.getByText(/Pairing happens in the framework itself by running a terminal command/i)).toBeTruthy();

    // Should show the correct per-framework command for hermes
    expect(screen.getByText("hermes whatsapp")).toBeTruthy();

    // Should show Done button instead of Start pairing/Check status
    expect(screen.getByRole("button", { name: /Done/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start pairing/i })).toBeFalsy();
    expect(screen.queryByRole("button", { name: /Check status/i })).toBeFalsy();

    // Clicking Done should NOT call configureChannel
    const doneButton = screen.getByRole("button", { name: /Done/i });
    fireEvent.click(doneButton);

    // configureChannel should NEVER be called for QR channels
    expect(mockConfigureChannel).not.toHaveBeenCalled();
  });

  it("qr channel (whatsapp_web): shows correct command for different frameworks", async () => {
    const { ChannelSetupForm } = await import("../../src/renderer/components/ChannelSetupForm");

    const { unmount } = render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="openclaw"
      />
    );

    // Pick whatsapp_web
    const whatsappCard = screen.getByText("WhatsApp Web").closest("[role='radio']");
    fireEvent.click(whatsappCard!);

    // Should show openclaw command
    expect(screen.getByText("openclaw channels login --channel whatsapp")).toBeTruthy();

    // Unmount and test with zeptoclaw
    unmount();

    render(
      <ChannelSetupForm
        deploymentId="dep1"
        frameworkId="zeptoclaw"
      />
    );

    const whatsappCard2 = screen.getByText("WhatsApp Web").closest("[role='radio']");
    fireEvent.click(whatsappCard2!);

    // Should show zeptoclaw command
    expect(screen.getByText("zeptoclaw channel setup whatsapp_web")).toBeTruthy();
  });

  it("no regression: telegram credential flow still works", async () => {
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

    // Fill botToken
    const botTokenInput = screen.getByLabelText("Bot Token");
    fireEvent.change(botTokenInput, { target: { value: "tg-token-123" } });

    // Connect should be enabled
    const connectButton = screen.getByRole("button", { name: /Connect/i }) as HTMLButtonElement;
    expect(connectButton.disabled).toBe(false);

    // Click Connect
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockConfigureChannel).toHaveBeenCalledWith("dep1", {
        id: "telegram",
        config: {},
        secrets: { botToken: "tg-token-123" },
      });
    }, { container });

    // Should show success
    await waitFor(() => {
      expect(screen.getByText(/Connected successfully/i)).toBeTruthy();
    }, { container });
  });
});

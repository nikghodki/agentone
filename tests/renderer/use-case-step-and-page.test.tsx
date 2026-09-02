// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { useAppStore } from "../../src/renderer/store";

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock window.electronAPI
const mockOnTaskToken = vi.fn().mockReturnValue(() => {});
const mockOnTaskStatus = vi.fn().mockReturnValue(() => {});

(globalThis as any).window = {
  electronAPI: {
    onTaskToken: mockOnTaskToken,
    onTaskStatus: mockOnTaskStatus,
  },
};

beforeEach(() => {
  vi.clearAllMocks();

  // Reset store to clean state
  useAppStore.setState({
    wizardStep: "framework",
    view: "wizard",
    selectedFrameworkId: "openclaw",
    currentDeploymentId: "dep-123",
  });
});

describe("Store types", () => {
  it("WizardStep includes 'use-case'", () => {
    // Type-level test: should compile without errors
    const step: import("../../src/renderer/store").WizardStep = "use-case";
    expect(step).toBe("use-case");

    // Runtime test: should accept use-case in setWizardStep
    useAppStore.getState().setWizardStep("use-case");
    expect(useAppStore.getState().wizardStep).toBe("use-case");
  });

  it("AppView includes 'use-cases'", () => {
    // Type-level test: should compile without errors
    const view: import("../../src/renderer/store").AppView = "use-cases";
    expect(view).toBe("use-cases");

    // Runtime test: should accept use-cases in setView
    useAppStore.getState().setView("use-cases");
    expect(useAppStore.getState().view).toBe("use-cases");
  });
});

describe("UseCaseStep", () => {
  it("renders UseCaseBuilder", async () => {
    useAppStore.setState({ wizardStep: "use-case" });

    const { UseCaseStep } = await import("../../src/renderer/pages/wizard/UseCaseStep");

    render(<UseCaseStep />);

    // Should show the main heading
    expect(screen.getByText("Get Started with a Use Case")).toBeTruthy();
    // Should show use case selection UI heading
    expect(screen.getByRole("heading", { level: 3, name: "Choose a use case" })).toBeTruthy();
  });

  it("Finish action sets view to task", async () => {
    useAppStore.setState({ wizardStep: "use-case" });

    const { UseCaseStep } = await import("../../src/renderer/pages/wizard/UseCaseStep");

    render(<UseCaseStep />);

    // Should have a Finish button
    const finishButton = screen.getByRole("button", { name: /Finish/i });
    fireEvent.click(finishButton);

    // Should set view to task
    const state = useAppStore.getState();
    expect(state.view).toBe("task");
  });
});

describe("UseCasesPage", () => {
  it("renders UseCaseBuilder in a light container", async () => {
    useAppStore.setState({ view: "use-cases" });

    const { UseCasesPage } = await import("../../src/renderer/pages/UseCasesPage");

    const { container } = render(<UseCasesPage />);

    // Should show use case selection UI heading
    expect(screen.getByRole("heading", { level: 3, name: "Choose a use case" })).toBeTruthy();

    // Should have a light container (bg-white)
    const lightContainer = container.querySelector(".bg-white");
    expect(lightContainer).toBeTruthy();
  });
});

describe("TaskPage Get started button", () => {
  it("renders Get started button that navigates to use-cases", async () => {
    useAppStore.setState({
      view: "task",
      currentDeploymentId: "dep-123",
    });

    const { TaskPage } = await import("../../src/renderer/pages/TaskPage");

    render(<TaskPage />);

    // Should have a Get started button
    const getStartedButton = screen.getByRole("button", { name: /Get started/i });
    fireEvent.click(getStartedButton);

    // Should set view to use-cases
    const state = useAppStore.getState();
    expect(state.view).toBe("use-cases");
  });
});

describe("ChannelStep forward navigation", () => {
  it("Continue to app action sets wizardStep to use-case after connect", async () => {
    const mockConfigureChannel = vi.fn().mockResolvedValue({ connected: true });

    (globalThis as any).window = {
      electronAPI: {
        configureChannel: mockConfigureChannel,
      },
    };

    useAppStore.setState({
      wizardStep: "channel",
      selectedFrameworkId: "openclaw",
      currentDeploymentId: "dep-123",
      view: "wizard",
    });

    const { ChannelStep } = await import("../../src/renderer/pages/wizard/ChannelStep");
    const { waitFor } = await import("@testing-library/react");

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

  it("Skip action sets wizardStep to use-case", async () => {
    useAppStore.setState({
      wizardStep: "channel",
      selectedFrameworkId: "openclaw",
      currentDeploymentId: "dep-123",
      view: "wizard",
    });

    const { ChannelStep } = await import("../../src/renderer/pages/wizard/ChannelStep");

    render(<ChannelStep />);

    // Should have a Skip button
    const skipButton = screen.getByRole("button", { name: /Skip/i });
    fireEvent.click(skipButton);

    // Should set wizardStep to use-case
    const state = useAppStore.getState();
    expect(state.wizardStep).toBe("use-case");
  });
});

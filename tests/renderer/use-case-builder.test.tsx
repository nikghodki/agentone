// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Mock clipboard API
const mockWriteText = vi.fn();

// Mock the store
const mockStoreState = { selectedFrameworkId: "zeptoclaw" };
const mockUseAppStore = vi.fn((selector: any) =>
  selector ? selector(mockStoreState) : mockStoreState
);

vi.mock("../../src/renderer/store", () => ({
  useAppStore: (selector?: any) => mockUseAppStore(selector),
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: {
      writeText: mockWriteText,
    },
  });
  mockWriteText.mockResolvedValue(undefined);

  // Default mock for store (zeptoclaw framework)
  mockStoreState.selectedFrameworkId = "zeptoclaw";
});

describe("UseCaseBuilder", () => {
  it("renders use-case cards from catalog", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Should show multiple use cases (at least a few from the ~10)
    expect(screen.getByText(/Plan my day/i)).toBeTruthy();
    expect(screen.getByText(/Summarize/i)).toBeTruthy();
  });

  it("picking a use case shows its fields", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick "Plan my day"
    const researchCard = screen
      .getByText(/Plan my day/i)
      .closest("[role='radio']");
    expect(researchCard).toBeTruthy();
    fireEvent.click(researchCard!);

    // Should show at least one input field (topic or similar)
    await waitFor(() => {
      const inputs = screen.getAllByRole("textbox");
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it("typing into fields updates the live prompt preview", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick a use case
    const researchCard = screen
      .getByText(/Plan my day/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    // Wait for fields to appear
    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Type into the first text field
    const firstInput = screen.getAllByRole("textbox")[0] as HTMLInputElement;
    fireEvent.change(firstInput, { target: { value: "finish report and attend meetings" } });

    // Should show a prompt preview (check that preview updates by looking for prompt template text)
    await waitFor(() => {
      expect(screen.getByText(/Here's everything on my plate today/i)).toBeTruthy();
    });
  });

  it("Copy button calls clipboard.writeText with assembled prompt", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick a use case
    const researchCard = screen
      .getByText(/Plan my day/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    // Wait for fields
    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Fill in all required fields (tasks for plan-day)
    const tasksInput = screen.getByLabelText(/What's on your plate today?/i) as HTMLInputElement;
    fireEvent.change(tasksInput, { target: { value: "finish report, team meeting, code review" } });

    // Click Copy button
    const copyButton = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyButton);

    // Should call clipboard.writeText with a prompt containing the value
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
      const calledWith = mockWriteText.mock.calls[0][0];
      expect(calledWith).toContain("finish report");
    });
  });

  it("shows Copied confirmation after copying", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick and fill
    const researchCard = screen
      .getByText(/Plan my day/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Fill all required fields
    const tasksInput = screen.getByLabelText(/What's on your plate today?/i);
    fireEvent.change(tasksInput, { target: { value: "test tasks" } });

    // Copy
    const copyButton = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyButton);

    // Should show "Copied" confirmation
    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeTruthy();
    });
  });

  it("shows hint about pasting to agent when required fields filled", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick a use case
    const researchCard = screen
      .getByText(/Plan my day/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Fill all required fields
    const tasksInput = screen.getByLabelText(/What's on your plate today?/i);
    fireEvent.change(tasksInput, { target: { value: "AI tasks" } });

    // Should show hint about pasting
    await waitFor(() => {
      const hint = screen.getByText(/paste.*agent/i);
      expect(hint).toBeTruthy();
    });
  });

  it("Copy button disabled when required fields empty (Minor 3)", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick a use case
    const researchCard = screen
      .getByText(/Plan my day/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Copy should be disabled when required field is empty
    const copyButton = screen.getByRole("button", { name: /copy/i }) as HTMLButtonElement;
    expect(copyButton.disabled).toBe(true);

    // Should show hint about filling required fields
    expect(screen.getByText(/fill.*required/i)).toBeTruthy();
  });

  it("Copy button enabled once all required fields filled (Minor 3)", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick a use case
    const researchCard = screen
      .getByText(/Plan my day/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Fill in required field (tasks)
    const tasksInput = screen.getByLabelText(/What's on your plate today?/i) as HTMLInputElement;
    fireEvent.change(tasksInput, { target: { value: "AI research tasks" } });

    // Copy should now be enabled
    await waitFor(() => {
      const copyButton = screen.getByRole("button", { name: /copy/i }) as HTMLButtonElement;
      expect(copyButton.disabled).toBe(false);
    });
  });
});

describe("UseCaseBuilder framework filtering", () => {
  it("with framework=hermes, shows browse-url and NOT remember-info/terminal-task", async () => {
    // Mock the store to return hermes as selected framework
    mockStoreState.selectedFrameworkId = "hermes";

    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Should show browse-url (hermes-specific)
    await waitFor(() => {
      expect(screen.getByText(/Look something up on a live website/i)).toBeTruthy();
    });

    // Should still show universal cases
    expect(screen.getByText(/Plan my day/i)).toBeTruthy();

    // Should NOT show other framework-specific cases
    expect(screen.queryByText(/Remember this for me/i)).toBeNull();
    expect(screen.queryByText(/Get something done on my computer/i)).toBeNull();
  });

  it("with framework=zeptoclaw, shows remember-info and NOT browse-url/terminal-task", async () => {
    // Mock the store to return zeptoclaw as selected framework
    mockStoreState.selectedFrameworkId = "zeptoclaw";

    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Should show remember-info (zeptoclaw-specific)
    await waitFor(() => {
      expect(screen.getByText(/Remember this for me/i)).toBeTruthy();
    });

    // Should still show universal cases
    expect(screen.getByText(/Plan my day/i)).toBeTruthy();

    // Should NOT show other framework-specific cases
    expect(screen.queryByText(/Look something up on a live website/i)).toBeNull();
    expect(screen.queryByText(/Get something done on my computer/i)).toBeNull();
  });

  it("with framework=openclaw, shows terminal-task and NOT browse-url/remember-info", async () => {
    // Mock the store to return openclaw as selected framework
    mockStoreState.selectedFrameworkId = "openclaw";

    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Should show terminal-task (openclaw-specific)
    await waitFor(() => {
      expect(screen.getByText(/Get something done on my computer/i)).toBeTruthy();
    });

    // Should still show universal cases
    expect(screen.getByText(/Plan my day/i)).toBeTruthy();

    // Should NOT show other framework-specific cases
    expect(screen.queryByText(/Look something up on a live website/i)).toBeNull();
    expect(screen.queryByText(/Remember this for me/i)).toBeNull();
  });

  it("picking a tailored card renders its fields and preview (no regression)", async () => {
    // Mock the store to return hermes as selected framework
    mockStoreState.selectedFrameworkId = "hermes";

    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick the browse-url card
    const browseCard = screen
      .getByText(/Look something up on a live website/i)
      .closest("[role='radio']");
    fireEvent.click(browseCard!);

    // Should show the fields for this use case
    await waitFor(() => {
      expect(screen.getByLabelText(/Page URL/i)).toBeTruthy();
      expect(screen.getByLabelText(/What do you want to know from it?/i)).toBeTruthy();
    });

    // Fill in a field
    const urlInput = screen.getByLabelText(/Page URL/i) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "https://example.com" } });

    // Should show live preview
    await waitFor(() => {
      expect(screen.getByText(/https:\/\/example\.com/i)).toBeTruthy();
    });
  });
});

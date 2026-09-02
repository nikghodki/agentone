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
    expect(screen.getByText(/Research a topic/i)).toBeTruthy();
    expect(screen.getByText(/Summarize/i)).toBeTruthy();
  });

  it("picking a use case shows its fields", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick "Research a topic"
    const researchCard = screen
      .getByText(/Research a topic/i)
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
      .getByText(/Research a topic/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    // Wait for fields to appear
    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Type into the first text field
    const firstInput = screen.getAllByRole("textbox")[0] as HTMLInputElement;
    fireEvent.change(firstInput, { target: { value: "machine learning" } });

    // Should show a prompt preview with the value
    await waitFor(() => {
      const preview = screen.getByText(/machine learning/i);
      expect(preview).toBeTruthy();
    });
  });

  it("Copy button calls clipboard.writeText with assembled prompt", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick a use case
    const researchCard = screen
      .getByText(/Research a topic/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    // Wait for fields
    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Fill in all required fields (topic + depth)
    const topicInput = screen.getByLabelText(/topic/i) as HTMLInputElement;
    fireEvent.change(topicInput, { target: { value: "machine learning" } });

    const depthSelect = screen.getByLabelText(/depth/i) as HTMLSelectElement;
    fireEvent.change(depthSelect, { target: { value: "detailed analysis" } });

    // Click Copy button
    const copyButton = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyButton);

    // Should call clipboard.writeText with a prompt containing the value
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
      const calledWith = mockWriteText.mock.calls[0][0];
      expect(calledWith).toContain("machine learning");
    });
  });

  it("shows Copied confirmation after copying", async () => {
    const { UseCaseBuilder } = await import(
      "../../src/renderer/components/UseCaseBuilder"
    );

    render(<UseCaseBuilder />);

    // Pick and fill
    const researchCard = screen
      .getByText(/Research a topic/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Fill all required fields
    const topicInput = screen.getByLabelText(/topic/i);
    fireEvent.change(topicInput, { target: { value: "test" } });

    const depthSelect = screen.getByLabelText(/depth/i);
    fireEvent.change(depthSelect, { target: { value: "detailed analysis" } });

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
      .getByText(/Research a topic/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Fill all required fields
    const topicInput = screen.getByLabelText(/topic/i);
    fireEvent.change(topicInput, { target: { value: "AI" } });

    const depthSelect = screen.getByLabelText(/depth/i);
    fireEvent.change(depthSelect, { target: { value: "detailed analysis" } });

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
      .getByText(/Research a topic/i)
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
      .getByText(/Research a topic/i)
      .closest("[role='radio']");
    fireEvent.click(researchCard!);

    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Fill in required field (topic)
    const topicInput = screen.getByLabelText(/topic/i) as HTMLInputElement;
    fireEvent.change(topicInput, { target: { value: "AI" } });

    // Also need to fill the depth select (required)
    const depthSelect = screen.getByLabelText(/depth/i) as HTMLSelectElement;
    fireEvent.change(depthSelect, { target: { value: "detailed analysis" } });

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
      expect(screen.getByText(/Browse a live web page/i)).toBeTruthy();
    });

    // Should still show universal cases
    expect(screen.getByText(/Research a topic/i)).toBeTruthy();

    // Should NOT show other framework-specific cases
    expect(screen.queryByText(/Remember something for later/i)).toBeNull();
    expect(screen.queryByText(/Automate a terminal task/i)).toBeNull();
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
      expect(screen.getByText(/Remember something for later/i)).toBeTruthy();
    });

    // Should still show universal cases
    expect(screen.getByText(/Research a topic/i)).toBeTruthy();

    // Should NOT show other framework-specific cases
    expect(screen.queryByText(/Browse a live web page/i)).toBeNull();
    expect(screen.queryByText(/Automate a terminal task/i)).toBeNull();
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
      expect(screen.getByText(/Automate a terminal task/i)).toBeTruthy();
    });

    // Should still show universal cases
    expect(screen.getByText(/Research a topic/i)).toBeTruthy();

    // Should NOT show other framework-specific cases
    expect(screen.queryByText(/Browse a live web page/i)).toBeNull();
    expect(screen.queryByText(/Remember something for later/i)).toBeNull();
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
      .getByText(/Browse a live web page/i)
      .closest("[role='radio']");
    fireEvent.click(browseCard!);

    // Should show the fields for this use case
    await waitFor(() => {
      expect(screen.getByLabelText(/Page URL/i)).toBeTruthy();
      expect(screen.getByLabelText(/What should the agent do/i)).toBeTruthy();
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

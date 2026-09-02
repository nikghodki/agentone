// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Mock clipboard API
const mockWriteText = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: {
      writeText: mockWriteText,
    },
  });
  mockWriteText.mockResolvedValue(undefined);
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

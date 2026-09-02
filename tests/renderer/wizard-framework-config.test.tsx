// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { useAppStore } from "../../src/renderer/store";

// Mock window.electronAPI
const mockGetFrameworks = vi.fn();
beforeEach(() => {
  window.electronAPI = {
    getFrameworks: mockGetFrameworks,
  } as any;

  // Reset store
  useAppStore.setState({
    selectedFrameworkId: "zeptoclaw",
    frameworkConfig: {},
    wizardStep: "framework",
  });
});

describe("FrameworkStep", () => {
  it("lists frameworks and marks the default Recommended", async () => {
    // Import dynamically after mock is set up
    const { FrameworkStep } = await import("../../src/renderer/pages/wizard/FrameworkStep");

    mockGetFrameworks.mockResolvedValue([
      {
        id: "openclaw",
        name: "OpenClaw",
        features: ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
        installRecipe: {},
        isDefault: false,
      },
      {
        id: "zeptoclaw",
        name: "ZeptoClaw",
        features: ["Fast", "Lightweight", "Easy", "Powerful", "Reliable"],
        installRecipe: {},
        isDefault: true,
      },
      {
        id: "hermes",
        name: "Hermes",
        features: ["Smart", "Flexible", "Robust", "Efficient", "Modern"],
        installRecipe: {},
        isDefault: false,
      },
    ]);

    render(<FrameworkStep />);

    // Wait for frameworks to load
    await waitFor(() => {
      expect(screen.getByText("ZeptoClaw")).toBeTruthy();
    });

    // Should show all 3 frameworks
    expect(screen.getByText("OpenClaw")).toBeTruthy();
    expect(screen.getByText("ZeptoClaw")).toBeTruthy();
    expect(screen.getByText("Hermes")).toBeTruthy();

    // Should mark ZeptoClaw as Recommended
    expect(screen.getByText("Recommended")).toBeTruthy();
  });

  it("selecting a framework updates store", async () => {
    const { FrameworkStep } = await import("../../src/renderer/pages/wizard/FrameworkStep");

    mockGetFrameworks.mockResolvedValue([
      {
        id: "openclaw",
        name: "OpenClaw",
        features: ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
        installRecipe: {},
        isDefault: false,
      },
      {
        id: "zeptoclaw",
        name: "ZeptoClaw",
        features: ["Fast", "Lightweight", "Easy", "Powerful", "Reliable"],
        installRecipe: {},
        isDefault: true,
      },
      {
        id: "hermes",
        name: "Hermes",
        features: ["Smart", "Flexible", "Robust", "Efficient", "Modern"],
        installRecipe: {},
        isDefault: false,
      },
    ]);

    render(<FrameworkStep />);

    await waitFor(() => {
      expect(screen.getByText("OpenClaw")).toBeTruthy();
    });

    // Click on OpenClaw card
    fireEvent.click(screen.getByText("OpenClaw"));

    // Store should be updated
    await waitFor(() => {
      expect(useAppStore.getState().selectedFrameworkId).toBe("openclaw");
    });
  });
});

describe("ConfigStep", () => {
  it("shows 'no extra setup' and hides advanced by default", async () => {
    const { ConfigStep } = await import("../../src/renderer/pages/wizard/ConfigStep");

    // Set a framework first
    useAppStore.setState({ selectedFrameworkId: "zeptoclaw" });

    render(<ConfigStep />);

    // Should show the no-setup callout with framework name
    expect(screen.getByText(/needs no additional setup/)).toBeTruthy();
    expect(screen.getAllByText(/ZeptoClaw/).length).toBeGreaterThan(0);

    // Advanced section should be hidden by default
    expect(screen.queryByLabelText(/persona/i)).toBeFalsy();
    expect(screen.queryByLabelText(/port/i)).toBeFalsy();
  });

  it("advanced values are captured into frameworkConfig", async () => {
    const { ConfigStep } = await import("../../src/renderer/pages/wizard/ConfigStep");

    useAppStore.setState({ selectedFrameworkId: "zeptoclaw" });

    render(<ConfigStep />);

    // Toggle Advanced section
    const advancedButton = screen.getByRole("button", { name: /advanced/i });
    fireEvent.click(advancedButton);

    // Now inputs should be visible
    await waitFor(() => {
      expect(screen.getByLabelText(/persona/i)).toBeTruthy();
    });

    // Type persona
    const personaInput = screen.getByLabelText(/persona/i) as HTMLTextAreaElement;
    fireEvent.change(personaInput, { target: { value: "You are a helpful assistant" } });

    // Type port
    const portInput = screen.getByLabelText(/port/i) as HTMLInputElement;
    fireEvent.change(portInput, { target: { value: "9000" } });

    // Store should be updated
    await waitFor(() => {
      const config = useAppStore.getState().frameworkConfig;
      expect(config.persona).toBe("You are a helpful assistant");
      expect(config.port).toBe(9000);
    });
  });
});

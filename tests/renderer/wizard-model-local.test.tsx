// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { useAppStore } from "../../src/renderer/store";

beforeEach(() => {
  // Reset store to clean state
  useAppStore.setState({
    wizardStep: "model-location",
    modelBackendDraft: {
      kind: "ollama",
      provider: null,
      baseUrl: null,
      protocol: "v1/chat/completions",
      model: "",
      extra: null,
    },
  });
});

describe("ModelLocationStep", () => {
  it("choosing local advances to model-local and sets kind to ollama", async () => {
    const { ModelLocationStep } = await import("../../src/renderer/pages/wizard/ModelLocationStep");

    render(<ModelLocationStep />);

    // Should show both options
    expect(screen.getByText(/Local model/i)).toBeTruthy();
    expect(screen.getByText(/Cloud model/i)).toBeTruthy();

    // Click on local model option
    fireEvent.click(screen.getByText(/Local model/i));

    // Store should be updated with ollama kind
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      expect(draft.kind).toBe("ollama");
    });
  });

  it("choosing cloud advances to model-cloud and sets kind to cloud", async () => {
    const { ModelLocationStep } = await import("../../src/renderer/pages/wizard/ModelLocationStep");

    render(<ModelLocationStep />);

    // Click on cloud model option
    fireEvent.click(screen.getByText(/Cloud model/i));

    // Store should be updated with cloud kind
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      expect(draft.kind).toBe("cloud");
    });
  });
});

describe("ModelLocalStep", () => {
  it("recommended default populates draft with ollama and curated model", async () => {
    const { ModelLocalStep } = await import("../../src/renderer/pages/wizard/ModelLocalStep");

    useAppStore.setState({ wizardStep: "model-local" });

    render(<ModelLocalStep />);

    // Should show the three options
    expect(screen.getByText(/Recommended default/i)).toBeTruthy();
    expect(screen.getByText(/Choose a model/i)).toBeTruthy();
    expect(screen.getByText(/Custom endpoint/i)).toBeTruthy();

    // Default should be preselected, so draft should already have the curated model
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      expect(draft.kind).toBe("ollama");
      expect(draft.model).toBeTruthy(); // Should have a curated model
      expect(draft.protocol).toBe("v1/chat/completions");
    });
  });

  it("custom endpoint reveals URL, key, and protocol inputs and sets kind to custom", async () => {
    const { ModelLocalStep } = await import("../../src/renderer/pages/wizard/ModelLocalStep");

    useAppStore.setState({ wizardStep: "model-local" });

    render(<ModelLocalStep />);

    // Click on custom endpoint option
    fireEvent.click(screen.getByText(/Custom endpoint/i));

    // Should reveal input fields
    await waitFor(() => {
      expect(screen.getByLabelText(/base url/i)).toBeTruthy();
      expect(screen.getByLabelText(/api key/i)).toBeTruthy();
      expect(screen.getByLabelText(/protocol/i)).toBeTruthy();
    });

    // Fill in the fields
    const urlInput = screen.getByLabelText(/base url/i) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "http://localhost:11434" } });

    const keyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "test-key-123" } });

    const protocolSelect = screen.getByLabelText(/protocol/i) as HTMLSelectElement;
    fireEvent.change(protocolSelect, { target: { value: "v1/messages" } });

    // Store should be updated
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      expect(draft.kind).toBe("custom");
      expect(draft.baseUrl).toBe("http://localhost:11434");
      expect(draft.protocol).toBe("v1/messages");

      // API key must be persisted to cloudForm.apiKey (survives to deploy)
      const cloudForm = useAppStore.getState().cloudForm;
      expect(cloudForm.apiKey).toBe("test-key-123");
    });
  });

  it("choose a model option sets kind to ollama and selected model", async () => {
    const { ModelLocalStep } = await import("../../src/renderer/pages/wizard/ModelLocalStep");

    useAppStore.setState({ wizardStep: "model-local" });

    render(<ModelLocalStep />);

    // Click on choose a model option
    fireEvent.click(screen.getByText(/Choose a model/i));

    // Should reveal model select
    await waitFor(() => {
      expect(screen.getByLabelText(/select model/i)).toBeTruthy();
    });

    const modelSelect = screen.getByLabelText(/select model/i) as HTMLSelectElement;
    fireEvent.change(modelSelect, { target: { value: "llama3.1:8b" } });

    // Store should be updated
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      expect(draft.kind).toBe("ollama");
      expect(draft.model).toBe("llama3.1:8b");
    });
  });
});

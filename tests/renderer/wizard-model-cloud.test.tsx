// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { useAppStore } from "../../src/renderer/store";
import { buildSaveArgs } from "../../src/renderer/pages/model-backend-payload";

beforeEach(() => {
  // Reset store to clean state
  useAppStore.setState({
    wizardStep: "model-cloud",
    modelBackendDraft: {
      kind: "cloud",
      provider: "anthropic",
      baseUrl: null,
      protocol: "v1/messages",
      model: "",
      extra: null,
    },
    cloudForm: {
      apiKey: "",
      resourceUrl: "",
      deployment: "",
      apiVersion: "",
      region: "",
      accessKeyId: "",
      secretAccessKey: "",
      modelPath: "",
    },
  });
});

describe("ModelCloudStep", () => {
  it("renders provider select with 5 options", async () => {
    const { ModelCloudStep } = await import("../../src/renderer/pages/wizard/ModelCloudStep");

    render(<ModelCloudStep />);

    const providerSelect = screen.getByLabelText(/provider/i) as HTMLSelectElement;
    expect(providerSelect).toBeTruthy();

    // Check all 5 providers are available
    const options = Array.from(providerSelect.options).map((opt) => opt.value);
    expect(options).toContain("anthropic");
    expect(options).toContain("openai");
    expect(options).toContain("openrouter");
    expect(options).toContain("azure");
    expect(options).toContain("bedrock");
  });

  it("choosing bedrock shows region + accessKeyId + secretAccessKey fields", async () => {
    const { ModelCloudStep } = await import("../../src/renderer/pages/wizard/ModelCloudStep");

    render(<ModelCloudStep />);

    const providerSelect = screen.getByLabelText(/provider/i) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "bedrock" } });

    await waitFor(() => {
      expect(screen.getByLabelText(/region/i)).toBeTruthy();
      expect(screen.getByLabelText(/access key id/i)).toBeTruthy();
      expect(screen.getByLabelText(/secret access key/i)).toBeTruthy();
    });

    // Should also show a model input
    expect(screen.getByLabelText(/model/i)).toBeTruthy();
  });

  it("choosing azure shows resourceUrl + deployment + apiVersion + apiKey fields", async () => {
    const { ModelCloudStep } = await import("../../src/renderer/pages/wizard/ModelCloudStep");

    render(<ModelCloudStep />);

    const providerSelect = screen.getByLabelText(/provider/i) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "azure" } });

    await waitFor(() => {
      expect(screen.getByLabelText(/resource url/i)).toBeTruthy();
      expect(screen.getByLabelText(/deployment/i)).toBeTruthy();
      expect(screen.getByLabelText(/api version/i)).toBeTruthy();
      expect(screen.getByLabelText(/api key/i)).toBeTruthy();
    });
  });

  it("choosing anthropic shows apiKey field and guided callout", async () => {
    const { ModelCloudStep } = await import("../../src/renderer/pages/wizard/ModelCloudStep");

    render(<ModelCloudStep />);

    const providerSelect = screen.getByLabelText(/provider/i) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "anthropic" } });

    await waitFor(() => {
      expect(screen.getByLabelText(/api key/i)).toBeTruthy();
      expect(screen.getByLabelText(/model/i)).toBeTruthy();
      // Check for callout with console.anthropic.com
      expect(screen.getByText(/console\.anthropic\.com/i)).toBeTruthy();
    });
  });

  it("choosing openai shows apiKey field and guided callout", async () => {
    const { ModelCloudStep } = await import("../../src/renderer/pages/wizard/ModelCloudStep");

    render(<ModelCloudStep />);

    const providerSelect = screen.getByLabelText(/provider/i) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "openai" } });

    await waitFor(() => {
      expect(screen.getByLabelText(/api key/i)).toBeTruthy();
      expect(screen.getByLabelText(/model/i)).toBeTruthy();
      // Check for callout with platform.openai.com
      expect(screen.getByText(/platform\.openai\.com/i)).toBeTruthy();
    });
  });

  it("choosing openrouter shows apiKey field and guided callout", async () => {
    const { ModelCloudStep } = await import("../../src/renderer/pages/wizard/ModelCloudStep");

    render(<ModelCloudStep />);

    const providerSelect = screen.getByLabelText(/provider/i) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "openrouter" } });

    await waitFor(() => {
      expect(screen.getByLabelText(/api key/i)).toBeTruthy();
      expect(screen.getByLabelText(/model/i)).toBeTruthy();
      // Check for callout with openrouter.ai
      expect(screen.getByText(/openrouter\.ai/i)).toBeTruthy();
    });
  });

  it("provider change sets correct defaults mirroring ModelBackendPage", async () => {
    const { ModelCloudStep } = await import("../../src/renderer/pages/wizard/ModelCloudStep");

    render(<ModelCloudStep />);

    const providerSelect = screen.getByLabelText(/provider/i) as HTMLSelectElement;

    // Test openrouter sets baseUrl and protocol
    fireEvent.change(providerSelect, { target: { value: "openrouter" } });
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      expect(draft.provider).toBe("openrouter");
      expect(draft.baseUrl).toBe("https://openrouter.ai/api");
      expect(draft.protocol).toBe("v1/chat/completions");
    });

    // Test anthropic sets protocol (no baseUrl)
    fireEvent.change(providerSelect, { target: { value: "anthropic" } });
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      expect(draft.provider).toBe("anthropic");
      expect(draft.protocol).toBe("v1/messages");
    });

    // Test bedrock sets protocol
    fireEvent.change(providerSelect, { target: { value: "bedrock" } });
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      expect(draft.provider).toBe("bedrock");
      expect(draft.protocol).toBe("v1/messages");
    });
  });

  it("collected state feeds buildSaveArgs correctly for bedrock", async () => {
    const { ModelCloudStep } = await import("../../src/renderer/pages/wizard/ModelCloudStep");

    render(<ModelCloudStep />);

    const providerSelect = screen.getByLabelText(/provider/i) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "bedrock" } });

    await waitFor(() => {
      const regionInput = screen.getByLabelText(/region/i) as HTMLInputElement;
      fireEvent.change(regionInput, { target: { value: "us-west-2" } });

      const accessKeyInput = screen.getByLabelText(/access key id/i) as HTMLInputElement;
      fireEvent.change(accessKeyInput, { target: { value: "AKID123" } });

      const secretKeyInput = screen.getByLabelText(/secret access key/i) as HTMLInputElement;
      fireEvent.change(secretKeyInput, { target: { value: "SECRET456" } });

      const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;
      fireEvent.change(modelInput, { target: { value: "anthropic.claude-3-5-sonnet-20240620-v1:0" } });
    });

    // Wait for state to settle
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      const cloudForm = useAppStore.getState().cloudForm;

      // Call buildSaveArgs with the collected state
      const { draft: finalDraft, secret } = buildSaveArgs(draft, cloudForm);

      // Verify bedrock produces correct extra and secret
      expect(finalDraft.extra).toEqual({ region: "us-west-2" });
      expect(JSON.parse(secret!)).toEqual({
        accessKeyId: "AKID123",
        secretAccessKey: "SECRET456",
      });
    });
  });

  it("collected state feeds buildSaveArgs correctly for azure", async () => {
    const { ModelCloudStep } = await import("../../src/renderer/pages/wizard/ModelCloudStep");

    render(<ModelCloudStep />);

    const providerSelect = screen.getByLabelText(/provider/i) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "azure" } });

    await waitFor(() => {
      const resourceUrlInput = screen.getByLabelText(/resource url/i) as HTMLInputElement;
      fireEvent.change(resourceUrlInput, { target: { value: "https://my.openai.azure.com" } });

      const deploymentInput = screen.getByLabelText(/deployment/i) as HTMLInputElement;
      fireEvent.change(deploymentInput, { target: { value: "gpt-4o" } });

      const apiVersionInput = screen.getByLabelText(/api version/i) as HTMLInputElement;
      fireEvent.change(apiVersionInput, { target: { value: "2024-06-01" } });

      const apiKeyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
      fireEvent.change(apiKeyInput, { target: { value: "AZURE_KEY" } });
    });

    // Wait for state to settle
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      const cloudForm = useAppStore.getState().cloudForm;

      // Call buildSaveArgs with the collected state
      const { draft: finalDraft, secret } = buildSaveArgs(draft, cloudForm);

      // Verify azure produces correct extra and secret
      expect(finalDraft.extra).toEqual({
        resourceUrl: "https://my.openai.azure.com",
        deployment: "gpt-4o",
        apiVersion: "2024-06-01",
      });
      expect(secret).toBe("AZURE_KEY");
    });
  });

  it("collected state feeds buildSaveArgs correctly for openrouter", async () => {
    const { ModelCloudStep } = await import("../../src/renderer/pages/wizard/ModelCloudStep");

    render(<ModelCloudStep />);

    const providerSelect = screen.getByLabelText(/provider/i) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "openrouter" } });

    await waitFor(() => {
      const apiKeyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
      fireEvent.change(apiKeyInput, { target: { value: "OR_KEY" } });

      const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;
      fireEvent.change(modelInput, { target: { value: "meta-llama/llama-3.1-8b" } });
    });

    // Wait for state to settle
    await waitFor(() => {
      const draft = useAppStore.getState().modelBackendDraft;
      const cloudForm = useAppStore.getState().cloudForm;

      // Call buildSaveArgs with the collected state
      const { draft: finalDraft, secret } = buildSaveArgs(draft, cloudForm);

      // Verify openrouter produces correct secret and no extra
      expect(finalDraft.extra ?? null).toBeNull();
      expect(secret).toBe("OR_KEY");
    });
  });
});

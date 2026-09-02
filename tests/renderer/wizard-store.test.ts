import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../../src/renderer/store";

describe("Wizard store slice", () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      wizardStep: "framework",
      frameworkConfig: {},
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

  it("wizard starts at 'framework' and advances", () => {
    const s = useAppStore.getState();
    expect(s.wizardStep).toBe("framework");
    s.setWizardStep("config");
    expect(useAppStore.getState().wizardStep).toBe("config");
  });

  it("resetWizard returns to framework and clears config/cloudForm", () => {
    const s = useAppStore.getState();
    s.patchWizard({ frameworkConfig: { port: 9000 } });
    s.patchWizard({ cloudForm: { apiKey: "test-key" } });
    expect(useAppStore.getState().frameworkConfig).toEqual({ port: 9000 });
    expect(useAppStore.getState().cloudForm.apiKey).toBe("test-key");

    s.resetWizard();
    expect(useAppStore.getState().wizardStep).toBe("framework");
    expect(useAppStore.getState().frameworkConfig).toEqual({});
    expect(useAppStore.getState().cloudForm).toEqual({
      apiKey: "",
      resourceUrl: "",
      deployment: "",
      apiVersion: "",
      region: "",
      accessKeyId: "",
      secretAccessKey: "",
      modelPath: "",
    });
  });

  it("patchWizard merges frameworkConfig", () => {
    const s = useAppStore.getState();
    s.patchWizard({ frameworkConfig: { persona: "AI assistant" } });
    expect(useAppStore.getState().frameworkConfig).toEqual({ persona: "AI assistant" });

    s.patchWizard({ frameworkConfig: { port: 8080 } });
    expect(useAppStore.getState().frameworkConfig).toEqual({ persona: "AI assistant", port: 8080 });
  });

  it("patchWizard merges cloudForm", () => {
    const s = useAppStore.getState();
    s.patchWizard({ cloudForm: { apiKey: "key1", region: "us-east-1" } });
    expect(useAppStore.getState().cloudForm.apiKey).toBe("key1");
    expect(useAppStore.getState().cloudForm.region).toBe("us-east-1");

    s.patchWizard({ cloudForm: { deployment: "prod" } });
    expect(useAppStore.getState().cloudForm.apiKey).toBe("key1");
    expect(useAppStore.getState().cloudForm.deployment).toBe("prod");
  });
});

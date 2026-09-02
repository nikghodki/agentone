// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { WizardLayout } from "../../src/renderer/components/WizardLayout";

describe("WizardLayout", () => {
  const steps = [
    { key: "framework", label: "Framework" },
    { key: "setup", label: "Setup" },
    { key: "model", label: "Model" },
    { key: "deploy", label: "Deploy" },
  ];

  it("renders title and children", () => {
    const { container } = render(
      <WizardLayout
        steps={steps}
        current="framework"
        title="Choose Framework"
        canContinue={false}
        onContinue={vi.fn()}
      >
        <div>Step content</div>
      </WizardLayout>
    );

    expect(within(container).getByText("Choose Framework")).toBeTruthy();
    expect(within(container).getByText("Step content")).toBeTruthy();
  });

  it("Continue button is disabled when canContinue is false", () => {
    const { container } = render(
      <WizardLayout
        steps={steps}
        current="framework"
        title="Choose Framework"
        canContinue={false}
        onContinue={vi.fn()}
      >
        <div>Content</div>
      </WizardLayout>
    );

    const continueBtn = within(container).getByRole("button", { name: /continue/i });
    expect(continueBtn.hasAttribute("disabled")).toBe(true);
  });

  it("Continue button is enabled when canContinue is true and fires onContinue", () => {
    const onContinue = vi.fn();
    const { container } = render(
      <WizardLayout
        steps={steps}
        current="framework"
        title="Choose Framework"
        canContinue={true}
        onContinue={onContinue}
      >
        <div>Content</div>
      </WizardLayout>
    );

    const continueBtn = within(container).getByRole("button", { name: /continue/i });
    expect(continueBtn.hasAttribute("disabled")).toBe(false);
    fireEvent.click(continueBtn);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("Back button is hidden when onBack is not provided", () => {
    const { container } = render(
      <WizardLayout
        steps={steps}
        current="framework"
        title="Choose Framework"
        canContinue={false}
        onContinue={vi.fn()}
      >
        <div>Content</div>
      </WizardLayout>
    );

    // Back button should not exist
    expect(within(container).queryByRole("button", { name: /back/i })).toBeNull();
    // Continue button should exist
    expect(within(container).getByRole("button", { name: /continue/i })).toBeTruthy();
  });

  it("Back button is shown when onBack is provided and fires onBack", () => {
    const onBack = vi.fn();
    const { container } = render(
      <WizardLayout
        steps={steps}
        current="setup"
        title="Setup"
        canContinue={false}
        onBack={onBack}
        onContinue={vi.fn()}
      >
        <div>Content</div>
      </WizardLayout>
    );

    const backBtn = within(container).getByRole("button", { name: /back/i });
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("uses custom continueLabel when provided", () => {
    const { container } = render(
      <WizardLayout
        steps={steps}
        current="deploy"
        title="Deploy"
        canContinue={true}
        onContinue={vi.fn()}
        continueLabel="Install & Deploy"
      >
        <div>Content</div>
      </WizardLayout>
    );

    expect(within(container).getByRole("button", { name: "Install & Deploy" })).toBeTruthy();
  });
});

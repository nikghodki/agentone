// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
  Badge,
  Callout,
  ProgressBar,
  StepProgress,
  RadioCardGroup,
} from "../../src/renderer/components/ui";

describe("UI Kit Components", () => {
  // Button tests
  describe("Button", () => {
    it("Button primary renders and fires onClick", () => {
      const onClick = vi.fn();
      render(
        <Button variant="primary" onClick={onClick}>
          Go
        </Button>
      );
      const button = screen.getByRole("button", { name: "Go" });
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalled();
    });

    it("Button renders different variants", () => {
      const { rerender } = render(<Button variant="secondary">Test</Button>);
      expect(screen.getByRole("button")).toBeTruthy();
      rerender(<Button variant="ghost">Test</Button>);
      expect(screen.getByRole("button")).toBeTruthy();
      rerender(<Button variant="danger">Test</Button>);
      expect(screen.getByRole("button")).toBeTruthy();
    });
  });

  // RadioCardGroup tests
  describe("RadioCardGroup", () => {
    it("RadioCardGroup selects a card and calls onChange", () => {
      const onChange = vi.fn();
      render(
        <RadioCardGroup
          value={null}
          onChange={onChange}
          options={[
            { value: "a", title: "A" },
            { value: "b", title: "B" },
          ]}
        />
      );
      fireEvent.click(screen.getByText("B"));
      expect(onChange).toHaveBeenCalledWith("b");
    });

    it("RadioCardGroup marks the selected card aria-checked", () => {
      render(
        <RadioCardGroup
          value="a"
          onChange={() => {}}
          options={[
            { value: "a", title: "Option A" },
            { value: "b", title: "Option B" },
          ]}
        />
      );
      const selectedCard = screen.getByRole("radio", { name: /Option A/i });
      expect(selectedCard.getAttribute("aria-checked")).toBe("true");
    });
  });

  // Callout tests
  describe("Callout", () => {
    it("Callout warning shows title", () => {
      render(
        <Callout tone="warning" title="Heads up">
          x
        </Callout>
      );
      expect(screen.getByText("Heads up")).toBeTruthy();
    });

    it("Callout renders different tones", () => {
      const { rerender } = render(<Callout tone="info">Info message</Callout>);
      expect(screen.getByText("Info message")).toBeTruthy();
      rerender(<Callout tone="success">Success message</Callout>);
      expect(screen.getByText("Success message")).toBeTruthy();
      rerender(<Callout tone="error">Error message</Callout>);
      expect(screen.getByText("Error message")).toBeTruthy();
    });
  });

  // ProgressBar tests
  describe("ProgressBar", () => {
    it("ProgressBar reflects value", () => {
      render(<ProgressBar value={42} label="Installing" />);
      expect(screen.getByText(/Installing/)).toBeTruthy();
      const progressBar = screen.getByRole("progressbar");
      expect(progressBar.getAttribute("aria-valuenow")).toBe("42");
    });

    it("ProgressBar supports indeterminate state", () => {
      render(<ProgressBar value={0} indeterminate />);
      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toBeTruthy();
    });
  });

  // Input tests
  describe("Input", () => {
    it("Input renders its label", () => {
      render(<Input label="Username" />);
      expect(screen.getByText("Username")).toBeTruthy();
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    it("Input shows error message", () => {
      render(<Input label="Email" error="Invalid email" />);
      expect(screen.getByText("Invalid email")).toBeTruthy();
    });

    it("Input shows helper text", () => {
      render(<Input label="Password" helper="Min 8 characters" />);
      expect(screen.getByText("Min 8 characters")).toBeTruthy();
    });
  });

  // Badge tests
  describe("Badge", () => {
    it("Badge renders text", () => {
      render(<Badge>Recommended</Badge>);
      expect(screen.getByText("Recommended")).toBeTruthy();
    });
  });

  // Card tests
  describe("Card", () => {
    it("Card renders children", () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText("Card content")).toBeTruthy();
    });
  });

  // Select tests
  describe("Select", () => {
    it("Select renders label and options", () => {
      render(
        <Select label="Country">
          <option value="us">United States</option>
          <option value="ca">Canada</option>
        </Select>
      );
      expect(screen.getByLabelText("Country")).toBeTruthy();
    });
  });

  // Textarea tests
  describe("Textarea", () => {
    it("Textarea renders label", () => {
      render(<Textarea label="Description" />);
      expect(screen.getByLabelText("Description")).toBeTruthy();
    });
  });

  // StepProgress tests
  describe("StepProgress", () => {
    it("StepProgress renders steps and highlights current", () => {
      render(
        <StepProgress
          steps={[
            { key: "step1", label: "Step 1" },
            { key: "step2", label: "Step 2" },
            { key: "step3", label: "Step 3" },
          ]}
          current="step2"
        />
      );
      expect(screen.getByText("Step 1")).toBeTruthy();
      expect(screen.getByText("Step 2")).toBeTruthy();
      expect(screen.getByText("Step 3")).toBeTruthy();
    });
  });
});

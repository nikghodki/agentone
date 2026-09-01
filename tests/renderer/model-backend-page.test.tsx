// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModelBackendPage } from "../../src/renderer/pages/ModelBackendPage";

// Mock window.electronAPI
const mockAPI = {
  saveModelBackend: vi.fn().mockResolvedValue("backend-123"),
  deployFramework: vi.fn().mockResolvedValue({ id: "deployment-456" }),
};
(globalThis as any).window = { electronAPI: mockAPI };

describe("ModelBackendPage UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reveals Bedrock fields when Bedrock provider is chosen", async () => {
    render(<ModelBackendPage />);

    // Click Cloud Provider button
    const cloudButton = screen.getByText(/cloud provider/i);
    fireEvent.click(cloudButton);

    // Find the provider dropdown and select Bedrock
    const providerSelect = screen.getByLabelText(/provider/i);
    fireEvent.change(providerSelect, { target: { value: "bedrock" } });

    // Verify Bedrock-specific fields appear
    expect(screen.getByLabelText(/region/i)).toBeTruthy();
    expect(screen.getByLabelText(/access key id/i)).toBeTruthy();
    expect(screen.getByLabelText(/secret access key/i)).toBeTruthy();
  });
});

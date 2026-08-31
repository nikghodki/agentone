import { describe, it, expect } from "vitest";
import { selectModel } from "../../src/main/hardware-detector";
import type { HardwareInfo } from "../../src/shared/types";

describe("selectModel", () => {
  it("selects 4B model for 8GB RAM", () => {
    const hw: HardwareInfo = { totalRamGB: 8, platform: "darwin", arch: "arm64", gpuType: "apple-silicon" };
    const model = selectModel(hw);
    expect(model.name).toBe("gemma3:4b-it-q4_K_M");
    expect(model.sizeGB).toBeLessThanOrEqual(3);
    expect(model.minRamGB).toBeLessThanOrEqual(8);
  });

  it("selects 8B model for 16GB RAM", () => {
    const hw: HardwareInfo = { totalRamGB: 16, platform: "darwin", arch: "arm64", gpuType: "apple-silicon" };
    const model = selectModel(hw);
    expect(model.name).toBe("llama3.2:8b-instruct-q4_K_M");
    expect(model.minRamGB).toBeLessThanOrEqual(16);
  });

  it("selects 14B model for 32GB+ RAM", () => {
    const hw: HardwareInfo = { totalRamGB: 32, platform: "darwin", arch: "arm64", gpuType: "apple-silicon" };
    const model = selectModel(hw);
    expect(model.name).toBe("qwen2.5:14b-instruct-q4_K_M");
  });

  it("selects 4B model for low-end Windows", () => {
    const hw: HardwareInfo = { totalRamGB: 8, platform: "win32", arch: "x64", gpuType: "none" };
    const model = selectModel(hw);
    expect(model.name).toBe("gemma3:4b-it-q4_K_M");
  });
});

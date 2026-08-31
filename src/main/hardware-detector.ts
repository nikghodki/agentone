import os from "os";
import { execSync } from "child_process";
import type { HardwareInfo, ModelChoice } from "../shared/types";

const MODEL_TIERS: ModelChoice[] = [
  { name: "gemma3:4b-it-q4_K_M", displayName: "Gemma 3 4B", sizeGB: 2.5, minRamGB: 8 },
  { name: "llama3.2:8b-instruct-q4_K_M", displayName: "Llama 3.2 8B", sizeGB: 4.5, minRamGB: 12 },
  { name: "qwen2.5:14b-instruct-q4_K_M", displayName: "Qwen 2.5 14B", sizeGB: 8, minRamGB: 24 },
];

export function detectHardware(): HardwareInfo {
  const totalRamGB = Math.round(os.totalmem() / (1024 ** 3));
  const platform = process.platform as "darwin" | "win32" | "linux";
  const arch = process.arch;

  let gpuType: HardwareInfo["gpuType"] = "none";

  if (platform === "darwin" && arch === "arm64") {
    gpuType = "apple-silicon";
  } else if (platform === "win32" || platform === "linux") {
    try {
      const output = execSync("nvidia-smi --query-gpu=name --format=csv,noheader", {
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      }).toString();
      if (output.trim().length > 0) gpuType = "nvidia";
    } catch {
      // no NVIDIA GPU or nvidia-smi not available
    }
  }

  return { totalRamGB, platform, arch, gpuType };
}

export function selectModel(info: HardwareInfo): ModelChoice {
  const available = MODEL_TIERS.filter((m) => m.minRamGB <= info.totalRamGB);
  if (available.length === 0) return MODEL_TIERS[0];
  return available[available.length - 1];
}

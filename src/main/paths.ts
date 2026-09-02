import { app } from "electron";
import path from "path";
import fs from "fs";
import type { AppPaths } from "../shared/types";

/**
 * Resolve the Ollama binary. v2 does not bundle Ollama (it is managed/used at
 * runtime), so prefer a bundled copy if one exists, otherwise fall back to a
 * system install (Homebrew / /usr/local / PATH). Returns the bundled path as a
 * last resort so the resulting spawn error names the expected location.
 */
function resolveOllamaBinary(): string {
  const exe = process.platform === "win32" ? "ollama.exe" : "ollama";
  const bundled = path.join(process.resourcesPath, "ollama", exe);
  const candidates = [
    bundled,
    "/opt/homebrew/bin/ollama",
    "/usr/local/bin/ollama",
    "/usr/bin/ollama",
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  // Not found in known locations — return the bare name so PATH resolution can
  // still find it (and any failure names "ollama" rather than a stale path).
  return exe;
}

/**
 * Resolve the bundled Node 22 binary directory. When the app is packaged,
 * Node 22 is bundled into Contents/Resources/node22-bin/ for openclaw.
 * Returns the directory path if it exists, or null in dev/test environments.
 */
export function resolveBundledNode22BinDir(): string | null {
  // Guard: process.resourcesPath is undefined in dev/test (only set when packaged)
  if (!process.resourcesPath) {
    return null;
  }

  const node22BinDir = path.join(process.resourcesPath, "node22-bin");

  try {
    if (fs.existsSync(node22BinDir)) {
      return node22BinDir;
    }
  } catch {
    /* ignore */
  }

  return null;
}

export function getAppPaths(): AppPaths {
  const userData = app.getPath("userData");
  return {
    userData,
    models: path.join(userData, "models"),
    database: path.join(userData, "agentone.db"),
    ollamaBinary: resolveOllamaBinary(),
  };
}

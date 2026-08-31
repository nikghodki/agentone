import { app } from "electron";
import path from "path";
import type { AppPaths } from "../shared/types";

export function getAppPaths(): AppPaths {
  const userData = app.getPath("userData");
  return {
    userData,
    models: path.join(userData, "models"),
    database: path.join(userData, "agentone.db"),
    ollamaBinary: path.join(
      process.resourcesPath,
      "ollama",
      process.platform === "win32" ? "ollama.exe" : "ollama"
    ),
  };
}

import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { Database } from "./database";
import { RateLimiter } from "./rate-limiter";
import { Secrets } from "./secrets";
import { registerIpcHandlers, shutdownServices } from "./ipc-handlers";
import { getAppPaths, resolveBundledNode22BinDir } from "./paths";
import { seedFrameworkRegistry } from "./framework-registry";

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;

// Main-process crash logging. Packaged Electron routes main-process errors to
// OSLog (not stdout), so an unhandled startup error otherwise exits the app
// silently. Append to a stable file so failures are diagnosable.
function logFatal(context: string, err: unknown): void {
  try {
    const line = `[${new Date().toISOString()}] ${context}: ${
      err instanceof Error ? err.stack || err.message : String(err)
    }\n`;
    fs.appendFileSync(path.join(os.tmpdir(), "agentone-startup-error.log"), line);
  } catch {
    /* diagnostics must never throw */
  }
}
process.on("uncaughtException", (e) => logFatal("uncaughtException", e));
process.on("unhandledRejection", (e) => logFatal("unhandledRejection", e));

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  try {
  // In packaged builds, use bundled Node 22 for openclaw if available
  if (app.isPackaged && !process.env.OPENCLAW_NODE22_BIN_DIR) {
    const bundledNode22Dir = resolveBundledNode22BinDir();
    if (bundledNode22Dir) {
      process.env.OPENCLAW_NODE22_BIN_DIR = bundledNode22Dir;
      console.log(`Using bundled Node 22: ${bundledNode22Dir}`);
    }
  }

  const paths = getAppPaths();
  fs.mkdirSync(paths.models, { recursive: true });

  db = new Database(paths.database);
  db.initialize();
  seedFrameworkRegistry(db);

  app.on("will-quit", () => {
    shutdownServices();
    db?.close();
  });

  const rateLimiter = new RateLimiter(20);
  const secretsPath = path.join(paths.userData, "secrets.json");
  const secrets = new Secrets(secretsPath);
  registerIpcHandlers(db, rateLimiter, secrets);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  } catch (e) {
    logFatal("whenReady", e);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

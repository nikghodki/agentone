import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { Database } from "./database";
import { RateLimiter } from "./rate-limiter";
import { registerIpcHandlers, shutdownServices } from "./ipc-handlers";
import { getAppPaths } from "./paths";
import { seedFrameworkRegistry } from "./framework-registry";

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;

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
  registerIpcHandlers(db, rateLimiter);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

import { describe, it, expect, vi } from "vitest";
import { LlamaCppManager } from "../../src/main/llamacpp-manager";

function jsonResponse(obj: unknown) {
  return { ok: true, status: 200, json: async () => obj, headers: new Map() } as any;
}

it("start() spawns llama-server on loopback with the model path and polls /health", async () => {
  const fakeChild: any = { kill: vi.fn(), on: vi.fn(), stdout: { on: vi.fn() }, stderr: { on: vi.fn() } };
  const spawnFn = vi.fn().mockReturnValue(fakeChild);
  let healthCalls = 0;
  const fetchFn = vi.fn().mockImplementation(async (url: string) => {
    if (String(url).endsWith("/health")) { healthCalls++; return { ok: true } as any; }
    throw new Error("unexpected");
  });
  const mgr = new LlamaCppManager("/fake/llamacpp", { spawnFn, fetchFn: fetchFn as any, port: 8123 });
  await mgr.start("/fake/model.gguf");

  const [cmd, args, opts] = spawnFn.mock.calls[0];
  expect(cmd).toBe("/fake/llamacpp/llama-server");
  expect(args).toEqual(expect.arrayContaining(["--model", "/fake/model.gguf", "--host", "127.0.0.1", "--port", "8123"]));
  expect(mgr.getBaseUrl()).toBe("http://127.0.0.1:8123/v1");
  expect(healthCalls).toBeGreaterThan(0);
});

it("ensureModel() returns a user-supplied local path without downloading", async () => {
  const fetchFn = vi.fn();
  const existsFn = vi.fn().mockReturnValue(true); // File exists
  const mgr = new LlamaCppManager("/fake/llamacpp", { fetchFn: fetchFn as any, existsFn });
  const p = await mgr.ensureModel({ localPath: "/some/existing.gguf" }, () => {});
  expect(p).toBe("/some/existing.gguf");
  expect(fetchFn).not.toHaveBeenCalled();
});

it("stop() sends SIGTERM", async () => {
  const fakeChild: any = { kill: vi.fn(), on: vi.fn(), stdout: { on: vi.fn() }, stderr: { on: vi.fn() } };
  const spawnFn = vi.fn().mockReturnValue(fakeChild);
  const fetchFn = vi.fn().mockResolvedValue({ ok: true } as any);
  const mgr = new LlamaCppManager("/fake/llamacpp", { spawnFn, fetchFn: fetchFn as any, port: 8124 });
  await mgr.start("/m.gguf");
  mgr.stop();
  expect(fakeChild.kill).toHaveBeenCalledWith("SIGTERM");
});

it("ensureInstalled() skips download when llama-server already exists", async () => {
  const fetchFn = vi.fn();
  const existsFn = vi.fn().mockReturnValue(true); // llama-server exists
  const mgr = new LlamaCppManager("/fake/llamacpp", { fetchFn: fetchFn as any, existsFn });
  await mgr.ensureInstalled(() => {});
  expect(fetchFn).not.toHaveBeenCalled();
});

it("ensureInstalled() downloads and unzips llama.cpp when missing", async () => {
  const releasesData = {
    assets: [
      { name: "llama-b1234-bin-macos-arm64.zip", browser_download_url: "https://fake/llama.zip" }
    ]
  };
  const zipData = new Uint8Array([80, 75, 3, 4]); // fake ZIP header
  let progressCalls: number[] = [];

  const fetchFn = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("api.github.com")) {
      return jsonResponse(releasesData);
    }
    if (url === "https://fake/llama.zip") {
      return {
        ok: true,
        headers: { get: (h: string) => h === "content-length" ? "1000" : null },
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: zipData })
              .mockResolvedValueOnce({ done: true, value: null })
          })
        }
      } as any;
    }
    throw new Error("unexpected fetch");
  });

  const existsFn = vi.fn().mockReturnValue(false); // llama-server doesn't exist
  const fsOps = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    chmod: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined)
  };
  const execFileFn = vi.fn().mockImplementation((cmd: string, args: string[], callback: Function) => {
    callback(null); // Success
  });

  const mgr = new LlamaCppManager("/fake/llamacpp", { fetchFn: fetchFn as any, existsFn, fsOps, execFileFn: execFileFn as any });

  await mgr.ensureInstalled((pct) => { progressCalls.push(pct); });

  expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining("api.github.com"));
  expect(fetchFn).toHaveBeenCalledWith("https://fake/llama.zip");
  expect(progressCalls.length).toBeGreaterThan(0);
});

it("ensureModel() downloads GGUF when localPath not provided", async () => {
  const modelData = new Uint8Array([71, 71, 85, 70]); // fake GGUF header
  let progressCalls: number[] = [];

  const fetchFn = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("qwen2.5-1.5b-instruct-q4_k_m.gguf")) {
      return {
        ok: true,
        headers: { get: (h: string) => h === "content-length" ? "2000" : null },
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: modelData })
              .mockResolvedValueOnce({ done: true, value: null })
          })
        }
      } as any;
    }
    throw new Error("unexpected fetch");
  });

  const existsFn = vi.fn().mockReturnValue(false);
  const statSyncFn = vi.fn().mockReturnValue({ size: 2000 }); // Downloaded size matches
  const fsOps = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    chmod: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined)
  };

  const mgr = new LlamaCppManager("/fake/llamacpp", { fetchFn: fetchFn as any, existsFn, fsOps, statSyncFn });

  const path = await mgr.ensureModel({}, (pct) => { progressCalls.push(pct); });

  expect(path).toContain("/fake/llamacpp/models/");
  expect(path).toContain(".gguf");
  expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining("qwen2.5-1.5b-instruct-q4_k_m.gguf"));
  expect(progressCalls.length).toBeGreaterThan(0);
});

it("ensureModel() re-downloads when cached file is incomplete (smaller than content-length)", async () => {
  const modelData = new Uint8Array([71, 71, 85, 70]); // fake GGUF header
  const modelPath = "/fake/llamacpp/models/qwen2.5-1.5b-instruct-q4_k_m.gguf";
  let fileDeleted = false;

  const fetchFn = vi.fn().mockImplementation(async (url: string, opts?: any) => {
    if (opts?.method === "HEAD" && url.includes("qwen2.5-1.5b-instruct-q4_k_m.gguf")) {
      // HEAD returns content-length of 2000 (full size)
      return {
        ok: true,
        headers: { get: (h: string) => h === "content-length" ? "2000" : null }
      } as any;
    }
    if (url.includes("qwen2.5-1.5b-instruct-q4_k_m.gguf")) {
      // GET downloads the file
      return {
        ok: true,
        headers: { get: (h: string) => h === "content-length" ? "2000" : null },
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: modelData })
              .mockResolvedValueOnce({ done: true, value: null })
          })
        }
      } as any;
    }
    throw new Error("unexpected fetch");
  });

  const existsFn = vi.fn().mockImplementation(() => !fileDeleted); // File exists until deleted
  const statSyncFn = vi.fn().mockImplementation(() => {
    // After deletion and re-download, return correct size
    return { size: fileDeleted ? 2000 : 500 };
  });
  const fsOps = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    chmod: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockImplementation(async () => { fileDeleted = true; })
  };

  const mgr = new LlamaCppManager("/fake/llamacpp", { fetchFn: fetchFn as any, existsFn, fsOps, statSyncFn });

  const path = await mgr.ensureModel({}, () => {});

  // Should have done HEAD request to check size
  expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining("qwen2.5-1.5b-instruct-q4_k_m.gguf"), expect.objectContaining({ method: "HEAD" }));
  // Should have deleted the incomplete file
  expect(fsOps.unlink).toHaveBeenCalledWith(modelPath);
  // Should have re-downloaded
  expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining("qwen2.5-1.5b-instruct-q4_k_m.gguf"));
  expect(path).toBe(modelPath);
});

it("ensureModel() throws clear error when user-supplied localPath does not exist", async () => {
  const fetchFn = vi.fn();
  const existsFn = vi.fn().mockReturnValue(false); // localPath doesn't exist
  const mgr = new LlamaCppManager("/fake/llamacpp", { fetchFn: fetchFn as any, existsFn });

  await expect(
    mgr.ensureModel({ localPath: "/missing/model.gguf" }, () => {})
  ).rejects.toThrow(/llama\.cpp model file not found.*\/missing\/model\.gguf/i);

  expect(fetchFn).not.toHaveBeenCalled();
});

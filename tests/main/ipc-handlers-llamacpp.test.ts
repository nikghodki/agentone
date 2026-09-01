import { describe, it, expect, vi } from "vitest";
import { startLlamaCppForBackend, shutdownServices, __setLlamaCppManagerForTest } from "../../src/main/ipc-handlers";

describe("llama.cpp integration in IPC handlers", () => {
  it("starts the manager and rewrites baseUrl to the local server for a llamacpp backend", async () => {
    const mgr = {
      ensureInstalled: vi.fn().mockResolvedValue(undefined),
      ensureModel: vi.fn().mockResolvedValue("/models/m.gguf"),
      start: vi.fn().mockResolvedValue(undefined),
      getBaseUrl: () => "http://127.0.0.1:8123/v1",
      stop: vi.fn(),
    };
    const backend = { id: "x", kind: "llamacpp", provider: null, baseUrl: null,
      protocol: "v1/chat/completions", model: "qwen2.5-1.5b", secretRef: null, extra: null };
    const out = await startLlamaCppForBackend(backend as any, mgr as any, () => {});
    expect(mgr.ensureInstalled).toHaveBeenCalled();
    expect(mgr.ensureModel).toHaveBeenCalled();
    expect(mgr.start).toHaveBeenCalledWith("/models/m.gguf");
    expect(out.baseUrl).toBe("http://127.0.0.1:8123/v1");
  });

  it("shutdownServices stops a registered llama.cpp manager", () => {
    const mgr = { stop: vi.fn() };
    __setLlamaCppManagerForTest(mgr as any);   // test seam mirroring the module-level var
    shutdownServices();
    expect(mgr.stop).toHaveBeenCalled();
  });
});

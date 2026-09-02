import { describe, it, expect, vi } from "vitest";
import { handleRemoveDeployment } from "../../src/main/ipc-handlers";
import type { Database } from "../../src/main/database";
import type { FrameworkAdapter } from "../../src/shared/v2-types";

describe("handleRemoveDeployment", () => {
  it("stops adapter and deletes deployment", async () => {
    const adapter = {
      stop: vi.fn().mockResolvedValue(undefined),
    } as unknown as FrameworkAdapter;

    const db = {
      deleteDeployment: vi.fn(),
    } as unknown as Database;

    await handleRemoveDeployment("dep1", {
      db,
      getAdapter: () => adapter,
    });

    expect(adapter.stop).toHaveBeenCalled();
    expect(db.deleteDeployment).toHaveBeenCalledWith("dep1");
  });

  it("no live adapter: still deletes the row", async () => {
    const db = {
      deleteDeployment: vi.fn(),
    } as unknown as Database;

    await handleRemoveDeployment("dep1", {
      db,
      getAdapter: () => undefined,
    });

    expect(db.deleteDeployment).toHaveBeenCalledWith("dep1");
  });

  it("adapter.stop throwing still deletes the row", async () => {
    const adapter = {
      stop: vi.fn().mockRejectedValue(new Error("stop failed")),
    } as unknown as FrameworkAdapter;

    const db = {
      deleteDeployment: vi.fn(),
    } as unknown as Database;

    // Should not throw — gracefully handles stop failure
    await handleRemoveDeployment("dep1", {
      db,
      getAdapter: () => adapter,
    });

    expect(adapter.stop).toHaveBeenCalled();
    expect(db.deleteDeployment).toHaveBeenCalledWith("dep1");
  });
});

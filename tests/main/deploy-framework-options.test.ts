import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleDeployFramework } from "../../src/main/ipc-handlers";
import type { Database } from "../../src/main/database";
import type { FrameworkAdapter, ModelBackendConfig, Deployment } from "../../src/shared/v2-types";
import type { Secrets } from "../../src/main/secrets";

describe("handleDeployFramework with options", () => {
  let mockDb: Database;
  let mockSecrets: Secrets;
  let mockAdapter: FrameworkAdapter;
  let mockBackend: ModelBackendConfig;
  let mockDeployment: Deployment;

  beforeEach(() => {
    mockBackend = {
      id: "backend-1",
      kind: "cloud",
      provider: "anthropic",
      baseUrl: null,
      protocol: "v1/messages",
      model: "claude-3-5-sonnet-20241022",
      secretRef: null,
      extra: null,
    };

    mockDeployment = {
      id: "deployment-1",
      frameworkId: "zeptoclaw",
      location: "local",
      remoteUrl: null,
      modelBackendId: "backend-1",
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    mockAdapter = {
      install: vi.fn().mockResolvedValue(undefined),
      configure: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      status: vi.fn().mockResolvedValue("healthy"),
      sendTask: vi.fn().mockResolvedValue(undefined),
      streamOutput: vi.fn().mockReturnValue(() => {}),
      listCapabilities: vi.fn().mockResolvedValue([]),
      installCapability: vi.fn().mockResolvedValue(undefined),
      removeCapability: vi.fn().mockResolvedValue({ frameworkRemoved: false }),
      requiresRestartAfterInstall: vi.fn().mockReturnValue(false),
      restart: vi.fn().mockResolvedValue(undefined),
    } as unknown as FrameworkAdapter;

    mockDb = {
      getModelBackend: vi.fn().mockReturnValue(mockBackend),
      createDeployment: vi.fn().mockReturnValue(mockDeployment),
      updateDeploymentStatus: vi.fn(),
    } as unknown as Database;

    mockSecrets = {} as Secrets;
  });

  it("passes options with persona and gatewayPort to adapter.configure", async () => {
    const createAdapterMock = vi.fn().mockReturnValue(mockAdapter);

    const result = await handleDeployFramework(
      mockDb,
      mockSecrets,
      "zeptoclaw",
      "backend-1",
      { persona: "You are a helpful ops bot.", gatewayPort: 8090 },
      createAdapterMock
    );

    expect(createAdapterMock).toHaveBeenCalledWith("zeptoclaw", mockSecrets);
    expect(mockAdapter.configure).toHaveBeenCalledWith(mockBackend, {
      persona: "You are a helpful ops bot.",
      gatewayPort: 8090,
    });
    expect(result.status).toBe("ready");
  });

  it("calls configure with undefined when no options provided (backward compat)", async () => {
    const createAdapterMock = vi.fn().mockReturnValue(mockAdapter);

    await handleDeployFramework(
      mockDb,
      mockSecrets,
      "zeptoclaw",
      "backend-1",
      undefined,
      createAdapterMock
    );

    expect(mockAdapter.configure).toHaveBeenCalledWith(mockBackend, undefined);
  });

  it("creates deployment record and updates status to ready on success", async () => {
    const createAdapterMock = vi.fn().mockReturnValue(mockAdapter);

    const result = await handleDeployFramework(
      mockDb,
      mockSecrets,
      "zeptoclaw",
      "backend-1",
      { persona: "Test persona" },
      createAdapterMock
    );

    expect(mockDb.createDeployment).toHaveBeenCalledWith({
      frameworkId: "zeptoclaw",
      location: "local",
      remoteUrl: null,
      modelBackendId: "backend-1",
    });
    expect(mockDb.updateDeploymentStatus).toHaveBeenCalledWith("deployment-1", "ready");
    expect(result.id).toBe("deployment-1");
    expect(result.status).toBe("ready");
  });
});

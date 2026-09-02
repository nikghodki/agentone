import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleConfigureChannel,
  handleListChannels,
  handleRemoveChannel,
} from "../../src/main/ipc-handlers";

describe("configure-channel IPC handlers", () => {
  describe("handleConfigureChannel", () => {
    it("adapter without configureChannel method throws clear error", async () => {
      const adapter = { status: vi.fn() };
      const db = { recordChannel: vi.fn() };
      const secrets = { set: vi.fn() };

      await expect(
        handleConfigureChannel(
          "dep1",
          { id: "telegram", config: {}, secrets: { botToken: "T123" } },
          { db: db as any, getAdapter: () => adapter as any, secrets: secrets as any }
        )
      ).rejects.toThrow("does not support channel setup");

      expect(secrets.set).not.toHaveBeenCalled();
      expect(db.recordChannel).not.toHaveBeenCalled();
    });

    it("happy path: stores secrets → configureChannel → requiresRestart true → monitored restart → verify → record", async () => {
      const adapter = {
        configureChannel: vi.fn().mockResolvedValue(undefined),
        requiresRestartAfterChannelChange: vi.fn().mockReturnValue(true),
        stop: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
        status: vi.fn()
          .mockResolvedValueOnce("unhealthy")
          .mockResolvedValueOnce("healthy"),
        verifyChannel: vi.fn().mockResolvedValue({ connected: true, detail: "OK" }),
      };
      const db = { recordChannel: vi.fn() };
      const secrets = { set: vi.fn() };

      const result = await handleConfigureChannel(
        "dep1",
        { id: "telegram", config: { foo: "bar" }, secrets: { botToken: "T123", otherSecret: "S456" } },
        { db: db as any, getAdapter: () => adapter as any, secrets: secrets as any }
      );

      // Secrets stored (NEVER logged)
      expect(secrets.set).toHaveBeenCalledWith("channel:dep1:telegram:botToken", "T123");
      expect(secrets.set).toHaveBeenCalledWith("channel:dep1:telegram:otherSecret", "S456");
      expect(secrets.set).toHaveBeenCalledTimes(2);

      // configureChannel called with spec
      expect(adapter.configureChannel).toHaveBeenCalledWith({
        id: "telegram",
        config: { foo: "bar" },
        secrets: { botToken: "T123", otherSecret: "S456" },
      });

      // Monitored restart: stop → start → status poll
      expect(adapter.stop).toHaveBeenCalled();
      expect(adapter.start).toHaveBeenCalled();
      expect(adapter.status).toHaveBeenCalled();

      // verifyChannel called
      expect(adapter.verifyChannel).toHaveBeenCalledWith("telegram");

      // DB record created
      expect(db.recordChannel).toHaveBeenCalledWith({
        deploymentId: "dep1",
        channelId: "telegram",
        secretRef: "channel:dep1:telegram",
      });

      // Returns verify result
      expect(result).toEqual({ connected: true, detail: "OK" });
    });

    it("requiresRestart false: skips restart, calls verify directly", async () => {
      const adapter = {
        configureChannel: vi.fn().mockResolvedValue(undefined),
        requiresRestartAfterChannelChange: vi.fn().mockReturnValue(false),
        stop: vi.fn(),
        start: vi.fn(),
        verifyChannel: vi.fn().mockResolvedValue({ connected: true }),
      };
      const db = { recordChannel: vi.fn() };
      const secrets = { set: vi.fn() };

      await handleConfigureChannel(
        "dep1",
        { id: "slack", config: {}, secrets: { token: "S" } },
        { db: db as any, getAdapter: () => adapter as any, secrets: secrets as any }
      );

      expect(adapter.stop).not.toHaveBeenCalled();
      expect(adapter.start).not.toHaveBeenCalled();
      expect(adapter.verifyChannel).toHaveBeenCalledWith("slack");
    });

    it("restart failure → returns connected:false (does not throw away config)", async () => {
      const adapter = {
        configureChannel: vi.fn().mockResolvedValue(undefined),
        requiresRestartAfterChannelChange: vi.fn().mockReturnValue(true),
        stop: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockRejectedValue(new Error("start failed")),
        verifyChannel: vi.fn(),
      };
      const db = { recordChannel: vi.fn() };
      const secrets = { set: vi.fn() };

      const result = await handleConfigureChannel(
        "dep1",
        { id: "telegram", config: {}, secrets: { botToken: "T" } },
        { db: db as any, getAdapter: () => adapter as any, secrets: secrets as any }
      );

      // Should NOT throw; returns failure
      expect(result).toEqual({
        connected: false,
        detail: expect.stringMatching(/restart failed/i),
      });

      // Config was still written
      expect(adapter.configureChannel).toHaveBeenCalled();
      // DB record still created (adapter config is written, restart failure doesn't revert)
      expect(db.recordChannel).toHaveBeenCalled();
      // verifyChannel not called (restart failed before verify)
      expect(adapter.verifyChannel).not.toHaveBeenCalled();
    });

    it("status never healthy → returns connected:false with timeout detail", async () => {
      const adapter = {
        configureChannel: vi.fn().mockResolvedValue(undefined),
        requiresRestartAfterChannelChange: vi.fn().mockReturnValue(true),
        stop: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
        status: vi.fn().mockResolvedValue("unhealthy"), // always unhealthy
        verifyChannel: vi.fn(),
      };
      const db = { recordChannel: vi.fn() };
      const secrets = { set: vi.fn() };

      const result = await handleConfigureChannel(
        "dep1",
        { id: "telegram", config: {}, secrets: { botToken: "T" } },
        { db: db as any, getAdapter: () => adapter as any, secrets: secrets as any }
      );

      expect(result).toEqual({
        connected: false,
        detail: expect.stringMatching(/timeout|healthy/i),
      });
      expect(adapter.verifyChannel).not.toHaveBeenCalled();
      expect(db.recordChannel).toHaveBeenCalled();
    }, 15000); // 15 second timeout for this test

    it("adapter without verifyChannel → returns connected:false with detail", async () => {
      const adapter = {
        configureChannel: vi.fn().mockResolvedValue(undefined),
        requiresRestartAfterChannelChange: vi.fn().mockReturnValue(false),
        // no verifyChannel method
      };
      const db = { recordChannel: vi.fn() };
      const secrets = { set: vi.fn() };

      const result = await handleConfigureChannel(
        "dep1",
        { id: "telegram", config: {}, secrets: { botToken: "T" } },
        { db: db as any, getAdapter: () => adapter as any, secrets: secrets as any }
      );

      expect(result).toEqual({
        connected: false,
        detail: expect.stringMatching(/verify unsupported/i),
      });
      expect(db.recordChannel).toHaveBeenCalled();
    });

    it("no secrets provided → only stores config, no secret.set calls", async () => {
      const adapter = {
        configureChannel: vi.fn().mockResolvedValue(undefined),
        requiresRestartAfterChannelChange: vi.fn().mockReturnValue(false),
        verifyChannel: vi.fn().mockResolvedValue({ connected: true }),
      };
      const db = { recordChannel: vi.fn() };
      const secrets = { set: vi.fn() };

      await handleConfigureChannel(
        "dep1",
        { id: "webhook", config: { url: "http://example.com" }, secrets: {} },
        { db: db as any, getAdapter: () => adapter as any, secrets: secrets as any }
      );

      expect(secrets.set).not.toHaveBeenCalled();
      expect(adapter.configureChannel).toHaveBeenCalledWith({
        id: "webhook",
        config: { url: "http://example.com" },
        secrets: {},
      });
    });
  });

  describe("handleListChannels", () => {
    it("adapter with listChannels → returns the list", async () => {
      const adapter = {
        listChannels: vi.fn().mockResolvedValue([
          { id: "telegram", enabled: true, connected: true },
          { id: "slack", enabled: false },
        ]),
      };

      const result = await handleListChannels("dep1", {
        db: {} as any,
        getAdapter: () => adapter as any,
        secrets: {} as any,
      });

      expect(adapter.listChannels).toHaveBeenCalled();
      expect(result).toEqual([
        { id: "telegram", enabled: true, connected: true },
        { id: "slack", enabled: false },
      ]);
    });

    it("adapter without listChannels → returns empty array", async () => {
      const adapter = {}; // no listChannels method

      const result = await handleListChannels("dep1", {
        db: {} as any,
        getAdapter: () => adapter as any,
        secrets: {} as any,
      });

      expect(result).toEqual([]);
    });

    it("no adapter (deployment not found) → returns empty array", async () => {
      const result = await handleListChannels("dep1", {
        db: {} as any,
        getAdapter: () => undefined,
        secrets: {} as any,
      });

      expect(result).toEqual([]);
    });
  });

  describe("handleRemoveChannel", () => {
    it("happy path: removeChannel → requiresRestart true → monitored restart → removeChannelRecord → delete secrets", async () => {
      const adapter = {
        removeChannel: vi.fn().mockResolvedValue({ removed: true }),
        requiresRestartAfterChannelChange: vi.fn().mockReturnValue(true),
        stop: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
        status: vi.fn().mockResolvedValue("healthy"),
      };
      const db = {
        removeChannelRecord: vi.fn(),
        getChannels: vi.fn().mockReturnValue([{ channelId: "telegram", secretRef: "channel:dep1:telegram" }]),
      };
      const secrets = { delete: vi.fn() };

      const result = await handleRemoveChannel("dep1", "telegram", {
        db: db as any,
        getAdapter: () => adapter as any,
        secrets: secrets as any,
      });

      expect(adapter.removeChannel).toHaveBeenCalledWith("telegram");
      expect(adapter.stop).toHaveBeenCalled();
      expect(adapter.start).toHaveBeenCalled();
      expect(db.removeChannelRecord).toHaveBeenCalledWith("dep1", "telegram");

      // Secrets deleted - telegram has 1 secret field (botToken) per CHANNELS catalog
      expect(secrets.delete).toHaveBeenCalledWith("channel:dep1:telegram:botToken");

      expect(result).toEqual({ removed: true });
    });

    it("slack channel: deletes ALL 3 secret fields (botToken, signingSecret, appToken) - catalog-derived, no orphans", async () => {
      const adapter = {
        removeChannel: vi.fn().mockResolvedValue({ removed: true }),
        requiresRestartAfterChannelChange: vi.fn().mockReturnValue(false),
      };
      const db = { removeChannelRecord: vi.fn(), getChannels: vi.fn().mockReturnValue([]) };
      const secrets = { delete: vi.fn() };

      await handleRemoveChannel("dep1", "slack", {
        db: db as any,
        getAdapter: () => adapter as any,
        secrets: secrets as any,
      });

      // Slack has 3 secret fields per CHANNELS catalog
      expect(secrets.delete).toHaveBeenCalledWith("channel:dep1:slack:botToken");
      expect(secrets.delete).toHaveBeenCalledWith("channel:dep1:slack:signingSecret");
      expect(secrets.delete).toHaveBeenCalledWith("channel:dep1:slack:appToken");
      expect(secrets.delete).toHaveBeenCalledTimes(3); // no more, no less
    });

    it("requiresRestart false: skips restart", async () => {
      const adapter = {
        removeChannel: vi.fn().mockResolvedValue({ removed: true }),
        requiresRestartAfterChannelChange: vi.fn().mockReturnValue(false),
        stop: vi.fn(),
        start: vi.fn(),
      };
      const db = { removeChannelRecord: vi.fn(), getChannels: vi.fn().mockReturnValue([]) };
      const secrets = { delete: vi.fn() };

      await handleRemoveChannel("dep1", "telegram", {
        db: db as any,
        getAdapter: () => adapter as any,
        secrets: secrets as any,
      });

      expect(adapter.stop).not.toHaveBeenCalled();
      expect(adapter.start).not.toHaveBeenCalled();
    });

    it("adapter without removeChannel → throws clear error", async () => {
      const adapter = {}; // no removeChannel method

      await expect(
        handleRemoveChannel("dep1", "telegram", {
          db: {} as any,
          getAdapter: () => adapter as any,
          secrets: {} as any,
        })
      ).rejects.toThrow("does not support channel");
    });

    it("no adapter → throws clear error", async () => {
      await expect(
        handleRemoveChannel("dep1", "telegram", {
          db: {} as any,
          getAdapter: () => undefined,
          secrets: {} as any,
        })
      ).rejects.toThrow("not found");
    });
  });
});

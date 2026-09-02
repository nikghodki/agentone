import { describe, it, expect } from "vitest";
import { CHANNELS } from "../../src/shared/channels";

describe("Channel Catalog", () => {
  it("includes telegram with botToken secret field", () => {
    const telegram = CHANNELS.find((c) => c.id === "telegram");
    expect(telegram).toBeDefined();
    expect(telegram!.name).toBe("Telegram");
    expect(telegram!.kind).toBe("credential");

    const botTokenField = telegram!.fields.find((f) => f.key === "botToken");
    expect(botTokenField).toBeDefined();
    expect(botTokenField!.secret).toBe(true);
    expect(botTokenField!.label).toBeTruthy();

    expect(telegram!.frameworks).toContain("openclaw");
    expect(telegram!.frameworks).toContain("zeptoclaw");
    expect(telegram!.frameworks).toContain("hermes");
    expect(telegram!.instructions).toBeTruthy();
  });

  it("includes slack with three secret fields (frameworks deferred to 2c)", () => {
    const slack = CHANNELS.find((c) => c.id === "slack");
    expect(slack).toBeDefined();
    expect(slack!.name).toBe("Slack");
    expect(slack!.kind).toBe("credential");

    expect(slack!.fields).toHaveLength(3);

    const botToken = slack!.fields.find((f) => f.key === "botToken");
    expect(botToken).toBeDefined();
    expect(botToken!.secret).toBe(true);

    const signingSecret = slack!.fields.find((f) => f.key === "signingSecret");
    expect(signingSecret).toBeDefined();
    expect(signingSecret!.secret).toBe(true);

    const appToken = slack!.fields.find((f) => f.key === "appToken");
    expect(appToken).toBeDefined();
    expect(appToken!.secret).toBe(true);

    // Slice 2a: only telegram verified; slack deferred to 2c
    expect(slack!.frameworks).toEqual([]);
    expect(slack!.instructions).toBeTruthy();
  });

  it("includes discord with botToken secret field (frameworks deferred to 2c)", () => {
    const discord = CHANNELS.find((c) => c.id === "discord");
    expect(discord).toBeDefined();
    expect(discord!.name).toBe("Discord");
    expect(discord!.kind).toBe("credential");

    const botTokenField = discord!.fields.find((f) => f.key === "botToken");
    expect(botTokenField).toBeDefined();
    expect(botTokenField!.secret).toBe(true);

    // Slice 2a: only telegram verified; discord deferred to 2c
    expect(discord!.frameworks).toEqual([]);
    expect(discord!.instructions).toBeTruthy();
  });

  it("telegram has frameworks; slack/discord/whatsapp_cloud deferred to 2c (empty frameworks)", () => {
    const telegram = CHANNELS.find((c) => c.id === "telegram");
    expect(telegram!.frameworks).toEqual(["openclaw", "zeptoclaw", "hermes"]);

    const slack = CHANNELS.find((c) => c.id === "slack");
    expect(slack!.frameworks).toEqual([]);

    const discord = CHANNELS.find((c) => c.id === "discord");
    expect(discord!.frameworks).toEqual([]);

    const whatsapp = CHANNELS.find((c) => c.id === "whatsapp_cloud");
    expect(whatsapp!.frameworks).toEqual([]);
  });
});

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

  it("includes slack with three secret fields (frameworks delivered in 2c)", () => {
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

    // Slice 2c: slack frameworks delivered
    expect(slack!.frameworks).toContain("openclaw");
    expect(slack!.frameworks).toContain("zeptoclaw");
    expect(slack!.frameworks).toContain("hermes");
    expect(slack!.instructions).toBeTruthy();
  });

  it("includes discord with botToken secret field (frameworks delivered in 2c)", () => {
    const discord = CHANNELS.find((c) => c.id === "discord");
    expect(discord).toBeDefined();
    expect(discord!.name).toBe("Discord");
    expect(discord!.kind).toBe("credential");

    const botTokenField = discord!.fields.find((f) => f.key === "botToken");
    expect(botTokenField).toBeDefined();
    expect(botTokenField!.secret).toBe(true);

    // Slice 2c: discord frameworks delivered
    expect(discord!.frameworks).toContain("openclaw");
    expect(discord!.frameworks).toContain("zeptoclaw");
    expect(discord!.frameworks).toContain("hermes");
    expect(discord!.instructions).toBeTruthy();
  });

  it("telegram/slack/discord have frameworks; whatsapp_cloud still deferred", () => {
    const telegram = CHANNELS.find((c) => c.id === "telegram");
    expect(telegram!.frameworks).toEqual(["openclaw", "zeptoclaw", "hermes"]);

    const slack = CHANNELS.find((c) => c.id === "slack");
    expect(slack!.frameworks).toContain("openclaw");
    expect(slack!.frameworks).toContain("zeptoclaw");
    expect(slack!.frameworks).toContain("hermes");

    const discord = CHANNELS.find((c) => c.id === "discord");
    expect(discord!.frameworks).toContain("openclaw");
    expect(discord!.frameworks).toContain("zeptoclaw");
    expect(discord!.frameworks).toContain("hermes");

    const whatsapp = CHANNELS.find((c) => c.id === "whatsapp_cloud");
    expect(whatsapp!.frameworks).toEqual([]);
  });

  // Task 1 (Slice 2c): Slack + Discord frameworks enabled, slack optional fields, whatsapp_web qr
  it("slack has all three frameworks after 2c", () => {
    const slack = CHANNELS.find((c) => c.id === "slack");
    expect(slack).toBeDefined();
    expect(slack!.frameworks).toContain("openclaw");
    expect(slack!.frameworks).toContain("zeptoclaw");
    expect(slack!.frameworks).toContain("hermes");
  });

  it("discord has all three frameworks after 2c", () => {
    const discord = CHANNELS.find((c) => c.id === "discord");
    expect(discord).toBeDefined();
    expect(discord!.frameworks).toContain("openclaw");
    expect(discord!.frameworks).toContain("zeptoclaw");
    expect(discord!.frameworks).toContain("hermes");
  });

  it("slack has botToken, appToken, and optional signingSecret", () => {
    const slack = CHANNELS.find((c) => c.id === "slack");
    expect(slack).toBeDefined();
    expect(slack!.fields).toHaveLength(3);

    const botToken = slack!.fields.find((f) => f.key === "botToken");
    expect(botToken).toBeDefined();
    expect(botToken!.secret).toBe(true);

    const appToken = slack!.fields.find((f) => f.key === "appToken");
    expect(appToken).toBeDefined();
    expect(appToken!.secret).toBe(true);

    const signingSecret = slack!.fields.find((f) => f.key === "signingSecret");
    expect(signingSecret).toBeDefined();
    expect(signingSecret!.secret).toBe(true);
    expect(signingSecret!.optional).toBe(true);
    expect(signingSecret!.help).toMatch(/hermes|openclaw/i);
  });

  it("whatsapp_web channel exists with kind qr", () => {
    const whatsappWeb = CHANNELS.find((c) => c.id === "whatsapp_web");
    expect(whatsappWeb).toBeDefined();
    expect(whatsappWeb!.name).toBeTruthy();
    expect(whatsappWeb!.kind).toBe("qr");
    expect(whatsappWeb!.fields).toEqual([]);
    expect(whatsappWeb!.frameworks).toContain("openclaw");
    expect(whatsappWeb!.frameworks).toContain("zeptoclaw");
    expect(whatsappWeb!.frameworks).toContain("hermes");
    expect(whatsappWeb!.instructions).toBeTruthy();
    expect(whatsappWeb!.instructions.length).toBeGreaterThan(0);
  });

  it("catalog invariant: all channels have required fields (including whatsapp_web)", () => {
    for (const ch of CHANNELS) {
      expect(ch.id).toBeTruthy();
      expect(ch.name).toBeTruthy();
      expect(ch.kind).toBeTruthy();
      expect(ch.fields).toBeDefined();
      expect(ch.frameworks).toBeDefined();
      expect(ch.instructions).toBeTruthy();
    }
  });
});

export interface ChannelField {
  key: string;
  label: string;
  secret?: boolean;
  help?: string;
  placeholder?: string;
}

export interface ChannelDef {
  id: string;
  name: string;
  kind: "credential" | "qr" | "generic";
  fields: ChannelField[];
  frameworks: string[];
  instructions: string;
}

export const CHANNELS: ChannelDef[] = [
  {
    id: "telegram",
    name: "Telegram",
    kind: "credential",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        secret: true,
        help: "Get this from @BotFather on Telegram",
        placeholder: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
      }
    ],
    frameworks: ["openclaw", "zeptoclaw", "hermes"],
    instructions: "Create a bot using @BotFather on Telegram. Send /newbot and follow the prompts. Copy the bot token provided."
  },
  {
    id: "slack",
    name: "Slack",
    kind: "credential",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        secret: true,
        help: "Bot User OAuth Token from Slack app settings",
        placeholder: "xoxb-..."
      },
      {
        key: "signingSecret",
        label: "Signing Secret",
        secret: true,
        help: "Found in your Slack app's Basic Information section",
        placeholder: "abc123..."
      },
      {
        key: "appToken",
        label: "App Token",
        secret: true,
        help: "App-level token for Socket Mode (optional for some setups)",
        placeholder: "xapp-..."
      }
    ],
    frameworks: [], // per-framework config mapping deferred to Slice 2c
    instructions: "Create a Slack app at api.slack.com/apps. Enable Socket Mode and generate an app-level token. Install the app to your workspace and copy the bot token from OAuth & Permissions. Get the signing secret from Basic Information."
  },
  {
    id: "discord",
    name: "Discord",
    kind: "credential",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        secret: true,
        help: "From Discord Developer Portal",
        placeholder: "Your bot token"
      }
    ],
    frameworks: [], // per-framework config mapping deferred to Slice 2c
    instructions: "Go to Discord Developer Portal (discord.com/developers/applications). Create a new application, navigate to the Bot section, and create a bot. Copy the bot token. Enable necessary intents (Message Content, Server Members, etc.)."
  },
  {
    id: "whatsapp_cloud",
    name: "WhatsApp Cloud",
    kind: "credential",
    fields: [
      {
        key: "phoneNumberId",
        label: "Phone Number ID",
        secret: false,
        help: "From Meta Business Account",
        placeholder: "1234567890"
      },
      {
        key: "accessToken",
        label: "Access Token",
        secret: true,
        help: "Permanent access token from Meta",
        placeholder: "Your access token"
      },
      {
        key: "webhookVerifyToken",
        label: "Webhook Verify Token",
        secret: true,
        help: "Custom token for webhook verification",
        placeholder: "Your verify token"
      }
    ],
    frameworks: [], // per-framework config mapping deferred to Slice 2c
    instructions: "Set up WhatsApp Business API through Meta Business. Create a business account, add a phone number, and generate an access token. Configure webhook with a verify token. Note: Requires a public HTTPS webhook endpoint."
  }
];

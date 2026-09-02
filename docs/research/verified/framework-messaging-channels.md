# Framework Messaging Channel Setup - VERIFIED

**Verification Date:** 2026-09-02  
**Task:** AgentOne Redesign Phase 2 - Messaging channel setup, activation, verify, and remove procedures  
**Scope:** Per-framework channel configuration for guided channel-setup wizard + channels management UI

---

## Executive Summary

All three frameworks (ZeptoClaw, Hermes, OpenClaw) support multiple messaging channels with varying levels of sophistication. This document provides exact setup procedures, required user inputs, activation methods, verification commands, and removal procedures for each supported channel per framework.

**Key Findings:**
- **ZeptoClaw**: 6 channels (telegram, discord, slack, whatsapp_web, whatsapp_cloud, webhook)
- **Hermes**: 8+ channels (telegram, discord, whatsapp, whatsapp-cloud, slack, signal, teams, google_chat)
- **OpenClaw**: 30 channels (telegram, whatsapp, discord, slack, signal, imessage, and 24 more)

All frameworks use interactive prompts for channel setup when run without arguments. The gateway must be running for channels to be active.

---

## Summary Matrix: Framework × Channel Support

| Channel | ZeptoClaw | Hermes | OpenClaw | Notes |
|---------|-----------|--------|----------|-------|
| **Telegram** | ✅ VERIFIED | ✅ VERIFIED | ✅ VERIFIED | Bot token required |
| **Discord** | ✅ VERIFIED | ✅ VERIFIED | ✅ VERIFIED | Bot token required |
| **Slack** | ✅ VERIFIED | ✅ VERIFIED | ✅ VERIFIED | Bot token + signing secret |
| **WhatsApp (Web)** | ✅ VERIFIED | ✅ VERIFIED | ✅ VERIFIED | QR code pairing |
| **WhatsApp (Cloud)** | ✅ VERIFIED | ✅ VERIFIED | ❌ NOT SUPPORTED | Business API required |
| **Signal** | ❌ NOT SUPPORTED | ✅ ASSUMED | ✅ VERIFIED | signal-cli required |
| **iMessage** | ❌ NOT SUPPORTED | ❌ NOT SUPPORTED | ✅ ASSUMED | macOS only |
| **Webhook** | ✅ VERIFIED | ❌ NOT SUPPORTED | ❌ NOT SUPPORTED | HTTP POST endpoint |
| **IRC** | ❌ NOT SUPPORTED | ❌ NOT SUPPORTED | ✅ ASSUMED | Server/channel config |
| **Google Chat** | ❌ NOT SUPPORTED | ✅ ASSUMED | ✅ ASSUMED | Workspace integration |
| **MS Teams** | ❌ NOT SUPPORTED | ✅ ASSUMED | ✅ ASSUMED | App registration required |
| **Matrix** | ❌ NOT SUPPORTED | ❌ NOT SUPPORTED | ✅ ASSUMED | Homeserver + access token |
| **Mattermost** | ❌ NOT SUPPORTED | ❌ NOT SUPPORTED | ✅ ASSUMED | Personal access token |
| **30+ Others** | ❌ | ❌ | ✅ ASSUMED | OpenClaw comprehensive support |

**Legend:**
- ✅ VERIFIED: Command/help output confirmed
- ✅ ASSUMED: Listed in help/docs but not interactively tested
- ❌ NOT SUPPORTED: Not mentioned in help output

---

## ZeptoClaw Channel Configuration

**CLI Location:** `/opt/homebrew/bin/zeptoclaw`  
**Config File:** `~/.zeptoclaw/config.json`  
**Gateway Command:** `zeptoclaw gateway`

### Supported Channels (VERIFIED)

1. telegram
2. discord
3. slack
4. whatsapp_web
5. whatsapp_cloud
6. webhook

### Channel Setup: General Pattern

**Command:**
```bash
zeptoclaw channel setup <CHANNEL_NAME>
```

**Options:** Interactive prompts (PROMPTS interactively for credentials)

**Status Check:**
```bash
zeptoclaw channel list
```

**Output:**
```
Channels:
  telegram        disabled   -
  discord         disabled   -
  slack           disabled   -
  whatsapp_web    disabled   -
  whatsapp_cloud  disabled   -
  webhook         disabled   -
```

**Verify Connection:**
```bash
zeptoclaw channel test <CHANNEL_NAME>
```

### Per-Channel Configuration

#### 1. Telegram

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Command** | `zeptoclaw channel setup telegram` |
| **Required User Inputs** | - Bot token (from @BotFather)<br>- Optional: Allowed chat IDs |
| **Config Keys** | Unknown (PROMPTS interactively) |
| **Activation** | Gateway must be running (`zeptoclaw gateway`) |
| **Verify Connected** | `zeptoclaw channel list` (shows "enabled") or `zeptoclaw channel test telegram` |
| **Remove** | Manual config edit (no CLI command) |

**Notes:** PROMPTS interactively for bot token. No non-interactive command flags found.

#### 2. Discord

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Command** | `zeptoclaw channel setup discord` |
| **Required User Inputs** | - Bot token (from Discord Developer Portal) |
| **Config Keys** | Unknown (PROMPTS interactively) |
| **Activation** | Gateway must be running (`zeptoclaw gateway`) |
| **Verify Connected** | `zeptoclaw channel list` or `zeptoclaw channel test discord` |
| **Remove** | Manual config edit (no CLI command) |

#### 3. Slack

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Command** | `zeptoclaw channel setup slack` |
| **Required User Inputs** | - Bot token<br>- Signing secret (from Slack App settings) |
| **Config Keys** | Unknown (PROMPTS interactively) |
| **Activation** | Gateway must be running |
| **Verify Connected** | `zeptoclaw channel list` or `zeptoclaw channel test slack` |
| **Remove** | Manual config edit |

#### 4. WhatsApp Web

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Command** | `zeptoclaw channel setup whatsapp_web` |
| **Required User Inputs** | - QR code scan (interactive pairing) |
| **Config Keys** | Session data (auto-generated) |
| **Activation** | Gateway must be running |
| **Verify Connected** | `zeptoclaw channel list` or `zeptoclaw channel test whatsapp_web` |
| **Remove** | Manual config edit |

**Notes:** Uses WhatsApp Web protocol (personal account, QR pairing).

#### 5. WhatsApp Cloud

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Command** | `zeptoclaw channel setup whatsapp_cloud` |
| **Required User Inputs** | - Meta Business Account<br>- Phone number ID<br>- Access token<br>- Webhook verification token |
| **Config Keys** | Unknown (PROMPTS interactively) |
| **Activation** | Gateway must be running |
| **Verify Connected** | `zeptoclaw channel list` or `zeptoclaw channel test whatsapp_cloud` |
| **Remove** | Manual config edit |

**Notes:** Requires Meta WhatsApp Business API.

#### 6. Webhook

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Command** | `zeptoclaw channel setup webhook` |
| **Required User Inputs** | - Webhook URL<br>- Optional: Secret token for verification |
| **Config Keys** | Unknown (PROMPTS interactively) |
| **Activation** | Gateway must be running |
| **Verify Connected** | `zeptoclaw channel list` or `zeptoclaw channel test webhook` |
| **Remove** | Manual config edit |

### ZeptoClaw: Activation & Restart

**Gateway Start:**
```bash
zeptoclaw gateway
# OR with options
zeptoclaw gateway --tunnel cloudflare  # Expose via tunnel
zeptoclaw gateway --containerized docker  # Run in container
```

**Restart Required:** YES - After adding/removing channels, restart the gateway.

**Hot-Reload:** NOT SUPPORTED - Gateway must be restarted.

### ZeptoClaw: Remove/Disable Channel

**Method:** Manual config edit (no CLI command)

**Steps:**
1. Edit `~/.zeptoclaw/config.json`
2. Remove or disable the channel entry
3. Restart gateway: stop and re-run `zeptoclaw gateway`

---

## Hermes Channel Configuration

**CLI Location:** `~/.local/bin/hermes`  
**Config File:** `~/.hermes/config.yaml` + `~/.hermes/.env`  
**Gateway Command:** `hermes gateway run`

### Supported Channels (VERIFIED + ASSUMED)

Platform keys from config.yaml:
- telegram (VERIFIED)
- discord (VERIFIED)
- whatsapp (VERIFIED - personal via Baileys)
- whatsapp-cloud (VERIFIED - Business API)
- slack (VERIFIED)
- signal (ASSUMED - listed in platform_toolsets)
- homeassistant (ASSUMED)
- qqbot (ASSUMED - QQ Bot)
- teams (ASSUMED - Microsoft Teams)
- google_chat (ASSUMED - Google Chat)
- yuanbao (ASSUMED)

### Channel Setup: General Pattern

**Interactive Setup:**
```bash
hermes gateway setup
```

**Status Check:**
```bash
hermes gateway list
```

**Output:**
```
Gateways:
  ✗ default (current)        — not running
```

**Gateway Management:**
```bash
hermes gateway run           # Foreground
hermes gateway start         # Background (systemd/launchd)
hermes gateway stop          # Stop background service
hermes gateway restart       # Restart background service
hermes gateway status        # Show status
```

### Per-Channel Configuration

#### 1. Telegram

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Method** | Config file (`~/.hermes/config.yaml`) under `platforms.telegram` |
| **Required User Inputs** | - Bot token (env: `TELEGRAM_BOT_TOKEN`)<br>- Optional: Allowed chat IDs |
| **Config Keys** | `platforms.telegram.enabled: true`<br>`platforms.telegram.allowed_chats: [...]`<br>Token in `.env` file |
| **Activation** | Start gateway: `hermes gateway run` or `hermes gateway start` |
| **Verify Connected** | `hermes gateway status` or check logs |
| **Remove** | Edit config to disable, then `hermes gateway restart` |

**Config Example:**
```yaml
platforms:
  telegram:
    enabled: true
    reply_to_mode: "first"  # off | first | all
    allowed_chats: ["-1001234567890"]
```

**Env:**
```bash
TELEGRAM_BOT_TOKEN=your_token_here
```

#### 2. Discord

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Method** | Config file under `discord:` section |
| **Required User Inputs** | - Bot token (env: `DISCORD_BOT_TOKEN`)<br>- Optional: Free response channels, require_mention |
| **Config Keys** | `discord.require_mention: true`<br>`discord.auto_thread: true`<br>`discord.free_response_channels: ""`<br>Token in `.env` |
| **Activation** | Start gateway |
| **Verify Connected** | `hermes gateway status` |
| **Remove** | Edit config to disable, restart gateway |

**Config Example:**
```yaml
discord:
  require_mention: true
  auto_thread: true
  reactions: true
```

#### 3. Slack

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Method** | Slack-specific command + config file |
| **Required User Inputs** | - Bot token<br>- App token (for socket mode)<br>- Signing secret |
| **Config Keys** | `platforms.slack.enabled: true`<br>Tokens in `.env` |
| **Activation** | Start gateway |
| **Verify Connected** | `hermes gateway status` |
| **Remove** | Edit config, restart gateway |

**Helper Command:**
```bash
hermes slack manifest  # Generate Slack app manifest
```

**Env:**
```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
```

#### 4. WhatsApp (Personal)

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Method** | Interactive pairing command |
| **Required User Inputs** | - QR code scan (phone camera) |
| **Config Keys** | Session auto-saved to `~/.hermes/` |
| **Activation** | Start gateway |
| **Verify Connected** | `hermes gateway status` |
| **Remove** | Delete session files, restart gateway |

**Setup Command:**
```bash
hermes whatsapp
```

**Notes:** Uses Baileys bridge for personal WhatsApp accounts (no Business API needed).

#### 5. WhatsApp Cloud (Business)

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Method** | Interactive setup |
| **Required User Inputs** | - Meta Business Account<br>- Phone number ID<br>- Access token<br>- Webhook URL (public HTTPS) |
| **Config Keys** | Stored in config + env |
| **Activation** | Start gateway |
| **Verify Connected** | `hermes gateway status` |
| **Remove** | Edit config, restart |

**Setup Command:**
```bash
hermes whatsapp-cloud
```

**Notes:** Requires Meta WhatsApp Business Cloud API (distinct from personal `hermes whatsapp`).

#### 6. Signal

| Field | Value |
|-------|-------|
| **Supported** | YES (ASSUMED - listed in platform_toolsets) |
| **Configure Method** | Config file |
| **Required User Inputs** | - Phone number<br>- signal-cli installation |
| **Config Keys** | `platforms.signal.enabled: true`<br>Phone number config |
| **Activation** | Start gateway |
| **Verify Connected** | `hermes gateway status` |
| **Remove** | Edit config, restart |

**Notes:** Requires signal-cli to be installed and configured separately.

### Hermes: Activation & Restart

**Gateway Start:**
```bash
hermes gateway run              # Foreground (recommended for WSL/Docker/Termux)
# OR
hermes gateway install          # Install as systemd/launchd service
hermes gateway start            # Start background service
```

**Restart After Config Change:**
```bash
hermes gateway restart
```

**Hot-Reload:** UNKNOWN - Likely requires restart for channel changes.

### Hermes: Remove/Disable Channel

**Method:** Edit config file + restart gateway

**Steps:**
1. Edit `~/.hermes/config.yaml` and set `platforms.<channel>.enabled: false`
2. OR remove the platform section entirely
3. Restart gateway: `hermes gateway restart`

---

## OpenClaw Channel Configuration

**CLI Location:** Isolated Node 22 environment (see openclaw-config-spike.md)  
**Config File:** `~/.openclaw/openclaw.json`  
**Gateway Command:** `openclaw gateway`

### Supported Channels (VERIFIED - 30 total)

From `openclaw channels list --all` output (all VERIFIED as listed):

1. Telegram
2. WhatsApp
3. Discord
4. Slack
5. Signal
6. iMessage
7. IRC
8. Google Chat
9. Microsoft Teams
10. Mattermost
11. Nextcloud Talk
12. Matrix
13. Feishu
14. Nostr
15. Buzz
16. A2A
17. LINE
18. Weixin
19. WeCom
20. Zalo
21. Zalo ClawBot
22. Zalo Personal
23. ClickClack
24. Yuanbao
25. SMS
26. Synology Chat
27. Tlon
28. QQ Bot
29. Reef
30. Twitch

### Channel Setup: General Pattern

**Interactive Setup:**
```bash
openclaw channels add
# Opens guided setup for available channels
```

**Non-Interactive Setup:**
```bash
openclaw channels add --channel <name> [OPTIONS]
```

**List Channels:**
```bash
openclaw channels list         # Configured channels only
openclaw channels list --all   # All available (configured + installable)
```

**Verify Connection:**
```bash
openclaw channels status                    # All channels
openclaw channels status --channel telegram # Specific channel
openclaw channels status --probe            # Test credentials
```

**Remove Channel:**
```bash
openclaw channels remove --channel <name>
openclaw channels remove --channel <name> --delete  # Delete config (no prompt)
```

### Per-Channel Configuration

#### 1. Telegram

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Command** | `openclaw channels add --channel telegram --token <token>` |
| **Required User Inputs** | - Bot token (from @BotFather) |
| **Config Keys** | `gateway.channels.telegram.token` (written to config) |
| **Activation** | Gateway must be running (`openclaw gateway`) |
| **Verify Connected** | `openclaw channels status --channel telegram --probe` |
| **Remove** | `openclaw channels remove --channel telegram --delete` |

**Non-Interactive Setup:**
```bash
openclaw channels add --channel telegram --token <BOT_TOKEN>
# OR use env var
openclaw channels add --channel telegram --use-env  # Reads TELEGRAM_BOT_TOKEN
# OR use token file
openclaw channels add --channel telegram --token-file ~/.secrets/telegram-token
```

**Verify:**
```bash
openclaw channels status --channel telegram --probe
```

**Interactive Prompts:** NO (fully non-interactive with flags)

#### 2. Discord

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Command** | `openclaw channels add --channel discord --token <token>` |
| **Required User Inputs** | - Bot token (from Discord Developer Portal) |
| **Config Keys** | `gateway.channels.discord.token` |
| **Activation** | Gateway running |
| **Verify Connected** | `openclaw channels status --channel discord --probe` |
| **Remove** | `openclaw channels remove --channel discord --delete` |

**Non-Interactive Setup:**
```bash
openclaw channels add --channel discord --token <BOT_TOKEN>
# OR
openclaw channels add --channel discord --use-env  # Reads DISCORD_BOT_TOKEN
```

**Interactive Prompts:** NO

#### 3. Slack

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Command** | `openclaw channels add --channel slack --bot-token <token> --signing-secret <secret>` |
| **Required User Inputs** | - Bot token (`xoxb-...`)<br>- Signing secret<br>- Optional: App token (socket mode), user token |
| **Config Keys** | Multiple tokens in config |
| **Activation** | Gateway running |
| **Verify Connected** | `openclaw channels status --channel slack --probe` |
| **Remove** | `openclaw channels remove --channel slack --delete` |

**Non-Interactive Setup:**
```bash
openclaw channels add --channel slack \
  --bot-token xoxb-... \
  --signing-secret abc123... \
  --app-token xapp-...  # Optional for socket mode
# OR
openclaw channels add --channel slack --use-env  # Reads SLACK_BOT_TOKEN, etc.
```

**Mode:** `--mode <mode>` (connection mode, likely socket vs webhook)

**Interactive Prompts:** NO

#### 4. WhatsApp

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Method** | Login command (QR pairing) |
| **Required User Inputs** | - QR code scan (via phone camera) |
| **Config Keys** | Session stored in `--auth-dir` (default managed by OpenClaw) |
| **Activation** | Gateway running |
| **Verify Connected** | `openclaw channels status --channel whatsapp --probe` |
| **Remove** | `openclaw channels remove --channel whatsapp --delete` |

**Setup (QR Pairing):**
```bash
openclaw channels add --channel whatsapp
# Interactive QR code display
# OR
openclaw channels login --channel whatsapp
```

**Auth Directory Override:**
```bash
openclaw channels add --channel whatsapp --auth-dir /path/to/session
```

**Interactive Prompts:** YES (QR code pairing)

#### 5. Signal

| Field | Value |
|-------|-------|
| **Supported** | YES (VERIFIED) |
| **Configure Command** | `openclaw channels add --channel signal [OPTIONS]` |
| **Required User Inputs** | - Phone number (E.164 format)<br>- signal-cli executable path OR HTTP daemon URL |
| **Config Keys** | Signal transport config |
| **Activation** | Gateway running |
| **Verify Connected** | `openclaw channels status --channel signal --probe` |
| **Remove** | `openclaw channels remove --channel signal --delete` |

**Non-Interactive Setup (External Native):**
```bash
openclaw channels add --channel signal \
  --signal-number +1234567890 \
  --signal-transport external-native \
  --http-url http://localhost:8080
```

**Container Transport:**
```bash
openclaw channels add --channel signal \
  --signal-number +1234567890 \
  --signal-transport container
```

**CLI Path:**
```bash
openclaw channels add --channel signal \
  --signal-number +1234567890 \
  --cli-path /usr/local/bin/signal-cli
```

**Interactive Prompts:** NO (with full flags)

#### 6. iMessage

| Field | Value |
|-------|-------|
| **Supported** | YES (ASSUMED - listed, not tested) |
| **Configure Command** | `openclaw channels add --channel imessage` |
| **Required User Inputs** | - macOS system<br>- iMessage account<br>- Accessibility permissions |
| **Config Keys** | iMessage bridge config |
| **Activation** | Gateway running on macOS |
| **Verify Connected** | `openclaw channels status --channel imessage --probe` |
| **Remove** | `openclaw channels remove --channel imessage --delete` |

**Notes:** macOS only. Requires system accessibility permissions. Not tested (no macOS available).

#### 7-30. Other Channels (ASSUMED)

| Channel | Required Inputs (ASSUMED) |
|---------|---------------------------|
| **IRC** | Server, port, channel, nickname, optional password |
| **Google Chat** | Workspace service account credentials |
| **Microsoft Teams** | App registration, tenant ID, app ID, client secret |
| **Mattermost** | Server URL, personal access token |
| **Nextcloud Talk** | Server URL, username, password/app token |
| **Matrix** | Homeserver URL, access token, user ID |
| **Feishu** | App ID, app secret |
| **Nostr** | Relay URLs, private key |
| **Buzz** | Unknown (proprietary) |
| **A2A** | Unknown (proprietary) |
| **LINE** | Channel access token, channel secret |
| **Weixin** | App ID, app secret (WeChat) |
| **WeCom** | Corp ID, agent ID, secret (WeChat Work) |
| **Zalo** | App ID, secret key |
| **ClickClack** | Unknown (proprietary) |
| **Yuanbao** | Unknown (proprietary) |
| **SMS** | Carrier integration (Twilio, Vonage, etc.) |
| **Synology Chat** | Server URL, token |
| **Tlon** | Unknown (Urbit-based) |
| **QQ Bot** | App ID, token |
| **Reef** | Unknown (proprietary) |
| **Twitch** | OAuth token, channel name |

**Verification Method (All):** `openclaw channels status --channel <name> --probe`

**Removal Method (All):** `openclaw channels remove --channel <name> --delete`

### OpenClaw: Activation & Restart

**Gateway Start:**
```bash
openclaw gateway
# OR with options
openclaw gateway --port 18789 --bind loopback
openclaw gateway --auth token --token <YOUR_TOKEN>
openclaw gateway --tailscale serve  # Expose via Tailscale
```

**Gateway Status:**
```bash
openclaw gateway status  # Shows bind, port, probe status
```

**Restart Required:** UNKNOWN - Testing needed to confirm hot-reload behavior.

**Likely Pattern:** Gateway restart recommended after channel config changes.

### OpenClaw: Remove/Disable Channel

**Command:**
```bash
openclaw channels remove --channel <name>
# Interactive confirmation prompt
# OR
openclaw channels remove --channel <name> --delete
# No prompt, delete immediately
```

**Disable vs Delete:**
- `--delete` flag removes config entries entirely
- Without flag: may just disable (confirmation prompt shown)

**Verify Removal:**
```bash
openclaw channels list --all
```

---

## Summary: Required User Inputs per Framework

### TOP 3 CHANNELS: Telegram, Slack, Discord

#### Telegram

| Framework | Required User Inputs |
|-----------|---------------------|
| **ZeptoClaw** | Bot token |
| **Hermes** | Bot token (env var `TELEGRAM_BOT_TOKEN`) |
| **OpenClaw** | Bot token (CLI flag or env var) |

**Setup Complexity:** LOW - Single token from @BotFather

#### Slack

| Framework | Required User Inputs |
|-----------|---------------------|
| **ZeptoClaw** | Bot token, signing secret (PROMPTS interactively) |
| **Hermes** | Bot token, app token (socket mode), signing secret (env vars) |
| **OpenClaw** | Bot token (`xoxb-...`), signing secret, optional app token (CLI flags) |

**Setup Complexity:** MEDIUM - Multiple tokens from Slack App settings

#### Discord

| Framework | Required User Inputs |
|-----------|---------------------|
| **ZeptoClaw** | Bot token (PROMPTS interactively) |
| **Hermes** | Bot token (env var `DISCORD_BOT_TOKEN`) |
| **OpenClaw** | Bot token (CLI flag or env var) |

**Setup Complexity:** LOW - Single token from Discord Developer Portal

### WhatsApp

| Framework | Method | Required User Inputs |
|-----------|--------|---------------------|
| **ZeptoClaw (Web)** | QR pairing | Phone with WhatsApp app (scan QR) |
| **ZeptoClaw (Cloud)** | Business API | Meta Business Account, phone number ID, access token, webhook token |
| **Hermes (Personal)** | QR pairing | Phone with WhatsApp app (scan QR) |
| **Hermes (Cloud)** | Business API | Meta Business Account, phone number ID, access token, webhook URL |
| **OpenClaw** | QR pairing | Phone with WhatsApp app (scan QR) |

**Setup Complexity:**
- **Web/Personal:** MEDIUM (QR pairing, interactive)
- **Cloud/Business:** HIGH (Business account, webhook setup, multiple tokens)

### Signal

| Framework | Supported | Required User Inputs |
|-----------|-----------|---------------------|
| **ZeptoClaw** | NO | N/A |
| **Hermes** | YES (ASSUMED) | Phone number, signal-cli installation |
| **OpenClaw** | YES (VERIFIED) | Phone number (E.164), signal-cli path OR HTTP daemon URL, transport mode |

**Setup Complexity:** HIGH - External daemon (signal-cli) required

---

## Activation: Gateway Reload/Restart

| Framework | Reload Command | Restart Command | Hot-Reload? |
|-----------|----------------|-----------------|-------------|
| **ZeptoClaw** | N/A | Stop + restart `zeptoclaw gateway` | NO (ASSUMED) |
| **Hermes** | N/A | `hermes gateway restart` | NO (ASSUMED) |
| **OpenClaw** | Unknown | Stop + restart `openclaw gateway` | UNKNOWN |

**Recommendation:** All frameworks likely require gateway restart after channel config changes. Hot-reload not documented or verified for any framework.

---

## Verify Connection: Per Framework

### ZeptoClaw

**Command:**
```bash
zeptoclaw channel test <CHANNEL_NAME>
```

**Alternative:**
```bash
zeptoclaw channel list
```

**Connected Indicators:**
- `zeptoclaw channel list` shows status: `enabled` vs `disabled`
- `zeptoclaw channel test <name>` returns success/failure

### Hermes

**Command:**
```bash
hermes gateway status
```

**Output:**
```
Gateways:
  ✓ default (current)        — running (pid 12345)
```

**Check Logs:**
```bash
hermes gateway logs  # If available
# OR check systemd/launchd logs
```

**Connected Indicators:**
- Gateway status shows "running"
- No errors in logs
- Messages from channels appear in conversations

### OpenClaw

**Command:**
```bash
openclaw channels status
# All channels summary
```

**Specific Channel:**
```bash
openclaw channels status --channel telegram
```

**With Probe:**
```bash
openclaw channels status --channel telegram --probe
# Tests credentials and connectivity
```

**JSON Output:**
```bash
openclaw channels status --json
# Machine-readable status
```

**Connected Indicators:**
- Status shows "connected" or "online"
- Probe returns success
- No credential/auth errors

---

## Interactive Prompts Summary

| Framework | Interactive Setup? | Notes |
|-----------|-------------------|-------|
| **ZeptoClaw** | YES | All channels prompt for credentials when using `zeptoclaw channel setup <name>` |
| **Hermes** | YES | `hermes gateway setup` and channel-specific commands (e.g., `hermes whatsapp`) prompt interactively |
| **OpenClaw** | OPTIONAL | Interactive with `openclaw channels add` (no flags), non-interactive with full flags |

**AgentOne Wizard Recommendation:**
- Collect all required inputs in UI forms
- Call non-interactive commands with pre-collected values (OpenClaw model)
- For frameworks without non-interactive support, write config files directly

---

## Remove/Disable Channels: Summary

| Framework | Remove Command | Method |
|-----------|----------------|--------|
| **ZeptoClaw** | N/A | Manual config edit (`~/.zeptoclaw/config.json`) |
| **Hermes** | N/A | Edit config (`~/.hermes/config.yaml`), set `enabled: false` |
| **OpenClaw** | `openclaw channels remove --channel <name> --delete` | CLI command (non-interactive with `--delete`) |

**Post-Removal:**
- **ZeptoClaw:** Restart gateway
- **Hermes:** `hermes gateway restart`
- **OpenClaw:** Likely restart gateway (not verified)

---

## Guardrail Verification

**Host Node Version:**
```bash
$ node -v
v16.16.0
```

✅ **PASS** - Host node unchanged (OpenClaw invoked via isolated Node 22 in spike directory `/Users/nikhil/workspace/flashlearn/spikes/openclaw-test`)

---

## Sources

**VERIFIED (CLI help output inspected):**
- `zeptoclaw channel --help`
- `zeptoclaw channel setup --help`
- `zeptoclaw channel list` (live output)
- `zeptoclaw channel test --help`
- `hermes gateway --help`
- `hermes gateway setup --help`
- `hermes slack --help`
- `hermes whatsapp --help`
- `hermes whatsapp-cloud --help`
- `openclaw channels --help`
- `openclaw channels list --all` (live output)
- `openclaw channels add --channel telegram --help`
- `openclaw channels add --channel slack --help`
- `openclaw channels add --channel discord --help`
- `openclaw channels add --channel whatsapp --help`
- `openclaw channels add --channel signal --help`
- `openclaw channels status --help`
- `openclaw channels remove --help`

**ASSUMED (listed in docs/config but not interactively tested):**
- Hermes channels: signal, teams, google_chat (listed in `platform_toolsets`)
- OpenClaw channels: 24 additional channels beyond verified top 6 (iMessage, IRC, Matrix, etc.)

**Referenced docs:**
- `docs/research/verified/zeptoclaw.md`
- `docs/research/verified/hermes-agent.md`
- `docs/research/verified/openclaw-config-spike.md`
- `docs/research/verified/framework-setup-config.md`

---

**Verified By:** AgentOne Redesign Phase 2 Channel Research  
**Date:** 2026-09-02  
**Status:** COMPLETE

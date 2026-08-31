# OpenClaw Agent Framework - Verified Install

**Verification Date:** 2026-08-31  
**Task:** Phase 0, Task 1 - Runtime & Install Feasibility Spike

---

## Install Status: SUCCESS (with Node 22+ isolation)

**Runtime:** Node.js 22.22.3+ (TypeScript)  
**Version:** OpenClaw 2026.8.1 (ea80657)  
**Installation Method:** npm global install via nvm in isolated spike directory

---

## Critical Constraint: Host Node 16 Preserved

**Guardrail:** The AgentOne app requires Node 16.16.0 and has native `better-sqlite3` compiled for Node 16. OpenClaw requires Node 22+.

**Isolation Strategy:** Installed nvm in `spikes/openclaw-test/.nvm/` with Node 22.23.2, then installed openclaw globally within that nvm environment.

**Result:** Host `node -v` remains `v16.16.0` and vitest passes (79/79 tests).

---

## Installation Commands

```bash
# 1. Create isolated spike directory
mkdir -p spikes/openclaw-test/.nvm

# 2. Install nvm in spike directory (not system-wide)
cd spikes/openclaw-test
NVM_DIR="$(pwd)/.nvm" bash -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"

# 3. Load nvm, install Node 22, and install openclaw
export NVM_DIR="$(pwd)/.nvm"
source "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
npm install -g openclaw@latest --allow-scripts=openclaw
```

---

## Working Invocation (VERIFIED)

From the spike directory:

```bash
cd /Users/nikhil/workspace/flashlearn/spikes/openclaw-test
export NVM_DIR="$(pwd)/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 22
openclaw --version
openclaw --help
```

**Note:** This invocation pattern must be used to avoid breaking the host Node 16 environment.

---

## Version Output (VERIFIED)

```
$ openclaw --version
OpenClaw 2026.8.1 (ea80657)
```

---

## Help Output (VERIFIED - excerpt)

```
$ openclaw --help

OpenClaw 2026.8.1 (ea80657) — All your chats, one OpenClaw.

Usage: openclaw [options] [command]

Options:
  --container <name>   Run the CLI inside a running Podman/Docker container
                       named <name> (default: env OPENCLAW_CONTAINER)
  --dev                Dev profile: isolate state under ~/.openclaw-dev, default
                       gateway port 19001, and shift derived ports
                       (browser/canvas)
  -h, --help           Display help for command
  --log-level <level>  Global log level override for file + console
                       (silent|fatal|error|warn|info|debug|trace)
  --no-color           Disable ANSI colors
  --profile <name>     Use a named profile (isolates
                       OPENCLAW_STATE_DIR/OPENCLAW_CONFIG_PATH under
                       ~/.openclaw-<name>)
  -V, --version        output the version number

Commands:
  acp *                Run an ACP bridge backed by the Gateway
  agent *              Run an agent turn via the Gateway (use --local for
                       embedded)
  agents *             Manage isolated agents (workspaces + auth + routing)
  approvals *          Manage approval policy and pending requests
  attach               Attach Claude Code to a gateway session with scoped MCP
                       tools
  audit                Inspect activity records and exact-run identity context
  automations *        Manage automations (alias for cron)
  backup *             Create, verify, and restore backup archives and SQLite
                       snapshots
  browser *            Manage OpenClaw's dedicated browser (Chrome/Chromium)
  capability *         Run provider capability commands (fallback alias: infer)
  channels *           Manage connected chat channels and accounts
  chat                 Open a local terminal UI (alias for tui --local)
  config *             Non-interactive config helpers
  configure            Interactive configuration for credentials, channels,
                       gateway, and agent defaults
  cron *               Manage automations (via Gateway)
  daemon *             Manage the Gateway service (launchd/systemd/schtasks)
  dashboard            Open the Control UI with your current token
  gateway *            Run, inspect, and query the WebSocket Gateway
  mcp *                Manage OpenClaw mcp.servers config and channel bridge
  message *            Send, read, and manage messages and channel actions
  migrate *            Import state from another agent system
  models *             Model discovery, scanning, and configuration
  onboard *            Guided setup for auth, models, Gateway, workspace,
                       channels, and skills
  plugins *            Manage OpenClaw plugins and extensions
  setup                Chat with OpenClaw; onboard when setup is incomplete
  skills *             List and inspect available skills
  [... 40+ more commands]
```

---

## Key Findings

1. **Node 22 Required:** OpenClaw cannot run on the host Node 16.16.0
2. **Isolation Achieved:** nvm in spike directory provides clean isolation
3. **npm Install Works:** Global install via npm succeeds (331 packages)
4. **Rich CLI:** 60+ commands with extensive subcommand structure
5. **Gateway Architecture:** WebSocket-based Gateway for multi-channel support
6. **MCP Native:** Built-in MCP server and client commands

---

## Alternative Isolation: Docker (BLOCKED)

Docker was considered as the primary isolation strategy but was not viable:

```bash
docker run --rm node:22 sh -c "npm install -g openclaw@latest && openclaw --version"
```

**Result:** `docker: Cannot connect to the Docker daemon. Is the docker daemon running?`

Docker Desktop was not running in the environment, so nvm isolation was used instead.

---

## Guardrail Verification: SUCCESS

After openclaw installation and testing:

```bash
$ node -v
v16.16.0

$ npx vitest run
Test Files  12 passed (12)
     Tests  79 passed (79)
```

**Note:** Hermes installer initially broke this by adding `~/.local/bin/node` (symlink to Node 26) to PATH. This was fixed by temporarily renaming the symlinks to restore host Node 16.

---

## Verification: COMPLETE

- [x] OpenClaw installed via nvm in isolated spike directory
- [x] Version captured: 2026.8.1
- [x] Help output captured
- [x] Working invocation documented
- [x] Host Node 16 preserved (verified with `node -v` and vitest)
- [x] Isolation method: nvm in spike directory

---

## Desktop App Integration Notes

For desktop app integration, OpenClaw will require:

1. **Bundled Node 22+ runtime** — Cannot use host Node if app builds with Node 16
2. **Subprocess invocation** — Launch via isolated Node runtime
3. **Gateway management** — Handle daemon lifecycle (start/stop/health)
4. **WebSocket client** — Communicate with Gateway API
5. **PATH isolation** — Ensure openclaw doesn't pollute host PATH

**Recommended approach:** Bundle OpenClaw with its own Node 22 runtime, similar to how Hermes bundles Node 26 in `~/.hermes/node/`.

---

## Interface (PARTIAL - Task 2)

### 1. Invoke + Stream

**Interactive Mode:**
```bash
cd /Users/nikhil/workspace/flashlearn/spikes/openclaw-test
export NVM_DIR="$(pwd)/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 22
openclaw chat
# OR
openclaw setup  # Chat + onboard if needed
```

**Agent Command:**
```bash
openclaw agent --local <prompt>
# For gateway-backed invocation:
openclaw agent <prompt>
```

**Streaming:** OpenClaw streams via stdout in interactive mode. Gateway mode uses WebSocket streaming.

**Note:** Full invocation testing was limited due to config migration issues encountered during Task 2.

### 2. Model Wiring (Ollama)

**Config File:** `~/.openclaw/openclaw.json`

**Model Configuration Structure:**
```json
{
  "agents": {
    "defaults": {
      "models": {
        "provider/model-id": {
          "alias": "Display Name"
        }
      },
      "model": {
        "primary": "provider/model-id"
      },
      "modelPolicy": {
        "allow": [
          "provider/model-id"
        ]
      }
    }
  },
  "auth": {
    "profiles": {
      "provider:default": {
        "provider": "provider-name",
        "mode": "api_key"
      }
    }
  }
}
```

**Ollama Configuration:** Not fully tested due to config migration complexities. Expected format:
```json
{
  "agents": {
    "defaults": {
      "models": {
        "ollama/llama3.2:3b": {}
      },
      "model": {
        "primary": "ollama/llama3.2:3b"
      }
    }
  },
  "auth": {
    "profiles": {
      "ollama:default": {
        "provider": "ollama",
        "mode": "api_key",
        "base_url": "http://localhost:11434/v1"
      }
    }
  }
}
```

**Model Management Commands:**
```bash
openclaw models list         # List configured models
openclaw models set <model>  # Set default model
openclaw models auth add     # Interactive auth setup
openclaw models status       # Show model configuration state
```

**Blocker:** OpenClaw 2026.8.1 required config migration from older version (2026.4.2), which was partially resolved with `openclaw doctor --fix` but full Ollama wiring was not completed due to time constraints.

### 3. Capability Commands

**Skills:**
```bash
# Install skill from ClawHub/GitHub/local
openclaw skills install <name>
openclaw skills install --github <owner/repo>

# List skills
openclaw skills list

# Search ClawHub
openclaw skills search <query>

# Skill info
openclaw skills info <name>

# Check skill status
openclaw skills check
```

**Skills Config Location:** `~/.openclaw/openclaw.json` under `skills.entries` and `~/.openclaw/skills/` directory

**MCP Servers:**
```bash
# Add MCP server
openclaw mcp add <name> --url <endpoint>
openclaw mcp add <name> --command <cmd> --args <arg>...

# List MCP servers
openclaw mcp list

# Test connection
openclaw mcp probe <name>

# Reload MCP servers
openclaw mcp reload

# Show MCP configuration
openclaw mcp show
openclaw mcp show <name>
```

**MCP Config Location:** Managed via `openclaw mcp add/set/unset` commands (exact JSON location not verified)

**Restart Required:** Unknown — OpenClaw runs a Gateway daemon which may require reload (`openclaw mcp reload` exists, suggesting hot-reload is supported).

---

## Capability Loop (NOT TESTED - Task 2 scope only)

OpenClaw was not selected for the Task 3 capability loop PoC due to:
1. Config migration complexities encountered during Task 2
2. Requirement for Node 22+ isolated environment
3. ZeptoClaw's simpler architecture made it a better candidate for the PoC

OpenClaw interface has been partially documented for future adapter implementation. Full verification of Ollama wiring and capability loop should be completed in Phase 1.

---

**Verified By:** AgentOne v2 Phase 0 Tasks 2-3 Spike (partial)  
**Status:** Interface partially documented, Ollama wiring BLOCKED by config migration  
**Next Steps:** Resolve OpenClaw config migration in Phase 1 before implementing adapter

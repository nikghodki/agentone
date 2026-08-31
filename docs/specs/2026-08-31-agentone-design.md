# AgentOne — Product Design Spec

**Date:** 2026-08-31
**Status:** Approved for implementation
**Author:** Nikhil + Claude

---

## 1. Vision

**One-liner:** A desktop AI assistant that installs in one click, runs privately on your laptop, and tells YOU what it can do — so you never face a blank prompt.

**Problem:** 140-195 million Americans are "AI-curious but stuck." They've heard of ChatGPT but either never tried it (privacy fears, intimidation) or tried it and left (blank prompt problem, don't know what to ask). The technology works — the UX doesn't.

**Solution:** AgentOne bridges the gap with three innovations:
1. **Guided, not blank** — Persona-based onboarding + proactive task suggestions replace the empty chat box
2. **Private by default** — Local LLM via Ollama. Zero data leaves the device. No account required for free tier
3. **One-click install** — Download .dmg/.exe, install, and the AI is ready in under 2 minutes

**Target:** Everyone. Start broad — students, professionals, parents, creators, small business owners. Let the market signal who loves it most, then double down.

---

## 2. Market Context

### The Adoption Gap (Pew Research, Feb 2026)

| Stage | % U.S. Adults | ~People |
|-------|--------------|---------|
| Aware of AI chatbots | ~85% | ~220M |
| Have ever used one | 49% | ~128M |
| Use daily | 24% | ~63M |
| Pay for one | ~5% | ~13M |

**The drop from 85% aware → 24% daily is the opportunity.** That's ~160M Americans who know about AI but aren't using it.

### Competitive Landscape

| Product | Local? | Consumer UX? | Proactive? | Price |
|---------|--------|-------------|-----------|-------|
| Jan.ai (6.4M downloads) | Yes | No (dev UI) | No | Free |
| LM Studio | Yes | No (dev UI) | No | Free |
| GPT4All | Yes | No (dev UI) | No | Free |
| Apple Intelligence | Yes | Yes | Partial | Free (Apple only) |
| Microsoft Copilot | No | Yes | Partial | $30/mo |
| ChatGPT Desktop | No | Yes | No | $20/mo |
| **AgentOne** | **Yes** | **Yes** | **Yes** | **$3/mo** |

**No product combines: local LLM + consumer-friendly onboarding + proactive suggestions + $3/mo pricing.**

### Why Now

- Ollama has 9M+ developers, 180K GitHub stars. Local LLM infra is mature
- 7-8B models now match GPT-3.5 quality for consumer tasks
- Apple Silicon unified memory makes local inference fast on consumer hardware
- 71% of Americans worry AI will compromise their privacy — local is the answer
- ChatGPT paid growth has "flatlined" — the $20/mo model has a ceiling

---

## 3. User Experience

### 3.1 Install Flow

```
Website: agentone.ai
  → "Download for Mac" / "Download for Windows"
  → .dmg (Mac) / .exe installer (Windows)
  → Double-click install (standard OS flow)
  → App launches
  → Auto-detects hardware (RAM, GPU)
  → Downloads optimal model in background (shows progress bar)
  → "Ready! Let's set up your AI."
```

**Total time: ~2 minutes** (model download is the bottleneck, ~2-4GB depending on hardware).

**Model auto-selection:**

| Hardware | Model | Size | Speed |
|----------|-------|------|-------|
| 8GB RAM | Gemma 3 4B Q4_K_M | ~2.5GB | ~8-12 tok/s |
| 16GB RAM | Llama 3.2 8B Q4_K_M | ~4.5GB | ~20-30 tok/s (Metal) |
| 32GB+ RAM | Qwen 2.5 14B Q4_K_M | ~8GB | ~15-25 tok/s |

Users never see model names, quantization formats, or technical details. The app says: "Downloading your AI... (2.5 GB)"

**Minimum system requirements:**

| | Mac | Windows |
|---|---|---|
| OS | macOS 12 (Monterey)+ | Windows 10 (64-bit)+ |
| RAM | 8GB minimum (16GB recommended) | 8GB minimum (16GB recommended) |
| Disk | 6GB free (app + model) | 6GB free (app + model) |
| Processor | Apple Silicon M1+ or Intel (2018+) | Any 64-bit CPU. NVIDIA GPU optional for faster inference |

### 3.2 Onboarding (60 seconds)

**Screen 1: "Who are you?"**
Single-select with icons:
- Student
- Working Professional
- Parent / Family
- Creator / Artist
- Small Business Owner
- Freelancer
- Retired / Personal Use
- Other (free text)

**Screen 2: "What matters most to you?"** (multi-select, 2-3 picks)
Options vary by persona. For "Professional":
- Save time on emails
- Write better documents
- Prepare for meetings
- Analyze data & reports
- Brainstorm ideas
- Learn new skills
- Stay organized

**Screen 3: Dashboard — "Here's what I can help with"**
Immediately shows 8-10 relevant task cards based on selections. User clicks one to start.

No account creation. No email. No login. Just pick who you are and start using it.

### 3.3 Dashboard

The dashboard is the home screen. It replaces the blank chat prompt with a curated grid of task cards.

```
┌─────────────────────────────────────────────────────────┐
│  AgentOne                              [Settings] [Chat] │
│                                                          │
│  Good morning! Here are some things I can help with:     │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │ 📧 Draft an  │ │ 📄 Summarize │ │ 💡 Brainstorm│     │
│  │    email     │ │  a document  │ │    ideas     │     │
│  │              │ │              │ │              │     │
│  │ "Reply to a  │ │ "Upload a    │ │ "Need ideas  │     │
│  │  tricky msg" │ │  long PDF"   │ │  for X?"     │     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │ ✍️ Write &   │ │ 📊 Analyze a │ │ 🗓️ Plan my   │     │
│  │   edit text  │ │  spreadsheet │ │    week      │     │
│  │              │ │              │ │              │     │
│  │ "Polish your │ │ "Drop a CSV, │ │ "Organize    │     │
│  │  writing"    │ │  ask Qs"     │ │  your tasks" │     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
│                                                          │
│  ── Recently Used ──────────────────────────────────     │
│  Draft an email (2 hours ago)                            │
│  Summarize meeting notes (yesterday)                     │
│                                                          │
│  ── Discover More ──────────────────────────────────     │
│  "Did you know I can also help with..."                  │
│  [Translate text] [Explain a concept] [Write a list]     │
│                                                          │
│  ── Your Stats ─────────────────────────────────────     │
│  This week: 23 tasks completed | 2.5 hours saved         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3.4 Guided Task Flows

When a user clicks a task card, they DON'T get a blank chat. They get a structured input form:

**Example: "Draft an email"**
```
┌─────────────────────────────────────────────────────────┐
│  📧 Draft an Email                              [Back]   │
│                                                          │
│  What kind of email?                                     │
│  [Reply to someone] [Cold outreach] [Follow-up]          │
│  [Thank you note] [Apology] [Request]                    │
│                                                          │
│  Paste the email you're replying to (optional):          │
│  ┌──────────────────────────────────────────────┐       │
│  │                                              │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│  What tone?                                              │
│  [Professional] [Friendly] [Firm] [Casual]               │
│                                                          │
│  Key points to include:                                  │
│  ┌──────────────────────────────────────────────┐       │
│  │                                              │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│  [Generate Email ✨]                                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

After generation, the user sees the draft with options:
- **Copy to clipboard**
- **Regenerate** (different version)
- **Edit in chat** (switch to freeform refinement)
- **Make it shorter / longer / more formal / more casual** (one-click adjustments)

### 3.5 Free-form Chat

Always accessible via the [Chat] button. For users who outgrow guided flows or want freeform conversation. But even here, the chat has "starter suggestions" above the input:

```
Try asking me:
• "Rewrite this paragraph to sound more confident"
• "What are 5 ways to improve my morning routine?"
• "Explain quantum computing like I'm 10"
```

### 3.6 Discovery Engine

The "Discover More" section on the dashboard rotates suggestions the user hasn't tried yet:

- Surfaces new use cases weekly
- Tailored to persona + what they've used so far
- Examples: "You've been drafting emails a lot. Did you know I can also help you write LinkedIn posts?"
- Creates the "I didn't know it could do THAT" moment that drives word-of-mouth

---

## 4. Persona System

### 4.1 Architecture

Each persona is a JSON configuration that defines:
- System prompt prefix (persona context)
- Task catalog (ordered list of suggested tasks)
- Guided flow definitions (structured input schemas per task)
- Discovery queue (tasks to suggest over time)

```json
{
  "id": "professional",
  "name": "Working Professional",
  "icon": "briefcase",
  "system_prompt": "You are a helpful AI assistant for a working professional. Be concise, practical, and business-appropriate. Focus on saving time and improving quality of work output.",
  "tasks": [
    {
      "id": "draft_email",
      "title": "Draft an email",
      "subtitle": "Reply to a tricky message",
      "icon": "mail",
      "category": "communication",
      "guided_flow": {
        "fields": [
          {"type": "choice", "label": "What kind?", "options": ["Reply", "Cold outreach", "Follow-up", "Thank you", "Apology", "Request"]},
          {"type": "textarea", "label": "Paste the email you're replying to", "optional": true},
          {"type": "choice", "label": "Tone", "options": ["Professional", "Friendly", "Firm", "Casual"]},
          {"type": "textarea", "label": "Key points to include"}
        ],
        "prompt_template": "Write a {{tone}} {{kind}} email. {{#if reply_to}}The email I'm replying to: {{reply_to}}{{/if}} Key points: {{key_points}}"
      }
    }
  ],
  "discovery_queue": ["linkedin_post", "meeting_prep", "presentation_outline"]
}
```

### 4.2 MVP Personas & Task Counts

| Persona | MVP Tasks | Full Tasks (Post-MVP) |
|---------|-----------|----------------------|
| Student | 5 | 20 |
| Professional | 5 | 25 |
| Parent / Family | 4 | 15 |
| Small Business Owner | 4 | 20 |
| **Total MVP** | **18 guided flows** | 80+ |

### 4.3 MVP Task Catalog

**Student (5 tasks):**
1. Summarize my notes — Upload PDF/paste text → bullet summary
2. Explain this concept — Paste text → ELI5 explanation with analogy
3. Quiz me — Upload notes → 10 multiple-choice questions
4. Help me write this essay — Topic + thesis → outline + draft
5. Proofread my writing — Paste text → grammar + clarity + suggestions

**Professional (5 tasks):**
1. Draft an email — Structured flow (type, tone, context, key points)
2. Summarize a document — Upload PDF/paste → key takeaways
3. Brainstorm ideas — Enter topic + constraints → 10 ideas ranked
4. Prepare for a meeting — Enter agenda → talking points + questions to ask
5. Write a LinkedIn post — Enter topic → draft with hook + CTA

**Parent (4 tasks):**
1. Help with homework — Subject + question + grade level → step-by-step explanation
2. Explain to my kid — Concept + child's age → kid-friendly explanation
3. Plan an activity — Ages + location + weather → 5 activity suggestions
4. Write a note to teacher — Situation → polite, clear message

**Small Business Owner (4 tasks):**
1. Write product description — Product details → SEO-optimized copy for marketplace
2. Reply to a review — Paste review → professional, empathetic response
3. Create social media post — Topic + platform → ready-to-post content
4. Draft a professional message — Context + goal → polished business message

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Desktop app | Electron 33+ | Powers VS Code, Slack, Cursor. Mature auto-update, code signing, notarization |
| UI framework | React + TypeScript | Largest ecosystem. Pairs with Electron seamlessly |
| Styling | Tailwind CSS + shadcn/ui | Fast to build, polished UI components |
| LLM runtime | Ollama (bundled) | 9M+ users, 180K GitHub stars. Metal/CUDA/ROCm support |
| Local database | SQLite (via better-sqlite3) | All data stays on device. No cloud DB needed |
| State management | Zustand | Simple, fast, TypeScript-native |
| Billing | Stripe Checkout (web) | User manages subscription on web. App validates license key |
| Auto-updates | electron-updater | Signed updates, staged rollouts, delta updates |
| Installer | electron-builder | .dmg for Mac, NSIS .exe for Windows |
| Analytics | PostHog (anonymous, no PII). Only collects: task_id used, persona type, OS/hardware tier, session count. No conversation content, no user identifiers beyond a random device ID. Users can opt out in Settings | Understand what tasks people use without compromising privacy |

### 5.2 Process Architecture

```
┌─────────────────────────────────────────┐
│              Electron Main Process       │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Ollama Manager                     │  │
│  │ - Auto-download on first launch    │  │
│  │ - Start/stop Ollama server         │  │
│  │ - Health checks                    │  │
│  │ - Model download with progress     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Hardware Detector                  │  │
│  │ - RAM detection (os.totalmem())    │  │
│  │ - GPU detection (Apple/NVIDIA/AMD) │  │
│  │ - Selects optimal model            │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ License Manager                    │  │
│  │ - Validates Stripe license key     │  │
│  │ - Checks daily (with grace period) │  │
│  │ - Offline-tolerant (7-day grace)   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ SQLite Database                    │  │
│  │ - conversations, messages          │  │
│  │ - user_persona, task_usage         │  │
│  │ - settings, license_cache          │  │
│  └────────────────────────────────────┘  │
└──────────────────┬──────────────────────┘
                   │ IPC (contextBridge)
┌──────────────────┴──────────────────────┐
│            Electron Renderer Process     │
│                                          │
│  React App (TypeScript)                  │
│  ├── OnboardingFlow                      │
│  ├── Dashboard (task grid + discovery)   │
│  ├── GuidedTaskFlow (per-task UI)        │
│  ├── ChatView (freeform)                 │
│  ├── SettingsView                        │
│  └── StatsView (usage summary)           │
└──────────────────────────────────────────┘
```

### 5.3 Ollama Bundling Strategy

Ollama is NOT installed system-wide. It's bundled inside the app:

```
AgentOne.app/
├── Contents/
│   ├── Resources/
│   │   ├── ollama/              # Ollama binary (platform-specific)
│   │   ├── personas/            # Persona JSON configs
│   │   └── app.asar             # Electron app bundle
│   └── MacOS/
│       └── AgentOne             # Electron main
├── Models/                       # Downloaded models (outside app bundle)
│   └── llama-3.2-8b-q4_k_m/    # ~4.5GB
└── Data/
    └── agentone.db              # SQLite database
```

On first launch:
1. App extracts bundled Ollama binary
2. Detects hardware → selects model
3. Downloads model to `~/Library/Application Support/AgentOne/Models/` (Mac) or `%APPDATA%/AgentOne/Models/` (Windows)
4. Starts Ollama server on a random localhost port
5. Verifies model loads successfully
6. Shows dashboard

### 5.4 Data Model (SQLite)

```sql
-- User profile (single row, local only)
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY DEFAULT 1,
  persona TEXT NOT NULL,          -- 'student', 'professional', etc.
  priorities TEXT,                -- JSON array of selected priorities
  created_at TEXT DEFAULT (datetime('now')),
  license_key TEXT,               -- Stripe license key (nullable for free)
  license_valid_until TEXT        -- Cached expiry for offline grace
);

-- Conversations
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,            -- UUID
  title TEXT,                     -- Auto-generated title
  task_id TEXT,                   -- Links to guided task (null for freeform)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL,             -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Task usage tracking (for discovery engine + stats)
CREATE TABLE task_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,          -- e.g., 'draft_email'
  persona TEXT NOT NULL,
  started_at TEXT DEFAULT (datetime('now')),
  completed INTEGER DEFAULT 0,   -- Did user use the output?
  duration_seconds INTEGER        -- Time from start to completion
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 6. Monetization

### 6.1 Tiers

| | Free | Pro ($3/mo or $30/yr) |
|---|---|---|
| Task limit | 20 AI generations/day (each guided flow submit or chat message that triggers the LLM counts as 1) | Unlimited |
| All personas | Yes | Yes |
| All guided flows | Yes | Yes |
| Freeform chat | Yes | Yes |
| Conversation history | 30 days | Unlimited |
| Export conversations | No | Yes (Markdown, PDF) |
| Custom personas | No | Yes (create your own) |
| Usage stats & insights | Basic | Detailed weekly report |
| Model upgrades | Default only | Choose from 3-4 models |
| Account required | No | Yes (email for license) |

### 6.2 Why Free Tier Is Generous

20 tasks/day covers most casual users. The conversion trigger is:
- **Heavy users** who hit the daily limit (power users)
- **Export** — users who want to save/share their AI output
- **Custom personas** — users who've outgrown the defaults
- **Model choice** — users who want higher quality (13B vs 8B)

### 6.3 Revenue Projections

| Scenario | Free Users | Paid (5% conv) | MRR | ARR |
|----------|-----------|-----------------|-----|-----|
| Year 1 | 500K | 25K | $75K | $900K |
| Year 2 | 3M | 150K | $450K | $5.4M |
| Year 3 | 10M | 500K | $1.5M | $18M |

Conservative assumptions: 5% free-to-paid conversion (Duolingo achieves 6.8%). Jan.ai hit 6.4M downloads targeting only developers — a consumer version should exceed this.

### 6.4 Billing Implementation

- Stripe Checkout hosted on agentone.ai/pricing
- User purchases → receives license key via email
- Enters license key in app Settings
- App validates key against Stripe API (daily check)
- 7-day offline grace period (works without internet for a week)
- Annual billing preferred ($30/yr) to minimize Stripe fees

---

## 7. Viral Growth Strategy

### 7.1 Core Viral Loop

```
User installs AgentOne (free)
  → Uses it daily, tells friends "you need this"
  → Friends install (word-of-mouth)
  → Referral bonus: both get 1 month Pro free
  → Repeat
```

### 7.2 Built-In Viral Mechanics

| Mechanic | Implementation |
|----------|---------------|
| **Weekly stats card** | "This week: 47 tasks, 3.5 hrs saved." Shareable image for social media |
| **Referral system** | Invite link → friend installs → both get 30 days Pro. Your cost: $0 (local compute) |
| **"Powered by AgentOne"** | Small attribution on exported content (removable for Pro users) |
| **Task pack sharing** | Create custom task → export as .agentone file → friends import |
| **"What can AI do?" moment** | New users are amazed the agent proactively suggests things. This IS the viral moment |

### 7.3 Launch Plan

| Day | Channel | Action |
|-----|---------|--------|
| D-7 | Build in public | Start posting dev progress on Twitter/X |
| D-1 | Tease | "Tomorrow I'm launching something for the 51% of Americans who've never used AI" |
| D0 | Simultaneous | Product Hunt + Reddit (r/LocalLLaMA, r/ChatGPT, r/technology) + Hacker News |
| D0 | Video | YouTube demo: "I installed a free AI on my laptop in 60 seconds. Here's what happened." |
| D1-7 | TikTok | Short demos showing onboarding → first suggestion → "wow" reaction |
| D7-30 | Reddit AMA | "I built a free local AI assistant. AMA." in r/ChatGPT (5M members) |
| D30+ | Partnerships | Tech YouTubers, productivity bloggers, education influencers |

### 7.4 Positioning / Messaging

**Primary:** "AI that tells you what it can do. Private. Free. No login."

**For privacy-conscious:** "Your AI runs on your laptop. Nothing leaves your machine. Ever."

**For AI-intimidated:** "You don't need to know what to type. It shows you what it can help with."

**For budget-conscious:** "ChatGPT costs $20/month. AgentOne is free. And it's private."

**vs. ChatGPT:** "ChatGPT gives you a blank box. AgentOne gives you a menu."

---

## 8. Technical Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Model quality disappoints users | High | Medium | Set clear expectations ("private & fast, not GPT-4"). Focus on structured tasks where 8B models excel (drafting, summarizing, explaining) |
| 8GB RAM machines too slow | Medium | Medium | Default to 3-4B model on 8GB. Show "This works best on 16GB+ RAM" on download page. Consider optional cloud fallback add-on later |
| Ollama bundling breaks on OS updates | Medium | Low | Pin Ollama version. Test on every major OS release. Auto-update mechanism |
| Apple Intelligence solves this | High | Low (Apple is slow) | Multi-platform is the moat. Also: Apple doesn't do persona-based guidance or proactive suggestions |
| Electron app feels heavy | Low | Low | Users accept 200-500MB apps (VS Code, Slack, Discord). The multi-GB model is the real size |
| User has no internet for model download | Low | Medium | Offer USB/direct download option for model files. After initial setup, fully offline |
| Code signing / notarization costs | Low | Certain | Apple Developer: $99/yr. Windows: ~$200-400/yr for EV cert. Budget this |

---

## 9. Legal & Compliance

| Item | Status | Notes |
|------|--------|-------|
| LLC formation | Required before launch | $50-200, liability protection |
| Privacy Policy | Required | "All AI processing and conversations stay on your device. We collect only anonymous usage analytics (which tasks are popular, not what you type). You can opt out entirely in Settings." |
| Terms of Service | Required | Standard: acceptable use, AI disclaimer, limitation of liability |
| AI Disclosure | Required (EU AI Act) | "AgentOne uses AI models running on your device" |
| Age restriction | Recommended | 13+ in ToS to avoid COPPA |
| GDPR | Minimal concern | No user data collected = minimal GDPR exposure. Still need privacy policy for website visitors |
| Apple notarization | Required for Mac | $99/yr Apple Developer Program. Submit app for notarization to avoid Gatekeeper warnings |
| Windows code signing | Recommended | EV code signing cert to avoid SmartScreen warnings. ~$200-400/yr |

---

## 10. Success Metrics

### North Star: Daily Active Users (DAU)

| Metric | Month 1 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| Downloads | 10K | 200K | 1M |
| DAU | 2K | 50K | 200K |
| DAU/MAU ratio | 30%+ | 30%+ | 25%+ |
| Free-to-paid conversion | — | 3% | 5% |
| Paid subscribers | 0 | 6K | 50K |
| MRR | $0 | $18K | $150K |

### Key Metrics to Track

1. **Onboarding completion rate** — % of installs that complete persona selection (target: 80%+)
2. **First task completion** — % of onboarded users who complete their first guided task (target: 70%+)
3. **D7 retention** — % of users who return after 7 days (target: 40%+)
4. **Tasks per user per day** — Average daily task count (target: 3-5)
5. **Task diversity** — How many different task types users try (target: 3+ in first week)
6. **Referral rate** — % of users who invite at least one friend (target: 10%+)

---

## 11. Future Roadmap (Post-MVP)

### Phase 2 (Months 3-6): Depth
- Expand to 20+ tasks per persona (80+ total)
- Add "Creator" and "Freelancer" personas
- Plugin system — community-contributed task packs
- Multi-language support (Spanish, Hindi, Portuguese first)
- File analysis — drag & drop any file type (images, spreadsheets)

### Phase 3 (Months 6-12): Intelligence
- Learning mode — agent remembers your preferences and past tasks
- Smart suggestions — "You draft emails every Monday. Want me to prepare one?"
- Template library — save and reuse your best prompts
- Workflow chains — link tasks together ("Summarize this PDF, then draft an email about it")

### Phase 4 (Months 12-18): Platform
- Mobile companion app (read-only first: view conversations, quick tasks)
- Agent marketplace — third-party task packs (takes 30% commission)
- Team features — share personas and task packs within an organization
- Optional cloud model add-on — for users who want frontier model quality on complex tasks

### Phase 5 (Months 18-24): Mobile Agent
- Full mobile agent (iOS + Android)
- On-device inference using Apple MLX / Android NNAPI
- System integrations (notifications, calendar, email)
- Voice-first interface for hands-free use

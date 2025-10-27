# Core Concepts

Related: [[architecture]], [[design]], [[worktrees]], [[board-objects]]

## What Is Agor?

**Agor is a multiplayer canvas for orchestrating agentic coding sessions** - the spatial layer that connects Claude Code, Codex, Gemini, and any agentic coding tool into one unified workspace.

**Pronunciation:** "AY-gore"

**Tagline:**

> **Multiplayer canvas for orchestrating AI coding sessions.**
> The spatial layer that connects Claude Code, Codex, Gemini, and any agentic coding tool into one unified workspace.

## The Vision

A platform for **real-time, multiplayer agentic development**.
Visualize, coordinate, and collaborate on AI-assisted work across tools and teams.

Agor turns every AI session into a composable, introspectable, and reusable building block on a spatial canvas.

### The Core Insight

> **AI coding isn't linear - it's exploratory and parallel. Your workspace should reflect that.**

Traditional CLI tools force linear conversations. Agor embraces the reality:

- Multiple sessions running in parallel
- Forking to explore alternatives
- Spawning subsessions for focused work
- Spatial organization that matches how your brain thinks

### What Makes Agor Different

- **Worktree-Centric Architecture** - 1 worktree = 1 issue = 1 PR. Isolated git workspaces eliminate branch conflicts.
- **Multiplayer Spatial Canvas** - Real-time collaboration with cursor broadcasting and facepiles. Organize work spatially, not linearly.
- **Session Genealogy** - Fork and spawn sessions to create exploration trees. Full introspection and reusability.
- **Zone Triggers — Workflows Made Spatial** - Drag worktrees to zones, trigger templated prompts. Build Kanban-style flows or custom pipelines.
- **Multi-Agent Orchestration** - Integrates with Claude Code, Codex, Gemini via extensible SDK. Centralized MCP configuration.
- **Environment Management** - Run multiple dev servers in parallel, one per worktree. Automatic port management and health monitoring.
- **Social by Default** - Everyone sees each other's boards. Spatial comments, live cursors, threaded conversations.

## The Core Primitives

Everything in Agor is built from five fundamental primitives:

### 1. Worktree - The Unit of Work

**A worktree is an isolated git working directory** - think of it as a checkout of your repo at a specific branch or commit.

```
Worktree "auth-feature" (issue #123, PR #456)
├─ Working directory: ~/.agor/worktrees/myapp/auth-feature
├─ Branch: feature/oauth2-auth
├─ Environment: Running on port 9001
└─ Sessions: Tree of AI conversations working on this feature
```

**Best practice:** 1 worktree = 1 issue = 1 PR = 1 feature

**Why this matters:**

- Parallel sessions don't interfere (isolated filesystems)
- Clean separation of experimental work
- Multiple features can run simultaneously with their own dev servers
- Easy cleanup (delete worktree = delete experiment)

**Data Model:**

```typescript
Worktree: worktree_id: string;
repo_id: string;
name: string; // "auth-feature"
path: string; // "~/.agor/worktrees/myapp/auth-feature"
branch: string; // "feature/oauth2-auth"
issue_url: string | null; // "https://github.com/org/repo/issues/123"
pull_request_url: string | null;
notes: string | null;
unique_id: number; // For port assignment (worktree #1, #2, etc.)
```

### 2. Board - The Spatial Canvas

**Boards are 2D canvases for organizing worktrees** - like Figma for AI coding work.

Instead of linear lists, boards use **spatial layout** where:

- Each worktree appears as a card on the canvas
- You can drag worktrees to arrange them spatially
- Sessions within a worktree appear as a genealogy tree on the card
- Multiple users see the same board in real-time (cursors, movements, updates)

**Why spatial?**

Your brain thinks spatially. You remember:

- "The auth worktree is in the top-left corner"
- "Testing sessions are clustered on the right"
- "That failed experiment is way down there"

This is **location-based memory** - the same reason you remember where you parked. A 2D board gives every worktree a "place."

**Data Model:**

```typescript
Board: board_id: string;
name: string;
description: string | null;
created_by_user_id: string;

BoardObject: board_id: string;
object_type: 'worktree' | 'session' | 'zone';
object_id: string;
position_x: number;
position_y: number;
zone_id: string | null; // If positioned in a zone
```

### 3. Session - Conversations with Genealogy

**Sessions are AI conversations that can fork and spawn, creating exploration trees.**

```
Session: "Build authentication system"
├─ Fork: "Try OAuth2 instead of JWT"
├─ Fork: "Add social login support"
└─ Spawn: "Research PKCE flow best practices"
   └─ Spawn: "Implement Google OAuth provider"
```

**Two Relationship Types:**

**Fork** - Create a sibling session with a **copy of conversation context**

- Perfect for parallel exploration ("try this approach instead")
- Starts with same context as parent at fork point
- Divergent paths from shared knowledge

**Spawn** - Create a child session with a **fresh context window**

- Perfect for focused subsessions ("implement just this piece")
- Parent agent packages only relevant context
- Clean slate for specialized work

**Data Model:**

```typescript
Session: session_id: string;
worktree_id: string; // Required: every session belongs to a worktree
agent: string; // "claude-code", "codex", "gemini"
status: 'running' | 'idle' | 'completed' | 'failed';
title: string;
description: string | null;

// Genealogy
parent_session_id: string | null; // Spawn relationship
forked_from_session_id: string | null; // Fork relationship
fork_point_message_id: string | null; // Where fork diverged
```

**Key insight:** Both fork and spawn work on the **same worktree** (same filesystem), but create **independent conversations** going forward. You're not exploring alternative implementations - you're doing parallel work that starts from shared knowledge.

### 4. Zone - Spatial Workflow Triggers

**Zones are spatial regions on boards that trigger templated prompts when you drop a worktree into them.**

Think: drag worktree to "Ready for Review" → auto-prompts for code review. Drag to "Needs Tests" → auto-prompts for test generation.

**How zones work:**

1. **Define zone** - Create rectangular region on board with name, color, and prompt template
2. **Drop worktree** - Drag worktree card into zone
3. **Select session** - Choose which session gets the prompt (new session, most recent, or pick manually)
4. **Template renders** - Zone prompt injects context from worktree/session/repo
5. **Agent executes** - Session runs the templated prompt

**Handlebars Templates:**

Zone prompts use Handlebars to inject dynamic context:

```handlebars
Review the implementation of
{{worktree.issue_url}}. Check if: 1. All acceptance criteria from the issue are met 2. Edge cases
are handled 3. Error messages are user-friendly If approved, comment on
{{worktree.pull_request_url}}
with summary.
```

**Available template variables:**

- `{{ worktree.name }}`, `{{ worktree.issue_url }}`, `{{ worktree.pull_request_url }}`
- `{{ board.name }}`, `{{ board.description }}`
- `{{ session.title }}`, `{{ session.description }}`
- `{{ environment.url }}`, `{{ environment.status }}`
- `{{ repo.name }}`, `{{ repo.default_branch }}`

**Zones = Kanban-style workflow automation for AI sessions.** Drag to trigger. Context flows automatically.

**Data Model:**

```typescript
Zone: zone_id: string;
board_id: string;
name: string;
color: string;
position_x: number;
position_y: number;
width: number;
height: number;
prompt_template: string; // Handlebars template
on_enter_action: 'new_session' | 'pick_session' | 'most_recent';
```

### 5. Environment - Runtime Instances

**Environments are runtime instances (dev servers, Docker containers, etc.) for your worktrees.**

Each repo has an **environment configuration template**:

- Start/stop commands
- Health check endpoint
- App URL template

Each worktree gets its **own environment instance**:

- Unique ports (auto-assigned using `worktree.unique_id`)
- Process status (running, stopped, error)
- Access URLs (resolved from templates)
- Live logs

**Example configuration:**

```yaml
up_command: 'UI_PORT={{add 9000 worktree.unique_id}} pnpm dev'
down_command: "pkill -f 'vite.*{{add 9000 worktree.unique_id}}'"
health_endpoint: 'http://localhost:{{add 9000 worktree.unique_id}}/health'
app_url_template: 'http://localhost:{{add 9000 worktree.unique_id}}'
```

**Result:**

- Worktree #1 runs on port 9001
- Worktree #2 runs on port 9002
- Worktree #3 runs on port 9003

**What this enables:**

- Run multiple feature branches in parallel with their own dev servers
- Test different implementations simultaneously
- No port conflicts or "stop this before starting that"
- One-click start/stop/access from UI

**Data Model:**

```typescript
EnvironmentConfig: repo_id: string;
up_command: string;
down_command: string;
health_endpoint_template: string | null;
app_url_template: string | null;

Environment: environment_id: string;
worktree_id: string;
status: 'running' | 'stopped' | 'error';
pid: number | null;
app_url: string | null; // Resolved from template
health_url: string | null; // Resolved from template
last_health_check: timestamp | null;
```

## Social Features

**Agor is great solo, but social features unlock Figma-like collaboration for software engineering.**

### Live Cursors

See where teammates are working in real-time:

- Current position on canvas
- Name and avatar
- What they're hovering over or dragging
- 100ms update intervals

**Why this matters:** Location awareness prevents conflicts and enables spontaneous collaboration.

### Facepile

Know who's online at a glance:

- All active users on current board
- Avatar and name
- Real-time presence status

### Spatial Comments

Annotate worktrees, sessions, and boards with threaded conversations:

- Leave comments on specific worktrees or sessions
- Thread replies for focused discussions
- Mention teammates with `@username`
- Persistent conversation layer on top of AI work

**The insight:** AI conversations are ephemeral - Claude says something, you respond, it's buried in chat. Comments are **spatial and persistent** - pin them to the exact artifact where they matter.

## Key Design Principles

1. **Worktrees Are Primary** - Everything starts with isolated git workspaces
2. **Spatial Over Linear** - 2D canvas matches how brains organize work
3. **Sessions Are Composable** - Fork and spawn to create exploration trees
4. **Zones Automate Workflows** - Drag-and-drop triggers, not manual copy-paste
5. **Social by Default** - Everyone sees each other's boards, multiplayer is core
6. **Multi-Agent** - Work with Claude, Codex, Gemini from one workspace

## Product Philosophy & Roadmap

**Current Phase: Core Platform Complete** ✅

- ✅ Real-time collaboration (cursor broadcasting, facepiles, presence)
- ✅ Spatial canvas with zones and worktree pinning
- ✅ Multi-agent support (Claude Code, Codex SDKs, Gemini in progress)
- ✅ User authentication and board management
- ✅ Social multiplayer – everyone can see each other's boards
- ✅ **Session forking & subsession spawning** – interactive genealogy visualization, parent→child relationships
- ✅ **MCP integration** – settings UI, session-level selection, Claude SDK hookup
- ✅ **Zone triggers** – drop worktrees on zones to launch templated workflows
- ✅ **Git worktree management** – visual labels, isolated workspaces per session
- ✅ **Environment management** – start/stop dev servers, unique ports per worktree
- ✅ **Single-package distribution** – `npm install -g agor-live`

**Near-Term Roadmap:**

- 🔄 **Gemini SDK Integration** – complete the agent trio (in progress)
- 🧾 **Reports** – automated summaries after each task
- 📚 **Concept Management** – structured context system UI

**Future Vision:**

- 🤖 **Cross-Agent Orchestration** – hybrid Claude–Codex–Gemini workflows
- 📊 **Knowledge Maps** – visualize all AI interactions across projects
- 🎯 **Advanced Zone Triggers** – conditional workflows, multi-step pipelines

---

For deeper dives, see:

- [[worktrees]] - Worktree-centric architecture deep dive
- [[board-objects]] - Board layout system, zones, triggers
- [[architecture]] - System design and storage structure
- [[design]] - UI/UX principles and component patterns

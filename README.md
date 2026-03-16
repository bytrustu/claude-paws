# claude-paws

Cute session dashboard for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Monitor all your running sessions at a glance with pixel mascot characters.

## Features

- **Real-time session monitoring** - See all Claude Code sessions across projects
- **12 pixel mascot characters** - Cat, Dog, Rabbit, Bear, Penguin, Tiger, Lion, Alpaca, Fox, Hamster, Owl, Panda
- **Walking pets** - Characters roam around your dashboard with speech bubbles
- **Dark mode** - Toggle with `D` key or button
- **Drag & resize cards** - Customize your layout (persisted in localStorage)
- **Team agent visualization** - See agent team structure in modal when teams are active
- **Session detail modal** - Click a card to see transcript timeline
- **macOS notifications** - Get notified when sessions complete
- **Keyboard shortcuts** - `D` dark mode, `E` edit mode, `1-5` columns, `Esc` close modal
- **Character picker** - Choose your representative mascot

## Install

```bash
npm install -g claude-paws
```

Requires Node.js 18+.

## Usage

```bash
# Start the dashboard
claude-paws

# Install hooks (auto-runs on npm install)
claude-paws setup

# Check installation status
claude-paws status

# Custom port
claude-paws --port 3300

# Don't open browser automatically
claude-paws --no-open
```

Open http://localhost:3200 in your browser.

## How it works

claude-paws installs lightweight hooks into Claude Code's `~/.claude/settings.json` that track session events:

- `SessionStart` / `SessionEnd` - session lifecycle
- `UserPromptSubmit` - user sends a message (session is "working")
- `Stop` - Claude finishes responding (session is "waiting")
- `Notification` - Claude needs attention
- `SubagentStart` / `SubagentStop` - agent delegation tracking

Session data is written to `~/.claude/dashboard/active/` as JSON files. The dashboard server reads these files and serves a web UI.

**No data leaves your machine.** Everything runs locally on `localhost`.

## Uninstall

```bash
npm uninstall -g claude-paws
```

To remove hooks manually:

```bash
# Remove hook script
rm ~/.claude/hooks/session-tracker.sh

# Remove dashboard data
rm -rf ~/.claude/dashboard/
```

Hooks in `~/.claude/settings.json` referencing `session-tracker.sh` can be safely removed.

## Screenshots

### Light mode
Dashboard showing active sessions with pixel mascots, status badges, and walking pet characters.

### Dark mode
Full dark theme support with adjusted colors for comfortable night coding.

### Team visualization
When running agent teams, the modal shows team structure with member roles and task progress.

### Character picker
Choose your representative mascot from 12 pixel characters.

## Configuration

Dashboard state is stored in browser localStorage:
- `claude-dash-layout` - card order, sizes, column count
- `claude-dash-theme` - light/dark preference
- `claude-paws-global` - representative mascot selection
- `claude-paws-mascots` - per-session mascot overrides

## Tech Stack

- **Server**: Node.js (zero dependencies)
- **Frontend**: Vanilla HTML/CSS/JS (embedded in server)
- **Hooks**: Bash + jq
- **Font**: [Pretendard](https://github.com/orioncactus/pretendard)

## License

MIT

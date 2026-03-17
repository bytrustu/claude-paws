#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_DIR = join(homedir(), ".claude");
const HOOKS_DIR = join(CLAUDE_DIR, "hooks");
const SETTINGS_FILE = join(CLAUDE_DIR, "settings.json");
const DASHBOARD_DIR = join(CLAUDE_DIR, "dashboard");
const ACTIVE_DIR = join(DASHBOARD_DIR, "active");
const HOOK_SOURCE = join(__dirname, "..", "lib", "hooks", "session-tracker.sh");
const HOOK_DEST = join(HOOKS_DIR, "session-tracker.sh");

const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "Stop",
  "Notification",
  "SessionEnd",
  "SubagentStart",
  "SubagentStop",
];

const log = (msg) => console.log(`  \u{1F43E} ${msg}`);
const warn = (msg) => console.log(`  !! ${msg}`);
const ok = (msg) => console.log(`  ok ${msg}`);

export function checkStatus() {
  console.log("");
  log("claude-paws status");
  console.log("");

  if (!existsSync(CLAUDE_DIR)) {
    warn("~/.claude/ not found - is Claude Code installed?");
    return false;
  }
  ok("Claude Code directory found");

  if (existsSync(HOOK_DEST)) {
    ok("session-tracker.sh installed");
  } else {
    warn("session-tracker.sh not installed (run: claude-paws setup)");
  }

  if (existsSync(SETTINGS_FILE)) {
    try {
      const settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
      const hooks = settings.hooks || {};
      const missing = HOOK_EVENTS.filter((e) => !hooks[e]);
      if (missing.length === 0) {
        ok(`All ${HOOK_EVENTS.length} hook events registered`);
      } else {
        warn(`${missing.length} hook events missing: ${missing.join(", ")}`);
      }
    } catch {
      warn("Could not parse settings.json");
    }
  }

  if (existsSync(ACTIVE_DIR)) {
    ok("Dashboard data directory exists");
  } else {
    warn("Dashboard data directory missing");
  }

  console.log("");
  return true;
}

export default function setup() {
  console.log("");
  log("Setting up claude-paws...");
  console.log("");

  if (!existsSync(CLAUDE_DIR)) {
    warn("~/.claude/ not found.");
    console.log("");
    console.log("  Claude Code must be installed first:");
    console.log("  https://docs.anthropic.com/en/docs/claude-code");
    console.log("");
    return;
  }

  for (const dir of [HOOKS_DIR, DASHBOARD_DIR, ACTIVE_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      log(`Created ${dir.replace(homedir(), "~")}`);
    }
  }

  try {
    copyFileSync(HOOK_SOURCE, HOOK_DEST);
    try { chmodSync(HOOK_DEST, 0o755); } catch {}
    ok("session-tracker.sh installed");
  } catch (e) {
    warn(`Could not copy hook script: ${e.message}`);
  }

  let settings = {};
  if (existsSync(SETTINGS_FILE)) {
    try {
      settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
    } catch {
      warn("Could not parse existing settings.json, creating backup");
    }
  }

  if (!settings.hooks) settings.hooks = {};

  const hookEntry = [{
    matcher: "",
    hooks: [{ type: "command", command: "~/.claude/hooks/session-tracker.sh" }],
  }];

  let added = 0;
  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = hookEntry;
      added++;
    } else {
      const hasOurs = settings.hooks[event].some((h) =>
        h.hooks?.some((hh) => hh.command?.includes("session-tracker.sh"))
      );
      if (!hasOurs) {
        settings.hooks[event].push(hookEntry[0]);
        added++;
      }
    }
  }

  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  ok(`${added} hook events registered (${HOOK_EVENTS.length - added} already existed)`);

  console.log("");
  log("Setup complete!");
  console.log("");
  console.log("  Start:   claude-paws");
  console.log("  Status:  claude-paws status");
  console.log("");
}

// Run only when executed directly (not imported)
const isMain = process.argv[1]?.endsWith("postinstall.mjs");
if (isMain) {
  if (process.platform === "win32") {
    console.log("");
    console.log("  \u{1F43E} claude-paws is currently supported on macOS and Linux only.");
    console.log("  Windows support is not available yet.");
    console.log("");
  } else {
    setup();
  }
}

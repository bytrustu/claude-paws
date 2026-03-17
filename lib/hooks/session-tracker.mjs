#!/usr/bin/env node
// Claude Code Session Tracker (Cross-platform Node.js)
// Handles: SessionStart, UserPromptSubmit, Stop, Notification, SessionEnd,
//          SubagentStart, SubagentStop

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync, appendFileSync, readdirSync, rmSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { homedir, platform } from "node:os";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

const HOME = homedir();
const ACTIVE_DIR = join(HOME, ".claude", "dashboard", "active");
const LOG_FILE = join(HOME, ".claude", "dashboard", "activity.jsonl");
const SETTINGS_FILE = join(HOME, ".claude", "dashboard", "settings.json");
const TEAMS_DIR = join(HOME, ".claude", "teams");

// --- Read stdin ---
let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const EVENT = input.hook_event_name || "unknown";
const SESSION = input.session_id || "unknown";
const CWD = input.cwd || "unknown";
const TRANSCRIPT = input.transcript_path || "";
const PROJECT = basename(CWD);
const NOW = new Date().toISOString().replace("T", " ").slice(0, 19);

// Extract session name from transcript
let SESSION_NAME = "";
try {
  if (TRANSCRIPT && existsSync(TRANSCRIPT)) {
    const tail = readFileSync(TRANSCRIPT, "utf8").slice(-102400);
    const lines = tail.split("\n").filter(l => l.includes('"type":"agent-name"'));
    if (lines.length > 0) {
      const last = JSON.parse(lines[lines.length - 1]);
      SESSION_NAME = last.agentName || "";
    }
  }
} catch {}

const SESSION_FILE = join(ACTIVE_DIR, `${SESSION}.json`);
mkdirSync(ACTIVE_DIR, { recursive: true });

// --- Atomic write ---
function atomicWrite(target, content) {
  const tmp = target + "." + randomBytes(6).toString("hex") + ".tmp";
  try {
    writeFileSync(tmp, content + "\n", "utf8");
    renameSync(tmp, target);
  } catch {
    try { unlinkSync(tmp); } catch {}
  }
}

// --- Team info collector ---
function collectTeamInfo() {
  const teams = [];
  try {
    if (!existsSync(TEAMS_DIR)) return teams;
    for (const dir of readdirSync(TEAMS_DIR)) {
      const config = join(TEAMS_DIR, dir, "config.json");
      if (!existsSync(config)) continue;
      try {
        const data = JSON.parse(readFileSync(config, "utf8"));
        teams.push({
          name: data.name,
          description: data.description,
          members: (data.members || []).map(m => ({ name: m.name, role: m.agentType, model: m.model })),
        });
      } catch {}
    }
  } catch {}
  return teams;
}

// --- Session state ---
function writeNew(status, message, lastResponse) {
  const content = JSON.stringify({
    session: SESSION, project: PROJECT, cwd: CWD, status, message,
    lastResponse, sessionName: SESSION_NAME, transcript: TRANSCRIPT,
    updated: NOW, subagents: [], teams: collectTeamInfo(),
  });
  atomicWrite(SESSION_FILE, content);
}

function updateStatus(status, message) {
  if (existsSync(SESSION_FILE)) {
    try {
      const data = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
      data.status = status;
      data.message = message;
      data.updated = NOW;
      if (SESSION_NAME) data.sessionName = SESSION_NAME;
      atomicWrite(SESSION_FILE, JSON.stringify(data));
    } catch {
      writeNew(status, message, "");
    }
  } else {
    writeNew(status, message, "");
  }
}

// --- Activity log ---
function logActivity(event, message) {
  const entry = JSON.stringify({ ts: NOW, event, session: SESSION, project: PROJECT, message });
  try {
    appendFileSync(LOG_FILE, entry + "\n");
    // Trim if over 500 lines
    const content = readFileSync(LOG_FILE, "utf8");
    const lines = content.split("\n").filter(Boolean);
    if (lines.length > 500) {
      atomicWrite(LOG_FILE, lines.slice(-200).join("\n"));
    }
  } catch {}
}

// --- Cross-platform notifications ---
function notify(title, message) {
  // Check settings
  try {
    if (existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
      if (settings.macosNotifications === false) return;
    }
  } catch {}

  const plat = platform();
  try {
    if (plat === "darwin") {
      const safeTitle = title.replace(/["\\]/g, "");
      const safeMsg = message.replace(/["\\]/g, "");
      spawn("osascript", ["-e", `display notification "${safeMsg}" with title "${safeTitle}" sound name "Glass"`], { detached: true, stdio: "ignore" }).unref();
    } else if (plat === "win32") {
      const safeTitle = title.replace(/'/g, "''");
      const safeMsg = message.replace(/'/g, "''");
      const ps = `Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(5000, '${safeTitle}', '${safeMsg}', 'Info'); Start-Sleep -Milliseconds 6000; $n.Dispose();`;
      spawn("powershell", ["-NoProfile", "-Command", ps], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    } else {
      spawn("notify-send", [title, message], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {}
}

// --- Subagent handlers ---
function handleSubagentStart() {
  const agentName = input.agent_name || "unknown";
  const agentId = input.agent_id || "unknown";
  const agentModel = input.agent_model || "";

  if (existsSync(SESSION_FILE)) {
    try {
      const data = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
      if (!data.subagents) data.subagents = [];
      data.subagents.push({ name: agentName, id: agentId, model: agentModel, status: "running", startedAt: NOW });
      data.updated = NOW;
      atomicWrite(SESSION_FILE, JSON.stringify(data));
    } catch {}
  } else {
    writeNew("working", `Subagent started: ${agentName}`, "");
  }
  logActivity("subagent_start", `Agent ${agentName} started`);
}

function handleSubagentStop() {
  const agentName = input.agent_name || "unknown";
  const agentId = input.agent_id || "unknown";

  if (existsSync(SESSION_FILE)) {
    try {
      const data = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
      if (data.subagents) {
        data.subagents = data.subagents.map(s => s.id === agentId ? { ...s, status: "stopped", stoppedAt: NOW } : s);
      }
      data.updated = NOW;
      atomicWrite(SESSION_FILE, JSON.stringify(data));
    } catch {}
  }
  logActivity("subagent_stop", `Agent ${agentName} stopped`);
}

// --- TTY capture (Unix only) ---
function captureTTY() {
  if (platform() === "win32") return null;
  try {
    const tty = execFileSync("ps", ["-o", "tty=", "-p", String(process.ppid)], { encoding: "utf8", timeout: 2000 }).trim();
    if (tty && tty !== "??") return "/dev/" + tty;
  } catch {}
  return null;
}

// --- Main event dispatch ---
switch (EVENT) {
  case "SessionStart": {
    writeNew("started", "Session started", "");
    const tty = captureTTY();
    if (tty && existsSync(SESSION_FILE)) {
      try {
        const data = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
        data.tty = tty;
        atomicWrite(SESSION_FILE, JSON.stringify(data));
      } catch {}
    }
    logActivity("start", "Session started");
    break;
  }
  case "UserPromptSubmit":
    updateStatus("working", "Processing...");
    break;
  case "Stop": {
    const msg = (input.last_assistant_message || "").replace(/\n/g, " ").slice(0, 200);
    const stopActive = input.stop_hook_active || false;
    if (existsSync(SESSION_FILE)) {
      try {
        const data = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
        data.status = "waiting";
        data.message = msg;
        data.lastResponse = msg;
        data.updated = NOW;
        if (SESSION_NAME) data.sessionName = SESSION_NAME;
        atomicWrite(SESSION_FILE, JSON.stringify(data));
      } catch {
        writeNew("waiting", msg, msg);
      }
    } else {
      writeNew("waiting", msg, msg);
    }
    logActivity("stop", msg);
    if (!stopActive) {
      notify(`Claude [${PROJECT}]`, "\uC791\uC5C5 \uC644\uB8CC - \uC785\uB825 \uB300\uAE30");
    }
    break;
  }
  case "Notification": {
    const msg = input.message || "";
    const type = input.notification_type || "";
    updateStatus(`notification:${type}`, msg);
    logActivity(`notify:${type}`, msg);
    notify(`Claude [${PROJECT}]`, msg);
    break;
  }
  case "SubagentStart":
    handleSubagentStart();
    break;
  case "SubagentStop":
    handleSubagentStop();
    break;
  case "SessionEnd":
    try { rmSync(SESSION_FILE, { force: true }); } catch {}
    logActivity("end", "Session ended");
    break;
}

process.exit(0);

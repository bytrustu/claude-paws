#!/usr/bin/env node
import { createServer } from "node:http";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { homedir } from "node:os";

const PORT = process.env.PORT || 3200;
const DASH_DIR = join(homedir(), ".claude", "dashboard");
const ACTIVE_DIR = join(DASH_DIR, "active");

async function getSessions() {
  try {
    const files = await readdir(ACTIVE_DIR);
    const sessions = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(ACTIVE_DIR, f), "utf8");
        const data = JSON.parse(raw);
        const fileStat = await stat(join(ACTIVE_DIR, f));
        data._mtime = fileStat.mtimeMs;
        sessions.push(data);
      } catch {}
    }
    sessions.sort((a, b) => (b._mtime || 0) - (a._mtime || 0));
    return sessions;
  } catch {
    return [];
  }
}

const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Paw Sessions</title>
<style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css');

  :root {
    --white: #ffffff;
    --gray-50: #f9fafb;
    --gray-100: #f2f4f6;
    --gray-200: #e5e8eb;
    --gray-400: #b0b8c1;
    --gray-500: #8b95a1;
    --gray-600: #6b7684;
    --gray-900: #191f28;
    --blue: #3182f6;
    --blue-bg: #f2f7ff;
    --green: #20c997;
    --green-bg: #e6fcf5;
    --yellow: #f59f00;
    --yellow-bg: #fff9db;
    --purple: #7048e8;
    --purple-bg: #f3f0ff;
    --cols: 4;
    --gap: 12px;
    --cell: 1fr;
    --modal-bg: rgba(0,0,0,0.35);
  }

  [data-theme="dark"] {
    --white: #0d1117;
    --gray-50: #161b22;
    --gray-100: #1c2128;
    --gray-200: #30363d;
    --gray-400: #484f58;
    --gray-500: #8b949e;
    --gray-600: #b1bac4;
    --gray-900: #e6edf3;
    --blue: #58a6ff;
    --blue-bg: #121d2f;
    --green: #3fb950;
    --green-bg: #0d2117;
    --yellow: #d29922;
    --yellow-bg: #1e1604;
    --purple: #bc8cff;
    --purple-bg: #1b1036;
    --modal-bg: rgba(0,0,0,0.6);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont,
      system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo',
      'Noto Sans KR', 'Malgun Gothic', sans-serif;
    background: var(--white);
    color: var(--gray-900);
    -webkit-font-smoothing: antialiased;
  }

  .wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 48px 28px 100px;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40px;
  }
  .header-left h1 {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.04em;
    margin-bottom: 4px;
  }
  .header-sub {
    font-size: 14px;
    color: var(--gray-500);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot-live {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--green);
    animation: blink 2.4s ease-in-out infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .btn {
    border: 1px solid var(--gray-200);
    background: var(--white);
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-600);
    cursor: pointer;
    transition: all .15s;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .btn:hover { background: var(--gray-50); border-color: var(--gray-400); }
  .btn.active { background: var(--blue-bg); color: var(--blue); border-color: var(--blue); }
  .btn svg { width: 14px; height: 14px; }

  .col-select {
    border: 1px solid var(--gray-200);
    background: var(--white);
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-600);
    font-family: inherit;
    cursor: pointer;
  }

  /* ── Summary ── */
  .summary {
    display: flex;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--gray-200);
  }
  .summary-item { flex: 1; }
  .summary-item + .summary-item { padding-left: 24px; border-left: 1px solid var(--gray-200); }
  .summary-label { font-size: 12px; font-weight: 500; color: var(--gray-500); margin-bottom: 4px; }
  .summary-value { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  .v-total { color: var(--gray-900); }
  .v-working { color: var(--yellow); }
  .v-waiting { color: var(--blue); }

  /* ── Grid Board ── */
  .board {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: var(--gap);
    min-height: 200px;
  }

  /* ── Card ── */
  .card {
    background: var(--gray-50);
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
    transition: box-shadow .15s, background .15s, transform .1s;
    cursor: default;
    overflow: hidden;
  }
  .card:hover { background: var(--gray-100); }
  .card.w2 { grid-column: span 2; }
  .card.h2 { grid-row: span 2; }
  .card.w2.h2 { grid-column: span 2; grid-row: span 2; }

  /* Edit mode */
  .editing .card {
    cursor: grab;
    box-shadow: 0 0 0 1px var(--gray-200);
  }
  .editing .card:hover {
    box-shadow: 0 0 0 2px var(--blue);
  }
  .card.dragging {
    opacity: 0.4;
    transform: scale(0.96);
  }
  .card.drop-target {
    box-shadow: 0 0 0 2px var(--blue) !important;
    background: var(--blue-bg) !important;
  }

  /* Card resize controls */
  .card-controls {
    display: none;
    position: absolute;
    top: 8px;
    right: 8px;
    gap: 4px;
  }
  .editing .card-controls { display: flex; }
  .ctrl-btn {
    width: 26px; height: 26px;
    border: 1px solid var(--gray-200);
    background: var(--white);
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: var(--gray-600);
    transition: all .1s;
  }
  .ctrl-btn:hover { border-color: var(--blue); color: var(--blue); }

  /* Card content */
  .card-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .indicator {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .indicator.working { background: var(--yellow); animation: pdot 1.5s ease infinite; }
  .indicator.waiting { background: var(--blue); }
  .indicator.notification { background: var(--purple); animation: blink 1.8s ease infinite; }
  .indicator.started { background: var(--green); }
  .indicator.stale { background: var(--gray-200); }
  @keyframes pdot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:.6} }

  .card-name {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.02em;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card-session-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--gray-500);
    margin-left: 4px;
  }
  .tag {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .tag.working { background: var(--yellow-bg); color: #b47600; }
  .tag.waiting { background: var(--blue-bg); color: var(--blue); }
  .tag.notification { background: var(--purple-bg); color: var(--purple); }
  .tag.started { background: var(--green-bg); color: #0ca678; }
  .tag.stale { background: var(--gray-100); color: var(--gray-500); }

  .card-desc {
    font-size: 13px;
    color: var(--gray-600);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card.h2 .card-desc {
    -webkit-line-clamp: 6;
  }
  .card-footer {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--gray-400);
  }

  /* ── Pixel Mascot ── */
  .mascot {
    width: 32px;
    height: 32px;
    position: relative;
    flex-shrink: 0;
    image-rendering: pixelated;
  }
  .mascot svg {
    width: 32px;
    height: 32px;
  }
  /* Working: typing cat */
  .mascot.working .body { animation: type 0.4s steps(2) infinite; }
  @keyframes type {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1px); }
  }
  /* Waiting: idle breathing */
  .mascot.waiting .body { animation: breathe 2.5s ease-in-out infinite; }
  @keyframes breathe {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(1.04); }
  }
  /* Stale: sleeping bob */
  .mascot.stale .body { animation: sleep 3s ease-in-out infinite; }
  .mascot.stale .zzz { display: block; animation: float-zzz 2s ease-in-out infinite; }
  @keyframes sleep {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(5deg); }
  }
  @keyframes float-zzz {
    0%, 100% { opacity: 0.3; transform: translate(0, 0) scale(0.7); }
    50% { opacity: 1; transform: translate(4px, -6px) scale(1); }
  }
  /* Notification: bounce */
  .mascot.notification .body { animation: bounce 0.6s ease infinite; }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  .mascot .zzz { display: none; }

  .empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 72px 0;
  }
  .empty-circle {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: var(--gray-100);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }
  .empty-circle svg { width: 22px; height: 22px; stroke: var(--gray-400); fill: none; stroke-width: 1.5; }
  .empty-text { font-size: 14px; color: var(--gray-500); }

  /* ── Modal ── */
  .modal-overlay {
    display: flex;
    position: fixed;
    inset: 0;
    background: var(--modal-bg);
    z-index: 100;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(2px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease-out;
  }
  .modal-overlay.open {
    opacity: 1;
    pointer-events: auto;
  }
  .modal-overlay.closing {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease-in;
  }
  .modal {
    background: var(--white);
    border-radius: 20px;
    width: 90%;
    max-width: 640px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 40px rgba(0,0,0,0.15);
    transform: translateY(8px) scale(0.97);
    transition: transform 0.2s ease-out;
  }
  .modal-overlay.open .modal {
    transform: translateY(0) scale(1);
  }
  .modal-overlay.closing .modal {
    transform: translateY(8px) scale(0.97);
    transition: transform 0.15s ease-in;
  }
  .modal-header {
    padding: 24px 28px 16px;
    border-bottom: 1px solid var(--gray-100);
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .modal-header .card-name { font-size: 20px; font-weight: 800; }
  .modal-close {
    margin-left: auto;
    border: none;
    background: var(--gray-100);
    width: 32px; height: 32px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    color: var(--gray-500);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background .15s;
  }
  .modal-close:hover { background: var(--gray-200); }
  .modal-info {
    padding: 16px 28px;
    display: flex;
    gap: 20px;
    border-bottom: 1px solid var(--gray-100);
    font-size: 13px;
    color: var(--gray-600);
  }
  .modal-info-item { display: flex; flex-direction: column; gap: 2px; }
  .modal-info-label { font-size: 11px; font-weight: 600; color: var(--gray-400); }
  .btn-delete-session {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border: 1px solid var(--gray-200); background: var(--white);
    border-radius: 8px; font-size: 13px; font-weight: 600;
    color: #e03131; cursor: pointer; transition: all .15s; font-family: inherit;
    margin-left: 8px;
  }
  .btn-delete-session:hover { background: #fff5f5; border-color: #e03131; }
  .card-terminal-btn {
    position: absolute; top: 12px; right: 12px;
    width: 32px; height: 32px;
    border: 1px solid var(--gray-200); background: var(--white);
    border-radius: 8px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all .15s; z-index: 2; opacity: 0;
  }
  .card:hover .card-terminal-btn { opacity: 1; }
  .card-terminal-btn:hover { background: var(--blue-bg); border-color: var(--blue); }
  .card-terminal-btn svg { width: 14px; height: 14px; stroke: var(--gray-600); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .card-terminal-btn:hover svg { stroke: var(--blue); }
  .noti-toggle { position: relative; cursor: pointer; background: none; border: 1px solid var(--gray-200); border-radius: 8px; padding: 6px 8px; display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; color: var(--gray-600); font-family: inherit; transition: all .15s; }
  .noti-toggle:hover { border-color: var(--gray-400); color: var(--gray-900); }
  .noti-toggle svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .noti-toggle.off { color: var(--gray-400); }
  .noti-toggle.off svg { opacity: 0.4; }
  .noti-toggle .noti-slash { display: none; }
  .noti-toggle.off .noti-slash { display: block; position: absolute; left: 6px; top: 4px; }
  .toast-container {
    position: fixed; bottom: 24px; right: 24px;
    display: flex; flex-direction: column; gap: 8px;
    z-index: 9999; pointer-events: none;
    align-items: flex-end;
  }
  .toast { cursor: pointer;
    background: var(--white); color: var(--gray-900);
    padding: 12px 16px; border-radius: 12px;
    font-size: 13px; font-weight: 500;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    border: 1px solid var(--gray-200);
    display: flex; align-items: center; gap: 10px;
    animation: toastIn 0.3s ease;
    pointer-events: auto; max-width: 400px;
  }
  .toast .toast-mascot { width: 32px; height: 32px; flex-shrink: 0; }
  .toast .toast-mascot svg { width: 32px; height: 32px; }
  .toast .toast-content { flex: 1; min-width: 0; }
  .toast .toast-title { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
  .toast .toast-msg { font-size: 12px; color: var(--gray-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .toast .toast-close {
    width: 20px; height: 20px; border: none; background: none;
    color: var(--gray-400); cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px; flex-shrink: 0;
  }
  .toast .toast-close:hover { background: var(--gray-100); color: var(--gray-600); }
  @keyframes toastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .toast-dismiss-all {
    align-self: flex-end; pointer-events: auto;
    border: 1px solid var(--gray-200); background: var(--white);
    padding: 6px 14px; border-radius: 8px;
    font-size: 12px; font-weight: 600; color: var(--gray-500);
    cursor: pointer; font-family: inherit; transition: all .15s;
  }
  .toast-dismiss-all:hover { background: var(--gray-50); color: var(--gray-900); }
  .toast-arrow-layer {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    pointer-events: none; z-index: 9998;
  }
  @keyframes cardPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(49,130,246,0); } 50% { box-shadow: 0 0 0 4px rgba(49,130,246,0.3); } }
  .card.toast-highlight { animation: cardPulse 1.5s ease infinite; }
  .editing .card-terminal-btn { display: none; }
  .modal-actions { padding: 0 24px 16px; }
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 28px 24px;
  }
  .timeline { display: flex; flex-direction: column; gap: 0; }
  .tl-item {
    display: flex;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--gray-50);
    font-size: 13px;
    align-items: flex-start;
  }
  .tl-icon {
    width: 24px; height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
  }
  .tl-icon.tool { background: var(--blue-bg); color: var(--blue); }
  .tl-icon.msg { background: var(--green-bg); color: var(--green); }
  .tl-icon.agent { background: var(--purple-bg); color: var(--purple); }
  .tl-icon.team { background: var(--yellow-bg); color: var(--yellow); }
  .tl-icon.rename { background: var(--gray-100); color: var(--gray-600); }
  .tl-body { flex: 1; min-width: 0; }
  .tl-title { font-weight: 600; color: var(--gray-900); margin-bottom: 2px; }
  .tl-desc {
    font-size: 12px;
    color: var(--gray-500);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tl-time {
    font-size: 11px;
    color: var(--gray-400);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .tl-empty {
    text-align: center;
    padding: 40px 0;
    color: var(--gray-400);
    font-size: 14px;
  }


  /* ── Team Visualization ── */
  .team-section {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--gray-100);
  }
  .team-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .team-header-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--gray-400);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .team-header-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--gray-900);
  }
  .team-diagram {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    position: relative;
    padding: 8px 0;
  }
  .team-lead-row {
    display: flex;
    justify-content: center;
    margin-bottom: 4px;
    position: relative;
    z-index: 2;
  }
  .team-workers-row {
    display: flex;
    justify-content: center;
    gap: 24px;
    position: relative;
    z-index: 2;
  }
  .team-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 64px;
  }
  .team-node .mascot { width: 28px; height: 28px; }
  .team-node .mascot svg { width: 28px; height: 28px; }
  .team-node-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--gray-900);
    white-space: nowrap;
  }
  .team-node-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
  }
  .team-node-badge.running { background: var(--green-bg); color: var(--green); }
  .team-node-badge.stopped { background: var(--gray-100); color: var(--gray-500); }
  .team-node-badge.unknown { background: var(--yellow-bg); color: var(--yellow); }
  .team-lines {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }
  .team-lines line {
    stroke: var(--gray-200);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .team-progress {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .team-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .team-progress-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--gray-500);
  }
  .team-progress-count {
    font-size: 11px;
    font-weight: 700;
    color: var(--gray-900);
    font-variant-numeric: tabular-nums;
  }
  .team-progress-bar {
    height: 4px;
    background: var(--gray-100);
    border-radius: 2px;
    overflow: hidden;
  }
  .team-progress-fill {
    height: 100%;
    background: var(--green);
    border-radius: 2px;
    transition: width 0.4s ease;
  }
  .team-tasks {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .team-task {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    background: var(--gray-50);
  }
  .team-task-id {
    font-weight: 700;
    color: var(--gray-400);
    font-variant-numeric: tabular-nums;
    min-width: 20px;
  }
  .team-task-subject {
    flex: 1;
    color: var(--gray-600);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .team-task-status {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .team-task-status.completed { background: var(--green-bg); color: var(--green); }
  .team-task-status.in_progress { background: var(--yellow-bg); color: var(--yellow); }
  .team-task-status.pending { background: var(--gray-100); color: var(--gray-500); }

  /* ── Card Team Indicator ── */
  .card-team-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }
  .card-team-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--gray-400);
    margin-right: 4px;
  }
  .mini-mascot {
    width: 18px;
    height: 18px;
    position: relative;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
  .mini-mascot svg { width: 18px; height: 18px; }
  .mini-mascot-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: 1.5px solid var(--gray-50);
  }
  .mini-mascot-dot.running { background: var(--green); }
  .mini-mascot-dot.stopped { background: var(--gray-400); }
  .mini-mascot-dot.unknown { background: var(--yellow); }

  @media (max-width: 768px) {
    .wrap { padding: 32px 16px 80px; }
    .board { --cols: 2; }
    .header { flex-direction: column; align-items: flex-start; gap: 12px; }
  }
  @media (max-width: 480px) {
    .board { --cols: 1; }
    .card.w2 { grid-column: span 1; }
  }

  /* ── Walking Pets ── */
  .pet-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 50;
    overflow: hidden;
  }
  .pet {
    position: absolute;
    width: 40px;
    height: 40px;
    overflow: visible;
    transition: left 4s linear, bottom 0.3s ease;
    image-rendering: pixelated;
  }
  .pet svg { width: 40px; height: 40px; overflow: visible; }
  .pet { pointer-events: auto; cursor: pointer; }
  .pet.walk .body {
    animation: pet-walk 0.35s ease-in-out infinite;
  }
  .pet.idle .body {
    animation: pet-idle 2.5s ease-in-out infinite;
  }
  @keyframes pet-walk {
    0% { transform: translateY(0) rotate(-2deg) scaleX(1.02); }
    25% { transform: translateY(-2px) rotate(0deg) scaleX(0.98); }
    50% { transform: translateY(0) rotate(2deg) scaleX(1.02); }
    75% { transform: translateY(-2px) rotate(0deg) scaleX(0.98); }
    100% { transform: translateY(0) rotate(-2deg) scaleX(1.02); }
  }
  @keyframes pet-idle {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    30% { transform: translateY(-1px) rotate(-1deg); }
    70% { transform: translateY(-1px) rotate(1deg); }
  }
  .pet.flip svg { transform: scaleX(-1); }
  .pet-shadow {
    position: absolute;
    bottom: -3px;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 6px;
    background: rgba(0,0,0,0.08);
    border-radius: 50%;
  }
  [data-theme="dark"] .pet-shadow { background: rgba(255,255,255,0.05); }

  /* Speech bubble */
  .pet-bubble {
    position: absolute;
    bottom: 46px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--white, #fff);
    border: 1px solid var(--gray-200, #e5e8eb);
    border-radius: 10px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 500;
    color: var(--gray-600, #6b7684);
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  [data-theme="dark"] .pet-bubble {
    background: var(--gray-900, #161b22);
    border-color: var(--gray-600, #30363d);
    color: var(--gray-400, #8b949e);
  }
  .pet-bubble.show { opacity: 1; }
  .pet-bubble::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    width: 8px;
    height: 5px;
    background: inherit;
    border-bottom: 1px solid var(--gray-200, #e5e8eb);
    border-right: 1px solid var(--gray-200, #e5e8eb);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }


  /* ── Mascot Picker ── */
  .mascot-picker-overlay {
    display: flex;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 200;
    justify-content: center;
    align-items: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }
  .mascot-picker-overlay.open {
    opacity: 1;
    pointer-events: auto;
  }
  .mascot-picker {
    background: var(--white, #fff);
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.15);
    max-width: 360px;
    width: 90%;
  }
  [data-theme="dark"] .mascot-picker {
    background: var(--gray-900, #161b22);
  }
  .picker-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 16px;
    color: var(--gray-900, #191f28);
    letter-spacing: -0.02em;
  }
  [data-theme="dark"] .picker-title { color: var(--gray-100, #e6edf3); }
  .picker-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  .picker-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 4px;
    border-radius: 10px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    background: var(--gray-50, #f9fafb);
  }
  [data-theme="dark"] .picker-item { background: var(--gray-800, #1c2333); }
  .picker-item:hover { border-color: var(--blue, #3182f6); background: var(--blue-bg, #f2f7ff); }
  [data-theme="dark"] .picker-item:hover { background: rgba(49,130,246,0.1); }
  .picker-item.selected { border-color: var(--blue, #3182f6); background: var(--blue-bg, #f2f7ff); }
  .picker-item svg { width: 32px; height: 32px; }
  .picker-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--gray-600, #6b7684);
  }
  .picker-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .picker-btn {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--gray-200, #e5e8eb);
    background: var(--white, #fff);
    color: var(--gray-600, #6b7684);
    font-family: inherit;
    transition: all 0.15s;
  }
  .picker-btn:hover { background: var(--gray-50, #f9fafb); }
  .picker-btn.primary {
    background: var(--blue, #3182f6);
    color: white;
    border-color: var(--blue, #3182f6);
  }
  .picker-btn.primary:hover { opacity: 0.9; }

</style>
</head>
<body>

<div class="wrap">
  <header class="header">
    <div class="header-left">
      <h1>Paw Sessions</h1>
      <div class="header-sub"><span class="dot-live"></span><span id="clock"></span></div>
    </div>
    <div class="header-actions">
      <button class="noti-toggle" id="notiToggle" title="macOS 알림">
        <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <svg class="noti-slash" viewBox="0 0 24 24" width="14" height="14"><line x1="4" y1="4" x2="20" y2="20" stroke="var(--red, #e03131)" stroke-width="2.5"/></svg>
      </button>
      <select class="col-select" id="colSelect" title="컬럼 수">
        <option value="2">2열</option>
        <option value="3">3열</option>
        <option value="4" selected>4열</option>
        <option value="5">5열</option>
      </select>
      <button class="btn" id="themeBtn" title="다크모드 토글">
        <svg id="themeIcon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v1M8 14v1M1 8h1M14 8h1M3.05 3.05l.71.71M12.24 12.24l.71.71M3.05 12.95l.71-.71M12.24 3.76l.71-.71"/><circle cx="8" cy="8" r="3"/></svg>
      </button>
      <button class="btn" id="myCharBtn" title="대표 캐릭터">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><circle cx="8" cy="6" r="3"/><path d="M3 14c0-3 2-5 5-5s5 2 5 5"/></svg>
      </button>
      <button class="btn" id="editBtn" title="편집 모드">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z"/></svg>
        편집
      </button>
      <button class="btn" id="resetBtn" title="레이아웃 초기화">초기화</button>
    </div>
  </header>

  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">전체</div>
      <div class="summary-value v-total" id="s-total">0</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">작업 중</div>
      <div class="summary-value v-working" id="s-working">0</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">입력 대기</div>
      <div class="summary-value v-waiting" id="s-waiting">0</div>
    </div>
  </div>

  <div id="board" class="board"></div>
</div>

<div class="pet-layer" id="pet-layer"></div>

<div class="modal-overlay" id="modal" style="display:none">
  <div class="modal">
    <div class="modal-header">
      <div id="modal-mascot"></div>
      <span class="card-name" id="modal-name"></span>
      <span class="tag" id="modal-tag"></span>
      <button class="modal-close" id="modal-close">&times;</button>
    </div>
    <div class="modal-info">
      <div class="modal-info-item"><span class="modal-info-label">Project</span><span id="modal-project"></span></div>
      <div class="modal-info-item"><span class="modal-info-label">Path</span><span id="modal-path"></span></div>
      <div class="modal-info-item"><span class="modal-info-label">Updated</span><span id="modal-time"></span></div>
    </div>
    <div class="modal-actions"></div>
    <div class="modal-body">
      <div id="modal-team"></div>
      <div id="modal-timeline" class="timeline"></div>
    </div>
  </div>
</div>

<div class="mascot-picker-overlay" id="mascot-picker">
  <div class="mascot-picker">
    <div class="picker-title" id="picker-title-text">캐릭터 선택</div>
    <div class="picker-grid" id="picker-grid"></div>
    <div class="picker-actions">
      <button class="picker-btn" id="picker-reset">초기화</button>
      <button class="picker-btn" id="picker-cancel">취소</button>
      <button class="picker-btn primary" id="picker-confirm">선택</button>
    </div>
  </div>
</div>
<script>
const STORAGE_KEY = "claude-dash-layout";
const CFG = {
  working: { label: "작업 중", cls: "working" },
  waiting: { label: "입력 대기", cls: "waiting" },
  started: { label: "시작됨", cls: "started" },
  stale:   { label: "응답 없음", cls: "stale" },
};
const NOTIFY = { label: "알림", cls: "notification" };
const SIZES = ["", "w2", "h2", "w2 h2"];

function mascot(cls, sid, forceIdx) {
  const hash = (sid||"").split("").reduce((a,c) => a + c.charCodeAt(0), 0);
  const type = (forceIdx !== undefined) ? forceIdx : ((typeof getCharIdx === 'function' && sid) ? getCharIdx(sid) : hash % 12); // 0:cat, 1:dog, 2:rabbit, 3:bear, 4:penguin
  const eye = cls === "stale" ? "var(--gray-300)" : "var(--gray-900)";
  const eyeH = cls === "stale" ? "0.5" : "1.5";
  const cheek = cls === "notification" ? "var(--purple)" : cls === "working" ? "var(--yellow)" : "var(--blue)";
  const arms = cls === "working" ? \`<rect x="3" y="11" width="2" height="1" fill="var(--gray-600)" rx="0.5"/><rect x="11" y="11" width="2" height="1" fill="var(--gray-600)" rx="0.5"/>\` : "";

  const chars = [
    // 0: Cat - triangle ears
    { color: "#FFD699", ear: \`<polygon points="2,4 4,1 6,4" fill="#E8B968"/><polygon points="10,4 12,1 14,4" fill="#E8B968"/>\`, nose: \`<polygon points="7.5,7 8.5,7 8,7.8" fill="#E8B968"/>\`, extra: \`<path d="M6,8 Q8,9.5 10,8" stroke="#E8B968" fill="none" stroke-width="0.5"/>\` },
    // 1: Dog - floppy ears
    { color: "#C4956A", ear: \`<rect x="1" y="3" width="3" height="5" rx="1.5" fill="#A67B52"/><rect x="12" y="3" width="3" height="5" rx="1.5" fill="#A67B52"/>\`, nose: \`<rect x="7" y="6.5" width="2" height="1.5" rx="0.75" fill="#5C3D2E"/>\`, extra: \`<rect x="7.5" y="8" width="1" height="1.5" fill="#E88B8B" rx="0.3"/>\` },
    // 2: Rabbit - long ears
    { color: "#F5E6D3", ear: \`<rect x="4" y="0" width="2.5" height="5" rx="1.2" fill="#F0D5BE"/><rect x="9.5" y="0" width="2.5" height="5" rx="1.2" fill="#F0D5BE"/><rect x="4.6" y="0.5" width="1.3" height="3.5" rx="0.6" fill="#FFB5B5"/><rect x="10.1" y="0.5" width="1.3" height="3.5" rx="0.6" fill="#FFB5B5"/>\`, nose: \`<polygon points="7.5,7 8.5,7 8,7.6" fill="#FFB5B5"/>\`, extra: \`<circle cx="5" cy="7.5" r="0.5" fill="#FFB5B5" opacity="0.5"/><circle cx="11" cy="7.5" r="0.5" fill="#FFB5B5" opacity="0.5"/>\` },
    // 3: Bear - round ears
    { color: "#A0785A", ear: \`<circle cx="3.5" cy="3" r="2" fill="#8B6544"/><circle cx="12.5" cy="3" r="2" fill="#8B6544"/><circle cx="3.5" cy="3" r="1" fill="#C4956A"/><circle cx="12.5" cy="3" r="1" fill="#C4956A"/>\`, nose: \`<ellipse cx="8" cy="7.2" rx="1.2" ry="0.8" fill="#5C3D2E"/>\`, extra: "" },
    // 4: Penguin - white belly
    { color: "#2D3436", ear: "", nose: \`<polygon points="7,6 9,6 8,7.5" fill="#F39C12"/>\`, extra: \`<ellipse cx="8" cy="11.5" rx="3" ry="2.5" fill="#F5F5F5"/>\` },
    // 5: Tiger - striped triangle ears
    { color: "#F4A623", ear: \`<polygon points="2,4 4,1 6,4" fill="#E8941E"/><polygon points="10,4 12,1 14,4" fill="#E8941E"/>\`, nose: \`<polygon points="7.5,7 8.5,7 8,7.8" fill="#5C3D2E"/>\`, extra: \`<rect x="5" y="4" width="1" height="3" rx="0.3" fill="#2D3436" opacity="0.5"/><rect x="7.5" y="3.5" width="1" height="2" rx="0.3" fill="#2D3436" opacity="0.5"/><rect x="10" y="4" width="1" height="3" rx="0.3" fill="#2D3436" opacity="0.5"/>\` },
    // 6: Lion - mane
    { color: "#E8A640", ear: \`<circle cx="3" cy="3.5" r="2.5" fill="#C4782A"/><circle cx="13" cy="3.5" r="2.5" fill="#C4782A"/><circle cx="8" cy="1.5" r="2" fill="#C4782A"/>\`, nose: \`<ellipse cx="8" cy="7.2" rx="1" ry="0.7" fill="#5C3D2E"/>\`, extra: \`<path d="M7,8 Q8,9 9,8" stroke="#C4782A" fill="none" stroke-width="0.4"/>\` },
    // 7: Alpaca - fluffy head
    { color: "#F5F0E8", ear: \`<ellipse cx="3.5" cy="3" rx="1.5" ry="2" fill="#EDE5D8"/><ellipse cx="12.5" cy="3" rx="1.5" ry="2" fill="#EDE5D8"/>\`, nose: \`<ellipse cx="8" cy="7.5" rx="0.6" ry="0.4" fill="#C4956A"/>\`, extra: \`<circle cx="8" cy="2" r="2.5" fill="#F5F0E8"/><circle cx="6" cy="1.5" r="1.5" fill="#EDE5D8"/><circle cx="10" cy="1.5" r="1.5" fill="#EDE5D8"/>\` },
    // 8: Fox - pointy ears + white cheeks
    { color: "#E87826", ear: \`<polygon points="2,4 4,0 6,4" fill="#D4691E"/><polygon points="10,4 12,0 14,4" fill="#D4691E"/><polygon points="3,4 4,1.5 5,4" fill="#F5F0E8"/><polygon points="11,4 12,1.5 13,4" fill="#F5F0E8"/>\`, nose: \`<polygon points="7.5,7 8.5,7 8,7.8" fill="#2D3436"/>\`, extra: \`<ellipse cx="8" cy="8.5" rx="2.5" ry="1.5" fill="#F5F0E8"/>\` },
    // 9: Hamster - chubby cheeks
    { color: "#F0C78A", ear: \`<circle cx="3" cy="3.5" r="2" fill="#E8B968"/><circle cx="13" cy="3.5" r="2" fill="#E8B968"/><circle cx="3" cy="3.5" r="1" fill="#FFD699"/><circle cx="13" cy="3.5" r="1" fill="#FFD699"/>\`, nose: \`<circle cx="8" cy="7" r="0.5" fill="#E88B8B"/>\`, extra: \`<circle cx="5" cy="7.5" r="1.5" fill="#FFE0B2" opacity="0.6"/><circle cx="11" cy="7.5" r="1.5" fill="#FFE0B2" opacity="0.6"/>\` },
    // 10: Owl - big round eyes
    { color: "#8B6544", ear: \`<polygon points="3,4 4.5,1 6,4" fill="#6D4E35"/><polygon points="10,4 11.5,1 13,4" fill="#6D4E35"/>\`, nose: \`<polygon points="7.5,7.5 8.5,7.5 8,8.3" fill="#F4A623"/>\`, extra: \`<circle cx="5.5" cy="5.8" r="2" fill="#F5F0E8"/><circle cx="10.5" cy="5.8" r="2" fill="#F5F0E8"/><circle cx="5.5" cy="5.8" r="1" fill="#2D3436"/><circle cx="10.5" cy="5.8" r="1" fill="#2D3436"/>\` },
    // 11: Panda - black patches
    { color: "#F5F5F5", ear: \`<circle cx="3.5" cy="3" r="2" fill="#2D3436"/><circle cx="12.5" cy="3" r="2" fill="#2D3436"/>\`, nose: \`<ellipse cx="8" cy="7.2" rx="0.8" ry="0.5" fill="#2D3436"/>\`, extra: \`<ellipse cx="5.5" cy="5.5" rx="2" ry="1.5" fill="#2D3436" opacity="0.7"/><ellipse cx="10.5" cy="5.5" rx="2" ry="1.5" fill="#2D3436" opacity="0.7"/>\` },
  ];
  const ch = chars[type];

  return \`<div class="mascot \${cls}">
    <svg viewBox="0 0 16 16" shape-rendering="crispEdges">
      <g class="body">
        \${ch.ear}
        <rect x="3" y="3.5" width="10" height="7" rx="2" fill="\${ch.color}"/>
        <rect x="5" y="5.5" width="1.5" height="\${eyeH}" rx="0.3" fill="\${eye}"/>
        <rect x="9.5" y="5.5" width="1.5" height="\${eyeH}" rx="0.3" fill="\${eye}"/>
        \${ch.nose}
        <circle cx="4.5" cy="7.5" r="1" fill="\${cheek}" opacity="0.3"/>
        <circle cx="11.5" cy="7.5" r="1" fill="\${cheek}" opacity="0.3"/>
        <rect x="4" y="10" width="8" height="4.5" rx="1.5" fill="\${ch.color}"/>
        \${ch.extra}
        \${arms}
      </g>
      <text class="zzz" x="13" y="3" font-size="4" fill="var(--gray-500)">z</text>
    </svg>
  </div>\`;
}

function cfg(s) {
  if (s.status?.startsWith("notification")) return NOTIFY;
  return CFG[s._ds] || CFG[s.status] || CFG.started;
}
function rel(d) {
  if (!d) return "";
  const sec = Math.floor((Date.now() - new Date(d.replace(" ","T")).getTime()) / 1000);
  if (sec < 5) return "방금";
  if (sec < 60) return sec + "초 전";
  if (sec < 3600) return Math.floor(sec/60) + "분 전";
  return Math.floor(sec/3600) + "시간 전";
}
function path(c) { return c?.replace(/^\\/Users\\/[^/]+\\/git\\//, "") || ""; }
function cut(s, n) { if (!s) return ""; s = s.replace(/\\n/g," ").trim(); return s.length > n ? s.slice(0,n)+"..." : s; }

function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// ── State ──
let editing = false;
let layout = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
// layout: { order: [sid, ...], sizes: { sid: "w2" | "h2" | "w2 h2" | "" }, cols: 4 }
if (!layout.order) layout = { order: [], sizes: {}, cols: 4 };

let prevHash = "";
let dragSid = null;

// ── Column Select ──
const colSelect = document.getElementById("colSelect");
colSelect.value = layout.cols || 4;
document.getElementById("board").style.setProperty("--cols", layout.cols || 4);
colSelect.addEventListener("change", () => {
  layout.cols = parseInt(colSelect.value);
  document.getElementById("board").style.setProperty("--cols", layout.cols);
  saveLayout();
});

// ── Edit Toggle ──
const editBtn = document.getElementById("editBtn");
editBtn.addEventListener("click", () => {
  editing = !editing;
  editBtn.classList.toggle("active", editing);
  document.getElementById("board").classList.toggle("editing", editing);
  prevHash = "";
  poll();
});

// ── Reset ──
document.getElementById("resetBtn").addEventListener("click", () => {
  layout = { order: [], sizes: {}, cols: parseInt(colSelect.value) };
  saveLayout();
  prevHash = "";
  poll();
});

function saveLayout() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

function cycleSize(sid) {
  const cur = layout.sizes[sid] || "";
  const idx = SIZES.indexOf(cur);
  layout.sizes[sid] = SIZES[(idx + 1) % SIZES.length];
  saveLayout();
  prevHash = "";
  poll();
}

function orderSessions(sessions) {
  const sids = sessions.map(s => s.session);
  // Add new sessions not in layout
  sids.forEach(sid => {
    if (!layout.order.includes(sid)) layout.order.push(sid);
  });
  // Remove gone sessions
  layout.order = layout.order.filter(sid => sids.includes(sid));
  saveLayout();
  // Sort by layout order
  const orderMap = {};
  layout.order.forEach((sid, i) => orderMap[sid] = i);
  return [...sessions].sort((a, b) => (orderMap[a.session] ?? 999) - (orderMap[b.session] ?? 999));
}

function renderCard(s) {
  const c = cfg(s);
  const sizeClass = layout.sizes[s.session] || "";
  const desc = s.lastResponse
    ? cut(s.lastResponse, 200)
    : s.message === "Claude is waiting for your input"
      ? "\\u2014"
      : cut(s.message, 200) || "\\u2014";
  const sizeLabel = {"":" 1x1 ","w2":" 2x1 ","h2":" 1x2 ","w2 h2":" 2x2 "}[sizeClass] || " 1x1 ";

  return \`<div class="card \${sizeClass}" data-sid="\${s.session}"
    draggable="\${editing}" >
    <div class="card-controls">
      <button class="ctrl-btn" onclick="cycleSize('\${s.session}')" title="크기 변경">\${sizeLabel}</button>
    </div>
    <button class="card-terminal-btn" data-focus="\${s.session}" title="터미널 열기">
      <svg viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
    </button>
    <div class="card-top">
      \${mascot(c.cls, s.session)}
      <span class="card-name">\${esc(s.sessionName || s.project || "unknown")}</span>\${s.sessionName ? \`<span class="card-session-name">\${esc(s.project)}</span>\` : ""}
      <span class="tag \${c.cls}">\${c.label}</span>
    </div>
    <div class="card-desc">\${esc(desc)}</div>
    <div class="card-footer">
      <span>\${path(s.cwd)}</span>
      <span class="card-time">\${rel(s.updated)}</span>
    </div>
    \${renderCardTeam(s)}
  </div>\`;
}

function renderCardTeam(s) {
  if (!s.teams || s.teams.length === 0) return "";
  const team = s.teams[0];
  const members = team.members || [];
  if (members.length === 0) return "";
  const subs = s.subagents || [];
  const minis = members.map(m => {
    const sub = subs.find(sa => sa.name === m.name);
    const st = sub ? sub.status : (m.name === "team-lead" ? "running" : "unknown");
    return \`<div class="mini-mascot">
      \${miniMascot(m.name)}
      <div class="mini-mascot-dot \${st}"></div>
    </div>\`;
  }).join("");
  return \`<div class="card-team-row">
    <span class="card-team-label">\${team.name}</span>\${minis}
  </div>\`;
}

function miniMascot(name) {
  const hash = (name||"").split("").reduce((a,c) => a + c.charCodeAt(0), 0);
  const type = hash % 12;
  const colors = ["#FFD699","#C4956A","#F5E6D3","#A0785A","#2D3436","#F4A623","#E8A640","#F5F0E8","#E87826","#F0C78A","#8B6544","#F5F5F5"];
  const col = colors[type] || "#C4956A";
  return \`<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="3" y="3.5" width="10" height="7" rx="2" fill="\${col}"/>
    <rect x="5" y="5.5" width="1.5" height="1.5" rx="0.3" fill="var(--gray-900,#191f28)"/>
    <rect x="9.5" y="5.5" width="1.5" height="1.5" rx="0.3" fill="var(--gray-900,#191f28)"/>
    <rect x="4" y="10" width="8" height="4.5" rx="1.5" fill="\${col}"/>
  </svg>\`;
}

function render(sessions) {
  const now = Date.now();
  sessions.forEach(s => {
    const age = (now - new Date(s.updated?.replace(" ","T")).getTime()) / 60000;
    s._ds = (age > 10 && s.status !== "waiting") ? "stale" : s.status;
  });

  const hash = JSON.stringify(sessions.map(s => s.session + s.status + s.updated + s.message + (s.lastResponse||"")));

  document.getElementById("s-total").textContent = sessions.length;
  document.getElementById("s-working").textContent = sessions.filter(s => s._ds === "working").length;
  document.getElementById("s-waiting").textContent = sessions.filter(s => s._ds === "waiting" || s.status?.startsWith("notification")).length;

  if (hash === prevHash) {
    sessions.forEach(s => {
      const el = document.querySelector(\`[data-sid="\${s.session}"] .card-time\`);
      if (el) el.textContent = rel(s.updated);
    });
    return;
  }
  prevHash = hash;

  const ordered = orderSessions(sessions);
  const board = document.getElementById("board");

  if (!ordered.length) {
    board.innerHTML = \`<div class="empty">
      <div class="empty-circle"><svg viewBox="0 0 24 24"><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></div>
      <div class="empty-text">실행 중인 세션이 없습니다</div>
    </div>\`;
    return;
  }

  board.innerHTML = ordered.map(s => renderCard(s)).join("");
  board.classList.toggle("editing", editing);
  setupDrag();
}

// ── Drag & Drop ──
function setupDrag() {
  const cards = document.querySelectorAll(".card[draggable=true]");
  cards.forEach(card => {
    card.addEventListener("dragstart", e => {
      dragSid = card.dataset.sid;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".drop-target").forEach(c => c.classList.remove("drop-target"));
      dragSid = null;
    });
    card.addEventListener("dragover", e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (card.dataset.sid !== dragSid) {
        card.classList.add("drop-target");
      }
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("drop-target");
    });
    card.addEventListener("drop", e => {
      e.preventDefault();
      card.classList.remove("drop-target");
      const targetSid = card.dataset.sid;
      if (dragSid && targetSid && dragSid !== targetSid) {
        const fromIdx = layout.order.indexOf(dragSid);
        const toIdx = layout.order.indexOf(targetSid);
        if (fromIdx > -1 && toIdx > -1) {
          layout.order.splice(fromIdx, 1);
          layout.order.splice(toIdx, 0, dragSid);
          saveLayout();
          prevHash = "";
          poll();
        }
      }
    });
  });
}

function clock() {
  const n = new Date();
  document.getElementById("clock").textContent =
    n.toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) + " " +
    n.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

let petSessions = [];
async function poll() {
  try {
    const sessions = await (await fetch("/api/sessions")).json();
    petSessions = sessions;
    checkStateChanges(sessions);
    render(sessions);
  } catch(e) { console.error("RENDER ERROR:", e); }
  // Pets run separately - never affect card rendering
  try { if (typeof movePets === "function") movePets(petSessions); } catch(e) { console.warn("pet error:", e); }
  clock();
}

poll();
let pollTimer = setInterval(poll, 2000);
let clockTimer = setInterval(clock, 1000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(pollTimer);
    clearInterval(clockTimer);
  } else {
    poll();
    clock();
    pollTimer = setInterval(poll, 2000);
    clockTimer = setInterval(clock, 1000);
  }
});

// ── Modal ──
const modal = document.getElementById("modal");
// Modal close handlers moved to animated version below

async function openModal(sid) {
  try {
    const res = await fetch(\`/api/session/\${sid}\`);
    const data = await res.json();
    if (!data || data.error) return;

    const c = cfg(data);
    document.getElementById("modal-mascot").innerHTML = mascot(c.cls, sid);
    document.getElementById("modal-name").textContent = data.sessionName || data.project || "unknown";
    const tagEl = document.getElementById("modal-tag");
    tagEl.textContent = c.label;
    tagEl.className = "tag " + c.cls;
    document.getElementById("modal-project").textContent = data.project;
    document.getElementById("modal-path").textContent = path(data.cwd);
    document.getElementById("modal-time").textContent = rel(data.updated);

    // Delete button
    let delBtn = document.getElementById("btn-delete-session");
    if (!delBtn) {
      const actions = document.querySelector(".modal-actions");
      if (actions) {
        delBtn = document.createElement("button");
        delBtn.id = "btn-delete-session";
        delBtn.className = "btn-delete-session";
        delBtn.textContent = "세션 삭제";
        actions.appendChild(delBtn);
      }
    }
    if (delBtn) {
      delBtn.onclick = async () => {
        if (confirm("이 세션을 삭제할까요?")) {
          await fetch(\`/api/session/\${sid}\`, { method: "DELETE" });
          closeModal();
          prevHash = "";
          poll();
        }
      };
    }

    const tl = document.getElementById("modal-timeline");
    if (!data.entries || data.entries.length === 0) {
      tl.innerHTML = '<div class="tl-empty">기록된 활동이 없습니다</div>';
    } else {
      tl.innerHTML = data.entries.reverse().map(e => {
        const ts = e.ts ? new Date(e.ts).toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "";
        let icon = "", title = "", desc = "";
        switch(e.type) {
          case "tool":
            icon = '<div class="tl-icon tool">T</div>';
            title = e.name;
            desc = e.input || "";
            break;
          case "message":
            icon = '<div class="tl-icon msg">M</div>';
            title = "Claude";
            desc = e.text || "";
            break;
          case "subagent":
            icon = '<div class="tl-icon agent">A</div>';
            title = e.name;
            desc = e.status || "";
            break;
          case "rename":
            icon = '<div class="tl-icon rename">R</div>';
            title = "Renamed";
            desc = e.name || "";
            break;
          default:
            icon = '<div class="tl-icon team">E</div>';
            title = e.type;
            desc = e.text || e.name || "";
        }
        return \`<div class="tl-item">
          \${icon}
          <div class="tl-body">
            <div class="tl-title">\${esc(title)}</div>
            <div class="tl-desc">\${esc(desc)}</div>
          </div>
          <span class="tl-time">\${ts}</span>
        </div>\`;
      }).join("");
    }

    // Fetch and render team info
    try {
      const teamRes = await fetch(\`/api/session/\${sid}/team\`).catch(() => ({ok:false}));
      const teamData = await teamRes.json();
      renderTeamSection(teamData);
    } catch { renderTeamSection(null); }

    openModalOverlay();
  } catch(err) {
    console.error("Modal error:", err);
  }
}

function renderTeamSection(team) {
  const container = document.getElementById("modal-team");
  if (!team || team.error || !team.members || team.members.length === 0) {
    container.innerHTML = "";
    return;
  }

  const leader = team.members.find(m => m.role === "team-lead");
  const workers = team.members.filter(m => m.role !== "team-lead");

  const completedTasks = (team.tasks || []).filter(t => t.status === "completed").length;
  const totalTasks = (team.tasks || []).length;
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const statusLabel = { running: "running", stopped: "stopped", unknown: "unknown" };

  const renderNode = (m) => {
    const st = m.status || "unknown";
    return \`<div class="team-node">
      \${mascot(st === "running" ? "working" : st === "stopped" ? "stale" : "waiting", m.name)}
      <span class="team-node-name">\${m.name}</span>
      <span class="team-node-badge \${st}">\${statusLabel[st] || st}</span>
    </div>\`;
  };

  const taskRows = (team.tasks || []).map(t => {
    const stLabel = { completed: "done", in_progress: "working", pending: "pending" };
    return \`<div class="team-task">
      <span class="team-task-id">#\${t.id}</span>
      <span class="team-task-subject">\${t.subject}</span>
      <span class="team-task-status \${t.status}">\${stLabel[t.status] || t.status}</span>
    </div>\`;
  }).join("");

  // Calculate SVG line positions
  const workerCount = workers.length;

  container.innerHTML = \`<div class="team-section">
    <div class="team-header">
      <span class="team-header-label">TEAM</span>
      <span class="team-header-name">\${team.teamName}</span>
    </div>
    <div class="team-diagram" id="team-diagram">
      \${leader ? \`<div class="team-lead-row">\${renderNode(leader)}</div>\` : ""}
      <svg class="team-lines" id="team-lines"></svg>
      <div class="team-workers-row" id="team-workers">
        \${workers.map(w => renderNode(w)).join("")}
      </div>
    </div>
    <div class="team-progress">
      <div class="team-progress-header">
        <span class="team-progress-label">Tasks</span>
        <span class="team-progress-count">\${completedTasks} / \${totalTasks}</span>
      </div>
      <div class="team-progress-bar">
        <div class="team-progress-fill" style="width:\${pct}%"></div>
      </div>
    </div>
    \${taskRows ? \`<div class="team-tasks">\${taskRows}</div>\` : ""}
  </div>\`;

  // Draw connection lines after render
  requestAnimationFrame(() => {
    const diagram = document.getElementById("team-diagram");
    const svg = document.getElementById("team-lines");
    const leadRow = diagram.querySelector(".team-lead-row");
    const workerNodes = diagram.querySelectorAll(".team-workers-row .team-node");
    if (!leadRow || workerNodes.length === 0 || !svg) return;

    const dRect = diagram.getBoundingClientRect();
    const lRect = leadRow.getBoundingClientRect();
    const lx = lRect.left + lRect.width / 2 - dRect.left;
    const ly = lRect.bottom - dRect.top;

    let lines = "";
    workerNodes.forEach(node => {
      const nRect = node.getBoundingClientRect();
      const nx = nRect.left + nRect.width / 2 - dRect.left;
      const ny = nRect.top - dRect.top;
      lines += \`<line x1="\${lx}" y1="\${ly}" x2="\${nx}" y2="\${ny}"/>\`;
    });
    svg.innerHTML = lines;
  });
}

// Delegate click on cards
document.getElementById("board").addEventListener("click", e => {
  if (editing) return;
  // Terminal focus button
  const termBtn = e.target.closest(".card-terminal-btn");
  if (termBtn) {
    e.stopPropagation();
    const sid = termBtn.dataset.focus;
    if (sid) {
      fetch(\`/api/session/\${sid}/focus\`, { method: "POST" })
        .then(r => r.json())
        .then(d => { if (!d.ok) console.error("Focus failed:", d); })
        .catch(err => console.error("Focus error:", err));
    }
    return;
  }
  const card = e.target.closest(".card");
  if (card) openModal(card.dataset.sid);
});

// ── Dark Mode ──
function getPreferredTheme() {
  const stored = localStorage.getItem("claude-dash-theme");
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claude-dash-theme", theme);
  const icon = document.getElementById("themeIcon");
  if (theme === "dark") {
    icon.innerHTML = '<path d="M13.36 10.06A6.5 6.5 0 015.94 2.64 7 7 0 1013.36 10.06z"/>';
  } else {
    icon.innerHTML = '<path d="M8 1v1M8 14v1M1 8h1M14 8h1M3.05 3.05l.71.71M12.24 12.24l.71.71M3.05 12.95l.71-.71M12.24 3.76l.71-.71"/><circle cx="8" cy="8" r="3"/>';
  }
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}
applyTheme(getPreferredTheme());
document.getElementById("themeBtn").addEventListener("click", toggleTheme);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
  if (!localStorage.getItem("claude-dash-theme")) {
    applyTheme(e.matches ? "dark" : "light");
  }
});

// ── Modal close with animation ──
function closeModal() {
  const m = document.getElementById("modal");
  m.style.display = "none";
  m.classList.remove("open", "closing");
}
function openModalOverlay() {
  const m = document.getElementById("modal");
  m.style.display = "flex";
  m.classList.add("open");
}
document.getElementById("modal-close").onclick = function(e) {
  e.preventDefault();
  e.stopPropagation();
  closeModal();
  return false;
};
document.getElementById("modal").onclick = function(e) {
  if (e.target === this) closeModal();
};

// ── Keyboard Shortcuts ──
document.addEventListener("keydown", e => {
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key.toLowerCase()) {
    case "e":
      e.preventDefault();
      editBtn.click();
      break;
    case "d":
      e.preventDefault();
      toggleTheme();
      break;
    case "escape":
      closeModal();
      break;
    case "1": case "2": case "3": case "4": case "5": {
      e.preventDefault();
      const cols = parseInt(e.key);
      colSelect.value = cols;
      layout.cols = cols;
      document.getElementById("board").style.setProperty("--cols", cols);
      saveLayout();
      break;
    }
  }
});



// ── Walking Pets ──
// Character personalities (index matches chars array)
const PERSONALITY = [
  /* 0 cat    */ { name: "cat",     traits: ["curious","independent"] },
  /* 1 dog    */ { name: "dog",     traits: ["loyal","excited"] },
  /* 2 rabbit */ { name: "rabbit",  traits: ["shy","fast"] },
  /* 3 bear   */ { name: "bear",    traits: ["calm","strong"] },
  /* 4 penguin*/ { name: "penguin", traits: ["cool","waddle"] },
  /* 5 tiger  */ { name: "tiger",   traits: ["bold","leader"] },
  /* 6 lion   */ { name: "lion",    traits: ["proud","brave"] },
  /* 7 alpaca */ { name: "alpaca",  traits: ["fluffy","gentle"] },
  /* 8 fox    */ { name: "fox",     traits: ["clever","sneaky"] },
  /* 9 hamster*/ { name: "hamster", traits: ["tiny","busy"] },
  /* 10 owl   */ { name: "owl",     traits: ["wise","night"] },
  /* 11 panda */ { name: "panda",   traits: ["chill","hungry"] },
];

const CHAR_QUIPS = {
  cat:     ["냥~", "이거 뭐지..?", "관심 없는 척", "키보드 위에 앉고 싶다", "집사 어딨어"],
  dog:     ["멍! 멍!", "잘하고 있어!", "산책 가자!", "꼬리 흔들 중", "최고야!"],
  rabbit:  ["당근 주세요...", "깡총깡총", "좀 무서워...", "조용히 할게", "후다닥!"],
  bear:    ["으르렁", "꿀 어딨어", "천천히 하자", "힘으로 해결", "동굴에 가고 싶다"],
  penguin: ["추워...", "미끄러졌다", "뒤뚱뒤뚱", "남극이 그리워", "물고기 먹고 싶다"],
  tiger:   ["어흥!", "내가 리더다", "무섭지? 무섭지?", "정글의 법칙", "자신감 충만"],
  lion:    ["크아아", "왕의 귀환", "갈기 자랑 중", "위엄 있게", "내가 왕이다"],
  alpaca:  ["뽀글뽀글~", "따뜻해", "털 깎지 마", "순한 맛", "힐링 중~"],
  fox:     ["히히", "꾀를 내볼까", "영리하게 가자", "몰래몰래", "비밀이야"],
  hamster: ["볼에 저장!", "쳇바퀴 돌려야지", "해바라기씨!", "작지만 강해", "바쁘다 바빠"],
  owl:     ["부엉", "밤이 좋아", "지혜롭게", "다 보인다", "현명한 선택이야"],
  panda:   ["대나무 줘", "구르기~", "먹고 자고 먹고", "흑백이 최고야", "귀찮아..."],
};

const QUIPS = {
  working: [
    "열심히 하는 중...", "코드 쓰는 중~", "거의 다 됐어",
    "생각 중...", "리팩토링!", "문서 읽는 중",
    "집중 모드", "잠깐만요", "이거 재밌다",
  ],
  waiting: [
    "다 했어!", "확인해줘~", "끝!",
    "쉬는 시간?", "커피 한잔?", "기다리는 중",
    "할 일 없나?", "심심해~",
  ],
  notification: [
    "여기 봐!", "확인해줘!", "중요한 거야!",
    "알림 왔다", "봐봐!", "입력 필요!",
  ],
  stale: [
    "zzz", "zzZZZ", "쿨쿨",
    "자는 중...", "5분만 더...", "꿈나라",
  ],
};

const CONTEXT_QUIPS = [
  { cond: (s, all) => all.length >= 6, msgs: ["북적북적!", "오늘 만원이네", "우리 많다!", "파티다~"] },
  { cond: (s, all) => all.length >= 4, msgs: ["바쁜 하루네", "팀워크!", "총출동!"] },
  { cond: (s, all) => all.length === 1, msgs: ["나 혼자야...", "외로워", "조용한 하루", "혼자서도 잘해!"] },
  { cond: (s, all) => all.every(x => x._ds !== "working"), msgs: ["다들 쉬는 중?", "너무 조용해...", "거기 누구 없어?", "인간 어디 갔어?"] },
  { cond: (s, all) => all.filter(x => x._ds === "working").length >= 3, msgs: ["다들 열일 중!", "생산적인 하루!", "팀워크 짱!", "가보자고!"] },
  { cond: (s) => s.teams && s.teams.length > 0, msgs: ["팀 결성!", "어벤져스 어셈블", "에이전트 출동!", "임무 시작!"] },
  { cond: (s) => { const age = s.updated ? (Date.now() - new Date(s.updated.replace(" ","T")).getTime()) / 60000 : 0; return age > 30; }, msgs: ["아직 여기 있는데...", "오래됐다", "나 잊은 거야?", "*발 동동*", "기다릴게..."] },
  { cond: () => new Date().getHours() >= 22, msgs: ["야근이야?", "자야지!", "불꺼!", "졸려...", "내일 하면 안돼?"] },
  { cond: () => new Date().getHours() < 7, msgs: ["일찍 일어났네!", "좋은 아침~", "커피부터!", "해도 안 떴는데?"] },
  { cond: () => [0, 6].includes(new Date().getDay()), msgs: ["주말에도 코딩?", "쉬엄쉬엄", "취미 프로젝트?", "워라밸!"] },
  { cond: (s, all) => all.filter(x => x._ds === "stale").length >= 2, msgs: ["뭔가 이상해...", "인터넷 끊겼나?", "연결 확인해봐", "API 죽었나?", "토큰 만료된 거 아냐?"] },
  { cond: (s) => s._ds === "stale", msgs: ["나 얼었나?", "멈췄어...", "도와줘 멈췄어", "재시작 필요?"] },
  { cond: (s, all) => all.some(x => x._ds === "working") && all.some(x => x._ds === "waiting"), msgs: ["누구는 일하고 누구는 놀고", "불균형이야", "놀고 있는 손이 보여"] },
  { cond: (s) => s.sessionName && s.sessionName.length > 0, msgs: ["이름 멋지다!", "내 이름 마음에 들어", "나야 나!"] },
  { cond: (s, all) => all.filter(x => x.project === s.project).length >= 2, msgs: ["같은 프로젝트 친구!", "우리 파트너야", "협업 중~"] },
  { cond: () => { const h = new Date().getHours(); return h >= 11 && h < 13; }, msgs: ["점심시간!", "배고파...", "피자 먹자", "밥줘~"] },
  { cond: () => new Date().getDay() === 5, msgs: ["불금!", "주말 곧이다!", "금요일 바이브~", "거의 다 왔어!"] },
  { cond: () => new Date().getDay() === 1, msgs: ["월요일...", "월요병", "다시 시작이야", "새로운 한 주!"] },
  { cond: (s) => s.subagents && s.subagents.filter(a => a.status === "running").length >= 2, msgs: ["에이전트 소환!", "위임 모드!", "도우미가 있어!", "멀티태스킹!"] },
  { cond: (s) => s._ds === "working", msgs: ["방해하지 마~", "몰입 중!", "플로우 상태!", "집중!"] },
  { cond: () => { const h = new Date().getHours(); return h >= 15 && h < 16; }, msgs: ["오후 슬럼프", "간식 필요", "차 한잔?", "3시의 벽..."] },
  { cond: () => { const h = new Date().getHours(); return h >= 18 && h < 19; }, msgs: ["저녁시간!", "마무리?", "퇴근이다!", "야근?"] },
];

const petState = new Map();

function createPetElement(session) {
  const existing = document.getElementById("pet-" + session.session);
  if (existing) return existing;

  const pet = document.createElement("div");
  pet.id = "pet-" + session.session;
  pet.className = "pet idle";

  const cls = session._ds || session.status || "waiting";
  const charIdx = Math.floor(Math.random() * 12);

  pet.innerHTML = '<div class="pet-shadow"></div>' +
    '<div class="pet-bubble" id="bubble-' + session.session + '"></div>' +
    mascot(cls, session.session).replace('class="mascot', 'data-char-idx="' + charIdx + '" class="mascot pet-mascot');

  const startX = Math.random() * (window.innerWidth - 80) + 20;
  const startY = Math.floor(Math.random() * 60) + 10;
  pet.style.left = startX + "px";
  pet.style.bottom = startY + "px";

  pet.style.opacity = "0";
  document.getElementById("pet-layer").appendChild(pet);

  petState.set(session.session, {
    x: startX, y: startY, targetX: startX,
    direction: 1, idleTimer: 0, quipTimer: 0,
    status: cls, visible: false, spawnDelay: Math.floor(Math.random() * 30) + 10, _index: petState.size,
  });

  return pet;
}

function spawnRoamingPet(layer, maxX) {
  const petId = "roaming-" + Date.now();
  const pet = document.createElement("div");
  pet.id = petId;
  pet.className = "pet idle";
  pet.style.pointerEvents = "auto";
  pet.style.cursor = "pointer";

  const charIdx = Math.floor(Math.random() * 12);
  pet.innerHTML = '<div class="pet-shadow"></div>' +
    '<div class="pet-bubble" id="bubble-' + petId + '"></div>' +
    mascot("waiting", petId, charIdx).replace('class="mascot', 'data-char-idx="' + charIdx + '" class="mascot pet-mascot');

  const startX = Math.random() * (maxX - 40) + 20;
  pet.style.left = startX + "px";
  pet.style.bottom = (Math.floor(Math.random() * (window.innerHeight - 80)) + 20) + "px";
  pet.style.opacity = "0";
  pet.style.transition = "opacity 1s ease, left 4s linear";
  layer.appendChild(pet);
  requestAnimationFrame(() => { pet.style.opacity = "1"; });

  const lifetime = (15 + Math.random() * 25) * 1000;
  setTimeout(() => {
    pet.style.opacity = "0";
    setTimeout(() => pet.remove(), 1200);
    // Ensure at least 1 pet remains - respawn
    setTimeout(() => {
      const remaining = layer.querySelectorAll(".pet");
      if ([...remaining].filter(p => p.style.opacity !== "0").length === 0) {
        spawnRoamingPet(layer, window.innerWidth - 60);
      }
    }, 1500);
  }, lifetime);

  pet._state = { x: startX, idleTimer: 0, quipTimer: 0, charIdx };
}

function movePets(sessions) {
  const layer = document.getElementById("pet-layer");
  if (!layer) return;
  const maxX = window.innerWidth - 60;

  // Max pets on screen based on situation
  const workingCount = sessions.filter(x => (x._ds || x.status) === "working").length;
  const hasTeam = sessions.some(x => x.teams && x.teams.length > 0);
  const maxPets = 99; // no hard limit

  // Count current visible pets
  const currentPets = layer.querySelectorAll(".pet");
  const visiblePets = [...currentPets].filter(p => p.style.opacity !== "0");

  // Spawn first pet immediately if none exist
  if (currentPets.length === 0) {
    spawnRoamingPet(layer, maxX);
  }
  // Pets despawn naturally via lifetime timeout

  // Occasionally spawn another pet
  if (currentPets.length > 0 && currentPets.length < 5 && Math.random() < 0.06) {
    spawnRoamingPet(layer, maxX);
  }

  // Animate existing pets
  currentPets.forEach(pet => {
    if (pet.style.opacity === "0") return;
    if (!pet._state) pet._state = { x: parseFloat(pet.style.left) || 100, idleTimer: 0, quipTimer: 0, charIdx: 0 };
    const st = pet._state;

    // Walk
    st.idleTimer++;
    if (st.idleTimer > (5 + Math.random() * 8)) {
      st.idleTimer = 0;
      if (Math.random() > 0.3) {
        const longWalk = Math.random() > 0.6;
        const dist = longWalk
          ? (Math.random() * 400 + 150) * (Math.random() > 0.5 ? 1 : -1)
          : (Math.random() * 120 + 30) * (Math.random() > 0.5 ? 1 : -1);
        const newX = Math.max(-20, Math.min(maxX + 20, st.x + dist));
        const dir = newX > st.x ? 1 : -1;
        const walkTime = longWalk ? 5000 : 3000;

        const newY = Math.max(10, Math.min(window.innerHeight - 80, (parseFloat(pet.style.bottom) || 20) + (Math.random() - 0.5) * 60));
        pet.style.transition = "left " + (walkTime/1000) + "s linear, bottom " + (walkTime/1000) + "s ease, opacity 1s ease";
        pet.style.bottom = newY + "px";
        pet.classList.remove("idle");
        pet.classList.add("walk");
        pet.classList.toggle("flip", dir < 0);
        pet.style.left = newX + "px";
        st.x = newX;

        setTimeout(() => {
          pet.classList.remove("walk");
          pet.classList.add("idle");
          if (st.x < 0 || st.x > maxX) {
            st.x = st.x < 0 ? maxX : 20;
            pet.style.transition = "none";
            pet.style.left = st.x + "px";
          }
        }, walkTime);
      }
    }

    // Quips
    st.quipTimer++;
    if (st.quipTimer > (20 + Math.random() * 40)) {
      st.quipTimer = 0;
      if (Math.random() > 0.4) return;

      const bubbleId = pet.id ? "bubble-" + pet.id : null;
      const bubble = bubbleId ? document.getElementById(bubbleId) : null;
      if (!bubble) return;

      let quip = "";
      // Context quip
      if (Math.random() < 0.4 && sessions.length > 0) {
        const s = sessions[Math.floor(Math.random() * sessions.length)];
        const matching = CONTEXT_QUIPS.filter(q => { try { return q.cond(s, sessions); } catch { return false; } });
        if (matching.length > 0) {
          const pick = matching[Math.floor(Math.random() * matching.length)];
          quip = pick.msgs[Math.floor(Math.random() * pick.msgs.length)];
        }
      }
      // Character quip
      if (!quip) {
        const ci = st.charIdx || 0;
        const p = PERSONALITY[ci] || PERSONALITY[0];
        if (CHAR_QUIPS[p.name]) {
          const cq = CHAR_QUIPS[p.name];
          quip = cq[Math.floor(Math.random() * cq.length)];
        }
      }
      if (!quip) quip = "...";

      bubble.textContent = quip;
      bubble.classList.add("show");
      setTimeout(() => bubble.classList.remove("show"), 3000);
    }
  });
}
// Pet movement integrated into main poll



// ── Mascot Picker ──
const CHAR_NAMES = ["고양이","강아지","토끼","곰","펭귄","호랑이","사자","알파카","여우","햄스터","부엉이","판다"];
let pickerSessionId = null;
let pickerSelected = null;

function getMascotPrefs() {
  try { return JSON.parse(localStorage.getItem("claude-paws-mascots") || "{}"); } catch { return {}; }
}
function saveMascotPref(sid, charIdx) {
  const prefs = getMascotPrefs();
  if (charIdx === null) delete prefs[sid];
  else prefs[sid] = charIdx;
  localStorage.setItem("claude-paws-mascots", JSON.stringify(prefs));
}
function getGlobalMascot() {
  return JSON.parse(localStorage.getItem("claude-paws-global") || "null");
}
function setGlobalMascot(idx) {
  if (idx === null) localStorage.removeItem("claude-paws-global");
  else localStorage.setItem("claude-paws-global", JSON.stringify(idx));
}
function getCharIdx(sid) {
  const global = getGlobalMascot();
  if (global !== null) return global;
  const prefs = getMascotPrefs();
  if (prefs[sid] !== undefined) return prefs[sid];
  const hash = (sid || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 12;
}

function openPicker(sid) {
  pickerSessionId = sid;
  pickerSelected = getCharIdx(sid);
  const grid = document.getElementById("picker-grid");
  grid.innerHTML = CHAR_NAMES.map((name, i) => {
    const m = mascot("waiting", "picker-" + i, i);
    return '<div class="picker-item' + (i === pickerSelected ? ' selected' : '') + '" data-idx="' + i + '">' +
      m + '<span class="picker-name">' + name + '</span></div>';
  }).join("");

  grid.querySelectorAll(".picker-item").forEach(item => {
    item.onclick = () => {
      grid.querySelectorAll(".picker-item").forEach(x => x.classList.remove("selected"));
      item.classList.add("selected");
      pickerSelected = parseInt(item.dataset.idx);
    };
  });

  document.getElementById("picker-title-text").textContent = "세션 캐릭터 선택";
  document.getElementById("mascot-picker").classList.add("open");
}

document.getElementById("picker-cancel").onclick = () => {
  document.getElementById("mascot-picker").classList.remove("open");
};
document.getElementById("picker-confirm").onclick = () => {
  if (pickerSessionId === "__global__") {
    setGlobalMascot(pickerSelected);
  } else if (pickerSessionId !== null && pickerSelected !== null) {
    saveMascotPref(pickerSessionId, pickerSelected);
  }
  prevHash = "";
  poll();
  document.getElementById("mascot-picker").classList.remove("open");
};
document.getElementById("picker-reset").onclick = () => {
  if (pickerSessionId === "__global__") {
    setGlobalMascot(null);
  } else if (pickerSessionId !== null) {
    saveMascotPref(pickerSessionId, null);
  }
  prevHash = "";
  poll();
  document.getElementById("mascot-picker").classList.remove("open");
};

// Global mascot picker
document.getElementById("myCharBtn").onclick = () => {
  pickerSessionId = "__global__";
  pickerSelected = getGlobalMascot();
  const grid = document.getElementById("picker-grid");
  grid.innerHTML = CHAR_NAMES.map((name, i) => {
    const m = mascot("waiting", "picker-" + i, i);
    return '<div class="picker-item' + (i === pickerSelected ? ' selected' : '') + '" data-idx="' + i + '">' +
      m + '<span class="picker-name">' + name + '</span></div>';
  }).join("");
  grid.querySelectorAll(".picker-item").forEach(item => {
    item.onclick = () => {
      grid.querySelectorAll(".picker-item").forEach(x => x.classList.remove("selected"));
      item.classList.add("selected");
      pickerSelected = parseInt(item.dataset.idx);
    };
  });
  document.getElementById("picker-title-text").textContent = "대표 캐릭터 선택";
  document.getElementById("mascot-picker").classList.add("open");
};

// Open picker on mascot click in cards
document.getElementById("board").addEventListener("click", e => {
  const mascotEl = e.target.closest(".mascot");
  if (mascotEl && !editing) {
    e.stopPropagation();
    const card = mascotEl.closest(".card");
    if (card) openPicker(card.dataset.sid);
  }
});

// Click walking pet to walk + show bubble
document.getElementById("pet-layer").addEventListener("click", e => {
  const pet = e.target.closest(".pet");
  if (!pet) return;
  const maxX = window.innerWidth - 60;
  const st = pet._state || { x: parseFloat(pet.style.left) || 100, charIdx: 0 };

  // Make it walk on click
  const dist = (Math.random() * 250 + 80) * (Math.random() > 0.5 ? 1 : -1);
  const newX = Math.max(20, Math.min(maxX, st.x + dist));
  const dir = newX > st.x ? 1 : -1;
  pet.style.transition = "left 3s linear, opacity 1s ease";
  pet.classList.remove("idle");
  pet.classList.add("walk");
  pet.classList.toggle("flip", dir < 0);
  pet.style.left = newX + "px";
  st.x = newX;
  setTimeout(() => { pet.classList.remove("walk"); pet.classList.add("idle"); }, 3000);

  // Show bubble
  const bubble = document.getElementById("bubble-" + pet.id);
  if (!bubble) return;

  const ci = st.charIdx || 0;
  const personality = PERSONALITY[ci] || PERSONALITY[0];
  let quip = "";
  if (CHAR_QUIPS[personality.name]) {
    const cq = CHAR_QUIPS[personality.name];
    quip = cq[Math.floor(Math.random() * cq.length)];
  }
  if (!quip) quip = "안녕!";

  bubble.textContent = quip;
  bubble.classList.add("show");
  setTimeout(() => bubble.classList.remove("show"), 3000);
});

// ── Toast Notifications ──
let prevStates = {};
function removeToastArrow(sid) {
  const arrow = document.getElementById("arrow-" + sid);
  if (arrow) arrow.remove();
  const card = document.querySelector('[data-sid="' + sid + '"]');
  if (card) card.classList.remove("toast-highlight");
  // Remove dismiss-all if no toasts left
  const container = document.getElementById("toast-container");
  if (container && !container.querySelector(".toast")) {
    const btn = container.querySelector(".toast-dismiss-all");
    if (btn) btn.remove();
  }
}
function updateArrows() {
  const svg = document.getElementById("toast-arrows");
  if (!svg) return;
  const toasts = document.querySelectorAll(".toast[data-sid]");
  toasts.forEach(toast => {
    const sid = toast.dataset.sid;
    const card = document.querySelector('[data-sid="' + sid + '"]');
    const arrow = document.getElementById("arrow-" + sid);
    if (!card || !arrow) return;
    const tRect = toast.getBoundingClientRect();
    const cRect = card.getBoundingClientRect();
    const tx = tRect.left;
    const ty = tRect.top + tRect.height / 2;
    const cx = cRect.right;
    const cy = cRect.top + cRect.height / 2;
    const mx = (tx + cx) / 2;
    arrow.setAttribute("d", "M" + tx + "," + ty + " C" + mx + "," + ty + " " + mx + "," + cy + " " + cx + "," + cy);
  });
}
function dismissAllToasts() {
  const container = document.getElementById("toast-container");
  if (!container) return;
  container.querySelectorAll(".toast[data-sid]").forEach(t => {
    removeToastArrow(t.dataset.sid);
    t.remove();
  });
  const btn = container.querySelector(".toast-dismiss-all");
  if (btn) btn.remove();
}
function showToast(project, status, message, sid) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const label = status === "waiting" ? "작업 완료" : status?.startsWith("notification") ? "알림" : "종료";
  const cls = status === "waiting" ? "waiting" : status?.startsWith("notification") ? "notification" : "stale";
  const charIdx = (typeof getCharIdx === "function" && sid) ? getCharIdx(sid) : 0;
  const m = mascot(cls, sid, charIdx);
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.sid = sid;
  const mascotDiv = document.createElement("div");
  mascotDiv.className = "toast-mascot";
  mascotDiv.innerHTML = m;
  const contentDiv = document.createElement("div");
  contentDiv.className = "toast-content";
  var now = new Date();
  var timeStr = String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0");
  contentDiv.innerHTML = '<div class="toast-title">' + esc(project) + ' — ' + label + '<span style="float:right;font-size:11px;font-weight:400;color:var(--gray-400)">' + timeStr + '</span></div>' + (message ? '<div class="toast-msg">' + esc(cut(message, 80)) + '</div>' : '');
  const closeBtn = document.createElement("button");
  closeBtn.className = "toast-close";
  closeBtn.innerHTML = "\u00d7";
  closeBtn.onclick = () => { removeToastArrow(sid); toast.remove(); };
  toast.appendChild(mascotDiv);
  toast.appendChild(contentDiv);
  toast.appendChild(closeBtn);
  // Ensure dismiss button exists and toast goes before it
  let dismissBtn = container.querySelector(".toast-dismiss-all");
  if (!dismissBtn) {
    dismissBtn = document.createElement("button");
    dismissBtn.className = "toast-dismiss-all";
    dismissBtn.textContent = "모두 닫기";
    dismissBtn.onclick = dismissAllToasts;
    container.appendChild(dismissBtn);
  }
  toast.addEventListener("click", (e) => {
    if (e.target.closest(".toast-close")) return; // let X button handle itself
    fetch("/api/session/" + sid + "/focus", { method: "POST" }).catch(() => {});
    removeToastArrow(sid);
    toast.remove();
  });
  container.insertBefore(toast, dismissBtn);
  // Highlight card + draw arrow
  const card = document.querySelector('[data-sid="' + sid + '"]');
  if (card) {
    card.classList.add("toast-highlight");
    const svg = document.getElementById("toast-arrows");
    if (svg) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.id = "arrow-" + sid;
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#3182f6");
      path.setAttribute("stroke-width", "2.5");
      path.setAttribute("stroke-dasharray", "8 4");
      path.setAttribute("opacity", "0.8");
      svg.appendChild(path);
      requestAnimationFrame(updateArrows);
    }
  }
}
setInterval(updateArrows, 500);
function checkStateChanges(sessions) {
  sessions.forEach(s => {
    const key = s.session;
    const prev = prevStates[key];
    const curr = s.status;
    if (prev && prev !== curr) {
      if (curr === "waiting" && prev === "working") {
        showToast(s.sessionName || s.project, "waiting", s.lastResponse, s.session);
      } else if (curr?.startsWith("notification")) {
        showToast(s.sessionName || s.project, curr, s.message, s.session);
      }
    }
    prevStates[key] = curr;
  });
  // Clean up ended sessions
  const activeIds = new Set(sessions.map(s => s.session));
  Object.keys(prevStates).forEach(k => {
    if (!activeIds.has(k)) delete prevStates[k];
  });
}

// ── macOS Notification Settings ──
async function loadNotiSetting() {
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    const btn = document.getElementById("notiToggle");
    if (btn) btn.classList.toggle("off", data.macosNotifications === false);
  } catch {}
}
document.getElementById("notiToggle")?.addEventListener("click", async () => {
  const btn = document.getElementById("notiToggle");
  const isOff = !btn.classList.contains("off");
  btn.classList.toggle("off", isOff);
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ macosNotifications: !isOff })
  });
});
loadNotiSetting();

</script>
<svg class="toast-arrow-layer" id="toast-arrows"></svg>
<div class="toast-container" id="toast-container"></div>
</body>
</html>`;

async function getSessionDetail(sessionId) {
  try {
    const sessionFile = join(ACTIVE_DIR, `${sessionId}.json`);
    const raw = await readFile(sessionFile, "utf8");
    const session = JSON.parse(raw);
    const entries = [];

    if (session.transcript) {
      try {
        const transcript = await readFile(session.transcript, "utf8");
        const lines = transcript.trim().split("\n");
        // Parse last 80 lines for relevant entries
        const recent = lines.slice(-80);
        for (const line of recent) {
          try {
            const entry = JSON.parse(line);
            const t = entry.type;
            // Filter interesting events
            if (t === "assistant" && entry.message?.content) {
              const text = entry.message.content
                .filter(c => c.type === "text")
                .map(c => c.text)
                .join("")
                .replace(/\n/g, " ")
                .slice(0, 150);
              if (text) entries.push({ type: "message", text, ts: entry.timestamp });
            } else if (t === "tool_use" || (t === "assistant" && entry.message?.content?.some(c => c.type === "tool_use"))) {
              const tools = (entry.message?.content || [entry]).filter(c => c.type === "tool_use");
              for (const tool of tools) {
                entries.push({
                  type: "tool",
                  name: tool.name || "unknown",
                  input: JSON.stringify(tool.input || {}).slice(0, 100),
                  ts: entry.timestamp
                });
              }
            } else if (t === "agent-name") {
              entries.push({ type: "rename", name: entry.agentName, ts: entry.timestamp });
            } else if (t === "progress" && entry.data?.type === "hook_progress") {
              // skip hook noise
            } else if (t === "progress" && entry.data?.content) {
              entries.push({
                type: "progress",
                text: String(entry.data.content).slice(0, 100),
                ts: entry.timestamp
              });
            } else if (entry.subagentId || t === "subagent") {
              entries.push({
                type: "subagent",
                name: entry.agentName || entry.data?.agentName || "agent",
                status: entry.data?.status || t,
                ts: entry.timestamp
              });
            }
          } catch {}
        }
      } catch {}
    }

    return { ...session, entries: entries.slice(-30) };
  } catch {
    return null;
  }
}

async function getTeamInfo(sessionId) {
  try {
    const sessionFile = join(ACTIVE_DIR, `${sessionId}.json`);
    const raw = await readFile(sessionFile, "utf8");
    const session = JSON.parse(raw);

    const teamsDir = join(homedir(), ".claude", "teams");
    let teamConfig = null;
    let teamName = null;

    if (session.teams && session.teams.length > 0) {
      teamName = session.teams[0].name;
    }

    try {
      const teamDirs = await readdir(teamsDir);
      for (const dir of teamDirs) {
        const configPath = join(teamsDir, dir, "config.json");
        try {
          const configRaw = await readFile(configPath, "utf8");
          const config = JSON.parse(configRaw);
          if (config.leadSessionId === sessionId || config.name === teamName) {
            teamConfig = config;
            teamName = config.name;
            break;
          }
        } catch {}
      }
    } catch {}

    if (!teamConfig) return null;

    const tasksDir = join(homedir(), ".claude", "tasks", teamName);
    const tasks = [];
    try {
      const taskFiles = await readdir(tasksDir);
      for (const tf of taskFiles) {
        if (!tf.endsWith(".json")) continue;
        try {
          const taskRaw = await readFile(join(tasksDir, tf), "utf8");
          const task = JSON.parse(taskRaw);
          if (task.id && task.subject) {
            tasks.push({ id: task.id, subject: task.subject, status: task.status || "pending", owner: task.owner || "" });
          }
        } catch {}
      }
    } catch {}

    const members = (teamConfig.members || []).map(m => {
      const subagent = (session.subagents || []).find(s => s.name === m.name);
      return {
        name: m.name,
        role: m.agentType || m.role || "worker",
        model: m.model || "",
        status: subagent ? subagent.status : (m.name === "team-lead" ? "running" : "unknown"),
      };
    });

    return { teamName, description: teamConfig.description || "", members, tasks: tasks.sort((a, b) => parseInt(a.id) - parseInt(b.id)) };
  } catch { return null; }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/api/sessions") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(await getSessions()));
  } else if (url.pathname.match(/^\/api\/session\/[^/]+\/team$/)) {
    const parts = url.pathname.split("/");
    const sid = parts[3];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sid)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid session id" }));
    } else {
      const team = await getTeamInfo(sid);
      res.writeHead(team ? 200 : 404, { "Content-Type": "application/json" });
      res.end(JSON.stringify(team || { error: "no team" }));
    }
  } else if (url.pathname.match(/^\/api\/session\/[^/]+\/focus$/) && req.method === "POST") {
    const sid = url.pathname.split("/")[3];
    if (!sid || sid.includes("..") || sid.includes("/")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid session id" }));
    } else {
      try {
        const sessionFile = join(ACTIVE_DIR, `${sid}.json`);
        const raw = await readFile(sessionFile, "utf8");
        const session = JSON.parse(raw);
        if (!session.tty) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "no tty info" }));
          return;
        }
        const tty = session.tty;
        const cwd = session.cwd || "";

        // Detect which terminal app owns this TTY by walking up process tree
        let termApp = "";
        try {
          const shellPids = execSync(`lsof -t ${tty} 2>/dev/null`).toString().trim().split("\n").filter(Boolean);
          const shellPid = shellPids[0]; // first process (usually the shell)
          if (shellPid) {
            let pid = shellPid;
            for (let i = 0; i < 10; i++) {
              try {
                const ppid = execSync(`ps -o ppid= -p ${pid} 2>/dev/null`).toString().trim();
                if (!ppid || ppid === "0" || ppid === "1") break;
                const comm = execSync(`ps -o comm= -p ${ppid} 2>/dev/null`).toString().trim();
                if (comm.includes("Warp")) { termApp = "Warp"; break; }
                if (comm.includes("iTerm2") || comm.includes("iTermServer")) { termApp = "iTerm2"; break; }
                if (comm.includes("Terminal.app") || comm.endsWith("/Terminal")) { termApp = "Terminal"; break; }
                if (comm.includes("WebStorm") || comm.includes("webstorm")) { termApp = "WebStorm"; break; }
                if (comm.includes("IntelliJ") || comm.includes("idea")) { termApp = "IntelliJ IDEA"; break; }
                if (comm.includes("PyCharm") || comm.includes("pycharm")) { termApp = "PyCharm"; break; }
                if (comm.includes("Cursor")) { termApp = "Cursor"; break; }
                if (comm.includes("Visual Studio Code") || comm.endsWith("/code")) { termApp = "Visual Studio Code"; break; }
                if (comm.includes("Antigravity") || comm.includes("antigravity")) { termApp = "Antigravity"; break; }
                pid = ppid;
              } catch { break; }
            }
          }
        } catch {}

        // Use open -a for Space switching, then AppleScript for tab-specific switching
        try { writeFileSync(tty, "\x07"); } catch {} // bell to highlight tab
        let result = "found";

        if (termApp === "iTerm2") {
          // iTerm2: open -a for Space switch + AppleScript for exact tab switch
          execSync('open -a "iTerm"', { timeout: 3000 });
          const script = [
            'tell application "iTerm2"',
            '  repeat with aWindow in windows',
            '    repeat with aTab in tabs of aWindow',
            '      repeat with aSession in sessions of aTab',
            '        if tty of aSession is "' + tty + '" then',
            '          select aTab',
            '          tell aWindow to select',
            '          return "found"',
            '        end if',
            '      end repeat',
            '    end repeat',
            '  end repeat',
            'end tell',
            'return "not_found"',
          ].join("\n");
          const scriptPath = join(tmpdir(), `paws-focus-${Date.now()}.scpt`);
          writeFileSync(scriptPath, script);
          try { result = execSync(`osascript "${scriptPath}"`, { timeout: 5000 }).toString().trim(); }
          finally { try { unlinkSync(scriptPath); } catch {} }
        } else if (termApp === "Terminal") {
          // Terminal.app: open -a for Space switch + AppleScript for tab switch
          execSync('open -a "Terminal"', { timeout: 3000 });
          const script = [
            'tell application "Terminal"',
            '  repeat with aWindow in windows',
            '    repeat with aTab in tabs of aWindow',
            '      if tty of aTab is "' + tty + '" then',
            '        set selected tab of aWindow to aTab',
            '        set frontmost of aWindow to true',
            '        return "found"',
            '      end if',
            '    end repeat',
            '  end repeat',
            'end tell',
            'return "not_found"',
          ].join("\n");
          const scriptPath = join(tmpdir(), `paws-focus-${Date.now()}.scpt`);
          writeFileSync(scriptPath, script);
          try { result = execSync(`osascript "${scriptPath}"`, { timeout: 5000 }).toString().trim(); }
          finally { try { unlinkSync(scriptPath); } catch {} }
        } else if (termApp) {
          // All other apps (Warp, IDEs): open -a switches Space and activates
          execSync(`open -a "${termApp}"`, { timeout: 3000 });
        } else {
          result = "not_found";
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: result === "found", result, termApp }));
      } catch(e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    }
  } else if (url.pathname.match(/^\/api\/session\/[^/]+$/) && req.method === "DELETE") {
    const sid = url.pathname.split("/")[3];
    if (!sid || sid.includes("..")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid session id" }));
    } else {
      try {
        const sessionFile = join(ACTIVE_DIR, `${sid}.json`);
        rmSync(sessionFile, { force: true });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    }
  } else if (url.pathname.startsWith("/api/session/")) {
    const sid = url.pathname.split("/").pop();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sid)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid session id" }));
    } else {
      const detail = await getSessionDetail(sid);
      res.writeHead(detail ? 200 : 404, { "Content-Type": "application/json" });
      res.end(JSON.stringify(detail || { error: "not found" }));
    }
  } else if (url.pathname === "/api/settings") {
    const settingsPath = join(ACTIVE_DIR, "..", "settings.json");
    if (req.method === "GET") {
      try {
        const data = JSON.parse(await readFile(settingsPath, "utf-8"));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      } catch {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ macosNotifications: true }));
      }
    } else if (req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        let existing = {};
        try { existing = JSON.parse(await readFile(settingsPath, "utf-8")); } catch {}
        const patch = JSON.parse(body);
        const merged = { ...existing, ...patch };
        const { writeFileSync } = await import("node:fs");
        writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(merged));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    }
  } else {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`  Paw Sessions`);
  console.log(`  http://localhost:${PORT}`);
});

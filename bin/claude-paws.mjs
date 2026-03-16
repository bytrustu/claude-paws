#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const command = args[0];

function printBanner() {
  console.log("");
  console.log("  \u{1F43E} paws v0.2.7");
  console.log("  Session dashboard for Claude Code");
  console.log("");
}

function printHelp() {
  printBanner();
  console.log("  Usage:");
  console.log("    paws               Start the dashboard server");
  console.log("    paws setup         Install hooks into Claude Code");
  console.log("    paws status        Check if hooks are installed");
  console.log("    paws help          Show this help message");
  console.log("");
  console.log("  Options:");
  console.log("    --port, -p <port>    Port number (default: 3200)");
  console.log("    --no-open            Don't open browser automatically");
  console.log("");
}

if (command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "setup") {
  const setupPath = join(__dirname, "..", "scripts", "postinstall.mjs");  
  const mod = await import(setupPath); mod.default();
  process.exit(0);
}

if (command === "status") {
  const mod = await import(join(__dirname, "..", "scripts", "postinstall.mjs")); mod.checkStatus();
  process.exit(0);
}

// Default: start server
const port = args.includes("--port") || args.includes("-p")
  ? args[args.indexOf(args.includes("--port") ? "--port" : "-p") + 1]
  : process.env.PORT || "3200";

const noOpen = args.includes("--no-open");

process.env.PORT = port;

printBanner();

const serverPath = join(__dirname, "..", "lib", "server.mjs");
await import(serverPath);

if (!noOpen) {
  setTimeout(() => {
    try {
      const cmd = process.platform === "darwin" ? "open"
        : process.platform === "win32" ? "start"
        : "xdg-open";
      execSync(`${cmd} http://localhost:${port}`, { stdio: "ignore" });
    } catch {}
  }, 1000);
}

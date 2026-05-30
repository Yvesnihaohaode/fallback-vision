#!/usr/bin/env node
// ============================================================================
// Fallback Vision CLI — startup with daemon support
//
// Hook management:
//   - On start:  disable Qwen vision hook (proxy handles vision via MiMo)
//   - On stop:   restore Qwen hook (cc-switch mode)
// ============================================================================

import { loadConfig } from "./config/loader.js";
import { startServer } from "./server.js";
import { setVerbose, log } from "./util/logger.js";
import { writeFileSync, existsSync, readFileSync, unlinkSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const FV_DIR = join(homedir(), ".fallback-vision");
const PID_FILE = join(FV_DIR, "server.pid");
const HOOK_FILE = join(homedir(), ".claude", "hooks", "describe-image.py");
const HOOK_DISABLED = HOOK_FILE + ".disabled";


const args = process.argv.slice(2);
const parsed = {
  port: undefined as number | undefined,
  host: undefined as string | undefined,
  verbose: false,
  daemon: false,
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--port" || a === "-p") {
    parsed.port = Number(args[++i]);
  } else if (a === "--host") {
    parsed.host = args[++i];
  } else if (a === "--verbose" || a === "-v") {
    parsed.verbose = true;
  } else if (a === "--daemon" || a === "-d") {
    parsed.daemon = true;
  } else if (a === "--help" || a === "-h") {
    console.log(`
fallback-vision — AI Gateway with Visual Fallback

Usage:
  fallback-vision [options]

Options:
  --port, -p <port>    Listen port (default: 8789)
  --host <host>        Listen host (default: 127.0.0.1)
  --daemon, -d         Run as background daemon with PID file
  --verbose, -v        Enable debug logging
  --help, -h           Show this help
`);
    process.exit(0);
  }
}

setVerbose(parsed.verbose);

// ── Global error handlers (prevent silent crashes) ──
process.on("uncaughtException", (err) => {
  log.error("uncaughtException — server will NOT crash", { error: err.message, stack: err.stack?.split("\n").slice(0, 3).join(" | ") });
});
process.on("unhandledRejection", (reason) => {
  log.error("unhandledRejection — server will NOT crash", { reason: String(reason) });
});

// ── Hook management ──
function disableHook() {
  if (existsSync(HOOK_FILE) && !existsSync(HOOK_DISABLED)) {
    renameSync(HOOK_FILE, HOOK_DISABLED);
    log.info("Qwen vision hook disabled (using MiMo native fallback)");
  }
}

function restoreHook() {
  if (existsSync(HOOK_DISABLED) && !existsSync(HOOK_FILE)) {
    renameSync(HOOK_DISABLED, HOOK_FILE);
    log.info("Qwen vision hook restored (cc-switch mode)");
  }
}

// ── PID file management ──
function writePid() {
  if (!existsSync(FV_DIR)) mkdirSync(FV_DIR, { recursive: true });
  writeFileSync(PID_FILE, String(process.pid));
}

function cleanupPid() {
  try { if (existsSync(PID_FILE)) unlinkSync(PID_FILE); } catch {}
}

function shutdown() {
  log.info("Shutting down...");
  restoreHook();
  cleanupPid();
}

// ── Main ──
disableHook();

const cfg = loadConfig(parsed);
const server = startServer(cfg);

writePid();

process.on("exit", shutdown);
process.on("SIGINT", () => { shutdown(); process.exit(0); });
process.on("SIGTERM", () => { shutdown(); process.exit(0); });

const providers = cfg.registry.available();
log.info(`fallback-vision v${cfg.version} listening on ${cfg.host}:${cfg.port}`);
log.info(`registered providers: ${providers.map((p) => p.config.id).join(", ") || "(none)"}`);
log.info(`routing strategy: ${cfg.routingStrategy}`);
log.info(`dashboard: http://${cfg.host}:${cfg.port}/`);

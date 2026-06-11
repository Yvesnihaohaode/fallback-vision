import type { IncomingMessage, ServerResponse } from "node:http";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GatewayConfig } from "../config/loader.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import { sendIndex } from "./pages/index.js";
import { log, getRecentLogs } from "../util/logger.js";
import { getMetrics } from "../util/metrics.js";
import { getTokenStats } from "../util/token-stats.js";

const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const FV_DIR = join(homedir(), ".fallback-vision");
const RESTART_FLAG = join(FV_DIR, ".restart");

/**
 * Dashboard saves FV settings and triggers restart.
 *
 * "Save & Restart" flow:
 *   1. Save FV settings to ~/.fallback-vision/settings.json
 *   2. Write restart flag
 *   3. Respond to client
 *   4. Server exits after 500ms
 *   5. fv-claude watcher detects restart flag → restarts server → applies new config
 *
 * Dashboard does NOT touch settings.json — that's managed by fv-claude.js.
 */

export function handleDashboard(cfg: GatewayConfig, req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? "/";

  // API: Get settings
  if (req.method === "GET" && url === "/dashboard/api/settings") {
    const settings = loadSettings();
    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-Fallback-Vision-Version": cfg.version,
    });
    res.end(JSON.stringify(settings));
    return;
  }

  // API: Update settings (FV settings only — settings.json is managed by fv-claude.js)
  if (req.method === "POST" && url === "/dashboard/api/settings") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const settings = JSON.parse(body);
        saveSettings(settings);
        log.info("FV settings saved via dashboard");

        res.writeHead(200, {
          "Content-Type": "application/json",
          "X-Fallback-Vision-Version": cfg.version,
        });
        res.end(JSON.stringify({ ok: true, message: "Settings saved." }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid JSON" }));
      }
    });
    return;
  }

  // API: Restart — set restart flag and exit
  // fv-claude / fv-codex watcher will detect the flag, restart server, and apply new config
  if (req.method === "POST" && url === "/dashboard/api/restart") {
    try {
      // Write restart flag with clientType so the correct watcher handles it
      const settings = loadSettings();
      const clientType = settings.clientType || "claude";
      writeFileSync(RESTART_FLAG, clientType + ":" + Date.now());
      log.info("Dashboard restart: restart flag written (" + clientType + ")");

      res.writeHead(200, {
        "Content-Type": "application/json",
        "X-Fallback-Vision-Version": cfg.version,
      });
      res.end(JSON.stringify({ ok: true, message: "Restarting server..." }));
      setTimeout(() => process.exit(0), 500);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // API: Recent logs
  if (req.method === "GET" && url === "/dashboard/api/logs") {
    const logs = getRecentLogs();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(logs));
    return;
  }

  // API: Metrics
  if (req.method === "GET" && url === "/dashboard/api/metrics") {
    const metrics = getMetrics();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(metrics));
    return;
  }

  // API: Token stats (per-model usage)
  if (req.method === "GET" && url === "/dashboard/api/token-stats") {
    const stats = getTokenStats();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
    return;
  }

  // API: SSE log stream
  if (req.method === "GET" && url === "/dashboard/api/logs/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("data: {\"type\":\"connected\"}\n\n");

    let lastSentTs = "";
    const interval = setInterval(() => {
      const logs = getRecentLogs();
      for (const entry of logs) {
        if (entry.ts > lastSentTs) {
          res.write(`data: ${JSON.stringify(entry)}\n\n`);
          lastSentTs = entry.ts;
        }
      }
    }, 1000);

    req.on("close", () => clearInterval(interval));
    return;
  }

  // Main dashboard page
  if (url === "/" || url === "/dashboard" || url === "/dashboard/") {
    sendIndex(cfg, res);
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
}

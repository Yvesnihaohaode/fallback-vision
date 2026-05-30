import type { IncomingMessage, ServerResponse } from "node:http";
import { writeFileSync, readFileSync, existsSync, unlinkSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GatewayConfig } from "../config/loader.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import { sendIndex } from "./pages/index.js";
import { log } from "../util/logger.js";

const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const ORIGINAL_SETTINGS = join(homedir(), ".fallback-vision", "original-claude-settings.json");

/**
 * Dashboard does NOT write to settings.json.
 * settings.json is managed by fv-claude.js (start) and fv-stop.js (stop).
 * Writing from the dashboard causes conflicts with ccswitch.
 *
 * When "Save & Restart" is clicked:
 *   1. Save FV settings
 *   2. Restore original settings.json (undo proxy config)
 *   3. Exit server
 * User runs fv-claude again to re-enable proxy.
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

  // API: Update settings (FV settings + sync to Claude's settings.json if proxy active)
  if (req.method === "POST" && url === "/dashboard/api/settings") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const settings = JSON.parse(body);
        saveSettings(settings);
        log.info("FV settings saved via dashboard");

        // If FV proxy is active, sync model name & API key to Claude's settings.json
        if (existsSync(CLAUDE_SETTINGS)) {
          try {
            const claudeSettings: Record<string, unknown> = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));
            const env = claudeSettings.env as Record<string, string> | undefined;
            if (env && (env.ANTHROPIC_BASE_URL || "").includes("127.0.0.1")) {
              const mainModel = settings.mainModel as Record<string, string> | undefined;
              if (mainModel) {
                if (mainModel.modelName) env.ANTHROPIC_MODEL = mainModel.modelName;
                if (mainModel.apiKey) env.ANTHROPIC_AUTH_TOKEN = mainModel.apiKey;
                writeFileSync(CLAUDE_SETTINGS, JSON.stringify(claudeSettings, null, 2));
                log.info("Synced model to Claude settings.json: " + mainModel.modelName);
              }
            }
          } catch {}
        }

        res.writeHead(200, {
          "Content-Type": "application/json",
          "X-Fallback-Vision-Version": cfg.version,
        });
        res.end(JSON.stringify({ ok: true, message: "Settings saved. Restarting..." }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid JSON" }));
      }
    });
    return;
  }

  // API: Restart — restore original settings.json and exit
  // User re-runs fv-claude to re-enable proxy with new config
  if (req.method === "POST" && url === "/dashboard/api/restart") {
    try {
      // Restore original settings.json (undo proxy config)
      let restored = false;
      if (existsSync(ORIGINAL_SETTINGS)) {
        try {
          const original = JSON.parse(readFileSync(ORIGINAL_SETTINGS, "utf-8"));
          const origUrl = (original.env && original.env.ANTHROPIC_BASE_URL) || "";
          if (!origUrl.includes("127.0.0.1")) {
            copyFileSync(ORIGINAL_SETTINGS, CLAUDE_SETTINGS);
            log.info("Restored original settings.json on restart");
            restored = true;
          }
        } catch {}
      }
      if (!restored) {
        // No valid original — clean proxy env vars
        try {
          let s: Record<string, unknown> = {};
          if (existsSync(CLAUDE_SETTINGS)) {
            s = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));
          }
          const env = s.env as Record<string, string> | undefined;
          if (env) {
            delete env.ANTHROPIC_BASE_URL;
            delete env.ANTHROPIC_AUTH_TOKEN;
            delete env.ANTHROPIC_MODEL;
          }
          writeFileSync(CLAUDE_SETTINGS, JSON.stringify(s, null, 2));
          log.info("Cleaned proxy env vars from settings.json");
        } catch {}
      }

      log.info("Dashboard restart: exiting server");
      res.writeHead(200, {
        "Content-Type": "application/json",
        "X-Fallback-Vision-Version": cfg.version,
      });
      res.end(JSON.stringify({ ok: true, message: "Settings saved. Server stopping." }));
      setTimeout(() => process.exit(0), 500);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
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

import type { IncomingMessage, ServerResponse } from "node:http";
import type { GatewayConfig } from "../config/loader.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import { sendIndex } from "./pages/index.js";

export function handleDashboard(cfg: GatewayConfig, req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? "/";

  // API: Get settings
  if (req.method === "GET" && url === "/dashboard/api/settings") {
    const settings = loadSettings();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(settings));
    return;
  }

  // API: Update settings
  if (req.method === "POST" && url === "/dashboard/api/settings") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const settings = JSON.parse(body);
        saveSettings(settings);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, message: "Settings saved. Restart server to apply." }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid JSON" }));
      }
    });
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

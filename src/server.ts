import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GatewayConfig } from "./config/loader.js";
import { executePipeline, executeWithToolInterception, type Protocol } from "./proxy/pipeline.js";
import { log } from "./util/logger.js";
import { handleDashboard } from "./dashboard/handler.js";

export function startServer(cfg: GatewayConfig): Server {
  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";

    // Dashboard
    if (url.startsWith("/dashboard") || url === "/") {
      return handleDashboard(cfg, req, res);
    }

    // Health check
    if (req.method === "GET" && url === "/healthz") {
      return sendJson(res, 200, { ok: true, name: "fallback-vision" });
    }

    // Restart endpoint — writes flag file, then server exits
    if (req.method === "POST" && url === "/dashboard/api/restart") {
      const flagPath = join(homedir(), ".fallback-vision", ".restart");
      try {
        writeFileSync(flagPath, "restart");
        log.info("restart signal sent, shutting down...");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        // Give response time to send, then exit
        setTimeout(() => process.exit(0), 200);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
      return;
    }

    // API routes
    if (req.method === "POST") {
      try {
        if (url === "/v1/messages") {
          return await handleRequest(cfg, req, res, "anthropic");
        }
        if (url === "/v1/chat/completions" || url === "/v1/responses") {
          return await handleRequest(cfg, req, res, "openai");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        log.error("request failed", { error: message });
        return sendJson(res, 500, errorEnvelope(500, "internal_error", message));
      }
    }

    sendJson(res, 404, errorEnvelope(404, "not_found", `no route for ${req.method} ${url}`));
  });

  server.listen(cfg.port, cfg.host);
  return server;
}

async function handleRequest(
  cfg: GatewayConfig,
  req: IncomingMessage,
  res: ServerResponse,
  protocol: Protocol
): Promise<void> {
  const body = await readJsonBody(req);
  if (!body) {
    return sendJson(res, 400, errorEnvelope(400, "invalid_json", "failed to parse request body"));
  }

  const model = (body as Record<string, unknown>).model as string;
  if (!model) {
    return sendJson(res, 400, errorEnvelope(400, "missing_model", "request body must include 'model'"));
  }

  log.info(`incoming ${protocol}`, { model });

  const result = protocol === "anthropic"
    ? await executeWithToolInterception(cfg.registry, body, protocol, cfg.version)
    : await executePipeline(cfg.registry, body, protocol, cfg.version);

  log.info("request completed", {
    protocol: result.protocol,
    vision: result.usedVision,
    visionModel: result.visionModelId,
    mainModel: result.mainModelId,
    totalMs: result.latencyMs,
  });

  res.writeHead(200, {
    "Content-Type": "application/json",
    ...(protocol === "anthropic" ? { "x-request-id": `req_${Date.now()}` } : {}),
  });
  res.end(JSON.stringify(result.response));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > 16 * 1024 * 1024) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf-8");
        resolve(text ? JSON.parse(text) : null);
      } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function errorEnvelope(status: number, code: string, message: string) {
  return { error: { type: status >= 500 ? "server_error" : "invalid_request_error", code, message, status } };
}

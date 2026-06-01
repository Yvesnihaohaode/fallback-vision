// ============================================================================
// HTTP Server — routes requests to the pipeline
// Supports Claude Code (/v1/messages), Claude Desktop (/claude-desktop/v1/*)
// and OpenAI-compatible endpoints
// ============================================================================

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { GatewayConfig } from "./config/loader.js";
import { executePipeline, executePipelineStream, type Protocol } from "./proxy/pipeline.js";
import { log } from "./util/logger.js";
import { handleDashboard } from "./dashboard/handler.js";
import { loadSettings } from "./config/settings.js";
import { recordRequest } from "./util/metrics.js";

// Canonical Anthropic model IDs that Claude Code / Claude Desktop expect
const CANONICAL_MODELS = [
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
];

export function startServer(cfg: GatewayConfig): Server {
  const server = createServer((req, res) => {
    // Wrap everything in a top-level catch to prevent process crash
    handleAll(cfg, req, res).catch((err) => {
      const message = err instanceof Error ? err.message : "unknown error";
      log.error("unhandled error", { error: message });
      if (!res.headersSent) {
        sendJson(res, 500, errorEnvelope(500, "internal_error", message));
      } else {
        try { res.end(); } catch {}
      }
    });
  });

  server.listen(cfg.port, cfg.host);
  log.info(`Fallback Vision listening on ${cfg.host}:${cfg.port}`);
  return server;
}

async function handleAll(cfg: GatewayConfig, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rawUrl = req.url ?? "/";
  const url = rawUrl.split("?")[0];
  const method = req.method ?? "GET";

  // ── Dashboard ──
  if (url.startsWith("/dashboard") || url === "/") {
    return handleDashboard(cfg, req, res);
  }

  // ── Health ──
  if (method === "GET" && (url === "/healthz" || url === "/health")) {
    return sendJson(res, 200, { status: "healthy", name: "fallback-vision", version: cfg.version });
  }

  // ── Model list ──
  if (method === "GET" && (url === "/v1/models" || url === "/claude-desktop/v1/models")) {
    return sendModelList(res);
  }

  // ── POST API routes ──
  if (method === "POST") {
    // Anthropic Messages
    if (url === "/v1/messages" || url === "/claude/v1/messages" || url === "/claude-desktop/v1/messages") {
      return await handleRequest(cfg, req, res, "anthropic");
    }
    // OpenAI Chat / Responses
    if (
      url === "/v1/chat/completions" || url === "/chat/completions" ||
      url === "/v1/responses" || url === "/responses" ||
      url === "/codex/v1/chat/completions" || url === "/codex/v1/responses"
    ) {
      return await handleRequest(cfg, req, res, "openai");
    }
  }

  // Probe endpoints
  if (method === "GET" && (url === "/v1/messages" || url === "/claude/v1/messages")) {
    return sendJson(res, 200, { ok: true });
  }

  sendJson(res, 404, errorEnvelope(404, "not_found", `no route for ${method} ${url}`));
}

// ── Model list ──
function sendModelList(res: ServerResponse): void {
  // Include the actual configured model first, then canonical models
  const settings = loadSettings();
  const configuredModel = settings.mainModel.modelName;
  const allModels = configuredModel
    ? [configuredModel, ...CANONICAL_MODELS.filter((id) => id !== configuredModel)]
    : CANONICAL_MODELS;
  const data = allModels.map((id) => ({
    type: "model",
    id,
    created_at: "2024-01-01T00:00:00Z",
    supports1m: true,
  }));
  sendJson(res, 200, {
    data,
    has_more: false,
    first_id: allModels[0],
    last_id: allModels[allModels.length - 1],
  });
}

// ── Request handler ──
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

  const isStream = !!(body as Record<string, unknown>).stream;
  log.info(`incoming ${protocol}`, { model, stream: isStream });

  if (isStream) {
    // ── Streaming ──
    let result;
    try {
      result = await executePipelineStream(cfg.registry, body, protocol, cfg.version);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      log.error("pipeline error (stream)", { error: msg });
      recordRequest({ protocol, model: model ?? "unknown", latencyMs: 0, usedVision: false, ok: false });
      throw err;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "x-request-id": `req_${Date.now()}`,
    });

    try {
      for await (const chunk of result.stream) {
        if (res.destroyed) break;
        res.write(chunk);
      }
    } catch (err) {
      log.error("streaming error", { error: (err as Error).message });
    } finally {
      if (!res.destroyed) res.end();
    }

    log.info("stream completed", {
      protocol: result.protocol,
      vision: result.usedVision,
      visionModel: result.visionModelId,
      mainModel: result.mainModelId,
      totalMs: result.latencyMs,
    });
    recordRequest({ protocol: result.protocol, model: result.mainModelId, latencyMs: result.latencyMs, usedVision: result.usedVision, ok: true });
  } else {
    // ── Non-streaming ──
    let result;
    try {
      result = await executePipeline(cfg.registry, body, protocol, cfg.version);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      log.error("pipeline error", { error: msg });
      recordRequest({ protocol, model: model ?? "unknown", latencyMs: 0, usedVision: false, ok: false });
      throw err;
    }

    log.info("request completed", {
      protocol: result.protocol,
      vision: result.usedVision,
      visionModel: result.visionModelId,
      mainModel: result.mainModelId,
      totalMs: result.latencyMs,
    });
    recordRequest({ protocol: result.protocol, model: result.mainModelId, latencyMs: result.latencyMs, usedVision: result.usedVision, ok: true });

    res.writeHead(200, {
      "Content-Type": "application/json",
      ...(protocol === "anthropic" ? { "x-request-id": `req_${Date.now()}` } : {}),
    });
    res.end(JSON.stringify(result.response));
  }
}

// ── Helpers ──
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

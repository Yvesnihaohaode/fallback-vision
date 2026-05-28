import type { GatewayRequest, ModelInfo } from "../types.js";

/**
 * Image Detection — scans a request body for image content.
 * Supports OpenAI Chat Completions and Responses API formats.
 */
export function detectImages(request: GatewayRequest): boolean {
  if (request.format === "responses") {
    return detectImagesInResponses(request.raw);
  }
  if (request.format === "chat-completions") {
    return detectImagesInChat(request.raw);
  }
  return false;
}

function detectImagesInResponses(raw: unknown): boolean {
  const body = raw as { input?: unknown[] };
  if (!Array.isArray(body.input)) return false;
  for (const item of body.input) {
    const msg = item as { type?: string; content?: unknown[] };
    if (msg.type !== "message") continue;
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      const p = part as { type?: string };
      if (p.type === "input_image") return true;
    }
  }
  return false;
}

function detectImagesInChat(raw: unknown): boolean {
  const body = raw as { messages?: unknown[] };
  if (!Array.isArray(body.messages)) return false;
  for (const msg of body.messages) {
    const m = msg as { content?: unknown[] };
    if (!Array.isArray(m.content)) continue;
    for (const part of m.content) {
      const p = part as { type?: string };
      if (p.type === "image_url" || p.type === "input_image") return true;
    }
  }
  return false;
}

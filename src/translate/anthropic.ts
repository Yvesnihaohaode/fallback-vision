// ============================================================================
// Anthropic Messages Protocol — Conversion
// ============================================================================

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string | Array<{ type: string; text: string }>;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64" | "url"; media_type?: string; data?: string; url?: string } }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content?: string | AnthropicContentBlock[] };

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicToolChoice {
  type: "auto" | "any" | "tool";
  name?: string;
}

export interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "tool_use" | null;
  usage: { input_tokens: number; output_tokens: number };
}

export function hasAnthropicImages(body: unknown): boolean {
  const b = body as AnthropicRequest;
  if (!Array.isArray(b.messages)) return false;
  for (const msg of b.messages) {
    if (typeof msg.content === "string") continue;
    if (!Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type === "image") return true;
    }
  }
  return false;
}

// ============================================================================
// Anthropic → OpenAI Chat Completions
// ============================================================================

export function anthropicToChat(req: AnthropicRequest): Record<string, unknown> {
  const messages: Array<Record<string, unknown>> = [];

  // System prompt
  if (req.system) {
    const text = typeof req.system === "string"
      ? req.system
      : Array.isArray(req.system) ? req.system.map((b) => b.text).join("\n") : "";
    messages.push({ role: "system", content: text });
  }

  for (const msg of req.messages) {
    if (typeof msg.content === "string") {
      messages.push({ role: msg.role, content: msg.content });
      continue;
    }
    if (!Array.isArray(msg.content)) continue;

    const textParts: string[] = [];
    const imageParts: unknown[] = [];
    const toolUseBlocks: AnthropicContentBlock[] = [];
    const toolResultBlocks: AnthropicContentBlock[] = [];

    for (const block of msg.content) {
      if (block.type === "text") textParts.push(block.text);
      else if (block.type === "image") {
        const src = block.source;
        if (src.type === "base64" && src.data) {
          imageParts.push({ type: "image_url", image_url: { url: `data:${src.media_type};base64,${src.data}` } });
        } else if (src.type === "url" && src.url) {
          imageParts.push({ type: "image_url", image_url: { url: src.url } });
        }
      }
      else if (block.type === "tool_use") toolUseBlocks.push(block);
      else if (block.type === "tool_result") toolResultBlocks.push(block);
    }

    if (msg.role === "assistant" && toolUseBlocks.length > 0) {
      messages.push({
        role: "assistant",
        content: textParts.join("\n") || null,
        tool_calls: toolUseBlocks.map((b) => ({
          id: b.type === "tool_use" ? b.id : "",
          type: "function",
          function: {
            name: b.type === "tool_use" ? b.name : "",
            arguments: b.type === "tool_use" ? (typeof b.input === "string" ? b.input : JSON.stringify(b.input)) : "{}",
          },
        })),
      });
      continue;
    }

    if (msg.role === "user" && toolResultBlocks.length > 0) {
      for (const tr of toolResultBlocks) {
        if (tr.type !== "tool_result") continue;
        const content = typeof tr.content === "string" ? tr.content
          : Array.isArray(tr.content) ? tr.content.filter((b) => b.type === "text").map((b) => b.type === "text" ? b.text : "").join("\n") : "";
        messages.push({ role: "tool", tool_call_id: tr.tool_use_id, content });
      }
      continue;
    }

    const parts: unknown[] = [...imageParts];
    if (textParts.length > 0) parts.push({ type: "text", text: textParts.join("\n") });

    if (parts.length === 1 && parts[0] && typeof parts[0] === "object" && "text" in (parts[0] as Record<string, unknown>)) {
      messages.push({ role: msg.role, content: (parts[0] as { text: string }).text });
    } else if (parts.length > 0) {
      messages.push({ role: msg.role, content: parts });
    } else {
      messages.push({ role: msg.role, content: "" });
    }
  }

  const result: Record<string, unknown> = { model: req.model, messages, stream: req.stream ?? false, max_tokens: req.max_tokens };
  if (req.temperature !== undefined) result.temperature = req.temperature;
  if (req.top_p !== undefined) result.top_p = req.top_p;

  if (req.tools && req.tools.length > 0) {
    result.tools = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
  }

  if (req.tool_choice) {
    if (req.tool_choice.type === "auto") result.tool_choice = "auto";
    else if (req.tool_choice.type === "any") result.tool_choice = "required";
    else if (req.tool_choice.type === "tool" && req.tool_choice.name) {
      result.tool_choice = { type: "function", function: { name: req.tool_choice.name } };
    }
  }

  return result;
}

// ============================================================================
// OpenAI Chat → Anthropic Response
// ============================================================================

export function chatToAnthropic(
  chatResponse: Record<string, unknown>,
  requestModel: string
): AnthropicResponse {
  const choices = chatResponse.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  const msg = choice?.message as Record<string, unknown> | undefined;
  const content: AnthropicContentBlock[] = [];

  if (msg?.content && typeof msg.content === "string") {
    content.push({ type: "text", text: msg.content });
  }

  const toolCalls = msg?.tool_calls as Array<Record<string, unknown>> | undefined;
  if (toolCalls && toolCalls.length > 0) {
    for (const tc of toolCalls) {
      const fn = tc.function as Record<string, unknown> | undefined;
      let input: unknown = {};
      try { input = JSON.parse((fn?.arguments as string) ?? "{}"); } catch { input = {}; }
      content.push({
        type: "tool_use",
        id: (tc.id as string) ?? `toolu_${Date.now()}`,
        name: (fn?.name as string) ?? "unknown",
        input,
      });
    }
  }

  const finishReason = choice?.finish_reason as string | undefined;
  let stopReason: AnthropicResponse["stop_reason"] = "end_turn";
  if (finishReason === "length") stopReason = "max_tokens";
  else if (finishReason === "tool_calls") stopReason = "tool_use";

  const usage = chatResponse.usage as Record<string, number> | undefined;

  return {
    id: (chatResponse.id as string) ?? `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content,
    model: requestModel,
    stop_reason: stopReason,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
    },
  };
}

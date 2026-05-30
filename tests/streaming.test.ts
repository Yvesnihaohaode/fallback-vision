import { describe, it, expect } from "vitest";
import { openaiSSEToAnthropicSSE } from "../src/translate/anthropic.js";

async function collect(gen: AsyncGenerator<string, void, unknown>): Promise<string> {
  let result = "";
  for await (const chunk of gen) result += chunk;
  return result;
}

function parseEvents(raw: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = raw.split("\n\n").filter(Boolean);
  for (const block of blocks) {
    const lines = block.split("\n");
    let event = "";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7);
      if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (event && data) {
      try { events.push({ event, data: JSON.parse(data) }); } catch {}
    }
  }
  return events;
}

async function* mockUpstream(chunks: string[]): AsyncGenerator<string, void, unknown> {
  for (const chunk of chunks) yield chunk;
}

describe("openaiSSEToAnthropicSSE", () => {
  it("converts a simple text response", async () => {
    const c1 = JSON.stringify({ id: "c1", choices: [{ delta: { role: "assistant" }, index: 0, finish_reason: null }] });
    const c2 = JSON.stringify({ id: "c1", choices: [{ delta: { content: "Hello" }, index: 0, finish_reason: null }] });
    const c3 = JSON.stringify({ id: "c1", choices: [{ delta: { content: " world" }, index: 0, finish_reason: "stop" }] });

    const upstream = mockUpstream([`data: ${c1}\n\ndata: ${c2}\n\ndata: ${c3}\n\ndata: [DONE]\n\n`]);
    const raw = await collect(openaiSSEToAnthropicSSE(upstream, "claude-sonnet-4-20250514"));
    const events = parseEvents(raw);
    const types = events.map(e => e.event);

    expect(types).toContain("message_start");
    expect(types).toContain("ping");
    expect(types).toContain("content_block_start");
    expect(types).toContain("content_block_delta");
    expect(types).toContain("content_block_stop");
    expect(types).toContain("message_delta");
    expect(types).toContain("message_stop");

    const msgStart = events.find(e => e.event === "message_start")!.data as Record<string, unknown>;
    const msg = msgStart.message as Record<string, unknown>;
    expect(msg.model).toBe("claude-sonnet-4-20250514");
    expect(msg.role).toBe("assistant");

    const deltas = events.filter(e => e.event === "content_block_delta");
    expect(deltas.length).toBe(2);
    expect((deltas[0].data as Record<string, unknown>).delta).toEqual({ type: "text_delta", text: "Hello" });
    expect((deltas[1].data as Record<string, unknown>).delta).toEqual({ type: "text_delta", text: " world" });

    const msgDelta = events.find(e => e.event === "message_delta")!.data as Record<string, unknown>;
    expect((msgDelta.delta as Record<string, unknown>).stop_reason).toBe("end_turn");
  });

  it("handles tool calls", async () => {
    const c1 = JSON.stringify({ id: "c2", choices: [{ delta: { role: "assistant" }, index: 0, finish_reason: null }] });
    const c2 = JSON.stringify({ id: "c2", choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "web_search", arguments: "" } }] }, index: 0, finish_reason: null }] });
    const c3 = JSON.stringify({ id: "c2", choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"q":"test"}' } }] }, index: 0, finish_reason: "tool_calls" }] });

    const upstream = mockUpstream([`data: ${c1}\n\ndata: ${c2}\n\ndata: ${c3}\n\ndata: [DONE]\n\n`]);
    const raw = await collect(openaiSSEToAnthropicSSE(upstream, "claude-sonnet-4-20250514"));
    const events = parseEvents(raw);

    const blockStart = events.find(e => e.event === "content_block_start")!.data as Record<string, unknown>;
    const cb = blockStart.content_block as Record<string, unknown>;
    expect(cb.type).toBe("tool_use");
    expect(cb.name).toBe("web_search");
    expect(cb.id).toBe("call_1");

    const toolDeltas = events.filter(e => e.event === "content_block_delta");
    expect(toolDeltas.length).toBe(1);
    expect((toolDeltas[0].data as Record<string, unknown>).delta).toEqual({ type: "input_json_delta", partial_json: '{"q":"test"}' });

    const msgDelta = events.find(e => e.event === "message_delta")!.data as Record<string, unknown>;
    expect((msgDelta.delta as Record<string, unknown>).stop_reason).toBe("tool_use");
  });

  it("handles empty response", async () => {
    const c1 = JSON.stringify({ id: "c3", choices: [{ delta: { role: "assistant" }, index: 0, finish_reason: null }] });
    const c2 = JSON.stringify({ id: "c3", choices: [{ delta: {}, index: 0, finish_reason: "stop" }] });

    const upstream = mockUpstream([`data: ${c1}\n\ndata: ${c2}\n\ndata: [DONE]\n\n`]);
    const raw = await collect(openaiSSEToAnthropicSSE(upstream, "test-model"));
    const events = parseEvents(raw);
    const types = events.map(e => e.event);
    expect(types).toContain("message_start");
    expect(types).toContain("message_stop");
  });

  it("handles usage in final chunk", async () => {
    const c1 = JSON.stringify({ id: "c4", choices: [{ delta: { content: "Hi" }, index: 0, finish_reason: null }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    const c2 = JSON.stringify({ id: "c4", choices: [{ delta: {}, index: 0, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } });

    const upstream = mockUpstream([`data: ${c1}\n\ndata: ${c2}\n\ndata: [DONE]\n\n`]);
    const raw = await collect(openaiSSEToAnthropicSSE(upstream, "test-model"));
    const events = parseEvents(raw);
    const msgDelta = events.find(e => e.event === "message_delta")!.data as Record<string, unknown>;
    expect((msgDelta.usage as Record<string, unknown>).output_tokens).toBe(5);
  });

  it("handles partial line buffering", async () => {
    const full = JSON.stringify({ id: "c5", choices: [{ delta: { content: "Hello" }, index: 0, finish_reason: null }] });
    const half1 = `data: ${full.slice(0, 30)}`;
    const half2 = `${full.slice(30)}\n\ndata: [DONE]\n\n`;

    const upstream = mockUpstream([half1, half2]);
    const raw = await collect(openaiSSEToAnthropicSSE(upstream, "test-model"));
    const events = parseEvents(raw);
    const deltas = events.filter(e => e.event === "content_block_delta");
    expect(deltas.length).toBe(1);
    expect((deltas[0].data as Record<string, unknown>).delta).toEqual({ type: "text_delta", text: "Hello" });
  });

  it("preserves request model name in response", async () => {
    const c1 = JSON.stringify({ id: "c6", choices: [{ delta: { content: "OK" }, index: 0, finish_reason: "stop" }] });
    const upstream = mockUpstream([`data: ${c1}\n\ndata: [DONE]\n\n`]);
    const raw = await collect(openaiSSEToAnthropicSSE(upstream, "my-custom-model"));
    const events = parseEvents(raw);
    const msgStart = events.find(e => e.event === "message_start")!.data as Record<string, unknown>;
    expect((msgStart.message as Record<string, unknown>).model).toBe("my-custom-model");
  });
});

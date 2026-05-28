import { describe, expect, it } from "vitest";
import { detectImages } from "../src/routing/capability.js";
import type { GatewayRequest } from "../src/types.js";

function makeReq(format: "responses" | "chat-completions", raw: unknown): GatewayRequest {
  return { format, model: "test", stream: false, hasImages: false, hasTools: false, messages: [], raw };
}

describe("detectImages", () => {
  describe("Responses API format", () => {
    it("detects input_image in message content", () => {
      const raw = {
        input: [
          {
            type: "message",
            content: [
              { type: "input_text", text: "describe this" },
              { type: "input_image", image_url: "data:image/png;base64,..." },
            ],
          },
        ],
      };
      expect(detectImages(makeReq("responses", raw))).toBe(true);
    });

    it("returns false when no images present", () => {
      const raw = {
        input: [
          {
            type: "message",
            content: [{ type: "input_text", text: "hello" }],
          },
        ],
      };
      expect(detectImages(makeReq("responses", raw))).toBe(false);
    });

    it("skips non-message items (function_call, reasoning)", () => {
      const raw = {
        input: [
          { type: "function_call", name: "test", arguments: "{}" },
          { type: "reasoning", summary: [] },
        ],
      };
      expect(detectImages(makeReq("responses", raw))).toBe(false);
    });

    it("handles empty input array", () => {
      expect(detectImages(makeReq("responses", { input: [] }))).toBe(false);
    });

    it("handles missing input", () => {
      expect(detectImages(makeReq("responses", {}))).toBe(false);
    });
  });

  describe("Chat Completions format", () => {
    it("detects image_url in message content", () => {
      const raw = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "what is this?" },
              { type: "image_url", image_url: { url: "https://example.com/img.png" } },
            ],
          },
        ],
      };
      expect(detectImages(makeReq("chat-completions", raw))).toBe(true);
    });

    it("detects input_image in message content", () => {
      const raw = {
        messages: [
          {
            role: "user",
            content: [{ type: "input_image", image_url: "data:image/png;base64,..." }],
          },
        ],
      };
      expect(detectImages(makeReq("chat-completions", raw))).toBe(true);
    });

    it("returns false for text-only messages", () => {
      const raw = {
        messages: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "hi there" },
        ],
      };
      expect(detectImages(makeReq("chat-completions", raw))).toBe(false);
    });

    it("handles empty messages array", () => {
      expect(detectImages(makeReq("chat-completions", { messages: [] }))).toBe(false);
    });
  });
});

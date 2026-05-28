import { describe, expect, it } from "vitest";
import { anthropicToChat, chatToAnthropic, hasAnthropicImages } from "../src/translate/anthropic.js";

describe("Anthropic Conversion", () => {
  describe("hasAnthropicImages", () => {
    it("detects image blocks", () => {
      const body = {
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "what is this?" },
            { type: "image", source: { type: "base64", media_type: "image/png", data: "abc" } },
          ],
        }],
      };
      expect(hasAnthropicImages(body)).toBe(true);
    });

    it("returns false for text-only", () => {
      const body = {
        messages: [{ role: "user", content: "hello" }],
      };
      expect(hasAnthropicImages(body)).toBe(false);
    });

    it("returns false for empty messages", () => {
      expect(hasAnthropicImages({ messages: [] })).toBe(false);
    });
  });

  describe("anthropicToChat", () => {
    it("converts basic text message", () => {
      const result = anthropicToChat({
        model: "test-model",
        max_tokens: 100,
        messages: [{ role: "user", content: "hello" }],
      });
      expect(result.model).toBe("test-model");
      expect(result.messages).toHaveLength(1);
      expect((result.messages as Array<{ role: string }>)[0].role).toBe("user");
    });

    it("converts system prompt", () => {
      const result = anthropicToChat({
        model: "test",
        max_tokens: 100,
        system: "You are helpful.",
        messages: [{ role: "user", content: "hi" }],
      });
      const msgs = result.messages as Array<{ role: string; content: string }>;
      expect(msgs[0].role).toBe("system");
      expect(msgs[0].content).toBe("You are helpful.");
    });

    it("converts image blocks to image_url", () => {
      const result = anthropicToChat({
        model: "test",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "what is this?" },
            { type: "image", source: { type: "base64", media_type: "image/png", data: "abc123" } },
          ],
        }],
      });
      const msgs = result.messages as Array<{ content: unknown }>;
      const content = msgs[0].content as Array<{ type: string; image_url?: { url: string } }>;
      expect(content).toHaveLength(2);
      expect(content[0].type).toBe("image_url");
      expect(content[0].image_url?.url).toContain("data:image/png;base64,abc123");
    });

    it("converts tools to OpenAI format", () => {
      const result = anthropicToChat({
        model: "test",
        max_tokens: 100,
        messages: [{ role: "user", content: "hi" }],
        tools: [{ name: "search", description: "Search the web", input_schema: { type: "object" } }],
      });
      const tools = result.tools as Array<{ type: string; function: { name: string } }>;
      expect(tools).toHaveLength(1);
      expect(tools[0].type).toBe("function");
      expect(tools[0].function.name).toBe("search");
    });
  });

  describe("chatToAnthropic", () => {
    it("converts basic text response", () => {
      const result = chatToAnthropic({
        id: "chatcmpl-123",
        choices: [{ message: { content: "hello" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }, "test-model");
      expect(result.type).toBe("message");
      expect(result.role).toBe("assistant");
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.stop_reason).toBe("end_turn");
      expect(result.usage.input_tokens).toBe(10);
    });

    it("converts tool calls", () => {
      const result = chatToAnthropic({
        id: "chatcmpl-456",
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: "call_123",
              function: { name: "search", arguments: '{"query":"test"}' },
            }],
          },
          finish_reason: "tool_calls",
        }],
      }, "test-model");
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("tool_use");
      expect(result.stop_reason).toBe("tool_use");
    });

    it("maps length to max_tokens", () => {
      const result = chatToAnthropic({
        choices: [{ finish_reason: "length" }],
      }, "test");
      expect(result.stop_reason).toBe("max_tokens");
    });
  });
});

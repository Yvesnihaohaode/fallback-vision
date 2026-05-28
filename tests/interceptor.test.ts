import { describe, expect, it } from "vitest";
import { hasLocalTools, extractLocalToolCalls } from "../src/tools/interceptor.js";

describe("Tool Interceptor", () => {
  describe("hasLocalTools", () => {
    it("detects web_search tool", () => {
      expect(hasLocalTools([{ name: "web_search" }])).toBe(true);
    });

    it("detects web_fetch tool", () => {
      expect(hasLocalTools([{ name: "web_fetch" }])).toBe(true);
    });

    it("detects WebSearch tool", () => {
      expect(hasLocalTools([{ name: "WebSearch" }])).toBe(true);
    });

    it("detects tools via function.name", () => {
      expect(hasLocalTools([{ function: { name: "web_search" } }])).toBe(true);
    });

    it("returns false for non-local tools", () => {
      expect(hasLocalTools([{ name: "code_interpreter" }])).toBe(false);
    });

    it("returns false for empty tools", () => {
      expect(hasLocalTools([])).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(hasLocalTools(undefined)).toBe(false);
    });

    it("detects mixed local and non-local tools", () => {
      expect(hasLocalTools([
        { name: "code_interpreter" },
        { name: "web_search" },
      ])).toBe(true);
    });
  });

  describe("extractLocalToolCalls", () => {
    it("extracts web_search tool call", () => {
      const response = {
        content: [
          { type: "tool_use", id: "toolu_123", name: "web_search", input: { query: "test" } },
        ],
      };
      const calls = extractLocalToolCalls(response);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe("web_search");
      expect(calls[0].id).toBe("toolu_123");
    });

    it("extracts only local tools, ignores others", () => {
      const response = {
        content: [
          { type: "tool_use", id: "toolu_1", name: "code_interpreter", input: {} },
          { type: "tool_use", id: "toolu_2", name: "web_search", input: { query: "test" } },
          { type: "tool_use", id: "toolu_3", name: "web_fetch", input: { url: "https://example.com" } },
        ],
      };
      const calls = extractLocalToolCalls(response);
      expect(calls).toHaveLength(2);
      expect(calls[0].name).toBe("web_search");
      expect(calls[1].name).toBe("web_fetch");
    });

    it("returns empty for text-only response", () => {
      const response = { content: [{ type: "text", text: "hello" }] };
      expect(extractLocalToolCalls(response)).toHaveLength(0);
    });

    it("returns empty for no content", () => {
      expect(extractLocalToolCalls({})).toHaveLength(0);
    });
  });
});

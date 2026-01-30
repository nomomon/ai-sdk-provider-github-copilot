import type { LanguageModelV3Prompt } from "@ai-sdk/provider";
import { describe, expect, it } from "vitest";
import { convertToCopilotMessages } from "@/convert-to-copilot-messages.js";

describe("convertToCopilotMessages", () => {
  it("converts a simple user message to prompt format", () => {
    const prompt: LanguageModelV3Prompt = [{ role: "user", content: "Hello, world!" }];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toBe("User: Hello, world!");
    expect(result.systemMessage).toBeUndefined();
    expect(result.attachments).toBeUndefined();
    expect(result.warnings).toBeUndefined();
  });

  it("converts system + user messages", () => {
    const prompt: LanguageModelV3Prompt = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is 2+2?" },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toContain("System: You are a helpful assistant.");
    expect(result.prompt).toContain("User: What is 2+2?");
    expect(result.systemMessage).toBe("You are a helpful assistant.");
  });

  it("converts multi-turn conversation with assistant", () => {
    const prompt: LanguageModelV3Prompt = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello! How can I help?" },
      { role: "user", content: "Tell me a joke" },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toContain("User: Hi");
    expect(result.prompt).toContain("Assistant: Hello! How can I help?");
    expect(result.prompt).toContain("User: Tell me a joke");
  });

  it("handles user message with text parts", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "user",
        content: [
          { type: "text", text: "First line" },
          { type: "text", text: "Second line" },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toBe("User: First line\nSecond line");
  });

  it("handles file attachment with file:// path", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "user",
        content: [
          { type: "text", text: "Review this file" },
          {
            type: "file",
            data: "file:///tmp/example.ts",
            filename: "example.ts",
          },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toContain("User: Review this file");
    expect(result.attachments).toEqual([
      { type: "file", path: "/tmp/example.ts", displayName: "example.ts" },
    ]);
  });

  it("handles file attachment with absolute path", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: "/home/user/src/main.ts",
            filename: "main.ts",
          },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.attachments).toEqual([
      { type: "file", path: "/home/user/src/main.ts", displayName: "main.ts" },
    ]);
  });

  it("adds warning for image URLs", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "user",
        content: [
          { type: "text", text: "Look at this" },
          { type: "file", data: "https://example.com/image.png" },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.warnings).toBeDefined();
    expect(result.warnings).toContain(
      "Image URLs are not supported by this provider; supply file paths as attachments.",
    );
  });

  it("adds warning for base64/image data URLs", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "user",
        content: [{ type: "image", image: new Uint8Array(), mimeType: "image/png" }],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.warnings).toBeDefined();
    expect(result.warnings).toContain(
      "Base64/image data URLs require file paths. Write to temp file and pass path, or use attachments with path.",
    );
  });

  it("converts tool results with text output", () => {
    const prompt: LanguageModelV3Prompt = [
      { role: "user", content: "Get weather" },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolName: "get_weather",
            toolCallId: "call_1",
            output: { type: "text", value: "Sunny, 72°F" },
          },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toContain("User: Get weather");
    expect(result.prompt).toContain("Tool result (get_weather): Sunny, 72°F");
  });

  it("converts tool results with json output", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolName: "search",
            toolCallId: "call_1",
            output: { type: "json", value: { results: ["a", "b"] } },
          },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toContain('Tool result (search): {"results":["a","b"]}');
  });

  it("converts tool results with error-text output", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolName: "fetch",
            toolCallId: "call_1",
            output: { type: "error-text", value: "Network failed" },
          },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toContain("Tool result (fetch): Error: Network failed");
  });

  it("converts tool results with execution-denied output", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolName: "delete_file",
            toolCallId: "call_1",
            output: { type: "execution-denied", reason: "Not allowed" },
          },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toContain("Tool result (delete_file): [Execution denied: Not allowed]");
  });

  it("converts tool results with content output", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolName: "read",
            toolCallId: "call_1",
            output: {
              type: "content",
              value: [
                { type: "text", text: "Line 1" },
                { type: "text", text: "Line 2" },
              ],
            },
          },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toContain("Tool result (read): Line 1\nLine 2");
  });

  it("handles file attachment with Windows path", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: "C:\\Users\\dev\\src\\main.ts",
            filename: "main.ts",
          },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.attachments).toEqual([
      { type: "file", path: "C:\\Users\\dev\\src\\main.ts", displayName: "main.ts" },
    ]);
  });

  it("adds warning for http:// URLs", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "user",
        content: [{ type: "file", data: "http://example.com/file.png" }],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.warnings).toContain(
      "Image URLs are not supported by this provider; supply file paths as attachments.",
    );
  });

  it("converts assistant message with tool-call and reasoning parts", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll use the tool." },
          { type: "tool-call", toolCallId: "1", toolName: "search", input: {} },
          { type: "reasoning", text: "User needs info" },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.prompt).toContain("I'll use the tool.");
    expect(result.prompt).toContain("[Tool call: search]");
    expect(result.prompt).toContain("[Reasoning: User needs info]");
  });

  it("handles empty system message", () => {
    const prompt: LanguageModelV3Prompt = [
      { role: "system", content: "   " },
      { role: "user", content: "Hi" },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.systemMessage).toBeUndefined();
  });

  it("handles system message with content parts", () => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: "system",
        content: [
          { type: "text", text: "Part one" },
          { type: "text", text: "Part two" },
        ],
      },
    ];
    const result = convertToCopilotMessages(prompt);
    expect(result.systemMessage).toBe("Part one\nPart two");
    expect(result.prompt).toContain("System: Part one\nPart two");
  });
});

import { describe, expect, it } from "vitest";
import {
  type CopilotUsageEvent,
  convertCopilotUsage,
  createEmptyUsage,
} from "@/conversion/usage.js";

describe("createEmptyUsage", () => {
  it("returns usage with zero tokens", () => {
    const result = createEmptyUsage();
    expect(result.inputTokens).toEqual({
      total: 0,
      noCache: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
    expect(result.outputTokens).toEqual({
      total: 0,
      text: undefined,
      reasoning: undefined,
    });
    expect(result.raw).toBeUndefined();
  });

  it("returns valid LanguageModelV3Usage shape", () => {
    const result = createEmptyUsage();
    expect(result).toHaveProperty("inputTokens");
    expect(result).toHaveProperty("outputTokens");
    expect(result).toHaveProperty("raw");
  });
});

describe("convertCopilotUsage", () => {
  it("converts full usage event to AI SDK format", () => {
    const event: CopilotUsageEvent = {
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 2,
      cacheWriteTokens: 1,
    };
    const result = convertCopilotUsage(event);

    expect(result.inputTokens.total).toBe(13); // 10 + 2 + 1
    expect(result.inputTokens.noCache).toBe(10);
    expect(result.inputTokens.cacheRead).toBe(2);
    expect(result.inputTokens.cacheWrite).toBe(1);
    expect(result.outputTokens.total).toBe(5);
    expect(result.outputTokens.text).toBe(5);
    expect(result.outputTokens.reasoning).toBeUndefined();
    expect(result.raw).toBe(event);
  });

  it("handles undefined fields with defaults", () => {
    const event: CopilotUsageEvent = {};
    const result = convertCopilotUsage(event);

    expect(result.inputTokens.total).toBe(0);
    expect(result.inputTokens.noCache).toBe(0);
    expect(result.inputTokens.cacheRead).toBe(0);
    expect(result.inputTokens.cacheWrite).toBe(0);
    expect(result.outputTokens.total).toBe(0);
    expect(result.outputTokens.text).toBe(0);
  });

  it("handles partial event with only inputTokens", () => {
    const event: CopilotUsageEvent = { inputTokens: 100 };
    const result = convertCopilotUsage(event);

    expect(result.inputTokens.total).toBe(100);
    expect(result.inputTokens.noCache).toBe(100);
    expect(result.inputTokens.cacheRead).toBe(0);
    expect(result.inputTokens.cacheWrite).toBe(0);
    expect(result.outputTokens.total).toBe(0);
  });

  it("handles partial event with only outputTokens", () => {
    const event: CopilotUsageEvent = { outputTokens: 50 };
    const result = convertCopilotUsage(event);

    expect(result.inputTokens.total).toBe(0);
    expect(result.outputTokens.total).toBe(50);
    expect(result.outputTokens.text).toBe(50);
  });

  it("includes cacheReadTokens in total input", () => {
    const event: CopilotUsageEvent = {
      inputTokens: 5,
      cacheReadTokens: 3,
    };
    const result = convertCopilotUsage(event);

    expect(result.inputTokens.total).toBe(8);
    expect(result.inputTokens.noCache).toBe(5);
    expect(result.inputTokens.cacheRead).toBe(3);
  });

  it("includes cacheWriteTokens in total input", () => {
    const event: CopilotUsageEvent = {
      inputTokens: 5,
      cacheWriteTokens: 2,
    };
    const result = convertCopilotUsage(event);

    expect(result.inputTokens.total).toBe(7);
    expect(result.inputTokens.cacheWrite).toBe(2);
  });

  it("preserves raw event in output", () => {
    const event: CopilotUsageEvent = {
      inputTokens: 1,
      outputTokens: 1,
    };
    const result = convertCopilotUsage(event);
    expect(result.raw).toBe(event);
  });
});

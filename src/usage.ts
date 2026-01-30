import type { LanguageModelV3Usage } from "@ai-sdk/provider";

export interface CopilotUsageEvent {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * Creates an empty usage object for when no usage data is available.
 */
export function createEmptyUsage(): LanguageModelV3Usage {
  return {
    inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: undefined, reasoning: undefined },
    raw: undefined,
  };
}

/**
 * Converts Copilot SDK usage event to AI SDK LanguageModelV3Usage format.
 */
export function convertCopilotUsage(event: CopilotUsageEvent): LanguageModelV3Usage {
  const inputTokens = event.inputTokens ?? 0;
  const outputTokens = event.outputTokens ?? 0;
  const cacheRead = event.cacheReadTokens ?? 0;
  const cacheWrite = 0;

  return {
    inputTokens: {
      total: inputTokens + cacheRead + cacheWrite,
      noCache: inputTokens,
      cacheRead,
      cacheWrite,
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
      reasoning: undefined,
    },
    raw: event as unknown as import("@ai-sdk/provider").JSONObject,
  };
}

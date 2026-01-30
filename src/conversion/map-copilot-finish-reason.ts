import type { LanguageModelV3FinishReason } from "@ai-sdk/provider";

/**
 * Maps Copilot session completion to AI SDK finish reason.
 * Copilot doesn't expose a direct finish_reason; we infer from context.
 */
export function mapCopilotFinishReason(): LanguageModelV3FinishReason {
  return {
    unified: "stop",
    raw: undefined,
  };
}

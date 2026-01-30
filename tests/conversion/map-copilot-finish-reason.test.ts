import { describe, expect, it } from "vitest";
import { mapCopilotFinishReason } from "@/conversion/map-copilot-finish-reason.js";

describe("mapCopilotFinishReason", () => {
  it("returns stop as unified finish reason", () => {
    const result = mapCopilotFinishReason();
    expect(result).toEqual({
      unified: "stop",
      raw: undefined,
    });
  });

  it("returns a valid LanguageModelV3FinishReason shape", () => {
    const result = mapCopilotFinishReason();
    expect(result).toHaveProperty("unified", "stop");
    expect(result).toHaveProperty("raw");
  });
});

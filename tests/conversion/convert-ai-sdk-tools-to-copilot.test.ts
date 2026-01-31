import { describe, expect, it } from "vitest";
import { convertAiSdkToolsToCopilotTools } from "@/conversion/convert-ai-sdk-tools-to-copilot.js";

describe("convertAiSdkToolsToCopilotTools", () => {
  it("returns empty array when tools is undefined", () => {
    expect(convertAiSdkToolsToCopilotTools(undefined)).toEqual([]);
  });

  it("returns empty array when tools is empty", () => {
    expect(convertAiSdkToolsToCopilotTools([])).toEqual([]);
  });

  it("skips tools without providerOptions.github-copilot.execute", () => {
    const tools = [
      {
        type: "function" as const,
        name: "weather",
        description: "Get weather",
        inputSchema: { type: "object", properties: { city: { type: "string" } } },
      },
    ];
    expect(convertAiSdkToolsToCopilotTools(tools)).toEqual([]);
  });

  it("skips provider tools (type provider)", () => {
    const tools = [
      {
        type: "provider" as const,
        name: "mcp_tool",
        id: "mcp.weather",
        args: {},
      },
    ];
    expect(convertAiSdkToolsToCopilotTools(tools)).toEqual([]);
  });

  it("converts function tool with providerOptions.github-copilot.execute", () => {
    const execute = async (args: { city: string }) => ({ city: args.city, temp: 22 });
    const tools = [
      {
        type: "function" as const,
        name: "get_weather",
        description: "Get weather for a city",
        inputSchema: {
          type: "object",
          properties: { city: { type: "string", description: "City name" } },
          required: ["city"],
        },
        providerOptions: {
          "github-copilot": { execute },
        },
      },
    ];

    const result = convertAiSdkToolsToCopilotTools(tools);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("get_weather");
    expect(result[0].description).toBe("Get weather for a city");
    expect(result[0].parameters).toEqual(tools[0].inputSchema);
    expect(typeof result[0].handler).toBe("function");

    const handlerResult = result[0].handler({ city: "Tokyo" }, {} as never);
    return expect(Promise.resolve(handlerResult)).resolves.toEqual({
      city: "Tokyo",
      temp: 22,
    });
  });

  it("skips tool when providerOptions.github-copilot has no execute", () => {
    const tools = [
      {
        type: "function" as const,
        name: "weather",
        description: "Get weather",
        inputSchema: { type: "object" },
        providerOptions: {
          "github-copilot": { otherKey: "value" },
        },
      },
    ];
    expect(convertAiSdkToolsToCopilotTools(tools)).toEqual([]);
  });
});

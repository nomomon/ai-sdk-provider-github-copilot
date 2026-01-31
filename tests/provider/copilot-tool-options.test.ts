import { describe, expect, it } from "vitest";
import { copilotToolOptions } from "@/provider/copilot-tool-options.js";

describe("copilotToolOptions", () => {
  it("returns provider options with github-copilot key and execute handler", () => {
    const execute = async (args: { city: string }) => ({ city: args.city, temp: 22 });
    const result = copilotToolOptions(execute);

    expect(result).toEqual({
      "github-copilot": { execute },
    });
  });

  it("preserves execute function reference for use in tool conversion", () => {
    const execute = (args: unknown) => args;
    const result = copilotToolOptions(execute);

    expect(result["github-copilot"]).toBeDefined();
    expect(result["github-copilot"].execute).toBe(execute);
  });

  it("works with sync execute handler", () => {
    const execute = (args: { x: number }) => ({ doubled: args.x * 2 });
    const result = copilotToolOptions(execute);

    expect(result["github-copilot"].execute({ x: 5 })).toEqual({ doubled: 10 });
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@github/copilot-sdk", () => ({
  CopilotClient: vi.fn(() => ({
    getState: () => "connected",
    start: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn(),
  })),
}));

describe("index exports", () => {
  it("exports createGitHubCopilot and githubCopilot", async () => {
    const mod = await import("../src/index.js");
    expect(mod.createGitHubCopilot).toBeDefined();
    expect(typeof mod.createGitHubCopilot).toBe("function");
    expect(mod.githubCopilot).toBeDefined();
  });

  it("exports GitHubCopilotLanguageModel", async () => {
    const mod = await import("../src/index.js");
    expect(mod.GitHubCopilotLanguageModel).toBeDefined();
  });

  it("exports error utilities", async () => {
    const mod = await import("../src/index.js");
    expect(mod.createAuthenticationError).toBeDefined();
    expect(mod.createAPICallError).toBeDefined();
    expect(mod.isAuthenticationError).toBeDefined();
    expect(mod.isAbortError).toBeDefined();
    expect(mod.handleCopilotError).toBeDefined();
  });
});

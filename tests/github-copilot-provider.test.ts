import { NoSuchModelError } from "@ai-sdk/provider";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGitHubCopilot, githubCopilot } from "@/github-copilot-provider.js";

const mockCopilotClient = {
  getState: vi.fn().mockReturnValue("connected"),
  start: vi.fn().mockResolvedValue(undefined),
  createSession: vi.fn(),
};

vi.mock("@github/copilot-sdk", () => ({
  CopilotClient: vi.fn(() => mockCopilotClient),
}));

describe("createGitHubCopilot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a provider with specificationVersion v3", () => {
    const provider = createGitHubCopilot();
    expect(provider.specificationVersion).toBe("v3");
  });

  it("returns a callable provider that creates language models", () => {
    const provider = createGitHubCopilot();
    const model = provider("gpt-4");
    expect(model).toBeDefined();
    expect(model.modelId).toBe("gpt-4");
    expect(model.provider).toBe("github-copilot");
  });

  it("provider.languageModel creates same model as call", () => {
    const provider = createGitHubCopilot();
    const model1 = provider("gpt-4");
    const model2 = provider.languageModel("gpt-4");
    expect(model1.modelId).toBe(model2.modelId);
    expect(model2.modelId).toBe("gpt-4");
  });

  it("provider.chat creates same model as call", () => {
    const provider = createGitHubCopilot();
    const model = provider.chat("claude-sonnet");
    expect(model.modelId).toBe("claude-sonnet");
  });

  it("throws when called with new keyword", () => {
    const provider = createGitHubCopilot();
    expect(() => {
      new (provider as unknown as new (id: string) => unknown)("gpt-4");
    }).toThrow("The GitHub Copilot model function cannot be called with the new keyword.");
  });

  it("embeddingModel throws NoSuchModelError", () => {
    const provider = createGitHubCopilot();
    expect(() => provider.embeddingModel("text-embedding-3")).toThrow(NoSuchModelError);
    try {
      provider.embeddingModel("text-embedding-3");
    } catch (e) {
      expect(e).toBeInstanceOf(NoSuchModelError);
      expect((e as NoSuchModelError).modelId).toBe("text-embedding-3");
      expect((e as NoSuchModelError).modelType).toBe("embeddingModel");
    }
  });

  it("imageModel throws NoSuchModelError", () => {
    const provider = createGitHubCopilot();
    expect(() => provider.imageModel("dall-e-3")).toThrow(NoSuchModelError);
    try {
      provider.imageModel("dall-e-3");
    } catch (e) {
      expect(e).toBeInstanceOf(NoSuchModelError);
      expect((e as NoSuchModelError).modelId).toBe("dall-e-3");
      expect((e as NoSuchModelError).modelType).toBe("imageModel");
    }
  });

  it("getClient returns CopilotClient instance", () => {
    const provider = createGitHubCopilot();
    const client = provider.getClient();
    expect(client).toBeDefined();
    expect(client.getState).toBeDefined();
    expect(client.getState()).toBe("connected");
  });

  it("merges defaultSettings with per-call settings", () => {
    const provider = createGitHubCopilot({
      defaultSettings: { model: "gpt-4-default", sessionId: "sess-1" },
    });
    const model = provider("gpt-4", { sessionId: "sess-2" });
    expect(model.settings.model).toBe("gpt-4-default");
    expect(model.settings.sessionId).toBe("sess-2");
  });

  it("passes clientOptions to CopilotClient", async () => {
    const { CopilotClient } = await import("@github/copilot-sdk");
    const provider = createGitHubCopilot({
      clientOptions: { cliPath: "/custom/path/copilot" },
    });
    provider.getClient(); // Triggers lazy client creation
    expect(CopilotClient).toHaveBeenCalledWith({
      cliPath: "/custom/path/copilot",
    });
  });
});

describe("githubCopilot", () => {
  it("is a pre-created provider instance", () => {
    expect(githubCopilot).toBeDefined();
    expect(githubCopilot.specificationVersion).toBe("v3");
    const model = githubCopilot("gpt-4");
    expect(model.modelId).toBe("gpt-4");
  });
});

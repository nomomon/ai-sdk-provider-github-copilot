import type { CopilotClient } from "@github/copilot-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubCopilotLanguageModel } from "@/github-copilot-language-model.js";

const mockSession = {
  sendAndWait: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
  abort: vi.fn(),
  destroy: vi.fn().mockResolvedValue(undefined),
};

const mockClient = {
  getState: vi.fn().mockReturnValue("connected"),
  start: vi.fn().mockResolvedValue(undefined),
  createSession: vi.fn().mockResolvedValue(mockSession),
};

const getClientMock = vi.fn(() => mockClient);
const getClient = getClientMock as unknown as () => CopilotClient;

describe("GitHubCopilotLanguageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClientMock.mockReturnValue(mockClient);
  });

  describe("constructor and properties", () => {
    it("creates model with modelId and settings", () => {
      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });
      expect(model.modelId).toBe("gpt-4");
      expect(model.settings).toEqual({});
      expect(model.provider).toBe("github-copilot");
    });

    it("has correct specificationVersion and capabilities", () => {
      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });
      expect(model.specificationVersion).toBe("v3");
      expect(model.defaultObjectGenerationMode).toBe("json");
      expect(model.supportsImageUrls).toBe(false);
      expect(model.supportsStructuredOutputs).toBe(false);
    });

    it("uses settings.model override for effective model", () => {
      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: { model: "gpt-4-turbo" },
        getClient,
      });
      expect(model.modelId).toBe("gpt-4");
      expect(model.settings.model).toBe("gpt-4-turbo");
    });
  });

  describe("doGenerate", () => {
    it("returns content, finishReason, usage, and warnings", async () => {
      mockSession.sendAndWait.mockResolvedValue({
        data: { content: "Hello from Copilot!" },
      });

      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });

      const result = await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      });

      expect(result.content).toEqual([{ type: "text", text: "Hello from Copilot!" }]);
      expect(result.finishReason).toEqual({ unified: "stop", raw: undefined });
      expect(result.usage).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response?.modelId).toBe("gpt-4");
    });

    it("calls client.start when not connected", async () => {
      mockClient.getState.mockReturnValueOnce("disconnected");
      mockSession.sendAndWait.mockResolvedValue({ data: {} });

      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });

      await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      });

      expect(mockClient.start).toHaveBeenCalled();
    });

    it("passes system message to createSession when in prompt", async () => {
      mockSession.sendAndWait.mockResolvedValue({ data: {} });

      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });

      await model.doGenerate({
        prompt: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: [{ type: "text", text: "Hi" }] },
        ],
      });

      expect(mockClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          systemMessage: { mode: "append", content: "You are helpful." },
        }),
      );
    });

    it("includes usage from result when present", async () => {
      mockSession.sendAndWait.mockResolvedValue({
        data: {
          content: "Hi",
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            cacheReadTokens: 2,
          },
        },
      });

      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });

      const result = await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      });

      expect(result.usage.inputTokens.total).toBe(12); // 10 + 2
      expect(result.usage.outputTokens.total).toBe(5);
    });

    it("generates warnings for unsupported parameters", async () => {
      mockSession.sendAndWait.mockResolvedValue({ data: {} });

      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });

      const result = await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        temperature: 0.7,
        topP: 0.9,
      });

      const unsupportedWarnings = result.warnings.filter((w) => w.type === "unsupported");
      expect(unsupportedWarnings).toHaveLength(2);
      expect(unsupportedWarnings.some((w) => w.feature === "temperature")).toBe(true);
      expect(unsupportedWarnings.some((w) => w.feature === "topP")).toBe(true);
    });

    it("calls session.destroy in finally block", async () => {
      mockSession.sendAndWait.mockResolvedValue({ data: {} });

      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });

      await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      });

      expect(mockSession.destroy).toHaveBeenCalled();
    });
  });

  describe("doStream", () => {
    it("returns stream and request", async () => {
      mockSession.send.mockResolvedValue(undefined);
      // Simulate session.idle after send
      mockSession.on.mockImplementation((callback: (e: unknown) => void) => {
        setTimeout(() => {
          callback({ type: "session.idle" });
        }, 0);
      });

      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });

      const { stream, request } = await model.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      });

      expect(stream).toBeInstanceOf(ReadableStream);
      expect(request).toBeDefined();
      expect(request?.body).toEqual({
        prompt: "User: Hi",
        attachments: undefined,
      });
    });

    it("passes streaming: true to createSession", async () => {
      mockSession.send.mockResolvedValue(undefined);
      mockSession.on.mockImplementation((callback: (e: unknown) => void) => {
        setTimeout(() => callback({ type: "session.idle" }), 0);
      });

      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });

      await model.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      });

      expect(mockClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ streaming: true }),
      );
    });
  });

  describe("doGenerate error handling", () => {
    it("rethrows AbortError when sendAndWait rejects with AbortError", async () => {
      const abortReason = new Error("User cancelled");
      const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
      mockSession.sendAndWait.mockRejectedValue(abortError);

      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });

      const abortController = new AbortController();
      abortController.abort(abortReason);

      await expect(
        model.doGenerate({
          prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
          abortSignal: abortController.signal,
        }),
      ).rejects.toThrow(abortReason);
    });

    it("throws APICallError when sendAndWait rejects with non-abort error", async () => {
      const { APICallError } = await import("@ai-sdk/provider");
      mockSession.sendAndWait.mockRejectedValue(new Error("Connection failed"));

      const model = new GitHubCopilotLanguageModel({
        modelId: "gpt-4",
        settings: {},
        getClient,
      });

      await expect(
        model.doGenerate({
          prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        }),
      ).rejects.toThrow(APICallError);
    });
  });
});

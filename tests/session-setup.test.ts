import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareSession } from "@/session-setup.js";

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

describe("prepareSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.getState.mockReturnValue("connected");
    mockClient.createSession.mockResolvedValue(mockSession);
  });

  it("converts prompt via convertToCopilotMessages and returns prompt text", async () => {
    const result = await prepareSession({
      prompt: [{ role: "user", content: "Hello" }],
      options: {},
      streaming: false,
      buildSessionConfig: () => ({ model: "gpt-4", streaming: false }),
      generateWarnings: () => [],
      getClient: () => mockClient as never,
    });

    expect(result.prompt).toBe("User: Hello");
    expect(result.attachments).toBeUndefined();
  });

  it("merges buildSessionConfig with streaming flag", async () => {
    const buildSessionConfig = vi.fn((streaming: boolean) => ({
      model: "gpt-4",
      streaming,
      customKey: "value",
    }));

    await prepareSession({
      prompt: [{ role: "user", content: "Hi" }],
      options: {},
      streaming: true,
      buildSessionConfig,
      generateWarnings: () => [],
      getClient: () => mockClient as never,
    });

    expect(buildSessionConfig).toHaveBeenCalledWith(true);
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4",
        streaming: true,
        customKey: "value",
      }),
    );
  });

  it("calls client.start when not connected", async () => {
    mockClient.getState.mockReturnValue("disconnected");

    await prepareSession({
      prompt: [{ role: "user", content: "Hi" }],
      options: {},
      streaming: false,
      buildSessionConfig: () => ({}),
      generateWarnings: () => [],
      getClient: () => mockClient as never,
    });

    expect(mockClient.start).toHaveBeenCalled();
  });

  it("does not call client.start when already connected", async () => {
    mockClient.getState.mockReturnValue("connected");

    await prepareSession({
      prompt: [{ role: "user", content: "Hi" }],
      options: {},
      streaming: false,
      buildSessionConfig: () => ({}),
      generateWarnings: () => [],
      getClient: () => mockClient as never,
    });

    expect(mockClient.start).not.toHaveBeenCalled();
  });

  it("merges generateWarnings with message warnings from convertToCopilotMessages", async () => {
    const result = await prepareSession({
      prompt: [
        {
          role: "user",
          content: [{ type: "file", data: "https://example.com/image.png" }],
        },
      ],
      options: { temperature: 0.7 },
      streaming: false,
      buildSessionConfig: () => ({}),
      generateWarnings: (_opts) => [
        { type: "unsupported", feature: "temperature", details: "Not supported" },
      ],
      getClient: () => mockClient as never,
    });

    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.some((w) => w.type === "unsupported")).toBe(true);
    expect(result.warnings.some((w) => w.type === "other")).toBe(true);
  });

  it("passes system message from prompt to createSession when present", async () => {
    await prepareSession({
      prompt: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi" },
      ],
      options: {},
      streaming: false,
      buildSessionConfig: () => ({}),
      generateWarnings: () => [],
      getClient: () => mockClient as never,
    });

    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        systemMessage: { mode: "append", content: "You are helpful." },
      }),
    );
  });

  it("uses systemMessageFromSettings when no system message in prompt", async () => {
    const systemMessageFromSettings = { mode: "replace" as const, content: "Default system" };

    await prepareSession({
      prompt: [{ role: "user", content: "Hi" }],
      options: {},
      streaming: false,
      buildSessionConfig: () => ({}),
      generateWarnings: () => [],
      getClient: () => mockClient as never,
      systemMessageFromSettings,
    });

    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        systemMessage: systemMessageFromSettings,
      }),
    );
  });

  it("returns attachments when prompt has file attachments", async () => {
    const result = await prepareSession({
      prompt: [
        {
          role: "user",
          content: [
            { type: "text", text: "Review" },
            { type: "file", data: "file:///tmp/foo.ts", filename: "foo.ts" },
          ],
        },
      ],
      options: {},
      streaming: false,
      buildSessionConfig: () => ({}),
      generateWarnings: () => [],
      getClient: () => mockClient as never,
    });

    expect(result.attachments).toEqual([
      { type: "file", path: "/tmp/foo.ts", displayName: "foo.ts" },
    ]);
  });

  it("returns session from client.createSession", async () => {
    const result = await prepareSession({
      prompt: [{ role: "user", content: "Hi" }],
      options: {},
      streaming: false,
      buildSessionConfig: () => ({}),
      generateWarnings: () => [],
      getClient: () => mockClient as never,
    });

    expect(result.session).toBe(mockSession);
  });
});

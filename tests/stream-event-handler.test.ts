import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStreamEventHandler } from "@/stream-event-handler.js";

function createMockController() {
  const enqueued: unknown[] = [];
  return {
    enqueue: vi.fn((chunk: unknown) => {
      enqueued.push(chunk);
    }),
    close: vi.fn(),
    get enqueued() {
      return enqueued;
    },
  };
}

function createMockSession() {
  return {
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

function makeEvent<T extends { type: string; data: object }>(type: T["type"], data: T["data"]): T {
  return {
    id: "evt-1",
    timestamp: new Date().toISOString(),
    parentId: null,
    type,
    data,
  } as T;
}

describe("createStreamEventHandler", () => {
  let controller: ReturnType<typeof createMockController>;
  let session: ReturnType<typeof createMockSession>;

  beforeEach(() => {
    controller = createMockController();
    session = createMockSession();
  });

  it("emits text-start and text-delta for assistant.message_delta", () => {
    const handler = createStreamEventHandler({
      controller: controller as never,
      session: session as never,
    });

    handler(
      makeEvent("assistant.message_delta", {
        messageId: "msg-1",
        deltaContent: "Hello",
      }) as never,
    );

    expect(controller.enqueue).toHaveBeenCalledTimes(2);
    expect(controller.enqueued[0]).toMatchObject({
      type: "text-start",
      id: expect.any(String),
    });
    expect(controller.enqueued[1]).toMatchObject({
      type: "text-delta",
      delta: "Hello",
    });
  });

  it("emits reasoning parts for assistant.reasoning_delta", () => {
    const handler = createStreamEventHandler({
      controller: controller as never,
      session: session as never,
    });

    handler(
      makeEvent("assistant.reasoning_delta", {
        reasoningId: "r-1",
        deltaContent: "Let me think...",
      }) as never,
    );

    expect(controller.enqueue).toHaveBeenCalledTimes(3);
    expect(controller.enqueued[0]).toMatchObject({
      type: "reasoning-start",
      id: expect.any(String),
    });
    expect(controller.enqueued[1]).toMatchObject({
      type: "reasoning-delta",
      delta: "Let me think...",
    });
    expect(controller.enqueued[2]).toMatchObject({
      type: "reasoning-end",
      id: expect.any(String),
    });
  });

  it("emits text parts for assistant.message with content", () => {
    const handler = createStreamEventHandler({
      controller: controller as never,
      session: session as never,
    });

    handler(
      makeEvent("assistant.message", {
        messageId: "msg-1",
        content: "Full response",
        toolRequests: undefined,
      }) as never,
    );

    expect(controller.enqueue).toHaveBeenCalledTimes(3);
    expect(controller.enqueued[0]).toMatchObject({ type: "text-start" });
    expect(controller.enqueued[1]).toMatchObject({
      type: "text-delta",
      delta: "Full response",
    });
    expect(controller.enqueued[2]).toMatchObject({ type: "text-end" });
  });

  it("emits tool-call parts for assistant.message with toolRequests", () => {
    const handler = createStreamEventHandler({
      controller: controller as never,
      session: session as never,
    });

    handler(
      makeEvent("assistant.message", {
        messageId: "msg-1",
        content: "",
        toolRequests: [
          {
            toolCallId: "tc-1",
            name: "get_weather",
            arguments: { city: "SF" },
          },
        ],
      }) as never,
    );

    expect(controller.enqueue).toHaveBeenCalledTimes(4);
    expect(controller.enqueued[0]).toMatchObject({
      type: "tool-input-start",
      id: "tc-1",
      toolName: "get_weather",
    });
    expect(controller.enqueued[1]).toMatchObject({
      type: "tool-input-delta",
      id: "tc-1",
      delta: '{"city":"SF"}',
    });
    expect(controller.enqueued[2]).toMatchObject({ type: "tool-input-end", id: "tc-1" });
    expect(controller.enqueued[3]).toMatchObject({
      type: "tool-call",
      toolCallId: "tc-1",
      toolName: "get_weather",
      input: '{"city":"SF"}',
    });
  });

  it("emits tool parts for tool.execution_start", () => {
    const handler = createStreamEventHandler({
      controller: controller as never,
      session: session as never,
    });

    handler(
      makeEvent("tool.execution_start", {
        toolCallId: "tc-2",
        toolName: "search",
      }) as never,
    );

    expect(controller.enqueue).toHaveBeenCalledTimes(3);
    expect(controller.enqueued[0]).toMatchObject({
      type: "tool-input-start",
      id: "tc-2",
      toolName: "search",
    });
    expect(controller.enqueued[1]).toMatchObject({ type: "tool-input-end", id: "tc-2" });
    expect(controller.enqueued[2]).toMatchObject({
      type: "tool-call",
      toolCallId: "tc-2",
      toolName: "search",
      input: "{}",
    });
  });

  it("emits tool-result for tool.execution_complete after tool.execution_start", async () => {
    const handler = createStreamEventHandler({
      controller: controller as never,
      session: session as never,
    });

    handler(
      makeEvent("tool.execution_start", {
        toolCallId: "tc-3",
        toolName: "fetch",
      }) as never,
    );
    controller.enqueued.length = 0;
    controller.enqueue.mockClear();

    handler(
      makeEvent("tool.execution_complete", {
        toolCallId: "tc-3",
        success: true,
        result: { content: "Done" },
      }) as never,
    );

    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tool-result",
        toolCallId: "tc-3",
        toolName: "fetch",
        result: "Done",
        isError: false,
      }),
    );
  });

  it("emits tool-result with error for failed tool.execution_complete", () => {
    const handler = createStreamEventHandler({
      controller: controller as never,
      session: session as never,
    });

    handler(
      makeEvent("tool.execution_start", {
        toolCallId: "tc-4",
        toolName: "fail_tool",
      }) as never,
    );
    controller.enqueued.length = 0;
    controller.enqueue.mockClear();

    handler(
      makeEvent("tool.execution_complete", {
        toolCallId: "tc-4",
        success: false,
        error: { message: "Tool failed" },
      }) as never,
    );

    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tool-result",
        toolCallId: "tc-4",
        toolName: "fail_tool",
        result: "Tool failed",
        isError: true,
      }),
    );
  });

  it("closes stream and destroys session on session.idle", () => {
    const handler = createStreamEventHandler({
      controller: controller as never,
      session: session as never,
    });

    handler(makeEvent("session.idle", {}) as never);

    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "finish",
        finishReason: { unified: "stop", raw: undefined },
      }),
    );
    expect(controller.close).toHaveBeenCalled();
    expect(session.destroy).toHaveBeenCalled();
  });

  it("emits error and closes stream on session.error", () => {
    const handler = createStreamEventHandler({
      controller: controller as never,
      session: session as never,
    });

    handler(
      makeEvent("session.error", {
        errorType: "ConnectionError",
        message: "Connection lost",
      }) as never,
    );

    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({ message: "Connection lost" }),
      }),
    );
    expect(controller.close).toHaveBeenCalled();
    expect(session.destroy).toHaveBeenCalled();
  });

  it("updates usage on assistant.usage and includes in finish", async () => {
    const handler = createStreamEventHandler({
      controller: controller as never,
      session: session as never,
    });

    handler(
      makeEvent("assistant.usage", {
        inputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: 2,
      }) as never,
    );
    handler(makeEvent("session.idle", {}) as never);

    const finishCall = controller.enqueued.find(
      (c: { type?: string }) => c && typeof c === "object" && "type" in c && c.type === "finish",
    );
    expect(finishCall).toBeDefined();
    expect(finishCall).toMatchObject({
      type: "finish",
      usage: expect.objectContaining({
        inputTokens: expect.objectContaining({ total: 12 }),
        outputTokens: expect.objectContaining({ total: 5 }),
      }),
    });
  });
});

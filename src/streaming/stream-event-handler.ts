/**
 * Stream event handler for GitHub Copilot SDK.
 *
 * Listens to Copilot session events (message_delta, tool.execution_*, session.idle,
 * etc.) and enqueues corresponding AI SDK stream parts (text-delta, tool-call,
 * tool-result, finish) to the ReadableStream controller.
 */
import type { LanguageModelV3StreamPart, LanguageModelV3Usage } from "@ai-sdk/provider";
import { generateId } from "@ai-sdk/provider-utils";
import type { CopilotSession, SessionEvent } from "@github/copilot-sdk";
import { mapCopilotFinishReason } from "../conversion/map-copilot-finish-reason.js";
import type { CopilotUsageEvent } from "../conversion/usage.js";
import { convertCopilotUsage, createEmptyUsage } from "../conversion/usage.js";

interface ToolState {
  name: string;
  inputStarted: boolean;
  callEmitted: boolean;
}

export interface StreamEventHandlerParams {
  controller: ReadableStreamDefaultController<LanguageModelV3StreamPart>;
  session: CopilotSession;
}

/**
 * Creates an event handler for Copilot session events that enqueues
 * AI SDK stream parts to the controller.
 */
export function createStreamEventHandler(
  params: StreamEventHandlerParams,
): (event: SessionEvent) => void {
  const { controller, session } = params;
  let textPartId: string | undefined;
  let usage: LanguageModelV3Usage = createEmptyUsage();
  const toolStates = new Map<string, ToolState>();

  const finishStream = () => {
    if (textPartId) {
      controller.enqueue({ type: "text-end", id: textPartId });
    }
    controller.enqueue({
      type: "finish",
      finishReason: mapCopilotFinishReason(),
      usage,
    });
    controller.close();
    void session.destroy();
  };

  const handleError = (message: string) => {
    controller.enqueue({
      type: "error",
      error: new Error(message),
    });
    controller.close();
    void session.destroy();
  };

  return (event: SessionEvent) => {
    switch (event.type) {
      case "assistant.message_delta": {
        const delta = event.data.deltaContent;
        if (delta) {
          if (!textPartId) {
            textPartId = generateId();
            controller.enqueue({ type: "text-start", id: textPartId });
          }
          controller.enqueue({
            type: "text-delta",
            id: textPartId,
            delta,
          });
        }
        break;
      }
      case "assistant.reasoning_delta": {
        const delta = event.data.deltaContent;
        if (delta) {
          const reasoningId = generateId();
          controller.enqueue({ type: "reasoning-start", id: reasoningId });
          controller.enqueue({
            type: "reasoning-delta",
            id: reasoningId,
            delta,
          });
          controller.enqueue({ type: "reasoning-end", id: reasoningId });
        }
        break;
      }
      case "assistant.message": {
        const { content, toolRequests } = event.data;
        if (content && !textPartId) {
          textPartId = generateId();
          controller.enqueue({ type: "text-start", id: textPartId });
          controller.enqueue({
            type: "text-delta",
            id: textPartId,
            delta: content,
          });
          controller.enqueue({ type: "text-end", id: textPartId });
        }
        if (toolRequests?.length) {
          for (const tr of toolRequests) {
            const toolId = tr.toolCallId;
            let state = toolStates.get(toolId);
            if (!state) {
              state = {
                name: tr.name,
                inputStarted: false,
                callEmitted: false,
              };
              toolStates.set(toolId, state);
            }
            if (!state.inputStarted) {
              controller.enqueue({
                type: "tool-input-start",
                id: toolId,
                toolName: tr.name,
                providerExecuted: true,
                dynamic: true,
              });
              state.inputStarted = true;
            }
            const args = tr.arguments ?? {};
            controller.enqueue({
              type: "tool-input-delta",
              id: toolId,
              delta: JSON.stringify(args),
            });
            controller.enqueue({ type: "tool-input-end", id: toolId });
            if (!state.callEmitted) {
              controller.enqueue({
                type: "tool-call",
                toolCallId: toolId,
                toolName: tr.name,
                input: typeof args === "string" ? args : JSON.stringify(args),
                providerExecuted: true,
                dynamic: true,
              });
              state.callEmitted = true;
            }
          }
        }
        break;
      }
      case "tool.execution_start": {
        const { toolCallId, toolName } = event.data;
        let state = toolStates.get(toolCallId);
        if (!state) {
          state = {
            name: toolName,
            inputStarted: true,
            callEmitted: false,
          };
          toolStates.set(toolCallId, state);
        }
        if (!state.callEmitted) {
          controller.enqueue({
            type: "tool-input-start",
            id: toolCallId,
            toolName,
            providerExecuted: true,
            dynamic: true,
          });
          controller.enqueue({ type: "tool-input-end", id: toolCallId });
          controller.enqueue({
            type: "tool-call",
            toolCallId,
            toolName,
            input: "{}",
            providerExecuted: true,
            dynamic: true,
          });
          state.callEmitted = true;
        }
        break;
      }
      case "tool.execution_complete": {
        const { toolCallId, success, result, error } = event.data;
        const toolNameStr = toolStates.get(toolCallId)?.name ?? "unknown";
        const resultContent =
          success && result?.content ? result.content : (error?.message ?? "Tool execution failed");
        controller.enqueue({
          type: "tool-result",
          toolCallId,
          toolName: toolNameStr,
          result: resultContent as NonNullable<import("@ai-sdk/provider").JSONValue>,
          isError: !success,
          dynamic: true,
        });
        break;
      }
      case "assistant.usage": {
        usage = convertCopilotUsage(event.data as CopilotUsageEvent);
        break;
      }
      case "session.idle":
        finishStream();
        break;
      case "session.error":
        handleError(event.data.message ?? "Session error");
        break;
    }
  };
}

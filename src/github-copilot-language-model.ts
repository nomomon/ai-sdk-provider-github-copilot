import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
  SharedV3Warning,
} from "@ai-sdk/provider";
import { generateId } from "@ai-sdk/provider-utils";
import type { CopilotClient } from "@github/copilot-sdk";
import { convertToCopilotMessages } from "./convert-to-copilot-messages.js";
import { handleCopilotError, isAbortError } from "./errors.js";
import { mapCopilotFinishReason } from "./map-copilot-finish-reason.js";
import type { GitHubCopilotSettings } from "./types.js";

export interface GitHubCopilotLanguageModelOptions {
  modelId: string;
  settings: GitHubCopilotSettings;
  getClient: () => CopilotClient;
}

function createEmptyUsage(): LanguageModelV3Usage {
  return {
    inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: undefined, reasoning: undefined },
    raw: undefined,
  };
}

function convertCopilotUsage(event: {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}): LanguageModelV3Usage {
  const inputTokens = event.inputTokens ?? 0;
  const outputTokens = event.outputTokens ?? 0;
  const cacheRead = event.cacheReadTokens ?? 0;
  const cacheWrite = 0;

  return {
    inputTokens: {
      total: inputTokens + cacheRead + cacheWrite,
      noCache: inputTokens,
      cacheRead,
      cacheWrite,
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
      reasoning: undefined,
    },
    raw: event as unknown as import("@ai-sdk/provider").JSONObject,
  };
}

/**
 * Language model implementation for GitHub Copilot SDK.
 */
export class GitHubCopilotLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly defaultObjectGenerationMode = "json" as const;
  readonly supportsImageUrls = false;
  readonly supportedUrls: Record<string, RegExp[]> = {};
  readonly supportsStructuredOutputs = false;

  readonly modelId: string;
  readonly settings: GitHubCopilotSettings;
  private readonly getClient: () => CopilotClient;

  constructor(options: GitHubCopilotLanguageModelOptions) {
    this.modelId = options.modelId;
    this.settings = options.settings;
    this.getClient = options.getClient;
  }

  get provider(): string {
    return "github-copilot";
  }

  private getEffectiveModel(): string {
    return this.settings.model ?? this.modelId;
  }

  private buildSessionConfig(streaming: boolean) {
    return {
      model: this.getEffectiveModel(),
      sessionId: this.settings.sessionId,
      streaming,
      systemMessage: this.settings.systemMessage,
      tools: this.settings.tools,
      provider: this.settings.provider,
      workingDirectory: this.settings.workingDirectory,
    };
  }

  private generateWarnings(options: LanguageModelV3CallOptions): SharedV3Warning[] {
    const warnings: SharedV3Warning[] = [];
    const unsupported: string[] = [];

    if (options.temperature !== undefined) unsupported.push("temperature");
    if (options.topP !== undefined) unsupported.push("topP");
    if (options.topK !== undefined) unsupported.push("topK");
    if (options.presencePenalty !== undefined) unsupported.push("presencePenalty");
    if (options.frequencyPenalty !== undefined) unsupported.push("frequencyPenalty");
    if (options.stopSequences?.length) unsupported.push("stopSequences");
    if (options.seed !== undefined) unsupported.push("seed");

    for (const param of unsupported) {
      warnings.push({
        type: "unsupported",
        feature: param,
        details: `GitHub Copilot SDK does not support the ${param} parameter. It will be ignored.`,
      });
    }

    return warnings;
  }

  async doGenerate(
    options: LanguageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV3["doGenerate"]>>> {
    const {
      prompt,
      systemMessage,
      attachments,
      warnings: msgWarnings,
    } = convertToCopilotMessages(options.prompt);

    const warnings: SharedV3Warning[] = [
      ...this.generateWarnings(options),
      ...(msgWarnings?.map((m) => ({ type: "other" as const, message: m })) ?? []),
    ];

    const client = this.getClient();
    if (client.getState() !== "connected") {
      await client.start();
    }

    const session = await client.createSession({
      ...this.buildSessionConfig(false),
      systemMessage: systemMessage
        ? { mode: "append", content: systemMessage }
        : this.settings.systemMessage,
    });

    let abortListener: (() => void) | undefined;
    if (options.abortSignal) {
      abortListener = () => session.abort();
      options.abortSignal.addEventListener("abort", abortListener, { once: true });
    }

    try {
      const result = await session.sendAndWait(
        { prompt, attachments },
        options.abortSignal?.aborted ? 0 : 60_000,
      );

      const content: LanguageModelV3Content[] = [];
      const text = result?.data?.content ?? "";
      if (text) {
        content.push({ type: "text", text });
      }

      let usage: LanguageModelV3Usage = createEmptyUsage();
      const usageEvent = (result as { data?: { usage?: unknown } })?.data?.usage;
      if (usageEvent && typeof usageEvent === "object") {
        usage = convertCopilotUsage(usageEvent as Parameters<typeof convertCopilotUsage>[0]);
      }

      const finishReason: LanguageModelV3FinishReason = mapCopilotFinishReason();

      return {
        content,
        finishReason,
        usage,
        warnings,
        request: { body: { prompt, attachments } },
        response: {
          id: generateId(),
          timestamp: new Date(),
          modelId: this.modelId,
        },
      };
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw options.abortSignal?.aborted ? options.abortSignal.reason : error;
      }
      handleCopilotError(error, { promptExcerpt: prompt.substring(0, 200) });
      return undefined as never;
    } finally {
      if (options.abortSignal && abortListener) {
        options.abortSignal.removeEventListener("abort", abortListener);
      }
      try {
        await session.destroy();
      } catch {
        // Ignore destroy errors
      }
    }
  }

  async doStream(
    options: LanguageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV3["doStream"]>>> {
    const {
      prompt,
      systemMessage,
      attachments,
      warnings: msgWarnings,
    } = convertToCopilotMessages(options.prompt);

    const warnings: SharedV3Warning[] = [
      ...this.generateWarnings(options),
      ...(msgWarnings?.map((m) => ({ type: "other" as const, message: m })) ?? []),
    ];

    const client = this.getClient();
    if (client.getState() !== "connected") {
      await client.start();
    }

    const session = await client.createSession({
      ...this.buildSessionConfig(true),
      systemMessage: systemMessage
        ? { mode: "append", content: systemMessage }
        : this.settings.systemMessage,
    });

    const abortController = new AbortController();
    let abortListener: (() => void) | undefined;
    if (options.abortSignal?.aborted) {
      abortController.abort(options.abortSignal.reason);
    } else if (options.abortSignal) {
      abortListener = () => {
        session.abort();
        abortController.abort(options.abortSignal?.reason);
      };
      options.abortSignal.addEventListener("abort", abortListener, { once: true });
    }

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      start: async (controller) => {
        let textPartId: string | undefined;
        let usage: LanguageModelV3Usage = createEmptyUsage();
        const toolStates = new Map<
          string,
          { name: string; inputStarted: boolean; callEmitted: boolean }
        >();

        try {
          controller.enqueue({ type: "stream-start", warnings });

          session.on((event) => {
            if (event.type === "assistant.message_delta") {
              const delta = (event as { data?: { deltaContent?: string } }).data?.deltaContent;
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
            } else if (event.type === "assistant.reasoning_delta") {
              const delta = (event as { data?: { deltaContent?: string } }).data?.deltaContent;
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
            } else if (event.type === "assistant.message") {
              const data = (event as { data?: { content?: string; toolRequests?: unknown[] } })
                .data;
              if (data?.content && !textPartId) {
                textPartId = generateId();
                controller.enqueue({ type: "text-start", id: textPartId });
                controller.enqueue({
                  type: "text-delta",
                  id: textPartId,
                  delta: data.content,
                });
                controller.enqueue({ type: "text-end", id: textPartId });
              }
              if (data?.toolRequests?.length) {
                for (const tr of data.toolRequests as Array<{
                  toolCallId: string;
                  name: string;
                  arguments?: unknown;
                }>) {
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
            } else if (event.type === "tool.execution_start") {
              const data = (event as { data?: { toolCallId: string; toolName: string } }).data;
              if (data) {
                const toolId = data.toolCallId;
                let state = toolStates.get(toolId);
                if (!state) {
                  state = {
                    name: data.toolName,
                    inputStarted: true,
                    callEmitted: false,
                  };
                  toolStates.set(toolId, state);
                }
                if (!state.callEmitted) {
                  controller.enqueue({
                    type: "tool-input-start",
                    id: toolId,
                    toolName: data.toolName,
                    providerExecuted: true,
                    dynamic: true,
                  });
                  controller.enqueue({ type: "tool-input-end", id: toolId });
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: toolId,
                    toolName: data.toolName,
                    input: "{}",
                    providerExecuted: true,
                    dynamic: true,
                  });
                  state.callEmitted = true;
                }
              }
            } else if (event.type === "tool.execution_complete") {
              const evt = event as {
                data?: {
                  toolCallId: string;
                  toolName?: string;
                  success: boolean;
                  result?: { content?: string };
                  error?: { message?: string };
                };
              };
              const data = evt.data;
              if (data) {
                const toolName = data.toolName ?? "unknown";
                const result =
                  data.success && data.result?.content
                    ? data.result.content
                    : (data.error?.message ?? "Tool execution failed");
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: data.toolCallId,
                  toolName,
                  result: result as NonNullable<import("@ai-sdk/provider").JSONValue>,
                  isError: !data.success,
                  dynamic: true,
                });
              }
            } else if (event.type === "assistant.usage") {
              const data = (event as { data?: Parameters<typeof convertCopilotUsage>[0] }).data;
              if (data) {
                usage = convertCopilotUsage(data);
              }
            } else if (event.type === "session.idle") {
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
            } else if (event.type === "session.error") {
              const data = (event as { data?: { message?: string } }).data;
              controller.enqueue({
                type: "error",
                error: new Error(data?.message ?? "Session error"),
              });
              controller.close();
              void session.destroy();
            }
          });

          await session.send({ prompt, attachments });
        } catch (error: unknown) {
          if (isAbortError(error)) {
            controller.enqueue({
              type: "error",
              error: options.abortSignal?.aborted ? options.abortSignal.reason : error,
            });
          } else {
            handleCopilotError(error, { promptExcerpt: prompt.substring(0, 200) });
          }
          controller.close();
          await session.destroy();
        } finally {
          if (options.abortSignal && abortListener) {
            options.abortSignal.removeEventListener("abort", abortListener);
          }
        }
      },
      cancel: () => {
        if (options.abortSignal && abortListener) {
          options.abortSignal.removeEventListener("abort", abortListener);
        }
      },
    });

    return {
      stream: stream as ReadableStream<LanguageModelV3StreamPart>,
      request: { body: { prompt, attachments } },
    };
  }
}

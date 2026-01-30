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
import { handleCopilotError, isAbortError } from "./errors.js";

/** Default timeout (ms) for sendAndWait when not aborted. */
const SEND_AND_WAIT_TIMEOUT_MS = 60_000;

/**
 * Adds an abort listener to the signal and returns a cleanup function.
 * Call the returned function to remove the listener (e.g. in finally).
 */
function addAbortListener(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) return () => {};
  signal.addEventListener("abort", onAbort, { once: true });
  return () => signal.removeEventListener("abort", onAbort);
}

import { mapCopilotFinishReason } from "./map-copilot-finish-reason.js";
import { prepareSession } from "./session-setup.js";
import { createStreamEventHandler } from "./stream-event-handler.js";
import type { GitHubCopilotSettings } from "./types.js";
import type { CopilotUsageEvent } from "./usage.js";
import { convertCopilotUsage, createEmptyUsage } from "./usage.js";

export interface GitHubCopilotLanguageModelOptions {
  modelId: string;
  settings: GitHubCopilotSettings;
  getClient: () => CopilotClient;
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

  private async prepareSessionForCall(options: LanguageModelV3CallOptions, streaming: boolean) {
    return prepareSession({
      prompt: options.prompt,
      options,
      streaming,
      buildSessionConfig: (s) => this.buildSessionConfig(s),
      generateWarnings: (o) => this.generateWarnings(o),
      getClient: this.getClient,
      systemMessageFromSettings: this.settings.systemMessage,
    });
  }

  async doGenerate(
    options: LanguageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV3["doGenerate"]>>> {
    const { prompt, attachments, warnings, session } = await this.prepareSessionForCall(
      options,
      false,
    );

    const removeAbortListener = addAbortListener(options.abortSignal, () => session.abort());

    try {
      const result = await session.sendAndWait(
        { prompt, attachments },
        options.abortSignal?.aborted ? 0 : SEND_AND_WAIT_TIMEOUT_MS,
      );

      const content: LanguageModelV3Content[] = [];
      const text = result?.data?.content ?? "";
      if (text) {
        content.push({ type: "text", text });
      }

      let usage: LanguageModelV3Usage = createEmptyUsage();
      const usageEvent = (result as { data?: { usage?: unknown } })?.data?.usage;
      if (usageEvent && typeof usageEvent === "object") {
        usage = convertCopilotUsage(usageEvent as CopilotUsageEvent);
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
      handleCopilotError(error);
      return undefined as never;
    } finally {
      removeAbortListener();
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
    const { prompt, attachments, warnings, session } = await this.prepareSessionForCall(
      options,
      true,
    );

    const abortController = new AbortController();
    if (options.abortSignal?.aborted) {
      abortController.abort(options.abortSignal.reason);
    }
    const removeAbortListener = addAbortListener(options.abortSignal, () => {
      session.abort();
      abortController.abort(options.abortSignal?.reason);
    });

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      start: async (controller) => {
        try {
          controller.enqueue({ type: "stream-start", warnings });

          const handleEvent = createStreamEventHandler({
            controller,
            session,
          });
          session.on(handleEvent);

          await session.send({ prompt, attachments });
        } catch (error: unknown) {
          if (isAbortError(error)) {
            controller.enqueue({
              type: "error",
              error: options.abortSignal?.aborted ? options.abortSignal.reason : error,
            });
          } else {
            handleCopilotError(error);
          }
          controller.close();
          await session.destroy();
        } finally {
          removeAbortListener();
        }
      },
      cancel: () => {
        removeAbortListener();
      },
    });

    return {
      stream: stream as ReadableStream<LanguageModelV3StreamPart>,
      request: { body: { prompt, attachments } },
    };
  }
}

/**
 * Session setup for GitHub Copilot SDK.
 *
 * Orchestrates the flow: convert AI SDK prompt → build warnings → ensure client
 * connected → create Copilot session with merged config. Used by both doGenerate
 * and doStream in the language model.
 */
import type {
  LanguageModelV3CallOptions,
  LanguageModelV3Prompt,
  SharedV3Warning,
} from "@ai-sdk/provider";
import type { CopilotClient, SystemMessageConfig } from "@github/copilot-sdk";
import { convertToCopilotMessages } from "./convert-to-copilot-messages.js";

export interface SessionSetupInput {
  prompt: LanguageModelV3Prompt;
  options: LanguageModelV3CallOptions;
  streaming: boolean;
  buildSessionConfig: (streaming: boolean) => Record<string, unknown>;
  generateWarnings: (options: LanguageModelV3CallOptions) => SharedV3Warning[];
  getClient: () => CopilotClient;
  systemMessageFromSettings?: SystemMessageConfig;
}

export interface SessionSetupResult {
  prompt: string;
  attachments:
    | Array<{ type: "file" | "directory"; path: string; displayName?: string }>
    | undefined;
  warnings: SharedV3Warning[];
  session: Awaited<ReturnType<CopilotClient["createSession"]>>;
}

/**
 * Prepares a Copilot session for generation or streaming.
 * Handles message conversion, warnings, client startup, and session creation.
 */
export async function prepareSession(input: SessionSetupInput): Promise<SessionSetupResult> {
  const {
    prompt,
    options,
    streaming,
    buildSessionConfig,
    generateWarnings,
    getClient,
    systemMessageFromSettings,
  } = input;

  const {
    prompt: promptText,
    systemMessage,
    attachments,
    warnings: msgWarnings,
  } = convertToCopilotMessages(prompt);

  const warnings: SharedV3Warning[] = [
    ...generateWarnings(options),
    ...(msgWarnings?.map((m) => ({ type: "other" as const, message: m })) ?? []),
  ];

  const client = getClient();
  if (client.getState() !== "connected") {
    await client.start();
  }

  const session = await client.createSession({
    ...buildSessionConfig(streaming),
    systemMessage: systemMessage
      ? { mode: "append", content: systemMessage }
      : systemMessageFromSettings,
  });

  return {
    prompt: promptText,
    attachments,
    warnings,
    session,
  };
}

import type { LanguageModelV3, ProviderV3 } from "@ai-sdk/provider";
import { NoSuchModelError } from "@ai-sdk/provider";
import type { CopilotClient } from "@github/copilot-sdk";
import { CopilotClient as CopilotClientClass } from "@github/copilot-sdk";
import { GitHubCopilotLanguageModel } from "../model/github-copilot-language-model.js";
import type { GitHubCopilotProviderOptions, GitHubCopilotSettings } from "./types.js";

/**
 * Supported Copilot model identifiers.
 * Use model IDs available via Copilot CLI (e.g., "gpt-5", "claude-sonnet-4.5").
 */
export type GitHubCopilotModelId = string;

/**
 * GitHub Copilot provider interface extending ProviderV3.
 */
export interface GitHubCopilotProvider extends ProviderV3 {
  (modelId: GitHubCopilotModelId, settings?: GitHubCopilotSettings): LanguageModelV3;
  languageModel(modelId: GitHubCopilotModelId, settings?: GitHubCopilotSettings): LanguageModelV3;
  chat(modelId: GitHubCopilotModelId, settings?: GitHubCopilotSettings): LanguageModelV3;
  /**
   * Get the underlying CopilotClient instance for advanced lifecycle management.
   */
  getClient(): CopilotClient;
}

/**
 * Creates a GitHub Copilot provider instance.
 */
export function createGitHubCopilot(
  options: GitHubCopilotProviderOptions = {},
): GitHubCopilotProvider {
  let clientInstance: CopilotClient | null = null;

  const getOrCreateClient = (): CopilotClient => {
    if (!clientInstance) {
      clientInstance = new CopilotClientClass(options.clientOptions ?? {});
    }
    return clientInstance;
  };

  const createModel = (
    modelId: GitHubCopilotModelId,
    settings: GitHubCopilotSettings = {},
  ): LanguageModelV3 => {
    const mergedSettings: GitHubCopilotSettings = {
      ...options.defaultSettings,
      ...settings,
    };
    return new GitHubCopilotLanguageModel({
      modelId,
      settings: mergedSettings,
      getClient: getOrCreateClient,
    });
  };

  const provider = function (modelId: GitHubCopilotModelId, settings?: GitHubCopilotSettings) {
    if (new.target) {
      throw new Error("The GitHub Copilot model function cannot be called with the new keyword.");
    }
    return createModel(modelId, settings);
  };

  provider.languageModel = createModel;
  provider.chat = createModel;
  provider.specificationVersion = "v3" as const;

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: "embeddingModel",
    });
  };

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: "imageModel",
    });
  };

  provider.getClient = getOrCreateClient;

  return provider as GitHubCopilotProvider;
}

/**
 * Default GitHub Copilot provider instance.
 */
export const githubCopilot = createGitHubCopilot();

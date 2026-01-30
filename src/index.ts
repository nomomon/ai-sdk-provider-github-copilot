/**
 * AI SDK Provider for GitHub Copilot
 * @module ai-sdk-provider-github-copilot
 */

export { createGitHubCopilot, githubCopilot } from "./github-copilot-provider.js";
export type {
  GitHubCopilotProvider,
  GitHubCopilotModelId,
} from "./github-copilot-provider.js";
export { GitHubCopilotLanguageModel } from "./github-copilot-language-model.js";
export type { GitHubCopilotSettings, GitHubCopilotProviderOptions } from "./types.js";
export {
  createAuthenticationError,
  createAPICallError,
  isAuthenticationError,
  isAbortError,
  handleCopilotError,
} from "./errors.js";

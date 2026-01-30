/**
 * AI SDK Provider for GitHub Copilot
 * @module ai-sdk-provider-github-copilot
 */

export {
  createAPICallError,
  createAuthenticationError,
  handleCopilotError,
  isAbortError,
  isAuthenticationError,
} from "./errors.js";
export { GitHubCopilotLanguageModel } from "./github-copilot-language-model.js";
export type {
  GitHubCopilotModelId,
  GitHubCopilotProvider,
} from "./github-copilot-provider.js";
export { createGitHubCopilot, githubCopilot } from "./github-copilot-provider.js";
export type { GitHubCopilotProviderOptions, GitHubCopilotSettings } from "./types.js";

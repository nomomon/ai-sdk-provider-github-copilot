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
export { GitHubCopilotLanguageModel } from "./model/github-copilot-language-model.js";
export type {
  GitHubCopilotModelId,
  GitHubCopilotProvider,
} from "./provider/github-copilot-provider.js";
export { createGitHubCopilot, githubCopilot } from "./provider/github-copilot-provider.js";
export type { GitHubCopilotProviderOptions, GitHubCopilotSettings } from "./provider/types.js";

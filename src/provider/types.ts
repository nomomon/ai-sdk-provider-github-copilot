import type {
  CopilotClientOptions,
  SessionConfig,
  SystemMessageConfig,
  Tool,
} from "@github/copilot-sdk";

/** Provider config for BYOK - extracted from SessionConfig */
type ProviderConfig = NonNullable<SessionConfig["provider"]>;

/**
 * Settings for configuring GitHub Copilot model behavior.
 */
export interface GitHubCopilotSettings {
  /**
   * Override model (e.g., "gpt-5", "claude-sonnet-4.5").
   */
  model?: string;

  /**
   * Enable streaming for doStream. Default true.
   */
  streaming?: boolean;

  /**
   * System message configuration from Copilot SDK.
   */
  systemMessage?: SystemMessageConfig;

  /**
   * Custom tools exposed to the Copilot CLI.
   */
  tools?: Tool<unknown>[];

  /**
   * Custom provider configuration (BYOK - Bring Your Own Key).
   */
  provider?: ProviderConfig;

  /**
   * Working directory for the session.
   */
  workingDirectory?: string;

  /**
   * Path to Copilot CLI executable.
   */
  cliPath?: string;

  /**
   * URL of existing Copilot CLI server to connect to.
   */
  cliUrl?: string;

  /**
   * Session ID for resuming an existing session.
   */
  sessionId?: string;
}

/**
 * Options for creating a GitHub Copilot provider instance.
 */
export interface GitHubCopilotProviderOptions {
  /**
   * Default settings for all models created by this provider.
   */
  defaultSettings?: GitHubCopilotSettings;

  /**
   * Copilot client options (cliPath, cliUrl, etc.).
   */
  clientOptions?: CopilotClientOptions;
}

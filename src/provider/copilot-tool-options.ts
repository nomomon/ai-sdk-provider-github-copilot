import type { ProviderOptions } from "@ai-sdk/provider-utils";

/**
 * Execute handler for AI SDK tools when used with the GitHub Copilot provider.
 * The AI SDK does not pass the tool's `execute` function to providers, so it
 * must be passed via providerOptions for the provider to convert and use it.
 */
export type CopilotToolExecute = (args: unknown) => unknown | Promise<unknown>;

/**
 * Creates provider options for AI SDK tools to work with the GitHub Copilot provider.
 *
 * The AI SDK does not pass the tool's `execute` function to providers. This helper
 * bridges that gap by placing the execute handler in providerOptions so the provider
 * can convert the tool and use it as the Copilot handler.
 *
 * @example
 * ```ts
 * const execute = async ({ city }: { city: string }) => ({ ... });
 * const getWeather = tool({
 *   description: "Get the current weather for a city",
 *   inputSchema: z.object({ city: z.string() }),
 *   execute,
 *   providerOptions: copilotToolOptions(execute),
 * });
 * ```
 */
export function copilotToolOptions<INPUT>(
  execute: (args: INPUT) => unknown | Promise<unknown>,
): ProviderOptions {
  return { "github-copilot": { execute } } as unknown as ProviderOptions;
}

/**
 * AI SDK tools example - using tool() with providerOptions bridge
 *
 * The AI SDK does not pass the tool's execute function to providers.
 * Pass it via providerOptions['github-copilot'].execute so the provider
 * can use it as the Copilot handler.
 *
 * Prerequisites:
 * - Copilot CLI installed and authenticated
 *
 * Run: npm run example:tools-ai-sdk
 */

import { githubCopilot } from "@nomomon/ai-sdk-provider-github-copilot";
import { streamText, tool } from "ai";
import { z } from "zod";

async function main() {
  console.log("Sending prompt with AI SDK tools to GitHub Copilot...\n");

  const execute = async ({ city }: { city: string }) => {
    const conditions = ["sunny", "cloudy", "rainy", "partly cloudy"];
    const temp = Math.floor(Math.random() * 10) + 20;
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    return { city, temperature: `${temp}°C`, condition };
  };

  const getWeather = tool({
    description: "Get the current weather for a city",
    inputSchema: z.object({
      city: z.string().describe("The city name"),
    }),
    execute,
    providerOptions: { "github-copilot": { execute } },
  });

  const result = streamText({
    model: githubCopilot("gpt-5-mini"),
    tools: { get_weather: getWeather },
    prompt: "What's the weather like in San Francisco? Use the get_weather tool.",
  });

  process.stdout.write("Response: ");
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log("\n\nDone.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

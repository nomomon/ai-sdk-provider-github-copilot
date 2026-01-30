/**
 * Tools example - using tools with GitHub Copilot
 *
 * Prerequisites:
 * - Copilot CLI installed and authenticated
 *
 * Run: npm run example:tools
 */

import { githubCopilot } from "@nomomon/ai-sdk-provider-github-copilot";
import { streamText, tool } from "ai";
import { z } from "zod";

async function main() {
  console.log("Sending prompt with tools to GitHub Copilot...\n");

  const get_weather = tool({
    description: "Get the weather in a location",
    inputSchema: z.object({
      location: z.string().describe("The location to get the weather for"),
    }),
    execute: async ({ location }) => {
      return { temperature: 72, conditions: "sunny" };
    },
  });

  const result = streamText({
    model: githubCopilot("gpt-4.1"),
    tools: { get_weather },
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

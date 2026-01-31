/**
 * Tools example - using tools with GitHub Copilot
 *
 * NOTE: AI SDK tools (tool() with Zod schemas and execute) are not yet supported.
 * Use Copilot's defineTool with parameters and handler instead, as shown below.
 *
 * Prerequisites:
 * - Copilot CLI installed and authenticated
 *
 * Run: npm run example:tools
 */

import { defineTool } from "@github/copilot-sdk";
import { githubCopilot } from "@nomomon/ai-sdk-provider-github-copilot";
import { streamText } from "ai";

async function main() {
  console.log("Sending prompt with tools to GitHub Copilot...\n");

  const getWeather = defineTool("get_weather", {
    description: "Get the current weather for a city",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "The city name" },
      },
      required: ["city"],
    },
    handler: async (args: { city: string }) => {
      const { city } = args;
      const conditions = ["sunny", "cloudy", "rainy", "partly cloudy"];
      const temp = Math.floor(Math.random() * 10) + 20;
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      return { city, temperature: `${temp}°C`, condition };
    },
  });

  const result = streamText({
    model: githubCopilot("gpt-5-mini", { tools: [getWeather] }),
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

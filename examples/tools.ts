/**
 * Tools example - using custom tools with GitHub Copilot
 *
 * Custom tools are passed via provider settings using Copilot's defineTool.
 * The Copilot CLI will invoke these handlers when the agent calls the tools.
 *
 * Prerequisites:
 * - Copilot CLI installed and authenticated
 *
 * Run: npm run example:tools
 */

import { streamText } from "ai";
import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import { githubCopilot } from "ai-sdk-provider-github-copilot";

async function main() {
    console.log("Sending prompt with tools to GitHub Copilot...\n");

    const result = streamText({
        model: githubCopilot("gpt-5", {
            tools: [
                defineTool("get_weather", {
                    description: "Get the current weather for a location",
                    parameters: z.object({
                        location: z.string().describe("City name, e.g. San Francisco"),
                        unit: z.enum(["celsius", "fahrenheit"]).default("fahrenheit"),
                    }),
                    handler: async ({ location, unit }) => ({
                        location,
                        unit,
                        temperature: 72,
                        condition: "Partly cloudy",
                    }),
                }),
            ],
        }),
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

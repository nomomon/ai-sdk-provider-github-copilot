/**
 * Basic usage example - generateText with GitHub Copilot
 *
 * Prerequisites:
 * - Copilot CLI installed (npm install -g @github/copilot-cli or similar)
 * - Authenticated with GitHub Copilot
 *
 * Run: npm run example:basic
 */

import { githubCopilot } from "@nomomon/ai-sdk-provider-github-copilot";
import { generateText } from "ai";

async function main() {
  console.log("Sending prompt to GitHub Copilot...\n");

  const { text } = await generateText({
    model: githubCopilot("gpt-4.1"),
    prompt: "What is 2+2? Reply with just the number.",
  });

  console.log("Response:", text);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

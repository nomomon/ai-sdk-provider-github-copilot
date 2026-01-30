/**
 * Streaming example - streamText with GitHub Copilot
 *
 * Prerequisites:
 * - Copilot CLI installed and authenticated
 *
 * Run: npm run example:streaming
 */

import { githubCopilot } from "@nomomon/ai-sdk-provider-github-copilot";
import { streamText } from "ai";

async function main() {
  console.log("Streaming from GitHub Copilot...\n");

  const result = streamText({
    model: githubCopilot("gpt-5-mini"),
    prompt: "Tell me a very short joke in one sentence.",
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

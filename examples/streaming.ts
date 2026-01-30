/**
 * Streaming example - streamText with GitHub Copilot
 *
 * Prerequisites:
 * - Copilot CLI installed and authenticated
 *
 * Run: npm run example:streaming
 */

import { streamText } from "ai";
import { githubCopilot } from "ai-sdk-provider-github-copilot";

async function main() {
  console.log("Streaming from GitHub Copilot...\n");

  const result = streamText({
    model: githubCopilot("gpt-5"),
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

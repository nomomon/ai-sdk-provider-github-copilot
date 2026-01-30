# AI SDK Provider for GitHub Copilot

[![Tests](https://img.shields.io/github/actions/workflow/status/nomomon/ai-sdk-provider-github-copilot/test.yml?branch=main&label=tests)](https://github.com/nomomon/ai-sdk-provider-github-copilot/actions)
[![codecov](https://codecov.io/gh/nomomon/ai-sdk-provider-github-copilot/graph/badge.svg)](https://codecov.io/gh/nomomon/ai-sdk-provider-github-copilot)
[![GitHub Packages](https://img.shields.io/badge/GitHub-Packages-blue?logo=github)](https://github.com/nomomon/ai-sdk-provider-github-copilot/pkgs/npm/ai-sdk-provider-github-copilot)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Fully AI Generated](https://img.shields.io/badge/fully-AI%20generated-purple?logo=openai)](https://github.com/nomomon/ai-sdk-provider-github-copilot)

Vercel AI SDK community provider for GitHub Copilot — use `streamText`, `generateText`, and related AI SDK APIs with GitHub Copilot as the backend model.

---

## Installation

### 1. Install and authenticate the Copilot CLI

Follow the [Copilot CLI installation guide](https://github.com/github/copilot-sdk) to install the CLI and ensure `copilot` is available in your PATH.

### 2. Add the provider

```bash
npm install @nomomon/ai-sdk-provider-github-copilot ai@^6.0.0
```

## Quick Start

### Non-streaming (generateText)

```typescript
import { generateText } from "ai";
import { githubCopilot } from "@nomomon/ai-sdk-provider-github-copilot";

const { text } = await generateText({
  model: githubCopilot("gpt-5"),
  prompt: "Hello, Copilot!",
});

console.log(text);
```

### Streaming (streamText)

```typescript
import { streamText } from "ai";
import { githubCopilot } from "@nomomon/ai-sdk-provider-github-copilot";

const result = streamText({
  model: githubCopilot("gpt-5"),
  prompt: "Tell me a short story",
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Models

Use model IDs available via Copilot CLI. Run `copilot -i /models` to list available models in your environment.

## Configuration

### Provider settings

```typescript
import { githubCopilot } from "@nomomon/ai-sdk-provider-github-copilot";

const model = githubCopilot("gpt-5", {
  model: "claude-sonnet-4.5", // Override model
  systemMessage: {
    content: "You are a helpful assistant specialized in code review.",
  },
  workingDirectory: "/path/to/project",
  provider: {
    type: "openai",
    baseUrl: "https://my-api.example.com/v1",
    apiKey: process.env.MY_API_KEY,
  },
});
```

### Custom tools

Pass tools via provider settings using Copilot's `defineTool`. Tool support varies by model; verify with Copilot CLI or documentation.

```typescript
import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import { githubCopilot } from "@nomomon/ai-sdk-provider-github-copilot";

const model = githubCopilot("gpt-5", {
  tools: [
    defineTool("lookup_issue", {
      description: "Fetch issue details from our tracker",
      parameters: z.object({
        id: z.string().describe("Issue identifier"),
      }),
      handler: async ({ id }) => {
        return await fetchIssue(id);
      },
    }),
  ],
});
```

## Development

Tests live in `tests/` (not colocated with source) to keep the published `src/` tree clean and to exclude test files from the build. Each source module has a corresponding `tests/*.test.ts` file. Run `npm test` or `npm run test:coverage` for coverage with thresholds.

## Limitations

- **Requires Copilot CLI** - Must be installed and authenticated
- **Node.js >= 18** - Required runtime
- **Image inputs** - Copilot uses file path attachments; base64/data URLs may require temp files
- **Unsupported parameters** - `temperature`, `maxTokens`, `topP`, etc. are not supported by the Copilot CLI and will be ignored (warnings emitted)
- **Structured outputs** - Native JSON schema support may be limited; consider prompt engineering for structured responses
- **Session-based** - Each generate/stream creates a new session; no built-in multi-session continuity across separate AI SDK calls
- **Model capabilities** - Tools, reasoning, and other features may vary by model; capabilities are determined by Copilot CLI

## Disclaimer

**This is an unofficial community provider** and is not affiliated with or endorsed by GitHub or Vercel. By using this provider:

- You understand that your data will be sent to GitHub's servers through the Copilot CLI
- You agree to comply with GitHub's Terms of Service
- You acknowledge this software is provided "as is" without warranties of any kind

## License

[MIT](LICENSE)

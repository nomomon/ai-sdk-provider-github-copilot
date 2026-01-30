import type { LanguageModelV3Prompt } from "@ai-sdk/provider";

const IMAGE_URL_WARNING =
  "Image URLs are not supported by this provider; supply file paths as attachments.";
const IMAGE_BASE64_WARNING =
  "Base64/image data URLs require file paths. Write to temp file and pass path, or use attachments with path.";

export interface ConvertedCopilotMessage {
  prompt: string;
  systemMessage?: string;
  attachments?: Array<{
    type: "file" | "directory";
    path: string;
    displayName?: string;
  }>;
  warnings?: string[];
}

/**
 * Converts AI SDK prompt format to Copilot SDK message format.
 * Handles system prompts, user messages, assistant responses, and tool results.
 */
export function convertToCopilotMessages(prompt: LanguageModelV3Prompt): ConvertedCopilotMessage {
  const messages: string[] = [];
  const warnings: string[] = [];
  let systemMessage: string | undefined;
  const attachments: Array<{ type: "file" | "directory"; path: string; displayName?: string }> = [];

  for (const message of prompt) {
    switch (message.role) {
      case "system": {
        const content = message.content;
        systemMessage = typeof content === "string" ? content : extractTextFromParts(content);
        if (systemMessage?.trim()) {
          messages.push(`System: ${systemMessage}`);
        }
        break;
      }

      case "user": {
        const content = message.content;
        if (typeof content === "string") {
          messages.push(`User: ${content}`);
        } else {
          const textParts: string[] = [];
          for (const part of content) {
            if (part.type === "text") {
              textParts.push(part.text);
            } else if (part.type === "file") {
              const fileInfo = extractFileAttachment(part);
              if (fileInfo.path) {
                attachments.push({
                  type: "file",
                  path: fileInfo.path,
                  displayName: fileInfo.displayName,
                });
              } else if (fileInfo.warning) {
                warnings.push(fileInfo.warning);
              }
            } else if (part.type === "image") {
              warnings.push(IMAGE_BASE64_WARNING);
            }
          }
          if (textParts.length > 0) {
            messages.push(`User: ${textParts.join("\n")}`);
          }
        }
        break;
      }

      case "assistant": {
        const content = message.content;
        if (typeof content === "string") {
          messages.push(`Assistant: ${content}`);
        } else {
          const textParts: string[] = [];
          for (const part of content) {
            if (part.type === "text") {
              textParts.push(part.text);
            } else if (part.type === "tool-call") {
              textParts.push(`[Tool call: ${part.toolName}]`);
            } else if (part.type === "reasoning") {
              textParts.push(`[Reasoning: ${part.text}]`);
            }
          }
          if (textParts.length > 0) {
            messages.push(`Assistant: ${textParts.join("\n")}`);
          }
        }
        break;
      }

      case "tool": {
        for (const part of message.content) {
          if (part.type === "tool-result") {
            const output = part.output;
            let resultStr: string;
            if (output.type === "text" || output.type === "error-text") {
              resultStr = output.value;
            } else if (output.type === "json" || output.type === "error-json") {
              resultStr = JSON.stringify(output.value);
            } else if (output.type === "execution-denied") {
              resultStr = `[Execution denied${output.reason ? `: ${output.reason}` : ""}]`;
            } else if (output.type === "content") {
              resultStr = output.value
                .filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("\n");
            } else {
              resultStr = "[Unknown output type]";
            }
            const isError = output.type === "error-text" || output.type === "error-json";
            messages.push(
              `Tool result (${part.toolName}): ${isError ? "Error: " : ""}${resultStr}`,
            );
          }
        }
        break;
      }
    }
  }

  const promptText = messages.join("\n\n");

  return {
    prompt: promptText,
    systemMessage: systemMessage?.trim() || undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function extractTextFromParts(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function extractFileAttachment(part: {
  type: string;
  filename?: string;
  data?: unknown;
  mediaType?: string;
}): { path?: string; displayName?: string; warning?: string } {
  if (part.type !== "file") return {};

  const data = part.data;
  if (typeof data === "string") {
    if (data.startsWith("http://") || data.startsWith("https://")) {
      return { warning: IMAGE_URL_WARNING };
    }
    if (data.startsWith("file://")) {
      return { path: data.slice(7), displayName: part.filename };
    }
    if (data.startsWith("/") || /^[A-Za-z]:[\\/]/.test(data)) {
      return { path: data, displayName: part.filename };
    }
    return { warning: IMAGE_BASE64_WARNING };
  }

  return {};
}

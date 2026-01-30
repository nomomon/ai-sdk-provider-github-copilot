import { APICallError, LoadAPIKeyError } from "@ai-sdk/provider";

const AUTH_ERROR_PATTERNS = [
  "not authenticated",
  "authentication",
  "unauthorized",
  "auth failed",
  "please login",
  "login required",
  "invalid token",
  "token expired",
];

/**
 * Creates an authentication error for Copilot SDK failures.
 */
export function createAuthenticationError(options: { message?: string }): LoadAPIKeyError {
  return new LoadAPIKeyError({
    message:
      options.message ??
      "Authentication failed. Please ensure Copilot CLI is properly authenticated.",
  });
}

/**
 * Creates an API call error for Copilot SDK failures.
 */
export function createAPICallError(options: {
  message: string;
  statusCode?: number;
  cause?: unknown;
  isRetryable?: boolean;
}): APICallError {
  return new APICallError({
    message: options.message,
    url: "copilot://session",
    requestBodyValues: {},
    statusCode: options.statusCode,
    cause: options.cause,
    isRetryable: options.isRetryable ?? false,
  });
}

/**
 * Checks if an error represents an authentication failure.
 */
export function isAuthenticationError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return AUTH_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Checks if an error is an AbortError.
 */
export function isAbortError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const e = error as { name?: unknown; code?: unknown };
    if (typeof e.name === "string" && e.name === "AbortError") return true;
    if (typeof e.code === "string" && e.code.toUpperCase() === "ABORT_ERR") return true;
  }
  return false;
}

/**
 * Handles Copilot SDK errors and maps them to AI SDK error types.
 */
export function handleCopilotError(error: unknown, _context?: { promptExcerpt?: string }): never {
  if (isAbortError(error)) {
    throw error;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (isAuthenticationError(error)) {
    throw createAuthenticationError({ message });
  }

  throw createAPICallError({
    message: message || "GitHub Copilot SDK error",
    cause: error,
    isRetryable: false,
  });
}

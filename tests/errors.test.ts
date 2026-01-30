import { APICallError, LoadAPIKeyError } from "@ai-sdk/provider";
import { describe, expect, it } from "vitest";
import {
  createAPICallError,
  createAuthenticationError,
  handleCopilotError,
  isAbortError,
  isAuthenticationError,
} from "../src/errors.js";

describe("createAuthenticationError", () => {
  it("creates LoadAPIKeyError with default message", () => {
    const err = createAuthenticationError({});
    expect(err).toBeInstanceOf(LoadAPIKeyError);
    expect(err.message).toContain("Authentication failed");
  });

  it("creates LoadAPIKeyError with custom message", () => {
    const err = createAuthenticationError({ message: "Custom auth error" });
    expect(err).toBeInstanceOf(LoadAPIKeyError);
    expect(err.message).toBe("Custom auth error");
  });
});

describe("createAPICallError", () => {
  it("creates APICallError with required message", () => {
    const err = createAPICallError({ message: "API failed" });
    expect(err).toBeInstanceOf(APICallError);
    expect(err.message).toBe("API failed");
  });

  it("creates APICallError with optional fields", () => {
    const cause = new Error("underlying");
    const err = createAPICallError({
      message: "API failed",
      statusCode: 500,
      cause,
      isRetryable: true,
    });
    expect(err).toBeInstanceOf(APICallError);
    expect(err.message).toBe("API failed");
  });
});

describe("isAuthenticationError", () => {
  it("returns true for 'not authenticated'", () => {
    expect(isAuthenticationError(new Error("not authenticated"))).toBe(true);
  });

  it("returns true for 'authentication failed'", () => {
    expect(isAuthenticationError(new Error("authentication failed"))).toBe(true);
  });

  it("returns true for 'unauthorized'", () => {
    expect(isAuthenticationError(new Error("unauthorized"))).toBe(true);
  });

  it("returns true for 'invalid token'", () => {
    expect(isAuthenticationError(new Error("invalid token"))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isAuthenticationError(new Error("network timeout"))).toBe(false);
  });

  it("handles non-Error values", () => {
    expect(isAuthenticationError("not authenticated")).toBe(true);
    expect(isAuthenticationError("random string")).toBe(false);
  });
});

describe("isAbortError", () => {
  it("returns true for AbortError by name", () => {
    const err = new Error("Aborted");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
  });

  it("returns true for ABORT_ERR code", () => {
    const err = new Error("Aborted");
    (err as Error & { code?: string }).code = "ABORT_ERR";
    expect(isAbortError(err)).toBe(true);
  });

  it("returns false for regular errors", () => {
    expect(isAbortError(new Error("other"))).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});

describe("handleCopilotError", () => {
  it("rethrows AbortError", () => {
    const abortErr = new Error("Aborted");
    abortErr.name = "AbortError";
    expect(() => handleCopilotError(abortErr)).toThrow(abortErr);
  });

  it("throws LoadAPIKeyError for auth-like messages", () => {
    expect(() => handleCopilotError(new Error("not authenticated"))).toThrow(LoadAPIKeyError);
  });

  it("throws LoadAPIKeyError for token expired", () => {
    expect(() => handleCopilotError(new Error("token expired"))).toThrow(LoadAPIKeyError);
  });

  it("throws LoadAPIKeyError for please login", () => {
    expect(() => handleCopilotError(new Error("please login first"))).toThrow(LoadAPIKeyError);
  });

  it("throws APICallError for other errors", () => {
    expect(() => handleCopilotError(new Error("Something went wrong"))).toThrow(APICallError);
  });

  it("throws APICallError with cause when provided non-Error", () => {
    expect(() => handleCopilotError("string error")).toThrow(APICallError);
  });
});

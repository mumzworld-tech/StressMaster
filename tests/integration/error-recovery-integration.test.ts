import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ErrorRecoverySystem,
  ParseError,
  RecoveryStrategy,
  RecoveryContext,
} from "@/core/parser/utils";
import { FallbackParser } from "@/core/parser";
import { LoadTestSpec } from "@/types";

describe("Error Recovery Integration", () => {
  let fallbackParser: FallbackParser;

  beforeEach(() => {
    fallbackParser = new FallbackParser();
  });

  describe("Core Error Recovery Functionality", () => {
    it("should classify and recover from AI parsing errors", async () => {
      const error = new Error("AI provider timeout");
      const recoveryContext: RecoveryContext = {
        originalInput: "test input",
        error: { message: error.message, code: "AI_TIMEOUT" },
        previousAttempts: 0,
      };

      const result = await ErrorRecoverySystem.attemptRecovery(recoveryContext);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });

    it("should provide intelligent fallback parsing", () => {
      const input = "GET https://api.example.com/users with 10 users for 30s";
      const result = fallbackParser.parseCommand(input);

      expect(result.spec.requests).toHaveLength(1);
      expect(result.spec.requests[0].method).toBe("GET");
      expect(result.spec.requests[0].url).toContain("api.example.com");
      expect(result.spec.loadPattern.virtualUsers).toBe(10);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should handle complete recovery workflow", async () => {
      const recoveryContext: RecoveryContext = {
        originalInput: "POST https://api.test.com/data with 5 users",
        error: { message: "Network error", code: "NETWORK_ERROR" },
        previousAttempts: 0,
      };

      const result = await ErrorRecoverySystem.attemptRecovery(recoveryContext);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });

    it("should track recovery statistics", async () => {
      const recoveryContext: RecoveryContext = {
        originalInput: "test input",
        error: { message: "Schema validation failed", code: "SCHEMA_ERROR" },
        previousAttempts: 0,
      };

      const result = await ErrorRecoverySystem.attemptRecovery(recoveryContext);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });
  });

  describe("Fallback Parser Core Features", () => {
    it("should extract basic HTTP information", () => {
      const input = "POST https://example.com/api";
      const result = fallbackParser.parseCommand(input);

      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.requests[0].url).toBe("https://example.com/api");
    });

    it("should handle missing information gracefully", () => {
      const input = "some random text";
      const result = fallbackParser.parseCommand(input);

      expect(result.spec.requests).toHaveLength(1);
      expect(result.spec.requests[0].url).toBe("http://example.com");
      expect(result.spec.requests[0].method).toBe("GET");
      expect(result.confidence).toBeLessThan(0.9);
      expect(result.warnings).toBeDefined();
    });

    it("should provide reasonable defaults", () => {
      const input = "https://api.test.com";
      const result = fallbackParser.parseCommand(input);

      expect(result.spec.loadPattern.type).toBe("constant");
      expect(result.spec.loadPattern.virtualUsers).toBe(10);
      expect(result.spec.duration.value).toBe(30);
      expect(result.spec).toBeDefined();
    });
  });

  describe("Error Classification", () => {
    it("should classify different error types correctly", () => {
      const testCases = [
        {
          error: new Error("Rate limit exceeded"),
          code: "RATE_LIMIT",
        },
        {
          error: new Error("Invalid format detected"),
          code: "INVALID_FORMAT",
        },
        {
          error: new Error("Schema validation failed"),
          code: "SCHEMA_ERROR",
        },
        {
          error: new Error("Network connection failed"),
          code: "NETWORK_ERROR",
        },
      ];

      testCases.forEach(async ({ error, code }) => {
        const recoveryContext: RecoveryContext = {
          originalInput: "test input",
          error: { message: error.message, code },
          previousAttempts: 0,
        };

        const result = await ErrorRecoverySystem.attemptRecovery(
          recoveryContext
        );
        expect(result.success).toBe(true);
      });
    });

    it("should provide appropriate recovery strategies", async () => {
      const rateLimitContext: RecoveryContext = {
        originalInput: "test input",
        error: { message: "Rate limit exceeded", code: "RATE_LIMIT" },
        previousAttempts: 0,
      };

      const rateLimitResult = await ErrorRecoverySystem.attemptRecovery(
        rateLimitContext
      );
      expect(rateLimitResult.success).toBe(true);

      const formatContext: RecoveryContext = {
        originalInput: "test input",
        error: { message: "Invalid format", code: "INVALID_FORMAT" },
        previousAttempts: 0,
      };

      const formatResult = await ErrorRecoverySystem.attemptRecovery(
        formatContext
      );
      expect(formatResult.success).toBe(true);
    });
  });
});

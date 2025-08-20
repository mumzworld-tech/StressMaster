import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ErrorRecoverySystem,
  ParseError,
  RecoveryStrategy,
  RecoveryContext,
  RecoveryResult,
} from "@/core/parser";
import { LoadTestSpec } from "@/types";

describe("ErrorRecoverySystem", () => {
  let mockRecoveryFunction: vi.MockedFunction<any>;

  beforeEach(() => {
    mockRecoveryFunction = vi.fn();
  });

  describe("classifyError", () => {
    it("should classify input level errors correctly", () => {
      const error = new Error("Invalid format detected");
      const parseError = ErrorRecoverySystem.classifyError(error, "input");

      expect(parseError.level).toBe("input");
      expect(parseError.type).toBe("invalid_format");
      expect(parseError.message).toBe("Invalid format detected");
      expect(parseError.suggestions).toContain(
        "Try providing input in a more structured format"
      );
      expect(parseError.recoveryStrategy.canRecover).toBe(true);
    });

    it("should classify AI level errors correctly", () => {
      const error = new Error("AI timeout occurred");
      const parseError = ErrorRecoverySystem.classifyError(error, "ai");

      expect(parseError.level).toBe("ai");
      expect(parseError.type).toBe("ai_timeout");
      expect(parseError.recoveryStrategy.strategy).toBe("retry");
      expect(parseError.recoveryStrategy.confidence).toBeGreaterThan(0.7);
    });

    it("should classify validation level errors correctly", () => {
      const error = new Error("Schema validation failed");
      const parseError = ErrorRecoverySystem.classifyError(error, "validation");

      expect(parseError.level).toBe("validation");
      expect(parseError.type).toBe("schema_validation_error");
      expect(parseError.recoveryStrategy.strategy).toBe("enhance_prompt");
    });

    it("should classify rate limit errors with high confidence retry", () => {
      const error = new Error("Rate limit exceeded");
      const parseError = ErrorRecoverySystem.classifyError(error, "ai");

      expect(parseError.type).toBe("rate_limit");
      expect(parseError.recoveryStrategy.strategy).toBe("retry");
      expect(parseError.recoveryStrategy.confidence).toBe(0.9);
    });

    it("should include context in classified error", () => {
      const error = new Error("Test error");
      const context = { userId: "123", requestId: "abc" };
      const parseError = ErrorRecoverySystem.classifyError(error, "input", context);

      expect(parseError.context).toEqual(context);
      expect(parseError.originalError).toBe(error);
    });
  });

  describe("recover", () => {
    it("should successfully recover with first strategy", async () => {
      const parseError: ParseError = {
        level: "ai",
        type: "network_error",
        message: "Network error",
        suggestions: [],
        recoveryStrategy: {
          canRecover: true,
          strategy: "retry",
          confidence: 0.8,
          estimatedSuccess: 0.8,
        },
      };

      const recoveryContext: RecoveryContext = {
        originalInput: "test input",
        previousAttempts: [],
        availableStrategies: [],
      };

      const mockResult: LoadTestSpec = {
        name: "test",
        requests: [],
        loadPattern: { type: "constant", duration: "1m", rate: 10 },
      };

      mockRecoveryFunction.mockResolvedValueOnce(mockResult);

      const result = await ErrorRecoverySystem.recover(
        parseError,
        recoveryContext,
        mockRecoveryFunction
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockResult);
      expect(result.attemptsUsed).toBe(1);
      expect(result.recoveryPath).toContain("retry");
      expect(result.confidence).toBe(0.8);
    });

    it("should try multiple strategies when first fails", async () => {
      const parseError: ParseError = {
        level: "ai",
        type: "invalid_ai_response",
        message: "Invalid response",
        suggestions: [],
        recoveryStrategy: {
          canRecover: true,
          strategy: "enhance_prompt",
          confidence: 0.7,
          estimatedSuccess: 0.7,
        },
      };

      const fallbackStrategy: RecoveryStrategy = {
        canRecover: true,
        strategy: "fallback",
        confidence: 0.6,
        estimatedSuccess: 0.6,
      };

      const recoveryContext: RecoveryContext = {
        originalInput: "test input",
        previousAttempts: [],
        availableStrategies: [parseError.recoveryStrategy, fallbackStrategy],
      };

      const mockResult: LoadTestSpec = {
        name: "test",
        requests: [],
        loadPattern: { type: "constant", duration: "1m", rate: 10 },
      };

      // First strategy fails, second succeeds
      mockRecoveryFunction
        .mockRejectedValueOnce(new Error("First strategy failed"))
        .mockResolvedValueOnce(mockResult);

      const result = await ErrorRecoverySystem.recover(
        parseError,
        recoveryContext,
        mockRecoveryFunction
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockResult);
      expect(result.recoveryPath).toEqual(["enhance_prompt", "fallback"]);
      expect(result.confidence).toBe(0.6);
    });

    it("should fail when all strategies are exhausted", async () => {
      const parseError: ParseError = {
        level: "ai",
        type: "unknown_error",
        message: "Unknown error",
        suggestions: [],
        recoveryStrategy: {
          canRecover: true,
          strategy: "retry",
          confidence: 0.5,
          estimatedSuccess: 0.5,
        },
      };

      const recoveryContext: RecoveryContext = {
        originalInput: "test input",
        previousAttempts: [],
        availableStrategies: [],
      };

      mockRecoveryFunction.mockRejectedValue(
        new Error("All strategies failed")
      );

      const result = await ErrorRecoverySystem.recover(
        parseError,
        recoveryContext,
        mockRecoveryFunction
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.confidence).toBe(0);
    });

    it("should respect max retries limit", async () => {
      const errorRecoveryWithLowLimit = new ErrorRecoverySystem({
        maxRetries: 1,
      });

      const parseError: ParseError = {
        level: "ai",
        type: "network_error",
        message: "Network error",
        suggestions: [],
        recoveryStrategy: {
          canRecover: true,
          strategy: "retry",
          confidence: 0.8,
          estimatedSuccess: 0.8,
        },
      };

      const recoveryContext: RecoveryContext = {
        originalInput: "test input",
        previousAttempts: [],
        availableStrategies: [],
      };

      // Make the first attempt fail to increment retry count
      mockRecoveryFunction.mockRejectedValueOnce(
        new Error("First attempt failed")
      );

      // Simulate previous attempt that fails
      await errorRecoveryWithLowLimit
        .recover(parseError, recoveryContext, mockRecoveryFunction)
        .catch(() => {}); // Ignore the error

      // This should fail due to max retries
      const result = await errorRecoveryWithLowLimit.recover(
        parseError,
        recoveryContext,
        mockRecoveryFunction
      );

      expect(result.success).toBe(false);
      expect(result.recoveryPath).toContain("max_retries_exceeded");
    });

    it("should add delay for retry strategies", async () => {
      const startTime = Date.now();

      const parseError: ParseError = {
        level: "ai",
        type: "rate_limit",
        message: "Rate limit",
        suggestions: [],
        recoveryStrategy: {
          canRecover: true,
          strategy: "retry",
          confidence: 0.9,
          estimatedSuccess: 0.9,
          retryDelay: 100,
        },
      };

      const recoveryContext: RecoveryContext = {
        originalInput: "test input",
        previousAttempts: [],
        availableStrategies: [],
      };

      const mockResult: LoadTestSpec = {
        name: "test",
        requests: [],
        loadPattern: { type: "constant", duration: "1m", rate: 10 },
      };

      mockRecoveryFunction.mockResolvedValueOnce(mockResult);

      await ErrorRecoverySystem.recover(
        parseError,
        recoveryContext,
        mockRecoveryFunction
      );

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe("strategy creation methods", () => {
    it("should create fallback strategy with correct properties", () => {
      const strategy = ErrorRecoverySystem.createFallbackStrategy(0.9);

      expect(strategy.strategy).toBe("fallback");
      expect(strategy.confidence).toBe(0.9);
      expect(strategy.estimatedSuccess).toBe(0.9);
      expect(strategy.canRecover).toBe(true);
    });

    it("should create retry strategy with exponential backoff", () => {
      const strategy1 = ErrorRecoverySystem.createRetryStrategy(0.8, 1);
      const strategy2 = ErrorRecoverySystem.createRetryStrategy(0.8, 2);

      expect(strategy1.confidence).toBeGreaterThan(strategy2.confidence);
      expect(strategy2.retryDelay).toBeGreaterThan(strategy1.retryDelay!);
    });

    it("should create prompt enhancement strategy", () => {
      const strategy = ErrorRecoverySystem.createPromptEnhancementStrategy(0.7);

      expect(strategy.strategy).toBe("enhance_prompt");
      expect(strategy.confidence).toBe(0.7);
      expect(strategy.maxRetries).toBe(2);
    });

    it("should disable strategies based on configuration", () => {
      const disabledFallbackRecovery = new ErrorRecoverySystem({
        enableFallback: false,
      });
      const strategy = disabledFallbackRecovery.createFallbackStrategy();

      expect(strategy.canRecover).toBe(false);
    });
  });

  describe("recovery statistics", () => {
    it("should track recovery attempts", async () => {
      const parseError: ParseError = {
        level: "ai",
        type: "network_error",
        message: "Network error",
        suggestions: [],
        recoveryStrategy: {
          canRecover: true,
          strategy: "retry",
          confidence: 0.8,
          estimatedSuccess: 0.8,
        },
      };

      const recoveryContext: RecoveryContext = {
        originalInput: "test input",
        previousAttempts: [],
        availableStrategies: [],
      };

      mockRecoveryFunction.mockRejectedValue(new Error("Failed"));

      await ErrorRecoverySystem.recover(
        parseError,
        recoveryContext,
        mockRecoveryFunction
      );

      const stats = ErrorRecoverySystem.getRecoveryStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.activeRecoveries).toBe(1);
    });

    it("should reset recovery attempts", async () => {
      const parseError: ParseError = {
        level: "ai",
        type: "network_error",
        message: "Network error",
        suggestions: [],
        recoveryStrategy: {
          canRecover: true,
          strategy: "retry",
          confidence: 0.8,
          estimatedSuccess: 0.8,
        },
      };

      const recoveryContext: RecoveryContext = {
        originalInput: "test input",
        previousAttempts: [],
        availableStrategies: [],
      };

      mockRecoveryFunction.mockRejectedValue(new Error("Failed"));
      await ErrorRecoverySystem.recover(
        parseError,
        recoveryContext,
        mockRecoveryFunction
      );

      ErrorRecoverySystem.resetRecoveryAttempts();

      const stats = ErrorRecoverySystem.getRecoveryStats();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.activeRecoveries).toBe(0);
    });
  });

  describe("error type determination", () => {
    it("should correctly identify malformed input errors", () => {
      const error = new Error("Malformed JSON in request");
      const parseError = ErrorRecoverySystem.classifyError(error, "input");

      expect(parseError.type).toBe("malformed_input");
      expect(parseError.recoveryStrategy.strategy).toBe("fallback");
    });

    it("should correctly identify missing data errors", () => {
      const error = new Error("Missing required URL field");
      const parseError = ErrorRecoverySystem.classifyError(error, "input");

      expect(parseError.type).toBe("missing_data");
      expect(parseError.suggestions).toContain(
        "Provide complete request information"
      );
    });

    it("should correctly identify network errors", () => {
      const error = new Error("Network connection failed");
      const parseError = ErrorRecoverySystem.classifyError(error, "ai");

      expect(parseError.type).toBe("network_error");
      expect(parseError.suggestions).toContain(
        "Check your internet connection"
      );
    });

    it("should handle unknown error types gracefully", () => {
      const error = new Error("Some unknown error occurred");
      const parseError = ErrorRecoverySystem.classifyError(error, "input");

      expect(parseError.type).toBe("input_processing_error");
      expect(parseError.recoveryStrategy.canRecover).toBe(true);
    });
  });

  describe("confidence-based strategy sorting", () => {
    it("should sort strategies by confidence in descending order", async () => {
      const lowConfidenceStrategy: RecoveryStrategy = {
        canRecover: true,
        strategy: "retry",
        confidence: 0.3,
        estimatedSuccess: 0.3,
      };

      const highConfidenceStrategy: RecoveryStrategy = {
        canRecover: true,
        strategy: "fallback",
        confidence: 0.9,
        estimatedSuccess: 0.9,
      };

      const parseError: ParseError = {
        level: "ai",
        type: "test_error",
        message: "Test error",
        suggestions: [],
        recoveryStrategy: lowConfidenceStrategy,
      };

      const recoveryContext: RecoveryContext = {
        originalInput: "test input",
        previousAttempts: [],
        availableStrategies: [lowConfidenceStrategy, highConfidenceStrategy],
      };

      const mockResult: LoadTestSpec = {
        name: "test",
        requests: [],
        loadPattern: { type: "constant", duration: "1m", rate: 10 },
      };

      mockRecoveryFunction.mockResolvedValueOnce(mockResult);

      const result = await ErrorRecoverySystem.recover(
        parseError,
        recoveryContext,
        mockRecoveryFunction
      );

      // Should use high confidence strategy first
      expect(result.recoveryPath[0]).toBe("fallback");
      expect(result.confidence).toBe(0.9);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AIErrorHandler,
  AIServiceError,
  AIErrorType,
} from "../../../src/core/parser/utils";
import { AxiosError } from "axios";

describe("AIErrorHandler", () => {
  let errorHandler: AIErrorHandler;

  beforeEach(() => {
    errorHandler = new AIErrorHandler({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitterEnabled: false, // Disable jitter for predictable tests
    });
  });

  describe("classifyError", () => {
    it("should classify connection refused errors correctly", () => {
      const axiosError = {
        isAxiosError: true,
        code: "ECONNREFUSED",
        message: "Connection refused",
      } as AxiosError;

      const aiError = errorHandler.classifyError(axiosError, {
        operation: "test_operation",
      });

      expect(aiError.type).toBe(AIErrorType.CONNECTION_FAILED);
      expect(aiError.retryable).toBe(true);
      expect(aiError.severity).toBe("high");
    });

    it("should classify timeout errors correctly", () => {
      const axiosError = {
        isAxiosError: true,
        code: "ETIMEDOUT",
        message: "Timeout",
      } as AxiosError;

      const aiError = errorHandler.classifyError(axiosError, {
        operation: "test_operation",
      });

      expect(aiError.type).toBe(AIErrorType.TIMEOUT);
      expect(aiError.retryable).toBe(true);
      expect(aiError.severity).toBe("medium");
    });

    it("should classify 401 errors as authentication failed", () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 401 },
        message: "Unauthorized",
      } as AxiosError;

      const aiError = errorHandler.classifyError(axiosError, {
        operation: "test_operation",
      });

      expect(aiError.type).toBe(AIErrorType.AUTHENTICATION_FAILED);
      expect(aiError.retryable).toBe(false);
      expect(aiError.severity).toBe("critical");
    });

    it("should classify 429 errors as rate limited", () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 429 },
        message: "Too Many Requests",
      } as AxiosError;

      const aiError = errorHandler.classifyError(axiosError, {
        operation: "test_operation",
      });

      expect(aiError.type).toBe(AIErrorType.RATE_LIMITED);
      expect(aiError.retryable).toBe(true);
      expect(aiError.severity).toBe("medium");
    });

    it("should classify 404 errors as model unavailable", () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 404 },
        message: "Not Found",
      } as AxiosError;

      const aiError = errorHandler.classifyError(axiosError, {
        operation: "test_operation",
      });

      expect(aiError.type).toBe(AIErrorType.MODEL_UNAVAILABLE);
      expect(aiError.retryable).toBe(true);
      expect(aiError.severity).toBe("high");
    });

    it("should classify 5xx errors as service unavailable", () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 500 },
        message: "Internal Server Error",
      } as AxiosError;

      const aiError = errorHandler.classifyError(axiosError, {
        operation: "test_operation",
      });

      expect(aiError.type).toBe(AIErrorType.SERVICE_UNAVAILABLE);
      expect(aiError.retryable).toBe(true);
      expect(aiError.severity).toBe("high");
    });

    it("should classify model-related errors", () => {
      const error = new Error("Model not found");

      const aiError = errorHandler.classifyError(error, {
        operation: "test_operation",
      });

      expect(aiError.type).toBe(AIErrorType.MODEL_UNAVAILABLE);
      expect(aiError.retryable).toBe(true);
      expect(aiError.severity).toBe("high");
    });

    it("should classify JSON parsing errors as invalid response", () => {
      const error = new Error("Invalid JSON response");

      const aiError = errorHandler.classifyError(error, {
        operation: "test_operation",
      });

      expect(aiError.type).toBe(AIErrorType.INVALID_RESPONSE);
      expect(aiError.retryable).toBe(false);
      expect(aiError.severity).toBe("low");
    });
  });

  describe("executeWithRetry", () => {
    it("should succeed on first attempt", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await errorHandler.executeWithRetry(
        operation,
        "test_operation"
      );

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection failed"))
        .mockRejectedValueOnce(new Error("Connection failed"))
        .mockResolvedValue("success");

      const result = await errorHandler.executeWithRetry(
        operation,
        "test_operation"
      );

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-retryable errors", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Invalid JSON"));

      await expect(
        errorHandler.executeWithRetry(operation, "test_operation")
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should fail after max attempts", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new Error("Connection failed"));

      await expect(
        errorHandler.executeWithRetry(operation, "test_operation")
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should apply exponential backoff", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection failed"))
        .mockRejectedValueOnce(new Error("Connection failed"))
        .mockResolvedValue("success");

      const startTime = Date.now();
      await errorHandler.executeWithRetry(operation, "test_operation");
      const endTime = Date.now();

      // Should have waited at least 100ms + 200ms = 300ms
      expect(endTime - startTime).toBeGreaterThan(250);
    });
  });

  describe("performHealthCheck", () => {
    it("should return healthy status when health check passes", async () => {
      const healthCheckFn = vi.fn().mockResolvedValue(true);

      const result = await errorHandler.performHealthCheck(
        healthCheckFn,
        "http://localhost:11434"
      );

      expect(result.healthy).toBe(true);
      expect(result.diagnostics).toBeNull();
    });

    it("should return unhealthy status when health check fails", async () => {
      const healthCheckFn = vi.fn().mockResolvedValue(false);

      const result = await errorHandler.performHealthCheck(
        healthCheckFn,
        "http://localhost:11434"
      );

      expect(result.healthy).toBe(false);
      expect(result.diagnostics).not.toBeNull();
      expect(result.diagnostics?.error.type).toBe(
        AIErrorType.SERVICE_UNAVAILABLE
      );
    });

    it("should return unhealthy status when health check throws", async () => {
      const healthCheckFn = vi
        .fn()
        .mockRejectedValue(new Error("Connection failed"));

      const result = await errorHandler.performHealthCheck(
        healthCheckFn,
        "http://localhost:11434"
      );

      expect(result.healthy).toBe(false);
      expect(result.diagnostics).not.toBeNull();
    });
  });

  describe("getGracefulDegradationStrategy", () => {
    it("should provide fallback parsing strategy for connection failures", () => {
      const error = new AIServiceError(
        AIErrorType.CONNECTION_FAILED,
        "Connection failed",
        {
          operation: "test",
          attempt: 1,
          maxAttempts: 3,
          timestamp: new Date(),
        }
      );

      const strategy = errorHandler.getGracefulDegradationStrategy(error);

      expect(strategy.canDegrade).toBe(true);
      expect(strategy.strategy).toBe("fallback_parsing");
      expect(strategy.confidence).toBe(0.3);
      expect(strategy.limitations).toContain("Limited parsing accuracy");
    });

    it("should provide cached responses strategy for timeouts", () => {
      const error = new AIServiceError(AIErrorType.TIMEOUT, "Request timeout", {
        operation: "test",
        attempt: 1,
        maxAttempts: 3,
        timestamp: new Date(),
      });

      const strategy = errorHandler.getGracefulDegradationStrategy(error);

      expect(strategy.canDegrade).toBe(true);
      expect(strategy.strategy).toBe("cached_responses");
      expect(strategy.confidence).toBe(0.6);
    });

    it("should provide no degradation for unknown errors", () => {
      const error = new AIServiceError(AIErrorType.UNKNOWN, "Unknown error", {
        operation: "test",
        attempt: 1,
        maxAttempts: 3,
        timestamp: new Date(),
      });

      const strategy = errorHandler.getGracefulDegradationStrategy(error);

      expect(strategy.canDegrade).toBe(false);
      expect(strategy.strategy).toBe("none");
      expect(strategy.confidence).toBe(0);
    });
  });

  describe("error statistics", () => {
    it("should track error counts and types", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection failed"))
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValue("success");

      await errorHandler.executeWithRetry(operation, "test_operation");

      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByType[AIErrorType.UNKNOWN]).toBe(1); // "Connection failed"
      expect(stats.errorsByType[AIErrorType.TIMEOUT]).toBe(1); // "Timeout"
      expect(stats.recentErrors).toHaveLength(2);
    });

    it("should clear diagnostics", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Test error"));

      try {
        await errorHandler.executeWithRetry(operation, "test_operation");
      } catch (error) {
        // Expected to fail
      }

      let stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBeGreaterThan(0);

      errorHandler.clearDiagnostics();

      stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
      expect(stats.recentErrors).toHaveLength(0);
    });
  });
});

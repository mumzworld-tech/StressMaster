/**
 * Unit tests for Smart AI Provider
 * Tests smart parsing capabilities, error handling, and validation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BaseAIProvider,
  SmartAIProvider,
  SmartParseResponse,
  ParseExplanation,
  ParseError,
  CompletionRequest,
  CompletionResponse,
  AIProviderConfig,
  ParseContext,
} from "../../../src/core/parser";
import { LoadTestSpec } from "../../../src/types";

// Mock implementation for testing
class MockSmartAIProvider extends BaseAIProvider implements SmartAIProvider {
  private mockResponse: string = "";
  private shouldThrow: boolean = false;
  private throwOnAttempt: number = 0;
  private currentAttempt: number = 0;
  public isInitialized: boolean = false;

  constructor(config: AIProviderConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    this.currentAttempt++;

    if (this.shouldThrow && this.currentAttempt >= this.throwOnAttempt) {
      throw new Error("Mock AI provider error");
    }

    return {
      response: this.mockResponse,
      model: "mock-model",
      usage: {
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
      },
      metadata: {
        provider: "mock",
        duration: 1000,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getProviderName(): string {
    return "MockSmartAIProvider";
  }

  // SmartAIProvider interface methods
  async parseWithContext(context: ParseContext): Promise<SmartParseResponse> {
    return {
      spec: {} as LoadTestSpec,
      confidence: 0.8,
      assumptions: [],
      warnings: [],
      suggestions: [],
    };
  }

  async validateAndCorrect(
    response: string,
    context: ParseContext
  ): Promise<LoadTestSpec> {
    return {} as LoadTestSpec;
  }

  async parseWithRecovery(context: ParseContext): Promise<SmartParseResponse> {
    return {
      spec: {} as LoadTestSpec,
      confidence: 0.7,
      assumptions: [],
      warnings: [],
      suggestions: [],
    };
  }

  // Test helpers
  setMockResponse(response: string): void {
    this.mockResponse = response;
  }

  setShouldThrow(shouldThrow: boolean, onAttempt: number = 1): void {
    this.shouldThrow = shouldThrow;
    this.throwOnAttempt = onAttempt;
    this.currentAttempt = 0;
  }
}

describe("SmartBaseAIProvider", () => {
  let provider: MockSmartAIProvider;
  let mockContext: ParseContext;

  beforeEach(() => {
    provider = new MockSmartAIProvider({
      model: "test-model",
      maxRetries: 3,
    });

    mockContext = {
      originalInput: "POST to /api/users with 50 users for 2 minutes",
      cleanedInput: "POST to /api/users with 50 users for 2 minutes",
      extractedComponents: {
        methods: ["POST"],
        urls: ["/api/users"],
        headers: [{}],
        bodies: [],
        counts: [50],
        jsonBlocks: [],
      },
      inferredFields: {
        testType: "baseline",
        duration: "2m",
        loadPattern: "constant",
      },
      ambiguities: [],
      confidence: 0.8,
    };

    provider.setMockResponse(
      JSON.stringify({
        id: "test_post_users",
        name: "POST Users API Test",
        description: "POST to /api/users with 50 users for 2 minutes",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "/api/users",
            headers: { "Content-Type": "application/json" },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 50,
        },
        duration: {
          value: 2,
          unit: "minutes",
        },
      })
    );
  });

  describe("parseWithContext", () => {
    it("should successfully parse valid context", async () => {
      await provider.initialize();

      const result: SmartParseResponse = await provider.parseWithContext(
        mockContext
      );

      expect(result.spec).toBeDefined();
      expect(result.spec.id).toBe("test_post_users");
      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.requests[0].url).toBe("/api/users");
      expect(result.spec.loadPattern.virtualUsers).toBe(50);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.assumptions).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.suggestions).toBeInstanceOf(Array);
    });

    it("should handle low confidence context", async () => {
      await provider.initialize();

      const lowConfidenceContext = {
        ...mockContext,
        confidence: 0.2,
        extractedComponents: {
          methods: [], // No methods extracted
          urls: [], // No URLs extracted
          headers: [{}],
          bodies: [],
          counts: [], // No counts extracted
        },
        ambiguities: [
          {
            field: "method",
            possibleValues: ["GET", "POST"],
            reason: "No method specified",
          },
        ],
      };

      const result = await provider.parseWithContext(lowConfidenceContext);

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.assumptions.length).toBeGreaterThan(0);
    });

    it("should handle AI provider errors with retry", async () => {
      await provider.initialize();

      // Fail on first attempt, succeed on second
      provider.setShouldThrow(true, 2);
      provider.setMockResponse(
        JSON.stringify({
          id: "test_retry",
          name: "Retry Test",
          description: "Test retry functionality",
          testType: "baseline",
          requests: [{ method: "GET", url: "/test" }],
          loadPattern: { type: "constant", virtualUsers: 1 },
          duration: { value: 30, unit: "seconds" },
        })
      );

      const result = await provider.parseWithContext(mockContext);

      expect(result.spec.id).toBe("test_retry");
    });

    it("should throw ParseError when all retries fail", async () => {
      await provider.initialize();

      provider.setShouldThrow(true, 1);

      await expect(provider.parseWithContext(mockContext)).rejects.toThrow();
    });

    it("should extract assumptions correctly", async () => {
      await provider.initialize();

      const contextWithMissingData = {
        ...mockContext,
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
      };

      const result = await provider.parseWithContext(contextWithMissingData);

      expect(result.assumptions.length).toBeGreaterThan(0);
      expect(result.assumptions.some((a) => a.field === "method")).toBe(true);
      expect(result.assumptions.some((a) => a.field === "url")).toBe(true);
    });
  });

  describe("validateAndCorrect", () => {
    it("should validate correct JSON response", async () => {
      await provider.initialize();

      const validResponse = JSON.stringify({
        id: "test_valid",
        name: "Valid Test",
        description: "A valid test spec",
        testType: "baseline",
        requests: [{ method: "GET", url: "/test" }],
        loadPattern: { type: "constant", virtualUsers: 10 },
        duration: { value: 30, unit: "seconds" },
      });

      const result = await provider.validateAndCorrect(
        validResponse,
        mockContext
      );

      expect(result.id).toBe("test_valid");
      expect(result.requests[0].method).toBe("GET");
    });

    it("should correct minor validation issues", async () => {
      await provider.initialize();

      const invalidResponse = JSON.stringify({
        // Missing id, name, description
        testType: "baseline",
        requests: [{ method: "GET", url: "/test" }],
        loadPattern: { type: "constant", virtualUsers: 10 },
        duration: { value: 30, unit: "seconds" },
      });

      const result = await provider.validateAndCorrect(
        invalidResponse,
        mockContext
      );

      expect(result.id).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.description).toBe(mockContext.originalInput);
    });

    it("should fix common JSON formatting issues", async () => {
      await provider.initialize();

      const malformedResponse = `\`\`\`json
{
  "id": "test_malformed",
  "name": "Malformed Test",
  "description": "Test with formatting issues",
  "testType": "baseline",
  "requests": [{ "method": "GET", "url": "/test" }],
  "loadPattern": { "type": "constant", "virtualUsers": 10 },
  "duration": { "value": 30, "unit": "seconds" },
}
\`\`\``;

      const result = await provider.validateAndCorrect(
        malformedResponse,
        mockContext
      );

      expect(result.id).toBe("test_malformed");
    });

    it("should attempt correction with AI provider", async () => {
      await provider.initialize();

      const invalidResponse = JSON.stringify({
        testType: "baseline",
        // Missing required fields
      });

      // Set up mock to return corrected response on retry
      provider.setMockResponse(
        JSON.stringify({
          id: "test_corrected",
          name: "Corrected Test",
          description: "Corrected by AI",
          testType: "baseline",
          requests: [{ method: "GET", url: "/test" }],
          loadPattern: { type: "constant", virtualUsers: 10 },
          duration: { value: 30, unit: "seconds" },
        })
      );

      const result = await provider.validateAndCorrect(
        invalidResponse,
        mockContext
      );

      expect(result.id).toBe("test_corrected");
    });

    it("should throw error when correction fails", async () => {
      await provider.initialize();

      const invalidResponse = "not json at all";

      await expect(
        provider.validateAndCorrect(invalidResponse, mockContext)
      ).rejects.toThrow();
    });
  });

  describe("explainParsing", () => {
    it("should provide comprehensive parsing explanation", async () => {
      await provider.initialize();

      const spec: LoadTestSpec = {
        id: "test_explain",
        name: "Explanation Test",
        description: "Test explanation functionality",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "/api/users",
            headers: { "Content-Type": "application/json" },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 50,
        },
        duration: {
          value: 2,
          unit: "minutes",
        },
      };

      const explanation: ParseExplanation = provider.explainParsing(
        spec,
        mockContext
      );

      expect(explanation.extractedComponents).toBeInstanceOf(Array);
      expect(explanation.extractedComponents.length).toBeGreaterThan(0);
      expect(explanation.assumptions).toBeInstanceOf(Array);
      expect(explanation.ambiguityResolutions).toBeInstanceOf(Array);
      expect(explanation.suggestions).toBeInstanceOf(Array);
    });

    it("should identify extracted components correctly", async () => {
      await provider.initialize();

      const spec: LoadTestSpec = {
        id: "test_components",
        name: "Components Test",
        description: "Test component identification",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "/api/users",
            headers: { Authorization: "Bearer token" },
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 100,
        },
        duration: {
          value: 5,
          unit: "minutes",
        },
      };

      const contextWithHeaders = {
        ...mockContext,
        extractedComponents: {
          ...mockContext.extractedComponents,
          headers: [{ Authorization: "Bearer token" }],
          counts: [100],
        },
      };

      const explanation = provider.explainParsing(spec, contextWithHeaders);

      expect(
        explanation.extractedComponents.some((c) => c.includes("HTTP Method"))
      ).toBe(true);
      expect(
        explanation.extractedComponents.some((c) => c.includes("URL"))
      ).toBe(true);
      expect(
        explanation.extractedComponents.some((c) => c.includes("User Count"))
      ).toBe(true);
      expect(
        explanation.extractedComponents.some((c) => c.includes("Headers"))
      ).toBe(true);
    });

    it("should explain ambiguity resolutions", async () => {
      await provider.initialize();

      const spec: LoadTestSpec = {
        id: "test_ambiguity",
        name: "Ambiguity Test",
        description: "Test ambiguity resolution",
        testType: "baseline",
        requests: [{ method: "GET", url: "/test" }],
        loadPattern: { type: "constant", virtualUsers: 10 },
        duration: { value: 30, unit: "seconds" },
      };

      const contextWithAmbiguities = {
        ...mockContext,
        ambiguities: [
          {
            field: "method",
            possibleValues: ["GET", "POST"],
            reason: "Method not specified",
          },
          {
            field: "userCount",
            possibleValues: ["10", "50"],
            reason: "Count ambiguous",
          },
        ],
      };

      const explanation = provider.explainParsing(spec, contextWithAmbiguities);

      expect(explanation.ambiguityResolutions.length).toBe(2);
      expect(
        explanation.ambiguityResolutions.some((r) => r.includes("method"))
      ).toBe(true);
      expect(
        explanation.ambiguityResolutions.some((r) => r.includes("count"))
      ).toBe(true);
    });

    it("should provide relevant suggestions", async () => {
      await provider.initialize();

      const spec: LoadTestSpec = {
        id: "test_suggestions",
        name: "Suggestions Test",
        description: "Test suggestion generation",
        testType: "stress",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/data",
            // Missing Content-Type header and payload
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 200, // High load without ramp-up
        },
        duration: {
          value: 30, // Short duration for stress test
          unit: "seconds",
        },
      };

      const explanation = provider.explainParsing(spec, mockContext);

      expect(explanation.suggestions.length).toBeGreaterThan(0);
      expect(
        explanation.suggestions.some((s) => s.includes("Content-Type"))
      ).toBe(true);
      expect(explanation.suggestions.some((s) => s.includes("payload"))).toBe(
        true
      );
      expect(explanation.suggestions.some((s) => s.includes("5 minutes"))).toBe(
        true
      );
    });
  });

  describe("error handling", () => {
    it("should create appropriate ParseError for different error levels", async () => {
      await provider.initialize();

      provider.setShouldThrow(true, 1);

      try {
        await provider.parseWithContext(mockContext);
        expect.fail("Should have thrown an error");
      } catch (error) {
        const parseError = error as ParseError;
        expect(parseError.level).toBe("ai");
        expect(parseError.suggestions).toBeInstanceOf(Array);
        expect(parseError.suggestions.length).toBeGreaterThan(0);
        expect(parseError.recoveryStrategy).toBeDefined();
        expect(parseError.recoveryStrategy.canRecover).toBe(true);
      }
    });

    it("should provide recovery strategies", async () => {
      await provider.initialize();

      provider.setShouldThrow(true, 1);

      try {
        await provider.parseWithContext(mockContext);
        expect.fail("Should have thrown an error");
      } catch (error) {
        const parseError = error as ParseError;
        expect(parseError.recoveryStrategy.strategy).toBe("retry");
        expect(parseError.recoveryStrategy.confidence).toBeGreaterThan(0);
        expect(parseError.recoveryStrategy.estimatedSuccess).toBeGreaterThan(0);
      }
    });
  });

  describe("confidence calculation", () => {
    it("should calculate higher confidence for complete specs", async () => {
      await provider.initialize();

      const completeContext = {
        ...mockContext,
        confidence: 0.7,
        ambiguities: [],
      };

      const result = await provider.parseWithContext(completeContext);

      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should reduce confidence for ambiguous input", async () => {
      await provider.initialize();

      const ambiguousContext = {
        ...mockContext,
        confidence: 0.5,
        ambiguities: [
          {
            field: "method",
            possibleValues: ["GET", "POST"],
            reason: "Unclear",
          },
          {
            field: "url",
            possibleValues: ["/a", "/b"],
            reason: "Multiple URLs",
          },
          {
            field: "userCount",
            possibleValues: ["10", "50"],
            reason: "Count unclear",
          },
          {
            field: "duration",
            possibleValues: ["1m", "5m"],
            reason: "Duration unclear",
          },
        ],
      };

      const result = await provider.parseWithContext(ambiguousContext);

      expect(result.confidence).toBeLessThan(0.7); // Should be less than original 0.5 + boosts
    });

    it("should maintain minimum confidence threshold", async () => {
      await provider.initialize();

      const veryLowConfidenceContext = {
        ...mockContext,
        confidence: 0.1,
        ambiguities: Array(10).fill({
          field: "test",
          possibleValues: ["a", "b"],
          reason: "Very ambiguous",
        }),
      };

      const result = await provider.parseWithContext(veryLowConfidenceContext);

      expect(result.confidence).toBeGreaterThanOrEqual(0.3); // MIN_CONFIDENCE_THRESHOLD
    });
  });

  describe("warning generation", () => {
    it("should generate warnings for low confidence", async () => {
      await provider.initialize();

      const lowConfidenceContext = {
        ...mockContext,
        confidence: 0.3,
      };

      const result = await provider.parseWithContext(lowConfidenceContext);

      expect(result.warnings.some((w) => w.includes("low confidence"))).toBe(
        true
      );
    });

    it("should warn about missing authentication for API endpoints", async () => {
      await provider.initialize();

      provider.setMockResponse(
        JSON.stringify({
          id: "test_api",
          name: "API Test",
          description: "API test without auth",
          testType: "baseline",
          requests: [
            {
              method: "GET",
              url: "https://api.example.com/data",
              // No Authorization header
            },
          ],
          loadPattern: { type: "constant", virtualUsers: 10 },
          duration: { value: 30, unit: "seconds" },
        })
      );

      const result = await provider.parseWithContext(mockContext);

      expect(result.warnings.some((w) => w.includes("authentication"))).toBe(
        true
      );
    });

    it("should warn about high load without ramp-up", async () => {
      await provider.initialize();

      provider.setMockResponse(
        JSON.stringify({
          id: "test_high_load",
          name: "High Load Test",
          description: "High load without ramp-up",
          testType: "baseline",
          requests: [{ method: "GET", url: "/test" }],
          loadPattern: { type: "constant", virtualUsers: 500 },
          duration: { value: 30, unit: "seconds" },
        })
      );

      const result = await provider.parseWithContext(mockContext);

      expect(result.warnings.some((w) => w.includes("ramp-up"))).toBe(true);
    });
  });
});

/**
 * Integration tests for enhanced command parser with smart parsing pipeline
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import {
  UnifiedCommandParser,
  DetailedParseResult,
} from "../../src/core/parser";
import { LoadTestSpec } from "../../src/types";

// Mock AI Provider Factory
vi.mock("../ai-provider-factory", () => ({
  AIProviderFactory: {
    create: vi.fn().mockReturnValue({
      getProviderName: vi.fn().mockReturnValue("MockProvider"),
      initialize: vi.fn().mockResolvedValue(undefined),
      generateCompletion: vi.fn().mockImplementation((request: any) => {
        // Dynamic response based on input
        const prompt = request.prompt || "";
        let method = "GET";
        let url = "https://api.example.com/test";

        if (prompt.includes("POST") || prompt.includes("post")) {
          method = "POST";
        }
        if (prompt.includes("/api/orders")) {
          url = "/api/orders";
        }
        if (prompt.includes("/login") || prompt.includes("login")) {
          url = "https://api.example.com/login";
        }

        return Promise.resolve({
          response: JSON.stringify({
            id: "test_123",
            name: "Test Load Test",
            description: "Test input",
            testType: "baseline",
            requests: [
              {
                method,
                url,
              },
            ],
            loadPattern: {
              type: "constant",
              virtualUsers: 10,
            },
            duration: {
              value: 30,
              unit: "seconds",
            },
          }),
        });
      }),
      healthCheck: vi.fn().mockResolvedValue(true),
    }),
  },
}));

describe("Enhanced Command Parser Integration", () => {
  let aiParser: AICommandParser;
  let universalParser: UniversalCommandParser;

  beforeEach(async () => {
    aiParser = new AICommandParser({
      modelName: "test-model",
      maxRetries: 3,
      timeout: 30000,
    });

    universalParser = new UniversalCommandParser({
      provider: "openai",
      model: "gpt-3.5-turbo",
      apiKey: "test-key",
    });

    await aiParser.initialize();
    await universalParser.initialize();
  });

  describe("Smart Parsing Pipeline", () => {
    it("should process natural language input through complete pipeline", async () => {
      const input =
        "Test the API endpoint https://api.example.com/users with 50 users for 2 minutes";

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result).toBeDefined();
      expect(result.spec).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.processingSteps).toContain("Input preprocessing");
      expect(result.processingSteps).toContain("Format detection");
      expect(result.processingSteps).toContain("Context enhancement");
      expect(result.processingSteps).toContain("Smart prompt building");
      expect(result.processingSteps).toContain("AI parsing");
      expect(result.processingSteps).toContain("Explanation generation");
    });

    it("should handle mixed structured data input", async () => {
      const input = `
        POST request to /api/orders
        Headers: Content-Type: application/json
        Body: {"productId": 123, "quantity": 2}
        Load: 100 concurrent users
        Duration: 5 minutes
      `;

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.requests[0].url).toContain("/api/orders");
      expect(result.explanation.extractedComponents).toContain(
        "HTTP Method: POST"
      );
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should handle curl command input", async () => {
      const input = `curl -X POST https://api.example.com/login -H "Content-Type: application/json" -d '{"username": "test", "password": "pass"}'`;

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.requests[0].url).toBe("https://api.example.com/login");
      expect(result.explanation.extractedComponents).toContain(
        "HTTP Method: POST"
      );
      expect(result.explanation.extractedComponents).toContain(
        "URL: https://api.example.com/login"
      );
    });

    it("should detect and resolve ambiguities", async () => {
      const input = "Test the endpoint with some users";

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result.ambiguities.length).toBeGreaterThan(0);
      expect(result.assumptions.length).toBeGreaterThan(0);
      expect(result.warnings).toContain(
        "Input had low confidence - please verify the generated test specification"
      );
    });

    it("should provide detailed explanations", async () => {
      const input =
        "GET https://api.example.com/products with 25 users for 1 minute";

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result.explanation).toBeDefined();
      expect(result.explanation.extractedComponents).toBeDefined();
      expect(result.explanation.assumptions).toBeDefined();
      expect(result.explanation.ambiguityResolutions).toBeDefined();
      expect(result.explanation.suggestions).toBeDefined();
    });
  });

  describe("Universal Parser Smart Pipeline", () => {
    it("should work with universal parser", async () => {
      const input =
        "Load test POST /api/users with 20 concurrent users for 30 seconds";

      const result = await universalParser.parseCommandWithSmartPipeline(input);

      expect(result).toBeDefined();
      expect(result.spec).toBeDefined();
      expect(result.processingSteps).toContain("AI parsing (MockProvider)");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should handle provider-specific processing", async () => {
      const input =
        "Stress test the API with increasing load from 10 to 100 users";

      const result = await universalParser.parseCommandWithSmartPipeline(input);

      expect(result.spec.testType).toBeDefined();
      expect(result.processingSteps).toContain("AI parsing (MockProvider)");
    });
  });

  describe("Fallback Mechanisms", () => {
    it("should fallback gracefully when AI parsing fails", async () => {
      // Mock AI failure
      const mockGenerateCompletion = vi
        .fn()
        .mockRejectedValue(new Error("AI service unavailable"));
      (aiParser as any).aiProvider.generateCompletion = mockGenerateCompletion;

      const input = "GET https://api.example.com/test with 10 users";

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result).toBeDefined();
      expect(result.spec).toBeDefined();
      expect(result.warnings).toContain(
        "Smart parsing failed: Smart prompt parsing failed: AI service unavailable"
      );
      expect(result.processingSteps).toContain(
        "Error: Smart prompt parsing failed: AI service unavailable"
      );
    });

    it("should use fallback when AI is not ready", async () => {
      const parser = new AICommandParser({
        modelName: "test-model",
        maxRetries: 3,
        timeout: 30000,
      });
      // Don't initialize, so AI is not ready

      const input = "Test API with 5 users";

      const result = await parser.parseCommandWithSmartPipeline(input);

      expect(result).toBeDefined();
      expect(result.spec).toBeDefined();
      expect(result.warnings).toContain(
        "AI model not available, used fallback parsing"
      );
      expect(result.processingSteps).toContain(
        "Fallback parsing (AI not ready)"
      );
    });
  });

  describe("Input Format Detection", () => {
    it("should detect natural language format", async () => {
      const input =
        "Please create a load test for the user registration API with 50 concurrent users";

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should detect JSON with text format", async () => {
      const input = `
        Test this API endpoint with the following request:
        {"method": "POST", "url": "/api/users", "body": {"name": "test"}}
        Use 20 users for 1 minute
      `;

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result).toBeDefined();
      expect(result.explanation.extractedComponents.length).toBeGreaterThan(0);
    });

    it("should detect concatenated requests", async () => {
      const input = `
        First request: GET /api/users
        Second request: POST /api/orders
        Test with 10 users each
      `;

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result).toBeDefined();
      expect(result.spec).toBeDefined();
    });
  });

  describe("Context Enhancement", () => {
    it("should infer missing fields", async () => {
      const input = "Test the login endpoint";

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result.assumptions.length).toBeGreaterThan(0);
      expect(result.assumptions.some((a) => a.field === "method")).toBe(true);
      expect(result.assumptions.some((a) => a.field === "url")).toBe(true);
    });

    it("should resolve ambiguities with reasonable defaults", async () => {
      const input = "Load test with users";

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result.ambiguities.length).toBeGreaterThan(0);
      expect(result.spec.loadPattern.virtualUsers).toBeGreaterThan(0);
    });
  });

  describe("Smart Prompt Building", () => {
    it("should build contextual prompts with examples", async () => {
      const input = "POST to /api/orders with 100 users";

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result).toBeDefined();
      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should provide clarifications for ambiguous input", async () => {
      const input = "Test something";

      const result = await aiParser.parseCommandWithSmartPipeline(input);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.ambiguities.length).toBeGreaterThan(0);
    });
  });

  describe("Performance and Efficiency", () => {
    it("should complete parsing within reasonable time", async () => {
      const input = "Load test POST /api/users with 50 users for 2 minutes";

      const startTime = Date.now();
      const result = await aiParser.parseCommandWithSmartPipeline(input);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should handle multiple concurrent parsing requests", async () => {
      const inputs = [
        "GET /api/users with 10 users",
        "POST /api/orders with 20 users",
        "PUT /api/products with 15 users",
      ];

      const promises = inputs.map((input) =>
        aiParser.parseCommandWithSmartPipeline(input)
      );
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.spec).toBeDefined();
      });
    });
  });
});

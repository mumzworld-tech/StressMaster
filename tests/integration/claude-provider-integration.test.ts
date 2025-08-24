import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AIProviderFactory } from "../../src/core/parser/ai-providers";
import { PromptBuilder } from "../../src/core/parser/prompt-builder";
import { LoadTestSpec } from "../../src/types";

describe("Claude Provider Integration Tests", () => {
  let claudeProvider: any;

  beforeAll(async () => {
    // Skip if no API key is available
    if (!process.env.AI_API_KEY) {
      console.log("Skipping Claude tests - no API key provided");
      return;
    }

    const config = {
      provider: "claude" as const,
      apiKey: process.env.AI_API_KEY,
      model: "claude-3-5-sonnet-20241022",
      maxRetries: 3,
      timeout: 30000,
    };

    claudeProvider = AIProviderFactory.create(config);
    await claudeProvider.initialize();
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe("Basic Functionality", () => {
    it("should initialize Claude provider", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      expect(claudeProvider.isReady()).toBe(true);
      expect(claudeProvider.getProviderName()).toBe("Anthropic Claude");
    });

    it("should perform health check", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const isHealthy = await claudeProvider.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe("Random Burst Pattern Parsing", () => {
    it("should parse random burst traffic patterns", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const input =
        "Send 50 requests at random intervals to simulate unpredictable real-world traffic patterns";

      const request = {
        prompt: input,
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 2000,
        temperature: 0.1,
        format: "json" as const,
      };

      const response = await claudeProvider.generateCompletion(request);

      expect(response.response).toBeDefined();
      expect(response.model).toBe("claude-3-5-sonnet-20241022");

      const parsed = JSON.parse(response.response);
      expect(parsed.loadPattern.type).toBe("random-burst");
      expect(parsed.loadPattern.burstConfig).toBeDefined();
    });

    it("should handle burst configuration parameters", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const input =
        "Test API with random bursts: 10-50 requests every 5-30 seconds with 40% burst probability";

      const request = {
        prompt: input,
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 2000,
        temperature: 0.1,
        format: "json" as const,
      };

      const response = await claudeProvider.generateCompletion(request);
      const parsed = JSON.parse(response.response);

      expect(parsed.loadPattern.type).toBe("random-burst");
      expect(parsed.loadPattern.burstConfig.minBurstSize).toBe(10);
      expect(parsed.loadPattern.burstConfig.maxBurstSize).toBe(50);
      expect(parsed.loadPattern.burstConfig.burstProbability).toBe(0.4);
    });
  });

  describe("High-Volume Bulk Data Parsing", () => {
    it("should parse bulk data payload specifications", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const input =
        "Push 1,000 requests, each carrying 100 items per payload to stress test bulk data handling";

      const request = {
        prompt: input,
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 2000,
        temperature: 0.1,
        format: "json" as const,
      };

      const response = await claudeProvider.generateCompletion(request);
      const parsed = JSON.parse(response.response);

      expect(parsed.testType).toBe("volume");
      expect(parsed.loadPattern.virtualUsers).toBe(1000);
      expect(parsed.requests[0].payload.variables).toContainEqual(
        expect.objectContaining({
          type: "bulk_data",
          parameters: expect.objectContaining({
            itemCount: 100,
          }),
        })
      );
    });

    it("should handle complex bulk data with nested variables", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const input =
        "Send 500 POST requests to /api/bulk-orders with each payload containing 50 order items, each item having random product IDs and quantities";

      const request = {
        prompt: input,
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 2000,
        temperature: 0.1,
        format: "json" as const,
      };

      const response = await claudeProvider.generateCompletion(request);
      const parsed = JSON.parse(response.response);

      expect(parsed.requests[0].method).toBe("POST");
      expect(parsed.requests[0].url).toBe("/api/bulk-orders");
      expect(parsed.loadPattern.virtualUsers).toBe(500);
    });
  });

  describe("Complex Real-World Scenarios", () => {
    it("should handle e-commerce traffic simulation", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const input = `
        Simulate Black Friday traffic patterns:
        - Random bursts of 100-500 users every 2-10 minutes
        - Each user makes 3-8 requests per session
        - 60% browse products, 25% add to cart, 15% checkout
        - Run for 4 hours to test system resilience
      `;

      const request = {
        prompt: input,
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 2000,
        temperature: 0.1,
        format: "json" as const,
      };

      const response = await claudeProvider.generateCompletion(request);
      const parsed = JSON.parse(response.response);

      expect(parsed.loadPattern.type).toBe("random-burst");
      expect(parsed.duration.value).toBe(4);
      expect(parsed.duration.unit).toBe("hours");
    });

    it("should handle IoT data ingestion patterns", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const input = `
        Test IoT data ingestion API:
        - 10,000 devices sending data every 30 seconds
        - Each payload contains 25 sensor readings
        - Random device IDs and sensor values
        - Simulate 24-hour continuous operation
      `;

      const request = {
        prompt: input,
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 2000,
        temperature: 0.1,
        format: "json" as const,
      };

      const response = await claudeProvider.generateCompletion(request);
      const parsed = JSON.parse(response.response);

      expect(parsed.loadPattern.virtualUsers).toBe(10000);
      expect(parsed.duration.value).toBe(24);
      expect(parsed.duration.unit).toBe("hours");
    });
  });

  describe("Smart Parsing Features", () => {
    it("should provide confidence scores", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const context = {
        originalInput: "Send 100 GET requests to /api/users",
        extractedComponents: {
          methods: ["GET"],
          urls: ["/api/users"],
          headers: [],
          bodies: [],
          counts: [100],
          jsonBlocks: [],
        },
        inferredFields: {
          testType: "baseline",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.8,
      };

      const response = await claudeProvider.parseWithContext(context);

      expect(response.confidence).toBeGreaterThan(0.5);
      expect(response.suggestions).toBeDefined();
      expect(response.assumptions).toBeDefined();
      expect(response.warnings).toBeDefined();
    });

    it("should handle validation and correction", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const invalidResponse =
        '{"invalid": "json", "missing": "required fields"}';
      const context = {
        originalInput: "Test API",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [],
          bodies: [],
          counts: [],
          jsonBlocks: [],
        },
        inferredFields: {},
        ambiguities: [],
        confidence: 0.3,
      };

      const corrected = await claudeProvider.validateAndCorrect(
        invalidResponse,
        context
      );

      expect(corrected).toBeDefined();
      expect(typeof corrected).toBe("object");
    });
  });

  describe("Performance and Token Usage", () => {
    it("should track token usage", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const request = {
        prompt: "Send 10 GET requests to /api/health",
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 2000,
        temperature: 0.1,
        format: "json" as const,
      };

      const response = await claudeProvider.generateCompletion(request);

      expect(response.usage).toBeDefined();
      expect(response.usage.promptTokens).toBeGreaterThan(0);
      expect(response.usage.completionTokens).toBeGreaterThan(0);
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    });

    it("should complete requests within reasonable time", async () => {
      if (!process.env.AI_API_KEY) {
        expect(true).toBe(true); // Skip test
        return;
      }

      const startTime = Date.now();

      const request = {
        prompt: "Send 5 POST requests to /api/users",
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 2000,
        temperature: 0.1,
        format: "json" as const,
      };

      const response = await claudeProvider.generateCompletion(request);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(response.response).toBeDefined();
    });
  });
});

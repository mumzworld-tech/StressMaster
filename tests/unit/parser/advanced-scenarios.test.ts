import { describe, it, expect } from "vitest";
import { PromptBuilder } from "../../../src/core/parser/prompt-builder";
import { LoadTestSpec } from "../../../src/types";

describe("Advanced Load Testing Scenarios", () => {
  describe("Random Burst Pattern", () => {
    it("should parse random burst traffic patterns", () => {
      const input =
        "Send 50 requests at random intervals to simulate unpredictable real-world traffic patterns";

      const prompt = PromptBuilder.buildFullPrompt(input);

      // Verify the prompt includes random burst guidance
      expect(prompt).toContain("random-burst");
      expect(prompt).toContain("unpredictable traffic");
      expect(prompt).toContain("burstConfig");
    });

    it("should handle burst configuration parameters", () => {
      const input =
        "Test API with random bursts: 10-50 requests every 5-30 seconds with 40% burst probability";

      const prompt = PromptBuilder.buildFullPrompt(input);

      expect(prompt).toContain("random-burst");
      expect(prompt).toContain("burstConfig");
    });
  });

  describe("High-Volume Bulk Data", () => {
    it("should parse bulk data payload specifications", () => {
      const input =
        "Push 1,000 requests, each carrying 100 items per payload to stress test bulk data handling";

      const prompt = PromptBuilder.buildFullPrompt(input);

      expect(prompt).toContain("bulk_data");
      expect(prompt).toContain("volume");
      expect(prompt).toContain("1000");
      expect(prompt).toContain("100 items");
    });

    it("should handle complex bulk data with nested variables", () => {
      const input =
        "Send 500 POST requests to /api/bulk-orders with each payload containing 50 order items, each item having random product IDs and quantities";

      const prompt = PromptBuilder.buildFullPrompt(input);

      expect(prompt).toContain("bulk_data");
      expect(prompt).toContain("random_id");
      expect(prompt).toContain("itemCount");
    });
  });

  describe("Complex Real-World Scenarios", () => {
    it("should handle e-commerce traffic simulation", () => {
      const input = `
        Simulate Black Friday traffic patterns:
        - Random bursts of 100-500 users every 2-10 minutes
        - Each user makes 3-8 requests per session
        - 60% browse products, 25% add to cart, 15% checkout
        - Run for 4 hours to test system resilience
      `;

      const prompt = PromptBuilder.buildFullPrompt(input);

      expect(prompt).toContain("random-burst");
      expect(prompt).toContain("workflow");
      expect(prompt).toContain("4 hours");
    });

    it("should handle IoT data ingestion patterns", () => {
      const input = `
        Test IoT data ingestion API:
        - 10,000 devices sending data every 30 seconds
        - Each payload contains 25 sensor readings
        - Random device IDs and sensor values
        - Simulate 24-hour continuous operation
      `;

      const prompt = PromptBuilder.buildFullPrompt(input);

      expect(prompt).toContain("bulk_data");
      expect(prompt).toContain("random_id");
      expect(prompt).toContain("24 hours");
    });
  });

  describe("Load Pattern Recognition", () => {
    it("should recognize random burst keywords", () => {
      const keywords = [
        "random intervals",
        "unpredictable traffic",
        "burst traffic",
        "sporadic requests",
        "irregular patterns",
      ];

      keywords.forEach((keyword) => {
        const input = `Test API with ${keyword}`;
        const prompt = PromptBuilder.buildFullPrompt(input);
        expect(prompt).toContain("random-burst");
      });
    });

    it("should recognize bulk data keywords", () => {
      const keywords = [
        "bulk data",
        "multiple items",
        "batch processing",
        "large payloads",
        "mass data",
      ];

      keywords.forEach((keyword) => {
        const input = `Test API with ${keyword}`;
        const prompt = PromptBuilder.buildFullPrompt(input);
        expect(prompt).toContain("bulk_data");
      });
    });
  });
});

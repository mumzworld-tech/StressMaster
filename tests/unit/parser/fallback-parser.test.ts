import { describe, it, expect } from "vitest";
import { FallbackParser } from "../../../src/core/parser";

describe("FallbackParser", () => {
  describe("parseCommand", () => {
    it("should parse HTTP method and URL", () => {
      const input = "GET https://api.example.com/users";
      const result = FallbackParser.parseCommand(input);

      expect(result.spec.requests[0].method).toBe("GET");
      expect(result.spec.requests[0].url).toBe("https://api.example.com/users");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it("should parse virtual users", () => {
      const input = "Send requests with 50 users";
      const result = FallbackParser.parseCommand(input);

      expect(result.spec.loadPattern.virtualUsers).toBe(50);
    });

    it("should parse requests per second", () => {
      const input = "Test at 100 rps";
      const result = FallbackParser.parseCommand(input);

      expect(result.spec.loadPattern.requestsPerSecond).toBe(100);
    });

    it("should parse duration", () => {
      const input = "Run test for 5 minutes";
      const result = FallbackParser.parseCommand(input);

      expect(result.spec.duration.value).toBe(5);
      expect(result.spec.duration.unit).toBe("minutes");
    });

    it("should parse test type", () => {
      const input = "Run a spike test";
      const result = FallbackParser.parseCommand(input);

      expect(result.spec.testType).toBe("spike");
    });

    it("should parse JSON payload", () => {
      const input = 'POST with payload: {"userId": "123", "name": "test"}';
      const result = FallbackParser.parseCommand(input);

      expect(result.spec.requests[0].payload?.template).toContain("userId");
      expect(result.spec.requests[0].payload?.template).toContain("name");
    });

    it("should extract keywords when patterns fail", () => {
      const input = "create a new user record gradually increasing load";
      const result = FallbackParser.parseCommand(input);

      expect(result.spec.requests[0].method).toBe("POST"); // 'create' keyword
      expect(result.spec.loadPattern.type).toBe("ramp-up"); // 'gradually' keyword
    });

    it("should handle complex input with multiple patterns", () => {
      const input =
        "POST https://api.example.com/orders with 100 users for 10 minutes spike test";
      const result = FallbackParser.parseCommand(input);

      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.requests[0].url).toBe(
        "https://api.example.com/orders"
      );
      expect(result.spec.loadPattern.virtualUsers).toBe(100);
      expect(result.spec.duration.value).toBe(10);
      expect(result.spec.duration.unit).toBe("minutes");
      expect(result.spec.testType).toBe("spike");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should set appropriate headers for POST requests", () => {
      const input = "POST https://api.example.com/data";
      const result = FallbackParser.parseCommand(input);

      expect(result.spec.requests[0].headers).toEqual({
        "Content-Type": "application/json",
      });
    });

    it("should generate meaningful test names", () => {
      const input = "spike test POST https://api.example.com/users";
      const result = FallbackParser.parseCommand(input);

      expect(result.spec.name).toBeDefined();
      expect(result.spec.name.length).toBeGreaterThan(0);
    });

    it("should use pattern-matching method for multiple patterns", () => {
      const input =
        "GET https://api.example.com/users with 50 users for 5 minutes";
      const result = FallbackParser.parseCommand(input);

      expect(result.method).toBe("pattern-matching");
    });

    it("should use keyword-extraction method when appropriate", () => {
      const input = "create user records gradually";
      const result = FallbackParser.parseCommand(input);

      expect(result.method).toBe("keyword-extraction");
    });

    it("should fall back to template-based method", () => {
      const input = "test something";
      const result = FallbackParser.parseCommand(input);

      expect(result.method).toBe("template-based");
      expect(result.spec).toBeDefined();
      expect(result.spec.id).toBeDefined();
    });
  });

  describe("canParse", () => {
    it("should return true for inputs with URLs", () => {
      expect(FallbackParser.canParse("GET https://api.example.com")).toBe(true);
      expect(FallbackParser.canParse("test /api/users")).toBe(true);
    });

    it("should return true for inputs with HTTP methods", () => {
      expect(FallbackParser.canParse("POST to the API")).toBe(true);
      expect(FallbackParser.canParse("fetch user data")).toBe(true);
    });

    it("should return true for inputs with numbers", () => {
      expect(FallbackParser.canParse("test with 50 users")).toBe(true);
      expect(FallbackParser.canParse("run for 5 minutes")).toBe(true);
    });

    it("should return false for very vague inputs", () => {
      expect(FallbackParser.canParse("test something")).toBe(false);
      expect(FallbackParser.canParse("do stuff")).toBe(false);
    });
  });

  describe("getConfidenceScore", () => {
    it("should give higher confidence for complete URLs", () => {
      const score1 = FallbackParser.getConfidenceScore(
        "GET https://api.example.com/users"
      );
      const score2 = FallbackParser.getConfidenceScore("GET /users");

      expect(score1).toBeGreaterThan(score2);
    });

    it("should give higher confidence for explicit HTTP methods", () => {
      const score1 = FallbackParser.getConfidenceScore(
        "POST https://api.example.com"
      );
      const score2 = FallbackParser.getConfidenceScore(
        "send to https://api.example.com"
      );

      expect(score1).toBeGreaterThan(score2);
    });

    it("should give higher confidence for specific load parameters", () => {
      const score1 = FallbackParser.getConfidenceScore("test with 50 users");
      const score2 = FallbackParser.getConfidenceScore("test with some users");

      expect(score1).toBeGreaterThan(score2);
    });

    it("should cap confidence at 0.8", () => {
      const score = FallbackParser.getConfidenceScore(
        "GET https://api.example.com/users with 50 users for 5 minutes spike test"
      );
      expect(score).toBeLessThanOrEqual(0.8);
    });

    it("should return 0 for inputs with no indicators", () => {
      const score = FallbackParser.getConfidenceScore("do something vague");
      expect(score).toBe(0);
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { FallbackParser } from "../../../../src/core/parser/fallback-parser";

describe("FallbackParser (Consolidated)", () => {
  let parser: FallbackParser;

  beforeEach(() => {
    parser = new FallbackParser();
  });

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

      expect(result.spec.name).toContain("Spike");
      expect(result.spec.name).toContain("POST");
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

  describe("intelligent parsing features", () => {
    it("should extract complete URLs", () => {
      const input =
        "Test https://api.example.com/users and http://localhost:3000/health";
      const result = parser.parseCommand(input);

      expect(result.spec.requests).toHaveLength(2);
      expect(result.spec.requests[0].url).toBe("https://api.example.com/users");
      expect(result.spec.requests[1].url).toBe("http://localhost:3000/health");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should extract URLs from different patterns", () => {
      const input =
        "url: https://api.test.com endpoint: /api/v1/data host: example.com";
      const result = parser.parseCommand(input);

      expect(result.spec.requests.length).toBeGreaterThan(0);
      expect(
        result.spec.requests.some((req) => req.url.includes("api.test.com"))
      ).toBe(true);
    });

    it("should infer URL when none found explicitly", () => {
      const input = "Load test server api.example.com with 100 users";
      const result = parser.parseCommand(input);

      expect(result.spec.requests).toHaveLength(1);
      expect(result.spec.requests[0].url).toBe("http://api.example.com");
    });

    it("should create default request when no URL can be determined", () => {
      const input = "Run some load test with high traffic";
      const result = parser.parseCommand(input);

      expect(result.spec.requests).toHaveLength(1);
      expect(result.spec.requests[0].url).toBe("http://example.com");
      expect(result.confidence).toBeLessThan(0.3);
    });

    it("should extract headers from key: value format", () => {
      const input = `
        POST https://api.example.com/users
        Content-Type: application/json
        Authorization: Bearer token123
      `;
      const result = parser.parseCommand(input);

      expect(result.spec.requests[0].headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer token123",
      });
    });

    it("should extract headers from JSON format", () => {
      const input = `
        POST https://api.example.com/users
        "Content-Type": "application/json"
        "X-API-Key": "secret123"
      `;
      const result = parser.parseCommand(input);

      expect(result.spec.requests[0].headers).toEqual({
        "Content-Type": "application/json",
        "X-API-Key": "secret123",
      });
    });

    it("should extract JSON bodies", () => {
      const input = `
        POST https://api.example.com/users
        {"name": "John", "email": "john@example.com"}
      `;
      const result = parser.parseCommand(input);

      expect(result.spec.requests[0].body).toBe(
        '{"name": "John", "email": "john@example.com"}'
      );
    });

    it("should extract bodies with body: prefix", () => {
      const input = `
        POST https://api.example.com/users
        body: {"name": "Jane", "age": 30}
      `;
      const result = parser.parseCommand(input);

      expect(result.spec.requests[0].body).toBe('{"name": "Jane", "age": 30}');
    });

    it("should create ramp-up pattern when specified", () => {
      const input =
        "Load test https://api.example.com with 100 users ramp-up: 30s";
      const result = parser.parseCommand(input);

      expect(result.spec.loadPattern.type).toBe("ramp-up");
      expect(result.spec.loadPattern.virtualUsers).toBe(100);
    });

    it("should use default load pattern when none specified", () => {
      const input = "GET https://api.example.com";
      const result = parser.parseCommand(input);

      expect(result.spec.loadPattern.type).toBe("constant");
      expect(result.spec.loadPattern.virtualUsers).toBe(10);
    });
  });

  describe("test name generation", () => {
    it("should extract test name from name: pattern", () => {
      const input =
        "name: User API Load Test\nGET https://api.example.com/users";
      const result = parser.parseCommand(input);

      expect(result.spec.name).toBe("User API Load Test");
    });

    it("should extract test name from test: pattern", () => {
      const input =
        "test: Authentication Endpoint\nPOST https://api.example.com/auth";
      const result = parser.parseCommand(input);

      expect(result.spec.name).toBe("Authentication Endpoint");
    });

    it("should generate name from URL when no explicit name", () => {
      const input = "GET https://api.example.com/users";
      const result = parser.parseCommand(input);

      expect(result.spec.name).toBe("Load test for api.example.com");
    });

    it("should use first line as name when no other pattern matches", () => {
      const input = "Quick performance test\nGET https://api.example.com";
      const result = parser.parseCommand(input);

      expect(result.spec.name).toBe("Quick performance test");
    });

    it("should use fallback name when nothing else works", () => {
      const input = "some random text without clear structure";
      const result = parser.parseCommand(input);

      expect(result.spec.name).toBe("Fallback load test");
    });
  });

  describe("confidence scoring", () => {
    it("should have high confidence for complete, well-formed input", () => {
      const input = `
        name: Complete API Test
        POST https://api.example.com/users
        Content-Type: application/json
        {"name": "John", "email": "john@example.com"}
        100 users for 5m
      `;
      const result = parser.parseCommand(input);

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.warnings).toHaveLength(0);
    });

    it("should have medium confidence for partially complete input", () => {
      const input = "GET https://api.example.com/users with 50 users";
      const result = parser.parseCommand(input);

      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it("should have low confidence for minimal input", () => {
      const input = "test something";
      const result = parser.parseCommand(input);

      expect(result.confidence).toBeLessThan(0.4);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should increase confidence for requests with headers", () => {
      const inputWithoutHeaders = "GET https://api.example.com/users";
      const inputWithHeaders = `
        GET https://api.example.com/users
        Authorization: Bearer token123
      `;

      const resultWithoutHeaders = parser.parseCommand(inputWithoutHeaders);
      const resultWithHeaders = parser.parseCommand(inputWithHeaders);

      expect(resultWithHeaders.confidence).toBeGreaterThan(
        resultWithoutHeaders.confidence
      );
    });

    it("should increase confidence for POST requests with bodies", () => {
      const inputWithoutBody = "POST https://api.example.com/users";
      const inputWithBody = `
        POST https://api.example.com/users
        {"name": "John"}
      `;

      const resultWithoutBody = parser.parseCommand(inputWithoutBody);
      const resultWithBody = parser.parseCommand(inputWithBody);

      expect(resultWithBody.confidence).toBeGreaterThan(
        resultWithoutBody.confidence
      );
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

  describe("edge cases", () => {
    it("should handle empty input gracefully", () => {
      const result = parser.parseCommand("");

      expect(result.spec.requests).toHaveLength(1);
      expect(result.spec.requests[0].url).toBe("http://example.com");
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should handle very long input", () => {
      const longInput =
        "GET https://api.example.com/users " + "x".repeat(10000);
      const result = parser.parseCommand(longInput);

      expect(result.spec.requests[0].method).toBe("GET");
      expect(result.spec.requests[0].url).toBe("https://api.example.com/users");
    });

    it("should handle input with special characters", () => {
      const input = `
        POST https://api.example.com/users?param=value&other=123
        Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9
        {"name": "John O'Connor", "email": "john+test@example.com"}
      `;
      const result = parser.parseCommand(input);

      expect(result.spec.requests[0].url).toBe(
        "https://api.example.com/users?param=value&other=123"
      );
      expect(result.spec.requests[0].headers.Authorization).toContain("Bearer");
      expect(result.spec.requests[0].body).toContain("John O'Connor");
    });

    it("should handle multiple requests in one input", () => {
      const input = `
        Test these endpoints:
        GET https://api.example.com/users
        POST https://api.example.com/users with {"name": "John"}
        DELETE https://api.example.com/users/123
        Run with 10 users for 1m
      `;
      const result = parser.parseCommand(input);

      expect(result.spec.requests).toHaveLength(3);
      expect(result.spec.requests[0].method).toBe("GET");
      expect(result.spec.requests[1].method).toBe("POST");
      expect(result.spec.requests[2].method).toBe("DELETE");
    });

    it("should handle malformed but parseable input", () => {
      const input = `
        POST,,,https://api.example.com/users,,,
        content-type:application/json;;;
        {"name":"John"email":"john@test.com"}
        50users 2minutes
      `;
      const result = parser.parseCommand(input);

      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.requests[0].url).toBe("https://api.example.com/users");
      expect(result.spec.requests[0].headers["content-type"]).toBe(
        "application/json"
      );
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });
});

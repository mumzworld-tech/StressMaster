import { describe, it, expect, beforeEach } from "vitest";
import { FallbackParser } from "../../../src/core/parser";

describe("FallbackParser", () => {
  let parser: FallbackParser;

  beforeEach(() => {
    parser = new FallbackParser();
  });

  describe("URL extraction", () => {
    it("should extract complete URLs", async () => {
      const input =
        "Test https://api.example.com/users and http://localhost:3000/health";
      const result = await parser.parseCommand(input);

      expect(result.spec.requests).toHaveLength(1);
      expect(result.spec.requests[0].url).toBe("https://api.example.com/users");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should extract URLs from different patterns", async () => {
      const input =
        "url: https://api.test.com endpoint: /api/v1/data host: example.com";
      const result = await parser.parseCommand(input);

      expect(result.spec.requests.length).toBeGreaterThan(0);
      expect(
        result.spec.requests.some((req) => req.url.includes("api.test.com"))
      ).toBe(true);
    });

    it("should infer URL when none found explicitly", async () => {
      const input = "Load test server api.example.com with 100 users";
      const result = await parser.parseCommand(input);

      expect(result.spec.requests).toHaveLength(1);
      expect(result.spec.requests[0].url).toBe("http://api.example.com");
      expect(result.assumptions).toContain(
        "Inferred URL: http://api.example.com"
      );
    });

    it("should create default request when no URL can be determined", async () => {
      const input = "Run some load test with high traffic";
      const result = await parser.parseCommand(input);

      expect(result.spec.requests).toHaveLength(1);
      expect(result.spec.requests[0].url).toBe("http://example.com");
      expect(result.assumptions).toContain(
        "Created default request due to parsing failure"
      );
      expect(result.confidence).toBeLessThan(0.3);
    });
  });

  describe("HTTP method extraction", () => {
    it("should extract HTTP methods", () => {
      const input = "POST https://api.example.com/users and GET /health";
      const result = parser.parse(input);

      expect(result.spec.requests).toHaveLength(2);
      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.requests[1].method).toBe("GET");
    });

    it("should extract methods from method: pattern", () => {
      const input = "method: PUT url: https://api.example.com/users/123";
      const result = parser.parse(input);

      expect(result.spec.requests[0].method).toBe("PUT");
    });

    it("should default to GET when no method specified", () => {
      const input = "https://api.example.com/users";
      const result = parser.parse(input);

      expect(result.spec.requests[0].method).toBe("GET");
      expect(result.assumptions).toContain("Defaulting to GET method");
    });
  });

  describe("header extraction", () => {
    it("should extract headers from key: value format", () => {
      const input = `
        POST https://api.example.com/users
        Content-Type: application/json
        Authorization: Bearer token123
      `;
      const result = parser.parse(input);

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
      const result = parser.parse(input);

      expect(result.spec.requests[0].headers).toEqual({
        "Content-Type": "application/json",
        "X-API-Key": "secret123",
      });
    });

    it("should handle mixed header formats", () => {
      const input = `
        POST https://api.example.com/users
        Content-Type: application/json
        header X-Custom-Header = custom-value
      `;
      const result = parser.parse(input);

      expect(result.spec.requests[0].headers["Content-Type"]).toBe(
        "application/json"
      );
      expect(result.spec.requests[0].headers["X-Custom-Header"]).toBe(
        "custom-value"
      );
    });
  });

  describe("body extraction", () => {
    it("should extract JSON bodies", () => {
      const input = `
        POST https://api.example.com/users
        {"name": "John", "email": "john@example.com"}
      `;
      const result = parser.parse(input);

      expect(result.spec.requests[0].body).toBe(
        '{"name": "John", "email": "john@example.com"}'
      );
    });

    it("should extract bodies with body: prefix", () => {
      const input = `
        POST https://api.example.com/users
        body: {"name": "Jane", "age": 30}
      `;
      const result = parser.parse(input);

      expect(result.spec.requests[0].body).toBe('{"name": "Jane", "age": 30}');
    });

    it("should extract bodies with data: prefix", () => {
      const input = `
        POST https://api.example.com/users
        data: {"username": "testuser"}
      `;
      const result = parser.parse(input);

      expect(result.spec.requests[0].body).toBe('{"username": "testuser"}');
    });
  });

  describe("load configuration extraction", () => {
    it("should extract user count", () => {
      const input = "Load test https://api.example.com with 50 users for 2m";
      const result = parser.parse(input);

      expect(result.spec.loadPattern.rate).toBe(50);
      expect(result.spec.loadPattern.duration).toBe("2m");
    });

    it("should extract concurrent users", () => {
      const input = "Test https://api.example.com with 100 concurrent requests";
      const result = parser.parse(input);

      expect(result.spec.loadPattern.rate).toBe(100);
    });

    it("should extract rate configuration", () => {
      const input = "GET https://api.example.com rate: 25 duration: 5m";
      const result = parser.parse(input);

      expect(result.spec.loadPattern.rate).toBe(25);
      expect(result.spec.loadPattern.duration).toBe("5m");
    });

    it("should create ramp-up pattern when specified", () => {
      const input =
        "Load test https://api.example.com with 100 users ramp-up: 30s";
      const result = parser.parse(input);

      expect(result.spec.loadPattern.type).toBe("ramp");
      expect(result.spec.loadPattern.endRate).toBe(100);
      expect(result.spec.loadPattern.rampDuration).toBe("30s");
      expect(result.assumptions).toContain(
        "Using ramp-up pattern with duration: 30s"
      );
    });

    it("should use default load pattern when none specified", () => {
      const input = "GET https://api.example.com";
      const result = parser.parse(input);

      expect(result.spec.loadPattern.type).toBe("constant");
      expect(result.spec.loadPattern.rate).toBe(10);
      expect(result.spec.loadPattern.duration).toBe("30s");
      expect(result.assumptions).toContain(
        "Using default load pattern: 10 requests/second for 30 seconds"
      );
    });
  });

  describe("test name generation", () => {
    it("should extract test name from name: pattern", () => {
      const input =
        "name: User API Load Test\nGET https://api.example.com/users";
      const result = parser.parse(input);

      expect(result.spec.name).toBe("User API Load Test");
    });

    it("should extract test name from test: pattern", () => {
      const input =
        "test: Authentication Endpoint\nPOST https://api.example.com/auth";
      const result = parser.parse(input);

      expect(result.spec.name).toBe("Authentication Endpoint");
    });

    it("should generate name from URL when no explicit name", () => {
      const input = "GET https://api.example.com/users";
      const result = parser.parse(input);

      expect(result.spec.name).toBe("Load test for api.example.com");
    });

    it("should use first line as name when no other pattern matches", () => {
      const input = "Quick performance test\nGET https://api.example.com";
      const result = parser.parse(input);

      expect(result.spec.name).toBe("Quick performance test");
    });

    it("should use fallback name when nothing else works", () => {
      const input = "some random text without clear structure";
      const result = parser.parse(input);

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
      const result = parser.parse(input);

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.warnings).toHaveLength(0);
    });

    it("should have medium confidence for partially complete input", () => {
      const input = "GET https://api.example.com/users with 50 users";
      const result = parser.parse(input);

      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it("should have low confidence for minimal input", () => {
      const input = "test something";
      const result = parser.parse(input);

      expect(result.confidence).toBeLessThan(0.4);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should reduce confidence for each warning", () => {
      const input = "some unclear input without proper structure";
      const result = parser.parse(input);

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should increase confidence for requests with headers", () => {
      const inputWithoutHeaders = "GET https://api.example.com/users";
      const inputWithHeaders = `
        GET https://api.example.com/users
        Authorization: Bearer token123
      `;

      const resultWithoutHeaders = parser.parse(inputWithoutHeaders);
      const resultWithHeaders = parser.parse(inputWithHeaders);

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

      const resultWithoutBody = parser.parse(inputWithoutBody);
      const resultWithBody = parser.parse(inputWithBody);

      expect(resultWithBody.confidence).toBeGreaterThan(
        resultWithoutBody.confidence
      );
    });
  });

  describe("complex input scenarios", () => {
    it("should handle mixed natural language and structured data", () => {
      const input = `
        I want to load test the user registration endpoint.
        The API is at https://api.example.com/register
        Use POST method with this JSON data: {"username": "testuser", "password": "secret123"}
        Set Content-Type to application/json
        Run with 25 concurrent users for 3 minutes
      `;
      const result = parser.parse(input);

      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.requests[0].url).toBe(
        "https://api.example.com/register"
      );
      expect(result.spec.requests[0].headers["Content-Type"]).toBe(
        "application/json"
      );
      expect(result.spec.requests[0].body).toContain("testuser");
      expect(result.spec.loadPattern.rate).toBe(25);
      expect(result.spec.loadPattern.duration).toBe("3m");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should handle multiple requests in one input", () => {
      const input = `
        Test these endpoints:
        GET https://api.example.com/users
        POST https://api.example.com/users with {"name": "John"}
        DELETE https://api.example.com/users/123
        Run with 10 users for 1m
      `;
      const result = parser.parse(input);

      expect(result.spec.requests).toHaveLength(3);
      expect(result.spec.requests[0].method).toBe("GET");
      expect(result.spec.requests[1].method).toBe("POST");
      expect(result.spec.requests[2].method).toBe("DELETE");
      expect(result.spec.loadPattern.rate).toBe(10);
    });

    it("should handle malformed but parseable input", () => {
      const input = `
        POST,,,https://api.example.com/users,,,
        content-type:application/json;;;
        {"name":"John"email":"john@test.com"}
        50users 2minutes
      `;
      const result = parser.parse(input);

      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.requests[0].url).toBe("https://api.example.com/users");
      expect(result.spec.requests[0].headers["content-type"]).toBe(
        "application/json"
      );
      expect(result.spec.loadPattern.rate).toBe(50);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe("edge cases", () => {
    it("should handle empty input gracefully", () => {
      const result = parser.parse("");

      expect(result.spec.requests).toHaveLength(1);
      expect(result.spec.requests[0].url).toBe("http://example.com");
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should handle very long input", () => {
      const longInput =
        "GET https://api.example.com/users " + "x".repeat(10000);
      const result = parser.parse(longInput);

      expect(result.spec.requests[0].method).toBe("GET");
      expect(result.spec.requests[0].url).toBe("https://api.example.com/users");
    });

    it("should handle input with special characters", () => {
      const input = `
        POST https://api.example.com/users?param=value&other=123
        Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9
        {"name": "John O'Connor", "email": "john+test@example.com"}
      `;
      const result = parser.parse(input);

      expect(result.spec.requests[0].url).toBe(
        "https://api.example.com/users?param=value&other=123"
      );
      expect(result.spec.requests[0].headers.Authorization).toContain("Bearer");
      expect(result.spec.requests[0].body).toContain("John O'Connor");
    });
  });
});

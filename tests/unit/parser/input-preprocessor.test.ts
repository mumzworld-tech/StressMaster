import { describe, it, expect, beforeEach } from "vitest";
import {
  DefaultInputPreprocessor,
  StructuredData,
  ParserUtils,
} from "@/core/parser";

describe("DefaultInputPreprocessor", () => {
  let preprocessor: DefaultInputPreprocessor;

  beforeEach(() => {
    preprocessor = new DefaultInputPreprocessor();
  });

  describe("sanitize", () => {
    it("should handle null and undefined input", () => {
      expect(ParserUtils.sanitizeInput(null as any)).toBe("");
      expect(ParserUtils.sanitizeInput(undefined as any)).toBe("");
      expect(ParserUtils.sanitizeInput("")).toBe("");
    });

    it("should remove control characters except newlines and tabs", () => {
      const input = "Hello\x00World\x01Test\nNew\tLine";
      const result = ParserUtils.sanitizeInput(input);
      expect(result).toBe("Hello World Test\nNew\tLine");
    });

    it("should normalize line endings", () => {
      const input = "Line1\r\nLine2\rLine3\nLine4";
      const result = ParserUtils.sanitizeInput(input);
      expect(result).toBe("Line1\nLine2\nLine3\nLine4");
    });

    it("should remove excessive whitespace", () => {
      const input =
        "  Multiple    spaces   and\n\n\n\nexcessive\n\n\n\nlines  ";
      const result = ParserUtils.sanitizeInput(input);
      expect(result).toBe("Multiple spaces and\n\nexcessive\n\nlines");
    });

    it("should trim leading and trailing whitespace from lines", () => {
      const input = "  Line 1  \n  Line 2  \n  Line 3  ";
      const result = ParserUtils.sanitizeInput(input);
      expect(result).toBe("Line 1\nLine 2\nLine 3");
    });
  });

  describe("normalizeWhitespace", () => {
    it("should handle null and undefined input", () => {
      expect(ParserUtils.normalizeWhitespace(null as any)).toBe("");
      expect(ParserUtils.normalizeWhitespace(undefined as any)).toBe("");
    });

    it("should replace multiple whitespace with single space", () => {
      const input = "Multiple    spaces   here";
      const result = ParserUtils.normalizeWhitespace(input);
      expect(result).toBe("Multiple spaces here");
    });

    it("should clean up line breaks", () => {
      const input = "Line1  \n  Line2  \n  Line3";
      const result = ParserUtils.normalizeWhitespace(input);
      expect(result).toBe("Line1\nLine2\nLine3");
    });
  });

  describe("extractStructuredData", () => {
    it("should extract all structured data components", () => {
      const input = `
        POST https://api.example.com/users
        Content-Type: application/json
        Authorization: Bearer token123
        
        {"name": "John", "email": "john@example.com"}
        
        GET /api/health
      `;

      const result = ParserUtils.extractStructuredData(input);

      expect(result.methods).toContain("POST");
      expect(result.methods).toContain("GET");
      expect(result.urls).toContain("https://api.example.com/users");
      expect(result.urls).toContain("/api/health");
      expect(result.headers["Content-Type"]).toBe("application/json");
      expect(result.headers["Authorization"]).toBe("Bearer token123");
      expect(result.jsonBlocks).toHaveLength(1);
      expect(JSON.parse(result.jsonBlocks[0])).toEqual({
        name: "John",
        email: "john@example.com",
      });
    });

    it("should handle empty input", () => {
      const result = ParserUtils.extractStructuredData("");
      expect(result).toEqual({
        jsonBlocks: [],
        urls: [],
        headers: {},
        methods: [],
        keyValuePairs: {},
      });
    });
  });

  describe("separateRequests", () => {
    it("should separate requests by markdown separators", () => {
      const input = `
        Request 1 content
        ---
        Request 2 content
        ===
        Request 3 content
      `;

      const result = ParserUtils.separateRequests(input);
      expect(result).toHaveLength(3);
      expect(result[0]).toContain("Request 1 content");
      expect(result[1]).toContain("Request 2 content");
      expect(result[2]).toContain("Request 3 content");
    });

    it("should separate requests by numbered lists", () => {
      const input = `
        First request
        1.
        Second request
        2.
        Third request
      `;

      const result = ParserUtils.separateRequests(input);
      expect(result).toHaveLength(3);
      expect(result[0]).toContain("First request");
      expect(result[1]).toContain("Second request");
      expect(result[2]).toContain("Third request");
    });

    it("should handle single request without separators", () => {
      const input = "Single request content";
      const result = ParserUtils.separateRequests(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("Single request content");
    });

    it("should filter out empty requests", () => {
      const input =
        "Request 1\n---\n\n---\nRequest 2\n---\n   \n---\nRequest 3";
      const result = ParserUtils.separateRequests(input);
      expect(result).toHaveLength(3);
      expect(result.every((req) => req.trim().length > 0)).toBe(true);
    });
  });

  describe("JSON extraction", () => {
    it("should extract valid JSON blocks", () => {
      const input = `
        Some text {"valid": "json"} more text
        {"another": {"nested": "object"}}
        Invalid json {broken
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.jsonBlocks).toHaveLength(2);
      expect(JSON.parse(result.jsonBlocks[0])).toEqual({ valid: "json" });
      expect(JSON.parse(result.jsonBlocks[1])).toEqual({
        another: { nested: "object" },
      });
    });

    it("should attempt to fix malformed JSON", () => {
      const input = `{'name': 'John', age: 30, 'active': true}`;
      const result = ParserUtils.extractStructuredData(input);
      expect(result.jsonBlocks).toHaveLength(1);
      expect(JSON.parse(result.jsonBlocks[0])).toEqual({
        name: "John",
        age: "30",
        active: "true",
      });
    });

    it("should ignore unfixable JSON", () => {
      const input = `{broken json with no closing brace`;
      const result = ParserUtils.extractStructuredData(input);
      expect(result.jsonBlocks).toHaveLength(0);
    });
  });

  describe("URL extraction", () => {
    it("should extract HTTP and HTTPS URLs", () => {
      const input = `
        Visit https://api.example.com/users
        Also check http://localhost:3000/health
        And relative path /api/data
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.urls).toContain("https://api.example.com/users");
      expect(result.urls).toContain("http://localhost:3000/health");
      expect(result.urls).toContain("/api/data");
    });

    it("should remove duplicate URLs", () => {
      const input = `
        https://api.example.com/users
        https://api.example.com/users
        https://api.example.com/users
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.urls).toHaveLength(1);
      expect(result.urls[0]).toBe("https://api.example.com/users");
    });
  });

  describe("Header extraction", () => {
    it("should extract standard header format", () => {
      const input = `
        Content-Type: application/json
        Authorization: Bearer token123
        X-Custom-Header: custom-value
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.headers["Content-Type"]).toBe("application/json");
      expect(result.headers["Authorization"]).toBe("Bearer token123");
      expect(result.headers["X-Custom-Header"]).toBe("custom-value");
    });

    it("should extract quoted header format", () => {
      const input = `
        "Content-Type": "application/json"
        'Authorization': 'Bearer token123'
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.headers["Content-Type"]).toBe("application/json");
      expect(result.headers["Authorization"]).toBe("Bearer token123");
    });

    it("should normalize header keys", () => {
      const input = `
        content-type: application/json
        AUTHORIZATION: Bearer token123
        x-custom-header: custom-value
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.headers["Content-Type"]).toBe("application/json");
      expect(result.headers["Authorization"]).toBe("Bearer token123");
      expect(result.headers["X-Custom-Header"]).toBe("custom-value");
    });
  });

  describe("HTTP method extraction", () => {
    it("should extract all HTTP methods", () => {
      const input = `
        GET /api/users
        POST /api/users
        PUT /api/users/1
        DELETE /api/users/1
        PATCH /api/users/1
        HEAD /api/health
        OPTIONS /api/cors
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.methods).toContain("GET");
      expect(result.methods).toContain("POST");
      expect(result.methods).toContain("PUT");
      expect(result.methods).toContain("DELETE");
      expect(result.methods).toContain("PATCH");
      expect(result.methods).toContain("HEAD");
      expect(result.methods).toContain("OPTIONS");
    });

    it("should handle case insensitive methods", () => {
      const input = "get /api/users post /api/users";
      const result = ParserUtils.extractStructuredData(input);
      expect(result.methods).toContain("GET");
      expect(result.methods).toContain("POST");
    });

    it("should remove duplicate methods", () => {
      const input = "GET /api/users GET /api/posts GET /api/comments";
      const result = ParserUtils.extractStructuredData(input);
      expect(result.methods).toHaveLength(1);
      expect(result.methods[0]).toBe("GET");
    });
  });

  describe("Key-value pair extraction", () => {
    it("should extract colon-separated pairs", () => {
      const input = `
        timeout: 30s
        users: 100
        duration: 5m
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.keyValuePairs["timeout"]).toBe("30s");
      expect(result.keyValuePairs["users"]).toBe("100");
      expect(result.keyValuePairs["duration"]).toBe("5m");
    });

    it("should extract equals-separated pairs", () => {
      const input = `
        timeout = 30s
        users = 100
        duration = 5m
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.keyValuePairs["timeout"]).toBe("30s");
      expect(result.keyValuePairs["users"]).toBe("100");
      expect(result.keyValuePairs["duration"]).toBe("5m");
    });

    it("should handle mixed separators", () => {
      const input = `
        timeout: 30s
        users = 100
        duration: 5m
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.keyValuePairs["timeout"]).toBe("30s");
      expect(result.keyValuePairs["users"]).toBe("100");
      expect(result.keyValuePairs["duration"]).toBe("5m");
    });
  });

  describe("Real-world messy input scenarios", () => {
    it("should handle copy-pasted curl command", () => {
      const input = `
        curl -X POST https://api.example.com/users \\
          -H "Content-Type: application/json" \\
          -H "Authorization: Bearer token123" \\
          -d '{"name": "John", "email": "john@example.com"}'
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.methods).toContain("POST");
      expect(result.urls).toContain("https://api.example.com/users");
      expect(result.headers["Content-Type"]).toBe("application/json");
      expect(result.headers["Authorization"]).toBe("Bearer token123");
      expect(result.jsonBlocks).toHaveLength(1);
    });

    it("should handle mixed natural language and structured data", () => {
      const input = `
        I need to test the user creation endpoint.
        The URL is https://api.example.com/users
        Use POST method with these headers:
        Content-Type: application/json
        Authorization: Bearer token123
        
        Send this data: {"name": "John", "email": "john@example.com"}
        
        Run with 50 users for 2 minutes
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.methods).toContain("POST");
      expect(result.urls).toContain("https://api.example.com/users");
      expect(result.headers["Content-Type"]).toBe("application/json");
      expect(result.headers["Authorization"]).toBe("Bearer token123");
      expect(result.jsonBlocks).toHaveLength(1);
    });

    it("should handle concatenated requests", () => {
      const input = `
        POST https://api.example.com/login {"username": "admin", "password": "secret"}
        GET https://api.example.com/users Authorization: Bearer token123
        DELETE https://api.example.com/users/1 Authorization: Bearer token123
      `;

      const result = ParserUtils.extractStructuredData(input);
      expect(result.methods).toContain("POST");
      expect(result.methods).toContain("GET");
      expect(result.methods).toContain("DELETE");
      expect(result.urls).toHaveLength(3);
      expect(result.jsonBlocks).toHaveLength(1);
    });
  });
});

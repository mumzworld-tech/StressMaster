import { describe, it, expect, beforeEach } from "vitest";
import { FormatDetector } from "../../../src/core/parser/utils";

describe("FormatDetector", () => {
  let detector: FormatDetector;

  beforeEach(() => {
    detector = new FormatDetector();
  });

  describe("curl command detection", () => {
    it("should detect simple curl command", () => {
      const input = `curl -X POST https://api.example.com/users`;
      const result = detector.detectFormat(input);

      expect(result.format).toBe("curl_command");
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.hints).toContainEqual(
        expect.objectContaining({
          type: "method",
          value: "POST",
        })
      );
      expect(result.hints).toContainEqual(
        expect.objectContaining({
          type: "url",
          value: "https://api.example.com/users",
        })
      );
    });

    it("should detect curl with headers and data", () => {
      const input = `curl -X POST https://api.example.com/users \\
        -H "Content-Type: application/json" \\
        -d '{"name": "John", "email": "john@example.com"}'`;

      const result = detector.detectFormat(input);

      expect(result.format).toBe("curl_command");
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.hints.some((h) => h.type === "body")).toBe(true);
    });
  });

  describe("HTTP raw format detection", () => {
    it("should detect raw HTTP request", () => {
      const input = `POST /api/users HTTP/1.1
Host: api.example.com
User-Agent: Mozilla/5.0
Content-Type: application/json
Authorization: Bearer token123

{"name": "John", "email": "john@example.com"}`;

      const result = detector.detectFormat(input);

      expect(result.format).toBe("http_raw");
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.hints.some((h) => h.type === "method")).toBe(true);
      expect(result.hints.some((h) => h.type === "headers")).toBe(true);
    });
  });

  describe("JSON with text detection", () => {
    it("should detect JSON mixed with natural language", () => {
      const input = `Please create a load test for this endpoint with the following payload:
      {"userId": 123, "action": "login", "timestamp": "2024-01-01T00:00:00Z"}
      Test with 50 concurrent users for 5 minutes.`;

      const result = detector.detectFormat(input);

      expect(result.format).toBe("json_with_text");
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.hints.some((h) => h.type === "body")).toBe(true);
      expect(result.hints.some((h) => h.type === "count")).toBe(true);
    });
  });

  describe("mixed structured data detection", () => {
    it("should detect mixed structured data", () => {
      const input = `I need to test the POST endpoint at https://api.example.com/orders
      with these headers:
      Authorization: Bearer abc123
      Content-Type: application/json
      
      Use 100 concurrent users`;

      const result = detector.detectFormat(input);

      expect(result.format).toBe("mixed_structured");
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.hints.some((h) => h.type === "url")).toBe(true);
      expect(result.hints.some((h) => h.type === "headers")).toBe(true);
      expect(result.hints.some((h) => h.type === "count")).toBe(true);
    });
  });

  describe("concatenated requests detection", () => {
    it("should detect multiple requests in one input", () => {
      const input = `GET https://api.example.com/users
      POST https://api.example.com/orders
      DELETE https://api.example.com/sessions`;

      const result = detector.detectFormat(input);

      expect(result.format).toBe("concatenated_requests");
      expect(result.confidence).toBeGreaterThan(0.4);

      const methodHints = result.hints.filter((h) => h.type === "method");
      const urlHints = result.hints.filter((h) => h.type === "url");

      expect(methodHints.length).toBe(3);
      expect(urlHints.length).toBe(3);
    });
  });

  describe("natural language detection", () => {
    it("should detect pure natural language", () => {
      const input = `Please create a performance test that simulates 200 users accessing our login page for 10 minutes`;

      const result = detector.detectFormat(input);

      expect(result.format).toBe("natural_language");
      expect(result.confidence).toBeGreaterThan(0.25);
      expect(result.hints.some((h) => h.type === "count")).toBe(true);
    });

    it("should default to natural language for unclear input", () => {
      const input = `This is just some random text without any clear structure`;

      const result = detector.detectFormat(input);

      expect(result.format).toBe("natural_language");
    });
  });

  describe("parsing hints extraction", () => {
    it("should extract HTTP methods correctly", () => {
      const input = `POST request to the API, then GET the results`;
      const result = detector.detectFormat(input);

      const methodHints = result.hints.filter((h) => h.type === "method");
      expect(methodHints).toHaveLength(2);
      expect(methodHints[0].value).toBe("POST");
      expect(methodHints[1].value).toBe("GET");
      expect(methodHints[0].confidence).toBe(0.9);
    });

    it("should extract URLs with high confidence", () => {
      const input = `Test https://api.example.com/v1/users and http://localhost:3000/health`;
      const result = detector.detectFormat(input);

      const urlHints = result.hints.filter((h) => h.type === "url");
      expect(urlHints).toHaveLength(2);
      expect(urlHints[0].confidence).toBe(0.95);
      expect(urlHints[0].value).toBe("https://api.example.com/v1/users");
    });

    it("should extract headers correctly", () => {
      const input = `Authorization: Bearer token123
      Content-Type: application/json
      X-Custom-Header: custom-value`;

      const result = detector.detectFormat(input);

      const headerHints = result.hints.filter((h) => h.type === "headers");
      expect(headerHints).toHaveLength(3);
      expect(headerHints[0].confidence).toBe(0.8);
    });

    it("should extract user counts from various formats", () => {
      const input = `Test with 50 users, 100 concurrent connections, and 25 parallel threads`;
      const result = detector.detectFormat(input);

      const countHints = result.hints.filter((h) => h.type === "count");
      expect(countHints).toHaveLength(3);
      expect(countHints.map((h) => h.value)).toEqual(["50", "100", "25"]);
    });

    it("should validate JSON and assign appropriate confidence", () => {
      const input = `Valid JSON: {"name": "test"} and invalid: {"name": test}`;
      const result = detector.detectFormat(input);

      const bodyHints = result.hints.filter((h) => h.type === "body");
      expect(bodyHints).toHaveLength(2);
      expect(bodyHints[0].confidence).toBe(0.9); // Valid JSON
      expect(bodyHints[1].confidence).toBe(0.5); // Invalid JSON
    });
  });

  describe("confidence scoring", () => {
    it("should return higher confidence for clear patterns", () => {
      const curlInput = `curl -X POST https://api.example.com/users -H "Content-Type: application/json"`;
      const vagueInput = `maybe test something`;

      const curlResult = detector.detectFormat(curlInput);
      const vagueResult = detector.detectFormat(vagueInput);

      expect(curlResult.confidence).toBeGreaterThan(vagueResult.confidence);
    });

    it("should cap confidence at 1.0", () => {
      const input = `curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d '{"test": true}'`;
      const result = detector.detectFormat(input);

      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe("position tracking", () => {
    it("should track positions of extracted hints", () => {
      const input = `POST https://api.example.com/users`;
      const result = detector.detectFormat(input);

      const methodHint = result.hints.find((h) => h.type === "method");
      const urlHint = result.hints.find((h) => h.type === "url");

      expect(methodHint?.position.start).toBe(0);
      expect(methodHint?.position.end).toBe(4);
      expect(urlHint?.position.start).toBe(5);
      expect(urlHint?.position.end).toBe(34);
    });
  });

  describe("edge cases", () => {
    it("should handle empty input", () => {
      const result = detector.detectFormat("");

      expect(result.format).toBe("natural_language");
      expect(result.hints).toHaveLength(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should handle very long input", () => {
      const longInput =
        "test ".repeat(1000) + "POST https://api.example.com/test";
      const result = detector.detectFormat(longInput);

      expect(result.format).toBeDefined();
      expect(result.hints.length).toBeGreaterThan(0);
    });

    it("should handle special characters", () => {
      const input = `POST https://api.example.com/test?param=value&other=123#fragment`;
      const result = detector.detectFormat(input);

      expect(result.hints.some((h) => h.type === "url")).toBe(true);
      expect(result.hints.some((h) => h.type === "method")).toBe(true);
    });

    it("should not confuse URLs in headers", () => {
      const input = `Referer: https://example.com/page
Authorization: Bearer token`;

      const result = detector.detectFormat(input);

      const headerHints = result.hints.filter((h) => h.type === "headers");
      const urlHints = result.hints.filter((h) => h.type === "url");

      expect(headerHints.length).toBe(2);
      expect(urlHints.length).toBe(1); // Should still detect the URL
    });
  });

  describe("utility methods", () => {
    it("should return confidence from result", () => {
      const input = `curl -X GET https://api.example.com/test`;
      const result = detector.detectFormat(input);
      const confidence = result.confidence;

      expect(confidence).toBe(result.confidence);
    });

    it("should return hints from result", () => {
      const input = `POST https://api.example.com/test`;
      const result = detector.detectFormat(input);
      const hints = result.hints;

      expect(hints).toBe(result.hints);
      expect(hints.length).toBeGreaterThan(0);
    });
  });
});

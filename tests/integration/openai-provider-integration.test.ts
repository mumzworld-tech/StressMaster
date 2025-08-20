/**
 * Integration tests for enhanced OpenAI provider with smart parsing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAIProvider } from "../../src/core/parser/ai-providers";
import { ParseContext } from "../../src/core/parser/utils";
import { LoadTestSpec } from "../../src/types";

// Mock fetch for testing
global.fetch = vi.fn();

describe("OpenAIProvider Integration Tests", () => {
  let provider: OpenAIProvider;
  const mockConfig = {
    apiKey: "test-api-key",
    model: "gpt-3.5-turbo",
  };

  beforeEach(() => {
    provider = new OpenAIProvider(mockConfig);
    vi.clearAllMocks();
  });

  describe("Smart Parsing Integration", () => {
    it("should parse natural language input with context", async () => {
      // Mock successful API response
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                id: "test_1",
                name: "API Load Test",
                description: "Test API with 50 users for 2 minutes",
                testType: "baseline",
                requests: [
                  {
                    method: "GET",
                    url: "https://api.example.com/users",
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
              }),
            },
          },
        ],
        model: "gpt-3.5-turbo",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const context: ParseContext = {
        originalInput: "Test API with 50 users for 2 minutes",
        cleanedInput: "Test API with 50 users for 2 minutes",
        extractedComponents: {
          methods: ["GET"],
          urls: ["https://api.example.com/users"],
          headers: [{}],
          bodies: [],
          counts: [50],
        },
        inferredFields: {
          testType: "baseline",
          duration: "2m",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.8,
      };

      const result = await provider.parseWithContext(context);

      expect(result.spec).toBeDefined();
      expect(result.spec.requests[0].method).toBe("GET");
      expect(result.spec.loadPattern.virtualUsers).toBe(50);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.assumptions).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it("should handle messy input with preprocessing", async () => {
      const messyInput = `
        POST   /api/users   
        Content-Type: application/json
        
        {"name": "test"}
        
        Run with 100 users for 5 minutes
      `;

      // Mock successful API response
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                id: "test_messy",
                name: "Users API Test",
                description: messyInput.trim(),
                testType: "baseline",
                requests: [
                  {
                    method: "POST",
                    url: "/api/users",
                    headers: { "Content-Type": "application/json" },
                    payload: {
                      template: '{"name": "{{name}}"}',
                      variables: [
                        {
                          name: "name",
                          type: "random_string",
                          parameters: { length: 8 },
                        },
                      ],
                    },
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
              }),
            },
          },
        ],
        model: "gpt-3.5-turbo",
        usage: {
          prompt_tokens: 150,
          completion_tokens: 250,
          total_tokens: 400,
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const spec = await provider.parseCommand(messyInput);

      expect(spec).toBeDefined();
      expect(spec.requests[0].method).toBe("POST");
      expect(spec.requests[0].url).toBe("/api/users");
      expect(spec.requests[0].headers?.["Content-Type"]).toBe(
        "application/json"
      );
      expect(spec.loadPattern.virtualUsers).toBe(100);
      expect(spec.duration.value).toBe(5);
      expect(spec.duration.unit).toBe("minutes");
    });

    it("should validate and correct malformed responses", async () => {
      // Mock API response with missing fields
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                // Missing id, name, description
                testType: "baseline",
                requests: [
                  {
                    method: "GET",
                    url: "/api/test",
                  },
                ],
                // Missing loadPattern and duration
              }),
            },
          },
        ],
        model: "gpt-3.5-turbo",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 150,
          total_tokens: 250,
        },
      };

      // Mock correction response
      const mockCorrectionResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                id: "test_corrected",
                name: "Load Test",
                description: "test input",
                testType: "baseline",
                requests: [
                  {
                    method: "GET",
                    url: "/api/test",
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
            },
          },
        ],
        model: "gpt-3.5-turbo",
        usage: {
          prompt_tokens: 120,
          completion_tokens: 180,
          total_tokens: 300,
        },
      };

      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCorrectionResponse),
        });

      const context: ParseContext = {
        originalInput: "test input",
        cleanedInput: "test input",
        extractedComponents: {
          methods: ["GET"],
          urls: ["/api/test"],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.6,
      };

      const result = await provider.parseWithContext(context);

      expect(result.spec.id).toBeDefined();
      expect(result.spec.name).toBeDefined();
      expect(result.spec.description).toBeDefined();
      expect(result.spec.loadPattern).toBeDefined();
      expect(result.spec.duration).toBeDefined();
    });

    it("should generate parsing explanations", async () => {
      const spec: LoadTestSpec = {
        id: "test_explanation",
        name: "Test Explanation",
        description: "GET /api/users with 50 users",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "/api/users",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 50,
        },
        duration: {
          value: 1,
          unit: "minutes",
        },
      };

      const context: ParseContext = {
        originalInput: "GET /api/users with 50 users",
        cleanedInput: "GET /api/users with 50 users",
        extractedComponents: {
          methods: ["GET"],
          urls: ["/api/users"],
          headers: [{}],
          bodies: [],
          counts: [50],
        },
        inferredFields: {
          testType: "baseline",
          duration: "1m",
          loadPattern: "constant",
        },
        ambiguities: [
          {
            field: "duration",
            possibleValues: ["1m", "30s", "5m"],
            reason: "Duration not explicitly specified",
          },
        ],
        confidence: 0.7,
      };

      const explanation = provider.explainParsing(spec, context);

      expect(explanation.extractedComponents).toContain("HTTP Method: GET");
      expect(explanation.extractedComponents).toContain("URL: /api/users");
      expect(explanation.ambiguityResolutions).toHaveLength(1);
      expect(explanation.assumptions).toBeDefined();
      expect(explanation.suggestions).toBeDefined();
    });

    it("should handle API errors gracefully", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () =>
          Promise.resolve({
            error: { message: "Invalid API key" },
          }),
      });

      const context: ParseContext = {
        originalInput: "test input",
        cleanedInput: "test input",
        extractedComponents: {
          methods: [],
          urls: [],
          headers: [{}],
          bodies: [],
          counts: [],
        },
        inferredFields: {
          testType: "baseline",
          duration: "30s",
          loadPattern: "constant",
        },
        ambiguities: [],
        confidence: 0.5,
      };

      await expect(provider.parseWithContext(context)).rejects.toThrow(
        "Smart parsing failed"
      );
    });
  });

  describe("Dynamic System Prompt", () => {
    it("should use enhanced system prompt when available", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                id: "test_dynamic",
                name: "Dynamic Test",
                description: "test",
                testType: "baseline",
                requests: [{ method: "GET", url: "/test" }],
                loadPattern: { type: "constant", virtualUsers: 1 },
                duration: { value: 30, unit: "seconds" },
              }),
            },
          },
        ],
        model: "gpt-3.5-turbo",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const request = {
        prompt: "test",
        format: "json" as const,
        systemPrompt: "Custom system prompt for testing",
        examples: [],
        clarifications: ["Test clarification"],
      };

      const response = await provider.generateCompletion(request);

      expect(response).toBeDefined();
      expect(response.response).toBeDefined();

      // Verify that fetch was called with the custom system prompt
      const fetchCall = (fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.messages[0].content).toBe(
        "Custom system prompt for testing"
      );
    });

    it("should fall back to default system prompt when not provided", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                id: "test_default",
                name: "Default Test",
                description: "test",
                testType: "baseline",
                requests: [{ method: "GET", url: "/test" }],
                loadPattern: { type: "constant", virtualUsers: 1 },
                duration: { value: 30, unit: "seconds" },
              }),
            },
          },
        ],
        model: "gpt-3.5-turbo",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const request = {
        prompt: "test",
        format: "json" as const,
      };

      const response = await provider.generateCompletion(request);

      expect(response).toBeDefined();

      // Verify that fetch was called with the default system prompt
      const fetchCall = (fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.messages[0].content).toContain(
        "StressMaster's AI assistant"
      );
    });
  });

  describe("Preprocessing Integration", () => {
    it("should extract structured data from input", async () => {
      const input = `
        POST https://api.example.com/users
        Content-Type: application/json
        Authorization: Bearer token123
        
        {"name": "test", "email": "test@example.com"}
        
        Run with 100 concurrent users for 5 minutes
      `;

      // Mock successful API response
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                id: "test_preprocessing",
                name: "Users API Test",
                description: input.trim(),
                testType: "baseline",
                requests: [
                  {
                    method: "POST",
                    url: "https://api.example.com/users",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: "Bearer token123",
                    },
                    payload: {
                      template: '{"name": "{{name}}", "email": "{{email}}"}',
                      variables: [
                        { name: "name", type: "random_string", parameters: {} },
                        { name: "email", type: "random_email", parameters: {} },
                      ],
                    },
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
              }),
            },
          },
        ],
        model: "gpt-3.5-turbo",
        usage: {
          prompt_tokens: 200,
          completion_tokens: 300,
          total_tokens: 500,
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const spec = await provider.parseCommand(input);

      expect(spec.requests[0].method).toBe("POST");
      expect(spec.requests[0].url).toBe("https://api.example.com/users");
      expect(spec.requests[0].headers?.["Content-Type"]).toBe(
        "application/json"
      );
      expect(spec.requests[0].headers?.Authorization).toBe("Bearer token123");
      expect(spec.loadPattern.virtualUsers).toBe(100);
      expect(spec.duration.value).toBe(5);
      expect(spec.duration.unit).toBe("minutes");
    });

    it("should handle curl commands", async () => {
      const curlInput = `curl -X POST https://api.example.com/orders \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer token123" \\
        -d '{"productId": 123, "quantity": 2}'`;

      // Mock successful API response
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                id: "test_curl",
                name: "Orders API Test",
                description: curlInput,
                testType: "baseline",
                requests: [
                  {
                    method: "POST",
                    url: "https://api.example.com/orders",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: "Bearer token123",
                    },
                    payload: {
                      template:
                        '{"productId": {{productId}}, "quantity": {{quantity}}}',
                      variables: [
                        {
                          name: "productId",
                          type: "random_number",
                          parameters: { min: 1, max: 1000 },
                        },
                        {
                          name: "quantity",
                          type: "random_number",
                          parameters: { min: 1, max: 10 },
                        },
                      ],
                    },
                  },
                ],
                loadPattern: {
                  type: "constant",
                  virtualUsers: 10,
                },
                duration: {
                  value: 1,
                  unit: "minutes",
                },
              }),
            },
          },
        ],
        model: "gpt-3.5-turbo",
        usage: {
          prompt_tokens: 180,
          completion_tokens: 280,
          total_tokens: 460,
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const spec = await provider.parseCommand(curlInput);

      expect(spec.requests[0].method).toBe("POST");
      expect(spec.requests[0].url).toBe("https://api.example.com/orders");
      expect(spec.requests[0].headers?.["Content-Type"]).toBe(
        "application/json"
      );
      expect(spec.requests[0].headers?.Authorization).toBe("Bearer token123");
    });
  });
});

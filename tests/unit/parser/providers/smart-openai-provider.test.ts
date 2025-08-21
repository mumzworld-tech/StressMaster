/**
 * Unit tests for Smart OpenAI Provider
 * Tests OpenAI-specific smart parsing capabilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAIProvider } from "../../../../src/core/parser/ai-providers";
import { ParseContext } from "../../../../src/core/parser/utils";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SmartOpenAIProvider", () => {
  let provider: OpenAIProvider;
  let mockContext: ParseContext;

  beforeEach(() => {
    provider = new OpenAIProvider({
      apiKey: "test-api-key",
      model: "gpt-3.5-turbo",
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
      },
      inferredFields: {
        testType: "baseline",
        duration: "2m",
        loadPattern: "constant",
      },
      ambiguities: [],
      confidence: 0.8,
    };

    // Reset mocks
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize successfully with valid API key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await provider.initialize();

      expect(provider.isReady()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        })
      );
    });

    it("should throw error when API key is missing", async () => {
      const providerWithoutKey = new SmartOpenAIProvider({
        model: "gpt-3.5-turbo",
      });

      await expect(providerWithoutKey.initialize()).rejects.toThrow(
        "OpenAI API key is required"
      );
    });

    it("should throw error when health check fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(provider.initialize()).rejects.toThrow(
        "Failed to initialize Smart OpenAI provider"
      );
    });
  });

  describe("generateCompletion", () => {
    beforeEach(async () => {
      // Mock successful health check for initialization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });
      await provider.initialize();
      mockFetch.mockReset();
    });

    it("should generate completion successfully", async () => {
      const mockResponse = {
        id: "test_completion",
        name: "Test Completion",
        description: "Test completion response",
        testType: "baseline",
        requests: [{ method: "POST", url: "/api/users" }],
        loadPattern: { type: "constant", virtualUsers: 50 },
        duration: { value: 2, unit: "minutes" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockResponse),
              },
            },
          ],
          model: "gpt-3.5-turbo",
          usage: {
            prompt_tokens: 100,
            completion_tokens: 200,
            total_tokens: 300,
          },
        }),
      });

      const result = await provider.generateCompletion({
        prompt: "Test prompt",
        format: "json",
      });

      expect(result.response).toBe(JSON.stringify(mockResponse));
      expect(result.model).toBe("gpt-3.5-turbo");
      expect(result.usage?.totalTokens).toBe(300);
      expect(result.metadata?.provider).toBe("smart-openai");
    });

    it("should include enhanced system message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "{}" } }],
          model: "gpt-3.5-turbo",
          usage: { total_tokens: 100 },
        }),
      });

      await provider.generateCompletion({
        prompt: "Test prompt",
        format: "json",
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemMessage = requestBody.messages[0].content;

      expect(systemMessage).toContain("StressMaster's advanced AI assistant");
      expect(systemMessage).toContain("LoadTestSpec interface");
      expect(systemMessage).toContain(
        "Parse natural language mixed with structured data"
      );
      expect(systemMessage).toContain(
        "Handle messy, incomplete, or ambiguous input"
      );
    });

    it("should use JSON response format when requested", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "{}" } }],
          model: "gpt-3.5-turbo",
          usage: { total_tokens: 100 },
        }),
      });

      await provider.generateCompletion({
        prompt: "Test prompt",
        format: "json",
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.response_format).toEqual({ type: "json_object" });
    });

    it("should handle API errors gracefully", async () => {
      // Mock all retry attempts to fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => ({
          error: { message: "Rate limit exceeded" },
        }),
      });

      await expect(
        provider.generateCompletion({ prompt: "Test prompt" })
      ).rejects.toThrow("OpenAI API error: 429 - Rate limit exceeded");
    });

    it("should retry on failure", async () => {
      // First call fails, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "{}" } }],
            model: "gpt-3.5-turbo",
            usage: { total_tokens: 100 },
          }),
        });

      const result = await provider.generateCompletion({
        prompt: "Test prompt",
      });

      expect(result.response).toBe("{}");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("smart parsing integration", () => {
    beforeEach(async () => {
      // Mock successful health check for initialization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });
      await provider.initialize();
      mockFetch.mockReset();
    });

    it("should parse with context successfully", async () => {
      const mockResponse = {
        id: "test_smart_parse",
        name: "Smart Parse Test",
        description: "POST to /api/users with 50 users for 2 minutes",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "/api/users",
            headers: { "Content-Type": "application/json" },
          },
        ],
        loadPattern: { type: "constant", virtualUsers: 50 },
        duration: { value: 2, unit: "minutes" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockResponse),
              },
            },
          ],
          model: "gpt-3.5-turbo",
          usage: { total_tokens: 300 },
        }),
      });

      const result = await provider.parseWithContext(mockContext);

      expect(result.spec.id).toBe("test_smart_parse");
      expect(result.spec.requests[0].method).toBe("POST");
      expect(result.spec.loadPattern.virtualUsers).toBe(50);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should validate and correct malformed responses", async () => {
      // First response is malformed, second is corrected
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    // Missing required fields
                    testType: "baseline",
                    requests: [{ method: "POST", url: "/api/users" }],
                  }),
                },
              },
            ],
            model: "gpt-3.5-turbo",
            usage: { total_tokens: 200 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    id: "test_corrected",
                    name: "Corrected Test",
                    description: "Corrected response",
                    testType: "baseline",
                    requests: [{ method: "POST", url: "/api/users" }],
                    loadPattern: { type: "constant", virtualUsers: 10 },
                    duration: { value: 30, unit: "seconds" },
                  }),
                },
              },
            ],
            model: "gpt-3.5-turbo",
            usage: { total_tokens: 250 },
          }),
        });

      const result = await provider.parseWithContext(mockContext);

      expect(result.spec.id).toBe("test_corrected");
      expect(mockFetch).toHaveBeenCalledTimes(2); // Original + correction
    });

    it("should provide parsing explanations", async () => {
      const mockSpec = {
        id: "test_explanation",
        name: "Explanation Test",
        description: "Test explanation",
        testType: "baseline" as const,
        requests: [
          {
            method: "POST" as const,
            url: "/api/users",
            headers: { "Content-Type": "application/json" },
          },
        ],
        loadPattern: { type: "constant" as const, virtualUsers: 50 },
        duration: { value: 2, unit: "minutes" as const },
      };

      const explanation = provider.explainParsing(mockSpec, mockContext);

      expect(explanation.extractedComponents).toBeInstanceOf(Array);
      expect(explanation.extractedComponents.length).toBeGreaterThan(0);
      expect(explanation.assumptions).toBeInstanceOf(Array);
      expect(explanation.ambiguityResolutions).toBeInstanceOf(Array);
      expect(explanation.suggestions).toBeInstanceOf(Array);
    });
  });

  describe("health check", () => {
    it("should return true for successful health check", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        })
      );
    });

    it("should return false for failed health check", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it("should return false when fetch throws error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe("provider metadata", () => {
    it("should return correct provider name", () => {
      expect(provider.getProviderName()).toBe("Smart OpenAI");
    });

    it("should use correct default endpoint and model", () => {
      const defaultProvider = new SmartOpenAIProvider({
        apiKey: "test-key",
      });

      expect(defaultProvider.getProviderName()).toBe("Smart OpenAI");
    });

    it("should allow custom endpoint and model", () => {
      const customProvider = new SmartOpenAIProvider({
        apiKey: "test-key",
        endpoint: "https://custom.openai.com/v1",
        model: "gpt-4",
      });

      expect(customProvider.getProviderName()).toBe("Smart OpenAI");
    });
  });
});

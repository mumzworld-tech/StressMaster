import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { OllamaClient, ParserConfig } from "../../../src/core/parser";

// Mock axios
vi.mock("axios", () => ({
  default: {
    create: vi.fn(),
  },
}));
const mockedAxios = vi.mocked(axios);

describe("OllamaClient", () => {
  let config: ParserConfig;
  let mockAxiosInstance: any;

  beforeEach(() => {
    config = {
      ollamaEndpoint: "http://localhost:11434",
      modelName: "llama3",
      maxRetries: 3,
      timeout: 30000,
    };

    // Mock axios instance
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create client with default pool config", () => {
      const client = new OllamaClient(config);
      expect(client).toBeInstanceOf(OllamaClient);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: config.ollamaEndpoint,
        timeout: 120000,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should create client with custom pool config", () => {
      const customPoolConfig = {
        maxConnections: 10,
        requestTimeout: 60000,
      };

      const customClient = new OllamaClient(config, customPoolConfig);
      expect(customClient).toBeInstanceOf(OllamaClient);
    });
  });

  describe("generateCompletion", () => {
    it("should generate completion successfully", async () => {
      const mockResponse = {
        data: {
          model: "llama3",
          created_at: "2024-01-01T00:00:00Z",
          response: '{"test": "response"}',
          done: true,
        },
      };

      // Mock health check to return healthy
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const client = new OllamaClient(config);

      // Mock the healthCheck method directly
      vi.spyOn(client, "healthCheck").mockResolvedValue(true);

      const request = {
        model: "llama3",
        prompt: "test prompt",
        format: "json" as const,
      };

      const result = await client.generateCompletion(request);

      expect(result).toEqual(mockResponse.data);
    });

    it("should handle request errors with retry", async () => {
      // Create a simple test that verifies the client can handle errors
      mockAxiosInstance.post.mockRejectedValue(new Error("Network error"));

      const client = new OllamaClient(config);

      const request = {
        model: "llama3",
        prompt: "test prompt",
      };

      // Expect the error to be thrown after retries
      await expect(client.generateCompletion(request)).rejects.toThrow();
    });
  });

  describe("checkModelAvailability", () => {
    it("should return true when model is available", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          models: [{ name: "llama3" }, { name: "other-model" }],
        },
      });

      const client = new OllamaClient(config);
      const result = await client.checkModelAvailability("llama3");
      expect(result).toBe(true);
    });

    it("should return false when model is not available", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          models: [{ name: "other-model" }],
        },
      });

      const client = new OllamaClient(config);
      const result = await client.checkModelAvailability("llama3");
      expect(result).toBe(false);
    });

    it("should return false on API error", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("API error"));

      const client = new OllamaClient(config);
      const result = await client.checkModelAvailability("llama3");
      expect(result).toBe(false);
    });
  });

  describe("healthCheck", () => {
    it("should return true when service is healthy", async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });

      const client = new OllamaClient(config);
      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it("should return false when service is unhealthy", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Service down"));

      const client = new OllamaClient(config);
      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe("connection pooling", () => {
    it("should track active connections", () => {
      const client = new OllamaClient(config);
      expect(client.getActiveConnections()).toBe(0);
      expect(client.getQueueLength()).toBe(0);
    });
  });
});

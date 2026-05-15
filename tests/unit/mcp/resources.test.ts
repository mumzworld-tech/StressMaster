import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerResources } from "../../../src/mcp/resources.js";
import type {
  ServiceContext,
  TestHistoryEntry,
  Template,
  StressMasterConfig,
  LoadTestSpec,
} from "../../../src/mcp/types.js";

describe("MCP Resource Registration", () => {
  // Mock server with resource method
  let mockServer: any;

  // Mock test history entry
  const mockHistoryEntry: TestHistoryEntry = {
    id: "test-1",
    command: "send 100 GET requests to http://example.com",
    timestamp: new Date("2024-01-01T10:00:00Z"),
    spec: {
      id: "test-1",
      name: "Test",
      description: "Test desc",
      testType: "baseline",
      requests: [
        {
          url: "http://example.com",
          method: "GET",
          headers: {},
          queryParams: {},
        },
      ],
      loadPattern: {
        type: "constant",
        virtualUsers: 10,
        duration: { value: 30, unit: "seconds" },
      },
    },
    status: "completed",
    executionTimeMs: 30000,
  };

  // Mock template
  const mockTemplate: Template = {
    name: "test-template",
    spec: {
      id: "test-1",
      name: "Test Template",
      description: "Template for testing",
      testType: "baseline",
      requests: [
        {
          url: "http://example.com",
          method: "GET",
          headers: {},
          queryParams: {},
        },
      ],
      loadPattern: {
        type: "constant",
        virtualUsers: 10,
        duration: { value: 30, unit: "seconds" },
      },
    },
    description: "Test template description",
    createdAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-01T10:00:00Z"),
  };

  // Mock config
  const mockConfig: StressMasterConfig = {
    aiProvider: "openai",
    defaultDuration: 30,
    defaultVirtualUsers: 10,
    cacheEnabled: true,
    verbose: false,
    outputFormat: "json",
  };

  // Mock ServiceContext
  let mockCtx: ServiceContext;

  beforeEach(() => {
    // Reset mock server
    mockServer = {
      resource: vi.fn(),
    };

    // Reset mock context
    mockCtx = {
      parser: {
        parseCommand: vi.fn().mockResolvedValue({}),
        initialize: vi.fn().mockResolvedValue(undefined),
      },
      generator: {
        generateScript: vi.fn().mockReturnValue({ content: "", filename: "" }),
      },
      executor: {
        executeLoadTest: vi.fn().mockResolvedValue({}),
      },
      analyzer: {
        analyzeResults: vi.fn().mockResolvedValue({}),
      },
      config: {
        getConfig: vi.fn().mockResolvedValue(mockConfig),
        setConfig: vi.fn().mockResolvedValue(undefined),
        initConfig: vi.fn().mockResolvedValue(undefined),
      },
      templates: {
        listTemplates: vi.fn().mockResolvedValue([mockTemplate]),
        createTemplate: vi.fn().mockResolvedValue(mockTemplate),
        loadTemplate: vi.fn().mockResolvedValue(mockTemplate),
        deleteTemplate: vi.fn().mockResolvedValue(undefined),
        exportTemplate: vi.fn().mockResolvedValue(mockTemplate),
      },
      history: {
        getEntries: vi.fn().mockReturnValue([mockHistoryEntry]),
        getEntry: vi.fn().mockReturnValue(mockHistoryEntry),
        addEntry: vi.fn(),
      },
    };
  });

  describe("registerResources", () => {
    it("should register all 5 resources", () => {
      registerResources(mockServer, mockCtx);

      expect(mockServer.resource).toHaveBeenCalledTimes(5);
    });

    it("should register resources with correct names", () => {
      registerResources(mockServer, mockCtx);

      const registeredNames = mockServer.resource.mock.calls.map(
        (call: any) => call[0]
      );

      expect(registeredNames).toContain("test-history");
      expect(registeredNames).toContain("test-result");
      expect(registeredNames).toContain("templates");
      expect(registeredNames).toContain("template");
      expect(registeredNames).toContain("config");
    });

    it("should register resources with correct URIs", () => {
      registerResources(mockServer, mockCtx);

      const calls = mockServer.resource.mock.calls;

      // Find test-history call
      const historyCall = calls.find((call: any) => call[0] === "test-history");
      expect(historyCall[1]).toBe("stressmaster://test-history");

      // Find templates call
      const templatesCall = calls.find((call: any) => call[0] === "templates");
      expect(templatesCall[1]).toBe("stressmaster://templates");

      // Find config call
      const configCall = calls.find((call: any) => call[0] === "config");
      expect(configCall[1]).toBe("stressmaster://config");
    });
  });

  describe("test-history resource", () => {
    it("should return test history entries", async () => {
      registerResources(mockServer, mockCtx);

      const historyCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "test-history"
      );
      const handler = historyCall[2];

      const result = await handler(new URL("stressmaster://test-history"));

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("application/json");
      expect(result.contents[0].uri).toBe("stressmaster://test-history");

      const data = JSON.parse(result.contents[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(mockHistoryEntry.id);
      expect(data[0].command).toBe(mockHistoryEntry.command);
    });

    it("should handle errors gracefully", async () => {
      mockCtx.history.getEntries = vi.fn().mockImplementation(() => {
        throw new Error("Database error");
      });

      registerResources(mockServer, mockCtx);

      const historyCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "test-history"
      );
      const handler = historyCall[2];

      const result = await handler(new URL("stressmaster://test-history"));

      expect(result.contents[0].mimeType).toBe("text/plain");
      expect(result.contents[0].text).toContain("Failed to retrieve test history");
      expect(result.contents[0].text).toContain("Database error");
    });
  });

  describe("test-result resource", () => {
    it("should return specific test result", async () => {
      registerResources(mockServer, mockCtx);

      const resultCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "test-result"
      );
      const handler = resultCall[2];

      const result = await handler(
        new URL("stressmaster://test-result/test-1"),
        { id: "test-1" }
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("application/json");

      const data = JSON.parse(result.contents[0].text);
      expect(data.id).toBe("test-1");
    });

    it("should return error for non-existent test result", async () => {
      mockCtx.history.getEntry = vi.fn().mockReturnValue(undefined);

      registerResources(mockServer, mockCtx);

      const resultCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "test-result"
      );
      const handler = resultCall[2];

      const result = await handler(
        new URL("stressmaster://test-result/non-existent"),
        { id: "non-existent" }
      );

      expect(result.contents[0].mimeType).toBe("text/plain");
      expect(result.contents[0].text).toContain("Test result not found");
      expect(result.contents[0].text).toContain("non-existent");
    });

    it("should handle errors gracefully", async () => {
      mockCtx.history.getEntry = vi.fn().mockImplementation(() => {
        throw new Error("Lookup error");
      });

      registerResources(mockServer, mockCtx);

      const resultCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "test-result"
      );
      const handler = resultCall[2];

      const result = await handler(
        new URL("stressmaster://test-result/test-1"),
        { id: "test-1" }
      );

      expect(result.contents[0].mimeType).toBe("text/plain");
      expect(result.contents[0].text).toContain("Failed to retrieve test result");
      expect(result.contents[0].text).toContain("Lookup error");
    });
  });

  describe("templates resource", () => {
    it("should return all templates", async () => {
      registerResources(mockServer, mockCtx);

      const templatesCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "templates"
      );
      const handler = templatesCall[2];

      const result = await handler(new URL("stressmaster://templates"));

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("application/json");

      const data = JSON.parse(result.contents[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe(mockTemplate.name);
      expect(data[0].description).toBe(mockTemplate.description);
    });

    it("should handle errors gracefully", async () => {
      mockCtx.templates.listTemplates = vi
        .fn()
        .mockRejectedValue(new Error("File system error"));

      registerResources(mockServer, mockCtx);

      const templatesCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "templates"
      );
      const handler = templatesCall[2];

      const result = await handler(new URL("stressmaster://templates"));

      expect(result.contents[0].mimeType).toBe("text/plain");
      expect(result.contents[0].text).toContain("Failed to retrieve templates");
      expect(result.contents[0].text).toContain("File system error");
    });
  });

  describe("template resource", () => {
    it("should return specific template", async () => {
      registerResources(mockServer, mockCtx);

      const templateCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "template"
      );
      const handler = templateCall[2];

      const result = await handler(
        new URL("stressmaster://template/test-template"),
        { name: "test-template" }
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("application/json");

      const data = JSON.parse(result.contents[0].text);
      expect(data.name).toBe("test-template");
    });

    it("should return error for non-existent template", async () => {
      mockCtx.templates.loadTemplate = vi.fn().mockResolvedValue(null);

      registerResources(mockServer, mockCtx);

      const templateCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "template"
      );
      const handler = templateCall[2];

      const result = await handler(
        new URL("stressmaster://template/non-existent"),
        { name: "non-existent" }
      );

      expect(result.contents[0].mimeType).toBe("text/plain");
      expect(result.contents[0].text).toContain("Template not found");
      expect(result.contents[0].text).toContain("non-existent");
    });

    it("should handle errors gracefully", async () => {
      mockCtx.templates.loadTemplate = vi
        .fn()
        .mockRejectedValue(new Error("Load error"));

      registerResources(mockServer, mockCtx);

      const templateCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "template"
      );
      const handler = templateCall[2];

      const result = await handler(
        new URL("stressmaster://template/test-template"),
        { name: "test-template" }
      );

      expect(result.contents[0].mimeType).toBe("text/plain");
      expect(result.contents[0].text).toContain("Failed to load template");
      expect(result.contents[0].text).toContain("Load error");
    });
  });

  describe("config resource", () => {
    it("should return configuration", async () => {
      registerResources(mockServer, mockCtx);

      const configCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "config"
      );
      const handler = configCall[2];

      const result = await handler(new URL("stressmaster://config"));

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("application/json");

      const data = JSON.parse(result.contents[0].text);
      expect(data.aiProvider).toBe(mockConfig.aiProvider);
      expect(data.outputFormat).toBe(mockConfig.outputFormat);
    });

    it("should handle errors gracefully", async () => {
      mockCtx.config.getConfig = vi
        .fn()
        .mockRejectedValue(new Error("Config not initialized"));

      registerResources(mockServer, mockCtx);

      const configCall = mockServer.resource.mock.calls.find(
        (call: any) => call[0] === "config"
      );
      const handler = configCall[2];

      const result = await handler(new URL("stressmaster://config"));

      expect(result.contents[0].mimeType).toBe("text/plain");
      expect(result.contents[0].text).toContain("Failed to retrieve config");
      expect(result.contents[0].text).toContain("Config not initialized");
    });
  });
});

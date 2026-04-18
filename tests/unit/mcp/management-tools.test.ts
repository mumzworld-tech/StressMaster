import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getConfig,
  setConfig,
  listTemplates,
  manageTemplate,
} from "../../../src/mcp/tools/management-tools.js";
import type {
  ServiceContext,
  StressMasterConfig,
  Template,
  LoadTestSpec,
} from "../../../src/mcp/types.js";

describe("Management Tool Handlers", () => {
  // Mock config
  const mockConfig: StressMasterConfig = {
    aiProvider: "openai",
    aiApiKey: "test-key",
    aiModel: "gpt-3.5-turbo",
    defaultTestType: "baseline",
    outputFormat: "json",
  };

  // Mock LoadTestSpec
  const mockSpec: LoadTestSpec = {
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
  };

  // Mock template
  const mockTemplate: Template = {
    name: "test-template",
    spec: mockSpec,
    description: "Test template description",
    createdAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-01T10:00:00Z"),
  };

  // Mock ServiceContext
  let mockCtx: ServiceContext;

  beforeEach(() => {
    mockCtx = {
      parser: {
        parseCommand: vi.fn().mockResolvedValue(mockSpec),
        initialize: vi.fn().mockResolvedValue(undefined),
      },
      generator: {
        generateScript: vi.fn().mockReturnValue({
          content: "// K6 script",
          filename: "test.js",
        }),
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
        getEntries: vi.fn().mockReturnValue([]),
        getEntry: vi.fn().mockReturnValue(undefined),
        addEntry: vi.fn(),
      },
    };
  });

  describe("getConfig", () => {
    it("should return full config when no key specified", async () => {
      const result = await getConfig({}, mockCtx);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockConfig);
      }
      expect(mockCtx.config.getConfig).toHaveBeenCalled();
    });

    it("should return specific config value when key specified", async () => {
      const result = await getConfig({ key: "aiProvider" }, mockCtx);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("openai");
      }
    });

    it("should return error for non-existent key", async () => {
      const result = await getConfig({ key: "nonExistentKey" }, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Configuration key not found");
        expect(result.code).toBe("CONFIG_KEY_NOT_FOUND");
      }
    });

    it("should handle config errors gracefully", async () => {
      mockCtx.config.getConfig = vi
        .fn()
        .mockRejectedValue(new Error("Config load failed"));

      const result = await getConfig({}, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Config load failed");
        expect(result.code).toBe("CONFIG_GET_ERROR");
      }
    });
  });

  describe("setConfig", () => {
    it("should successfully set config value and return previous value", async () => {
      const result = await setConfig(
        { key: "aiProvider", value: "claude" },
        mockCtx
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.key).toBe("aiProvider");
        expect(result.data.value).toBe("claude");
        expect(result.data.previousValue).toBe("openai");
      }
      expect(mockCtx.config.getConfig).toHaveBeenCalled();
      expect(mockCtx.config.setConfig).toHaveBeenCalledWith("aiProvider", "claude");
    });

    it("should handle new config keys without previous value", async () => {
      const result = await setConfig(
        { key: "newKey", value: "newValue" },
        mockCtx
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.key).toBe("newKey");
        expect(result.data.value).toBe("newValue");
        expect(result.data.previousValue).toBeUndefined();
      }
    });

    it("should return error for empty key", async () => {
      mockCtx.config.setConfig = vi
        .fn()
        .mockRejectedValue(new Error("Key cannot be empty"));

      const result = await setConfig({ key: "", value: "" }, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("CONFIG_SET_ERROR");
      }
    });

    it("should handle config set errors gracefully", async () => {
      mockCtx.config.setConfig = vi
        .fn()
        .mockRejectedValue(new Error("Failed to save config"));

      const result = await setConfig({ key: "test", value: "value" }, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to save config");
        expect(result.code).toBe("CONFIG_SET_ERROR");
      }
    });
  });

  describe("listTemplates", () => {
    it("should successfully list templates", async () => {
      const result = await listTemplates({}, mockCtx);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([mockTemplate]);
      }
      expect(mockCtx.templates.listTemplates).toHaveBeenCalled();
    });

    it("should return empty array when no templates exist", async () => {
      mockCtx.templates.listTemplates = vi.fn().mockResolvedValue([]);

      const result = await listTemplates({}, mockCtx);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("should handle list errors gracefully", async () => {
      mockCtx.templates.listTemplates = vi
        .fn()
        .mockRejectedValue(new Error("Failed to list templates"));

      const result = await listTemplates({}, mockCtx);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to list templates");
        expect(result.code).toBe("TEMPLATE_LIST_ERROR");
      }
    });
  });

  describe("manageTemplate", () => {
    describe("create action", () => {
      it("should successfully create template", async () => {
        const result = await manageTemplate(
          {
            action: "create",
            name: "test-template",
            spec: mockSpec,
            description: "Test description",
          },
          mockCtx
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.action).toBe("create");
          expect(result.data.name).toBe("test-template");
          expect(result.data.template).toEqual(mockTemplate);
          expect(result.data.message).toContain("created successfully");
        }
        expect(mockCtx.templates.createTemplate).toHaveBeenCalledWith(
          "test-template",
          mockSpec,
          "Test description"
        );
      });

      it("should return error when spec not provided for create", async () => {
        const result = await manageTemplate(
          {
            action: "create",
            name: "test-template",
          },
          mockCtx
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("LoadTestSpec is required for create action");
          expect(result.code).toBe("MISSING_SPEC");
        }
      });
    });

    describe("load action", () => {
      it("should successfully load template", async () => {
        const result = await manageTemplate(
          {
            action: "load",
            name: "test-template",
          },
          mockCtx
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.action).toBe("load");
          expect(result.data.name).toBe("test-template");
          expect(result.data.template).toEqual(mockTemplate);
          expect(result.data.message).toContain("loaded successfully");
        }
        expect(mockCtx.templates.loadTemplate).toHaveBeenCalledWith("test-template");
      });
    });

    describe("delete action", () => {
      it("should successfully delete template", async () => {
        const result = await manageTemplate(
          {
            action: "delete",
            name: "test-template",
          },
          mockCtx
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.action).toBe("delete");
          expect(result.data.name).toBe("test-template");
          expect(result.data.message).toContain("deleted successfully");
        }
        expect(mockCtx.templates.deleteTemplate).toHaveBeenCalledWith("test-template");
      });
    });

    describe("export action", () => {
      it("should successfully export template", async () => {
        const result = await manageTemplate(
          {
            action: "export",
            name: "test-template",
          },
          mockCtx
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.action).toBe("export");
          expect(result.data.name).toBe("test-template");
          expect(result.data.template).toEqual(mockTemplate);
          expect(result.data.message).toContain("exported successfully");
        }
        expect(mockCtx.templates.exportTemplate).toHaveBeenCalledWith("test-template");
      });
    });

    describe("invalid action", () => {
      it("should return error for invalid action", async () => {
        const result = await manageTemplate(
          {
            action: "invalid" as any,
            name: "test-template",
          },
          mockCtx
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("Invalid action");
          expect(result.code).toBe("INVALID_ACTION");
        }
      });
    });

    it("should handle template operation errors gracefully", async () => {
      mockCtx.templates.loadTemplate = vi
        .fn()
        .mockRejectedValue(new Error("Template not found"));

      const result = await manageTemplate(
        {
          action: "load",
          name: "non-existent",
        },
        mockCtx
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Template not found");
        expect(result.code).toBe("TEMPLATE_OPERATION_ERROR");
      }
    });
  });
});

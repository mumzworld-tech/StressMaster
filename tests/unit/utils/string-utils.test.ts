import { describe, it, expect } from "vitest";
import {
  sanitizeInput,
  normalizeWhitespace,
  cleanJsonResponse,
  attemptJsonFix,
  extractTemplateVariables,
  generateTestName,
  toKebabCase,
  toCamelCase,
} from "../../../src/utils/string-utils";

describe("String Utils", () => {
  describe("sanitizeInput", () => {
    it("should remove control characters", () => {
      const input = "test\x00\x01string";
      const result = sanitizeInput(input);
      expect(result).toBe("test string");
    });

    it("should normalize line endings", () => {
      const input = "line1\r\nline2\rline3\nline4";
      const result = sanitizeInput(input);
      expect(result).toBe("line1\nline2\nline3\nline4");
    });

    it("should handle empty input", () => {
      expect(sanitizeInput("")).toBe("");
      expect(sanitizeInput(null as any)).toBe("");
      expect(sanitizeInput(undefined as any)).toBe("");
    });
  });

  describe("normalizeWhitespace", () => {
    it("should replace multiple spaces with single space", () => {
      const input = "test    multiple   spaces";
      const result = normalizeWhitespace(input);
      expect(result).toBe("test multiple spaces");
    });

    it("should clean up line breaks", () => {
      const input = "line1  \n  line2";
      const result = normalizeWhitespace(input);
      expect(result).toBe("line1\nline2");
    });
  });

  describe("cleanJsonResponse", () => {
    it("should remove markdown code blocks", () => {
      const input = '```json\n{"test": "value"}\n```';
      const result = cleanJsonResponse(input);
      expect(result).toBe('{"test": "value"}');
    });

    it("should extract JSON from mixed content", () => {
      const input = 'Here is the JSON: {"test": "value"} and some more text';
      const result = cleanJsonResponse(input);
      expect(result).toBe('{"test": "value"}');
    });
  });

  describe("attemptJsonFix", () => {
    it("should fix single quotes", () => {
      const input = "{'test': 'value'}";
      const result = attemptJsonFix(input);
      expect(result).toBe('{"test": "value"}');
    });

    it("should return null for unfixable JSON", () => {
      const input = "{test: value";
      const result = attemptJsonFix(input);
      expect(result).toBeNull();
    });
  });

  describe("extractTemplateVariables", () => {
    it("should extract variables from template", () => {
      const template = "Hello {{name}}, your age is {{age}}";
      const result = extractTemplateVariables(template);
      expect(result).toEqual(["name", "age"]);
    });

    it("should handle no variables", () => {
      const template = "Hello world";
      const result = extractTemplateVariables(template);
      expect(result).toEqual([]);
    });
  });

  describe("generateTestName", () => {
    it("should generate name from input", () => {
      const input = "Test the user API endpoint";
      const result = generateTestName(input);
      expect(result).toBe("test-the-user-api");
    });

    it("should handle empty input", () => {
      const result = generateTestName("");
      expect(result).toBe("load-test");
    });
  });

  describe("toKebabCase", () => {
    it("should convert camelCase to kebab-case", () => {
      expect(toKebabCase("camelCase")).toBe("camel-case");
      expect(toKebabCase("PascalCase")).toBe("pascal-case");
    });
  });

  describe("toCamelCase", () => {
    it("should convert kebab-case to camelCase", () => {
      expect(toCamelCase("kebab-case")).toBe("kebabCase");
      expect(toCamelCase("snake_case")).toBe("snakeCase");
    });
  });
});

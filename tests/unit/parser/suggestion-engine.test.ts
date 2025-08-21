import { describe, it, expect } from "vitest";
import {
  SuggestionEngine,
  SuggestionContext,
} from "../../../src/core/parser/utils";
import { LoadTestSpec } from "../../../src/types";

describe("SuggestionEngine", () => {
  const createSuggestionContext = (
    overrides: Partial<SuggestionContext> = {}
  ): SuggestionContext => ({
    originalInput: "test the API",
    parsedSpec: undefined,
    validationIssues: [],
    confidence: 0.5,
    ambiguities: [],
    ...overrides,
  });

  describe("generateSuggestions", () => {
    it("should generate completion suggestions for missing URL", () => {
      const incompleteSpec: LoadTestSpec = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "/api/endpoint", // Generic placeholder
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: { value: 1, unit: "minutes" },
      };

      const context = createSuggestionContext({
        parsedSpec: incompleteSpec,
        originalInput: "test the API",
      });

      const suggestions = SuggestionEngine.generateSuggestions(context);

      // Debug: log the actual suggestions
      console.log(
        "Generated suggestions:",
        suggestions.map((s) => ({ type: s.type, message: s.message }))
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.type === "completion")).toBe(true);
    });

    it("should generate clarification suggestions for low confidence", () => {
      const context = createSuggestionContext({
        confidence: 0.3,
        originalInput: "do something with the API",
      });

      const suggestions = SuggestionEngine.generateSuggestions(context);

      expect(suggestions.some((s) => s.type === "clarification")).toBe(true);
      expect(suggestions.some((s) => s.message.includes("more specific"))).toBe(
        true
      );
    });

    it("should generate suggestions for missing load parameters", () => {
      const incompleteSpec: LoadTestSpec = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/users",
          },
        ],
        loadPattern: {
          type: "constant",
          // Missing virtualUsers and requestsPerSecond
        },
        duration: { value: 1, unit: "minutes" },
      };

      const context = createSuggestionContext({
        parsedSpec: incompleteSpec,
        originalInput: "GET https://api.example.com/users",
      });

      const suggestions = SuggestionEngine.generateSuggestions(context);

      expect(
        suggestions.some((s) => s.message.includes("load parameters"))
      ).toBe(true);
    });

    it("should generate suggestions for POST requests without payload", () => {
      const specWithoutPayload: LoadTestSpec = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "POST",
            url: "https://api.example.com/users",
            // Missing payload
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 10,
        },
        duration: { value: 1, unit: "minutes" },
      };

      const context = createSuggestionContext({
        parsedSpec: specWithoutPayload,
        originalInput: "POST to https://api.example.com/users",
      });

      const suggestions = SuggestionEngine.generateSuggestions(context);

      expect(suggestions.some((s) => s.message.includes("payload"))).toBe(true);
    });

    it("should generate alternative suggestions for high load", () => {
      const highLoadSpec: LoadTestSpec = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "https://api.example.com/users",
          },
        ],
        loadPattern: {
          type: "constant",
          virtualUsers: 5000, // Very high
        },
        duration: { value: 1, unit: "minutes" },
      };

      const context = createSuggestionContext({
        parsedSpec: highLoadSpec,
        originalInput: "test with 5000 users",
      });

      const suggestions = SuggestionEngine.generateSuggestions(context);

      expect(suggestions.some((s) => s.type === "alternative")).toBe(true);
      expect(suggestions.some((s) => s.message.includes("fewer users"))).toBe(
        true
      );
    });

    it("should prioritize suggestions correctly", () => {
      const context = createSuggestionContext({
        confidence: 0.2,
        ambiguities: ["URL is unclear"],
        originalInput: "test something",
      });

      const suggestions = SuggestionEngine.generateSuggestions(context);

      // High priority suggestions should come first
      const highPrioritySuggestions = suggestions.filter(
        (s) => s.priority === "high"
      );
      const firstSuggestion = suggestions[0];

      expect(highPrioritySuggestions.length).toBeGreaterThan(0);
      expect(firstSuggestion.priority).toBe("high");
    });

    it("should not generate duplicate suggestions", () => {
      const context = createSuggestionContext({
        ambiguities: ["URL is unclear", "URL endpoint is missing"],
        originalInput: "test the API",
      });

      const suggestions = SuggestionEngine.generateSuggestions(context);
      const messages = suggestions.map((s) => s.message);
      const uniqueMessages = [...new Set(messages)];

      expect(messages.length).toBe(uniqueMessages.length);
    });
  });

  describe("generateInteractiveQuestions", () => {
    it("should generate questions for missing critical information", () => {
      const incompleteSpec: LoadTestSpec = {
        id: "test_123",
        name: "Test",
        description: "Test",
        testType: "baseline",
        requests: [
          {
            method: "GET",
            url: "", // Missing URL
          },
        ],
        loadPattern: {
          type: "constant",
          // Missing load parameters
        },
        duration: { value: 1, unit: "minutes" },
      };

      const context = createSuggestionContext({
        parsedSpec: incompleteSpec,
      });

      const questions = SuggestionEngine.generateInteractiveQuestions(context);

      expect(questions.some((q) => q.includes("API endpoint URL"))).toBe(true);
      expect(
        questions.some(
          (q) =>
            q.includes("virtual users") || q.includes("requests per second")
        )
      ).toBe(true);
    });

    it("should limit the number of questions", () => {
      const context = createSuggestionContext({
        confidence: 0.1,
        originalInput: "test",
      });

      const questions = SuggestionEngine.generateInteractiveQuestions(context);

      expect(questions.length).toBeLessThanOrEqual(3);
    });

    it("should ask for clarification on low confidence", () => {
      const context = createSuggestionContext({
        confidence: 0.3,
        originalInput: "do something",
      });

      const questions = SuggestionEngine.generateInteractiveQuestions(context);

      // Debug: log the actual questions
      console.log("Generated questions:", questions);

      expect(questions.length).toBeGreaterThan(0);
    });
  });

  describe("generateQuickFixes", () => {
    it("should extract common patterns for quick fixes", () => {
      const context = createSuggestionContext({
        originalInput:
          "GET https://api.example.com/users with 50 users for 5 minutes",
      });

      const fixes = SuggestionEngine.generateQuickFixes(context);

      expect(fixes.length).toBeGreaterThan(0);
      // Should extract various patterns from the input
    });
  });
});

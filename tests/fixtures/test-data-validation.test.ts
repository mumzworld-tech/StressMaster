/**
 * Validation tests for test data sets
 * Ensures test data is properly structured and complete
 * Moved from tests/unit/parser/test-data/test-data-validation.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  allTestDataSets,
  TestDataSet,
  TestInput,
  ExpectedParseResult,
} from "./messy-input-datasets";

describe("Test Data Validation", () => {
  describe("Data Set Structure", () => {
    it("should have all required test data sets", () => {
      expect(allTestDataSets).toBeDefined();
      expect(allTestDataSets.length).toBeGreaterThan(0);

      const categories = allTestDataSets.map((ds) => ds.category);
      expect(categories).toContain("messy");
      expect(categories).toContain("mixed");
      expect(categories).toContain("edge_cases");
    });

    it("should have properly structured test data sets", () => {
      allTestDataSets.forEach((dataset) => {
        expect(dataset.category).toBeDefined();
        expect([
          "clean",
          "messy",
          "mixed",
          "malformed",
          "edge_cases",
        ]).toContain(dataset.category);

        expect(dataset.inputs).toBeDefined();
        expect(Array.isArray(dataset.inputs)).toBe(true);
        expect(dataset.inputs.length).toBeGreaterThan(0);

        expect(dataset.expectedOutputs).toBeDefined();
        expect(Array.isArray(dataset.expectedOutputs)).toBe(true);
        expect(dataset.expectedOutputs.length).toBe(dataset.inputs.length);

        expect(dataset.acceptableFallbacks).toBeDefined();
        expect(Array.isArray(dataset.acceptableFallbacks)).toBe(true);
      });
    });

    it("should have valid test inputs", () => {
      allTestDataSets.forEach((dataset) => {
        dataset.inputs.forEach((input, index) => {
          expect(input.raw).toBeDefined();
          expect(typeof input.raw).toBe("string");
          expect(input.raw.length).toBeGreaterThan(0);

          expect(input.description).toBeDefined();
          expect(typeof input.description).toBe("string");

          expect(input.expectedChallenges).toBeDefined();
          expect(Array.isArray(input.expectedChallenges)).toBe(true);

          expect(input.minimumConfidence).toBeDefined();
          expect(typeof input.minimumConfidence).toBe("number");
          expect(input.minimumConfidence).toBeGreaterThanOrEqual(0);
          expect(input.minimumConfidence).toBeLessThanOrEqual(1);
        });
      });
    });

    it("should have valid expected outputs", () => {
      allTestDataSets.forEach((dataset) => {
        dataset.expectedOutputs.forEach((output, index) => {
          if (Object.keys(output).length > 0) {
            // Skip empty specs
            if (output.method) {
              expect(["GET", "POST", "PUT", "DELETE", "PATCH"]).toContain(
                output.method
              );
            }

            if (output.url) {
              expect(output.url).toMatch(/^https?:\/\//);
            }

            if (output.headers) {
              expect(typeof output.headers).toBe("object");
            }

            if (output.loadPattern) {
              expect(typeof output.loadPattern).toBe("object");
            }
          }
        });
      });
    });
  });

  describe("Coverage Analysis", () => {
    it("should cover all requirement scenarios", () => {
      const allInputs = allTestDataSets.flatMap((ds) => ds.inputs);

      // Requirement 3.1: Handle extra whitespace and line breaks
      const whitespaceTests = allInputs.filter((input) =>
        input.expectedChallenges.some(
          (challenge) =>
            challenge.includes("whitespace") ||
            challenge.includes("normalization")
        )
      );
      expect(whitespaceTests.length).toBeGreaterThan(0);

      // Requirement 3.2: Handle duplicate/conflicting information
      const conflictTests = allInputs.filter((input) =>
        input.expectedChallenges.some(
          (challenge) =>
            challenge.includes("duplicate") || challenge.includes("conflict")
        )
      );
      expect(conflictTests.length).toBeGreaterThan(0);

      // Requirement 3.3: Handle partial URLs and relative paths
      const urlTests = allInputs.filter((input) =>
        input.expectedChallenges.some(
          (challenge) => challenge.includes("URL") || challenge.includes("path")
        )
      );
      expect(urlTests.length).toBeGreaterThan(0);

      // Requirement 3.4: Handle various header formats
      const headerTests = allInputs.filter((input) =>
        input.expectedChallenges.some((challenge) =>
          challenge.includes("header")
        )
      );
      expect(headerTests.length).toBeGreaterThan(0);
    });

    it("should include edge cases and stress scenarios", () => {
      const edgeCases = allTestDataSets.filter(
        (ds) => ds.category === "edge_cases"
      );
      expect(edgeCases.length).toBeGreaterThan(0);

      const allInputs = allTestDataSets.flatMap((ds) => ds.inputs);

      // Should have empty input test
      const emptyInputTest = allInputs.find((input) => input.raw.trim() === "");
      expect(emptyInputTest).toBeDefined();

      // Should have very long input test
      const longInputTest = allInputs.find((input) => input.raw.length > 1000);
      expect(longInputTest).toBeDefined();

      // Should have special character tests
      const specialCharTest = allInputs.find(
        (input) => input.raw.includes("🚀") || input.raw.includes("emoji")
      );
      expect(specialCharTest).toBeDefined();
    });

    it("should have realistic mixed format scenarios", () => {
      const mixedFormatTests = allTestDataSets.filter(
        (ds) => ds.category === "mixed"
      );
      expect(mixedFormatTests.length).toBeGreaterThan(0);

      const allInputs = mixedFormatTests.flatMap((ds) => ds.inputs);

      // Should have natural language + structured data
      const naturalLanguageTest = allInputs.find((input) =>
        input.description.includes("natural language")
      );
      expect(naturalLanguageTest).toBeDefined();

      // Should have curl command embedded in text
      const curlTest = allInputs.find(
        (input) => input.raw.includes("curl") && input.raw.includes("load test")
      );
      expect(curlTest).toBeDefined();
    });
  });

  describe("Data Quality", () => {
    it("should have meaningful test descriptions", () => {
      allTestDataSets.forEach((dataset) => {
        dataset.inputs.forEach((input) => {
          expect(input.description.length).toBeGreaterThan(10);
          expect(input.description).not.toBe("test");
          expect(input.description).not.toBe("input");
        });
      });
    });

    it("should have appropriate confidence levels", () => {
      allTestDataSets.forEach((dataset) => {
        dataset.inputs.forEach((input) => {
          // Clean inputs should have high confidence
          if (dataset.category === "clean") {
            expect(input.minimumConfidence).toBeGreaterThan(0.8);
          }

          // Edge cases can have lower confidence
          if (dataset.category === "edge_cases") {
            expect(input.minimumConfidence).toBeGreaterThanOrEqual(0.0);
          }

          // Messy inputs should have moderate confidence
          if (dataset.category === "messy") {
            expect(input.minimumConfidence).toBeGreaterThan(0.5);
          }
        });
      });
    });

    it("should have realistic expected challenges", () => {
      const allChallenges = allTestDataSets
        .flatMap((ds) => ds.inputs)
        .flatMap((input) => input.expectedChallenges);

      const uniqueChallenges = [...new Set(allChallenges)];

      // Should have variety of challenges
      expect(uniqueChallenges.length).toBeGreaterThan(10);

      // Should include common parsing challenges
      const commonChallenges = [
        "whitespace normalization",
        "header normalization",
        "URL reconstruction",
        "JSON parsing",
        "natural language parsing",
      ];

      commonChallenges.forEach((challenge) => {
        const hasChallenge = allChallenges.some((c) =>
          c.toLowerCase().includes(challenge.toLowerCase())
        );
        expect(hasChallenge).toBe(true);
      });
    });
  });

  describe("Test Data Statistics", () => {
    it("should report test data statistics", () => {
      const stats = {
        totalDataSets: allTestDataSets.length,
        totalInputs: allTestDataSets.reduce(
          (sum, ds) => sum + ds.inputs.length,
          0
        ),
        categoryCounts: {} as Record<string, number>,
        averageInputLength: 0,
        totalChallenges: 0,
      };

      // Calculate category counts
      allTestDataSets.forEach((ds) => {
        stats.categoryCounts[ds.category] =
          (stats.categoryCounts[ds.category] || 0) + 1;
      });

      // Calculate average input length and total challenges
      const allInputs = allTestDataSets.flatMap((ds) => ds.inputs);
      stats.averageInputLength =
        allInputs.reduce((sum, input) => sum + input.raw.length, 0) /
        allInputs.length;
      stats.totalChallenges = allInputs.reduce(
        (sum, input) => sum + input.expectedChallenges.length,
        0
      );

      console.log("\n📊 Test Data Statistics:");
      console.log(`   Total Data Sets: ${stats.totalDataSets}`);
      console.log(`   Total Test Inputs: ${stats.totalInputs}`);
      console.log(
        `   Average Input Length: ${Math.round(
          stats.averageInputLength
        )} characters`
      );
      console.log(`   Total Expected Challenges: ${stats.totalChallenges}`);
      console.log("   Category Distribution:");
      Object.entries(stats.categoryCounts).forEach(([category, count]) => {
        console.log(`     ${category}: ${count} data sets`);
      });

      // Verify we have good coverage
      expect(stats.totalInputs).toBeGreaterThan(10);
      expect(stats.totalChallenges).toBeGreaterThan(20);
      expect(Object.keys(stats.categoryCounts).length).toBeGreaterThan(3);
    });
  });
});

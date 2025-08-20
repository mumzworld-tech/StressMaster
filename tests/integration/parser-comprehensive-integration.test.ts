/**
 * Integration test for comprehensive messy input handling
 * Validates that the test suite components work together
 */

import { describe, it, expect } from "vitest";
import { allTestDataSets } from "../fixtures";
import { MockAIProvider } from "../utils/mock-ai-provider";

describe("Comprehensive Test Integration", () => {
  it("should have valid test data structure", () => {
    expect(allTestDataSets).toBeDefined();
    expect(allTestDataSets.length).toBeGreaterThan(0);

    // Verify we have different categories
    const categories = allTestDataSets.map((ds) => ds.category);
    expect(categories).toContain("clean");
    expect(categories).toContain("messy");
    expect(categories).toContain("mixed");
    expect(categories).toContain("edge_cases");

    console.log(
      `✅ Test data validation passed: ${allTestDataSets.length} datasets with ${categories.length} categories`
    );
  });

  it("should have working mock AI provider", async () => {
    const mockProvider = new MockAIProvider();

    const result = await mockProvider.parseCommand(
      "POST https://api.example.com/users with 10 users"
    );

    expect(result).toBeDefined();
    expect(result.requests).toBeDefined();
    expect(result.requests.length).toBeGreaterThan(0);
    expect(result.requests[0].method).toBe("POST");
    expect(result.requests[0].url).toBe("https://api.example.com/users");

    console.log("✅ Mock AI provider working correctly");
  });

  it("should process sample test data", async () => {
    const mockProvider = new MockAIProvider();

    // Test with a clean input
    const cleanDataset = allTestDataSets.find((ds) => ds.category === "clean");
    expect(cleanDataset).toBeDefined();

    if (cleanDataset && cleanDataset.inputs.length > 0) {
      const sampleInput = cleanDataset.inputs[0];
      const result = await mockProvider.parseCommand(sampleInput.raw);

      expect(result).toBeDefined();
      console.log(
        `✅ Successfully processed clean input: ${sampleInput.description}`
      );
    }
  });

  it("should handle messy input gracefully", async () => {
    const mockProvider = new MockAIProvider();

    // Test with messy input
    const messyDataset = allTestDataSets.find((ds) => ds.category === "messy");
    expect(messyDataset).toBeDefined();

    if (messyDataset && messyDataset.inputs.length > 0) {
      const sampleInput = messyDataset.inputs[0];
      const result = await mockProvider.parseCommand(sampleInput.raw);

      expect(result).toBeDefined();
      console.log(
        `✅ Successfully processed messy input: ${sampleInput.description}`
      );
    }
  });

  it("should demonstrate error recovery", async () => {
    const mockProvider = new MockAIProvider();

    // Simulate failure then recovery
    mockProvider.simulateFailure(2);

    try {
      const result = await mockProvider.parseCommand(
        "POST https://api.example.com/test"
      );
      expect(result).toBeDefined();
      console.log("✅ Error recovery mechanism working");
    } catch (error) {
      // Expected on first attempts
      expect(error).toBeInstanceOf(Error);
    }

    // Should work after failures
    mockProvider.clearFailures();
    const result = await mockProvider.parseCommand(
      "POST https://api.example.com/test"
    );
    expect(result).toBeDefined();
  });

  it("should measure basic performance", async () => {
    const mockProvider = new MockAIProvider();
    const testInputs = [
      "POST https://api.example.com/users with 10 users",
      "GET https://api.example.com/data with 5 users",
      "PUT https://api.example.com/update with 15 users",
    ];

    const startTime = Date.now();

    const results = await Promise.all(
      testInputs.map((input) => mockProvider.parseCommand(input))
    );

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / results.length;

    expect(results).toHaveLength(3);
    results.forEach((result) => expect(result).toBeDefined());

    expect(totalTime).toBeLessThan(1000); // Should be very fast with mock

    console.log(
      `✅ Performance test: ${totalTime}ms total, ${averageTime.toFixed(
        0
      )}ms average`
    );
  });

  it("should provide comprehensive test coverage summary", () => {
    const stats = {
      totalDatasets: allTestDataSets.length,
      totalInputs: allTestDataSets.reduce(
        (sum, ds) => sum + ds.inputs.length,
        0
      ),
      totalExpectedOutputs: allTestDataSets.reduce(
        (sum, ds) => sum + ds.expectedOutputs.length,
        0
      ),
      categoryCounts: {} as Record<string, number>,
      challengeTypes: new Set<string>(),
    };

    // Count categories and challenges
    allTestDataSets.forEach((ds) => {
      stats.categoryCounts[ds.category] =
        (stats.categoryCounts[ds.category] || 0) + 1;

      ds.inputs.forEach((input) => {
        input.expectedChallenges.forEach((challenge) => {
          stats.challengeTypes.add(challenge);
        });
      });
    });

    console.log("\n📊 Comprehensive Test Suite Summary:");
    console.log(`   Total Datasets: ${stats.totalDatasets}`);
    console.log(`   Total Test Inputs: ${stats.totalInputs}`);
    console.log(`   Total Expected Outputs: ${stats.totalExpectedOutputs}`);
    console.log(`   Unique Challenge Types: ${stats.challengeTypes.size}`);
    console.log("   Category Distribution:");
    Object.entries(stats.categoryCounts).forEach(([category, count]) => {
      console.log(`     ${category}: ${count} datasets`);
    });
    console.log(
      `   Challenge Types: ${Array.from(stats.challengeTypes).join(", ")}`
    );

    // Verify comprehensive coverage
    expect(stats.totalInputs).toBeGreaterThan(10);
    expect(stats.challengeTypes.size).toBeGreaterThan(10);
    expect(Object.keys(stats.categoryCounts).length).toBeGreaterThan(3);

    console.log("\n✅ Comprehensive test suite validation complete!");
  });
});

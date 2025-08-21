import { LoadPattern, TestType } from "../../types";
import {
  LoadPatternGenerator,
  LoadPatternConfig,
} from "./load-pattern-generator";

/**
 * Example utility demonstrating how to use the load pattern generator
 * for different types of load testing scenarios.
 */
export class LoadPatternExamples {
  private generator: LoadPatternGenerator;

  constructor() {
    this.generator = new LoadPatternGenerator();
  }

  /**
   * Generate a spike test pattern for testing sudden load increases
   */
  createSpikeTestPattern(
    baselineUsers: number = 10,
    spikeMultiplier: number = 10
  ): LoadPattern {
    const config: LoadPatternConfig = {
      type: "spike",
      virtualUsers: baselineUsers * spikeMultiplier,
      spikeIntensity: spikeMultiplier,
      duration: { value: 30, unit: "seconds" },
    };

    return LoadPatternGenerator.generateLoadPattern(config);
  }

  /**
   * Generate a stress test pattern for gradual load increase
   */
  createStressTestPattern(
    maxUsers: number = 100,
    rampUpMinutes: number = 5
  ): LoadPattern {
    const config: LoadPatternConfig = {
      type: "stress",
      virtualUsers: maxUsers,
      rampUpDuration: { value: rampUpMinutes, unit: "minutes" },
      duration: { value: rampUpMinutes * 2, unit: "minutes" },
    };

    return LoadPatternGenerator.generateLoadPattern(config);
  }

  /**
   * Generate an endurance test pattern for sustained load over time
   */
  createEnduranceTestPattern(
    sustainedUsers: number = 25,
    durationHours: number = 2
  ): LoadPattern {
    const config: LoadPatternConfig = {
      type: "endurance",
      virtualUsers: sustainedUsers,
      duration: { value: durationHours, unit: "hours" },
    };

    return LoadPatternGenerator.generateLoadPattern(config);
  }

  /**
   * Generate a volume test pattern for high concurrent user simulation
   */
  createVolumeTestPattern(
    concurrentUsers: number = 1000,
    durationMinutes: number = 30
  ): LoadPattern {
    const config: LoadPatternConfig = {
      type: "volume",
      virtualUsers: concurrentUsers,
      duration: { value: durationMinutes, unit: "minutes" },
    };

    return LoadPatternGenerator.generateLoadPattern(config);
  }

  /**
   * Generate a baseline test pattern for establishing performance benchmarks
   */
  createBaselineTestPattern(
    baselineUsers: number = 10,
    durationMinutes: number = 10
  ): LoadPattern {
    const config: LoadPatternConfig = {
      type: "baseline",
      virtualUsers: baselineUsers,
      duration: { value: durationMinutes, unit: "minutes" },
    };

    return LoadPatternGenerator.generateLoadPattern(config);
  }

  /**
   * Validate and optimize any load pattern
   */
  validateAndOptimize(pattern: LoadPattern): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    optimizedPattern: LoadPattern;
  } {
    // Simple validation for now
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!pattern.virtualUsers || pattern.virtualUsers < 1) {
      errors.push("Virtual users must be at least 1");
    }

    if (pattern.virtualUsers && pattern.virtualUsers > 10000) {
      warnings.push("High virtual user count may cause resource issues");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      optimizedPattern: pattern,
    };
  }

  /**
   * Generate K6 stages for any load pattern
   */
  generateK6Stages(pattern: LoadPattern): Array<{
    duration: string;
    target: number;
  }> {
    // Simple stage generation based on pattern type
    const stages: Array<{ duration: string; target: number }> = [];

    if (pattern.rampUpTime) {
      stages.push({
        duration: `${pattern.rampUpTime.value}s`,
        target: pattern.virtualUsers || 10,
      });
    }

    if (pattern.plateauTime) {
      stages.push({
        duration: `${pattern.plateauTime.value}s`,
        target: pattern.virtualUsers || 10,
      });
    }

    stages.push({
      duration: "10s",
      target: 0,
    });

    return stages;
  }

  /**
   * Get recommended patterns for common scenarios
   */
  getRecommendedPatterns() {
    return {
      // Quick API health check
      healthCheck: this.createBaselineTestPattern(5, 2),

      // Standard load test
      standardLoad: this.createStressTestPattern(50, 3),

      // Peak traffic simulation
      peakTraffic: this.createSpikeTestPattern(20, 5),

      // Long-running stability test
      stabilityTest: this.createEnduranceTestPattern(15, 4),

      // High volume capacity test
      capacityTest: this.createVolumeTestPattern(500, 20),
    };
  }
}

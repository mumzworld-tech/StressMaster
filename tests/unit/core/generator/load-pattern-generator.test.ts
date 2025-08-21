import { describe, it, expect, beforeEach } from "vitest";
import {
  K6LoadPatternGenerator,
  LoadPatternParameters,
} from "@/core/generator";
import { TestType, Duration } from "@/types";

describe("K6LoadPatternGenerator", () => {
  let generator: K6LoadPatternGenerator;

  beforeEach(() => {
    generator = new K6LoadPatternGenerator();
  });

  describe("generatePattern", () => {
    it("should generate spike testing pattern", () => {
      const parameters: LoadPatternParameters = {
        maxVirtualUsers: 100,
        spikeIntensity: 5,
        baselineVUs: 10,
        spikeDuration: { value: 30, unit: "seconds" },
      };

      const pattern = generator.generatePattern("spike", parameters);

      expect(pattern.type).toBe("spike");
      expect(pattern.virtualUsers).toBe(100);
      expect(pattern.baselineVUs).toBe(10);
      expect(pattern.spikeIntensity).toBe(5);
      expect(pattern.plateauTime).toEqual({ value: 30, unit: "seconds" });
      expect(pattern.rampUpTime).toEqual({ value: 10, unit: "seconds" });
    });

    it("should generate spike pattern with default values", () => {
      const parameters: LoadPatternParameters = {
        baselineVUs: 5,
      };

      const pattern = generator.generatePattern("spike", parameters);

      expect(pattern.type).toBe("spike");
      expect(pattern.virtualUsers).toBe(50); // 5 * 10 (default spike intensity)
      expect(pattern.baselineVUs).toBe(5);
      expect(pattern.spikeIntensity).toBe(10);
    });

    it("should generate stress testing pattern", () => {
      const parameters: LoadPatternParameters = {
        maxVirtualUsers: 200,
        rampUpDuration: { value: 5, unit: "minutes" },
        plateauDuration: { value: 10, unit: "minutes" },
        rampDownDuration: { value: 2, unit: "minutes" },
      };

      const pattern = generator.generatePattern("stress", parameters);

      expect(pattern.type).toBe("ramp-up");
      expect(pattern.virtualUsers).toBe(200);
      expect(pattern.rampUpTime).toEqual({ value: 5, unit: "minutes" });
      expect(pattern.plateauTime).toEqual({ value: 10, unit: "minutes" });
      expect(pattern.rampDownTime).toEqual({ value: 2, unit: "minutes" });
    });

    it("should generate stress pattern with default values", () => {
      const parameters: LoadPatternParameters = {};

      const pattern = generator.generatePattern("stress", parameters);

      expect(pattern.type).toBe("ramp-up");
      expect(pattern.virtualUsers).toBe(100);
      expect(pattern.rampUpTime).toEqual({ value: 300, unit: "seconds" });
      expect(pattern.plateauTime).toEqual({ value: 600, unit: "seconds" });
      expect(pattern.rampDownTime).toEqual({ value: 60, unit: "seconds" });
    });

    it("should generate endurance testing pattern", () => {
      const parameters: LoadPatternParameters = {
        sustainedLoad: 75,
        enduranceDuration: { value: 4, unit: "hours" },
      };

      const pattern = generator.generatePattern("endurance", parameters);

      expect(pattern.type).toBe("constant");
      expect(pattern.virtualUsers).toBe(75);
      expect(pattern.plateauTime).toEqual({ value: 4, unit: "hours" });
      expect(pattern.rampUpTime).toEqual({ value: 60, unit: "seconds" });
      expect(pattern.rampDownTime).toEqual({ value: 60, unit: "seconds" });
    });

    it("should generate endurance pattern with default values", () => {
      const parameters: LoadPatternParameters = {};

      const pattern = generator.generatePattern("endurance", parameters);

      expect(pattern.type).toBe("constant");
      expect(pattern.virtualUsers).toBe(50);
      expect(pattern.plateauTime).toEqual({ value: 2, unit: "hours" });
    });

    it("should generate volume testing pattern", () => {
      const parameters: LoadPatternParameters = {
        concurrentUsers: 1000,
        duration: { value: 45, unit: "minutes" },
      };

      const pattern = generator.generatePattern("volume", parameters);

      expect(pattern.type).toBe("step");
      expect(pattern.virtualUsers).toBe(1000);
      expect(pattern.plateauTime).toEqual({ value: 45, unit: "minutes" });
      expect(pattern.rampUpTime).toEqual({ value: 300, unit: "seconds" });
      expect(pattern.volumeTarget).toBe(1000);
    });

    it("should generate baseline testing pattern", () => {
      const parameters: LoadPatternParameters = {
        baselineVUs: 15,
        baselineDuration: { value: 15, unit: "minutes" },
      };

      const pattern = generator.generatePattern("baseline", parameters);

      expect(pattern.type).toBe("constant");
      expect(pattern.virtualUsers).toBe(15);
      expect(pattern.plateauTime).toEqual({ value: 15, unit: "minutes" });
      expect(pattern.rampUpTime).toEqual({ value: 30, unit: "seconds" });
    });

    it("should throw error for unsupported test type", () => {
      const parameters: LoadPatternParameters = {};

      expect(() => {
        generator.generatePattern("unsupported" as TestType, parameters);
      }).toThrow("Unsupported test type: unsupported");
    });
  });

  describe("generateK6Stages", () => {
    it("should generate spike stages", () => {
      const pattern = {
        type: "spike" as const,
        virtualUsers: 100,
        baselineVUs: 10,
        rampUpTime: { value: 15, unit: "seconds" as const },
        plateauTime: { value: 45, unit: "seconds" as const },
        rampDownTime: { value: 15, unit: "seconds" as const },
      };

      const stages = generator.generateK6Stages(pattern);

      expect(stages).toHaveLength(5);
      expect(stages[0]).toEqual({ duration: "30s", target: 10 }); // baseline
      expect(stages[1]).toEqual({ duration: "15s", target: 100 }); // spike up
      expect(stages[2]).toEqual({ duration: "45s", target: 100 }); // hold spike
      expect(stages[3]).toEqual({ duration: "15s", target: 10 }); // spike down
      expect(stages[4]).toEqual({ duration: "30s", target: 10 }); // return to baseline
    });

    it("should generate ramp-up stages", () => {
      const pattern = {
        type: "ramp-up" as const,
        virtualUsers: 50,
        rampUpTime: { value: 2, unit: "minutes" as const },
        plateauTime: { value: 5, unit: "minutes" as const },
        rampDownTime: { value: 1, unit: "minutes" as const },
      };

      const stages = generator.generateK6Stages(pattern);

      expect(stages).toHaveLength(3);
      expect(stages[0]).toEqual({ duration: "2m", target: 50 });
      expect(stages[1]).toEqual({ duration: "5m", target: 50 });
      expect(stages[2]).toEqual({ duration: "1m", target: 0 });
    });

    it("should generate constant stages", () => {
      const pattern = {
        type: "constant" as const,
        virtualUsers: 25,
        rampUpTime: { value: 30, unit: "seconds" as const },
        plateauTime: { value: 10, unit: "minutes" as const },
        rampDownTime: { value: 30, unit: "seconds" as const },
      };

      const stages = generator.generateK6Stages(pattern);

      expect(stages).toHaveLength(3);
      expect(stages[0]).toEqual({ duration: "30s", target: 25 });
      expect(stages[1]).toEqual({ duration: "10m", target: 25 });
      expect(stages[2]).toEqual({ duration: "30s", target: 0 });
    });

    it("should generate step stages", () => {
      const pattern = {
        type: "step" as const,
        virtualUsers: 100,
        plateauTime: { value: 5, unit: "minutes" as const },
      };

      const stages = generator.generateK6Stages(pattern);

      expect(stages.length).toBeGreaterThan(5); // 5 steps up + hold + 5 steps down
      expect(stages[0]).toEqual({ duration: "60s", target: 20 }); // first step
      expect(stages[5]).toEqual({ duration: "5m", target: 100 }); // hold at max
    });
  });

  describe("validatePattern", () => {
    it("should validate valid pattern", () => {
      const pattern = {
        type: "constant" as const,
        virtualUsers: 50,
        rampUpTime: { value: 60, unit: "seconds" as const },
        plateauTime: { value: 300, unit: "seconds" as const },
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid virtual users", () => {
      const pattern = {
        type: "constant" as const,
        virtualUsers: 0,
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Virtual users must be at least 1");
    });

    it("should warn about high virtual users", () => {
      const pattern = {
        type: "constant" as const,
        virtualUsers: 15000,
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "High virtual user count may cause resource issues"
      );
    });

    it("should detect invalid RPS", () => {
      const pattern = {
        type: "constant" as const,
        requestsPerSecond: 0.05,
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Requests per second must be at least 0.1"
      );
    });

    it("should warn about high RPS", () => {
      const pattern = {
        type: "constant" as const,
        requestsPerSecond: 20000,
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("High RPS may overwhelm target system");
    });

    it("should validate spike testing requirements", () => {
      const pattern = {
        type: "spike" as const,
        // Missing virtualUsers
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Spike testing requires virtual users to be specified"
      );
    });

    it("should validate ramp-up testing requirements", () => {
      const pattern = {
        type: "ramp-up" as const,
        virtualUsers: 50,
        // Missing rampUpTime
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Ramp-up testing requires ramp-up time to be specified"
      );
    });

    it("should warn about missing plateau time for ramp-up", () => {
      const pattern = {
        type: "ramp-up" as const,
        virtualUsers: 50,
        rampUpTime: { value: 60, unit: "seconds" as const },
        // Missing plateauTime
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Consider specifying plateau time for ramp-up testing"
      );
    });

    it("should validate spike baseline vs max virtual users", () => {
      const pattern = {
        type: "spike" as const,
        virtualUsers: 50,
        baselineVUs: 60, // Higher than max VUs
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Spike virtual users must be greater than baseline virtual users"
      );
    });

    it("should validate step testing requirements", () => {
      const pattern = {
        type: "step" as const,
        // Missing virtualUsers
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Step testing requires virtual users to be specified"
      );
    });

    it("should warn about high virtual users in step testing", () => {
      const pattern = {
        type: "step" as const,
        virtualUsers: 8000,
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "High virtual user count in step testing may cause resource spikes"
      );
    });

    it("should validate constant load testing requirements", () => {
      const pattern = {
        type: "constant" as const,
        // Missing both virtualUsers and requestsPerSecond
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Constant load testing requires either virtual users or RPS to be specified"
      );
    });

    it("should warn about very long constant load tests", () => {
      const pattern = {
        type: "constant" as const,
        virtualUsers: 50,
        plateauTime: { value: 5, unit: "hours" as const }, // Very long
      };

      const result = generator.validatePattern(pattern);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Very long constant load tests may require additional monitoring"
      );
    });
  });

  describe("optimizePattern", () => {
    it("should optimize spike test virtual users", () => {
      const pattern = {
        type: "spike" as const,
        virtualUsers: 2000, // Too high
        baselineVUs: 10,
      };

      const optimized = generator.optimizePattern(pattern);

      expect(optimized.virtualUsers).toBe(1000); // Capped at 1000
    });

    it("should optimize ramp-up time", () => {
      const pattern = {
        type: "ramp-up" as const,
        virtualUsers: 50,
        rampUpTime: { value: 10, unit: "seconds" as const }, // Too short
      };

      const optimized = generator.optimizePattern(pattern);

      expect(optimized.rampUpTime).toEqual({ value: 30, unit: "seconds" });
    });

    it("should add default plateau time for ramp-up", () => {
      const pattern = {
        type: "ramp-up" as const,
        virtualUsers: 50,
        rampUpTime: { value: 60, unit: "seconds" as const },
        // Missing plateauTime
      };

      const optimized = generator.optimizePattern(pattern);

      expect(optimized.plateauTime).toEqual({ value: 60, unit: "seconds" });
    });

    it("should not modify already optimized patterns", () => {
      const pattern = {
        type: "constant" as const,
        virtualUsers: 50,
        rampUpTime: { value: 60, unit: "seconds" as const },
        plateauTime: { value: 300, unit: "seconds" as const },
      };

      const optimized = generator.optimizePattern(pattern);

      expect(optimized).toEqual(pattern);
    });

    it("should optimize volume testing patterns", () => {
      const pattern = {
        type: "step" as const,
        virtualUsers: 3000, // Too high
        rampUpTime: { value: 2, unit: "minutes" as const }, // Too short
      };

      const optimized = generator.optimizePattern(pattern);

      expect(optimized.virtualUsers).toBe(2000); // Capped at 2000
      expect(optimized.rampUpTime).toEqual({ value: 10, unit: "minutes" });
    });

    it("should optimize baseline testing patterns", () => {
      const pattern = {
        type: "constant" as const,
        virtualUsers: 200, // High for baseline
        plateauTime: { value: 5, unit: "minutes" as const }, // Short duration
      };

      const optimized = generator.optimizePattern(pattern);

      expect(optimized.virtualUsers).toBe(50); // Reduced for baseline
    });

    it("should optimize endurance testing patterns", () => {
      const pattern = {
        type: "constant" as const,
        virtualUsers: 100, // Too high for very long test
        plateauTime: { value: 10, unit: "hours" as const }, // Very long
      };

      const optimized = generator.optimizePattern(pattern);

      expect(optimized.virtualUsers).toBe(25); // Reduced for long endurance
    });

    it("should optimize step testing ramp-up time", () => {
      const pattern = {
        type: "step" as const,
        virtualUsers: 500,
        rampUpTime: { value: 2, unit: "minutes" as const }, // Too short for steps
      };

      const optimized = generator.optimizePattern(pattern);

      expect(optimized.rampUpTime).toEqual({ value: 5, unit: "minutes" });
    });
  });
});

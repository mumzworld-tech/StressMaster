/**
 * Load Pattern Generator - Creates different types of load patterns
 * for various test scenarios (spike, stress, endurance, etc.)
 */

import { LoadPattern, LoadTestSpec } from "../../types";

export interface LoadPatternConfig {
  type:
    | "spike"
    | "stress"
    | "endurance"
    | "volume"
    | "baseline"
    | "ramp-up"
    | "step"
    | "constant";
  virtualUsers?: number;
  requestsPerSecond?: number;
  duration?: { value: number; unit: string };
  rampUpDuration?: { value: number; unit: string };
  targetUsers?: number;
  spikeIntensity?: number;
  stressLevel?: number;
}

export class LoadPatternGenerator {
  /**
   * Generate load pattern based on test configuration
   */
  static generateLoadPattern(config: LoadPatternConfig): LoadPattern {
    switch (config.type) {
      case "spike":
        return this.generateSpikePattern(config);
      case "stress":
        return this.generateStressPattern(config);
      case "endurance":
        return this.generateEndurancePattern(config);
      case "volume":
        return this.generateVolumePattern(config);
      case "ramp-up":
        return this.generateRampUpPattern(config);
      case "step":
        return this.generateStepPattern(config);
      case "constant":
      case "baseline":
      default:
        return this.generateConstantPattern(config);
    }
  }

  /**
   * Generate spike test pattern
   */
  private static generateSpikePattern(config: LoadPatternConfig): LoadPattern {
    const intensity = config.spikeIntensity || config.virtualUsers || 1000;
    const duration = config.duration || { value: 10, unit: "seconds" };

    return {
      type: "spike",
      virtualUsers: intensity,
      plateauTime: this.normalizeDuration(duration),
      rampUpTime: { value: 10, unit: "seconds" },
      rampDownTime: { value: 10, unit: "seconds" },
    };
  }

  /**
   * Generate stress test pattern
   */
  private static generateStressPattern(config: LoadPatternConfig): LoadPattern {
    const stressLevel = config.stressLevel || config.virtualUsers || 500;
    const duration = config.duration || { value: 30, unit: "minutes" };
    const rampUpDuration = config.rampUpDuration || {
      value: 10,
      unit: "minutes",
    };

    return {
      type: "ramp-up",
      virtualUsers: stressLevel,
      plateauTime: this.normalizeDuration(duration),
      rampUpTime: this.normalizeDuration(rampUpDuration),
      rampDownTime: { value: 60, unit: "seconds" },
    };
  }

  /**
   * Generate endurance test pattern
   */
  private static generateEndurancePattern(
    config: LoadPatternConfig
  ): LoadPattern {
    const users = config.virtualUsers || 50;
    const duration = config.duration || { value: 2, unit: "hours" };

    return {
      type: "constant",
      virtualUsers: users,
      plateauTime: this.normalizeDuration(duration),
      rampUpTime: { value: 60, unit: "seconds" },
      rampDownTime: { value: 60, unit: "seconds" },
    };
  }

  /**
   * Generate volume test pattern
   */
  private static generateVolumePattern(config: LoadPatternConfig): LoadPattern {
    const users = config.virtualUsers || 200;
    const duration = config.duration || { value: 15, unit: "minutes" };

    return {
      type: "constant",
      virtualUsers: users,
      plateauTime: this.normalizeDuration(duration),
      rampUpTime: { value: 300, unit: "seconds" },
      rampDownTime: { value: 120, unit: "seconds" },
    };
  }

  /**
   * Generate ramp-up pattern
   */
  private static generateRampUpPattern(config: LoadPatternConfig): LoadPattern {
    const targetUsers = config.targetUsers || config.virtualUsers || 100;
    const duration = config.duration || { value: 15, unit: "minutes" };
    const rampUpDuration = config.rampUpDuration || {
      value: 5,
      unit: "minutes",
    };

    return {
      type: "ramp-up",
      virtualUsers: targetUsers,
      plateauTime: this.normalizeDuration(duration),
      rampUpTime: this.normalizeDuration(rampUpDuration),
      rampDownTime: { value: 60, unit: "seconds" },
    };
  }

  /**
   * Generate step pattern
   */
  private static generateStepPattern(config: LoadPatternConfig): LoadPattern {
    const stepSize = 50; // Default step size
    const duration = config.duration || { value: 10, unit: "minutes" };

    return {
      type: "step",
      virtualUsers: stepSize * 4, // 4 steps by default
      plateauTime: this.normalizeDuration(duration),
      rampUpTime: { value: 300, unit: "seconds" },
      rampDownTime: { value: 120, unit: "seconds" },
    };
  }

  /**
   * Generate constant pattern
   */
  private static generateConstantPattern(
    config: LoadPatternConfig
  ): LoadPattern {
    const users = config.virtualUsers || 10;
    const duration = config.duration || { value: 30, unit: "seconds" };

    return {
      type: "constant",
      virtualUsers: users,
      plateauTime: this.normalizeDuration(duration),
      rampUpTime: { value: 30, unit: "seconds" },
      rampDownTime: { value: 30, unit: "seconds" },
    };
  }

  /**
   * Normalize duration to seconds
   */
  private static normalizeDuration(duration: { value: number; unit: string }): {
    value: number;
    unit: "seconds" | "minutes" | "hours";
  } {
    const normalizedUnit = this.normalizeTimeUnit(duration.unit);
    return {
      value: duration.value,
      unit: normalizedUnit,
    };
  }

  /**
   * Normalize time unit
   */
  private static normalizeTimeUnit(
    unit: string
  ): "seconds" | "minutes" | "hours" {
    const normalized = unit.toLowerCase();
    if (normalized.includes("sec")) return "seconds";
    if (normalized.includes("min")) return "minutes";
    if (normalized.includes("hour") || normalized.includes("hr"))
      return "hours";
    return "seconds";
  }

  /**
   * Generate K6 script for the load pattern
   */
  static generateK6Script(spec: LoadTestSpec): string {
    const pattern = spec.loadPattern;
    const request = spec.requests[0];

    let script = `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
`;

    switch (pattern.type) {
      case "spike":
        script += this.generateSpikeK6Script(pattern);
        break;
      case "ramp-up":
        script += this.generateRampUpK6Script(pattern);
        break;
      case "step":
        script += this.generateStepK6Script(pattern);
        break;
      case "constant":
      default:
        script += this.generateConstantK6Script(pattern);
        break;
    }

    script += `  ],
};

export default function () {
  const url = '${request.url}';
  const payload = ${JSON.stringify(request.body || {})};
  const headers = ${JSON.stringify(request.headers || {})};

  const response = http.${request.method.toLowerCase()}(url, payload, { headers });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
`;

    return script;
  }

  private static generateSpikeK6Script(pattern: LoadPattern): string {
    const duration = pattern.plateauTime?.value || 10;
    return `    { duration: '${duration}s', target: ${pattern.virtualUsers} },
    { duration: '${duration}s', target: 0 },
`;
  }

  private static generateRampUpK6Script(pattern: LoadPattern): string {
    const rampUpTime = pattern.rampUpTime?.value || 60;
    const duration = pattern.plateauTime?.value || 300;
    const targetUsers = pattern.virtualUsers || 100;

    return `    { duration: '${rampUpTime}s', target: ${targetUsers} },
    { duration: '${duration}s', target: ${targetUsers} },
    { duration: '30s', target: 0 },
`;
  }

  private static generateStepK6Script(pattern: LoadPattern): string {
    const stepDuration = 120; // Default 2 minutes per step
    const stepSize = 50; // Default step size
    const totalSteps = Math.floor((pattern.virtualUsers || 200) / stepSize);

    let script = "";
    for (let i = 1; i <= totalSteps; i++) {
      script += `    { duration: '${stepDuration}s', target: ${stepSize * i} },
`;
    }
    script += `    { duration: '30s', target: 0 },
`;
    return script;
  }

  private static generateConstantK6Script(pattern: LoadPattern): string {
    const duration = pattern.plateauTime?.value || 30;
    const users = pattern.virtualUsers || 10;

    return `    { duration: '${duration}s', target: ${users} },
    { duration: '10s', target: 0 },
`;
  }
}

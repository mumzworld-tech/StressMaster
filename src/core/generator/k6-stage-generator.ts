import { LoadPattern, Duration, K6Stage } from "../../types";

// Extended LoadPattern type for spike patterns
interface SpikeLoadPattern extends LoadPattern {
  baselineVUs?: number;
  rampDownTime?: Duration;
}

interface RampUpLoadPattern extends LoadPattern {
  rampDownTime?: Duration;
}

export class K6StageGenerator {
  generateK6Stages(pattern: LoadPattern): K6Stage[] {
    switch (pattern.type) {
      case "spike":
        return this.generateSpikeStages(pattern);
      case "ramp-up":
        return this.generateRampUpStages(pattern);
      case "constant":
        return this.generateConstantStages(pattern);
      case "step":
        return this.generateStepStages(pattern);
      default:
        return [];
    }
  }

  private generateSpikeStages(pattern: LoadPattern): K6Stage[] {
    const stages: K6Stage[] = [];
    const spikePattern = pattern as SpikeLoadPattern;
    const baselineVUs = spikePattern.baselineVUs || 1;
    const maxVUs = pattern.virtualUsers || 10;

    // Start with baseline
    stages.push({
      duration: "30s",
      target: baselineVUs,
    });

    // Rapid spike up
    stages.push({
      duration: this.formatDuration(
        pattern.rampUpTime || { value: 10, unit: "seconds" }
      ),
      target: maxVUs,
    });

    // Hold spike
    stages.push({
      duration: this.formatDuration(
        pattern.plateauTime || { value: 30, unit: "seconds" }
      ),
      target: maxVUs,
    });

    // Rapid spike down
    stages.push({
      duration: this.formatDuration(
        spikePattern.rampDownTime || { value: 10, unit: "seconds" }
      ),
      target: baselineVUs,
    });

    // Return to baseline
    stages.push({
      duration: "30s",
      target: baselineVUs,
    });

    return stages;
  }

  private generateRampUpStages(pattern: LoadPattern): K6Stage[] {
    const stages: K6Stage[] = [];
    const maxVUs = pattern.virtualUsers || 10;

    // Ramp up
    stages.push({
      duration: this.formatDuration(
        pattern.rampUpTime || { value: 60, unit: "seconds" }
      ),
      target: maxVUs,
    });

    // Plateau
    if (pattern.plateauTime) {
      stages.push({
        duration: this.formatDuration(pattern.plateauTime),
        target: maxVUs,
      });
    }

    // Ramp down
    const rampUpPattern = pattern as RampUpLoadPattern;
    const rampDownTime = rampUpPattern.rampDownTime || {
      value: 60,
      unit: "seconds",
    };
    stages.push({
      duration: this.formatDuration(rampDownTime),
      target: 0,
    });

    return stages;
  }

  private generateConstantStages(pattern: LoadPattern): K6Stage[] {
    const stages: K6Stage[] = [];
    const vus = pattern.virtualUsers || 10;

    // Ramp up to target
    stages.push({
      duration: this.formatDuration(
        pattern.rampUpTime || { value: 30, unit: "seconds" }
      ),
      target: vus,
    });

    // Hold constant load
    stages.push({
      duration: this.formatDuration(
        pattern.plateauTime || { value: 300, unit: "seconds" }
      ),
      target: vus,
    });

    // Ramp down
    const constantPattern = pattern as RampUpLoadPattern;
    const rampDownTime = constantPattern.rampDownTime || {
      value: 30,
      unit: "seconds",
    };
    stages.push({
      duration: this.formatDuration(rampDownTime),
      target: 0,
    });

    return stages;
  }

  private generateStepStages(pattern: LoadPattern): K6Stage[] {
    const stages: K6Stage[] = [];
    const maxVUs = pattern.virtualUsers || 100;
    const steps = 5; // Number of steps
    const stepSize = Math.ceil(maxVUs / steps);
    const stepDuration = "60s"; // 1 minute per step

    // Step up
    for (let i = 1; i <= steps; i++) {
      stages.push({
        duration: stepDuration,
        target: Math.min(i * stepSize, maxVUs),
      });
    }

    // Hold at max
    stages.push({
      duration: this.formatDuration(
        pattern.plateauTime || { value: 300, unit: "seconds" }
      ),
      target: maxVUs,
    });

    // Step down
    for (let i = steps - 1; i >= 0; i--) {
      stages.push({
        duration: stepDuration,
        target: i * stepSize,
      });
    }

    return stages;
  }

  private formatDuration(duration: Duration): string {
    const unit =
      duration.unit === "seconds"
        ? "s"
        : duration.unit === "minutes"
        ? "m"
        : "h";
    return `${duration.value}${unit}`;
  }
}

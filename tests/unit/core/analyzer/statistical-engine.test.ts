import { describe, it, expect, beforeEach } from "vitest";
import { StatisticalEngine } from "@/core/analyzer";
import { TimeSeriesData } from "@/core/analyzer";
import { PerformanceMetrics } from "@/types";

describe("StatisticalEngine", () => {
  let engine: StatisticalEngine;

  beforeEach(() => {
    engine = new StatisticalEngine();
  });

  describe("calculatePercentiles", () => {
    it("should calculate percentiles correctly for a normal dataset", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = engine.calculatePercentiles(values);

      expect(result.min).toBe(1);
      expect(result.max).toBe(10);
      expect(result.avg).toBe(5.5);
      expect(result.p50).toBe(5.5);
      expect(result.p90).toBe(9.1);
      expect(result.p95).toBeCloseTo(9.55, 1);
      expect(result.p99).toBeCloseTo(9.91, 1);
    });

    it("should handle empty array", () => {
      const result = engine.calculatePercentiles([]);

      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.avg).toBe(0);
      expect(result.p50).toBe(0);
      expect(result.p90).toBe(0);
      expect(result.p95).toBe(0);
      expect(result.p99).toBe(0);
    });

    it("should handle single value", () => {
      const result = engine.calculatePercentiles([42]);

      expect(result.min).toBe(42);
      expect(result.max).toBe(42);
      expect(result.avg).toBe(42);
      expect(result.p50).toBe(42);
      expect(result.p90).toBe(42);
      expect(result.p95).toBe(42);
      expect(result.p99).toBe(42);
    });

    it("should handle unsorted data", () => {
      const values = [10, 1, 5, 3, 8, 2, 9, 4, 7, 6];
      const result = engine.calculatePercentiles(values);

      expect(result.min).toBe(1);
      expect(result.max).toBe(10);
      expect(result.avg).toBe(5.5);
      expect(result.p50).toBe(5.5);
    });
  });

  describe("calculateResponseTimeMetrics", () => {
    it("should calculate response time metrics correctly", () => {
      const responseTimes = [100, 150, 200, 250, 300, 350, 400, 450, 500, 1000];
      const result = engine.calculateResponseTimeMetrics(responseTimes);

      expect(result.min).toBe(100);
      expect(result.max).toBe(1000);
      expect(result.avg).toBe(370);
      expect(result.p50).toBe(325);
      expect(result.p90).toBeCloseTo(550, 0);
      expect(result.p95).toBeCloseTo(775, 0);
      expect(result.p99).toBeCloseTo(955, 0);
    });
  });

  describe("calculateThroughputMetrics", () => {
    it("should calculate throughput correctly", () => {
      const timestamps = [
        new Date("2023-01-01T00:00:00Z"),
        new Date("2023-01-01T00:00:01Z"),
        new Date("2023-01-01T00:00:02Z"),
        new Date("2023-01-01T00:00:03Z"),
        new Date("2023-01-01T00:00:04Z"),
      ];
      const responseSizes = [1000, 1500, 2000, 1200, 1800];

      const result = engine.calculateThroughputMetrics(
        timestamps,
        responseSizes
      );

      expect(result.requestsPerSecond).toBe(1.25); // 5 requests in 4 seconds
      expect(result.bytesPerSecond).toBe(1875); // 7500 bytes in 4 seconds
    });

    it("should handle empty timestamps", () => {
      const result = engine.calculateThroughputMetrics([]);

      expect(result.requestsPerSecond).toBe(0);
      expect(result.bytesPerSecond).toBe(0);
    });

    it("should handle single timestamp", () => {
      const timestamps = [new Date("2023-01-01T00:00:00Z")];
      const result = engine.calculateThroughputMetrics(timestamps);

      expect(result.requestsPerSecond).toBe(1);
      expect(result.bytesPerSecond).toBe(0);
    });
  });

  describe("calculateTrends", () => {
    it("should detect increasing trend", () => {
      const timeSeries: TimeSeriesData[] = [
        {
          timestamp: new Date("2023-01-01T00:00:00Z"),
          value: 100,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:01:00Z"),
          value: 120,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:02:00Z"),
          value: 140,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:03:00Z"),
          value: 160,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:04:00Z"),
          value: 180,
          metric: "response_time",
        },
      ];

      const result = engine.calculateTrends(timeSeries);

      expect(result.direction).toBe("increasing");
      expect(result.slope).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should detect decreasing trend", () => {
      const timeSeries: TimeSeriesData[] = [
        {
          timestamp: new Date("2023-01-01T00:00:00Z"),
          value: 200,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:01:00Z"),
          value: 180,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:02:00Z"),
          value: 160,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:03:00Z"),
          value: 140,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:04:00Z"),
          value: 120,
          metric: "response_time",
        },
      ];

      const result = engine.calculateTrends(timeSeries);

      expect(result.direction).toBe("decreasing");
      expect(result.slope).toBeLessThan(0);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should detect stable trend", () => {
      const timeSeries: TimeSeriesData[] = [
        {
          timestamp: new Date("2023-01-01T00:00:00Z"),
          value: 150,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:01:00Z"),
          value: 152,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:02:00Z"),
          value: 148,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:03:00Z"),
          value: 151,
          metric: "response_time",
        },
        {
          timestamp: new Date("2023-01-01T00:04:00Z"),
          value: 149,
          metric: "response_time",
        },
      ];

      const result = engine.calculateTrends(timeSeries);

      expect(result.direction).toBe("stable");
    });

    it("should handle insufficient data", () => {
      const timeSeries: TimeSeriesData[] = [
        {
          timestamp: new Date("2023-01-01T00:00:00Z"),
          value: 100,
          metric: "response_time",
        },
      ];

      const result = engine.calculateTrends(timeSeries);

      expect(result.direction).toBe("stable");
      expect(result.slope).toBe(0);
      expect(result.confidence).toBe(0);
    });
  });

  describe("identifyAnomalies", () => {
    it("should identify outliers in normal distribution", () => {
      const metrics = [100, 105, 98, 102, 99, 101, 103, 97, 500, 104]; // 500 is an outlier
      const anomalies = engine.identifyAnomalies(metrics);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].value).toBe(500);
      expect(anomalies[0].severity).toBe("high");
    });

    it("should handle data with no anomalies", () => {
      const metrics = [100, 105, 98, 102, 99, 101, 103, 97, 104, 106];
      const anomalies = engine.identifyAnomalies(metrics);

      expect(anomalies).toHaveLength(0);
    });

    it("should handle insufficient data", () => {
      const metrics = [100, 105];
      const anomalies = engine.identifyAnomalies(metrics);

      expect(anomalies).toHaveLength(0);
    });

    it("should use custom threshold", () => {
      const metrics = [100, 105, 98, 102, 99, 101, 103, 97, 150, 104]; // 150 is mild outlier
      const anomalies = engine.identifyAnomalies(metrics, 1.5); // Lower threshold

      expect(anomalies.length).toBeGreaterThan(0);
    });
  });

  describe("correlateMetrics", () => {
    it("should calculate positive correlation", () => {
      const metrics1 = [1, 2, 3, 4, 5];
      const metrics2 = [2, 4, 6, 8, 10];

      const correlation = engine.correlateMetrics(metrics1, metrics2);

      expect(correlation).toBeCloseTo(1, 2);
    });

    it("should calculate negative correlation", () => {
      const metrics1 = [1, 2, 3, 4, 5];
      const metrics2 = [10, 8, 6, 4, 2];

      const correlation = engine.correlateMetrics(metrics1, metrics2);

      expect(correlation).toBeCloseTo(-1, 2);
    });

    it("should calculate no correlation", () => {
      const metrics1 = [1, 2, 3, 4, 5];
      const metrics2 = [2, 5, 1, 3, 4]; // More random order

      const correlation = engine.correlateMetrics(metrics1, metrics2);

      expect(Math.abs(correlation)).toBeLessThan(0.5);
    });

    it("should handle mismatched array lengths", () => {
      const metrics1 = [1, 2, 3];
      const metrics2 = [1, 2];

      const correlation = engine.correlateMetrics(metrics1, metrics2);

      expect(correlation).toBe(0);
    });

    it("should handle empty arrays", () => {
      const correlation = engine.correlateMetrics([], []);

      expect(correlation).toBe(0);
    });
  });

  describe("detectPerformanceDegradation", () => {
    const baselineMetrics: PerformanceMetrics = {
      totalRequests: 1000,
      successfulRequests: 950,
      failedRequests: 50,
      responseTime: {
        min: 50,
        max: 500,
        avg: 150,
        p50: 140,
        p90: 250,
        p95: 300,
        p99: 450,
      },
      throughput: {
        requestsPerSecond: 100,
        bytesPerSecond: 50000,
      },
      errorRate: 0.05,
    };

    it("should detect response time degradation", () => {
      const currentMetrics: PerformanceMetrics = {
        ...baselineMetrics,
        responseTime: {
          ...baselineMetrics.responseTime,
          avg: 200, // 33% increase
        },
      };

      const result = engine.detectPerformanceDegradation(
        currentMetrics,
        baselineMetrics
      );

      expect(result.isDegraded).toBe(true);
      expect(
        result.issues.some((issue) => issue.includes("Response time increased"))
      ).toBe(true);
    });

    it("should detect error rate degradation", () => {
      const currentMetrics: PerformanceMetrics = {
        ...baselineMetrics,
        errorRate: 0.2, // Increased from 5% to 20%
      };

      const result = engine.detectPerformanceDegradation(
        currentMetrics,
        baselineMetrics
      );

      expect(result.isDegraded).toBe(true);
      expect(
        result.issues.some((issue) => issue.includes("Error rate increased"))
      ).toBe(true);
    });

    it("should detect throughput degradation", () => {
      const currentMetrics: PerformanceMetrics = {
        ...baselineMetrics,
        throughput: {
          ...baselineMetrics.throughput,
          requestsPerSecond: 80, // 20% decrease
        },
      };

      const result = engine.detectPerformanceDegradation(
        currentMetrics,
        baselineMetrics
      );

      expect(result.isDegraded).toBe(true);
      expect(
        result.issues.some((issue) => issue.includes("Throughput decreased"))
      ).toBe(true);
    });

    it("should detect no degradation for similar metrics", () => {
      const currentMetrics: PerformanceMetrics = {
        ...baselineMetrics,
        responseTime: {
          ...baselineMetrics.responseTime,
          avg: 160, // Only 6.7% increase, below 20% threshold
        },
      };

      const result = engine.detectPerformanceDegradation(
        currentMetrics,
        baselineMetrics
      );

      expect(result.isDegraded).toBe(false);
      expect(result.issues).toHaveLength(0);
    });

    it("should use custom thresholds", () => {
      const currentMetrics: PerformanceMetrics = {
        ...baselineMetrics,
        responseTime: {
          ...baselineMetrics.responseTime,
          avg: 165, // 10% increase
        },
      };

      const customThresholds = {
        responseTime: 0.05, // 5% threshold
        errorRate: 0.1,
        throughput: 0.15,
      };

      const result = engine.detectPerformanceDegradation(
        currentMetrics,
        baselineMetrics,
        customThresholds
      );

      expect(result.isDegraded).toBe(true);
      expect(
        result.issues.some((issue) => issue.includes("Response time increased"))
      ).toBe(true);
    });
  });
});

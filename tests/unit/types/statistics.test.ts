import { describe, it, expect } from "vitest";
import {
  calculatePercentile,
  calculateBasicStats,
  calculateResponseTimeMetrics,
  calculateThroughputMetrics,
  calculateErrorSummary,
  calculatePerformanceMetrics,
  calculateMovingAverage,
  calculateStandardDeviation,
  detectAnomalies,
  DataPoint,
} from "../../../src/types/statistics.js";

describe("Statistics Functions", () => {
  describe("calculatePercentile", () => {
    it("should calculate percentiles correctly", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      expect(calculatePercentile(values, 50)).toBeCloseTo(5.5, 2);
      expect(calculatePercentile(values, 90)).toBeCloseTo(9.1, 2);
      expect(calculatePercentile(values, 95)).toBeCloseTo(9.55, 2);
      expect(calculatePercentile(values, 99)).toBeCloseTo(9.91, 2);
    });

    it("should handle edge cases", () => {
      expect(calculatePercentile([], 50)).toBe(0);
      expect(calculatePercentile([5], 50)).toBe(5);
      expect(calculatePercentile([1, 2, 3], 0)).toBe(1);
      expect(calculatePercentile([1, 2, 3], 100)).toBe(3);
    });

    it("should handle exact percentile matches", () => {
      const values = [10, 20, 30, 40, 50];
      expect(calculatePercentile(values, 0)).toBe(10);
      expect(calculatePercentile(values, 25)).toBe(20);
      expect(calculatePercentile(values, 50)).toBe(30);
      expect(calculatePercentile(values, 75)).toBe(40);
      expect(calculatePercentile(values, 100)).toBe(50);
    });
  });

  describe("calculateBasicStats", () => {
    it("should calculate basic statistics correctly", () => {
      const values = [1, 2, 3, 4, 5];
      const stats = calculateBasicStats(values);

      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
      expect(stats.avg).toBe(3);
      expect(stats.sum).toBe(15);
      expect(stats.count).toBe(5);
    });

    it("should handle empty array", () => {
      const stats = calculateBasicStats([]);

      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.avg).toBe(0);
      expect(stats.sum).toBe(0);
      expect(stats.count).toBe(0);
    });

    it("should handle single value", () => {
      const stats = calculateBasicStats([42]);

      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.avg).toBe(42);
      expect(stats.sum).toBe(42);
      expect(stats.count).toBe(1);
    });
  });

  describe("calculateResponseTimeMetrics", () => {
    it("should calculate response time metrics correctly", () => {
      const dataPoints: DataPoint[] = [
        {
          timestamp: new Date(),
          responseTime: 100,
          statusCode: 200,
          bytes: 1024,
        },
        {
          timestamp: new Date(),
          responseTime: 150,
          statusCode: 200,
          bytes: 1024,
        },
        {
          timestamp: new Date(),
          responseTime: 200,
          statusCode: 200,
          bytes: 1024,
        },
        {
          timestamp: new Date(),
          responseTime: 250,
          statusCode: 200,
          bytes: 1024,
        },
        {
          timestamp: new Date(),
          responseTime: 300,
          statusCode: 200,
          bytes: 1024,
        },
      ];

      const metrics = calculateResponseTimeMetrics(dataPoints);

      expect(metrics.min).toBe(100);
      expect(metrics.max).toBe(300);
      expect(metrics.avg).toBe(200);
      expect(metrics.p50).toBe(200);
      expect(metrics.p90).toBe(280);
      expect(metrics.p95).toBe(290);
      expect(metrics.p99).toBeCloseTo(298, 0);
    });

    it("should handle empty data points", () => {
      const metrics = calculateResponseTimeMetrics([]);

      expect(metrics.min).toBe(0);
      expect(metrics.max).toBe(0);
      expect(metrics.avg).toBe(0);
      expect(metrics.p50).toBe(0);
      expect(metrics.p90).toBe(0);
      expect(metrics.p95).toBe(0);
      expect(metrics.p99).toBe(0);
    });
  });

  describe("calculateThroughputMetrics", () => {
    it("should calculate throughput metrics correctly", () => {
      const dataPoints: DataPoint[] = [
        {
          timestamp: new Date(),
          responseTime: 100,
          statusCode: 200,
          bytes: 1000,
        },
        {
          timestamp: new Date(),
          responseTime: 150,
          statusCode: 200,
          bytes: 1500,
        },
        {
          timestamp: new Date(),
          responseTime: 200,
          statusCode: 200,
          bytes: 2000,
        },
      ];

      const metrics = calculateThroughputMetrics(dataPoints, 10); // 10 seconds

      expect(metrics.requestsPerSecond).toBe(0.3); // 3 requests / 10 seconds
      expect(metrics.bytesPerSecond).toBe(450); // 4500 bytes / 10 seconds
    });

    it("should handle zero duration", () => {
      const dataPoints: DataPoint[] = [
        {
          timestamp: new Date(),
          responseTime: 100,
          statusCode: 200,
          bytes: 1000,
        },
      ];

      const metrics = calculateThroughputMetrics(dataPoints, 0);

      expect(metrics.requestsPerSecond).toBe(0);
      expect(metrics.bytesPerSecond).toBe(0);
    });

    it("should handle empty data points", () => {
      const metrics = calculateThroughputMetrics([], 10);

      expect(metrics.requestsPerSecond).toBe(0);
      expect(metrics.bytesPerSecond).toBe(0);
    });
  });

  describe("calculateErrorSummary", () => {
    it("should calculate error summary correctly", () => {
      const now = new Date();
      const later = new Date(now.getTime() + 1000);

      const dataPoints: DataPoint[] = [
        { timestamp: now, responseTime: 100, statusCode: 200, bytes: 1000 },
        { timestamp: now, responseTime: 150, statusCode: 404, bytes: 500 },
        { timestamp: later, responseTime: 200, statusCode: 404, bytes: 500 },
        {
          timestamp: later,
          responseTime: 250,
          statusCode: 500,
          bytes: 200,
          error: "Server Error",
        },
      ];

      const errorSummary = calculateErrorSummary(dataPoints);

      expect(errorSummary).toHaveLength(2);

      // Should be sorted by count descending
      expect(errorSummary[0].errorType).toBe("HTTP 404");
      expect(errorSummary[0].count).toBe(2);
      expect(errorSummary[0].percentage).toBe(50); // 2/4 * 100

      expect(errorSummary[1].errorType).toBe("Server Error");
      expect(errorSummary[1].count).toBe(1);
      expect(errorSummary[1].percentage).toBe(25); // 1/4 * 100
    });

    it("should handle no errors", () => {
      const dataPoints: DataPoint[] = [
        {
          timestamp: new Date(),
          responseTime: 100,
          statusCode: 200,
          bytes: 1000,
        },
        {
          timestamp: new Date(),
          responseTime: 150,
          statusCode: 201,
          bytes: 1000,
        },
      ];

      const errorSummary = calculateErrorSummary(dataPoints);

      expect(errorSummary).toHaveLength(0);
    });
  });

  describe("calculatePerformanceMetrics", () => {
    it("should calculate complete performance metrics", () => {
      const dataPoints: DataPoint[] = [
        {
          timestamp: new Date(),
          responseTime: 100,
          statusCode: 200,
          bytes: 1000,
        },
        {
          timestamp: new Date(),
          responseTime: 150,
          statusCode: 200,
          bytes: 1500,
        },
        {
          timestamp: new Date(),
          responseTime: 200,
          statusCode: 404,
          bytes: 500,
        },
        {
          timestamp: new Date(),
          responseTime: 250,
          statusCode: 500,
          bytes: 200,
        },
      ];

      const metrics = calculatePerformanceMetrics(dataPoints, 10);

      expect(metrics.totalRequests).toBe(4);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(2);
      expect(metrics.errorRate).toBe(50);
      expect(metrics.responseTime.avg).toBe(175);
      expect(metrics.throughput.requestsPerSecond).toBe(0.4);
    });
  });

  describe("calculateMovingAverage", () => {
    it("should calculate moving average correctly", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const movingAvg = calculateMovingAverage(values, 3);

      expect(movingAvg).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("should handle edge cases", () => {
      expect(calculateMovingAverage([1, 2, 3], 0)).toEqual([1, 2, 3]);
      expect(calculateMovingAverage([1, 2, 3], 5)).toEqual([1, 2, 3]);
      expect(calculateMovingAverage([1, 2, 3], 1)).toEqual([1, 2, 3]);
    });
  });

  describe("calculateStandardDeviation", () => {
    it("should calculate standard deviation correctly", () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdDev = calculateStandardDeviation(values);

      expect(stdDev).toBeCloseTo(2.14, 2);
    });

    it("should handle edge cases", () => {
      expect(calculateStandardDeviation([])).toBe(0);
      expect(calculateStandardDeviation([5])).toBe(0);
      expect(calculateStandardDeviation([5, 5, 5])).toBe(0);
    });
  });

  describe("detectAnomalies", () => {
    it("should detect anomalies correctly", () => {
      const values = [1, 2, 3, 4, 5, 100]; // 100 is clearly an anomaly
      const result = detectAnomalies(values, 2);

      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].index).toBe(5);
      expect(result.anomalies[0].value).toBe(100);
      expect(result.anomalies[0].zScore).toBeGreaterThan(2);
    });

    it("should handle no anomalies", () => {
      const values = [1, 2, 3, 4, 5];
      const result = detectAnomalies(values, 2);

      expect(result.anomalies).toHaveLength(0);
    });

    it("should handle insufficient data", () => {
      const result = detectAnomalies([1, 2], 2);

      expect(result.anomalies).toHaveLength(0);
      expect(result.mean).toBe(0);
      expect(result.standardDeviation).toBe(0);
    });
  });
});

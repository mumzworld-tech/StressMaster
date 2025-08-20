import {
  RawResults,
  AnalyzedResults,
  ExportFormat,
  PerformanceInsight,
  Bottleneck,
  PerformanceTrend,
  TestResult,
  LoadTestSpec,
  PerformanceMetrics,
  TestStatus,
  ResponseTimeMetrics,
} from "../../types";
// Statistical engine functionality consolidated into this file
import { AIAnalysisEngine, AnalyzerConfig } from "./ai-analyzer";

export interface ResultsAnalyzer {
  analyzeResults(rawResults: RawResults): Promise<AnalyzedResults>;
  generateRecommendations(results: AnalyzedResults): Promise<string[]>;
  exportReport(results: AnalyzedResults, format: ExportFormat): string;
}

export class AIResultsAnalyzer implements ResultsAnalyzer {
  private statisticalEngine: StatisticalEngine;
  private aiEngine: AIAnalysisEngine;
  private config: AnalyzerConfig;

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.statisticalEngine = new StatisticalEngine();
    this.aiEngine = new AIAnalysisEngine(config);
  }

  async analyzeResults(rawResults: RawResults): Promise<AnalyzedResults> {
    // For now, we'll need to construct a TestResult from RawResults
    // In a real implementation, this would be passed in or constructed elsewhere
    const testResult: TestResult = {
      id: `test_${Date.now()}`,
      spec: {} as LoadTestSpec, // This would be provided
      startTime: new Date(),
      endTime: new Date(),
      status: "completed" as TestStatus,
      metrics: {} as PerformanceMetrics, // This would be calculated from rawResults
      errors: [],
      recommendations: [],
      rawData: rawResults,
    };

    // Generate performance insights
    const performanceInsights = this.generatePerformanceInsights(testResult);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(testResult);

    // Calculate trends (if historical data is available)
    const trends = this.calculatePerformanceTrends(testResult);

    return {
      testResult,
      performanceInsights,
      bottlenecks,
      trends,
    };
  }

  async generateRecommendations(results: AnalyzedResults): Promise<string[]> {
    const recommendations: string[] = [];

    // Generate rule-based recommendations
    const ruleBasedRecommendations =
      this.generateRuleBasedRecommendations(results);
    recommendations.push(...ruleBasedRecommendations);

    // Generate AI-powered recommendations
    try {
      const aiRecommendations = await this.aiEngine.generateAIRecommendations(
        results
      );
      recommendations.push(...aiRecommendations);
    } catch (error) {
      console.warn(
        "Failed to generate AI recommendations, falling back to rule-based only:",
        error
      );
    }

    return recommendations;
  }

  exportReport(results: AnalyzedResults, format: ExportFormat): string {
    const { ReportGeneratorImpl } = require("./report-generator");
    const generator = new ReportGeneratorImpl();

    switch (format) {
      case "json":
        return generator.generateJsonReport(results);
      case "csv":
        return generator.generateCsvReport(results);
      case "html":
        return generator.generateHtmlReport(results);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // AI template initialization moved to ai-analyzer.ts

  private generatePerformanceInsights(testResult: any): PerformanceInsight[] {
    const insights: PerformanceInsight[] = [];
    const metrics = testResult.metrics;

    // Response time insights
    if (metrics.responseTime.avg > this.config.thresholds.responseTime.poor) {
      insights.push({
        category: "response_time",
        severity: "critical",
        message: `Average response time (${metrics.responseTime.avg}ms) exceeds acceptable threshold (${this.config.thresholds.responseTime.poor}ms)`,
        recommendation:
          "Consider optimizing database queries, implementing caching, or scaling infrastructure",
      });
    } else if (
      metrics.responseTime.avg > this.config.thresholds.responseTime.acceptable
    ) {
      insights.push({
        category: "response_time",
        severity: "warning",
        message: `Average response time (${metrics.responseTime.avg}ms) is above optimal threshold (${this.config.thresholds.responseTime.acceptable}ms)`,
        recommendation:
          "Monitor response time trends and consider performance optimizations",
      });
    }

    // Error rate insights
    if (metrics.errorRate > this.config.thresholds.errorRate.poor) {
      insights.push({
        category: "error_rate",
        severity: "critical",
        message: `Error rate (${(metrics.errorRate * 100).toFixed(
          1
        )}%) is critically high`,
        recommendation:
          "Investigate error logs immediately and implement error handling improvements",
      });
    } else if (
      metrics.errorRate > this.config.thresholds.errorRate.acceptable
    ) {
      insights.push({
        category: "error_rate",
        severity: "warning",
        message: `Error rate (${(metrics.errorRate * 100).toFixed(
          1
        )}%) is above acceptable threshold`,
        recommendation:
          "Review error patterns and implement preventive measures",
      });
    }

    // Throughput insights
    if (
      metrics.throughput.requestsPerSecond <
      this.config.thresholds.throughput.minimum
    ) {
      insights.push({
        category: "throughput",
        severity: "critical",
        message: `Throughput (${metrics.throughput.requestsPerSecond} RPS) is below minimum requirement (${this.config.thresholds.throughput.minimum} RPS)`,
        recommendation:
          "Scale infrastructure or optimize application performance to meet throughput requirements",
      });
    } else if (
      metrics.throughput.requestsPerSecond <
      this.config.thresholds.throughput.target
    ) {
      insights.push({
        category: "throughput",
        severity: "warning",
        message: `Throughput (${metrics.throughput.requestsPerSecond} RPS) is below target (${this.config.thresholds.throughput.target} RPS)`,
        recommendation:
          "Consider performance optimizations to reach target throughput",
      });
    }

    return insights;
  }

  private identifyBottlenecks(testResult: any): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const metrics = testResult.metrics;

    // High response time with low error rate suggests server-side bottleneck
    if (
      metrics.responseTime.avg >
        this.config.thresholds.responseTime.acceptable &&
      metrics.errorRate < this.config.thresholds.errorRate.acceptable
    ) {
      bottlenecks.push({
        component: "server",
        description:
          "High response times with low error rates indicate server-side processing bottlenecks",
        impact: "high",
        suggestedFix:
          "Profile application code, optimize database queries, or increase server resources",
      });
    }

    // High error rate suggests application or infrastructure issues
    if (metrics.errorRate > this.config.thresholds.errorRate.poor) {
      bottlenecks.push({
        component: "server",
        description:
          "High error rate indicates application stability or infrastructure capacity issues",
        impact: "high",
        suggestedFix:
          "Review error logs, fix application bugs, or scale infrastructure capacity",
      });
    }

    // Low throughput with acceptable response times suggests client-side limitations
    if (
      metrics.throughput.requestsPerSecond <
        this.config.thresholds.throughput.minimum &&
      metrics.responseTime.avg <= this.config.thresholds.responseTime.acceptable
    ) {
      bottlenecks.push({
        component: "client",
        description:
          "Low throughput with good response times may indicate client-side limitations",
        impact: "medium",
        suggestedFix:
          "Increase concurrent connections, optimize client configuration, or review load generation setup",
      });
    }

    // Very high 99th percentile compared to average suggests inconsistent performance
    if (metrics.responseTime.p99 > metrics.responseTime.avg * 3) {
      bottlenecks.push({
        component: "server",
        description:
          "Large gap between average and 99th percentile response times indicates inconsistent performance",
        impact: "medium",
        suggestedFix:
          "Investigate performance outliers, optimize resource allocation, or implement request queuing",
      });
    }

    return bottlenecks;
  }

  private calculatePerformanceTrends(testResult: any): PerformanceTrend[] {
    // For now, return empty array as we don't have historical data
    // In a real implementation, this would compare against previous test results
    return [];
  }

  private generateRuleBasedRecommendations(results: AnalyzedResults): string[] {
    const recommendations: string[] = [];
    const metrics = results.testResult.metrics;

    // Response time recommendations
    if (metrics.responseTime.avg > this.config.thresholds.responseTime.poor) {
      recommendations.push(
        "Critical: Implement response time optimizations - consider database indexing, query optimization, and caching strategies"
      );
    }

    // Error rate recommendations
    if (metrics.errorRate > this.config.thresholds.errorRate.poor) {
      recommendations.push(
        "Critical: Address high error rate - review application logs, implement proper error handling, and ensure adequate infrastructure capacity"
      );
    }

    // Throughput recommendations
    if (
      metrics.throughput.requestsPerSecond <
      this.config.thresholds.throughput.minimum
    ) {
      recommendations.push(
        "Critical: Scale infrastructure to meet minimum throughput requirements - consider horizontal scaling, load balancing, or performance optimizations"
      );
    }

    // Bottleneck-specific recommendations
    results.bottlenecks.forEach((bottleneck) => {
      if (bottleneck.impact === "high") {
        recommendations.push(
          `High Impact: ${bottleneck.description} - ${bottleneck.suggestedFix}`
        );
      }
    });

    return recommendations;
  }

  // AI-related methods moved to ai-analyzer.ts
}

// Interfaces moved to ai-analyzer.ts

// ReportGenerator interface moved to report-generator.ts

export interface StatisticalAnalysis {
  calculatePercentiles(values: number[]): Record<string, number>;
  calculateTrends(timeSeries: TimeSeriesData[]): TrendAnalysis;
  identifyAnomalies(metrics: number[]): Anomaly[];
  correlateMetrics(metrics1: number[], metrics2: number[]): number;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metric: string;
}

export interface TrendAnalysis {
  direction: "increasing" | "decreasing" | "stable";
  slope: number;
  confidence: number;
  seasonality?: SeasonalPattern;
}

export interface SeasonalPattern {
  period: number;
  amplitude: number;
  phase: number;
}

export interface Anomaly {
  timestamp: Date;
  value: number;
  expectedValue: number;
  severity: "low" | "medium" | "high";
  description: string;
}

// ReportGeneratorImpl class moved to report-generator.ts

/**
 * Consolidated Statistical Engine for performance analysis
 */
export class StatisticalEngine {
  /**
   * Calculate percentiles for a given array of values
   */
  calculatePercentiles(values: number[]): Record<string, number> {
    if (values.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    return {
      min: sorted[0],
      max: sorted[n - 1],
      avg: this.calculateMean(values),
      p50: this.getPercentile(sorted, 50),
      p90: this.getPercentile(sorted, 90),
      p95: this.getPercentile(sorted, 95),
      p99: this.getPercentile(sorted, 99),
    };
  }

  /**
   * Calculate response time metrics from raw response time data
   */
  calculateResponseTimeMetrics(responseTimes: number[]): ResponseTimeMetrics {
    const percentiles = this.calculatePercentiles(responseTimes);

    return {
      min: percentiles.min,
      max: percentiles.max,
      avg: percentiles.avg,
      p50: percentiles.p50,
      p90: percentiles.p90,
      p95: percentiles.p95,
      p99: percentiles.p99,
    };
  }

  /**
   * Calculate throughput metrics from request timestamps
   */
  calculateThroughputMetrics(
    requestTimestamps: Date[],
    responseSizes: number[] = []
  ): { requestsPerSecond: number; bytesPerSecond: number } {
    if (requestTimestamps.length === 0) {
      return { requestsPerSecond: 0, bytesPerSecond: 0 };
    }

    const startTime = Math.min(...requestTimestamps.map((t) => t.getTime()));
    const endTime = Math.max(...requestTimestamps.map((t) => t.getTime()));
    const durationSeconds = (endTime - startTime) / 1000;

    if (durationSeconds === 0) {
      return { requestsPerSecond: requestTimestamps.length, bytesPerSecond: 0 };
    }

    const requestsPerSecond = requestTimestamps.length / durationSeconds;
    const totalBytes = responseSizes.reduce((sum, size) => sum + size, 0);
    const bytesPerSecond = totalBytes / durationSeconds;

    return { requestsPerSecond, bytesPerSecond };
  }

  /**
   * Analyze trends in time series data
   */
  calculateTrends(timeSeries: TimeSeriesData[]): TrendAnalysis {
    if (timeSeries.length < 2) {
      return {
        direction: "stable",
        slope: 0,
        confidence: 0,
      };
    }

    const sortedData = timeSeries.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    const { slope, rSquared } = this.calculateLinearRegression(sortedData);

    const direction = this.determineTrendDirection(slope, rSquared);
    const seasonality = this.detectSeasonality(sortedData);

    return {
      direction,
      slope,
      confidence: rSquared,
      seasonality,
    };
  }

  /**
   * Identify anomalies in metric data using statistical methods
   */
  identifyAnomalies(metrics: number[], threshold: number = 2.5): Anomaly[] {
    if (metrics.length < 3) return [];

    const mean = this.calculateMean(metrics);
    const stdDev = this.calculateStandardDeviation(metrics);
    const anomalies: Anomaly[] = [];

    metrics.forEach((value, index) => {
      const zScore = Math.abs((value - mean) / stdDev);

      if (zScore > threshold) {
        const severity = this.determineSeverity(zScore, threshold);

        anomalies.push({
          timestamp: new Date(Date.now() + index * 1000), // Approximate timestamp
          value,
          expectedValue: mean,
          severity,
          description: `Value ${value.toFixed(
            2
          )} deviates significantly from expected ${mean.toFixed(
            2
          )} (z-score: ${zScore.toFixed(2)})`,
        });
      }
    });

    return anomalies;
  }

  /**
   * Calculate correlation coefficient between two metric arrays
   */
  correlateMetrics(metrics1: number[], metrics2: number[]): number {
    if (metrics1.length !== metrics2.length || metrics1.length === 0) {
      return 0;
    }

    const mean1 = this.calculateMean(metrics1);
    const mean2 = this.calculateMean(metrics2);

    let numerator = 0;
    let sumSquares1 = 0;
    let sumSquares2 = 0;

    for (let i = 0; i < metrics1.length; i++) {
      const diff1 = metrics1[i] - mean1;
      const diff2 = metrics2[i] - mean2;

      numerator += diff1 * diff2;
      sumSquares1 += diff1 * diff1;
      sumSquares2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSquares1 * sumSquares2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Detect performance degradation by comparing current metrics to baseline
   */
  detectPerformanceDegradation(
    currentMetrics: PerformanceMetrics,
    baselineMetrics: PerformanceMetrics,
    thresholds: {
      responseTime: number;
      errorRate: number;
      throughput: number;
    } = {
      responseTime: 0.2, // 20% increase
      errorRate: 0.1, // 10% increase
      throughput: 0.15, // 15% decrease
    }
  ): { isDegraded: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check response time degradation
    const responseTimeDegradation =
      (currentMetrics.responseTime.avg - baselineMetrics.responseTime.avg) /
      baselineMetrics.responseTime.avg;
    if (responseTimeDegradation > thresholds.responseTime) {
      issues.push(
        `Response time increased by ${(responseTimeDegradation * 100).toFixed(
          1
        )}%`
      );
    }

    // Check error rate degradation
    const errorRateDegradation =
      currentMetrics.errorRate - baselineMetrics.errorRate;
    if (errorRateDegradation > thresholds.errorRate) {
      issues.push(
        `Error rate increased by ${(errorRateDegradation * 100).toFixed(
          1
        )} percentage points`
      );
    }

    // Check throughput degradation
    const throughputDegradation =
      (baselineMetrics.throughput.requestsPerSecond -
        currentMetrics.throughput.requestsPerSecond) /
      baselineMetrics.throughput.requestsPerSecond;
    if (throughputDegradation > thresholds.throughput) {
      issues.push(
        `Throughput decreased by ${(throughputDegradation * 100).toFixed(1)}%`
      );
    }

    return {
      isDegraded: issues.length > 0,
      issues,
    };
  }

  // Private helper methods

  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private calculateMean(values: number[]): number {
    return values.length === 0
      ? 0
      : values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = this.calculateMean(squaredDiffs);
    return Math.sqrt(variance);
  }

  private calculateLinearRegression(data: TimeSeriesData[]): {
    slope: number;
    rSquared: number;
  } {
    const n = data.length;
    const xValues = data.map((_, i) => i); // Use index as x-value for simplicity
    const yValues = data.map((d) => d.value);

    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const totalSumSquares = yValues.reduce(
      (sum, y) => sum + Math.pow(y - yMean, 2),
      0
    );
    const residualSumSquares = yValues.reduce((sum, y, i) => {
      const predicted = slope * xValues[i] + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);

    const rSquared =
      totalSumSquares === 0 ? 1 : 1 - residualSumSquares / totalSumSquares;

    return { slope, rSquared: Math.max(0, Math.min(1, rSquared)) };
  }

  private determineTrendDirection(
    slope: number,
    confidence: number
  ): "increasing" | "decreasing" | "stable" {
    const minConfidence = 0.3; // Minimum confidence threshold

    if (confidence < minConfidence) {
      return "stable";
    }

    const slopeThreshold = 0.01; // Minimum slope to consider significant

    if (Math.abs(slope) < slopeThreshold) {
      return "stable";
    }

    return slope > 0 ? "increasing" : "decreasing";
  }

  private detectSeasonality(
    data: TimeSeriesData[]
  ): SeasonalPattern | undefined {
    // Simple seasonality detection - could be enhanced with FFT or autocorrelation
    if (data.length < 10) return undefined;

    // Look for repeating patterns in the data
    const values = data.map((d) => d.value);
    const mean = this.calculateMean(values);

    // Check for potential periods (2 to data.length/3)
    let bestPeriod = 0;
    let bestCorrelation = 0;

    for (let period = 2; period <= Math.floor(data.length / 3); period++) {
      const correlation = this.calculatePeriodicCorrelation(values, period);
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    if (bestCorrelation > 0.5) {
      // Threshold for significant seasonality
      const amplitude = this.calculateAmplitude(values, bestPeriod);
      return {
        period: bestPeriod,
        amplitude,
        phase: 0, // Simplified - could calculate actual phase
      };
    }

    return undefined;
  }

  private calculatePeriodicCorrelation(
    values: number[],
    period: number
  ): number {
    if (values.length < period * 2) return 0;

    const cycles = Math.floor(values.length / period);
    let totalCorrelation = 0;

    for (let cycle = 1; cycle < cycles; cycle++) {
      const segment1 = values.slice(0, period);
      const segment2 = values.slice(cycle * period, (cycle + 1) * period);

      if (segment2.length === period) {
        totalCorrelation += Math.abs(this.correlateMetrics(segment1, segment2));
      }
    }

    return cycles > 1 ? totalCorrelation / (cycles - 1) : 0;
  }

  private calculateAmplitude(values: number[], period: number): number {
    const mean = this.calculateMean(values);
    let maxDeviation = 0;

    for (let i = 0; i < values.length; i++) {
      maxDeviation = Math.max(maxDeviation, Math.abs(values[i] - mean));
    }

    return maxDeviation;
  }

  private determineSeverity(
    zScore: number,
    threshold: number
  ): "low" | "medium" | "high" {
    if (zScore > threshold * 1.1) return "high";
    if (zScore > threshold * 1.05) return "medium";
    return "low";
  }
}

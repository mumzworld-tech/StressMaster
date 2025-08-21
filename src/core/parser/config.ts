/**
 * Unified configuration, monitoring, and diagnostics system for the parser module
 */

// ============================================================================
// Configuration Interfaces and Types
// ============================================================================

export interface ParserConfig {
  preprocessing: {
    enableSanitization: boolean;
    enableStructureExtraction: boolean;
    maxInputLength: number;
    normalizeWhitespace: boolean;
    separateRequests: boolean;
  };
  formatDetection: {
    confidenceThreshold: number;
    enableMultiFormatDetection: boolean;
    enablePatternMatching: boolean;
  };
  contextEnhancement: {
    enableInference: boolean;
    enableAmbiguityResolution: boolean;
    maxAmbiguities: number;
    inferenceConfidenceThreshold: number;
  };
  aiProvider: {
    maxRetries: number;
    temperature: number;
    enableValidationRetries: boolean;
    timeoutMs: number;
  };
  fallback: {
    enableSmartFallback: boolean;
    fallbackConfidenceThreshold: number;
    maxFallbackAttempts: number;
  };
  monitoring: {
    enableMetrics: boolean;
    enableDiagnostics: boolean;
    logLevel: "debug" | "info" | "warn" | "error";
    metricsRetentionMs: number;
  };
}

// ============================================================================
// Metrics and Diagnostics Interfaces
// ============================================================================

export interface ParsingMetrics {
  totalRequests: number;
  successfulParses: number;
  failedParses: number;
  fallbackUsed: number;
  averageResponseTime: number;
  averageConfidence: number;
  errorsByType: Record<string, number>;
  formatDetectionAccuracy: number;
  retryCount: number;
}

export interface ParseAttempt {
  id: string;
  timestamp: number;
  inputLength: number;
  detectedFormat: string;
  confidence: number;
  responseTimeMs: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  usedFallback: boolean;
  retryCount: number;
  assumptions: number;
  warnings: number;
}

export interface DiagnosticInfo {
  parseAttemptId: string;
  timestamp: number;
  stage:
    | "preprocessing"
    | "format_detection"
    | "context_enhancement"
    | "ai_parsing"
    | "validation"
    | "fallback";
  details: Record<string, any>;
  duration: number;
  success: boolean;
  error?: string;
}

export interface DiagnosticReport {
  summary: {
    totalAttempts: number;
    successRate: number;
    averageResponseTime: number;
    mostCommonErrors: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    performanceByStage: Array<{
      stage: string;
      averageDuration: number;
      successRate: number;
    }>;
  };
  recommendations: string[];
  configSuggestions: Partial<ParserConfig>;
  detailedAnalysis: {
    slowestAttempts: ParseAttempt[];
    failedAttempts: ParseAttempt[];
    fallbackUsage: {
      frequency: number;
      successRate: number;
      commonTriggers: string[];
    };
  };
}

export interface DebugSession {
  id: string;
  startTime: number;
  endTime?: number;
  parseAttempts: string[];
  notes: string[];
  tags: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PARSER_CONFIG: ParserConfig = {
  preprocessing: {
    enableSanitization: true,
    enableStructureExtraction: true,
    maxInputLength: 10000,
    normalizeWhitespace: true,
    separateRequests: true,
  },
  formatDetection: {
    confidenceThreshold: 0.7,
    enableMultiFormatDetection: true,
    enablePatternMatching: true,
  },
  contextEnhancement: {
    enableInference: true,
    enableAmbiguityResolution: true,
    maxAmbiguities: 5,
    inferenceConfidenceThreshold: 0.6,
  },
  aiProvider: {
    maxRetries: 3,
    temperature: 0.1,
    enableValidationRetries: true,
    timeoutMs: 30000,
  },
  fallback: {
    enableSmartFallback: true,
    fallbackConfidenceThreshold: 0.5,
    maxFallbackAttempts: 2,
  },
  monitoring: {
    enableMetrics: true,
    enableDiagnostics: false,
    logLevel: "info",
    metricsRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
  },
};

// ============================================================================
// Configuration Manager
// ============================================================================

export class ParserConfigManager {
  private config: ParserConfig;

  constructor(config?: Partial<ParserConfig>) {
    this.config = this.mergeConfig(DEFAULT_PARSER_CONFIG, config || {});
  }

  /**
   * Get the current configuration
   */
  getConfig(): ParserConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Update configuration with partial config
   */
  updateConfig(partialConfig: Partial<ParserConfig>): void {
    this.config = this.mergeConfig(this.config, partialConfig);
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_PARSER_CONFIG };
  }

  /**
   * Validate configuration values
   */
  validateConfig(config: ParserConfig): string[] {
    const errors: string[] = [];

    if (config.preprocessing.maxInputLength <= 0) {
      errors.push("preprocessing.maxInputLength must be greater than 0");
    }

    if (
      config.formatDetection.confidenceThreshold < 0 ||
      config.formatDetection.confidenceThreshold > 1
    ) {
      errors.push(
        "formatDetection.confidenceThreshold must be between 0 and 1"
      );
    }

    if (config.contextEnhancement.maxAmbiguities < 0) {
      errors.push("contextEnhancement.maxAmbiguities must be non-negative");
    }

    if (config.aiProvider.maxRetries < 0) {
      errors.push("aiProvider.maxRetries must be non-negative");
    }

    if (
      config.aiProvider.temperature < 0 ||
      config.aiProvider.temperature > 2
    ) {
      errors.push("aiProvider.temperature must be between 0 and 2");
    }

    if (config.aiProvider.timeoutMs <= 0) {
      errors.push("aiProvider.timeoutMs must be greater than 0");
    }

    if (
      config.fallback.fallbackConfidenceThreshold < 0 ||
      config.fallback.fallbackConfidenceThreshold > 1
    ) {
      errors.push(
        "fallback.fallbackConfidenceThreshold must be between 0 and 1"
      );
    }

    if (config.monitoring.metricsRetentionMs <= 0) {
      errors.push("monitoring.metricsRetentionMs must be greater than 0");
    }

    return errors;
  }

  private mergeConfig(
    base: ParserConfig,
    override: Partial<ParserConfig>
  ): ParserConfig {
    return {
      preprocessing: { ...base.preprocessing, ...override.preprocessing },
      formatDetection: { ...base.formatDetection, ...override.formatDetection },
      contextEnhancement: {
        ...base.contextEnhancement,
        ...override.contextEnhancement,
      },
      aiProvider: { ...base.aiProvider, ...override.aiProvider },
      fallback: { ...base.fallback, ...override.fallback },
      monitoring: { ...base.monitoring, ...override.monitoring },
    };
  }
}

// ============================================================================
// Metrics Collector
// ============================================================================

export class ParsingMetricsCollector {
  private metrics: ParsingMetrics;
  private parseAttempts: ParseAttempt[] = [];
  private diagnostics: DiagnosticInfo[] = [];
  private retentionMs: number;

  constructor(retentionMs: number = 24 * 60 * 60 * 1000) {
    this.retentionMs = retentionMs;
    this.metrics = this.initializeMetrics();
  }

  /**
   * Record a parsing attempt
   */
  recordParseAttempt(attempt: ParseAttempt): void {
    this.parseAttempts.push(attempt);
    this.updateMetrics(attempt);
    this.cleanupOldData();
  }

  /**
   * Record diagnostic information
   */
  recordDiagnostic(diagnostic: DiagnosticInfo): void {
    this.diagnostics.push(diagnostic);
    this.cleanupOldData();
  }

  /**
   * Get current metrics
   */
  getMetrics(): ParsingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get parsing attempts within time range
   */
  getParseAttempts(
    fromTimestamp?: number,
    toTimestamp?: number
  ): ParseAttempt[] {
    let attempts = [...this.parseAttempts];

    if (fromTimestamp) {
      attempts = attempts.filter((a) => a.timestamp >= fromTimestamp);
    }

    if (toTimestamp) {
      attempts = attempts.filter((a) => a.timestamp <= toTimestamp);
    }

    return attempts;
  }

  /**
   * Get diagnostic information for a specific parse attempt
   */
  getDiagnostics(parseAttemptId: string): DiagnosticInfo[] {
    return this.diagnostics.filter((d) => d.parseAttemptId === parseAttemptId);
  }

  /**
   * Get aggregated metrics for a time period
   */
  getAggregatedMetrics(
    fromTimestamp: number,
    toTimestamp: number
  ): ParsingMetrics {
    const attempts = this.getParseAttempts(fromTimestamp, toTimestamp);
    return this.calculateMetrics(attempts);
  }

  /**
   * Reset all metrics and data
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.parseAttempts = [];
    this.diagnostics = [];
  }

  /**
   * Export metrics data for analysis
   */
  exportData(): {
    metrics: ParsingMetrics;
    attempts: ParseAttempt[];
    diagnostics: DiagnosticInfo[];
  } {
    return {
      metrics: this.getMetrics(),
      attempts: [...this.parseAttempts],
      diagnostics: [...this.diagnostics],
    };
  }

  private initializeMetrics(): ParsingMetrics {
    return {
      totalRequests: 0,
      successfulParses: 0,
      failedParses: 0,
      fallbackUsed: 0,
      averageResponseTime: 0,
      averageConfidence: 0,
      errorsByType: {},
      formatDetectionAccuracy: 0,
      retryCount: 0,
    };
  }

  private updateMetrics(attempt: ParseAttempt): void {
    this.metrics = this.calculateMetrics(this.parseAttempts);
  }

  private calculateMetrics(attempts: ParseAttempt[]): ParsingMetrics {
    if (attempts.length === 0) {
      return this.initializeMetrics();
    }

    const successful = attempts.filter((a) => a.success);
    const failed = attempts.filter((a) => !a.success);
    const fallbackUsed = attempts.filter((a) => a.usedFallback);

    const totalResponseTime = attempts.reduce(
      (sum, a) => sum + a.responseTimeMs,
      0
    );
    const totalConfidence = successful.reduce(
      (sum, a) => sum + a.confidence,
      0
    );
    const totalRetries = attempts.reduce((sum, a) => sum + a.retryCount, 0);

    const errorsByType: Record<string, number> = {};
    failed.forEach((attempt) => {
      if (attempt.errorType) {
        errorsByType[attempt.errorType] =
          (errorsByType[attempt.errorType] || 0) + 1;
      }
    });

    return {
      totalRequests: attempts.length,
      successfulParses: successful.length,
      failedParses: failed.length,
      fallbackUsed: fallbackUsed.length,
      averageResponseTime: totalResponseTime / attempts.length,
      averageConfidence:
        successful.length > 0 ? totalConfidence / successful.length : 0,
      errorsByType,
      formatDetectionAccuracy: successful.length / attempts.length,
      retryCount: totalRetries,
    };
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.retentionMs;

    this.parseAttempts = this.parseAttempts.filter(
      (a) => a.timestamp > cutoffTime
    );
    this.diagnostics = this.diagnostics.filter((d) => d.timestamp > cutoffTime);
  }
}

// ============================================================================
// Performance Monitor
// ============================================================================

export class ParsingPerformanceMonitor {
  private activeOperations: Map<string, { stage: string; startTime: number }> =
    new Map();
  private metricsCollector: ParsingMetricsCollector;

  constructor(metricsCollector: ParsingMetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Start monitoring a parsing operation stage
   */
  startStage(parseAttemptId: string, stage: DiagnosticInfo["stage"]): void {
    const key = `${parseAttemptId}:${stage}`;
    this.activeOperations.set(key, {
      stage,
      startTime: Date.now(),
    });
  }

  /**
   * End monitoring a parsing operation stage
   */
  endStage(
    parseAttemptId: string,
    stage: DiagnosticInfo["stage"],
    success: boolean,
    details: Record<string, any> = {},
    error?: string
  ): void {
    const key = `${parseAttemptId}:${stage}`;
    const operation = this.activeOperations.get(key);

    if (!operation) {
      return;
    }

    const duration = Date.now() - operation.startTime;

    this.metricsCollector.recordDiagnostic({
      parseAttemptId,
      timestamp: Date.now(),
      stage,
      details,
      duration,
      success,
      error,
    });

    this.activeOperations.delete(key);
  }

  /**
   * Get currently active operations
   */
  getActiveOperations(): Array<{
    parseAttemptId: string;
    stage: string;
    duration: number;
  }> {
    const now = Date.now();
    return Array.from(this.activeOperations.entries()).map(
      ([key, operation]) => {
        const [parseAttemptId, stage] = key.split(":");
        return {
          parseAttemptId,
          stage,
          duration: now - operation.startTime,
        };
      }
    );
  }
}
// ============================================================================
// Diagnostic Analyzer
// ============================================================================

export class ParsingDiagnosticAnalyzer {
  private metricsCollector: ParsingMetricsCollector;
  private debugSessions: Map<string, DebugSession> = new Map();

  constructor(metricsCollector: ParsingMetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Generate comprehensive diagnostic report
   */
  generateReport(
    fromTimestamp?: number,
    toTimestamp?: number
  ): DiagnosticReport {
    const attempts = this.metricsCollector.getParseAttempts(
      fromTimestamp,
      toTimestamp
    );
    const metrics = this.metricsCollector.getAggregatedMetrics(
      fromTimestamp || 0,
      toTimestamp || Date.now()
    );

    return {
      summary: this.generateSummary(attempts, metrics),
      recommendations: this.generateRecommendations(attempts, metrics),
      configSuggestions: this.generateConfigSuggestions(attempts, metrics),
      detailedAnalysis: this.generateDetailedAnalysis(attempts),
    };
  }

  /**
   * Analyze specific parsing attempt
   */
  analyzeParseAttempt(parseAttemptId: string): {
    attempt: ParseAttempt | null;
    diagnostics: DiagnosticInfo[];
    timeline: Array<{ stage: string; duration: number; success: boolean }>;
    issues: string[];
    suggestions: string[];
  } {
    const attempts = this.metricsCollector.getParseAttempts();
    const attempt = attempts.find((a) => a.id === parseAttemptId) || null;
    const diagnostics = this.metricsCollector.getDiagnostics(parseAttemptId);

    const timeline = diagnostics.map((d) => ({
      stage: d.stage,
      duration: d.duration,
      success: d.success,
    }));

    const issues = this.identifyIssues(attempt, diagnostics);
    const suggestions = this.generateSuggestions(attempt, diagnostics);

    return {
      attempt,
      diagnostics,
      timeline,
      issues,
      suggestions,
    };
  }

  /**
   * Start a debug session
   */
  startDebugSession(tags: string[] = []): string {
    const sessionId = `debug_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    this.debugSessions.set(sessionId, {
      id: sessionId,
      startTime: Date.now(),
      parseAttempts: [],
      notes: [],
      tags,
    });

    return sessionId;
  }

  /**
   * End a debug session
   */
  endDebugSession(sessionId: string): DebugSession | null {
    const session = this.debugSessions.get(sessionId);
    if (!session) {
      return null;
    }

    session.endTime = Date.now();
    return session;
  }

  /**
   * Add parse attempt to debug session
   */
  addToDebugSession(sessionId: string, parseAttemptId: string): void {
    const session = this.debugSessions.get(sessionId);
    if (session) {
      session.parseAttempts.push(parseAttemptId);
    }
  }

  /**
   * Add note to debug session
   */
  addDebugNote(sessionId: string, note: string): void {
    const session = this.debugSessions.get(sessionId);
    if (session) {
      session.notes.push(`${new Date().toISOString()}: ${note}`);
    }
  }

  /**
   * Get debug session report
   */
  getDebugSessionReport(sessionId: string): {
    session: DebugSession | null;
    attempts: ParseAttempt[];
    summary: any;
  } {
    const session = this.debugSessions.get(sessionId) || null;
    if (!session) {
      return { session: null, attempts: [], summary: null };
    }

    const attempts = this.metricsCollector
      .getParseAttempts()
      .filter((a) => session.parseAttempts.includes(a.id));

    const summary = {
      duration: (session.endTime || Date.now()) - session.startTime,
      totalAttempts: attempts.length,
      successRate:
        attempts.length > 0
          ? attempts.filter((a) => a.success).length / attempts.length
          : 0,
      averageResponseTime:
        attempts.length > 0
          ? attempts.reduce((sum, a) => sum + a.responseTimeMs, 0) /
            attempts.length
          : 0,
    };

    return { session, attempts, summary };
  }

  /**
   * Export diagnostic data
   */
  exportDiagnosticData(): {
    report: DiagnosticReport;
    rawData: any;
    debugSessions: DebugSession[];
  } {
    return {
      report: this.generateReport(),
      rawData: this.metricsCollector.exportData(),
      debugSessions: Array.from(this.debugSessions.values()),
    };
  }

  private generateSummary(attempts: ParseAttempt[], metrics: any) {
    const diagnostics = attempts.flatMap((a) =>
      this.metricsCollector.getDiagnostics(a.id)
    );

    const errorCounts = Object.entries(metrics.errorsByType)
      .map(([type, count]) => ({
        type,
        count: count as number,
        percentage: ((count as number) / attempts.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    const stagePerformance = this.calculateStagePerformance(diagnostics);

    return {
      totalAttempts: attempts.length,
      successRate: metrics.formatDetectionAccuracy,
      averageResponseTime: metrics.averageResponseTime,
      mostCommonErrors: errorCounts.slice(0, 5),
      performanceByStage: stagePerformance,
    };
  }

  private generateRecommendations(
    attempts: ParseAttempt[],
    metrics: any
  ): string[] {
    const recommendations: string[] = [];

    // Only generate recommendations if we have data
    if (attempts.length === 0) {
      return recommendations;
    }

    if (metrics.formatDetectionAccuracy < 0.8) {
      recommendations.push(
        "Consider improving format detection patterns or lowering confidence threshold"
      );
    }

    if (metrics.averageResponseTime > 1500) {
      recommendations.push(
        "Response times are high - consider optimizing AI provider settings or input preprocessing"
      );
    }

    if (
      metrics.totalRequests > 0 &&
      metrics.fallbackUsed / metrics.totalRequests > 0.3
    ) {
      recommendations.push(
        "High fallback usage detected - review AI provider configuration and prompts"
      );
    }

    const retryRate =
      metrics.totalRequests > 0
        ? metrics.retryCount / metrics.totalRequests
        : 0;
    if (retryRate > 0.5) {
      recommendations.push(
        "High retry rate - consider adjusting retry logic or improving input validation"
      );
    }

    return recommendations;
  }

  private generateConfigSuggestions(
    attempts: ParseAttempt[],
    metrics: any
  ): Partial<ParserConfig> {
    const suggestions: Partial<ParserConfig> = {};

    // Suggest timeout increase if response times are high or timeout errors occur
    const hasTimeoutErrors =
      metrics.errorsByType && metrics.errorsByType.timeout > 0;
    if (metrics.averageResponseTime > 3000 || hasTimeoutErrors) {
      suggestions.aiProvider = {
        timeoutMs: Math.max(5000, metrics.averageResponseTime * 1.5),
        maxRetries: 3,
        temperature: 0.1,
        enableValidationRetries: true,
      };
    }

    if (metrics.formatDetectionAccuracy < 0.7) {
      suggestions.formatDetection = {
        confidenceThreshold: Math.max(0.5, metrics.averageConfidence - 0.1),
        enableMultiFormatDetection: true,
        enablePatternMatching: true,
      };
    }

    return suggestions;
  }

  private generateDetailedAnalysis(attempts: ParseAttempt[]) {
    if (attempts.length === 0) {
      return {
        slowestAttempts: [],
        failedAttempts: [],
        fallbackUsage: {
          frequency: 0,
          successRate: 0,
          commonTriggers: [],
        },
      };
    }
    const slowestAttempts = attempts
      .sort((a, b) => b.responseTimeMs - a.responseTimeMs)
      .slice(0, 10);

    const failedAttempts = attempts.filter((a) => !a.success).slice(0, 10);

    const fallbackAttempts = attempts.filter((a) => a.usedFallback);
    const fallbackSuccessRate =
      fallbackAttempts.length > 0
        ? fallbackAttempts.filter((a) => a.success).length /
          fallbackAttempts.length
        : 0;

    const commonTriggers = failedAttempts
      .map((a) => a.errorType)
      .filter(Boolean)
      .reduce((acc: Record<string, number>, type) => {
        acc[type!] = (acc[type!] || 0) + 1;
        return acc;
      }, {});

    return {
      slowestAttempts,
      failedAttempts,
      fallbackUsage: {
        frequency: fallbackAttempts.length / attempts.length,
        successRate: fallbackSuccessRate,
        commonTriggers: Object.keys(commonTriggers).slice(0, 5),
      },
    };
  }

  private calculateStagePerformance(diagnostics: DiagnosticInfo[]) {
    const stageStats: Record<
      string,
      { durations: number[]; successes: number; total: number }
    > = {};

    diagnostics.forEach((d) => {
      if (!stageStats[d.stage]) {
        stageStats[d.stage] = { durations: [], successes: 0, total: 0 };
      }

      stageStats[d.stage].durations.push(d.duration);
      stageStats[d.stage].total++;
      if (d.success) {
        stageStats[d.stage].successes++;
      }
    });

    return Object.entries(stageStats).map(([stage, stats]) => ({
      stage,
      averageDuration:
        stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length,
      successRate: stats.successes / stats.total,
    }));
  }

  private identifyIssues(
    attempt: ParseAttempt | null,
    diagnostics: DiagnosticInfo[]
  ): string[] {
    const issues: string[] = [];

    if (!attempt) {
      issues.push("Parse attempt not found");
      return issues;
    }

    if (!attempt.success) {
      issues.push(`Parsing failed: ${attempt.errorMessage || "Unknown error"}`);
    }

    if (attempt.responseTimeMs > 10000) {
      issues.push("Response time exceeded 10 seconds");
    }

    if (attempt.confidence < 0.5) {
      issues.push("Low confidence score in parsing result");
    }

    if (attempt.retryCount > 2) {
      issues.push("High number of retries required");
    }

    const failedStages = diagnostics.filter((d) => !d.success);
    if (failedStages.length > 0) {
      issues.push(
        `Failed stages: ${failedStages.map((d) => d.stage).join(", ")}`
      );
    }

    return issues;
  }

  private generateSuggestions(
    attempt: ParseAttempt | null,
    diagnostics: DiagnosticInfo[]
  ): string[] {
    const suggestions: string[] = [];

    if (!attempt) {
      return suggestions;
    }

    if (attempt.inputLength > 5000) {
      suggestions.push(
        "Consider breaking down large inputs into smaller chunks"
      );
    }

    if (attempt.assumptions > 3) {
      suggestions.push(
        "High number of assumptions made - provide more explicit input"
      );
    }

    if (attempt.warnings > 2) {
      suggestions.push(
        "Multiple warnings generated - review input format and completeness"
      );
    }

    const slowStages = diagnostics.filter((d) => d.duration > 2000);
    if (slowStages.length > 0) {
      suggestions.push(
        `Optimize slow stages: ${slowStages.map((d) => d.stage).join(", ")}`
      );
    }

    return suggestions;
  }
}

// ============================================================================
// Unified Parser System
// ============================================================================

/**
 * Unified parser system that combines configuration, metrics, and diagnostics
 */
export class UnifiedParserSystem {
  private configManager: ParserConfigManager;
  private metricsCollector: ParsingMetricsCollector;
  private performanceMonitor: ParsingPerformanceMonitor;
  private diagnosticAnalyzer: ParsingDiagnosticAnalyzer;

  constructor(config?: Partial<ParserConfig>) {
    this.configManager = new ParserConfigManager(config);
    const retentionMs =
      this.configManager.getConfig().monitoring.metricsRetentionMs;
    this.metricsCollector = new ParsingMetricsCollector(retentionMs);
    this.performanceMonitor = new ParsingPerformanceMonitor(
      this.metricsCollector
    );
    this.diagnosticAnalyzer = new ParsingDiagnosticAnalyzer(
      this.metricsCollector
    );
  }

  /**
   * Get configuration manager
   */
  getConfigManager(): ParserConfigManager {
    return this.configManager;
  }

  /**
   * Get metrics collector
   */
  getMetricsCollector(): ParsingMetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Get performance monitor
   */
  getPerformanceMonitor(): ParsingPerformanceMonitor {
    return this.performanceMonitor;
  }

  /**
   * Get diagnostic analyzer
   */
  getDiagnosticAnalyzer(): ParsingDiagnosticAnalyzer {
    return this.diagnosticAnalyzer;
  }

  /**
   * Get current configuration
   */
  getConfig(): ParserConfig {
    return this.configManager.getConfig();
  }

  /**
   * Update configuration
   */
  updateConfig(partialConfig: Partial<ParserConfig>): void {
    this.configManager.updateConfig(partialConfig);

    // Update metrics retention if changed
    const newConfig = this.configManager.getConfig();
    if (partialConfig.monitoring?.metricsRetentionMs) {
      // Create new metrics collector with updated retention
      this.metricsCollector = new ParsingMetricsCollector(
        newConfig.monitoring.metricsRetentionMs
      );
      this.performanceMonitor = new ParsingPerformanceMonitor(
        this.metricsCollector
      );
      this.diagnosticAnalyzer = new ParsingDiagnosticAnalyzer(
        this.metricsCollector
      );
    }
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): {
    config: ParserConfig;
    metrics: ParsingMetrics;
    activeOperations: Array<{
      parseAttemptId: string;
      stage: string;
      duration: number;
    }>;
    isHealthy: boolean;
  } {
    const config = this.getConfig();
    const metrics = this.metricsCollector.getMetrics();
    const activeOperations = this.performanceMonitor.getActiveOperations();

    // Simple health check based on success rate and response times
    const isHealthy =
      metrics.totalRequests === 0 || // No requests yet, assume healthy
      (metrics.formatDetectionAccuracy > 0.7 &&
        metrics.averageResponseTime < 5000);

    return {
      config,
      metrics,
      activeOperations,
      isHealthy,
    };
  }
}

// ============================================================================
// Exports for backward compatibility
// ============================================================================

// Legacy exports to maintain compatibility with existing code
export type SmartParserConfig = ParserConfig;
export const DEFAULT_SMART_PARSER_CONFIG = DEFAULT_PARSER_CONFIG;
export const SmartParserConfigManager = ParserConfigManager;

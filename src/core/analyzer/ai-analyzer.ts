import { AnalyzedResults } from "../../types";
import { OllamaClient, OllamaRequest, ParserConfig } from "../parser";

export interface AnalysisTemplate {
  name: string;
  description: string;
  prompt: string;
  applicableMetrics: string[];
}

export interface AnalyzerConfig {
  ollamaEndpoint: string;
  modelName: string;
  analysisTemplates: AnalysisTemplate[];
  thresholds: PerformanceThresholds;
}

export interface PerformanceThresholds {
  responseTime: {
    good: number;
    acceptable: number;
    poor: number;
  };
  errorRate: {
    good: number;
    acceptable: number;
    poor: number;
  };
  throughput: {
    minimum: number;
    target: number;
    excellent: number;
  };
}

export class AIAnalysisEngine {
  private ollamaClient: OllamaClient;
  private config: AnalyzerConfig;
  private templates: Map<string, AnalysisTemplate>;

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.templates = new Map();

    // Create configuration for OllamaClient using legacy interface
    const ollamaConfig = {
      ollamaEndpoint: config.ollamaEndpoint,
      modelName: config.modelName,
      maxRetries: 3,
      timeout: 30000,
    } as any; // Use any to bypass type checking for legacy interface

    this.ollamaClient = new OllamaClient(ollamaConfig);

    // Initialize default templates
    this.initializeDefaultTemplates();

    // Add custom templates
    config.analysisTemplates.forEach((template) => {
      this.templates.set(template.name, template);
    });
  }

  async generateAIRecommendations(results: AnalyzedResults): Promise<string[]> {
    const recommendations: string[] = [];
    const metrics = results.testResult.metrics;

    // Determine which templates to use based on the results
    const applicableTemplates = this.selectApplicableTemplates(results);

    for (const template of applicableTemplates) {
      try {
        const prompt = this.populateTemplate(template, results);
        const aiResponse = await this.queryOllama(prompt);

        if (aiResponse && aiResponse.trim()) {
          recommendations.push(`AI Analysis (${template.name}): ${aiResponse}`);
        }
      } catch (error) {
        console.warn(
          `Failed to generate AI recommendation for template ${template.name}:`,
          error
        );
      }
    }

    return recommendations;
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplates: AnalysisTemplate[] = [
      {
        name: "response_time_analysis",
        description:
          "Analyze response time performance and provide optimization recommendations",
        prompt: `Analyze the following load test results and provide specific recommendations for improving response time performance:

Response Time Metrics:
- Average: {avg_response_time}ms
- 95th Percentile: {p95_response_time}ms
- 99th Percentile: {p99_response_time}ms
- Max: {max_response_time}ms

Error Rate: {error_rate}%
Throughput: {throughput} requests/second

Performance Issues Detected:
{performance_issues}

Bottlenecks Identified:
{bottlenecks}

Please provide 3-5 specific, actionable recommendations to improve response time performance. Focus on practical solutions that can be implemented by developers or operations teams.`,
        applicableMetrics: ["response_time", "error_rate", "throughput"],
      },
      {
        name: "error_analysis",
        description:
          "Analyze error patterns and provide debugging recommendations",
        prompt: `Analyze the following error patterns from a load test and provide debugging recommendations:

Error Summary:
{error_summary}

Error Rate: {error_rate}%
Total Requests: {total_requests}
Failed Requests: {failed_requests}

Common Error Types:
{error_types}

Please provide specific recommendations for:
1. Identifying the root cause of these errors
2. Steps to reproduce and debug the issues
3. Preventive measures to avoid similar errors in the future

Focus on actionable debugging strategies and monitoring improvements.`,
        applicableMetrics: ["error_rate", "error_types"],
      },
      {
        name: "throughput_optimization",
        description:
          "Analyze throughput performance and provide scaling recommendations",
        prompt: `Analyze the following throughput performance data and provide scaling recommendations:

Throughput: {throughput} requests/second
Target Load: {target_load} requests/second
Response Time: {avg_response_time}ms (avg), {p95_response_time}ms (95th percentile)
Error Rate: {error_rate}%

Resource Utilization:
{resource_metrics}

Bottlenecks:
{bottlenecks}

Please provide recommendations for:
1. Optimizing current throughput performance
2. Scaling strategies to handle higher loads
3. Infrastructure improvements
4. Application-level optimizations

Focus on both immediate improvements and long-term scaling strategies.`,
        applicableMetrics: ["throughput", "response_time", "resource_usage"],
      },
      {
        name: "load_pattern_analysis",
        description:
          "Analyze load test patterns and provide testing strategy recommendations",
        prompt: `Analyze the following load test pattern and results, then provide testing strategy recommendations:

Test Type: {test_type}
Load Pattern: {load_pattern}
Duration: {test_duration}
Peak Load: {peak_load} requests/second

Results Summary:
- Success Rate: {success_rate}%
- Average Response Time: {avg_response_time}ms
- Peak Response Time: {max_response_time}ms
- Throughput: {throughput} requests/second

Performance Degradation Points:
{degradation_points}

Please provide recommendations for:
1. Optimizing the current load testing strategy
2. Additional test scenarios to consider
3. Performance benchmarks and SLA recommendations
4. Monitoring and alerting strategies

Focus on comprehensive testing approaches and performance validation strategies.`,
        applicableMetrics: ["load_pattern", "test_duration", "success_rate"],
      },
    ];

    defaultTemplates.forEach((template) => {
      this.templates.set(template.name, template);
    });
  }

  private selectApplicableTemplates(
    results: AnalyzedResults
  ): AnalysisTemplate[] {
    const templates: AnalysisTemplate[] = [];
    const metrics = results.testResult.metrics;

    // Always include response time analysis
    const responseTimeTemplate = this.templates.get("response_time_analysis");
    if (responseTimeTemplate) {
      templates.push(responseTimeTemplate);
    }

    // Include error analysis if there are significant errors
    if (metrics.errorRate > this.config.thresholds.errorRate.good) {
      const errorTemplate = this.templates.get("error_analysis");
      if (errorTemplate) {
        templates.push(errorTemplate);
      }
    }

    // Include throughput analysis if throughput is below target
    if (
      metrics.throughput.requestsPerSecond <
      this.config.thresholds.throughput.target
    ) {
      const throughputTemplate = this.templates.get("throughput_optimization");
      if (throughputTemplate) {
        templates.push(throughputTemplate);
      }
    }

    return templates;
  }

  private populateTemplate(
    template: AnalysisTemplate,
    results: AnalyzedResults
  ): string {
    let prompt = template.prompt;
    const metrics = results.testResult.metrics;

    // Replace placeholders with actual values
    const replacements: Record<string, string> = {
      "{avg_response_time}": metrics.responseTime.avg.toString(),
      "{p95_response_time}": metrics.responseTime.p95.toString(),
      "{p99_response_time}": metrics.responseTime.p99.toString(),
      "{max_response_time}": metrics.responseTime.max.toString(),
      "{error_rate}": (metrics.errorRate * 100).toFixed(1),
      "{throughput}": metrics.throughput.requestsPerSecond.toString(),
      "{total_requests}": metrics.totalRequests.toString(),
      "{failed_requests}": metrics.failedRequests.toString(),
      "{success_rate}": (
        (metrics.successfulRequests / metrics.totalRequests) *
        100
      ).toFixed(1),
      "{performance_issues}": results.performanceInsights
        .map((i) => `- ${i.message}`)
        .join("\n"),
      "{bottlenecks}": results.bottlenecks
        .map((b) => `- ${b.description}`)
        .join("\n"),
      "{error_summary}": results.testResult.errors
        .map((e) => `${e.errorType}: ${e.count} occurrences (${e.percentage}%)`)
        .join("\n"),
      "{error_types}": results.testResult.errors
        .map((e) => e.errorType)
        .join(", "),
    };

    // Replace all placeholders
    Object.entries(replacements).forEach(([placeholder, value]) => {
      prompt = prompt.replace(new RegExp(placeholder, "g"), value);
    });

    return prompt;
  }

  private async queryOllama(prompt: string): Promise<string> {
    const request: OllamaRequest = {
      model: this.config.modelName,
      prompt,
      options: {
        temperature: 0.3, // Lower temperature for more focused recommendations
        num_predict: 500, // Limit response length
      },
    };

    const response = await this.ollamaClient.generateCompletion(request);
    return response.response || "";
  }
}

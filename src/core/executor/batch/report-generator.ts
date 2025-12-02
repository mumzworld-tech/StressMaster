import * as fs from "fs";
import * as path from "path";
import { BatchTestSpec } from "../../../types/load-test-spec";
import { requireStressMasterDir } from "../../../utils/require-stressmaster-dir";
import {
  IndividualTestReport,
  CombinedBatchReport,
  EnhancedBatchTestResult,
  AggregatedMetrics,
} from "./types";

export class BatchReportGenerator {
  async generateIndividualReport(
    result: EnhancedBatchTestResult,
    batchSpec: BatchTestSpec,
    outputDir?: string
  ): Promise<IndividualTestReport> {
    const { getExportsDir } = requireStressMasterDir();
    const reportDir = outputDir || path.join(getExportsDir(), "batch");
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, `${result.testId}_report.html`);
    const reportContent = this.generateIndividualReportHTML(result, batchSpec);
    fs.writeFileSync(reportPath, reportContent);

    return {
      testId: result.testId,
      testName: result.testName,
      reportPath,
      reportFormat: "html",
      metrics: result.metrics,
      assertions: result.assertions || [],
    };
  }

  async generateCombinedReport(
    batchSpec: BatchTestSpec,
    results: EnhancedBatchTestResult[],
    individualReports: IndividualTestReport[],
    outputDir?: string
  ): Promise<CombinedBatchReport> {
    const { getExportsDir } = requireStressMasterDir();
    const reportDir = outputDir || path.join(getExportsDir(), "batch");
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(
      reportDir,
      `${batchSpec.id}_combined_report.html`
    );
    const reportContent = this.generateCombinedReportHTML(
      batchSpec,
      results,
      individualReports
    );
    fs.writeFileSync(reportPath, reportContent);

    const summary = this.calculateSummary(results);

    return {
      batchId: batchSpec.id,
      batchName: batchSpec.name,
      reportPath,
      reportFormat: "html",
      summary,
      testResults: results,
      aggregatedMetrics: this.aggregateMetrics(results),
    };
  }

  private generateIndividualReportHTML(
    result: EnhancedBatchTestResult,
    batchSpec: BatchTestSpec
  ): string {
    // Convert ExecutionMetrics to AggregatedMetrics for display
    const metrics = result.metrics as any; // Temporary fix - should use proper AggregatedMetrics
    const successRate = (
      ((metrics.requestsCompleted * (1 - metrics.errorRate)) /
        metrics.requestsCompleted) *
      100
    ).toFixed(2);
    const errorRate = metrics.errorRate.toFixed(2);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StressMaster Test Report - ${result.testName}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #667eea;
        }
        .metric-card h3 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 1.1em;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
            word-break: break-all;
            overflow-wrap: break-word;
        }
        .metric-value.id {
            font-size: 1.2em;
            font-family: 'Courier New', monospace;
            background: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #e9ecef;
        }
        .metric-unit {
            font-size: 0.9em;
            color: #666;
        }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        .response-time-chart {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .chart-bar {
            display: flex;
            align-items: center;
            margin: 10px 0;
        }
        .chart-label {
            width: 120px;
            font-weight: bold;
        }
        .chart-bar-container {
            flex: 1;
            background: #e9ecef;
            border-radius: 4px;
            height: 20px;
            margin: 0 10px;
            overflow: hidden;
        }
        .chart-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s ease;
            border-radius: 4px;
        }
        .chart-bar-fill.min { background: linear-gradient(90deg, #28a745, #20c997); }
        .chart-bar-fill.avg { background: linear-gradient(90deg, #ffc107, #fd7e14); }
        .chart-bar-fill.p50 { background: linear-gradient(90deg, #17a2b8, #6f42c1); }
        .chart-bar-fill.p90 { background: linear-gradient(90deg, #fd7e14, #e83e8c); }
        .chart-bar-fill.p95 { background: linear-gradient(90deg, #dc3545, #6f42c1); }
        .chart-bar-fill.p99 { background: linear-gradient(90deg, #6f42c1, #dc3545); }
        .chart-bar-fill.max { background: linear-gradient(90deg, #dc3545, #6f42c1); }
        .chart-value {
            width: 80px;
            text-align: right;
            font-family: monospace;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-completed {
            background: #d4edda;
            color: #155724;
        }
        .status-failed {
            background: #f8d7da;
            color: #721c24;
        }
        .status-running {
            background: #fff3cd;
            color: #856404;
        }
        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: all 0.3s ease;
        }
        .chart-bar:hover .chart-bar-fill {
            opacity: 0.8;
            transition: opacity 0.2s ease;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            border-top: 1px solid #e9ecef;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${result.testName}</h1>
            <p>Batch Test Individual Report</p>
            <p>Test ID: ${result.testId}</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>Test Summary</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h3>Test ID</h3>
                        <div class="metric-value id">${result.testId}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Status</h3>
                        <div class="metric-value ${
                          result.status === "completed" ? "success" : "error"
                        }">
                            <span class="status-badge status-${
                              result.status
                            }">${result.status}</span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <h3>Duration</h3>
                        <div class="metric-value">${
                          result.duration
                        }<span class="metric-unit">ms</span></div>
                    </div>
                    <div class="metric-card">
                        <h3>Success Rate</h3>
                        <div class="metric-value success">${successRate}<span class="metric-unit">%</span></div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Performance Metrics</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h3>Total Requests</h3>
                        <div class="metric-value">${
                          metrics.requestsCompleted
                        }</div>
                    </div>
                    <div class="metric-card">
                        <h3>Successful Requests</h3>
                        <div class="metric-value success">${Math.floor(
                          metrics.requestsCompleted * (1 - metrics.errorRate)
                        )}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Failed Requests</h3>
                        <div class="metric-value error">${Math.floor(
                          metrics.requestsCompleted * metrics.errorRate
                        )}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Error Rate</h3>
                        <div class="metric-value error">${errorRate}<span class="metric-unit">%</span></div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Response Times</h2>
                <div class="response-time-chart">
                    <div class="chart-bar">
                        <div class="chart-label">Average</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar-fill avg" style="width: 100%"></div>
                        </div>
                        <div class="chart-value">${metrics.avgResponseTime.toFixed(
                          2
                        )}ms</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Throughput</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h3>Requests per Second</h3>
                        <div class="metric-value">${result.metrics.requestsPerSecond.toFixed(
                          2
                        )}<span class="metric-unit">req/s</span></div>
                    </div>
                    <div class="metric-card">
                        <h3>Data Transfer</h3>
                        <div class="metric-value">0.00<span class="metric-unit">B</span></div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Generated by StressMaster on ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
  }

  private calculateBarWidth(value: number, maxValue: number): number {
    if (maxValue === 0) return 0;
    return Math.min((value / maxValue) * 100, 100);
  }

  private generateCombinedReportHTML(
    batchSpec: BatchTestSpec,
    results: EnhancedBatchTestResult[],
    individualReports: IndividualTestReport[]
  ): string {
    const summary = this.calculateSummary(results);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Batch Report: ${batchSpec.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-item { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .tests { margin: 20px 0; }
        .test { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status-completed { border-left: 5px solid #28a745; }
        .status-failed { border-left: 5px solid #dc3545; }
        .links { margin: 20px 0; }
        .link { display: inline-block; margin: 5px; padding: 10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${batchSpec.name}</h1>
        <p><strong>Execution Mode:</strong> ${batchSpec.executionMode}</p>
        <p><strong>Total Tests:</strong> ${summary.totalTests}</p>
        <p><strong>Success Rate:</strong> ${(summary.successRate * 100).toFixed(
          2
        )}%</p>
    </div>
    
    <div class="summary">
        <div class="summary-item">
            <h3>Overall Performance</h3>
            <p>Total Duration: ${summary.totalDuration}ms</p>
            <p>Avg Response Time: ${summary.averageResponseTime.toFixed(
              2
            )}ms</p>
            <p>Total Throughput: ${summary.totalThroughput.toFixed(2)} req/s</p>
        </div>
        <div class="summary-item">
            <h3>Test Results</h3>
            <p>Successful: ${summary.successfulTests}</p>
            <p>Failed: ${summary.failedTests}</p>
            <p>Success Rate: ${(summary.successRate * 100).toFixed(2)}%</p>
        </div>
    </div>
    
    <div class="links">
        <h2>Individual Test Reports</h2>
        ${individualReports
          .map(
            (report) => `
            <a href="${report.reportPath}" class="link" target="_blank">${report.testName}</a>
        `
          )
          .join("")}
    </div>
    
    <div class="tests">
        <h2>Test Details</h2>
        ${results
          .map(
            (result) => `
            <div class="test status-${result.status}">
                <h3>${result.testName}</h3>
                <p><strong>Status:</strong> ${result.status}</p>
                <p><strong>Duration:</strong> ${result.duration}ms</p>
                <p><strong>Requests:</strong> ${
                  result.metrics.requestsCompleted
                }</p>
                <p><strong>Success Rate:</strong> ${(
                  (1 - result.metrics.errorRate) *
                  100
                ).toFixed(2)}%</p>
                ${
                  result.error
                    ? `<p><strong>Error:</strong> ${result.error}</p>`
                    : ""
                }
            </div>
        `
          )
          .join("")}
    </div>
</body>
</html>
`;
  }

  private calculateSummary(results: EnhancedBatchTestResult[]): any {
    const totalTests = results.length;
    const successfulTests = results.filter(
      (r) => r.status === "completed"
    ).length;
    const successRate = totalTests > 0 ? successfulTests / totalTests : 0;

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const totalRequests = results.reduce(
      (sum, r) => sum + r.metrics.requestsCompleted,
      0
    );
    const totalThroughput = results.reduce(
      (sum, r) => sum + r.metrics.requestsPerSecond,
      0
    );

    const responseTimes = results
      .map((r) => r.metrics.avgResponseTime)
      .filter((time) => time > 0);

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    return {
      totalTests,
      successfulTests,
      failedTests: totalTests - successfulTests,
      successRate,
      totalDuration,
      averageResponseTime,
      totalThroughput,
    };
  }

  private aggregateMetrics(
    results: EnhancedBatchTestResult[]
  ): AggregatedMetrics {
    // This would be the same as in the main executor
    // For brevity, returning a simplified version
    return {
      totalRequests: results.reduce(
        (sum, r) => sum + r.metrics.requestsCompleted,
        0
      ),
      successfulRequests: results.reduce(
        (sum, r) =>
          sum +
          Math.floor(r.metrics.requestsCompleted * (1 - r.metrics.errorRate)),
        0
      ),
      failedRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p90ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
    };
  }
}

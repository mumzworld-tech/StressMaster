import { TestResult } from "../../types";
import * as fs from "fs";
import * as path from "path";

export interface ExportOptions {
  format: "json" | "csv" | "html";
  outputDir?: string;
  filename?: string;
  includeRawData?: boolean;
  includeRecommendations?: boolean;
}

export class ExportManager {
  private defaultOutputDir: string;

  constructor() {
    this.defaultOutputDir = path.join(process.cwd(), "exports");
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.defaultOutputDir)) {
      fs.mkdirSync(this.defaultOutputDir, { recursive: true });
    }
  }

  async exportTestResult(
    result: TestResult,
    options: ExportOptions
  ): Promise<string> {
    // Check if this is a batch test
    if (result.spec.testType === "batch" || result.spec.batch) {
      return this.exportBatchTestResult(result, options);
    }

    const outputDir = options.outputDir || this.defaultOutputDir;
    const filename =
      options.filename || this.generateFilename(result, options.format);
    const filePath = path.join(outputDir, filename);

    let content: string;

    switch (options.format) {
      case "json":
        content = this.exportToJSON(result, options);
        break;
      case "csv":
        content = this.exportToCSV(result, options);
        break;
      case "html":
        content = this.exportToHTML(result, options);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    fs.writeFileSync(filePath, content, "utf8");
    console.log(`📁 Exported test result to: ${filePath}`);

    return filePath;
  }

  private async exportBatchTestResult(
    result: TestResult,
    options: ExportOptions
  ): Promise<string> {
    const batchSpec = result.spec.batch;
    if (!batchSpec) {
      throw new Error("Batch specification not found in test result");
    }

    const outputDir = options.outputDir || this.defaultOutputDir;
    const batchDir = path.join(outputDir, `batch-${result.id}`);

    // Ensure batch directory exists
    if (!fs.existsSync(batchDir)) {
      fs.mkdirSync(batchDir, { recursive: true });
    }

    // Import batch report generator
    const { BatchReportGenerator } = await import(
      "../../core/executor/batch/report-generator"
    );
    const reportGenerator = new BatchReportGenerator();

    // Generate individual test reports
    const individualReports: any[] = [];
    for (const testResult of batchSpec.tests) {
      // Use the actual virtualUsers from each test's loadPattern
      const individualRequestsCompleted =
        testResult.loadPattern?.virtualUsers || 1;

      // Create a mock result for each test (this would need to be enhanced with actual test results)
      const mockTestResult = {
        testId: testResult.id,
        testName: testResult.name,
        status: "completed" as const,
        startTime: result.startTime,
        endTime: result.endTime,
        duration: result.endTime.getTime() - result.startTime.getTime(),
        metrics: {
          status: "completed" as const,
          progress: 100,
          currentVUs: 0,
          requestsCompleted: individualRequestsCompleted,
          requestsPerSecond:
            result.metrics.throughput.requestsPerSecond /
            batchSpec.tests.length,
          avgResponseTime: result.metrics.responseTime.avg,
          errorRate: result.metrics.errorRate,
          timestamp: new Date(),
        },
        error: undefined,
        retryCount: 0,
        assertions: [],
      };

      const report = await reportGenerator.generateIndividualReport(
        mockTestResult,
        batchSpec,
        batchDir
      );
      individualReports.push(report);
    }

    // Generate combined report
    const mockResults = batchSpec.tests.map((test) => {
      // Use the actual virtualUsers from each test's loadPattern
      const individualRequestsCompleted = test.loadPattern?.virtualUsers || 1;

      return {
        testId: test.id,
        testName: test.name,
        status: "completed" as const,
        startTime: result.startTime,
        endTime: result.endTime,
        duration: result.endTime.getTime() - result.startTime.getTime(),
        metrics: {
          status: "completed" as const,
          progress: 100,
          currentVUs: 0,
          requestsCompleted: individualRequestsCompleted,
          requestsPerSecond:
            result.metrics.throughput.requestsPerSecond /
            batchSpec.tests.length,
          avgResponseTime: result.metrics.responseTime.avg,
          errorRate: result.metrics.errorRate,
          timestamp: new Date(),
        },
        error: undefined,
        retryCount: 0,
        assertions: [],
      };
    });

    const combinedReport = await reportGenerator.generateCombinedReport(
      batchSpec,
      mockResults,
      individualReports,
      batchDir
    );

    console.log(`📁 Exported batch test results to: ${batchDir}`);
    console.log(`   📄 Combined report: ${combinedReport.reportPath}`);
    console.log(`   📄 Individual reports: ${individualReports.length} files`);

    return combinedReport.reportPath;
  }

  private generateFilename(result: TestResult, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `stressmaster-${result.id}-${timestamp}.${format}`;
  }

  private exportToJSON(result: TestResult, options: ExportOptions): string {
    const exportData: any = {
      testId: result.id,
      testName: result.spec.name,
      testType: result.spec.testType,
      status: result.status,
      startTime: result.startTime.toISOString(),
      endTime: result.endTime.toISOString(),
      duration: result.endTime.getTime() - result.startTime.getTime(),
      metrics: result.metrics,
      errors: result.errors,
      recommendations: options.includeRecommendations
        ? result.recommendations
        : undefined,
      rawData: options.includeRawData ? result.rawData : undefined,
      spec: result.spec,
    };

    return JSON.stringify(exportData, null, 2);
  }

  private exportToCSV(result: TestResult, options: ExportOptions): string {
    const lines: string[] = [];

    // Header
    lines.push("Metric,Value,Unit");

    // Basic test info
    lines.push(`Test ID,${result.id},`);
    lines.push(`Test Name,${result.spec.name},`);
    lines.push(`Test Type,${result.spec.testType},`);
    lines.push(`Status,${result.status},`);
    lines.push(`Start Time,${result.startTime.toISOString()},`);
    lines.push(`End Time,${result.endTime.toISOString()},`);
    lines.push(
      `Duration,${result.endTime.getTime() - result.startTime.getTime()},ms`
    );

    // Performance metrics
    lines.push(`Total Requests,${result.metrics.totalRequests},`);
    lines.push(`Successful Requests,${result.metrics.successfulRequests},`);
    lines.push(`Failed Requests,${result.metrics.failedRequests},`);
    lines.push(
      `Success Rate,${(
        (result.metrics.successfulRequests / result.metrics.totalRequests) *
        100
      ).toFixed(2)},%`
    );
    lines.push(`Error Rate,${result.metrics.errorRate.toFixed(2)},%`);

    // Response times
    lines.push(
      `Min Response Time,${result.metrics.responseTime.min.toFixed(2)},ms`
    );
    lines.push(
      `Avg Response Time,${result.metrics.responseTime.avg.toFixed(2)},ms`
    );
    lines.push(
      `Max Response Time,${result.metrics.responseTime.max.toFixed(2)},ms`
    );
    lines.push(
      `P50 Response Time,${result.metrics.responseTime.p50.toFixed(2)},ms`
    );
    lines.push(
      `P90 Response Time,${result.metrics.responseTime.p90.toFixed(2)},ms`
    );
    lines.push(
      `P95 Response Time,${result.metrics.responseTime.p95.toFixed(2)},ms`
    );
    lines.push(
      `P99 Response Time,${result.metrics.responseTime.p99.toFixed(2)},ms`
    );

    // Throughput
    lines.push(
      `Requests Per Second,${result.metrics.throughput.requestsPerSecond.toFixed(
        2
      )},req/s`
    );
    lines.push(
      `Data Per Second,${result.metrics.throughput.bytesPerSecond.toFixed(
        2
      )},B/s`
    );

    return lines.join("\n");
  }

  private exportToHTML(result: TestResult, options: ExportOptions): string {
    const duration = result.endTime.getTime() - result.startTime.getTime();
    const successRate = (
      (result.metrics.successfulRequests / result.metrics.totalRequests) *
      100
    ).toFixed(2);
    const errorRate = result.metrics.errorRate.toFixed(2);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StressMaster Test Report - ${result.id}</title>
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
        .recommendations {
            background: #e7f3ff;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .recommendations h3 {
            color: #0056b3;
            margin-top: 0;
        }
        .recommendations ul {
            margin: 0;
            padding-left: 20px;
        }
        .recommendations li {
            margin: 5px 0;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            border-top: 1px solid #e9ecef;
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 StressMaster Test Report</h1>
            <p>${result.spec.name} - ${result.spec.testType} Test</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>📊 Test Summary</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h3>Test ID</h3>
                        <div class="metric-value id">${result.id}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Status</h3>
                        <div class="status-badge status-${result.status}">${
      result.status
    }</div>
                    </div>
                    <div class="metric-card">
                        <h3>Duration</h3>
                        <div class="metric-value">${(duration / 1000).toFixed(
                          1
                        )}</div>
                        <div class="metric-unit">seconds</div>
                    </div>
                                         <div class="metric-card">
                         <h3>Success Rate</h3>
                         <div class="metric-value success">${(
                           (result.metrics.successfulRequests /
                             result.metrics.totalRequests) *
                           100
                         ).toFixed(2)}%</div>
                     </div>
                </div>
            </div>

            <div class="section">
                <h2>📈 Performance Metrics</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h3>Total Requests</h3>
                        <div class="metric-value">${result.metrics.totalRequests.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Successful</h3>
                        <div class="metric-value success">${result.metrics.successfulRequests.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Failed</h3>
                        <div class="metric-value error">${result.metrics.failedRequests.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Requests/sec</h3>
                        <div class="metric-value">${result.metrics.throughput.requestsPerSecond.toFixed(
                          2
                        )}</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>⏱️ Response Time Distribution</h2>
                <div class="response-time-chart">
                    <div class="chart-bar">
                        <div class="chart-label">Min</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar-fill min" style="width: ${
                              (result.metrics.responseTime.min /
                                result.metrics.responseTime.max) *
                              100
                            }%"></div>
                        </div>
                        <div class="chart-value">${result.metrics.responseTime.min.toFixed(
                          2
                        )}ms</div>
                    </div>
                    <div class="chart-bar">
                        <div class="chart-label">Average</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar-fill avg" style="width: ${
                              (result.metrics.responseTime.avg /
                                result.metrics.responseTime.max) *
                              100
                            }%"></div>
                        </div>
                        <div class="chart-value">${result.metrics.responseTime.avg.toFixed(
                          2
                        )}ms</div>
                    </div>
                    <div class="chart-bar">
                        <div class="chart-label">P50</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar-fill p50" style="width: ${
                              (result.metrics.responseTime.p50 /
                                result.metrics.responseTime.max) *
                              100
                            }%"></div>
                        </div>
                        <div class="chart-value">${result.metrics.responseTime.p50.toFixed(
                          2
                        )}ms</div>
                    </div>
                    <div class="chart-bar">
                        <div class="chart-label">P90</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar-fill p90" style="width: ${
                              (result.metrics.responseTime.p90 /
                                result.metrics.responseTime.max) *
                              100
                            }%"></div>
                        </div>
                        <div class="chart-value">${result.metrics.responseTime.p90.toFixed(
                          2
                        )}ms</div>
                    </div>
                    <div class="chart-bar">
                        <div class="chart-label">P95</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar-fill p95" style="width: ${
                              (result.metrics.responseTime.p95 /
                                result.metrics.responseTime.max) *
                              100
                            }%"></div>
                        </div>
                        <div class="chart-value">${result.metrics.responseTime.p95.toFixed(
                          2
                        )}ms</div>
                    </div>
                    <div class="chart-bar">
                        <div class="chart-label">P99</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar-fill p99" style="width: ${
                              (result.metrics.responseTime.p99 /
                                result.metrics.responseTime.max) *
                              100
                            }%"></div>
                        </div>
                        <div class="chart-value">${result.metrics.responseTime.p99.toFixed(
                          2
                        )}ms</div>
                    </div>
                    <div class="chart-bar">
                        <div class="chart-label">Max</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar-fill max" style="width: 100%"></div>
                        </div>
                        <div class="chart-value">${result.metrics.responseTime.max.toFixed(
                          2
                        )}ms</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>📋 Test Details</h2>
                <table>
                    <tr>
                        <th>Property</th>
                        <th>Value</th>
                    </tr>
                    <tr>
                        <td>Test Type</td>
                        <td>${result.spec.testType}</td>
                    </tr>
                    <tr>
                        <td>Load Pattern</td>
                        <td>${result.spec.loadPattern.type}</td>
                    </tr>
                    <tr>
                        <td>Virtual Users</td>
                        <td>${result.spec.loadPattern.virtualUsers}</td>
                    </tr>
                    <tr>
                        <td>Target URL</td>
                        <td>${result.spec.requests[0].url}</td>
                    </tr>
                    <tr>
                        <td>HTTP Method</td>
                        <td>${result.spec.requests[0].method}</td>
                    </tr>
                    <tr>
                        <td>Start Time</td>
                        <td>${result.startTime.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>End Time</td>
                        <td>${result.endTime.toLocaleString()}</td>
                    </tr>
                </table>
            </div>

            ${
              options.includeRecommendations &&
              result.recommendations.length > 0
                ? `
            <div class="section">
                <h2>💡 Recommendations</h2>
                <div class="recommendations">
                    <ul>
                        ${result.recommendations
                          .map((rec) => `<li>${rec}</li>`)
                          .join("")}
                    </ul>
                </div>
            </div>
            `
                : ""
            }

            ${
              result.errors.length > 0
                ? `
            <div class="section">
                <h2>❌ Errors</h2>
                <table>
                    <tr>
                        <th>Error Type</th>
                        <th>Message</th>
                        <th>Count</th>
                    </tr>
                    ${result.errors
                      .map(
                        (error) => `
                    <tr>
                        <td>${error.errorType}</td>
                        <td>${error.errorMessage}</td>
                        <td>${error.count}</td>
                    </tr>
                    `
                      )
                      .join("")}
                </table>
            </div>
            `
                : ""
            }
        </div>
        
        <div class="footer">
            <p>Generated by StressMaster v1.0.2 on ${new Date().toLocaleString()}</p>
            <p>AI-Powered Load Testing Tool</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Export multiple test results for comparison
  async exportComparison(
    results: TestResult[],
    options: ExportOptions
  ): Promise<string> {
    const outputDir = options.outputDir || this.defaultOutputDir;
    const filename = `stressmaster-comparison-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.${options.format}`;
    const filePath = path.join(outputDir, filename);

    let content: string;

    switch (options.format) {
      case "json":
        content = JSON.stringify(results, null, 2);
        break;
      case "csv":
        content = this.generateComparisonCSV(results);
        break;
      case "html":
        content = this.generateComparisonHTML(results);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    fs.writeFileSync(filePath, content, "utf8");
    console.log(`📁 Exported comparison to: ${filePath}`);

    return filePath;
  }

  private generateComparisonCSV(results: TestResult[]): string {
    const lines: string[] = [];

    // Header
    lines.push(
      "Test ID,Test Type,Status,Duration (ms),Total Requests,Success Rate (%),Avg Response Time (ms),P95 Response Time (ms),Requests/sec"
    );

    // Data rows
    for (const result of results) {
      const duration = result.endTime.getTime() - result.startTime.getTime();
      lines.push(
        [
          result.id,
          result.spec.testType,
          result.status,
          duration,
          result.metrics.totalRequests,
          (
            (result.metrics.successfulRequests / result.metrics.totalRequests) *
            100
          ).toFixed(2),
          result.metrics.responseTime.avg.toFixed(2),
          result.metrics.responseTime.p95.toFixed(2),
          result.metrics.throughput.requestsPerSecond.toFixed(2),
        ].join(",")
      );
    }

    return lines.join("\n");
  }

  private generateComparisonHTML(results: TestResult[]): string {
    // Simplified comparison HTML - you can expand this
    return `<!DOCTYPE html>
<html>
<head>
    <title>StressMaster Test Comparison</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Test Comparison Report</h1>
    <table>
        <tr>
            <th>Test ID</th>
            <th>Type</th>
            <th>Status</th>
            <th>Duration (ms)</th>
            <th>Requests</th>
            <th>Success Rate (%)</th>
            <th>Avg Response (ms)</th>
        </tr>
        ${results
          .map((result) => {
            const duration =
              result.endTime.getTime() - result.startTime.getTime();
            return `<tr>
            <td>${result.id}</td>
            <td>${result.spec.testType}</td>
            <td>${result.status}</td>
            <td>${duration}</td>
            <td>${result.metrics.totalRequests}</td>
                         <td>${(
                           (result.metrics.successfulRequests /
                             result.metrics.totalRequests) *
                           100
                         ).toFixed(2)}</td>
            <td>${result.metrics.responseTime.avg.toFixed(2)}</td>
          </tr>`;
          })
          .join("")}
    </table>
</body>
</html>`;
  }

  // Get export statistics
  getExportStats(): {
    totalFiles: number;
    totalSize: string;
    formats: string[];
  } {
    if (!fs.existsSync(this.defaultOutputDir)) {
      return { totalFiles: 0, totalSize: "0 B", formats: [] };
    }

    const files = fs.readdirSync(this.defaultOutputDir);
    const formats = [...new Set(files.map((f) => path.extname(f).slice(1)))];

    let totalSize = 0;
    for (const file of files) {
      const filePath = path.join(this.defaultOutputDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }

    return {
      totalFiles: files.length,
      totalSize: this.formatBytes(totalSize),
      formats,
    };
  }

  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  // Clean up old exports
  cleanupOldExports(maxAgeHours: number = 168): void {
    // Default: 7 days
    if (!fs.existsSync(this.defaultOutputDir)) {
      return;
    }

    const files = fs.readdirSync(this.defaultOutputDir);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    let cleaned = 0;

    for (const file of files) {
      const filePath = path.join(this.defaultOutputDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🗑️  Cleaned up ${cleaned} old export files`);
    }
  }
}

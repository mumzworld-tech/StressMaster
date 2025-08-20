import chalk from "chalk";
import { TestResult, ExportFormat } from "../../types";
import { ResultDisplayManager } from "./result-display";
import { promises as fs } from "fs";
import path from "path";

export class ExportManager {
  private resultDisplay: ResultDisplayManager;

  constructor(resultDisplay: ResultDisplayManager) {
    this.resultDisplay = resultDisplay;
  }

  async handleExportCommand(input: string): Promise<void> {
    const parts = input.split(" ");
    if (parts.length < 3) {
      console.log(
        chalk.red("❌ Invalid export command. Use: export <format> <filename>")
      );
      console.log(chalk.gray("   Example: export json results.json"));
      return;
    }

    const format = parts[1] as ExportFormat;
    const filename = parts[2];

    if (!["json", "csv", "html"].includes(format)) {
      console.log(
        chalk.red("❌ Invalid format. Supported formats: json, csv, html")
      );
      return;
    }

    // For now, we'll show a placeholder since we need test results
    console.log(
      chalk.blue(
        `📤 Export functionality will be available after running a test`
      )
    );
    console.log(chalk.gray(`   Format: ${format}`));
    console.log(chalk.gray(`   Filename: ${filename}`));
    console.log();
  }

  async exportResults(
    results: TestResult,
    format: ExportFormat,
    filename?: string
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const defaultFilename = `load-test-${results.id}-${timestamp}.${format}`;
    const outputFile = filename || defaultFilename;

    try {
      let content: string;

      switch (format) {
        case "json":
          content = this.convertToJSON(results);
          break;
        case "csv":
          content = this.convertToCSV(results);
          break;
        case "html":
          content = this.convertToHTML(results);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      await fs.writeFile(outputFile, content, "utf-8");
      console.log(chalk.green(`✅ Results exported to: ${outputFile}`));
      return outputFile;
    } catch (error) {
      console.error(chalk.red(`❌ Export failed: ${error}`));
      throw error;
    }
  }

  private convertToJSON(results: TestResult): string {
    return JSON.stringify(results, null, 2);
  }

  private convertToCSV(results: TestResult): string {
    const lines: string[] = [];

    // Header
    lines.push("Metric,Value");

    // Basic metrics
    lines.push(`Total Requests,${results.metrics.totalRequests}`);
    lines.push(`Successful Requests,${results.metrics.successfulRequests}`);
    lines.push(`Failed Requests,${results.metrics.failedRequests}`);
    lines.push(
      `Success Rate,${(
        (results.metrics.successfulRequests / results.metrics.totalRequests) *
        100
      ).toFixed(2)}%`
    );
    lines.push(`Error Rate,${(results.metrics.errorRate * 100).toFixed(2)}%`);

    // Response times
    lines.push(`Min Response Time,${results.metrics.responseTime.min}ms`);
    lines.push(
      `Avg Response Time,${results.metrics.responseTime.avg.toFixed(2)}ms`
    );
    lines.push(`Max Response Time,${results.metrics.responseTime.max}ms`);
    lines.push(`P50 Response Time,${results.metrics.responseTime.p50}ms`);
    lines.push(`P90 Response Time,${results.metrics.responseTime.p90}ms`);
    lines.push(`P95 Response Time,${results.metrics.responseTime.p95}ms`);
    lines.push(`P99 Response Time,${results.metrics.responseTime.p99}ms`);

    // Throughput
    lines.push(
      `Requests Per Second,${results.metrics.throughput.requestsPerSecond.toFixed(
        2
      )}`
    );

    return lines.join("\n");
  }

  private convertToHTML(results: TestResult): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>StressMaster Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .metric { margin: 10px 0; }
        .metric-label { font-weight: bold; color: #333; }
        .metric-value { color: #666; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 StressMaster Test Results</h1>
        <p><strong>Test ID:</strong> ${results.id}</p>
        <p><strong>Started:</strong> ${results.startTime.toLocaleString()}</p>
        <p><strong>Duration:</strong> ${Math.round(
          (results.endTime.getTime() - results.startTime.getTime()) / 1000
        )}s</p>
    </div>
    
    <h2>📊 Performance Metrics</h2>
    <div class="metric">
        <span class="metric-label">Total Requests:</span>
        <span class="metric-value">${results.metrics.totalRequests}</span>
    </div>
    <div class="metric">
        <span class="metric-label">Successful:</span>
        <span class="metric-value success">${
          results.metrics.successfulRequests
        }</span>
    </div>
    <div class="metric">
        <span class="metric-label">Failed:</span>
        <span class="metric-value error">${
          results.metrics.failedRequests
        }</span>
    </div>
    <div class="metric">
        <span class="metric-label">Success Rate:</span>
        <span class="metric-value">${(
          (results.metrics.successfulRequests / results.metrics.totalRequests) *
          100
        ).toFixed(2)}%</span>
    </div>
    
    <h2>⏱️ Response Times</h2>
    <div class="metric">
        <span class="metric-label">Min:</span>
        <span class="metric-value">${results.metrics.responseTime.min}ms</span>
    </div>
    <div class="metric">
        <span class="metric-label">Average:</span>
        <span class="metric-value">${results.metrics.responseTime.avg.toFixed(
          2
        )}ms</span>
    </div>
    <div class="metric">
        <span class="metric-label">Max:</span>
        <span class="metric-value">${results.metrics.responseTime.max}ms</span>
    </div>
    <div class="metric">
        <span class="metric-label">P95:</span>
        <span class="metric-value">${results.metrics.responseTime.p95}ms</span>
    </div>
    
    <h2>💡 Recommendations</h2>
    <ul>
        ${results.recommendations.map((rec) => `<li>${rec}</li>`).join("")}
    </ul>
</body>
</html>`;
  }
}

import { AnalyzedResults, ExportFormat } from "../../types";

export interface ReportGenerator {
  generateJsonReport(results: AnalyzedResults): string;
  generateCsvReport(results: AnalyzedResults): string;
  generateHtmlReport(results: AnalyzedResults): string;
}

export class ReportGeneratorImpl implements ReportGenerator {
  generateJsonReport(results: AnalyzedResults): string {
    return JSON.stringify(results, null, 2);
  }

  generateCsvReport(results: AnalyzedResults): string {
    const metrics = results.testResult.metrics;
    const csvLines: string[] = [];

    // Header
    csvLines.push("Metric,Value,Unit");

    // Basic metrics
    csvLines.push(`Total Requests,${metrics.totalRequests},count`);
    csvLines.push(`Successful Requests,${metrics.successfulRequests},count`);
    csvLines.push(`Failed Requests,${metrics.failedRequests},count`);
    csvLines.push(`Error Rate,${(metrics.errorRate * 100).toFixed(2)},%`);

    // Response time metrics
    csvLines.push(`Average Response Time,${metrics.responseTime.avg},ms`);
    csvLines.push(`Min Response Time,${metrics.responseTime.min},ms`);
    csvLines.push(`Max Response Time,${metrics.responseTime.max},ms`);
    csvLines.push(`50th Percentile,${metrics.responseTime.p50},ms`);
    csvLines.push(`90th Percentile,${metrics.responseTime.p90},ms`);
    csvLines.push(`95th Percentile,${metrics.responseTime.p95},ms`);
    csvLines.push(`99th Percentile,${metrics.responseTime.p99},ms`);

    // Throughput metrics
    csvLines.push(
      `Requests Per Second,${metrics.throughput.requestsPerSecond},rps`
    );
    csvLines.push(`Bytes Per Second,${metrics.throughput.bytesPerSecond},bps`);

    return csvLines.join("\n");
  }

  generateHtmlReport(results: AnalyzedResults): string {
    const metrics = results.testResult.metrics;
    const testResult = results.testResult;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Load Test Report - ${testResult.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #007acc; margin: 0; }
        .header .meta { color: #666; margin-top: 10px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007acc; }
        .metric-card h3 { margin: 0 0 10px 0; color: #333; font-size: 14px; text-transform: uppercase; }
        .metric-card .value { font-size: 24px; font-weight: bold; color: #007acc; }
        .metric-card .unit { color: #666; font-size: 14px; }
        .insights { margin-top: 20px; }
        .insight { padding: 10px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid; }
        .insight.critical { background: #fff5f5; border-color: #e53e3e; }
        .insight.warning { background: #fffbf0; border-color: #dd6b20; }
        .insight.info { background: #f0f8ff; border-color: #3182ce; }
        .bottleneck { background: #f7fafc; padding: 15px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid #4a5568; }
        .bottleneck h4 { margin: 0 0 5px 0; color: #2d3748; }
        .bottleneck .component { color: #4a5568; font-size: 12px; text-transform: uppercase; font-weight: bold; }
        .bottleneck .impact { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
        .impact.high { background: #fed7d7; color: #c53030; }
        .impact.medium { background: #feebc8; color: #c05621; }
        .impact.low { background: #c6f6d5; color: #2f855a; }
        .recommendations { background: #f0fff4; padding: 20px; border-radius: 6px; border-left: 4px solid #38a169; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .recommendations li { margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .status-${testResult.status} { 
            display: inline-block; 
            padding: 4px 12px; 
            border-radius: 16px; 
            font-size: 12px; 
            font-weight: bold; 
            text-transform: uppercase;
        }
        .status-completed { background: #c6f6d5; color: #2f855a; }
        .status-failed { background: #fed7d7; color: #c53030; }
        .status-cancelled { background: #e2e8f0; color: #4a5568; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Load Test Report</h1>
            <div class="meta">
                <strong>Test ID:</strong> ${testResult.id}<br>
                <strong>Status:</strong> <span class="status-${
                  testResult.status
                }">${testResult.status}</span><br>
                <strong>Duration:</strong> ${
                  new Date(testResult.endTime).getTime() -
                  new Date(testResult.startTime).getTime()
                }ms<br>
                <strong>Start Time:</strong> ${new Date(
                  testResult.startTime
                ).toLocaleString()}<br>
                <strong>End Time:</strong> ${new Date(
                  testResult.endTime
                ).toLocaleString()}
            </div>
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Total Requests</h3>
                    <div class="value">${metrics.totalRequests.toLocaleString()}</div>
                </div>
                <div class="metric-card">
                    <h3>Success Rate</h3>
                    <div class="value">${(
                      (metrics.successfulRequests / metrics.totalRequests) *
                      100
                    ).toFixed(1)}</div>
                    <div class="unit">%</div>
                </div>
                <div class="metric-card">
                    <h3>Error Rate</h3>
                    <div class="value">${(metrics.errorRate * 100).toFixed(
                      2
                    )}</div>
                    <div class="unit">%</div>
                </div>
                <div class="metric-card">
                    <h3>Average Response Time</h3>
                    <div class="value">${metrics.responseTime.avg}</div>
                    <div class="unit">ms</div>
                </div>
                <div class="metric-card">
                    <h3>95th Percentile</h3>
                    <div class="value">${metrics.responseTime.p95}</div>
                    <div class="unit">ms</div>
                </div>
                <div class="metric-card">
                    <h3>Throughput</h3>
                    <div class="value">${metrics.throughput.requestsPerSecond.toFixed(
                      1
                    )}</div>
                    <div class="unit">req/s</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Response Time Metric</th>
                        <th>Value (ms)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>Minimum</td><td>${
                      metrics.responseTime.min
                    }</td></tr>
                    <tr><td>Maximum</td><td>${
                      metrics.responseTime.max
                    }</td></tr>
                    <tr><td>Average</td><td>${
                      metrics.responseTime.avg
                    }</td></tr>
                    <tr><td>50th Percentile</td><td>${
                      metrics.responseTime.p50
                    }</td></tr>
                    <tr><td>90th Percentile</td><td>${
                      metrics.responseTime.p90
                    }</td></tr>
                    <tr><td>95th Percentile</td><td>${
                      metrics.responseTime.p95
                    }</td></tr>
                    <tr><td>99th Percentile</td><td>${
                      metrics.responseTime.p99
                    }</td></tr>
                </tbody>
            </table>
        </div>

        ${
          results.performanceInsights.length > 0
            ? `
        <div class="section">
            <h2>Performance Insights</h2>
            <div class="insights">
                ${results.performanceInsights
                  .map(
                    (insight) => `
                    <div class="insight ${insight.severity}">
                        <strong>${insight.category
                          .replace("_", " ")
                          .toUpperCase()}:</strong> ${insight.message}
                        <br><em>Recommendation: ${insight.recommendation}</em>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>
        `
            : ""
        }

        ${
          results.bottlenecks.length > 0
            ? `
        <div class="section">
            <h2>Identified Bottlenecks</h2>
            ${results.bottlenecks
              .map(
                (bottleneck) => `
                <div class="bottleneck">
                    <div class="component">${bottleneck.component}</div>
                    <h4>${bottleneck.description}</h4>
                    <div class="impact ${bottleneck.impact}">Impact: ${bottleneck.impact}</div>
                    <p><strong>Suggested Fix:</strong> ${bottleneck.suggestedFix}</p>
                </div>
            `
              )
              .join("")}
        </div>
        `
            : ""
        }

        ${
          testResult.errors.length > 0
            ? `
        <div class="section">
            <h2>Error Details</h2>
            <table>
                <thead>
                    <tr>
                        <th>Error Type</th>
                        <th>Count</th>
                        <th>Percentage</th>
                        <th>Message</th>
                    </tr>
                </thead>
                <tbody>
                    ${testResult.errors
                      .map(
                        (error) => `
                        <tr>
                            <td>${error.errorType}</td>
                            <td>${error.count}</td>
                            <td>${error.percentage}%</td>
                            <td>${error.errorMessage || "N/A"}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        `
            : ""
        }

        ${
          testResult.recommendations.length > 0
            ? `
        <div class="section">
            <h2>Recommendations</h2>
            <div class="recommendations">
                <ul>
                    ${testResult.recommendations
                      .map((rec) => `<li>${rec}</li>`)
                      .join("")}
                </ul>
            </div>
        </div>
        `
            : ""
        }
    </div>
</body>
</html>
    `;
  }
}

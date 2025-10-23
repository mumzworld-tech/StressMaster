import { ChatMessage } from "@/types";

export type ExportFormat = "csv" | "html" | "json";

export interface ExportOptions {
  format: ExportFormat;
  includeTimestamps: boolean;
  includeMetadata: boolean;
  includeTestResults: boolean;
}

export interface SessionExport {
  sessionId: string;
  sessionName: string;
  exportDate: string;
  totalMessages: number;
  totalTests: number;
  messages: ChatMessage[];
  summary: {
    successfulTests: number;
    failedTests: number;
    totalRequests: number;
    averageResponseTime: number;
  };
}

class ExportService {
  /**
   * Export a chat session in the specified format
   */
  async exportSession(
    messages: ChatMessage[],
    options: ExportOptions,
    sessionName: string = "StressMaster Session"
  ): Promise<Blob> {
    const sessionExport = this.prepareSessionData(messages, sessionName);

    switch (options.format) {
      case "csv":
        return this.exportToCSV(sessionExport, options);
      case "html":
        return this.exportToHTML(sessionExport, options);
      case "json":
        return this.exportToJSON(sessionExport, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Prepare session data for export
   */
  private prepareSessionData(
    messages: ChatMessage[],
    sessionName: string
  ): SessionExport {
    const testMessages = messages.filter(
      (msg) =>
        msg.metadata?.commandType === "load-test" && msg.metadata?.testResults
    );

    const successfulTests = testMessages.filter(
      (msg) => msg.metadata?.testResults?.status === "completed"
    ).length;

    const failedTests = testMessages.filter(
      (msg) => msg.metadata?.testResults?.status === "failed"
    ).length;

    const totalRequests = testMessages.reduce(
      (sum, msg) =>
        sum + (msg.metadata?.testResults?.metrics?.totalRequests || 0),
      0
    );

    const totalResponseTime = testMessages.reduce(
      (sum, msg) =>
        sum + (msg.metadata?.testResults?.metrics?.averageResponseTime || 0),
      0
    );

    const averageResponseTime =
      testMessages.length > 0 ? totalResponseTime / testMessages.length : 0;

    return {
      sessionId: `session_${Date.now()}`,
      sessionName,
      exportDate: new Date().toISOString(),
      totalMessages: messages.length,
      totalTests: testMessages.length,
      messages,
      summary: {
        successfulTests,
        failedTests,
        totalRequests,
        averageResponseTime,
      },
    };
  }

  /**
   * Export to CSV format
   */
  private async exportToCSV(
    session: SessionExport,
    options: ExportOptions
  ): Promise<Blob> {
    const rows: string[] = [];

    // Header
    const headers = ["Timestamp", "Type", "Content"];
    if (options.includeTestResults) {
      headers.push(
        "Test Status",
        "Total Requests",
        "Success Rate",
        "Avg Response Time",
        "Requests/Second"
      );
    }
    rows.push(headers.join(","));

    // Data rows
    session.messages.forEach((message) => {
      const row = [
        this.escapeCSV(
          options.includeTimestamps ? message.timestamp.toISOString() : ""
        ),
        this.escapeCSV(message.type),
        this.escapeCSV(message.content),
      ];

      if (options.includeTestResults && message.metadata?.testResults) {
        const metrics = message.metadata.testResults.metrics;
        const successRate =
          metrics.totalRequests > 0
            ? Math.round(
                (metrics.successfulRequests / metrics.totalRequests) * 100
              )
            : 0;

        row.push(
          this.escapeCSV(message.metadata.testResults.status),
          this.escapeCSV(metrics.totalRequests.toString()),
          this.escapeCSV(`${successRate}%`),
          this.escapeCSV(`${metrics.averageResponseTime}ms`),
          this.escapeCSV(metrics.requestsPerSecond.toFixed(1))
        );
      } else if (options.includeTestResults) {
        row.push("", "", "", "", "");
      }

      rows.push(row.join(","));
    });

    // Summary section
    rows.push(""); // Empty row
    rows.push("SUMMARY");
    rows.push(`Total Messages,${session.totalMessages}`);
    rows.push(`Total Tests,${session.totalTests}`);
    rows.push(`Successful Tests,${session.summary.successfulTests}`);
    rows.push(`Failed Tests,${session.summary.failedTests}`);
    rows.push(`Total Requests,${session.summary.totalRequests}`);
    rows.push(
      `Average Response Time,${session.summary.averageResponseTime.toFixed(
        2
      )}ms`
    );

    return new Blob([rows.join("\n")], { type: "text/csv" });
  }

  /**
   * Export to HTML format
   */
  private async exportToHTML(
    session: SessionExport,
    options: ExportOptions
  ): Promise<Blob> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StressMaster Session Export - ${session.sessionName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #dc2626, #b91c1c);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 2.5em;
        }
        .header p {
            margin: 0;
            opacity: 0.9;
        }
        .summary {
            background: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .summary h2 {
            color: #dc2626;
            margin-top: 0;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .summary-item {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .summary-item .value {
            font-size: 2em;
            font-weight: bold;
            color: #dc2626;
        }
        .summary-item .label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }
        .messages {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .message {
            padding: 20px;
            border-bottom: 1px solid #eee;
        }
        .message:last-child {
            border-bottom: none;
        }
        .message.user {
            background: #f8f9fa;
        }
        .message.assistant {
            background: white;
        }
        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .message-type {
            font-weight: bold;
            color: #dc2626;
        }
        .message-time {
            color: #666;
            font-size: 0.9em;
        }
        .message-content {
            margin-bottom: 15px;
        }
        .test-results {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 15px;
        }
        .test-results h3 {
            margin-top: 0;
            color: #dc2626;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .metric {
            text-align: center;
            padding: 10px;
            background: white;
            border-radius: 6px;
        }
        .metric .value {
            font-size: 1.5em;
            font-weight: bold;
            color: #dc2626;
        }
        .metric .label {
            color: #666;
            font-size: 0.8em;
        }
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
        }
        .status.completed {
            background: #d1fae5;
            color: #065f46;
        }
        .status.failed {
            background: #fee2e2;
            color: #991b1b;
        }
        .status.running {
            background: #fef3c7;
            color: #92400e;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #666;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 StressMaster Session Export</h1>
        <p>${session.sessionName} • Exported on ${new Date(
      session.exportDate
    ).toLocaleString()}</p>
    </div>

    <div class="summary">
        <h2>📊 Session Summary</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="value">${session.totalMessages}</div>
                <div class="label">Total Messages</div>
            </div>
            <div class="summary-item">
                <div class="value">${session.totalTests}</div>
                <div class="label">Total Tests</div>
            </div>
            <div class="summary-item">
                <div class="value">${session.summary.successfulTests}</div>
                <div class="label">Successful Tests</div>
            </div>
            <div class="summary-item">
                <div class="value">${session.summary.failedTests}</div>
                <div class="label">Failed Tests</div>
            </div>
            <div class="summary-item">
                <div class="value">${session.summary.totalRequests}</div>
                <div class="label">Total Requests</div>
            </div>
            <div class="summary-item">
                <div class="value">${session.summary.averageResponseTime.toFixed(
                  0
                )}ms</div>
                <div class="label">Avg Response Time</div>
            </div>
        </div>
    </div>

    <div class="messages">
        ${session.messages
          .map((message) => this.renderMessageHTML(message, options))
          .join("")}
    </div>

    <div class="footer">
        <p>Generated by StressMaster AI • ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;

    return new Blob([html], { type: "text/html" });
  }

  /**
   * Render individual message HTML
   */
  private renderMessageHTML(
    message: ChatMessage,
    options: ExportOptions
  ): string {
    const timeStr = options.includeTimestamps
      ? new Date(message.timestamp).toLocaleString()
      : "";

    let testResultsHTML = "";
    if (options.includeTestResults && message.metadata?.testResults) {
      const metrics = message.metadata.testResults.metrics;
      const successRate =
        metrics.totalRequests > 0
          ? Math.round(
              (metrics.successfulRequests / metrics.totalRequests) * 100
            )
          : 0;

      testResultsHTML = `
        <div class="test-results">
          <h3>🧪 Test Results</h3>
          <div class="metrics-grid">
            <div class="metric">
              <div class="value">${metrics.totalRequests}</div>
              <div class="label">Total Requests</div>
            </div>
            <div class="metric">
              <div class="value">${successRate}%</div>
              <div class="label">Success Rate</div>
            </div>
            <div class="metric">
              <div class="value">${metrics.averageResponseTime}ms</div>
              <div class="label">Avg Response Time</div>
            </div>
            <div class="metric">
              <div class="value">${metrics.requestsPerSecond.toFixed(1)}</div>
              <div class="label">Requests/Second</div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="message ${message.type}">
        <div class="message-header">
          <span class="message-type">${
            message.type === "user" ? "👤 You" : "🤖 StressMaster AI"
          }</span>
          ${timeStr ? `<span class="message-time">${timeStr}</span>` : ""}
        </div>
        <div class="message-content">
          ${message.content.replace(/\n/g, "<br>")}
        </div>
        ${testResultsHTML}
      </div>
    `;
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(
    session: SessionExport,
    options: ExportOptions
  ): Promise<Blob> {
    const exportData = {
      metadata: {
        sessionId: session.sessionId,
        sessionName: session.sessionName,
        exportDate: session.exportDate,
        exportOptions: options,
        summary: session.summary,
      },
      messages: session.messages.map((message) => {
        const baseMessage = {
          id: message.id,
          type: message.type,
          content: message.content,
        };

        if (options.includeTimestamps) {
          (baseMessage as Record<string, unknown>).timestamp =
            message.timestamp.toISOString();
        }

        if (options.includeMetadata && message.metadata) {
          (baseMessage as Record<string, unknown>).metadata = message.metadata;
        }

        return baseMessage;
      }),
    };

    return new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
  }

  /**
   * Escape CSV values
   */
  private escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Download a blob as a file
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate filename for export
   */
  generateFilename(sessionName: string, format: ExportFormat): string {
    const timestamp = new Date().toISOString().split("T")[0];
    const cleanName = sessionName.replace(/[^a-zA-Z0-9]/g, "_");
    return `stressmaster_${cleanName}_${timestamp}.${format}`;
  }
}

export const exportService = new ExportService();

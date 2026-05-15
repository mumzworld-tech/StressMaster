import chalk from "chalk";
import { CommandHistoryManager } from "./command-history";
import {
  LoadTestHistoryManager,
  LoadTestHistoryEntry,
} from "./load-test-history-manager";

export class DisplayManager {
  private history: CommandHistoryManager;
  private loadTestHistory?: LoadTestHistoryManager;

  constructor(
    history: CommandHistoryManager,
    loadTestHistory?: LoadTestHistoryManager
  ) {
    this.history = history;
    this.loadTestHistory = loadTestHistory;
  }

  displayHelp(): void {
    console.log(chalk.blue.bold("📚 StressMaster Help"));
    console.log();

    console.log(chalk.yellow.bold("🎯 Basic Commands:"));
    console.log(chalk.gray("  help        - Show this help message"));
    console.log(chalk.gray("  history     - Show command history"));
    console.log(chalk.gray("  rerun       - Rerun the last command"));
    console.log(chalk.gray("  retry       - Rerun the last command (alias)"));
    console.log(chalk.gray("  try again   - Rerun the last command (alias)"));
    console.log(chalk.gray("  rerun <n>   - Rerun command #n from history"));
    console.log(chalk.gray("  retry <n>   - Rerun command #n from history"));
    console.log(chalk.gray("  clear       - Clear the screen"));
    console.log(chalk.gray("  exit        - Exit StressMaster"));
    console.log();
    
    console.log(chalk.cyan.bold("🔄 Retry Functionality:"));
    console.log(
      chalk.green("  ✓ Retry works! You can rerun any command from history.")
    );
    console.log(
      chalk.gray("  • Use 'retry' or 'rerun' to rerun your last command")
    );
    console.log(
      chalk.gray("  • Use 'retry 3' to rerun command #3 from history")
    );
    console.log(
      chalk.gray("  • Just type a number (e.g., '3') as a shortcut to rerun that command")
    );
    console.log(
      chalk.gray("  • View history with 'history' to see numbered commands")
    );
    console.log();

    console.log(chalk.yellow.bold("🚀 Load Testing Commands:"));
    console.log(
      chalk.gray("  send 100 GET requests to https://api.example.com")
    );
    console.log(chalk.gray("  spike test with 1000 requests in 10 seconds"));
    console.log(
      chalk.gray("  stress test ramping up to 50 RPS over 5 minutes")
    );
    console.log(chalk.gray("  endurance test at 10 RPS for 30 minutes"));
    console.log();

    console.log(chalk.yellow.bold("📊 Export Commands:"));
    console.log(
      chalk.gray("  export json                    - Export last test as JSON")
    );
    console.log(
      chalk.gray("  export csv                     - Export last test as CSV")
    );
    console.log(
      chalk.gray("  export html                    - Export last test as HTML")
    );
    console.log(
      chalk.gray("  export json --include-raw      - Include raw data")
    );
    console.log(
      chalk.gray(
        "  export html --include-recommendations - Include recommendations"
      )
    );
    console.log();

    console.log(chalk.yellow.bold("🔧 OpenAPI Commands:"));
    console.log(
      chalk.gray(
        "  openapi parse <file>                    - Parse OpenAPI specification"
      )
    );
    console.log(
      chalk.gray(
        "  openapi list <file> [options]           - List all endpoints"
      )
    );
    console.log(
      chalk.gray(
        "  openapi payloads <file> [options]       - Generate payloads for endpoints"
      )
    );
    console.log(
      chalk.gray(
        "  openapi curl <file> [baseUrl]           - Generate cURL commands"
      )
    );
    console.log();

    console.log(chalk.yellow.bold("🔧 OpenAPI Options:"));
    console.log(
      chalk.gray(
        "  --method <method>                       - Filter by HTTP method (GET, POST, etc.)"
      )
    );
    console.log(
      chalk.gray(
        "  --tag <tag>                            - Filter by tag (users, orders, etc.)"
      )
    );
    console.log(
      chalk.gray(
        "  --path <path>                          - Filter by path pattern"
      )
    );
    console.log(
      chalk.gray(
        "  --has-body                             - Only endpoints with request body"
      )
    );
    console.log(
      chalk.gray(
        "  --no-body                              - Only endpoints without request body"
      )
    );
    console.log();

    console.log(chalk.yellow.bold("🔧 OpenAPI Examples:"));
    console.log(chalk.gray("  openapi parse api.yaml"));
    console.log(chalk.gray("  openapi list api.yaml --method POST"));
    console.log(chalk.gray("  openapi payloads api.yaml --tag users"));
    console.log(chalk.gray("  openapi curl api.yaml https://api.example.com"));
    console.log();

    console.log(chalk.yellow.bold("🤖 AI-Powered OpenAPI Testing:"));
    console.log(
      chalk.gray("  send 10 POST requests to @api.yaml users endpoint")
    );
    console.log(
      chalk.gray(
        "  load test the products API from @api.yaml with realistic data"
      )
    );
    console.log(
      chalk.gray("  test all POST endpoints in @api.yaml with 20 requests each")
    );
    console.log(
      chalk.gray(
        "  spike test the orders API from @api.yaml with 100 requests in 30 seconds"
      )
    );
    console.log();

    console.log(chalk.yellow.bold("🔄 Workflow Testing:"));
    console.log(
      chalk.gray(
        "  first GET @api.yaml users, then POST @api.yaml orders with user from step 1"
      )
    );
    console.log(
      chalk.gray(
        "  start by getting auth token, then simultaneously fetch products and categories"
      )
    );
    console.log(
      chalk.gray(
        "  first GET https://api.com/users, then POST https://api.com/orders, then PUT https://api.com/users/{id}"
      )
    );
    console.log();

    console.log(chalk.yellow.bold("💡 Tips:"));
    console.log(
      chalk.gray("  • Use natural language to describe your load test")
    );
    console.log(chalk.gray("  • Include HTTP method, URL, headers, and body"));
    console.log(
      chalk.gray("  • Specify test type: spike, stress, endurance, volume")
    );
    console.log(
      chalk.gray("  • Add 'increment field_name' for dynamic values")
    );
    console.log(
      chalk.gray("  • Use @filename.yaml to reference OpenAPI specs")
    );
    console.log(
      chalk.gray(
        "  • AI will automatically analyze OpenAPI files and generate realistic payloads"
      )
    );
    console.log(
      chalk.green("  • Retry functionality: Use 'retry', 'rerun', or type a number to rerun commands")
    );
    console.log();
  }

  displayHistory(options: { full?: boolean; limit?: number } = {}): void {
    const limit = options.limit || 20;
    const historyEntries = this.history.getHistory().slice(0, limit);

    if (historyEntries.length === 0) {
      console.log(chalk.yellow("📝 No command history found."));
      return;
    }

    console.log(chalk.blue.bold(`📝 Recent Commands (${historyEntries.length}):`));
    console.log();

    historyEntries.forEach((entry, index) => {
      const number = chalk.cyan(`${index + 1}.`);
      const timestamp = chalk.gray(
        `[${entry.timestamp.toLocaleTimeString()}]`
      );
      const statusIcon =
        entry.result === "success"
          ? chalk.green("✓")
          : entry.result === "error"
          ? chalk.red("✗")
          : chalk.yellow("○");

      // Show full command or wrap it
      if (options.full || entry.command.length <= 80) {
        // Show full command
        console.log(
          `${number} ${statusIcon} ${timestamp} ${chalk.gray(entry.command)}`
        );

        // Show additional metadata for load tests
        if (entry.isLoadTest) {
          const testInfo = [
            entry.testName && chalk.cyan(`Test: ${entry.testName}`),
            entry.testType && chalk.blue(`Type: ${entry.testType}`),
            entry.metrics?.totalRequests &&
              chalk.gray(`Requests: ${entry.metrics.totalRequests}`),
            entry.metrics?.successRate !== undefined &&
              chalk.gray(
                `Success: ${(entry.metrics.successRate * 100).toFixed(1)}%`
              ),
          ]
            .filter(Boolean)
            .join(" | ");

          if (testInfo) {
            console.log(
              chalk.gray(`   ${" ".repeat(4)}${testInfo}`)
            );
          }
        }
      } else {
        // Wrap long commands
        const maxWidth = process.stdout.columns || 100;
        const indent = "   ";
        const availableWidth = maxWidth - indent.length - 10; // Account for number and status

        let remaining = entry.command;
        let isFirstLine = true;

        while (remaining.length > 0) {
          const line =
            remaining.length > availableWidth
              ? remaining.substring(0, availableWidth)
              : remaining;
          remaining = remaining.substring(line.length);

          if (isFirstLine) {
            console.log(
              `${number} ${statusIcon} ${timestamp} ${chalk.gray(line)}`
            );
            isFirstLine = false;
          } else {
            console.log(`${chalk.gray(indent + line)}`);
          }
        }
      }
    });

    console.log();
    console.log(
      chalk.gray("💡 Tip: Use 'rerun', 'retry', or 'try again' to rerun the last command")
    );
    console.log(
      chalk.gray("💡 Tip: Use 'rerun <number>', 'retry <number>', or just type a number to rerun a specific command")
    );
    if (!options.full) {
      console.log(
        chalk.gray("💡 Use 'history --full' to see full commands without wrapping")
      );
    }
    console.log();
  }

  displayCommandSuggestions(): string[] {
    return [
      "Send 100 GET requests to https://api.example.com",
      "Spike test with 1000 requests in 10 seconds to https://api.example.com/users",
      "Stress test ramping up to 50 RPS over 5 minutes",
      "Load test 200 POST requests with random user data",
      "Endurance test at 10 RPS for 30 minutes",
      "Send 50 PUT requests with JSON payload to https://api.example.com/items",
      "send 10 POST requests to @api.yaml users endpoint",
      "load test the products API from @api.yaml with realistic data",
      "test all POST endpoints in @api.yaml with 20 requests each",
      "openapi parse api.yaml",
      "openapi payloads api.yaml --tag users",
      "Volume test with 500 requests to https://api.example.com/search",
      "Baseline test with 10 requests to https://api.example.com/health",
      "Send 25 DELETE requests to https://api.example.com/items/123",
      "Load test with authentication header to https://api.example.com/protected",
    ];
  }

  displayExportHelp(): void {
    console.log(chalk.blue.bold("📤 Export Options:"));
    console.log();
    console.log(chalk.gray("  export json <filename>  - Export as JSON"));
    console.log(chalk.gray("  export csv <filename>   - Export as CSV"));
    console.log(chalk.gray("  export html <filename>  - Export as HTML"));
    console.log();
    console.log(chalk.yellow("💡 Example: export json my-test-results.json"));
    console.log();
  }

  displayError(message: string): void {
    console.error(chalk.red(`❌ Error: ${message}`));
  }

  displayWarning(message: string): void {
    console.warn(chalk.yellow(`⚠️  Warning: ${message}`));
  }

  displaySuccess(message: string): void {
    console.log(chalk.green(`✅ ${message}`));
  }

  displayInfo(message: string): void {
    console.log(chalk.blue(`ℹ️  ${message}`));
  }

  /**
   * Display load test history with full details
   */
  displayLoadTestHistory(
    options: { limit?: number; search?: string; full?: boolean } = {}
  ): void {
    if (!this.loadTestHistory) {
      console.log(chalk.yellow("📝 Load test history not available."));
      return;
    }

    let entries: LoadTestHistoryEntry[];

    if (options.search) {
      entries = this.loadTestHistory.searchHistory(options.search);
    } else {
      entries = this.loadTestHistory.getRecentEntries(options.limit || 20);
    }

    if (entries.length === 0) {
      console.log(chalk.yellow("📝 No load test history found."));
      return;
    }

    console.log(
      chalk.blue.bold(`📊 Load Test History (${entries.length}):`)
    );
    console.log();

    entries.forEach((entry, index) => {
      const number = chalk.cyan(`${index + 1}.`);
      const timestamp = chalk.gray(
        `[${entry.timestamp.toLocaleString()}]`
      );
      const statusIcon =
        entry.status === "completed"
          ? chalk.green("✓")
          : entry.status === "failed"
          ? chalk.red("✗")
          : chalk.yellow("○");

      // Test name and status
      console.log(
        `${number} ${statusIcon} ${timestamp} ${chalk.cyan(entry.parsedSpec.name)}`
      );

      // Original command (full or wrapped)
      if (options.full || entry.originalCommand.length <= 100) {
        console.log(
          chalk.gray(`   Command: ${entry.originalCommand}`)
        );
      } else {
        // Wrap long commands
        const maxWidth = process.stdout.columns || 100;
        const indent = "   Command: ";
        const availableWidth = maxWidth - indent.length;

        let remaining = entry.originalCommand;
        let isFirstLine = true;

        while (remaining.length > 0) {
          const line =
            remaining.length > availableWidth
              ? remaining.substring(0, availableWidth)
              : remaining;
          remaining = remaining.substring(line.length);

          if (isFirstLine) {
            console.log(chalk.gray(`${indent}${line}`));
            isFirstLine = false;
          } else {
            console.log(chalk.gray(`${" ".repeat(indent.length)}${line}`));
          }
        }
      }

      // Test details
      const details = [
        chalk.blue(`Type: ${entry.parsedSpec.testType}`),
        entry.parsedSpec.requests.length > 0 &&
          chalk.gray(
            `URL: ${entry.parsedSpec.requests[0].url}`
          ),
        entry.parsedSpec.requests.length > 0 &&
          chalk.gray(
            `Method: ${entry.parsedSpec.requests[0].method}`
          ),
        entry.executionTime > 0 &&
          chalk.gray(`Duration: ${(entry.executionTime / 1000).toFixed(2)}s`),
      ]
        .filter(Boolean)
        .join(" | ");

      if (details) {
        console.log(chalk.gray(`   ${details}`));
      }

      // Metrics if available
      if (entry.testResult?.metrics) {
        const metrics = entry.testResult.metrics;
        const metricsInfo = [
          metrics.totalRequests &&
            chalk.gray(`Requests: ${metrics.totalRequests}`),
          metrics.successfulRequests !== undefined &&
            chalk.green(
              `Success: ${metrics.successfulRequests}/${metrics.totalRequests}`
            ),
          metrics.failedRequests !== undefined &&
            metrics.failedRequests > 0 &&
            chalk.red(`Failed: ${metrics.failedRequests}`),
          metrics.responseTime?.avg !== undefined &&
            chalk.gray(
              `Avg Response: ${metrics.responseTime.avg.toFixed(2)}ms`
            ),
        ]
          .filter(Boolean)
          .join(" | ");

        if (metricsInfo) {
          console.log(chalk.gray(`   ${metricsInfo}`));
        }
      }

      console.log(); // Empty line between entries
    });

    // Show statistics
    const stats = this.loadTestHistory.getStatistics();
    console.log(chalk.gray("─".repeat(60)));
    console.log(
      chalk.gray(
        `Total: ${stats.total} | ` +
          `✓ ${stats.successful} | ` +
          `✗ ${stats.failed} | ` +
          `○ ${stats.cancelled} | ` +
          `Avg Time: ${(stats.averageExecutionTime / 1000).toFixed(2)}s`
      )
    );
    console.log();
  }
}

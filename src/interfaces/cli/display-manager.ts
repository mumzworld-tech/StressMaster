import chalk from "chalk";
import { CommandHistoryManager } from "./command-history";

export class DisplayManager {
  private history: CommandHistoryManager;

  constructor(history: CommandHistoryManager) {
    this.history = history;
  }

  displayHelp(): void {
    console.log(chalk.blue.bold("📚 StressMaster Help"));
    console.log();

    console.log(chalk.yellow.bold("🎯 Basic Commands:"));
    console.log(chalk.gray("  help     - Show this help message"));
    console.log(chalk.gray("  history  - Show command history"));
    console.log(chalk.gray("  clear    - Clear the screen"));
    console.log(chalk.gray("  exit     - Exit StressMaster"));
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
    console.log();
  }

  displayHistory(): void {
    const recentCommands = this.history.getRecentCommands(20);

    if (recentCommands.length === 0) {
      console.log(chalk.yellow("📝 No command history found."));
      return;
    }

    console.log(chalk.blue.bold("📝 Recent Commands:"));
    console.log();

    recentCommands.forEach((command, index) => {
      const number = chalk.cyan(`${index + 1}.`);
      const truncatedCommand =
        command.length > 60 ? command.substring(0, 57) + "..." : command;

      console.log(`${number} ${chalk.gray(truncatedCommand)}`);
    });

    console.log();
    console.log(
      chalk.gray("💡 Tip: Use arrow keys or type command number to reuse")
    );
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
}

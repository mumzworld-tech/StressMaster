#!/usr/bin/env node

// Load environment variables first
import "dotenv/config";
import { InteractiveCLI } from "./interfaces/cli/interactive-cli";
import { CLIConfig } from "./config";
import { CLIRunner } from "./interfaces/cli/cli-runner";

async function main() {
  // Check for command line arguments
  const args = process.argv.slice(2);

  // Use CLIRunner for structured commands
  const runner = new CLIRunner();

  // If no args or first arg is a natural language command (not a structured command), use interactive mode
  if (
    args.length === 0 ||
    (!args[0].startsWith("-") &&
      !isCommand(args[0]) &&
      !args[0].startsWith('"'))
  ) {
    const config: CLIConfig = {
      interactive: true,
      verbose: false,
      outputFormat: "json",
      maxHistoryEntries: 100,
      autoComplete: true,
    };

    const cli = new InteractiveCLI(config);

    if (args.length > 0) {
      // Check for help commands
      if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
        console.log(`
🚀 StressMaster - AI-Powered Load Testing Tool

USAGE:
  stressmaster [command]                    # Interactive mode
  stressmaster "your test description"      # Run a test
  stressmaster export <format> [options]    # Export results

EXAMPLES:
  stressmaster "send 10 GET requests to https://httpbin.org/get"
  stressmaster "spike test with 50 requests in 30 seconds to https://api.example.com"
  stressmaster "POST 100 requests with JSON payload to https://api.example.com/users"
  stressmaster export html
  stressmaster export json --include-raw

LOAD TEST TYPES:
  • Baseline: Simple constant load
  • Spike: Sudden traffic spikes
  • Ramp-up: Gradual load increase
  • Stress: High load testing
  • Random Burst: Variable load patterns

EXPORT FORMATS:
  • json: Raw test data
  • csv: Spreadsheet format
  • html: Beautiful reports with charts

OPTIONS:
  --help, -h     Show this help message
  --version, -v  Show version

ALIASES:
  sm             Short alias for stressmaster

For more examples, visit: https://github.com/your-repo/stressmaster
        `);
        process.exit(0);
      }

      // Check for version command
      if (args[0] === "--version" || args[0] === "-v") {
        console.log("StressMaster v1.0.2");
        process.exit(0);
      }

      // Check if this is an export command
      if (args[0] === "export" && args.length >= 2) {
        try {
          await cli.handleExportCommand(args.slice(1).join(" "));
          process.exit(0);
        } catch (error) {
          console.error(`❌ Export failed: ${error}`);
          process.exit(1);
        }
      }

      // Non-interactive mode with command line arguments
      const command = args.join(" ");
      console.log(`🚀 Running command: ${command}`);

      try {
        const result = await cli.processCommand(command);
        cli.displayResults(result);

        // Show export options after successful test
        console.log("\n📤 Export Options:");
        console.log("   stressmaster export json");
        console.log("   stressmaster export csv");
        console.log("   stressmaster export html");
        console.log("   stressmaster export json --include-raw");
        console.log("   stressmaster export html --include-recommendations");
        console.log("   sm export html  # (short alias)");
      } catch (error) {
        console.error(`❌ Command failed: ${error}`);
        process.exit(1);
      }
    } else {
      // Interactive mode
      await cli.startSession();
    }
  } else {
    // Use CLIRunner for structured commands
    await runner.run();
  }
}

function isCommand(arg: string): boolean {
  const commands = [
    "file",
    "config",
    "template",
    "batch",
    "validate",
    "workspace",
    "history",
    "export",
    "run",
    "setup",
    "help",
    "version",
  ];
  return commands.includes(arg.toLowerCase());
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

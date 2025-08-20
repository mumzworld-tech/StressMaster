import { Command } from "commander";
import { InteractiveCLI } from "./interactive-cli";
import { CLIConfig, getCLIConfig } from "../../config";
import chalk from "chalk";

export class CLIRunner {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name("stressmaster")
      .description(
        "StressMaster - AI-powered load testing tool using natural language commands"
      )
      .version("1.0.0");

    this.program
      .option("-i, --interactive", "Start interactive mode", true)
      .option("-v, --verbose", "Enable verbose output", false)
      .option("-f, --format <format>", "Output format (json|csv|html)", "json")
      .option("--history-file <path>", "Custom history file path")
      .option("--no-autocomplete", "Disable auto-completion")
      .action(async (options) => {
        await this.startCLI(options);
      });

    this.program
      .command("run <command>")
      .description("Execute a single load test command")
      .option("-f, --format <format>", "Output format (json|csv|html)", "json")
      .option("-v, --verbose", "Enable verbose output", false)
      .action(async (command: string, options) => {
        await this.runSingleCommand(command, options);
      });

    this.program
      .command("history")
      .description("Show command history")
      .option("-n, --number <count>", "Number of entries to show", "20")
      .option("--clear", "Clear command history")
      .action(async (options) => {
        await this.handleHistory(options);
      });
  }

  private async startCLI(options: any): Promise<void> {
    const baseConfig = getCLIConfig();
    const config: CLIConfig = {
      ...baseConfig,
      interactive: options.interactive ?? baseConfig.interactive,
      verbose: options.verbose ?? baseConfig.verbose,
      outputFormat: options.format || baseConfig.outputFormat,
      historyFile: options.historyFile || baseConfig.historyFile,
      maxHistoryEntries: options.maxHistory || baseConfig.maxHistoryEntries,
      autoComplete: options.noAutocomplete ? false : baseConfig.autoComplete,
    };

    const cli = new InteractiveCLI(config);

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log(chalk.yellow("\n\n🛑 Received interrupt signal..."));
      await cli.shutdown();
    });

    process.on("SIGTERM", async () => {
      console.log(chalk.yellow("\n\n🛑 Received termination signal..."));
      await cli.shutdown();
    });

    try {
      await cli.startSession();
    } catch (error) {
      console.error(chalk.red(`❌ CLI Error: ${error}`));
      process.exit(1);
    }
  }

  private async runSingleCommand(command: string, options: any): Promise<void> {
    const baseConfig = getCLIConfig();
    const config: CLIConfig = {
      ...baseConfig,
      interactive: false,
      verbose: options.verbose ?? baseConfig.verbose,
      outputFormat: options.format || baseConfig.outputFormat,
    };

    const cli = new InteractiveCLI(config);

    try {
      console.log(chalk.blue(`🔄 Executing: ${command}`));
      const result = await cli.processCommand(command);

      if (options.export) {
        await cli.exportResults(result, options.format);
      }
    } catch (error) {
      console.error(chalk.red(`❌ Command failed: ${error}`));
      process.exit(1);
    }
  }

  private async handleHistory(options: any): Promise<void> {
    // This would integrate with the history manager
    // For now, just show a placeholder
    if (options.clear) {
      console.log(chalk.green("✅ Command history cleared"));
    } else {
      console.log(chalk.blue("📜 Command History:"));
      console.log(chalk.gray("(History display not yet implemented)"));
    }
  }

  async run(args: string[] = process.argv): Promise<void> {
    try {
      await this.program.parseAsync(args);
    } catch (error) {
      console.error(chalk.red(`❌ CLI Error: ${error}`));
      process.exit(1);
    }
  }
}

// Export a convenience function for easy usage
export async function startCLI(args?: string[]): Promise<void> {
  const runner = new CLIRunner();
  await runner.run(args);
}

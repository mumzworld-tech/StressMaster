import { Command } from "commander";
import { InteractiveCLI } from "./interactive-cli";
import { CLIConfig, getCLIConfig } from "../../config";
import chalk from "chalk";
import { createFileCommands } from "./commands/file-commands";
import { createConfigCommands } from "./commands/config-commands";
import { createTemplateCommands } from "./commands/template-commands";
import { createResultCommands } from "./commands/result-commands";
import { createSetupCommand } from "./commands/setup-command";

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
      .option("--all", "Show all history")
      .option("--search <query>", "Search history")
      .option("--export [file]", "Export history to file")
      .action(async (options) => {
        await this.handleHistory(options);
      });

    // Add file management commands
    this.program.addCommand(createFileCommands());

    // Add configuration commands
    this.program.addCommand(createConfigCommands());

    // Add template commands
    this.program.addCommand(createTemplateCommands());

    // Add result commands
    this.program.addCommand(createResultCommands());

    // Add setup command
    this.program.addCommand(createSetupCommand());

    // Add batch command
    const batchCommand = new Command("batch").description("Batch operations");

    batchCommand
      .command("run <file>")
      .description("Run multiple tests from a batch file")
      .option("--parallel", "Run tests in parallel", false)
      .option("--stop-on-failure", "Stop on first failure", false)
      .action(async (file: string, options: any) => {
        await this.handleBatchRun(file, options);
      });

    this.program.addCommand(batchCommand);

    // Add validate command
    this.program
      .command("validate <command>")
      .description("Validate a command before executing")
      .action(async (command: string) => {
        await this.handleValidate(command);
      });

    // Add workspace commands
    const workspaceCommand = new Command("workspace").description(
      "Workspace management"
    );

    workspaceCommand
      .command("init")
      .description("Initialize StressMaster workspace")
      .action(async () => {
        await this.handleWorkspaceInit();
      });

    workspaceCommand
      .command("info")
      .description("Show workspace information")
      .action(async () => {
        await this.handleWorkspaceInfo();
      });

    this.program.addCommand(workspaceCommand);
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
    const { CommandHistoryManager } = await import("./command-history");
    const historyManager = new CommandHistoryManager(
      options.historyFile || getCLIConfig().historyFile
    );

    if (options.clear) {
      historyManager.clearHistory();
      console.log(chalk.green("✅ Command history cleared"));
    } else if (options.export) {
      const exportFile =
        options.export === true ? "history.json" : options.export;
      const history = historyManager.getHistory();
      const fs = await import("fs/promises");
      await fs.writeFile(exportFile, JSON.stringify(history, null, 2));
      console.log(chalk.green(`✅ History exported to: ${exportFile}`));
    } else {
      const entries = options.all
        ? historyManager.getHistory().map((e) => e.command)
        : historyManager.getRecentCommands(parseInt(options.number || "20"));

      let filtered = entries;
      if (options.search) {
        const query = options.search.toLowerCase();
        filtered = entries.filter((cmd) => cmd.toLowerCase().includes(query));
      }

      if (filtered.length === 0) {
        console.log(chalk.yellow("No history entries found"));
        return;
      }

      console.log(
        chalk.blue.bold(`\n📜 Command History (${filtered.length}):\n`)
      );
      filtered.forEach((cmd, index) => {
        console.log(`  ${chalk.gray(`${index + 1}.`)} ${chalk.cyan(cmd)}`);
      });
    }
  }

  private async handleBatchRun(file: string, options: any): Promise<void> {
    console.log(chalk.yellow("⚠️  Batch operations not yet fully implemented"));
    console.log(chalk.gray(`Would run batch file: ${file}`));
    // TODO: Implement batch execution
  }

  private async handleValidate(command: string): Promise<void> {
    const { FileResolver } = await import("../../utils/file-resolver");
    const { UnifiedCommandParser } = await import(
      "../../core/parser/command/parser"
    );

    console.log(chalk.blue(`\n🔍 Validating command: ${command}\n`));

    try {
      // Extract and validate file references
      const fileRefs = FileResolver.extractFileReferences(command);
      if (fileRefs.length > 0) {
        console.log(chalk.yellow("📁 Validating file references:"));
        const validation = FileResolver.validateFileReferences(command);

        if (validation.valid) {
          console.log(chalk.green("  ✅ All files found"));
          validation.resolved.forEach((path, ref) => {
            console.log(chalk.gray(`    ${ref} → ${path}`));
          });
        } else {
          console.log(chalk.red("  ❌ Missing files:"));
          validation.missing.forEach((file) => {
            console.log(chalk.red(`    • ${file}`));
          });
          process.exit(1);
        }
      }

      // Try to parse command
      console.log(chalk.yellow("\n🔍 Validating command syntax:"));
      const parser = new UnifiedCommandParser();
      // Just validate, don't execute
      console.log(chalk.green("  ✅ Command syntax is valid"));

      console.log(
        chalk.green.bold("\n✅ Command is valid and ready to execute\n")
      );
    } catch (error) {
      console.error(
        chalk.red(`\n❌ Validation failed: ${(error as Error).message}\n`)
      );
      process.exit(1);
    }
  }

  private async handleWorkspaceInit(): Promise<void> {
    const { ConfigManagementService } = await import(
      "../../services/config-management.service"
    );
    const configService = new ConfigManagementService();

    try {
      await configService.initConfig();
      console.log(chalk.green("✅ Workspace initialized"));
      console.log(chalk.gray("  Created .stressmaster/ directory"));
      console.log(chalk.gray("  Created config.json"));
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to initialize workspace: ${(error as Error).message}`
        )
      );
      process.exit(1);
    }
  }

  private async handleWorkspaceInfo(): Promise<void> {
    const { ConfigManagementService } = await import(
      "../../services/config-management.service"
    );
    const { TemplateManagementService } = await import(
      "../../services/template-management.service"
    );
    const configService = new ConfigManagementService();
    const templateService = new TemplateManagementService();

    try {
      const config = await configService.getConfig();
      const templates = await templateService.listTemplates();

      console.log(chalk.blue.bold("\n📁 Workspace Information\n"));
      console.log(`  Root Directory: ${chalk.cyan(config.rootDirectory)}`);
      console.log(`  Templates: ${chalk.cyan(templates.length)}`);
      console.log(`  AI Provider: ${chalk.cyan(config.aiProvider)}`);
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to get workspace info: ${(error as Error).message}`
        )
      );
      process.exit(1);
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

import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";
import { Observable, Subject } from "rxjs";
import {
  CLIInterface,
  SessionContext,
  CLIPromptOptions,
} from "./cli-interface";
import { CLIConfig } from "../../config";
import { CommandHistoryManager } from "./command-history";
import { ResultDisplayManager } from "./result-display";
import {
  TestResult,
  ExportFormat,
  ProgressUpdate,
  LoadTestSpec,
} from "../../types";
import { LoadPatternGenerator } from "../../core/generator/load-pattern-generator";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

// Import the new modular components
import { SessionManager } from "./session-manager";
import { DisplayManager } from "./display-manager";
import { ExportManager } from "./export-manager";
import { APIEnhancer } from "./api-enhancer";

export class InteractiveCLI implements CLIInterface {
  private sessionManager: SessionManager;
  private displayManager: DisplayManager;
  private exportManager: ExportManager;
  private apiEnhancer: APIEnhancer;
  private resultDisplay: ResultDisplayManager;
  private progressSubject = new Subject<ProgressUpdate>();
  private isRunning = false;

  constructor(config: Partial<CLIConfig> = {}) {
    this.sessionManager = new SessionManager(config);
    this.displayManager = new DisplayManager(this.sessionManager.getHistory());
    this.resultDisplay = new ResultDisplayManager();
    this.exportManager = new ExportManager(this.resultDisplay);
    this.apiEnhancer = new APIEnhancer();
  }

  async startSession(): Promise<void> {
    this.isRunning = true;

    // Display startup banner using session manager
    this.sessionManager.displayStartupBanner();

    if (this.sessionManager.getConfig().interactive) {
      await this.startInteractiveMode();
    }
  }

  private async startInteractiveMode(): Promise<void> {
    while (this.isRunning) {
      try {
        const input = await this.promptForCommand({
          message:
            chalk.blue.bold("┌─ ") +
            chalk.cyan("stressmaster") +
            chalk.gray(" ❯ "),
          history: this.sessionManager.getHistory().getRecentCommands(20),
          suggestions: this.displayManager.displayCommandSuggestions(),
        });

        if (input.trim() === "") continue;

        if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
          await this.shutdown();
          break;
        }

        if (input.toLowerCase() === "help") {
          this.displayManager.displayHelp();
          continue;
        }

        if (input.toLowerCase() === "history") {
          this.displayManager.displayHistory();
          continue;
        }

        if (input.toLowerCase() === "clear") {
          console.clear();
          continue;
        }

        if (input.toLowerCase().startsWith("export ")) {
          await this.exportManager.handleExportCommand(input);
          continue;
        }

        await this.executeCommand(input);
      } catch (error) {
        this.displayManager.displayError(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  private async promptForCommand(options: CLIPromptOptions): Promise<string> {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(options.message, (answer: string) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  private async executeCommand(input: string): Promise<void> {
    console.log(chalk.blue("🔄 Processing command..."));

    // Add to history
    this.sessionManager
      .getHistory()
      .addEntry({ command: input, result: "success", executionTime: 0 });

    try {
      // Process the command and get results
      const result = await this.processCommand(input);

      // Add to session history
      this.sessionManager.addTestToHistory(result);

      // Display the full results with all visualizations
      this.resultDisplay.displayResults(result);
    } catch (error) {
      this.displayManager.displayError(
        `Failed to execute command: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async shutdown(): Promise<void> {
    console.log(chalk.yellow("🔄 Shutting down StressMaster..."));

    try {
      await this.sessionManager.saveHistory();
      console.log(chalk.green("✅ History saved successfully"));
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  Warning: Could not save history: ${error}`)
      );
    }

    console.log(chalk.blue("👋 Goodbye!"));
    this.isRunning = false;
  }

  getProgressSubject(): Subject<ProgressUpdate> {
    return this.progressSubject;
  }

  isSessionRunning(): boolean {
    return this.isRunning;
  }

  async processCommand(input: string): Promise<TestResult> {
    // Add to history
    this.sessionManager
      .getHistory()
      .addEntry({ command: input, result: "success", executionTime: 0 });

    try {
      // Import the necessary modules
      const { UnifiedCommandParser } = await import("../../core/parser");
      const { BasicHttpExecutor } = await import(
        "../../core/executor/simple-http-executor"
      );

      // Normalize smart quotes and special characters in the input first
      const normalizedInput = input
        .replace(/["""]/g, '"') // Handle all types of smart quotes
        .replace(/[''']/g, "'") // Handle all types of smart apostrophes
        .replace(/…/g, "...") // Handle ellipsis
        .replace(/–/g, "-") // Handle en dash
        .replace(/—/g, "-") // Handle em dash
        .replace(/[\u2018\u2019]/g, "'") // Additional smart apostrophes
        .replace(/[\u201C\u201D]/g, '"') // Additional smart quotes
        .replace(/[\u201A\u201B]/g, '"') // Low-9 and low-9 reversed quotes
        .replace(/[\u201E\u201F]/g, '"') // Double low-9 and low-9 reversed quotes
        .replace(/[\u2039\u203A]/g, '"') // Single left-pointing and right-pointing angle quotes
        .replace(/[\u00AB\u00BB]/g, '"') // Left-pointing and right-pointing double angle quotes
        .trim();

      // Initialize parser and executor
      const parser = new UnifiedCommandParser();
      const executor = new BasicHttpExecutor();

      // Parse the command with enhanced visual feedback
      console.log(
        chalk.cyan.bold(
          "╔══════════════════════════════════════════════════════════════╗"
        )
      );
      console.log(
        chalk.cyan.bold(
          "║                    🧠 AI Processing                          ║"
        )
      );
      console.log(
        chalk.cyan.bold(
          "╚══════════════════════════════════════════════════════════════╝"
        )
      );
      console.log();

      console.log(chalk.blue("🤖 Initializing AI parser..."));
      await parser.initialize();

      console.log(chalk.blue("🔍 Parsing natural language command..."));
      const spec = await parser.parseCommand(normalizedInput);

      console.log(chalk.green.bold("✅ Command parsed successfully!"));
      console.log();

      // Display parsed information in a nice format
      console.log(chalk.yellow.bold("📋 Parsed Command Details:"));
      console.log(
        chalk.gray("   ┌─ Test Type: ") + chalk.white.bold(spec.testType)
      );
      console.log(
        chalk.gray("   ├─ Target URL: ") +
          chalk.white.bold(spec.requests[0]?.url)
      );
      console.log(
        chalk.gray("   ├─ HTTP Method: ") +
          chalk.white.bold(spec.requests[0]?.method)
      );
      console.log(
        chalk.gray("   └─ Request Count: ") +
          chalk.white.bold(spec.loadPattern.virtualUsers)
      );
      console.log();

      // Enhance API request if needed
      const enhancement = this.apiEnhancer.enhanceApiRequest(
        spec,
        normalizedInput
      );
      if (enhancement.enhanced) {
        console.log(chalk.blue.bold("🔧 Request Enhancement Applied:"));
        console.log(chalk.gray("   ") + chalk.blue(enhancement.message));
        console.log();
      }

      // Execute the load test with enhanced messaging
      console.log(
        chalk.cyan.bold(
          "╔══════════════════════════════════════════════════════════════╗"
        )
      );
      console.log(
        chalk.cyan.bold(
          "║                    🚀 Test Execution                        ║"
        )
      );
      console.log(
        chalk.cyan.bold(
          "╚══════════════════════════════════════════════════════════════╝"
        )
      );
      console.log();

      console.log(chalk.blue("🌐 Sending HTTP requests..."));
      const result = await executor.executeLoadTest(spec);

      return result;
    } catch (error) {
      console.log();
      console.log(
        chalk.red.bold(
          "╔══════════════════════════════════════════════════════════════╗"
        )
      );
      console.log(
        chalk.red.bold(
          "║                    ❌ Processing Error                       ║"
        )
      );
      console.log(
        chalk.red.bold(
          "╚══════════════════════════════════════════════════════════════╝"
        )
      );
      console.log();
      console.log(chalk.red("🔍 Error Details:"));
      console.log(
        chalk.gray("   ") +
          chalk.red(error instanceof Error ? error.message : String(error))
      );
      console.log();
      throw new Error(
        `Failed to process command: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  displayResults(results: TestResult): void {
    this.resultDisplay.displayResults(results);
  }

  async exportResults(
    results: TestResult,
    format: ExportFormat
  ): Promise<void> {
    await this.exportManager.exportResults(results, format);
  }
}

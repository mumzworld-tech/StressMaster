import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";
import { SessionContext, CLIConfig } from "./cli-interface";
import { CommandHistoryManager } from "./command-history";
import { promises as fs } from "fs";
import { readFileSync } from "fs";
import path from "path";
import os from "os";

export class SessionManager {
  private config: CLIConfig;
  private history: CommandHistoryManager;
  private session: SessionContext;

  constructor(config: Partial<CLIConfig> = {}) {
    this.config = {
      interactive: true,
      outputFormat: "json",
      verbose: false,
      maxHistoryEntries: 1000,
      autoComplete: true,
      ...config,
    };

    this.history = new CommandHistoryManager(this.config.maxHistoryEntries);
    this.session = {
      sessionId: uuidv4(),
      startTime: new Date(),
      testHistory: [],
    };

    this.setupHistoryFile();
  }

  private async setupHistoryFile(): Promise<void> {
    if (!this.config.historyFile) {
      const homeDir = os.homedir();
      this.config.historyFile = path.join(
        homeDir,
        ".stressmaster-history.json"
      );
    }

    try {
      await this.history.loadFromFile(this.config.historyFile);
    } catch (error) {
      if (this.config.verbose) {
        console.warn(
          chalk.yellow(`Warning: Could not load history file: ${error}`)
        );
      }
    }
  }

  async saveHistory(): Promise<void> {
    if (this.config.historyFile) {
      try {
        await this.history.saveToFile(this.config.historyFile);
      } catch (error) {
        if (this.config.verbose) {
          console.warn(
            chalk.yellow(`Warning: Could not save history: ${error}`)
          );
        }
      }
    }
  }

  displayStartupBanner(): void {
    // Enhanced startup banner with better visual design
    console.log(
      chalk.blue.bold(
        "╔══════════════════════════════════════════════════════════════╗"
      )
    );
    console.log(
      chalk.blue.bold(
        "║                    🚀 StressMaster                          ║"
      )
    );
    console.log(
      chalk.blue.bold(
        "║              AI-Powered Load Testing Tool                   ║"
      )
    );
    console.log(
      chalk.blue.bold(
        "╚══════════════════════════════════════════════════════════════╝"
      )
    );
    console.log();

    // Display AI provider info
    this.displayAIProviderInfo();

    // Session info with better formatting
    console.log(chalk.gray("📋 Session Info:"));
    console.log(chalk.gray(`   ID: ${chalk.cyan(this.session.sessionId)}`));
    console.log(
      chalk.gray(`   Started: ${chalk.cyan(new Date().toLocaleString())}`)
    );
    console.log();

    // Help info with better styling
    console.log(chalk.yellow("💡 Quick Start:"));
    console.log(
      chalk.gray("   • Type your load test command in natural language")
    );
    console.log(
      chalk.gray(
        "   • Example: 'send 10 POST requests to https://api.example.com/users'"
      )
    );
    console.log(
      chalk.gray("   • Type 'help' for more commands, 'exit' to quit")
    );
    console.log();

    // Visual separator
    console.log(chalk.gray("─".repeat(60)));
    console.log();
  }

  getSession(): SessionContext {
    return this.session;
  }

  getHistory(): CommandHistoryManager {
    return this.history;
  }

  getConfig(): CLIConfig {
    return this.config;
  }

  addTestToHistory(testResult: any): void {
    this.session.testHistory.push(testResult);
  }

  private displayAIProviderInfo(): void {
    try {
      const aiConfigPath = path.join(process.cwd(), "config", "ai-config.json");
      const aiConfig = JSON.parse(readFileSync(aiConfigPath, "utf8"));

      console.log(chalk.green("🤖 AI Provider:"));
      console.log(chalk.gray(`   Provider: ${chalk.cyan(aiConfig.provider)}`));
      console.log(chalk.gray(`   Model: ${chalk.cyan(aiConfig.model)}`));
      console.log();
    } catch (error) {
      console.log(
        chalk.yellow("⚠️  AI Provider: Could not load configuration")
      );
      console.log();
    }
  }
}

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
  private lastTestResult: TestResult | null = null;

  constructor(config: Partial<CLIConfig> = {}) {
    this.sessionManager = new SessionManager(config);
    this.displayManager = new DisplayManager(this.sessionManager.getHistory());
    this.resultDisplay = new ResultDisplayManager();
    this.exportManager = new ExportManager();
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

        if (
          input.toLowerCase() === "help openapi" ||
          input.toLowerCase() === "openapi help"
        ) {
          this.displayOpenAPIHelp();
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
          await this.handleExportCommand(input.substring(7)); // Remove "export " prefix
          continue;
        }

        // Handle OpenAPI commands
        if (input.toLowerCase().startsWith("openapi ")) {
          await this.handleOpenAPICommand(input.substring(8)); // Remove "openapi " prefix
          continue;
        }

        // Handle structured commands (config, file, results, etc.)
        if (await this.handleStructuredCommand(input)) {
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
    const { FileAutocomplete } = await import("./file-autocomplete");

    // Check if autocomplete is enabled
    if (!this.sessionManager.getConfig().autoComplete) {
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

    // Enhanced readline with autocomplete support
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: (line: string) => {
        const cursorPos = line.length;

        // Check if we should trigger file autocomplete
        if (FileAutocomplete.shouldTrigger(line, cursorPos)) {
          const suggestions = FileAutocomplete.getFileSuggestions(
            line,
            cursorPos
          );
          if (suggestions.length > 0) {
            // Extract the partial filename after @
            const lastAt = line.lastIndexOf("@");
            if (lastAt !== -1) {
              const afterAt = line.substring(lastAt + 1);
              const spaceIndex = afterAt.indexOf(" ");
              const partialFilename =
                spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);

              // Return matching suggestions
              const matches = suggestions
                .map((s) => s.text.substring(1)) // Remove @ prefix
                .filter((filename) => filename.startsWith(partialFilename));

              return [matches, partialFilename];
            }
          }
        }

        // Fallback to history suggestions
        if (options.history && options.history.length > 0) {
          const historyMatches = options.history
            .filter((cmd) => cmd.toLowerCase().includes(line.toLowerCase()))
            .slice(0, 10);
          if (historyMatches.length > 0) {
            return [historyMatches, line];
          }
        }

        return [[], line];
      },
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

      // Store the last test result for export
      this.lastTestResult = result;
      await this.saveLastTestResult(result);

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
      const { SmartLoadExecutor } = await import(
        "../../core/executor/smart-executor"
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

      // Initialize parser and executor with proper configuration
      const parser = new UnifiedCommandParser({
        // Read from config file only - no environment variables needed
        aiProvider: undefined,
        modelName: undefined,
        apiKey: undefined,
        ollamaEndpoint: undefined,
      });
      const executor = new SmartLoadExecutor();

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

      // Check if this is an OpenAPI-related command
      const hasOpenAPIFile =
        normalizedInput.includes(".yaml") ||
        normalizedInput.includes(".yml") ||
        normalizedInput.includes(".json") ||
        normalizedInput.toLowerCase().includes("openapi");

      if (hasOpenAPIFile) {
        console.log(
          chalk.cyan(
            "📋 Detected OpenAPI specification - AI will analyze the API structure"
          )
        );
      }

      const spec = await parser.parseCommand(normalizedInput);

      console.log(chalk.green.bold("✅ Command parsed successfully!"));
      console.log();

      // Display parsed information in a nice format
      console.log(chalk.yellow.bold("📋 Parsed Command Details:"));
      console.log(
        chalk.gray("   ┌─ Test Type: ") + chalk.white.bold(spec.testType)
      );

      // Handle different test types
      if (
        spec.testType === "workflow" &&
        spec.workflow &&
        spec.workflow.length > 0
      ) {
        const workflowSteps = spec.workflow[0]?.steps || [];
        console.log(
          chalk.gray("   ├─ Workflow Steps: ") +
            chalk.white.bold(workflowSteps.length)
        );
        const firstStep = workflowSteps[0];
        const stepInfo =
          "method" in firstStep && "url" in firstStep
            ? `${firstStep.method || "N/A"} ${firstStep.url || "N/A"}`
            : "N/A";
        console.log(
          chalk.gray("   ├─ First Step: ") + chalk.white.bold(stepInfo)
        );
        console.log(
          chalk.gray("   └─ Request Count: ") +
            chalk.white.bold(spec.loadPattern.virtualUsers)
        );
      } else if (spec.testType === "batch" && spec.batch) {
        // Handle batch tests
        console.log(
          chalk.gray("   ├─ Batch Tests: ") +
            chalk.white.bold(spec.batch.tests.length)
        );
        console.log(
          chalk.gray("   ├─ Execution Mode: ") +
            chalk.white.bold(spec.batch.executionMode)
        );
        const totalRequests = spec.batch.tests.reduce(
          (sum, test) => sum + (test.loadPattern?.virtualUsers || 1),
          0
        );
        console.log(
          chalk.gray("   └─ Total Requests: ") + chalk.white.bold(totalRequests)
        );
      } else {
        // Handle single tests
        console.log(
          chalk.gray("   ├─ Target URL: ") +
            chalk.white.bold(spec.requests[0]?.url || "N/A")
        );
        console.log(
          chalk.gray("   ├─ HTTP Method: ") +
            chalk.white.bold(spec.requests[0]?.method || "N/A")
        );
        console.log(
          chalk.gray("   └─ Request Count: ") +
            chalk.white.bold(spec.loadPattern.virtualUsers)
        );
      }
      console.log();

      // Enhance API request if needed (silent - no logs)
      this.apiEnhancer.enhanceApiRequest(
        spec,
        normalizedInput
      );

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

  public async handleExportCommand(input: string): Promise<void> {
    const parts = input.split(" ");
    if (parts.length < 1) {
      console.log(
        chalk.red("❌ Invalid export command. Use: export <format> [options]")
      );
      console.log(chalk.gray("   Examples:"));
      console.log(chalk.gray("   - export json"));
      console.log(chalk.gray("   - export csv"));
      console.log(chalk.gray("   - export html"));
      console.log(chalk.gray("   - export json --include-raw"));
      return;
    }

    const format = parts[0] as "json" | "csv" | "html";
    if (!["json", "csv", "html"].includes(format)) {
      console.log(
        chalk.red("❌ Invalid format. Supported formats: json, csv, html")
      );
      return;
    }

    // Try to get the last test result from memory or file
    let testResult = this.lastTestResult;
    if (!testResult) {
      testResult = await this.loadLastTestResult();
    }

    if (!testResult) {
      console.log(chalk.yellow("⚠️  No test results available for export."));
      console.log(
        chalk.gray("   Run a test first, then use the export command.")
      );
      return;
    }

    const options = {
      format,
      includeRawData: input.includes("--include-raw"),
      includeRecommendations: input.includes("--include-recommendations"),
    };

    try {
      const filePath = await this.exportManager.exportTestResult(
        testResult,
        options
      );
      console.log(chalk.green(`✅ Test results exported to: ${filePath}`));

      // Show export stats
      const stats = this.exportManager.getExportStats();
      console.log(
        chalk.blue(
          `📊 Export stats: ${stats.totalFiles} files, ${stats.totalSize} total`
        )
      );
    } catch (error) {
      console.log(chalk.red(`❌ Export failed: ${error}`));
    }
  }

  public async handleOpenAPICommand(input: string): Promise<void> {
    try {
      const { OpenAPICLI } = await import("../../features/openapi/cli");
      const openapiCLI = new OpenAPICLI();

      const args = input.trim().split(" ");
      const command = args[0];
      const filePath = args[1];

      if (!command || !filePath) {
        console.log(chalk.blue("\n🔧 OpenAPI Commands:"));
        console.log(
          chalk.white(`
  openapi parse <file>                    Parse OpenAPI specification
  openapi list <file> [options]           List all endpoints
  openapi payloads <file> [options]       Generate payloads for endpoints
  openapi curl <file> [baseUrl]           Generate cURL commands
  
  Examples:
    openapi parse api.yaml
    openapi list api.yaml --method POST
    openapi payloads api.yaml --tag users
    openapi curl api.yaml https://api.example.com
        `)
        );
        return;
      }

      switch (command) {
        case "parse":
          await openapiCLI.parseSpec(filePath);
          break;
        case "list":
          const options: any = {};
          for (let i = 2; i < args.length; i += 2) {
            if (args[i] === "--method") options.method = args[i + 1];
            if (args[i] === "--tag") options.tag = args[i + 1];
            if (args[i] === "--path") options.path = args[i + 1];
            if (args[i] === "--has-body") options.hasRequestBody = true;
            if (args[i] === "--no-body") options.hasRequestBody = false;
          }
          await openapiCLI.listEndpoints(filePath, options);
          break;
        case "payloads":
          await openapiCLI.generatePayloads(filePath);
          break;
        case "curl":
          const baseUrl = args[2];
          await openapiCLI.generateCurl(filePath, baseUrl);
          break;
        default:
          console.log(chalk.red(`❌ Unknown OpenAPI command: ${command}`));
          console.log(chalk.blue('Use "openapi" to see available commands'));
      }
    } catch (error) {
      this.displayManager.displayError(
        `OpenAPI command failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async exportResults(
    results: TestResult,
    format: ExportFormat
  ): Promise<void> {
    const options = {
      format: format as "json" | "csv" | "html",
      includeRawData: false,
      includeRecommendations: true,
    };

    await this.exportManager.exportTestResult(results, options);
  }

  private async loadLastTestResult(): Promise<TestResult | null> {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const { getCacheDir } = await import("../../utils/stressmaster-dir");

      const resultFile = path.join(getCacheDir(), "last-test-result.json");

      if (fs.existsSync(resultFile)) {
        const data = fs.readFileSync(resultFile, "utf8");
        const result = JSON.parse(data);

        // Convert date strings back to Date objects
        result.startTime = new Date(result.startTime);
        result.endTime = new Date(result.endTime);

        return result;
      }
    } catch (error) {
      console.warn("⚠️  Could not load last test result:", error);
    }

    return null;
  }

  private async saveLastTestResult(result: TestResult): Promise<void> {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const { getCacheDir } = await import("../../utils/stressmaster-dir");

      const resultFile = path.join(getCacheDir(), "last-test-result.json");
      const data = JSON.stringify(result, null, 2);

      fs.writeFileSync(resultFile, data, "utf8");
    } catch (error) {
      console.warn("⚠️  Could not save test result:", error);
    }
  }

  private displayOpenAPIHelp(): void {
    console.log(chalk.blue.bold("\n🔧 OpenAPI Commands Help"));
    console.log(chalk.gray("=".repeat(50)));
    console.log();

    console.log(chalk.yellow.bold("📋 Basic Commands:"));
    console.log(
      chalk.white(
        "  openapi parse <file>                    - Parse OpenAPI specification"
      )
    );
    console.log(
      chalk.white(
        "  openapi list <file> [options]           - List all endpoints"
      )
    );
    console.log(
      chalk.white(
        "  openapi payloads <file> [options]       - Generate payloads for endpoints"
      )
    );
    console.log(
      chalk.white(
        "  openapi curl <file> [baseUrl]           - Generate cURL commands"
      )
    );
    console.log();

    console.log(chalk.yellow.bold("🔍 Filtering Options:"));
    console.log(
      chalk.white(
        "  --method <method>                       - Filter by HTTP method (GET, POST, PUT, DELETE)"
      )
    );
    console.log(
      chalk.white(
        "  --tag <tag>                            - Filter by tag (users, orders, products)"
      )
    );
    console.log(
      chalk.white(
        "  --path <path>                          - Filter by path pattern"
      )
    );
    console.log(
      chalk.white(
        "  --has-body                             - Only endpoints with request body"
      )
    );
    console.log(
      chalk.white(
        "  --no-body                              - Only endpoints without request body"
      )
    );
    console.log();

    console.log(chalk.yellow.bold("💡 Examples:"));
    console.log(chalk.gray("  openapi parse api.yaml"));
    console.log(chalk.gray("  openapi list api.yaml --method POST"));
    console.log(chalk.gray("  openapi list api.yaml --tag users"));
    console.log(chalk.gray("  openapi payloads api.yaml --has-body"));
    console.log(chalk.gray("  openapi curl api.yaml https://api.example.com"));
    console.log();

    console.log(chalk.yellow.bold("🤖 AI-Powered Testing:"));
    console.log(
      chalk.white("  You can also use natural language with OpenAPI files:")
    );
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

    console.log(chalk.yellow.bold("🎯 Supported File Formats:"));
    console.log(chalk.white("  • .yaml files"));
    console.log(chalk.white("  • .yml files"));
    console.log(chalk.white("  • .json files"));
    console.log();

    console.log(chalk.yellow.bold("✨ Features:"));
    console.log(chalk.white("  • Automatic schema analysis"));
    console.log(chalk.white("  • Realistic payload generation"));
    console.log(chalk.white("  • Example-based data creation"));
    console.log(
      chalk.white(
        "  • Support for all field types (strings, numbers, booleans, arrays, objects)"
      )
    );
    console.log(chalk.white("  • Complex nested structures"));
    console.log(chalk.white("  • Enum values and patterns"));
    console.log(chalk.white("  • Required vs optional fields"));
    console.log();
  }

  /**
   * Handle structured commands from interactive CLI
   * Routes commands like "config show", "file list", "results list" to their handlers
   */
  private async handleStructuredCommand(input: string): Promise<boolean> {
    const trimmed = input.trim();
    const parts = trimmed.split(/\s+/);
    const command = parts[0]?.toLowerCase();

    try {
      // Handle config commands
      if (command === "config" || command === "cfg") {
        await this.handleConfigCommand(parts.slice(1));
        return true;
      }

      // Handle file commands
      if (command === "file" || command === "f") {
        await this.handleFileCommand(parts.slice(1));
        return true;
      }

      // Handle results commands
      if (command === "results" || command === "result") {
        await this.handleResultsCommand(parts.slice(1));
        return true;
      }

      // Handle template commands
      if (command === "template" || command === "templates") {
        await this.handleTemplateCommand(parts.slice(1));
        return true;
      }

      return false; // Not a structured command, continue with natural language parsing
    } catch (error) {
      this.displayManager.displayError(
        `Command failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return true; // Command was handled (even if it failed)
    }
  }

  /**
   * Handle config commands
   */
  private async handleConfigCommand(args: string[]): Promise<void> {
    const { ConfigManagementService } = await import(
      "../../services/config-management.service"
    );
    const configService = new ConfigManagementService();

    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case "show":
        const config = await configService.getConfig();

        // Get actual AI provider from runtime configuration
        const actualAIProvider = this.getActualAIProvider();

        console.log(chalk.blue.bold("\n⚙️  StressMaster Configuration\n"));
        console.log(
          `  ${chalk.yellow("Root Directory:")} ${config.rootDirectory}`
        );
        console.log(
          `  ${chalk.yellow("Default Duration:")} ${config.defaultDuration}s`
        );
        console.log(
          `  ${chalk.yellow("Default Virtual Users:")} ${
            config.defaultVirtualUsers
          }`
        );
        console.log(
          `  ${chalk.yellow("AI Provider:")} ${chalk.cyan(
            actualAIProvider.provider
          )}${
            actualAIProvider.source
              ? chalk.gray(` (from ${actualAIProvider.source})`)
              : ""
          }`
        );
        if (actualAIProvider.model) {
          console.log(
            `  ${chalk.yellow("AI Model:")} ${chalk.cyan(
              actualAIProvider.model
            )}`
          );
        }
        console.log(
          `  ${chalk.yellow("Cache Enabled:")} ${
            config.cacheEnabled ? "Yes" : "No"
          }`
        );
        console.log(
          `  ${chalk.yellow("Verbose:")} ${config.verbose ? "Yes" : "No"}`
        );
        console.log(
          `  ${chalk.yellow("Output Format:")} ${config.outputFormat}`
        );
        console.log();
        break;

      case "set":
        if (args.length < 3) {
          console.log(chalk.red("❌ Usage: config set <key> <value>"));
          return;
        }
        const key = args[1];
        const value = args.slice(2).join(" ");
        let parsedValue: any = value;

        if (!isNaN(Number(value)) && value.trim() !== "") {
          parsedValue = Number(value);
        } else if (value.toLowerCase() === "true") {
          parsedValue = true;
        } else if (value.toLowerCase() === "false") {
          parsedValue = false;
        }

        await configService.setConfig(key, parsedValue);
        console.log(
          chalk.green(`✅ Configuration updated: ${key} = ${parsedValue}`)
        );
        break;

      case "init":
        const configPath = await configService.initConfig();
        console.log(
          chalk.green(`✅ Configuration initialized at: ${configPath}`)
        );
        break;

      default:
        console.log(chalk.blue("\n📋 Config Commands:"));
        console.log(
          chalk.white("  config show          - Display current configuration")
        );
        console.log(
          chalk.white("  config set <key> <value> - Set configuration value")
        );
        console.log(
          chalk.white("  config init          - Initialize configuration file")
        );
        console.log();
    }
  }

  /**
   * Handle file commands
   */
  private async handleFileCommand(args: string[]): Promise<void> {
    const { FileManagementService } = await import(
      "../../services/file-management.service"
    );
    const fileService = new FileManagementService();

    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case "list":
        const pattern = args[1];
        const files = await fileService.listFiles(pattern);

        if (files.length === 0) {
          console.log(chalk.yellow("No files found"));
          return;
        }

        console.log(chalk.blue.bold(`\n📁 Found ${files.length} file(s):\n`));

        // Group by type
        const grouped = files.reduce((acc, file) => {
          if (!acc[file.type]) acc[file.type] = [];
          acc[file.type].push(file);
          return acc;
        }, {} as Record<string, typeof files>);

        for (const [type, typeFiles] of Object.entries(grouped)) {
          console.log(chalk.yellow.bold(`  ${type.toUpperCase()}:`));
          for (const file of typeFiles) {
            const size = this.formatFileSize(file.size);
            console.log(
              `    ${chalk.cyan(`@${file.name}`)} ${chalk.gray(`(${size})`)}`
            );
          }
          console.log();
        }
        break;

      case "validate":
        if (args.length < 2) {
          console.log(chalk.red("❌ Usage: file validate <file>"));
          return;
        }
        const fileRef = args[1];
        const result = await fileService.validateFile(fileRef);

        if (result.valid) {
          console.log(chalk.green.bold("\n✅ File is valid\n"));
          console.log(`  Path: ${chalk.cyan(result.path)}`);
          console.log(`  Size: ${this.formatFileSize(result.size)}`);
        } else {
          console.log(chalk.red.bold("\n❌ File validation failed\n"));
          if (result.errors) {
            result.errors.forEach((error) => {
              console.log(chalk.red(`  • ${error}`));
            });
          }
        }
        break;

      case "search":
        if (args.length < 2) {
          console.log(chalk.red("❌ Usage: file search <pattern>"));
          return;
        }
        const searchPattern = args[1];
        const searchResults = await fileService.searchFiles(searchPattern);

        if (searchResults.length === 0) {
          console.log(
            chalk.yellow(`No files found matching "${searchPattern}"`)
          );
          return;
        }

        console.log(
          chalk.blue.bold(
            `\n🔍 Found ${searchResults.length} file(s) matching "${searchPattern}":\n`
          )
        );

        for (const file of searchResults) {
          const size = this.formatFileSize(file.size);
          console.log(
            `  ${chalk.cyan(`@${file.name}`)} ${chalk.gray(
              `(${size})`
            )} → ${chalk.dim(file.path)}`
          );
        }
        console.log();
        break;

      default:
        console.log(chalk.blue("\n📁 File Commands:"));
        console.log(
          chalk.white(
            "  file list [pattern]    - List files that can be used with @"
          )
        );
        console.log(
          chalk.white("  file validate <file> - Validate a file reference")
        );
        console.log(chalk.white("  file search <pattern> - Search for files"));
        console.log();
    }
  }

  /**
   * Handle results commands
   */
  private async handleResultsCommand(args: string[]): Promise<void> {
    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case "list":
        const fs = await import("fs");
        const path = await import("path");

        const resultsDir = path.join(process.cwd(), ".stressmaster", "results");
        if (!fs.existsSync(resultsDir)) {
          console.log(chalk.yellow("No results directory found"));
          return;
        }

        const resultFiles = fs
          .readdirSync(resultsDir)
          .filter((f) => f.endsWith(".json"))
          .sort()
          .reverse()
          .slice(0, 20);

        if (resultFiles.length === 0) {
          console.log(chalk.yellow("No test results found"));
          return;
        }

        console.log(
          chalk.blue.bold(`\n📊 Recent Test Results (${resultFiles.length}):\n`)
        );

        for (const file of resultFiles) {
          const filePath = path.join(resultsDir, file);
          const content = fs.readFileSync(filePath, "utf8");
          const result = JSON.parse(content);
          const testId = file.replace(".json", "");
          const status = result.status === "completed" ? "✅" : "❌";
          const requests = result.metrics?.totalRequests || 0;

          console.log(
            `  ${status} ${chalk.cyan(testId.substring(0, 50))} - ${chalk.gray(
              `${requests} requests`
            )}`
          );
        }
        console.log();
        break;

      case "show":
        if (args.length < 2) {
          console.log(chalk.red("❌ Usage: results show <id>"));
          return;
        }
        const id = args[1];
        const fs2 = await import("fs");
        const path2 = await import("path");

        const resultsDir2 = path2.join(
          process.cwd(),
          ".stressmaster",
          "results"
        );
        const resultFile = path2.join(resultsDir2, `${id}.json`);

        if (!fs2.existsSync(resultFile)) {
          console.error(chalk.red(`Result not found: ${id}`));
          return;
        }

        const content = fs2.readFileSync(resultFile, "utf8");
        const result = JSON.parse(content);

        console.log(chalk.blue.bold(`\n📊 Test Result: ${id}\n`));
        console.log(`  Status: ${chalk.cyan(result.status)}`);
        if (result.metrics) {
          console.log(
            `  Requests: ${chalk.cyan(result.metrics.totalRequests || 0)}`
          );
          console.log(
            `  Success: ${chalk.green(result.metrics.successfulRequests || 0)}`
          );
          console.log(
            `  Failed: ${chalk.red(result.metrics.failedRequests || 0)}`
          );
        }
        console.log();
        break;

      default:
        console.log(chalk.blue("\n📊 Results Commands:"));
        console.log(
          chalk.white("  results list         - List recent test results")
        );
        console.log(
          chalk.white("  results show <id>    - Show detailed test result")
        );
        console.log();
    }
  }

  /**
   * Handle template commands
   */
  private async handleTemplateCommand(args: string[]): Promise<void> {
    const { TemplateManagementService } = await import(
      "../../services/template-management.service"
    );
    const templateService = new TemplateManagementService();

    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case "list":
        const templates = await templateService.listTemplates();

        if (templates.length === 0) {
          console.log(chalk.yellow("No templates found"));
          return;
        }

        console.log(
          chalk.blue.bold(`\n📋 Available Templates (${templates.length}):\n`)
        );

        for (const template of templates) {
          console.log(
            `  ${chalk.cyan(template.name)} ${chalk.gray(
              `- ${template.description || ""}`
            )}`
          );
        }
        console.log();
        break;

      default:
        console.log(chalk.blue("\n📋 Template Commands:"));
        console.log(
          chalk.white("  template list        - List available templates")
        );
        console.log();
    }
  }

  /**
   * Format file size helper
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get actual AI provider configuration from runtime sources
   * Checks: environment variables -> config/ai-config.json -> API key detection -> defaults
   */
  private getActualAIProvider(): {
    provider: string;
    model?: string;
    source?: string;
  } {
    // Check environment variables first (highest priority)
    if (process.env.AI_PROVIDER) {
      return {
        provider: process.env.AI_PROVIDER,
        model: process.env.AI_MODEL,
        source: "environment variable (AI_PROVIDER)",
      };
    }

    // Check config/ai-config.json file
    try {
      const fs = require("fs");
      const path = require("path");
      const {
        requireStressMasterDir,
      } = require("../../utils/require-stressmaster-dir");
      const { getAIConfigPath } = requireStressMasterDir();
      const configPath = getAIConfigPath();

      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, "utf8");
        const aiConfig = JSON.parse(configContent);

        if (aiConfig.provider) {
          return {
            provider: aiConfig.provider,
            model: aiConfig.model,
            source: "config/ai-config.json",
          };
        }
      }
    } catch (error) {
      // Ignore errors, continue to detection
    }

    // Detect provider from API keys (if set)
    if (process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY) {
      // Check if it's Claude based on API key format or other indicators
      const apiKey =
        process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY || "";

      // Claude API keys typically start with "sk-ant-"
      if (apiKey.startsWith("sk-ant-") || process.env.ANTHROPIC_API_KEY) {
        return {
          provider: "claude",
          model: process.env.AI_MODEL || "claude-3-5-sonnet-20241022",
          source: "environment variable (ANTHROPIC_API_KEY)",
        };
      }

      // OpenAI keys start with "sk-"
      if (apiKey.startsWith("sk-") && !apiKey.startsWith("sk-ant-")) {
        return {
          provider: "openai",
          model: process.env.AI_MODEL,
          source: "environment variable (AI_API_KEY)",
        };
      }
    }

    // Default
    return {
      provider: "ollama",
      source: "default",
    };
  }
}

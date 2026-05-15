/**
 * Interactive Setup Command
 * Guides users through StressMaster configuration setup
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// Dynamic import for inquirer (ES Module) to avoid CommonJS warning
let inquirer: any;
async function getInquirer() {
  if (!inquirer) {
    inquirer = (await import("inquirer")).default;
  }
  return inquirer;
}

interface SetupAnswers {
  aiProvider: "openai" | "claude" | "gemini" | "openrouter" | "amazonq";
  apiKey?: string;
  model?: string;
  endpoint?: string;
  createEnvFile: boolean;
}

export function createSetupCommand(): Command {
  const setupCommand = new Command("setup")
    .description("Interactive setup wizard for StressMaster configuration")
    .action(async () => {
      await runSetup();
    });

  return setupCommand;
}

async function runSetup(): Promise<void> {
  console.log(chalk.blue.bold("\n🚀 StressMaster Setup Wizard\n"));
  console.log(
    chalk.gray(
      "This will guide you through configuring StressMaster for your project.\n"
    )
  );

  // Get inquirer instance once for the entire function
  const inq = await getInquirer();

  // Import StressMaster directory utility
  const { getAIConfigPath, getConfigDir, ensureStressMasterDirs } =
    await import("../../../utils/stressmaster-dir");

  // Ensure all StressMaster directories exist
  ensureStressMasterDirs();

  // Check if config already exists
  const configPath = getAIConfigPath();
  if (existsSync(configPath)) {
    const { overwrite } = await inq.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: chalk.yellow(
          `Configuration already exists at ${configPath}. Overwrite?`
        ),
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.gray("\nSetup cancelled."));
      return;
    }
  }

  try {
    // Step 1: Choose AI Provider
    const providerAnswer = await inq.prompt([
      {
        type: "list",
        name: "aiProvider",
        message: "Which AI provider would you like to use?",
        choices: [
          {
            name: "Claude (Anthropic or via OpenRouter) - Recommended",
            value: "claude",
          },
          {
            name: "OpenAI (GPT-3.5, GPT-4) - Paid, high quality",
            value: "openai",
          },
          {
            name: "OpenRouter - Access multiple AI models through one API",
            value: "openrouter",
          },
          {
            name: "Amazon Q - Amazon Q Developer AI models",
            value: "amazonq",
          },
          {
            name: "Google Gemini - Paid, competitive pricing",
            value: "gemini",
          },
        ],
      },
    ]);

    const answers: SetupAnswers = {
      ...providerAnswer,
      createEnvFile: false,
    };

    // Step 2: Provider-specific configuration
    if (answers.aiProvider === "openai") {
      await setupOpenAI(answers);
    } else if (answers.aiProvider === "claude") {
      await setupClaude(answers);
    } else if (answers.aiProvider === "openrouter") {
      await setupOpenRouter(answers);
    } else if (answers.aiProvider === "amazonq") {
      await setupAmazonQ(answers);
    } else if (answers.aiProvider === "gemini") {
      await setupGemini(answers);
    }

    // Step 3: Ask about .env file
    const envAnswer = await inq.prompt([
      {
        type: "confirm",
        name: "createEnvFile",
        message: "Create a .env file for environment variables? (Recommended)",
        default: true,
      },
    ]);
    answers.createEnvFile = envAnswer.createEnvFile;

    // Step 4: Create configuration files
    await createConfigFiles(answers);

    // Step 5: Ensure git ignores StressMaster files
    await ensureGitIgnore();

    // Step 6: Show success message
    showSuccessMessage(answers);
  } catch (error) {
    console.error(
      chalk.red(`\n❌ Setup failed: ${(error as Error).message}\n`)
    );
    process.exit(1);
  }
}

async function setupOpenAI(answers: SetupAnswers): Promise<void> {
  const inq = await getInquirer();
  const openAIAnswers = await inq.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "OpenAI API Key:",
      validate: (input: string) => {
        if (!input || !input.startsWith("sk-")) {
          return "OpenAI API key should start with 'sk-'";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "model",
      message: "Choose a model:",
      choices: [
        { name: "GPT-4 (Best quality, higher cost)", value: "gpt-4" },
        {
          name: "GPT-3.5 Turbo (Good quality, lower cost)",
          value: "gpt-3.5-turbo",
        },
        { name: "Custom model", value: "custom" },
      ],
    },
  ]);

  if (openAIAnswers.model === "custom") {
    const inq = await getInquirer();
    const customModel = await inq.prompt([
      {
        type: "input",
        name: "model",
        message: "Enter custom model name:",
      },
    ]);
    answers.model = customModel.model;
  } else {
    answers.model = openAIAnswers.model;
  }

  answers.apiKey = openAIAnswers.apiKey;

  console.log(
    chalk.gray(
      "\n💡 Get your API key from: https://platform.openai.com/api-keys\n"
    )
  );
}

async function setupClaude(answers: SetupAnswers): Promise<void> {
  const inq = await getInquirer();
  const claudeAnswers = await inq.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Anthropic API Key:",
      validate: (input: string) => {
        if (
          !input ||
          (!input.startsWith("sk-ant-") && !input.startsWith("sk-"))
        ) {
          return "Anthropic API key should start with 'sk-ant-' or 'sk-'";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "model",
      message: "Choose a model:",
      choices: [
        {
          name: "Claude 3.5 Sonnet (Latest, recommended)",
          value: "claude-3-5-sonnet-20241022",
        },
        {
          name: "Claude 3 Opus (Most capable)",
          value: "claude-3-opus-20240229",
        },
        { name: "Claude 3 Sonnet", value: "claude-3-sonnet-20240229" },
        {
          name: "Claude 3 Haiku (Fastest, cheapest)",
          value: "claude-3-haiku-20240307",
        },
        { name: "Custom model", value: "custom" },
      ],
    },
  ]);

  if (claudeAnswers.model === "custom") {
    const inq = await getInquirer();
    const customModel = await inq.prompt([
      {
        type: "input",
        name: "model",
        message: "Enter custom model name:",
      },
    ]);
    answers.model = customModel.model;
  } else {
    answers.model = claudeAnswers.model;
  }

  answers.apiKey = claudeAnswers.apiKey;

  console.log(
    chalk.gray("\n💡 Get your API key from: https://console.anthropic.com/\n")
  );
}

async function setupOpenRouter(answers: SetupAnswers): Promise<void> {
  const inq = await getInquirer();
  const openRouterAnswers = await inq.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "OpenRouter API Key:",
      validate: (input: string) => {
        if (!input || !input.startsWith("sk-or-")) {
          return "OpenRouter API key should start with 'sk-or-'";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "model",
      message: "Choose a model:",
      choices: [
        {
          name: "Claude 3.5 Sonnet via OpenRouter (Recommended)",
          value: "anthropic/claude-3.5-sonnet",
        },
        {
          name: "GPT-4 via OpenRouter",
          value: "openai/gpt-4",
        },
        {
          name: "GPT-3.5 Turbo via OpenRouter",
          value: "openai/gpt-3.5-turbo",
        },
        {
          name: "Gemini Pro via OpenRouter",
          value: "google/gemini-pro",
        },
        { name: "Custom model", value: "custom" },
      ],
    },
  ]);

  if (openRouterAnswers.model === "custom") {
    const inq = await getInquirer();
    const customModel = await inq.prompt([
      {
        type: "input",
        name: "model",
        message: "Enter custom model name (e.g., anthropic/claude-3-opus):",
      },
    ]);
    answers.model = customModel.model;
  } else {
    answers.model = openRouterAnswers.model;
  }

  answers.apiKey = openRouterAnswers.apiKey;

  console.log(
    chalk.gray(
      "\n💡 Get your API key from: https://openrouter.ai/keys\n"
    )
  );
}

async function setupAmazonQ(answers: SetupAnswers): Promise<void> {
  const inq = await getInquirer();
  const amazonQAnswers = await inq.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Amazon Q API Key:",
      validate: (input: string) => {
        if (!input || input.length < 20) {
          return "Please enter a valid Amazon Q API key";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "model",
      message: "Choose a model:",
      choices: [
        {
          name: "Amazon Q Developer (Default)",
          value: "amazon.q-developer",
        },
        { name: "Custom model", value: "custom" },
      ],
    },
  ]);

  if (amazonQAnswers.model === "custom") {
    const inq = await getInquirer();
    const customModel = await inq.prompt([
      {
        type: "input",
        name: "model",
        message: "Enter custom Amazon Q model name:",
      },
    ]);
    answers.model = customModel.model;
  } else {
    answers.model = amazonQAnswers.model;
  }

  answers.apiKey = amazonQAnswers.apiKey;

  console.log(
    chalk.gray(
      "\n💡 Get your API key from: https://aws.amazon.com/q/developer/\n"
    )
  );
}

async function setupGemini(answers: SetupAnswers): Promise<void> {
  const inq = await getInquirer();
  const geminiAnswers = await inq.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Google AI API Key:",
      validate: (input: string) => {
        if (!input || input.length < 20) {
          return "Please enter a valid Google AI API key";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "model",
      message: "Choose a model:",
      choices: [
        { name: "Gemini Pro (Recommended)", value: "gemini-pro" },
        { name: "Gemini Pro Vision", value: "gemini-pro-vision" },
        { name: "Custom model", value: "custom" },
      ],
    },
  ]);

  if (geminiAnswers.model === "custom") {
    const inq = await getInquirer();
    const customModel = await inq.prompt([
      {
        type: "input",
        name: "model",
        message: "Enter custom model name:",
      },
    ]);
    answers.model = customModel.model;
  } else {
    answers.model = geminiAnswers.model;
  }

  answers.apiKey = geminiAnswers.apiKey;

  console.log(
    chalk.gray(
      "\n💡 Get your API key from: https://makersuite.google.com/app/apikey\n"
    )
  );
}

async function createConfigFiles(answers: SetupAnswers): Promise<void> {
  // Import StressMaster directory utility
  const { getConfigDir, getAIConfigPath, ensureStressMasterDirs } =
    await import("../../../utils/stressmaster-dir");

  // Ensure all StressMaster directories exist
  ensureStressMasterDirs();

  // Get config directory and file paths
  const configDir = getConfigDir();

  // Create ai-config.json
  const aiConfig: any = {
    provider: answers.aiProvider,
    model: answers.model,
    maxRetries: 3,
    timeout: 30000,
    options: {
      temperature: 0.1,
    },
  };

  if (answers.endpoint) {
    aiConfig.endpoint = answers.endpoint;
  }

  if (answers.apiKey) {
    aiConfig.apiKey = answers.apiKey;
  }

  const configPath = getAIConfigPath();
  writeFileSync(configPath, JSON.stringify(aiConfig, null, 2), "utf-8");
  console.log(chalk.green(`✅ Created ${configPath}`));

  // Create .env file if requested
  if (answers.createEnvFile) {
    const envLines: string[] = [
      "# StressMaster Configuration",
      "# Generated by: stressmaster setup",
      "",
      `AI_PROVIDER=${answers.aiProvider}`,
    ];

    if (answers.model) {
      envLines.push(`AI_MODEL=${answers.model}`);
    }

    if (answers.endpoint) {
      envLines.push(`AI_ENDPOINT=${answers.endpoint}`);
    }

    if (answers.apiKey) {
      if (answers.aiProvider === "openai") {
        envLines.push(`OPENAI_API_KEY=${answers.apiKey}`);
      } else if (answers.aiProvider === "claude") {
        envLines.push(`ANTHROPIC_API_KEY=${answers.apiKey}`);
      } else if (answers.aiProvider === "openrouter") {
        envLines.push(`OPENROUTER_API_KEY=${answers.apiKey}`);
      } else if (answers.aiProvider === "amazonq") {
        envLines.push(`AMAZON_Q_API_KEY=${answers.apiKey}`);
      } else if (answers.aiProvider === "gemini") {
        envLines.push(`GEMINI_API_KEY=${answers.apiKey}`);
      }
      envLines.push(`AI_API_KEY=${answers.apiKey}`);
    }

    const envPath = join(process.cwd(), ".env");

    // Check if .env already exists
    if (existsSync(envPath)) {
      const inq = await getInquirer();
      const { append } = await inq.prompt([
        {
          type: "confirm",
          name: "append",
          message: chalk.yellow(
            `.env file already exists. Append StressMaster config?`
          ),
          default: true,
        },
      ]);

      if (append) {
        const fs = await import("fs/promises");
        const existingContent = await fs.readFile(envPath, "utf-8");
        const newContent =
          existingContent +
          "\n\n# StressMaster Configuration\n" +
          envLines.slice(3).join("\n");
        await fs.writeFile(envPath, newContent, "utf-8");
        console.log(chalk.green(`✅ Updated ${envPath}`));
      }
    } else {
      writeFileSync(envPath, envLines.join("\n") + "\n", "utf-8");
      console.log(chalk.green(`✅ Created ${envPath}`));
    }

    console.log(chalk.yellow("\n⚠️  Remember to add .env to your .gitignore!"));
  }

  // Ensure .stressmaster/ is in .gitignore
  await ensureGitIgnore();
}

/**
 * Ensure .stressmaster/ is in the project's .gitignore
 */
async function ensureGitIgnore(): Promise<void> {
  const gitignorePath = join(process.cwd(), ".gitignore");
  const stressMasterIgnore = ".stressmaster/";

  try {
    // Check if .gitignore exists
    if (!existsSync(gitignorePath)) {
      // Create .gitignore with StressMaster entry
      const content = `# StressMaster Generated Files\n${stressMasterIgnore}\n`;
      writeFileSync(gitignorePath, content, "utf-8");
      console.log(
        chalk.green(`✅ Created .gitignore and added ${stressMasterIgnore}`)
      );
      return;
    }

    // Read existing .gitignore
    const fs = await import("fs/promises");
    const content = await fs.readFile(gitignorePath, "utf-8");

    // Check if .stressmaster/ is already in .gitignore
    if (content.includes(stressMasterIgnore)) {
      // Already present, nothing to do
      return;
    }

    // Add .stressmaster/ to .gitignore
    const newContent =
      content.trim() +
      "\n\n# StressMaster Generated Files\n" +
      stressMasterIgnore +
      "\n";
    await fs.writeFile(gitignorePath, newContent, "utf-8");
    console.log(chalk.green(`✅ Added ${stressMasterIgnore} to .gitignore`));
  } catch (error) {
    // Silently fail - .gitignore update is not critical
    // User can manually add it if needed
  }
}

function showSuccessMessage(answers: SetupAnswers): void {
  console.log(chalk.green.bold("\n✅ Setup Complete!\n"));

  console.log(chalk.blue("Next steps:"));
  console.log(chalk.white("  1. Test your configuration:"));
  console.log(
    chalk.gray(
      '     stressmaster "send 5 GET requests to https://httpbin.org/get"'
    )
  );

  console.log(chalk.white("\n  2. Check your configuration:"));
  console.log(chalk.gray("     stressmaster config show"));

  console.log(chalk.white("\n  3. Start testing your APIs:"));
  console.log(
    chalk.gray(
      '     stressmaster "send 10 POST requests to http://localhost:3000/api/users"'
    )
  );

  console.log(chalk.green("\n✅ Git Configuration:"));
  console.log(
    chalk.gray("   • Added .stressmaster/ to your project's .gitignore")
  );
  console.log(
    chalk.gray(
      "   • All StressMaster-generated files will be automatically ignored by git"
    )
  );

  console.log(chalk.gray("\n📖 For more examples, see: stressmaster --help\n"));
}

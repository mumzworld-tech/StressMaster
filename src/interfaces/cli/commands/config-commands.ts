/**
 * Configuration Management Commands
 */

import { Command } from "commander";
import chalk from "chalk";
import { ConfigManagementService } from "../../../services/config-management.service";

export function createConfigCommands(): Command {
  const configService = new ConfigManagementService();

  const configCommand = new Command("config")
    .description("Configuration management commands")
    .alias("cfg");

  // config show
  configCommand
    .command("show")
    .description("Display current configuration")
    .action(async () => {
      try {
        const config = await configService.getConfig();

        console.log(chalk.blue.bold("\n⚙️  StressMaster Configuration\n"));

        console.log(`  ${chalk.yellow("Root Directory:")} ${config.rootDirectory}`);
        console.log(
          `  ${chalk.yellow("Default Duration:")} ${config.defaultDuration}s`
        );
        console.log(
          `  ${chalk.yellow("Default Virtual Users:")} ${config.defaultVirtualUsers}`
        );
        console.log(`  ${chalk.yellow("AI Provider:")} ${config.aiProvider}`);
        console.log(
          `  ${chalk.yellow("Cache Enabled:")} ${config.cacheEnabled ? "Yes" : "No"}`
        );
        console.log(`  ${chalk.yellow("Verbose:")} ${config.verbose ? "Yes" : "No"}`);
        console.log(
          `  ${chalk.yellow("Output Format:")} ${config.outputFormat}`
        );
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to show config: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  // config set
  configCommand
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", "Configuration key")
    .argument("<value>", "Configuration value")
    .action(async (key: string, value: string) => {
      try {
        // Parse value based on type
        let parsedValue: any = value;

        // Try to parse as number
        if (!isNaN(Number(value)) && value.trim() !== "") {
          parsedValue = Number(value);
        }
        // Try to parse as boolean
        else if (value.toLowerCase() === "true") {
          parsedValue = true;
        } else if (value.toLowerCase() === "false") {
          parsedValue = false;
        }

        await configService.setConfig(key, parsedValue);
        console.log(
          chalk.green(`✅ Configuration updated: ${key} = ${parsedValue}`)
        );
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to set config: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  // config init
  configCommand
    .command("init")
    .description("Initialize configuration file")
    .action(async () => {
      try {
        const configPath = await configService.initConfig();
        console.log(
          chalk.green(`✅ Configuration initialized at: ${configPath}`)
        );
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to init config: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  return configCommand;
}


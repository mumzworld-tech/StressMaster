/**
 * Template Management Commands
 */

import { Command } from "commander";
import chalk from "chalk";
import { TemplateManagementService } from "../../../services/template-management.service";
// Date formatting helper (no external dependency)
function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let result: string;
  if (diffSecs < 60) {
    result = `${diffSecs} second${diffSecs !== 1 ? "s" : ""}`;
  } else if (diffMins < 60) {
    result = `${diffMins} minute${diffMins !== 1 ? "s" : ""}`;
  } else if (diffHours < 24) {
    result = `${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
  } else {
    result = `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  }

  return options?.addSuffix ? `${result} ago` : result;
}

export function createTemplateCommands(): Command {
  const templateService = new TemplateManagementService();

  const templateCommand = new Command("template")
    .description("Test template management commands")
    .alias("tpl");

  // template list
  templateCommand
    .command("list")
    .description("List available test templates")
    .action(async () => {
      try {
        const templates = await templateService.listTemplates();

        if (templates.length === 0) {
          console.log(chalk.yellow("No templates found"));
          console.log(
            chalk.gray(
              "\nCreate a template with: stressmaster template create <name>"
            )
          );
          return;
        }

        console.log(chalk.blue.bold(`\n📋 Templates (${templates.length}):\n`));

        for (const template of templates) {
          console.log(`  ${chalk.cyan(template.name)}`);
          if (template.description) {
            console.log(chalk.gray(`    ${template.description}`));
          }
          console.log(chalk.gray(`    Command: ${template.command}`));
          console.log(
            chalk.gray(
              `    Created: ${formatDistanceToNow(template.createdAt, {
                addSuffix: true,
              })}`
            )
          );
          if (template.lastUsed) {
            console.log(
              chalk.gray(
                `    Last used: ${formatDistanceToNow(template.lastUsed, {
                  addSuffix: true,
                })}`
              )
            );
          }
          console.log();
        }
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to list templates: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  // template create
  templateCommand
    .command("create")
    .description("Create a test template from last command")
    .argument("<name>", "Template name")
    .option("-d, --description <description>", "Template description")
    .action(async (name: string, options: { description?: string }) => {
      try {
        console.log(
          chalk.yellow(
            "⚠️  Template creation from last command not yet implemented"
          )
        );
        console.log(
          chalk.gray(
            "This will be available after running a test command first"
          )
        );
        // TODO: Get last command and spec from session/result storage
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to create template: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  // template use
  templateCommand
    .command("use")
    .description("Use a saved template")
    .argument("<name>", "Template name")
    .action(async (name: string) => {
      try {
        const template = await templateService.useTemplate(name);
        console.log(chalk.green(`✅ Using template: ${name}`));
        console.log(chalk.blue(`\nCommand: ${template.command}\n`));
        // TODO: Execute the template command
        console.log(
          chalk.yellow("⚠️  Template execution not yet implemented in CLI")
        );
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to use template: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  // template export
  templateCommand
    .command("export")
    .description("Export template to file")
    .argument("<name>", "Template name")
    .argument("[output]", "Output file path", "template.json")
    .action(async (name: string, output: string) => {
      try {
        await templateService.exportTemplate(name, output);
        console.log(chalk.green(`✅ Template exported to: ${output}`));
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to export template: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  return templateCommand;
}


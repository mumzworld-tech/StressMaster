/**
 * File Management Commands
 */

import { Command } from "commander";
import chalk from "chalk";
import { FileManagementService } from "../../../services/file-management.service";
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

export function createFileCommands(): Command {
  const fileService = new FileManagementService();

  const fileCommand = new Command("file")
    .description("File management commands")
    .alias("f");

  // file list
  fileCommand
    .command("list")
    .description("List files that can be used with @ references")
    .argument("[pattern]", "File pattern to match (e.g., *.json)")
    .action(async (pattern?: string) => {
      try {
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
            const size = formatFileSize(file.size);
            const relative = file.path;
            const timeAgo = formatDistanceToNow(file.lastModified, {
              addSuffix: true,
            });

            console.log(
              `    ${chalk.cyan(`@${file.name}`)} ${chalk.gray(
                `(${size}, ${timeAgo})`
              )}`
            );
            if (relative !== file.name) {
              console.log(chalk.gray(`      → ${relative}`));
            }
          }
          console.log();
        }
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to list files: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  // file validate
  fileCommand
    .command("validate")
    .description("Validate a file reference")
    .argument("<file>", "File reference (e.g., @api.yaml or payload.json)")
    .action(async (file: string) => {
      try {
        const result = await fileService.validateFile(file);

        if (result.valid) {
          console.log(chalk.green.bold("\n✅ File is valid\n"));
          console.log(`  Path: ${chalk.cyan(result.path)}`);
          console.log(`  Size: ${formatFileSize(result.size)}`);
          console.log(
            `  Modified: ${formatDistanceToNow(result.lastModified, {
              addSuffix: true,
            })}`
          );
          if (result.format) {
            console.log(`  Format: ${chalk.blue(result.format.toUpperCase())}`);
          }
        } else {
          console.log(chalk.red.bold("\n❌ File validation failed\n"));
          if (result.errors) {
            result.errors.forEach((error) => {
              console.log(chalk.red(`  • ${error}`));
            });
          }
          if (result.warnings) {
            result.warnings.forEach((warning) => {
              console.log(chalk.yellow(`  ⚠️  ${warning}`));
            });
          }
          process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red(`❌ Validation failed: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  // file search
  fileCommand
    .command("search")
    .description("Search for files matching a pattern")
    .argument("<pattern>", "Search pattern")
    .action(async (pattern: string) => {
      try {
        const files = await fileService.searchFiles(pattern);

        if (files.length === 0) {
          console.log(chalk.yellow(`No files found matching "${pattern}"`));
          return;
        }

        console.log(
          chalk.blue.bold(`\n🔍 Found ${files.length} file(s) matching "${pattern}":\n`)
        );

        for (const file of files) {
          const size = formatFileSize(file.size);
          console.log(
            `  ${chalk.cyan(`@${file.name}`)} ${chalk.gray(
              `(${size})`
            )} → ${chalk.dim(file.path)}`
          );
        }
      } catch (error) {
        console.error(
          chalk.red(`❌ Search failed: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  return fileCommand;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


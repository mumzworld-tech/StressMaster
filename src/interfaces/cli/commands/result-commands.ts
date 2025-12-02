/**
 * Result Management Commands
 */

import { Command } from "commander";
import chalk from "chalk";
import * as path from "path";
import * as fs from "fs";
import { TestResult } from "../../../types";

export function createResultCommands(): Command {
  const resultCommand = new Command("results")
    .description("Test result management commands")
    .alias("res");

  // results list
  resultCommand
    .command("list")
    .description("List all test results")
    .option("-n, --number <count>", "Number of results to show", "10")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (options: any) => {
      try {
        const resultsDir = path.join(process.cwd(), ".stressmaster", "results");

        if (!fs.existsSync(resultsDir)) {
          console.log(chalk.yellow("No results directory found"));
          return;
        }

        const files = fs
          .readdirSync(resultsDir)
          .filter((f) => f.endsWith(".json"))
          .sort()
          .reverse()
          .slice(0, parseInt(options.number));

        if (files.length === 0) {
          console.log(chalk.yellow("No test results found"));
          return;
        }

        if (options.format === "json") {
          const results = files.map((file) => {
            const content = fs.readFileSync(
              path.join(resultsDir, file),
              "utf8"
            );
            return JSON.parse(content);
          });
          console.log(JSON.stringify(results, null, 2));
        } else {
          console.log(
            chalk.blue.bold(`\n📊 Test Results (${files.length}):\n`)
          );
          files.forEach((file, index) => {
            try {
              const content = fs.readFileSync(
                path.join(resultsDir, file),
                "utf8"
              );
              const result = JSON.parse(content) as TestResult;
              console.log(
                `  ${chalk.gray(`${index + 1}.`)} ${chalk.cyan(
                  result.id || file
                )}`
              );
              const duration =
                result.endTime && result.startTime
                  ? new Date(result.endTime).getTime() -
                    new Date(result.startTime).getTime()
                  : 0;
              console.log(
                chalk.gray(
                  `     Status: ${result.status} | Duration: ${duration}ms`
                )
              );
            } catch {
              console.log(
                `  ${chalk.gray(`${index + 1}.`)} ${chalk.dim(file)}`
              );
            }
          });
        }
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to list results: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  // results show
  resultCommand
    .command("show <id>")
    .description("Show detailed test results")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (id: string, options: any) => {
      try {
        const resultsDir = path.join(process.cwd(), ".stressmaster", "results");
        const resultFile = path.join(resultsDir, `${id}.json`);

        if (!fs.existsSync(resultFile)) {
          console.error(chalk.red(`Result not found: ${id}`));
          process.exit(1);
        }

        const content = fs.readFileSync(resultFile, "utf8");
        const result = JSON.parse(content) as TestResult;

        if (options.format === "json") {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.blue.bold(`\n📊 Test Result: ${id}\n`));
          console.log(`  Status: ${chalk.cyan(result.status)}`);
          const duration =
            result.endTime && result.startTime
              ? new Date(result.endTime).getTime() -
                new Date(result.startTime).getTime()
              : 0;
          console.log(`  Duration: ${chalk.cyan(duration)}ms`);
          if (result.metrics) {
            console.log(
              `  Requests: ${chalk.cyan(result.metrics.totalRequests || 0)}`
            );
          }
        }
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to show result: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  // results compare
  resultCommand
    .command("compare <id1> <id2>")
    .description("Compare two test results")
    .action(async (id1: string, id2: string) => {
      try {
        const resultsDir = path.join(process.cwd(), ".stressmaster", "results");
        const file1 = path.join(resultsDir, `${id1}.json`);
        const file2 = path.join(resultsDir, `${id2}.json`);

        if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
          console.error(chalk.red("One or both results not found"));
          process.exit(1);
        }

        const result1 = JSON.parse(
          fs.readFileSync(file1, "utf8")
        ) as TestResult;
        const result2 = JSON.parse(
          fs.readFileSync(file2, "utf8")
        ) as TestResult;

        console.log(chalk.blue.bold("\n📊 Comparison\n"));
        console.log(`  ${chalk.cyan(id1)} vs ${chalk.cyan(id2)}\n`);

        if (result1.metrics && result2.metrics) {
          const req1 = result1.metrics.totalRequests || 0;
          const req2 = result2.metrics.totalRequests || 0;
          console.log(`  Requests: ${req1} vs ${req2}`);
        }

        const duration1 =
          result1.endTime && result1.startTime
            ? new Date(result1.endTime).getTime() -
              new Date(result1.startTime).getTime()
            : 0;
        const duration2 =
          result2.endTime && result2.startTime
            ? new Date(result2.endTime).getTime() -
              new Date(result2.startTime).getTime()
            : 0;
        console.log(`  Duration: ${duration1}ms vs ${duration2}ms`);
        console.log(`  Status: ${result1.status} vs ${result2.status}`);
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to compare results: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  // results export
  resultCommand
    .command("export <id> <format>")
    .description("Export result in different format")
    .option("--output <file>", "Output file path")
    .action(async (id: string, format: string, options: any) => {
      try {
        console.log(
          chalk.yellow(
            `⚠️  Result export not yet fully implemented for format: ${format}`
          )
        );
        // TODO: Implement result export
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to export result: ${(error as Error).message}`)
        );
        process.exit(1);
      }
    });

  return resultCommand;
}

#!/usr/bin/env node

// CLI entry point for StressMaster
import { CLIRunner } from "./interfaces/cli/cli-runner";
import { validateEnvironment } from "./config";

async function main() {
  // Validate environment configuration before starting
  const envValidation = validateEnvironment();

  if (!envValidation.valid) {
    console.error("❌ Environment validation failed:");
    envValidation.errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  if (envValidation.warnings.length > 0) {
    console.warn("⚠️  Environment warnings:");
    envValidation.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  const cli = new CLIRunner();
  await cli.run();
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

main().catch((error) => {
  console.error("CLI Error:", error);
  process.exit(1);
});

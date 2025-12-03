/**
 * Configuration Management Service
 * Handles CLI configuration operations
 */

import * as path from "path";
import * as fs from "fs";
import { StressMasterError, ErrorCodes } from "../features/common/error-utils";
import { safeReadFile, safeWriteFile, ensureDirectory } from "../features/common/file-utils";

export interface StressMasterConfig {
  rootDirectory?: string;
  defaultDuration?: number;
  defaultVirtualUsers?: number;
  aiProvider?: string;
  cacheEnabled?: boolean;
  verbose?: boolean;
  outputFormat?: "json" | "csv" | "html";
}

export class ConfigManagementService {
  private readonly configPath: string;
  private readonly configDir: string;

  constructor(rootDirectory: string = process.cwd()) {
    this.configDir = path.join(rootDirectory, ".stressmaster");
    this.configPath = path.join(this.configDir, "config.json");
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<StressMasterConfig> {
    try {
      const content = await safeReadFile(this.configPath);
      if (!content) {
        return this.getDefaultConfig();
      }

      const config = JSON.parse(content) as StressMasterConfig;
      return { ...this.getDefaultConfig(), ...config };
    } catch (error) {
      // If config file doesn't exist or is invalid, return defaults
      return this.getDefaultConfig();
    }
  }

  /**
   * Set configuration value
   */
  async setConfig(key: string, value: any): Promise<void> {
    const config = await this.getConfig();
    
    // Validate key
    const validKeys = [
      "rootDirectory",
      "defaultDuration",
      "defaultVirtualUsers",
      "aiProvider",
      "cacheEnabled",
      "verbose",
      "outputFormat",
    ];

    if (!validKeys.includes(key)) {
      throw new StressMasterError(
        `Invalid config key: ${key}. Valid keys: ${validKeys.join(", ")}`,
        ErrorCodes.CONFIG_INVALID,
        { key, validKeys }
      );
    }

    // Validate value based on key
    this.validateConfigValue(key, value);

    // Update config
    (config as any)[key] = value;

    // Save config
    await this.saveConfig(config);
  }

  /**
   * Initialize configuration file
   */
  async initConfig(): Promise<string> {
    const defaultConfig = this.getDefaultConfig();

    await ensureDirectory(this.configDir);
    await safeWriteFile(
      this.configPath,
      JSON.stringify(defaultConfig, null, 2)
    );

    return this.configPath;
  }

  /**
   * Save configuration
   */
  private async saveConfig(config: StressMasterConfig): Promise<void> {
    await ensureDirectory(this.configDir);
    await safeWriteFile(
      this.configPath,
      JSON.stringify(config, null, 2)
    );
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): StressMasterConfig {
    return {
      rootDirectory: process.cwd(),
      defaultDuration: 60,
      defaultVirtualUsers: 1,
      aiProvider: "claude",
      cacheEnabled: true,
      verbose: false,
      outputFormat: "json",
    };
  }

  /**
   * Validate configuration value
   */
  private validateConfigValue(key: string, value: any): void {
    switch (key) {
      case "defaultDuration":
      case "defaultVirtualUsers":
        if (typeof value !== "number" || value <= 0) {
          throw new StressMasterError(
            `${key} must be a positive number`,
            ErrorCodes.CONFIG_INVALID,
            { key, value }
          );
        }
        break;

      case "cacheEnabled":
      case "verbose":
        if (typeof value !== "boolean") {
          throw new StressMasterError(
            `${key} must be a boolean`,
            ErrorCodes.CONFIG_INVALID,
            { key, value }
          );
        }
        break;

      case "outputFormat":
        if (!["json", "csv", "html"].includes(value)) {
          throw new StressMasterError(
            `outputFormat must be one of: json, csv, html`,
            ErrorCodes.CONFIG_INVALID,
            { key, value }
          );
        }
        break;

      case "rootDirectory":
        if (typeof value !== "string") {
          throw new StressMasterError(
            `rootDirectory must be a string`,
            ErrorCodes.CONFIG_INVALID,
            { key, value }
          );
        }
        if (!fs.existsSync(value)) {
          throw new StressMasterError(
            `rootDirectory does not exist: ${value}`,
            ErrorCodes.CONFIG_INVALID,
            { key, value }
          );
        }
        break;

      case "aiProvider":
        if (typeof value !== "string") {
          throw new StressMasterError(
            `aiProvider must be a string`,
            ErrorCodes.CONFIG_INVALID,
            { key, value }
          );
        }
        // Basic validation against known providers to prevent typos
        const allowedProviders = ["openai", "claude", "gemini", "openrouter", "amazonq"];
        if (!allowedProviders.includes(value)) {
          throw new StressMasterError(
            `aiProvider must be one of: ${allowedProviders.join(", ")}`,
            ErrorCodes.CONFIG_INVALID,
            { key, value, allowedProviders }
          );
        }
        break;
    }
  }
}



/**
 * Template Management Service
 * Handles test template operations
 */

import * as path from "path";
import * as fs from "fs";
import { LoadTestSpec } from "../types";
import { StressMasterError, ErrorCodes } from "../features/common/error-utils";
import { safeReadFile, safeWriteFile, ensureDirectory } from "../features/common/file-utils";

export interface Template {
  name: string;
  description?: string;
  command: string;
  spec: LoadTestSpec;
  createdAt: Date;
  lastUsed?: Date;
}

export class TemplateManagementService {
  private readonly templatesDir: string;

  constructor(rootDirectory: string = process.cwd()) {
    this.templatesDir = path.join(rootDirectory, ".stressmaster", "templates");
  }

  /**
   * List all templates
   */
  async listTemplates(): Promise<Template[]> {
    await ensureDirectory(this.templatesDir);

    const templates: Template[] = [];

    try {
      const files = fs.readdirSync(this.templatesDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const template = await this.loadTemplate(file.replace(".json", ""));
            templates.push(template);
          } catch {
            // Skip invalid templates
          }
        }
      }
    } catch {
      // Directory might not exist yet
    }

    return templates.sort((a, b) => 
      (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0)
    );
  }

  /**
   * Create a template from a command and spec
   */
  async createTemplate(
    name: string,
    command: string,
    spec: LoadTestSpec,
    description?: string
  ): Promise<Template> {
    await ensureDirectory(this.templatesDir);

    const template: Template = {
      name,
      description,
      command,
      spec,
      createdAt: new Date(),
    };

    const templatePath = this.getTemplatePath(name);
    await safeWriteFile(
      templatePath,
      JSON.stringify(template, null, 2)
    );

    return template;
  }

  /**
   * Load a template by name
   */
  async loadTemplate(name: string): Promise<Template> {
    const templatePath = this.getTemplatePath(name);

    try {
      const content = await safeReadFile(templatePath);
      if (!content) {
        throw new StressMasterError(
          `Template not found: ${name}`,
          ErrorCodes.FILE_NOT_FOUND,
          { name, path: templatePath }
        );
      }

      const template = JSON.parse(content) as Template;
      return template;
    } catch (error) {
      if (error instanceof StressMasterError) {
        throw error;
      }
      throw new StressMasterError(
        `Failed to load template: ${(error as Error).message}`,
        ErrorCodes.FILE_NOT_FOUND,
        { name }
      );
    }
  }

  /**
   * Use a template (updates lastUsed timestamp)
   */
  async useTemplate(name: string): Promise<Template> {
    const template = await this.loadTemplate(name);
    template.lastUsed = new Date();

    const templatePath = this.getTemplatePath(name);
    await safeWriteFile(
      templatePath,
      JSON.stringify(template, null, 2)
    );

    return template;
  }

  /**
   * Export template to file
   */
  async exportTemplate(name: string, outputPath: string): Promise<void> {
    const template = await this.loadTemplate(name);
    await safeWriteFile(
      outputPath,
      JSON.stringify(template, null, 2)
    );
  }

  /**
   * Delete a template
   */
  async deleteTemplate(name: string): Promise<void> {
    const templatePath = this.getTemplatePath(name);
    try {
      fs.unlinkSync(templatePath);
    } catch (error) {
      throw new StressMasterError(
        `Failed to delete template: ${(error as Error).message}`,
        ErrorCodes.FILE_NOT_FOUND,
        { name }
      );
    }
  }

  /**
   * Get template file path
   */
  private getTemplatePath(name: string): string {
    // Sanitize name for filename
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, "_");
    return path.join(this.templatesDir, `${sanitizedName}.json`);
  }
}


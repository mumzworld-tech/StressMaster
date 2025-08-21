import { PromptTemplate, PromptConfig } from "./types";
import {
  COMMAND_PARSER_PROMPT,
  COMPLEX_JSON_PROMPT,
  WORKING_COMMAND_PROMPT,
  selectPromptTemplate,
} from "./command-parser-prompt";

export class PromptManager {
  private config: PromptConfig;
  private templates: Map<string, PromptTemplate>;

  constructor(config?: Partial<PromptConfig>) {
    this.config = {
      defaultTemplate: "command-parser",
      templates: {},
      ...config,
    };

    this.templates = new Map();
    this.registerDefaultTemplates();
  }

  private registerDefaultTemplates(): void {
    this.registerTemplate(COMMAND_PARSER_PROMPT);
    this.registerTemplate(COMPLEX_JSON_PROMPT);
    this.registerTemplate(WORKING_COMMAND_PROMPT);
  }

  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.name, template);
  }

  getTemplate(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }

  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  buildPrompt(templateName: string, variables: Record<string, string>): string {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    let prompt = template.template;
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, "g"), value);
    }

    return prompt;
  }

  selectPromptForInput(input: string): string | null {
    return selectPromptTemplate(input);
  }

  getPromptInfo(
    templateName: string
  ): { name: string; version: string; description: string } | null {
    const template = this.getTemplate(templateName);
    if (!template) return null;

    return {
      name: template.name,
      version: template.version,
      description: template.description,
    };
  }

  listAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }
}

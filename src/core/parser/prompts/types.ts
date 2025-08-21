export interface PromptTemplate {
  name: string;
  version: string;
  description: string;
  template: string;
  variables?: string[];
}

export interface PromptConfig {
  defaultTemplate: string;
  templates: Record<string, PromptTemplate>;
}

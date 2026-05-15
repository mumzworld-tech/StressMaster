/**
 * MCP Management Tool Handlers
 *
 * Config and template management tools for the StressMaster MCP server.
 */

import type {
  GetConfigInput,
  SetConfigInput,
  ListTemplatesInput,
  ManageTemplateInput,
  SetConfigOutput,
  ManageTemplateOutput,
  ToolResult,
  ServiceContext,
  StressMasterConfig,
  Template,
} from "../types";

/**
 * Get configuration
 * Returns full config or specific key value
 */
export async function getConfig(
  input: GetConfigInput,
  ctx: ServiceContext
): Promise<ToolResult<StressMasterConfig | string>> {
  try {
    const config = await ctx.config.getConfig();

    // Return specific key if requested
    if (input.key) {
      const value = (config as any)[input.key];
      if (value === undefined) {
        return {
          success: false,
          error: `Configuration key not found: ${input.key}`,
          code: "CONFIG_KEY_NOT_FOUND",
        };
      }
      return { success: true, data: String(value) };
    }

    // Return full config
    return { success: true, data: config };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: "CONFIG_GET_ERROR",
    };
  }
}

/**
 * Set configuration value
 * Returns new value and previous value
 */
export async function setConfig(
  input: SetConfigInput,
  ctx: ServiceContext
): Promise<ToolResult<SetConfigOutput>> {
  try {
    // Get previous value
    const currentConfig = await ctx.config.getConfig();
    const previousValue = (currentConfig as any)[input.key];

    // Set new value
    await ctx.config.setConfig(input.key, input.value);

    return {
      success: true,
      data: {
        key: input.key,
        value: input.value,
        previousValue: previousValue !== undefined ? String(previousValue) : undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: "CONFIG_SET_ERROR",
    };
  }
}

/**
 * List all templates
 */
export async function listTemplates(
  input: ListTemplatesInput,
  ctx: ServiceContext
): Promise<ToolResult<Template[]>> {
  try {
    const templates = await ctx.templates.listTemplates();
    return { success: true, data: templates };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: "TEMPLATE_LIST_ERROR",
    };
  }
}

/**
 * Manage templates (create, load, delete, export)
 */
export async function manageTemplate(
  input: ManageTemplateInput,
  ctx: ServiceContext
): Promise<ToolResult<ManageTemplateOutput>> {
  try {
    const { action, name, spec, description } = input;

    // Validate action
    const validActions = ["create", "load", "delete", "export"];
    if (!validActions.includes(action)) {
      return {
        success: false,
        error: `Invalid action: ${action}. Valid actions: ${validActions.join(", ")}`,
        code: "INVALID_ACTION",
      };
    }

    switch (action) {
      case "create": {
        // Validate spec is provided for create
        if (!spec) {
          return {
            success: false,
            error: "LoadTestSpec is required for create action",
            code: "MISSING_SPEC",
          };
        }

        const template = await ctx.templates.createTemplate(name, name, spec, description);
        return {
          success: true,
          data: {
            action,
            name,
            template,
            message: `Template '${name}' created successfully`,
          },
        };
      }

      case "load": {
        const template = await ctx.templates.loadTemplate(name);
        return {
          success: true,
          data: {
            action,
            name,
            template,
            message: `Template '${name}' loaded successfully`,
          },
        };
      }

      case "delete": {
        await ctx.templates.deleteTemplate(name);
        return {
          success: true,
          data: {
            action,
            name,
            message: `Template '${name}' deleted successfully`,
          },
        };
      }

      case "export": {
        const template = await ctx.templates.loadTemplate(name);
        return {
          success: true,
          data: {
            action,
            name,
            template,
            message: `Template '${name}' exported successfully`,
          },
        };
      }

      default: {
        // TypeScript should prevent this, but handle it for safety
        return {
          success: false,
          error: `Unhandled action: ${action}`,
          code: "UNHANDLED_ACTION",
        };
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: "TEMPLATE_OPERATION_ERROR",
    };
  }
}

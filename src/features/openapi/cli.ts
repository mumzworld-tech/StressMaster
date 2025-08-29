import * as chalk from "chalk";
import { OpenAPIParser } from "./parser";
import { OpenAPIPayloadGenerator } from "./generator";
import {
  formatEndpointInfo,
  getEndpointStats,
  filterEndpoints,
  generateSpecSummary,
  endpointToCurl,
  validateOpenAPISpec,
  isValidOpenAPIFile,
} from "./utils";
import { GeneratedEndpoint } from "./types";

export class OpenAPICLI {
  private parser: OpenAPIParser;
  private generator: OpenAPIPayloadGenerator;

  constructor() {
    this.parser = new OpenAPIParser();
    this.generator = new OpenAPIPayloadGenerator();
  }

  /**
   * Parse OpenAPI specification from file
   */
  async parseSpec(filePath: string): Promise<void> {
    console.log(chalk.blue("🔍 Parsing OpenAPI specification..."));

    if (!isValidOpenAPIFile(filePath)) {
      console.error(
        chalk.red(
          "❌ Invalid file format. Supported formats: .yaml, .yml, .json"
        )
      );
      return;
    }

    try {
      const result = await this.parser.parseFromFile(filePath);

      if (!result.success) {
        console.error(chalk.red("❌ Failed to parse OpenAPI specification:"));
        result.errors?.forEach((error) =>
          console.error(chalk.red(`   ${error}`))
        );
        return;
      }

      this.displaySpecInfo(result);
      this.displayEndpoints(result.endpoints);
    } catch (error) {
      console.error(chalk.red(`❌ Error parsing specification: ${error}`));
    }
  }

  /**
   * Generate payloads for an endpoint
   */
  async generatePayloads(
    filePath: string,
    endpointPath?: string,
    method?: string
  ): Promise<void> {
    console.log(chalk.blue("🎯 Generating payloads..."));

    try {
      const result = await this.parser.parseFromFile(filePath);

      if (!result.success) {
        console.error(chalk.red("❌ Failed to parse OpenAPI specification"));
        return;
      }

      let endpoints = result.endpoints;

      // Filter endpoints if specified
      if (endpointPath || method) {
        endpoints = filterEndpoints(endpoints, {
          path: endpointPath,
          method: method,
        });
      }

      if (endpoints.length === 0) {
        console.log(
          chalk.yellow("⚠️  No endpoints found matching the criteria")
        );
        return;
      }

      console.log(
        chalk.green(
          `\n📦 Generated payloads for ${endpoints.length} endpoint(s):\n`
        )
      );

      for (const endpoint of endpoints) {
        this.displayEndpointPayload(endpoint);
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error generating payloads: ${error}`));
    }
  }

  /**
   * List all endpoints
   */
  async listEndpoints(
    filePath: string,
    options: {
      method?: string;
      tag?: string;
      path?: string;
      hasRequestBody?: boolean;
    } = {}
  ): Promise<void> {
    console.log(chalk.blue("📋 Listing endpoints..."));

    try {
      const result = await this.parser.parseFromFile(filePath);

      if (!result.success) {
        console.error(chalk.red("❌ Failed to parse OpenAPI specification"));
        return;
      }

      let endpoints = result.endpoints;

      // Apply filters
      if (
        options.method ||
        options.tag ||
        options.path ||
        options.hasRequestBody !== undefined
      ) {
        endpoints = filterEndpoints(endpoints, options);
      }

      if (endpoints.length === 0) {
        console.log(
          chalk.yellow("⚠️  No endpoints found matching the criteria")
        );
        return;
      }

      this.displayEndpoints(endpoints);
    } catch (error) {
      console.error(chalk.red(`❌ Error listing endpoints: ${error}`));
    }
  }

  /**
   * Generate cURL commands for endpoints
   */
  async generateCurl(filePath: string, baseUrl?: string): Promise<void> {
    console.log(chalk.blue("🔗 Generating cURL commands..."));

    try {
      const result = await this.parser.parseFromFile(filePath);

      if (!result.success) {
        console.error(chalk.red("❌ Failed to parse OpenAPI specification"));
        return;
      }

      const url = baseUrl || result.baseUrl || "http://localhost:3000";

      console.log(chalk.green(`\n🔗 cURL commands (base URL: ${url}):\n`));

      for (const endpoint of result.endpoints) {
        const payload = this.generator.generateRequestPayload(endpoint);
        const curl = endpointToCurl(endpoint, url, payload.body);

        console.log(chalk.cyan(`# ${formatEndpointInfo(endpoint)}`));
        console.log(curl);
        console.log(""); // Empty line for readability
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error generating cURL commands: ${error}`));
    }
  }

  /**
   * Display specification information
   */
  private displaySpecInfo(result: any): void {
    const summary = generateSpecSummary(result.spec);
    const stats = getEndpointStats(result.endpoints);

    console.log(chalk.green("\n📊 Specification Summary:"));
    console.log(chalk.white(`   Title: ${summary.title}`));
    console.log(chalk.white(`   Version: ${summary.version}`));
    if (summary.description) {
      console.log(chalk.white(`   Description: ${summary.description}`));
    }
    console.log(chalk.white(`   Servers: ${summary.serverCount}`));
    console.log(chalk.white(`   Endpoints: ${summary.endpointCount}`));
    console.log(
      chalk.white(`   Components: ${summary.hasComponents ? "Yes" : "No"}`)
    );

    console.log(chalk.green("\n📈 Endpoint Statistics:"));
    console.log(chalk.white(`   Total: ${stats.total}`));

    if (Object.keys(stats.byMethod).length > 0) {
      console.log(chalk.white("   By Method:"));
      Object.entries(stats.byMethod).forEach(([method, count]) => {
        console.log(chalk.white(`     ${method}: ${count}`));
      });
    }

    if (Object.keys(stats.byTag).length > 0) {
      console.log(chalk.white("   By Tag:"));
      Object.entries(stats.byTag).forEach(([tag, count]) => {
        console.log(chalk.white(`     ${tag}: ${count}`));
      });
    }
  }

  /**
   * Display endpoints
   */
  private displayEndpoints(endpoints: GeneratedEndpoint[]): void {
    console.log(chalk.green(`\n🔗 Endpoints (${endpoints.length}):\n`));

    endpoints.forEach((endpoint, index) => {
      const methodColor = this.getMethodColor(endpoint.method);
      const methodDisplay = chalk[methodColor].bold(
        endpoint.method.toUpperCase().padEnd(6)
      );

      console.log(`${methodDisplay} ${endpoint.path}`);

      if (endpoint.summary) {
        console.log(chalk.gray(`       ${endpoint.summary}`));
      }

      if (endpoint.operationId) {
        console.log(chalk.gray(`       ID: ${endpoint.operationId}`));
      }

      if (endpoint.tags && endpoint.tags.length > 0) {
        console.log(chalk.gray(`       Tags: ${endpoint.tags.join(", ")}`));
      }

      if (index < endpoints.length - 1) {
        console.log(""); // Empty line between endpoints
      }
    });
  }

  /**
   * Display endpoint payload
   */
  private displayEndpointPayload(endpoint: GeneratedEndpoint): void {
    const methodColor = this.getMethodColor(endpoint.method);
    const methodDisplay = chalk[methodColor].bold(
      endpoint.method.toUpperCase()
    );

    console.log(chalk.cyan(`\n${methodDisplay} ${endpoint.path}`));

    if (endpoint.summary) {
      console.log(chalk.gray(`   ${endpoint.summary}`));
    }

    const payload = this.generator.generateRequestPayload(endpoint);

    if (Object.keys(payload).length > 0) {
      console.log(chalk.white("   Payload:"));
      console.log(chalk.gray(JSON.stringify(payload, null, 4)));
    } else {
      console.log(chalk.gray("   No payload required"));
    }
  }

  /**
   * Get color for HTTP method
   */
  private getMethodColor(
    method: string
  ): "green" | "blue" | "yellow" | "red" | "magenta" | "white" {
    const methodColors: Record<
      string,
      "green" | "blue" | "yellow" | "red" | "magenta" | "white"
    > = {
      GET: "green",
      POST: "blue",
      PUT: "yellow",
      DELETE: "red",
      PATCH: "magenta",
    };

    return methodColors[method.toUpperCase()] || "white";
  }

  /**
   * Show help information
   */
  showHelp(): void {
    console.log(chalk.blue("\n🔧 OpenAPI Commands:"));
    console.log(
      chalk.white(`
  openapi parse <file>                    Parse OpenAPI specification
  openapi list <file> [options]           List all endpoints
  openapi payloads <file> [options]       Generate payloads for endpoints
  openapi curl <file> [baseUrl]           Generate cURL commands
  
  Options:
    --method <method>                     Filter by HTTP method
    --tag <tag>                          Filter by tag
    --path <path>                        Filter by path pattern
    --has-body                           Only endpoints with request body
    --no-body                            Only endpoints without request body
    
  Examples:
    openapi parse api.yaml
    openapi list api.yaml --method POST
    openapi payloads api.yaml --tag users
    openapi curl api.yaml https://api.example.com
    `)
    );
  }
}

/**
 * MCP Sampling AI Provider
 *
 * Uses the MCP protocol's sampling capability to delegate AI completions
 * to the calling agent's active AI session (Claude Code, Kiro, Codex, etc.).
 *
 * This means users don't need to configure a separate API key —
 * the MCP server piggybacks on the client's existing AI session.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
} from "../core/parser/ai-providers";

export class McpSamplingProvider implements AIProvider {
  private _server: Server;
  private _ready: boolean = false;

  constructor(server: Server) {
    this._server = server;
  }

  async initialize(): Promise<void> {
    this._ready = true;
  }

  isReady(): boolean {
    return this._ready;
  }

  getProviderName(): string {
    return "mcp-sampling";
  }

  async healthCheck(): Promise<boolean> {
    return this._ready;
  }

  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    // Build MCP sampling messages from the completion request
    const messages: Array<{
      role: "user" | "assistant";
      content: { type: "text"; text: string };
    }> = [];

    // If there's a system prompt, prepend it to the user message
    const userMessage = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.prompt}`
      : request.prompt;

    messages.push({
      role: "user",
      content: { type: "text", text: userMessage },
    });

    try {
      const result = await this._server.createMessage({
        messages,
        maxTokens: request.maxTokens || 4096,
      });

      // Extract text from the response content
      const text =
        typeof result.content === "string"
          ? result.content
          : result.content.type === "text"
            ? result.content.text
            : "";

      return {
        response: text,
        model: result.model || "mcp-sampling",
        usage: undefined,
        metadata: {
          provider: "mcp-sampling",
          cached: false,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      // If client doesn't support sampling, give a clear error
      if (message.includes("does not support sampling")) {
        throw new Error(
          "MCP client does not support sampling. " +
            "Configure AI_PROVIDER and AI_API_KEY environment variables, " +
            "or use a client that supports MCP sampling (e.g., Claude Code)."
        );
      }

      throw error;
    }
  }
}

/**
 * Check if the MCP server's client supports sampling.
 * Must be called after the server is connected to a transport.
 */
export function clientSupportsSampling(server: Server): boolean {
  try {
    // The server tracks client capabilities after initialization
    const capabilities = (server as any)._clientCapabilities;
    return !!capabilities?.sampling;
  } catch {
    return false;
  }
}

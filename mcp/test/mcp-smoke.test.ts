import path from "node:path";
import { PassThrough } from "node:stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { McpConfig } from "../src/config.js";
import { createGitCadService } from "../src/gitcad-service.js";
import { createGitCadMcpServer } from "../src/mcp-server.js";

type JsonRpcMessage = Parameters<typeof serializeMessage>[0];

class InProcessStdioClientTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JsonRpcMessage) => void;

  private readonly readBuffer = new ReadBuffer();

  constructor(
    private readonly input: PassThrough,
    private readonly output: PassThrough,
  ) {}

  async start(): Promise<void> {
    this.output.on("data", this.onData);
    this.output.on("error", this.onStreamError);
  }

  async close(): Promise<void> {
    this.output.off("data", this.onData);
    this.output.off("error", this.onStreamError);
    this.input.end();
    this.onclose?.();
  }

  async send(message: JsonRpcMessage): Promise<void> {
    const serialized = serializeMessage(message);
    if (this.input.write(serialized)) {
      return;
    }
    await new Promise<void>((resolve) => this.input.once("drain", resolve));
  }

  private readonly onData = (chunk: Buffer): void => {
    this.readBuffer.append(chunk);
    while (true) {
      try {
        const message = this.readBuffer.readMessage();
        if (message === null) {
          break;
        }
        this.onmessage?.(message as JsonRpcMessage);
      } catch (error) {
        this.onerror?.(error as Error);
        break;
      }
    }
  };

  private readonly onStreamError = (error: Error): void => {
    this.onerror?.(error);
  };
}

function parseTextToolPayload(result: {
  content: Array<{ type: string; text?: string }>;
}): Record<string, unknown> {
  const first = result.content.find((item) => item.type === "text");
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    throw new Error("Tool result does not contain text payload");
  }
  return JSON.parse(first.text) as Record<string, unknown>;
}

describe("MCP stdio smoke", () => {
  it("lists tools and executes read-only calls", async () => {
    const config: McpConfig = {
      backendBaseUrl: "http://localhost:3000",
      requestTimeoutMs: 5000,
      httpHost: "127.0.0.1",
      httpPort: 8787,
      writeEnabled: false,
      dataProvider: "mock",
      mockDataPath: path.resolve(process.cwd(), "mcp/mock-data.json"),
    };

    const service = await createGitCadService(config);
    const server = createGitCadMcpServer({
      config,
      service,
      projectRoot: process.cwd(),
    });

    const clientToServer = new PassThrough();
    const serverToClient = new PassThrough();
    const serverTransport = new StdioServerTransport(clientToServer, serverToClient);
    await server.connect(serverTransport);

    const clientTransport = new InProcessStdioClientTransport(
      clientToServer,
      serverToClient,
    );
    const client = new Client({
      name: "gitcad-mcp-smoke",
      version: "0.1.0",
    });

    try {
      await client.connect(clientTransport);

      const tools = await client.listTools();
      expect(tools.tools.some((tool) => tool.name === "list_repositories")).toBe(
        true,
      );
      expect(tools.tools.some((tool) => tool.name === "get_review")).toBe(true);

      const repositoriesResult = await client.request(
        {
          method: "tools/call",
          params: {
            name: "list_repositories",
            arguments: {
              limit: 5,
            },
          },
        },
        CallToolResultSchema,
      );
      expect(repositoriesResult.isError).not.toBe(true);

      const repositoriesPayload = parseTextToolPayload(repositoriesResult);
      expect(Array.isArray(repositoriesPayload.items)).toBe(true);
      expect((repositoriesPayload.items as unknown[]).length).toBeGreaterThan(0);

      const reviewResult = await client.request(
        {
          method: "tools/call",
          params: {
            name: "get_review",
            arguments: {
              reviewId: "review_001",
            },
          },
        },
        CallToolResultSchema,
      );
      expect(reviewResult.isError).not.toBe(true);

      const reviewPayload = parseTextToolPayload(reviewResult);
      expect(reviewPayload.id).toBe("review_001");
    } finally {
      await client.close().catch(() => undefined);
      await clientTransport.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    }
  });
});


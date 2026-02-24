import "dotenv/config";

import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { readConfig } from "./config.js";
import { createGitCadService } from "./gitcad-service.js";
import { logError, logInfo } from "./logger.js";
import { createGitCadMcpServer } from "./mcp-server.js";

type Mode = "stdio" | "http";

type Session = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

function getMode(): Mode {
  const arg = process.argv[2];
  if (arg === "http") {
    return "http";
  }
  return "stdio";
}

async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw.length === 0) {
    return {};
  }
  return JSON.parse(raw);
}

function sendJsonRpcError(
  res: ServerResponse,
  code: number,
  message: string,
  id: number | string | null = null,
): void {
  if (res.headersSent) {
    return;
  }
  res.statusCode = 400;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id,
    }),
  );
}

async function startStdio(): Promise<void> {
  const config = readConfig();
  const service = await createGitCadService(config);
  const server = createGitCadMcpServer({
    config,
    service,
    projectRoot: process.cwd(),
  });
  const transport = new StdioServerTransport();

  await server.connect(transport);
  process.stdin.resume();
  const keepAlive = setInterval(() => {
    // keep event loop alive for stdio child-process mode
  }, 60_000);
  logInfo("MCP server started in stdio mode");

  const close = async () => {
    clearInterval(keepAlive);
    try {
      await server.close();
    } catch (error) {
      logError("Error while closing stdio server", error);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());
}

async function startHttp(): Promise<void> {
  const config = readConfig();
  const service = await createGitCadService(config);
  const sessions = new Map<string, Session>();

  const nodeServer = createServer(async (req, res) => {
    if (!req.url || !req.url.startsWith("/mcp")) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    try {
      const sessionId = req.headers["mcp-session-id"];
      const headerSession =
        typeof sessionId === "string" ? sessionId : sessionId?.[0];

      if (req.method === "POST") {
        const body = await readRequestBody(req);

        if (headerSession && sessions.has(headerSession)) {
          const session = sessions.get(headerSession)!;
          await session.transport.handleRequest(req, res, body);
          return;
        }

        if (!headerSession && isInitializeRequest(body)) {
          const mcpServer = createGitCadMcpServer({
            config,
            service,
            projectRoot: process.cwd(),
          });
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (generatedSessionId) => {
              sessions.set(generatedSessionId, { server: mcpServer, transport });
            },
          });

          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid) {
              sessions.delete(sid);
            }
            void mcpServer.close().catch((error) => {
              logError("Failed to close MCP session server", error);
            });
          };

          await mcpServer.connect(transport);
          await transport.handleRequest(req, res, body);
          return;
        }

        sendJsonRpcError(
          res,
          -32000,
          "Bad Request: missing or invalid MCP session",
          null,
        );
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        if (!headerSession || !sessions.has(headerSession)) {
          sendJsonRpcError(
            res,
            -32000,
            "Bad Request: missing or invalid MCP session",
            null,
          );
          return;
        }

        const session = sessions.get(headerSession)!;
        await session.transport.handleRequest(req, res);
        return;
      }

      res.statusCode = 405;
      res.end("Method Not Allowed");
    } catch (error) {
      logError("HTTP MCP handler failed", error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          }),
        );
      }
    }
  });

  await new Promise<void>((resolve) => {
    nodeServer.listen(config.httpPort, config.httpHost, () => {
      resolve();
    });
  });
  logInfo("MCP server started in streamable-http mode", {
    host: config.httpHost,
    port: config.httpPort,
    endpoint: `http://${config.httpHost}:${config.httpPort}/mcp`,
  });

  const close = async () => {
    for (const [sessionId, session] of sessions.entries()) {
      sessions.delete(sessionId);
      try {
        await session.server.close();
      } catch (error) {
        logError(`Failed to close session ${sessionId}`, error);
      }
    }

    await new Promise<void>((resolve, reject) => {
      nodeServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    }).catch((error) => {
      logError("Failed to close HTTP server", error);
    });
    process.exit(0);
  };

  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());
}

async function main(): Promise<void> {
  const mode = getMode();
  if (mode === "http") {
    await startHttp();
    return;
  }
  await startStdio();
}

main().catch((error) => {
  logError("Fatal MCP server startup error", error);
  process.exit(1);
});

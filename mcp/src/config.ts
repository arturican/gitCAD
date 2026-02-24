import path from "node:path";
import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const numberFromEnv = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (typeof normalized === "string") {
    return Number(normalized);
  }
  return normalized;
}, z.number().int().positive());

const booleanFromEnv = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (typeof normalized !== "string") {
    return normalized;
  }
  const lower = normalized.toLowerCase();
  if (["1", "true", "yes", "on"].includes(lower)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(lower)) {
    return false;
  }
  return normalized;
}, z.boolean());

const envSchema = z.object({
  MCP_BACKEND_BASE_URL: z
    .preprocess(
      emptyToUndefined,
      z.string().url().default("http://localhost:3000"),
    )
    .default("http://localhost:3000"),
  MCP_AUTH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  MCP_REQUEST_TIMEOUT_MS: numberFromEnv.default(15000),
  MCP_HTTP_HOST: z
    .preprocess(emptyToUndefined, z.string().default("127.0.0.1"))
    .default("127.0.0.1"),
  MCP_HTTP_PORT: numberFromEnv.default(8787),
  MCP_WRITE_ENABLED: booleanFromEnv.default(false),
  MCP_DATA_PROVIDER: z
    .preprocess(
      emptyToUndefined,
      z.enum(["http", "mock"]).default("http"),
    )
    .default("http"),
  MCP_MOCK_DATA_PATH: z
    .preprocess(emptyToUndefined, z.string().default("mcp/mock-data.json"))
    .default("mcp/mock-data.json"),
});

export type McpConfig = {
  backendBaseUrl: string;
  authToken?: string;
  requestTimeoutMs: number;
  httpHost: string;
  httpPort: number;
  writeEnabled: boolean;
  dataProvider: "http" | "mock";
  mockDataPath: string;
};

export function readConfig(): McpConfig {
  const env = envSchema.parse(process.env);

  return {
    backendBaseUrl: env.MCP_BACKEND_BASE_URL,
    authToken: env.MCP_AUTH_TOKEN,
    requestTimeoutMs: env.MCP_REQUEST_TIMEOUT_MS,
    httpHost: env.MCP_HTTP_HOST,
    httpPort: env.MCP_HTTP_PORT,
    writeEnabled: env.MCP_WRITE_ENABLED,
    dataProvider: env.MCP_DATA_PROVIDER,
    mockDataPath: path.isAbsolute(env.MCP_MOCK_DATA_PATH)
      ? env.MCP_MOCK_DATA_PATH
      : path.resolve(process.cwd(), env.MCP_MOCK_DATA_PATH),
  };
}


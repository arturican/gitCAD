import { readFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { McpConfig } from "./config.js";
import {
  CreateCommentInput,
  CreateReviewInput,
  GitCadService,
} from "./gitcad-service.js";
import { logError } from "./logger.js";
import {
  createCommentInput,
  createReviewInput,
  deleteCommentInput,
  getCommentInput,
  getReviewInput,
  getRevisionPreviewInput,
  listCommentsInput,
  listFileRevisionsInput,
  listRepositoriesInput,
  listRepositoryTreeInput,
  listReviewsInput,
  resolveCommentInput,
} from "./schemas.js";

type ServerContext = {
  config: McpConfig;
  service: GitCadService;
  projectRoot: string;
};

type ToolResponse = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function asToolResponse(payload: unknown): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent:
      payload !== null && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : { value: payload },
  };
}

function asToolError(error: unknown): ToolResponse {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown tool execution error";
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

function assertWriteEnabled(config: McpConfig): void {
  if (!config.writeEnabled) {
    throw new Error(
      "Write operations are disabled. Set MCP_WRITE_ENABLED=1 to enable mutations.",
    );
  }
}

async function safeReadReadme(projectRoot: string): Promise<string> {
  try {
    return await readFile(path.resolve(projectRoot, "README.md"), "utf8");
  } catch (error) {
    logError("Failed to read README.md for MCP resource", error);
    return "README.md not found.";
  }
}

function buildApiContractText(): string {
  return [
    "# gitCAD API routes (baseline)",
    "",
    "- GET /repos?search=&limit=&cursor=",
    "- GET /repos/:id/tree?path=&limit=&cursor=",
    "- GET /files/:id/revisions?limit=&cursor=",
    "- GET /revisions/:id/preview",
    "- GET /reviews?repoId=&status=&limit=&cursor=",
    "- GET /reviews/:id",
    "- GET /comments?reviewId=&status=&limit=&cursor=",
    "- GET /comments/:id",
    "- POST /reviews",
    "- POST /comments",
    "- PATCH /comments/:id",
    "- DELETE /comments/:id",
    "",
    "All list responses should use cursor envelope:",
    "{ items, nextCursor }",
    "",
    "Error envelope:",
    "{ code, message, details? }",
  ].join("\n");
}

function buildSchemaText(): string {
  return [
    "# gitCAD domain model (MCP-facing)",
    "",
    "Repository:",
    "- id, name, projectId?, createdAt?, updatedAt?",
    "",
    "TreeItem:",
    "- id, repoId?, name, path, type(file|folder), size?, updatedAt?",
    "",
    "Revision:",
    "- id, fileId, authorId?, label?, createdAt?, status?",
    "",
    "Review:",
    "- id, repoId, title?, description?, status?, createdBy?, createdAt?, updatedAt?",
    "",
    "Comment:",
    "- id, reviewId, message, status?, resolved?, createdBy?, createdAt?, entityType?, entityId?, anchor?",
  ].join("\n");
}

export function createGitCadMcpServer(context: ServerContext): McpServer {
  const server = new McpServer({
    name: "gitcad-mcp",
    version: "0.1.0",
    title: "gitCAD MCP Server",
  });

  server.registerTool(
    "list_repositories",
    {
      description: "List repositories with optional search, cursor and limit.",
      inputSchema: listRepositoriesInput,
      annotations: {
        title: "List Repositories",
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const result = await context.service.listRepositories(args);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool list_repositories failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "list_repository_tree",
    {
      description:
        "List repository tree nodes for a repository path with cursor pagination.",
      inputSchema: listRepositoryTreeInput,
      annotations: {
        title: "List Repository Tree",
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const result = await context.service.listRepositoryTree(args.repoId, args);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool list_repository_tree failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "list_file_revisions",
    {
      description: "List revisions for a file.",
      inputSchema: listFileRevisionsInput,
      annotations: {
        title: "List File Revisions",
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const result = await context.service.listFileRevisions(args.fileId, args);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool list_file_revisions failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "get_revision_preview",
    {
      description:
        "Get revision preview metadata or direct preview URL for rendering.",
      inputSchema: getRevisionPreviewInput,
      annotations: {
        title: "Get Revision Preview",
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const result = await context.service.getRevisionPreview(args.revisionId);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool get_revision_preview failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "list_reviews",
    {
      description: "List reviews for a repository with optional status filter.",
      inputSchema: listReviewsInput,
      annotations: {
        title: "List Reviews",
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const result = await context.service.listReviews(args.repoId, args);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool list_reviews failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "get_review",
    {
      description: "Get review details by review id.",
      inputSchema: getReviewInput,
      annotations: {
        title: "Get Review",
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const result = await context.service.getReview(args.reviewId);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool get_review failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "list_comments",
    {
      description: "List comments for a review with optional status filter.",
      inputSchema: listCommentsInput,
      annotations: {
        title: "List Comments",
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const result = await context.service.listComments(args.reviewId, args);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool list_comments failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "get_comment",
    {
      description: "Get comment by id.",
      inputSchema: getCommentInput,
      annotations: {
        title: "Get Comment",
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const result = await context.service.getComment(args.commentId);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool get_comment failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "create_review",
    {
      description:
        "Create a new review in a repository (requires MCP_WRITE_ENABLED=1).",
      inputSchema: createReviewInput,
      annotations: {
        title: "Create Review",
        readOnlyHint: false,
      },
    },
    async (args) => {
      try {
        assertWriteEnabled(context.config);
        const payload: CreateReviewInput = args;
        const result = await context.service.createReview(payload);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool create_review failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "create_comment",
    {
      description:
        "Create a comment in a review (requires MCP_WRITE_ENABLED=1).",
      inputSchema: createCommentInput,
      annotations: {
        title: "Create Comment",
        readOnlyHint: false,
      },
    },
    async (args) => {
      try {
        assertWriteEnabled(context.config);
        const payload: CreateCommentInput = args;
        const result = await context.service.createComment(payload);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool create_comment failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "resolve_comment",
    {
      description:
        "Resolve or reopen a comment (requires MCP_WRITE_ENABLED=1).",
      inputSchema: resolveCommentInput,
      annotations: {
        title: "Resolve Comment",
        readOnlyHint: false,
      },
    },
    async (args) => {
      try {
        assertWriteEnabled(context.config);
        const result = await context.service.resolveComment(
          args.commentId,
          args.resolved,
        );
        return asToolResponse(result);
      } catch (error) {
        logError("Tool resolve_comment failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerTool(
    "delete_comment",
    {
      description:
        "Delete a comment. Destructive action requires confirm=true and MCP_WRITE_ENABLED=1.",
      inputSchema: deleteCommentInput,
      annotations: {
        title: "Delete Comment",
        readOnlyHint: false,
      },
    },
    async (args) => {
      try {
        assertWriteEnabled(context.config);
        const result = await context.service.deleteComment(args.commentId);
        return asToolResponse(result);
      } catch (error) {
        logError("Tool delete_comment failed", error);
        return asToolError(error);
      }
    },
  );

  server.registerResource(
    "project-readme",
    "resource://project/readme",
    {
      title: "Project README",
      description: "Repository README with stack and architectural notes.",
      mimeType: "text/markdown",
    },
    async () => {
      const readme = await safeReadReadme(context.projectRoot);
      return {
        contents: [
          {
            uri: "resource://project/readme",
            mimeType: "text/markdown",
            text: readme,
          },
        ],
      };
    },
  );

  server.registerResource(
    "project-api-contract",
    "resource://project/api",
    {
      title: "Project API Contract",
      description: "Current API routes and response envelopes used by MCP tools.",
      mimeType: "text/markdown",
    },
    async () => {
      return {
        contents: [
          {
            uri: "resource://project/api",
            mimeType: "text/markdown",
            text: buildApiContractText(),
          },
        ],
      };
    },
  );

  server.registerResource(
    "project-schema",
    "resource://project/schema",
    {
      title: "Project Domain Schema",
      description: "Entity fields used by the MCP server and tools.",
      mimeType: "text/markdown",
    },
    async () => {
      return {
        contents: [
          {
            uri: "resource://project/schema",
            mimeType: "text/markdown",
            text: buildSchemaText(),
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "triage-bug",
    {
      title: "Triage Bug",
      description:
        "Template for structured bug triage with reproduction and impact analysis.",
      argsSchema: {
        component: z.string().optional(),
        symptom: z.string(),
        observed: z.string().optional(),
        expected: z.string().optional(),
      },
    },
    async ({ component, symptom, observed, expected }) => {
      const lines = [
        "You are triaging a bug in gitCAD.",
        component ? `Component: ${component}` : "Component: not specified",
        `Symptom: ${symptom}`,
        observed ? `Observed behavior: ${observed}` : "Observed behavior: n/a",
        expected ? `Expected behavior: ${expected}` : "Expected behavior: n/a",
        "",
        "Checklist:",
        "1. Reproduce reliably with exact steps and environment.",
        "2. Identify regression window and likely owner area.",
        "3. Classify severity (user impact + blast radius).",
        "4. Capture logs/errors and suspected failing contract.",
        "5. Propose minimal safe fix and validation plan.",
      ];

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: lines.join("\n"),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "create-task-plan",
    {
      title: "Create Task Plan",
      description:
        "Template for safe batch planning before creating multiple tasks.",
      argsSchema: {
        objective: z.string(),
        repoId: z.string().optional(),
        batchSize: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({ objective, repoId, batchSize }) => {
      const lines = [
        "Create an execution plan before creating tasks in gitCAD.",
        `Objective: ${objective}`,
        repoId ? `Repository: ${repoId}` : "Repository: not fixed",
        `Batch size limit: ${batchSize}`,
        "",
        "Plan format:",
        "1. Scope boundaries and non-goals.",
        "2. Dependency graph and ordering.",
        "3. Risks, rollback points, and observability checks.",
        "4. Task titles + acceptance criteria.",
        "5. Safe execution window and verification steps.",
      ];

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: lines.join("\n"),
            },
          },
        ],
      };
    },
  );

  return server;
}


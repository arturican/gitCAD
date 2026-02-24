# README_MCP

MCP integration for `gitCAD`, implemented with official TypeScript SDK:
- `@modelcontextprotocol/sdk`

The server wraps project API contracts (REST routes from `README.md`) and exposes them as MCP tools/resources/prompts.

## Capabilities

### Tools

Read-only:
- `list_repositories`
- `list_repository_tree`
- `list_file_revisions`
- `get_revision_preview`
- `list_reviews`
- `get_review`
- `list_comments`
- `get_comment`

Write (disabled by default):
- `create_review`
- `create_comment`
- `resolve_comment`
- `delete_comment` (requires `confirm=true`)

Write safety:
- all write tools require `MCP_WRITE_ENABLED=1`
- destructive delete requires explicit `confirm=true`

### Resources

- `resource://project/readme` - repository `README.md`
- `resource://project/api` - API route list and response envelopes
- `resource://project/schema` - domain schema used by MCP tools

### Prompts

- `triage-bug` - structured bug triage template
- `create-task-plan` - safe batch planning template before creating tasks

## Run locally

Install deps:

```bash
pnpm install
```

Run stdio transport:

```bash
pnpm build
pnpm mcp:stdio
```

Run streamable HTTP transport:

```bash
pnpm build
pnpm mcp:http
```

Default HTTP endpoint:
- `http://127.0.0.1:8787/mcp`

## Environment variables

See `.env.example`.

Key vars:
- `MCP_DATA_PROVIDER=http|mock`
- `MCP_BACKEND_BASE_URL=http://localhost:3000`
- `MCP_WRITE_ENABLED=0|1`
- `MCP_AUTH_TOKEN=...` (optional)
- `MCP_HTTP_HOST`, `MCP_HTTP_PORT`
- `MCP_MOCK_DATA_PATH` (for smoke/local offline runs)

## Client connection examples

### Claude Desktop

`claude_desktop_config.json` fragment:

```json
{
  "mcpServers": {
    "gitcad": {
      "command": "node",
      "args": ["dist/mcp/src/server.js", "stdio"],
      "cwd": "/home/art/project/gitCAD",
      "env": {
        "MCP_DATA_PROVIDER": "http",
        "MCP_BACKEND_BASE_URL": "http://localhost:3000",
        "MCP_WRITE_ENABLED": "0"
      }
    }
  }
}
```

### OpenAI Agents/Apps

Use stdio command server config with the same command/cwd/env:
- command: `node`
- args: `["dist/mcp/src/server.js", "stdio"]`
- cwd: `/home/art/project/gitCAD`

For remote usage, point the MCP connector to:
- `http://127.0.0.1:8787/mcp` (streamable HTTP mode)

## Inspector checks

Run MCP Inspector against stdio server:

```bash
npx @modelcontextprotocol/inspector node dist/mcp/src/server.js stdio
```

If your Inspector version expects flags, use equivalent command/args mode and point to:
- command `pnpm`
- args `dist/mcp/src/server.js stdio`

## Tests

Unit tests (validation schemas):

```bash
pnpm test
```

Smoke test (stdio MCP handshake + tool calls):

```bash
pnpm mcp-smoke
```

import { describe, expect, it } from "vitest";
import {
  createCommentInputSchema,
  deleteCommentInputSchema,
  listRepositoriesInputSchema,
  resolveCommentInputSchema,
} from "../src/schemas.js";

describe("MCP input validation schemas", () => {
  it("accepts valid list_repositories payload", () => {
    const parsed = listRepositoriesInputSchema.parse({
      search: "pump",
      limit: 25,
      cursor: "repo_001",
    });

    expect(parsed.limit).toBe(25);
    expect(parsed.search).toBe("pump");
  });

  it("rejects invalid list_repositories limit", () => {
    const result = listRepositoriesInputSchema.safeParse({
      limit: 500,
    });

    expect(result.success).toBe(false);
  });

  it("requires explicit confirm=true for delete_comment", () => {
    const result = deleteCommentInputSchema.safeParse({
      commentId: "comment_123",
      confirm: false,
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty create_comment message", () => {
    const result = createCommentInputSchema.safeParse({
      reviewId: "review_123",
      message: "",
    });

    expect(result.success).toBe(false);
  });

  it("supports resolve_comment defaults", () => {
    const parsed = resolveCommentInputSchema.parse({
      commentId: "comment_123",
    });

    expect(parsed.resolved).toBe(true);
  });
});


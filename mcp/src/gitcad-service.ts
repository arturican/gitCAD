import { readFile } from "node:fs/promises";
import path from "node:path";
import { McpConfig } from "./config.js";
import { logError } from "./logger.js";
import {
  Comment,
  CursorPage,
  Repository,
  Review,
  Revision,
  RevisionPreview,
  TreeItem,
  commentSchema,
  normalizeEntity,
  normalizePage,
  previewSchema,
  repositorySchema,
  reviewSchema,
  revisionSchema,
  treeItemSchema,
} from "./schemas.js";

type ListParams = {
  cursor?: string;
  limit?: number;
  search?: string;
  status?: string;
  path?: string;
  repoId?: string;
};

export type CreateReviewInput = {
  repoId: string;
  title: string;
  description?: string;
};

export type CreateCommentInput = {
  reviewId: string;
  message: string;
  entityType?: string;
  entityId?: string;
  anchor?: Record<string, unknown>;
};

export interface GitCadService {
  listRepositories(params: ListParams): Promise<CursorPage<Repository>>;
  listRepositoryTree(
    repoId: string,
    params: ListParams,
  ): Promise<CursorPage<TreeItem>>;
  listFileRevisions(
    fileId: string,
    params: ListParams,
  ): Promise<CursorPage<Revision>>;
  getRevisionPreview(revisionId: string): Promise<RevisionPreview>;
  listReviews(repoId: string, params: ListParams): Promise<CursorPage<Review>>;
  getReview(reviewId: string): Promise<Review>;
  listComments(
    reviewId: string,
    params: ListParams,
  ): Promise<CursorPage<Comment>>;
  getComment(commentId: string): Promise<Comment>;
  createReview(input: CreateReviewInput): Promise<Review>;
  createComment(input: CreateCommentInput): Promise<Comment>;
  resolveComment(commentId: string, resolved: boolean): Promise<Comment>;
  deleteComment(commentId: string): Promise<{ deleted: true; commentId: string }>;
}

function appendQuery(
  url: URL,
  query: Record<string, string | number | undefined>,
): void {
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
}

function normalizePath(baseUrl: string, route: string): URL {
  const url = new URL(baseUrl);
  const cleanRoute = route.startsWith("/") ? route : `/${route}`;
  url.pathname = path.posix.join(url.pathname, cleanRoute);
  return url;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  if (text.trim().length === 0) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

class HttpGitCadService implements GitCadService {
  constructor(private readonly config: McpConfig) {}

  private async request(args: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    route: string;
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    acceptNotFound?: boolean;
  }): Promise<unknown> {
    const url = normalizePath(this.config.backendBaseUrl, args.route);
    if (args.query) {
      appendQuery(url, args.query);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );

    try {
      const response = await fetch(url, {
        method: args.method,
        headers: {
          "content-type": "application/json",
          ...(this.config.authToken
            ? { authorization: `Bearer ${this.config.authToken}` }
            : {}),
        },
        body: args.body === undefined ? undefined : JSON.stringify(args.body),
        signal: controller.signal,
      });

      if (response.status === 404 && args.acceptNotFound) {
        return null;
      }

      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload &&
          typeof (payload as { message: unknown }).message === "string"
            ? (payload as { message: string }).message
            : response.statusText;
        throw new Error(`HTTP ${response.status}: ${message}`);
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  async listRepositories(params: ListParams): Promise<CursorPage<Repository>> {
    const payload = await this.request({
      method: "GET",
      route: "/repos",
      query: {
        search: params.search,
        limit: params.limit,
        cursor: params.cursor,
      },
    });
    return normalizePage(payload, repositorySchema);
  }

  async listRepositoryTree(
    repoId: string,
    params: ListParams,
  ): Promise<CursorPage<TreeItem>> {
    const payload = await this.request({
      method: "GET",
      route: `/repos/${repoId}/tree`,
      query: {
        path: params.path,
        limit: params.limit,
        cursor: params.cursor,
      },
    });
    return normalizePage(payload, treeItemSchema);
  }

  async listFileRevisions(
    fileId: string,
    params: ListParams,
  ): Promise<CursorPage<Revision>> {
    const payload = await this.request({
      method: "GET",
      route: `/files/${fileId}/revisions`,
      query: {
        limit: params.limit,
        cursor: params.cursor,
      },
    });
    return normalizePage(payload, revisionSchema);
  }

  async getRevisionPreview(revisionId: string): Promise<RevisionPreview> {
    const route = `/revisions/${revisionId}/preview`;
    const fallback = {
      revisionId,
      previewUrl: normalizePath(this.config.backendBaseUrl, route).toString(),
    };

    try {
      const payload = await this.request({
        method: "GET",
        route,
      });

      if (payload && typeof payload === "object") {
        return normalizeEntity(
          {
            ...fallback,
            ...(payload as Record<string, unknown>),
          },
          previewSchema,
        );
      }

      return normalizeEntity(fallback, previewSchema);
    } catch (error) {
      logError("Falling back to preview URL because preview metadata failed", {
        revisionId,
        error,
      });
      return normalizeEntity(fallback, previewSchema);
    }
  }

  async listReviews(repoId: string, params: ListParams): Promise<CursorPage<Review>> {
    const payload = await this.request({
      method: "GET",
      route: "/reviews",
      query: {
        repoId,
        status: params.status,
        limit: params.limit,
        cursor: params.cursor,
      },
    });
    return normalizePage(payload, reviewSchema);
  }

  async getReview(reviewId: string): Promise<Review> {
    const payload = await this.request({
      method: "GET",
      route: `/reviews/${reviewId}`,
    });
    return normalizeEntity(payload, reviewSchema);
  }

  async listComments(
    reviewId: string,
    params: ListParams,
  ): Promise<CursorPage<Comment>> {
    const payload = await this.request({
      method: "GET",
      route: "/comments",
      query: {
        reviewId,
        status: params.status,
        limit: params.limit,
        cursor: params.cursor,
      },
    });
    return normalizePage(payload, commentSchema);
  }

  async getComment(commentId: string): Promise<Comment> {
    const payload = await this.request({
      method: "GET",
      route: `/comments/${commentId}`,
    });
    return normalizeEntity(payload, commentSchema);
  }

  async createReview(input: CreateReviewInput): Promise<Review> {
    const payload = await this.request({
      method: "POST",
      route: "/reviews",
      body: input,
    });
    return normalizeEntity(payload, reviewSchema);
  }

  async createComment(input: CreateCommentInput): Promise<Comment> {
    const payload = await this.request({
      method: "POST",
      route: "/comments",
      body: input,
    });
    return normalizeEntity(payload, commentSchema);
  }

  async resolveComment(commentId: string, resolved: boolean): Promise<Comment> {
    const payload = await this.request({
      method: "PATCH",
      route: `/comments/${commentId}`,
      body: { resolved },
    });
    return normalizeEntity(payload, commentSchema);
  }

  async deleteComment(
    commentId: string,
  ): Promise<{ deleted: true; commentId: string }> {
    await this.request({
      method: "DELETE",
      route: `/comments/${commentId}`,
      acceptNotFound: false,
    });
    return {
      deleted: true,
      commentId,
    };
  }
}

type MockStore = {
  repositories: Repository[];
  treeItems: TreeItem[];
  revisions: Revision[];
  previews: RevisionPreview[];
  reviews: Review[];
  comments: Comment[];
};

function filterPage<T extends { id: string }>(
  items: T[],
  params: ListParams,
): CursorPage<T> {
  const start = params.cursor
    ? Math.max(0, items.findIndex((item) => item.id === params.cursor) + 1)
    : 0;
  const limit = params.limit ?? 50;
  const slice = items.slice(start, start + limit);
  const nextCursor =
    start + limit < items.length && slice.length > 0
      ? slice[slice.length - 1]?.id ?? null
      : null;
  return {
    items: slice,
    nextCursor,
  };
}

class MockGitCadService implements GitCadService {
  private constructor(private readonly store: MockStore) {}

  static async fromFile(mockDataPath: string): Promise<MockGitCadService> {
    const raw = await readFile(mockDataPath, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;

    const store: MockStore = {
      repositories: normalizePage(data.repositories ?? [], repositorySchema).items,
      treeItems: normalizePage(data.treeItems ?? [], treeItemSchema).items,
      revisions: normalizePage(data.revisions ?? [], revisionSchema).items,
      previews: normalizePage(data.previews ?? [], previewSchema).items,
      reviews: normalizePage(data.reviews ?? [], reviewSchema).items,
      comments: normalizePage(data.comments ?? [], commentSchema).items,
    };

    return new MockGitCadService(store);
  }

  async listRepositories(params: ListParams): Promise<CursorPage<Repository>> {
    const filtered = this.store.repositories.filter((repo) =>
      params.search
        ? (repo.name ?? "").toLowerCase().includes(params.search.toLowerCase())
        : true,
    );
    return filterPage(filtered, params);
  }

  async listRepositoryTree(
    repoId: string,
    params: ListParams,
  ): Promise<CursorPage<TreeItem>> {
    const items = this.store.treeItems.filter(
      (item) =>
        String(item.repoId ?? "") === repoId &&
        (params.path ? item.path.startsWith(params.path) : true),
    );
    return filterPage(items, params);
  }

  async listFileRevisions(
    fileId: string,
    params: ListParams,
  ): Promise<CursorPage<Revision>> {
    const revisions = this.store.revisions.filter(
      (revision) => String(revision.fileId) === fileId,
    );
    return filterPage(revisions, params);
  }

  async getRevisionPreview(revisionId: string): Promise<RevisionPreview> {
    const preview = this.store.previews.find(
      (entry) => String(entry.revisionId) === revisionId,
    );
    if (!preview) {
      throw new Error(`Preview not found for revision ${revisionId}`);
    }
    return preview;
  }

  async listReviews(repoId: string, params: ListParams): Promise<CursorPage<Review>> {
    const reviews = this.store.reviews.filter(
      (review) =>
        String(review.repoId) === repoId &&
        (params.status
          ? String(review.status ?? "").toLowerCase() ===
            params.status.toLowerCase()
          : true),
    );
    return filterPage(reviews, params);
  }

  async getReview(reviewId: string): Promise<Review> {
    const review = this.store.reviews.find((entry) => entry.id === reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }
    return review;
  }

  async listComments(
    reviewId: string,
    params: ListParams,
  ): Promise<CursorPage<Comment>> {
    const comments = this.store.comments.filter(
      (comment) =>
        String(comment.reviewId) === reviewId &&
        (params.status
          ? String(comment.status ?? "").toLowerCase() ===
            params.status.toLowerCase()
          : true),
    );
    return filterPage(comments, params);
  }

  async getComment(commentId: string): Promise<Comment> {
    const comment = this.store.comments.find((entry) => entry.id === commentId);
    if (!comment) {
      throw new Error(`Comment not found: ${commentId}`);
    }
    return comment;
  }

  async createReview(input: CreateReviewInput): Promise<Review> {
    const next: Review = {
      id: `review_${Date.now()}`,
      repoId: input.repoId,
      title: input.title,
      description: input.description,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.reviews.unshift(next);
    return next;
  }

  async createComment(input: CreateCommentInput): Promise<Comment> {
    const next: Comment = {
      id: `comment_${Date.now()}`,
      reviewId: input.reviewId,
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      anchor: input.anchor,
      status: "open",
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    this.store.comments.unshift(next);
    return next;
  }

  async resolveComment(commentId: string, resolved: boolean): Promise<Comment> {
    const comment = this.store.comments.find((entry) => entry.id === commentId);
    if (!comment) {
      throw new Error(`Comment not found: ${commentId}`);
    }
    comment.resolved = resolved;
    comment.status = resolved ? "resolved" : "open";
    return comment;
  }

  async deleteComment(
    commentId: string,
  ): Promise<{ deleted: true; commentId: string }> {
    const index = this.store.comments.findIndex((entry) => entry.id === commentId);
    if (index < 0) {
      throw new Error(`Comment not found: ${commentId}`);
    }
    this.store.comments.splice(index, 1);
    return { deleted: true, commentId };
  }
}

export async function createGitCadService(
  config: McpConfig,
): Promise<GitCadService> {
  if (config.dataProvider === "mock") {
    return MockGitCadService.fromFile(config.mockDataPath);
  }
  return new HttpGitCadService(config);
}


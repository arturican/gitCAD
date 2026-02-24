import { z } from "zod";

const idSchema = z.union([z.string().min(1), z.number().int()]).transform(String);

export const repositorySchema = z
  .object({
    id: idSchema,
    name: z.string().optional(),
    projectId: idSchema.optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const treeItemSchema = z
  .object({
    id: idSchema,
    repoId: idSchema.optional(),
    name: z.string(),
    path: z.string(),
    type: z.enum(["file", "folder"]),
    size: z.number().nonnegative().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const revisionSchema = z
  .object({
    id: idSchema,
    fileId: idSchema,
    authorId: idSchema.optional(),
    label: z.string().optional(),
    createdAt: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const previewSchema = z
  .object({
    revisionId: idSchema,
    previewUrl: z.string().url(),
    mimeType: z.string().optional(),
    contentLength: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const reviewSchema = z
  .object({
    id: idSchema,
    repoId: idSchema,
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    createdBy: idSchema.optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const commentSchema = z
  .object({
    id: idSchema,
    reviewId: idSchema,
    message: z.string(),
    status: z.string().optional(),
    resolved: z.boolean().optional(),
    createdBy: idSchema.optional(),
    createdAt: z.string().optional(),
    entityType: z.string().optional(),
    entityId: idSchema.optional(),
    anchor: z.record(z.unknown()).optional(),
  })
  .passthrough();

export type Repository = z.infer<typeof repositorySchema>;
export type TreeItem = z.infer<typeof treeItemSchema>;
export type Revision = z.infer<typeof revisionSchema>;
export type RevisionPreview = z.infer<typeof previewSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Comment = z.infer<typeof commentSchema>;

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

const pageEnvelopeSchema = z
  .object({
    items: z.array(z.unknown()).optional(),
    data: z.array(z.unknown()).optional(),
    nextCursor: z.string().nullable().optional(),
    cursor: z.string().nullable().optional(),
  })
  .passthrough();

export function normalizePage<TSchema extends z.ZodTypeAny>(
  raw: unknown,
  itemSchema: TSchema,
): CursorPage<z.output<TSchema>> {
  if (Array.isArray(raw)) {
    return {
      items: raw.map((item) => itemSchema.parse(item)),
      nextCursor: null,
    };
  }

  const parsed = pageEnvelopeSchema.parse(raw);
  const rawItems = parsed.items ?? parsed.data ?? [];
  return {
    items: rawItems.map((item) => itemSchema.parse(item)),
    nextCursor: parsed.nextCursor ?? parsed.cursor ?? null,
  };
}

export function normalizeEntity<TSchema extends z.ZodTypeAny>(
  raw: unknown,
  schema: TSchema,
): z.output<TSchema> {
  return schema.parse(raw);
}

const limitSchema = z.number().int().min(1).max(200).optional();
const cursorSchema = z.string().min(1).optional();
const searchSchema = z.string().min(1).max(200).optional();

export const listRepositoriesInput = {
  search: searchSchema,
  limit: limitSchema,
  cursor: cursorSchema,
};
export const listRepositoriesInputSchema = z.object(listRepositoriesInput);

export const listRepositoryTreeInput = {
  repoId: z.string().min(1),
  path: z.string().optional(),
  cursor: cursorSchema,
  limit: limitSchema,
};
export const listRepositoryTreeInputSchema = z.object(listRepositoryTreeInput);

export const listFileRevisionsInput = {
  fileId: z.string().min(1),
  cursor: cursorSchema,
  limit: limitSchema,
};
export const listFileRevisionsInputSchema = z.object(listFileRevisionsInput);

export const getRevisionPreviewInput = {
  revisionId: z.string().min(1),
};
export const getRevisionPreviewInputSchema = z.object(getRevisionPreviewInput);

export const listReviewsInput = {
  repoId: z.string().min(1),
  status: z.string().optional(),
  cursor: cursorSchema,
  limit: limitSchema,
};
export const listReviewsInputSchema = z.object(listReviewsInput);

export const getReviewInput = {
  reviewId: z.string().min(1),
};
export const getReviewInputSchema = z.object(getReviewInput);

export const listCommentsInput = {
  reviewId: z.string().min(1),
  status: z.string().optional(),
  cursor: cursorSchema,
  limit: limitSchema,
};
export const listCommentsInputSchema = z.object(listCommentsInput);

export const getCommentInput = {
  commentId: z.string().min(1),
};
export const getCommentInputSchema = z.object(getCommentInput);

export const createReviewInput = {
  repoId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
};
export const createReviewInputSchema = z.object(createReviewInput);

export const createCommentInput = {
  reviewId: z.string().min(1),
  message: z.string().min(1).max(4000),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  anchor: z.record(z.unknown()).optional(),
};
export const createCommentInputSchema = z.object(createCommentInput);

export const resolveCommentInput = {
  commentId: z.string().min(1),
  resolved: z.boolean().default(true),
};
export const resolveCommentInputSchema = z.object(resolveCommentInput);

export const deleteCommentInput = {
  commentId: z.string().min(1),
  confirm: z.literal(true),
};
export const deleteCommentInputSchema = z.object(deleteCommentInput);

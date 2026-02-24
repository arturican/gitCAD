# API + Realtime Contracts (gitCAD)

Use this reference whenever adding or changing data contracts.

## 1) Endpoint Patterns

Representative endpoints:
- `GET /repos/:id/tree?path=&cursor=`
- `GET /files/:id/revisions?cursor=`
- `GET /revisions/:id/preview`
- `GET /reviews?repoId=`
- `POST /reviews`
- `POST /comments`
- `PATCH /comments/:id`

Keep naming and parameter conventions consistent with these patterns.

## 2) Pagination Envelope

Use cursor pagination:

```ts
type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
}
```

Rules:
- Return `items` even when empty.
- Return `nextCursor: null` at end of list.
- Keep cursor opaque to client components.

## 3) Error Envelope

```ts
type ApiErrorEnvelope = {
  code: string
  message: string
  details?: unknown
}
```

Rules:
- Keep `code` stable for UI branching.
- Keep `message` human-readable.
- Place machine details in `details`.

## 4) Query Key Factory Pattern

Create centralized keys in `shared/api/queryKeys.ts`:

```ts
export const queryKeys = {
  repos: {
    all: ['repos'] as const,
    byId: (id: string) => ['repos', id] as const,
    tree: (id: string, path: string) => ['repos', id, 'tree', path] as const,
  },
}
```

Rules:
- Avoid inline string keys inside components.
- Keep key structure stable across refactors.
- Invalidate minimally (`repos.byId(id)`, not global `repos.all` unless required).

## 5) Realtime Event Schema

Use one event envelope:

```ts
type RealtimeEvent<T = unknown> = {
  type: 'scanProgress' | 'previewReady' | 'reviewUpdated' | 'fileChanged' | string
  payload: T
  ts: string
  entityId: string
}
```

Transport guidance:
- Use SSE for push-only updates and progress.
- Use WebSocket for bidirectional interactions.

## 6) Frontend Boundary

- Parse all incoming payloads with zod in API adapters.
- Keep networking in `shared/api` and `entities/*/api`.
- Map transport payloads to UI-safe types before feature usage.

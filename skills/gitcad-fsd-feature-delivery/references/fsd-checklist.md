# FSD Feature Delivery Checklist (gitCAD)

Use this checklist while implementing features in `src/`.

## 1) Layer Mapping

- `app/`: routes, layouts, providers, page composition entry.
- `processes/`: multi-step workflows (for example review flow).
- `widgets/`: large composed UI blocks.
- `features/`: atomic user actions and interactions.
- `entities/`: domain models and entity-level API/selectors.
- `shared/`: infra, generic hooks/lib/ui, config, api client base.

## 2) Import Constraints

- Do not import upward from lower layers.
- `entities` must not import `features/processes/widgets`.
- `features` may import from `entities` and `shared` only.
- `processes/widgets` may compose multiple `features`.

## 3) API and DTO Boundary

- Place HTTP client primitives in `shared/api/http.ts`.
- Place entity API wrappers in `entities/*/api`.
- Parse incoming DTO at the boundary with `zod.parse()`.
- Expose UI-safe typed objects from entity adapters.

## 4) State Split

TanStack Query:
- server-backed data only;
- cache/invalidation/refetch behavior explicit.

Zustand:
- UI-only state (selected file, open panels, viewer mode, local drafts);
- do not duplicate server entities already owned by Query cache.

## 5) Query Key Practices

- Keep keys in shared factories, avoid ad-hoc strings.
- Keep keys stable and serializable.
- Invalidate by the smallest meaningful scope (repo/entity/view).

## 6) Review Before Merge

- Confirm new files are in the correct FSD layer.
- Confirm no forbidden imports were introduced.
- Confirm DTO parsing is present where data enters frontend.
- Confirm mutations define invalidation behavior.
- Run: `pnpm lint`, `pnpm typecheck`, relevant `pnpm test`.

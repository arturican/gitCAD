---
name: gitcad-fsd-feature-delivery
description: Implement and refactor gitCAD frontend features with strict FSD boundaries (app/processes/widgets/features/entities/shared), TanStack Query for server data, Zustand for UI-only state, and zod DTO validation at API boundaries. Use when tasks involve adding pages/widgets/features, moving code between layers, wiring server state, or enforcing architecture rules in src/.
---

# gitCAD FSD Feature Delivery

## Overview

Use this skill to implement production-grade feature changes in gitCAD without breaking FSD boundaries.
Use a repeatable workflow for layer placement, API wiring, UI state separation, and validation.

## Workflow

1. Identify change scope and target files.
2. Place code in the correct FSD layer before writing implementation.
3. Wire server state with TanStack Query and keep transient UI state in Zustand only.
4. Validate DTOs with zod at API boundaries and expose typed models to UI.
5. Verify architecture constraints, then run project checks.

## Layer Placement Rules

- Keep routing, layouts, providers, and global style wiring in `app/`.
- Keep long user scenarios (for example review flow) in `processes/`.
- Keep large UI compositions (repo shell, viewer pane) in `widgets/`.
- Keep isolated user actions in `features/`.
- Keep domain models and entity-specific API under `entities/`.
- Keep shared infrastructure, reusable UI, helpers, hooks, and config in `shared/`.

## Non-Negotiable Constraints

- Do not import `features/processes/widgets` from `entities`.
- Do not perform network calls outside `shared/api` or `entities/*/api`.
- Do not store server state in Zustand.
- Do not pass raw backend DTOs directly into UI without zod parsing.

## Execution Checklist

1. Read [references/fsd-checklist.md](references/fsd-checklist.md).
2. Choose target layer for each new/changed file.
3. Add or update query keys when new server resources appear.
4. Add invalidation strategy for mutations.
5. Keep UI-only modes/panel state local in Zustand.
6. Run `pnpm lint`, `pnpm typecheck`, and relevant tests.

## Done Criteria

- Feature follows FSD import constraints.
- Query and mutation behavior is predictable and invalidation is explicit.
- DTO parsing is enforced at boundaries.
- Developer checks pass locally.

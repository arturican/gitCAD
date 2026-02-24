---
name: gitcad-api-realtime-contracts
description: Define and enforce stable API contracts for gitCAD frontend integration, including typed query key factories, cursor pagination, unified error envelopes, and realtime event schemas over SSE or WebSocket. Use when tasks involve endpoint design, client adapters, cache invalidation strategy, or realtime update wiring.
---

# gitCAD API Realtime Contracts

## Overview

Use this skill to keep API, caching, and realtime behavior consistent across gitCAD features.
Apply it whenever backend changes or new frontend data flows risk inconsistent contracts.

## Workflow

1. Read [references/contracts.md](references/contracts.md).
2. Define endpoint input/output schema and parse DTOs with zod.
3. Add query key factory entries before wiring queries.
4. Specify mutation invalidation scope explicitly.
5. Add realtime events with stable `type/payload/ts/entityId`.
6. Validate pagination and error envelopes match existing contracts.

## API Contract Rules

- Use cursor responses as `{ items, nextCursor }`.
- Use errors as `{ code, message, details? }`.
- Keep transport/client concerns centralized in `shared/api/http.ts`.
- Keep entity-specific adapters in `entities/*/api`.

## Query Key and Invalidation Rules

- Register new keys in shared query key factories.
- Avoid ad-hoc string keys in feature components.
- Invalidate minimally by entity/repo scope, not global.

## Realtime Rules

- Use SSE when only server push/progress is needed.
- Use WebSocket when bidirectional interaction is required.
- Version event payloads when making breaking shape changes.

## Done Criteria

- New endpoints follow shared pagination and error envelopes.
- Query keys are centralized and mutation invalidation is explicit.
- Realtime events are documented and consumed with one schema family.

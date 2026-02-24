---
name: gitcad-viewer-annotations
description: Build and refactor gitCAD PDF/3D viewer and annotation workflows, including rendering performance, normalized annotation coordinates, camera pose navigation, and review-linked comments. Use when tasks involve viewer UX, annotation persistence, jump-to-comment behavior, zoom/pan/overlay issues, or PDF.js/Three.js integration.
---

# gitCAD Viewer Annotations

## Overview

Use this skill for viewer-heavy work where correctness and performance are both required.
Follow the workflow below to keep annotation data stable across zoom, viewport changes, and 3D camera transitions.

## Workflow

1. Read [references/pdf-3d-constraints.md](references/pdf-3d-constraints.md).
2. Select the target mode: PDF annotation, 3D annotation, or cross-mode review navigation.
3. Implement data shape first, then renderer and interaction layer.
4. Add rendering safeguards (worker, lazy render, throttling).
5. Validate behavior with realistic file sizes and annotation counts.

## PDF Mode Rules

- Use PDF.js worker and avoid SSR for heavy viewer modules.
- Keep annotation data normalized to page coordinates, not pixel coordinates.
- Recompute visual positions during render, not in persisted data.
- Load or render pages lazily based on viewport visibility.

## 3D Mode Rules

- Persist `{ cameraPose, hitPoint, objectId, commentId }` for each annotation.
- Make jump-to-annotation restore camera pose deterministically.
- Keep heavy parse/decode work off the main thread when possible.

## Review Integration Rules

- Keep comment IDs as the primary link between annotation and discussion thread.
- Support reverse navigation: comment -> annotation and annotation -> comment.
- Prefer optimistic UI only for low-risk actions (for example local draft markers).

## Done Criteria

- Annotation coordinates remain stable across zoom and resize.
- 3D jump-to-annotation reproduces intended viewpoint.
- Viewer stays responsive under common project loads.

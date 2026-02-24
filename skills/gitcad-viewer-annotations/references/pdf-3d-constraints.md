# PDF/3D Viewer Constraints (gitCAD)

Use these constraints for viewer and annotation implementation.

## 1) PDF Annotation Model

Persist annotations in normalized page coordinates:

```ts
type PdfAnnotation = {
  commentId: string
  page: number
  x: number
  y: number
  w?: number
  h?: number
  kind: 'pin' | 'rect' | 'line'
}
```

Rules:
- Store normalized coordinates, not viewport pixels.
- Recalculate viewport positions during render.
- Keep annotation payload independent of zoom value.

## 2) 3D Annotation Model

```ts
type ModelAnnotation = {
  commentId: string
  objectId: string
  hitPoint: { x: number; y: number; z: number }
  cameraPose: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    fov?: number
  }
}
```

Rules:
- Persist enough camera data to restore viewpoint deterministically.
- Keep `commentId` as the stable link to review discussion.
- Ensure jump-to-annotation restores camera before highlighting target.

## 3) Performance Guardrails

PDF:
- Run PDF.js in worker.
- Dynamically import heavy viewer modules without SSR.
- Render pages lazily by viewport.
- Throttle zoom/scroll handlers.

3D:
- Move heavy parsing/decoding off main thread when possible.
- Reuse buffers/materials where safe.
- Avoid full scene rerender on simple UI state changes.

## 4) UX Flow Integration

- Support both directions:
  - annotation -> comment thread;
  - comment -> viewer focus target.
- Keep local draft annotation state separate until save.
- Handle missing/deleted target objects gracefully.

## 5) Validation Scenarios

- Resize viewport and confirm annotation alignment stays correct.
- Zoom in/out repeatedly and verify no coordinate drift.
- Open review and jump across many annotations.
- Test large files and ensure viewer remains responsive.

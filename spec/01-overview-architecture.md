# MonomialHH TypeScript Backend and Cytoscape Frontend Spec

## Architecture

- Use TypeScript as the single source of truth for both backend data types and frontend integration.
- Backend code should be framework-independent and testable without a browser.
- Frontend code may use Cytoscape for graph editing/visualization and may wrap the existing `GAPToCyto` behavior in a cleaner app structure.
- Top priority: preserve the original translation behavior as much as possible, in both directions: QPA/GAP-to-Cytoscape and Cytoscape-to-QPA/GAP. The TypeScript redesign may reorganize, wrap, type, or isolate this code, but should not rewrite translation semantics unless there is a clear bug fix or an explicitly approved design change.
- Any intentional change to the original translation behavior must be highlighted in code comments at the change site. The comment must state what changed, how it diverges from the original `GAPToCyto` behavior, and why the divergence is necessary.
- Any implementation pass that changes QPA/GAP parsing, relation translation, arrow/vertex naming, force-label behavior, exported QPA syntax, or Cytoscape JSON import/export semantics must explicitly alert the user before or during that work. Do not silently fold translation-behavior changes into UI cleanup or monomial-computation work.
- Existing QPA text parsing may remain in an accordion as an import/export aid, but the primary workflow is graphical quiver and relation construction.
- Preserve the updated frontend's general user-facing shape: controls remain grouped above the graph work area, relation/status details appear in an info box, and translator/computation results appear in one unified output panel instead of being split across multiple output sections.
- The interface must not contain both a compact `Output` panel and a separate `Output details` panel. There is exactly one `OutputPanel`; it may have tabs, sections, internal scrolling, and expandable rows, but not a second output area competing for screen space.
- Internal code organization may and should change substantially. Prefer moving logic into small TypeScript modules over preserving the current single-file/global-function structure.
- Do not depend on GAP/QPA output formats for computation.

Recommended project structure:

```text
src/
  backend/
    quiver.ts
    paths.ts
    path-orientation.ts
    monomial-algebra.ts
    ambiguities.ts
    bardzell.ts
    chainCpx.ts
    cohomology.ts
    cup-product.ts
  frontend/
    app-state.ts
    app-events.ts
    cytoscape-adapter.ts
    cytoscape-view.ts
    relation-builder.ts
    relation-list-panel.ts
    orientation-control.ts
    monomial-computation-state.ts
    computation-controller.ts
    info-panel.ts
    output-panel.ts
    ambiguity-visualizer.ts
    theme.ts
    app.ts
  tests/
```

Frontend module responsibilities:

- `app.ts`: bootstraps the page, wires modules together, and owns no domain math.
- `app-state.ts`: defines frontend state types and state transition helpers.
- `app-events.ts`: centralizes DOM event wiring so handlers are easy to audit.
- `cytoscape-adapter.ts`: converts between Cytoscape elements and backend `Quiver` / `Path` data.
- `cytoscape-view.ts`: owns Cytoscape initialization, style, selection, layout, fit, save/export, and canvas commands.
- `relation-builder.ts`: owns path-selection mode, next-arrow restrictions, undo/cancel/save behavior.
- `relation-list-panel.ts`: renders saved relations and relation selection/editing state.
- `orientation-control.ts`: owns the user-facing path-orientation picker and updates relation/output display between `L2R` and `R2L` without mutating the underlying quiver.
- `monomial-computation-state.ts`: owns validation and cached normalized input for optional monomial-only computations.
- `computation-controller.ts`: calls backend lazy sequences and converts finite requested ranges into output items.
- `info-panel.ts`: renders current status and selected-item details only.
- `output-panel.ts`: renders translator output, optional computation controls, and ambiguity/Bardzell/cohomology/cup-product output sections.
- `ambiguity-visualizer.ts`: owns path highlighting, flow animation, play/pause/speed, and reduced-motion fallback.
- `theme.ts`: owns light/dark theme and persisted preference.

Do not keep new computation logic in inline `<script>` blocks or large global functions. The POC can remain as a temporary reference, but the TypeScript implementation should make every workflow testable without reading the whole UI file.


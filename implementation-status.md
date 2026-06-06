# Implementation Status

Current implementation boundary: Stage 1 implemented; human check required before Stage 2.

- Original QPA/GAP `<->` Cytoscape translator behavior is preserved by loading the unchanged legacy `GAPToCyto.js` into the root workbench DOM.
- The root UI is the translator workbench, with one output region containing translator output and staged monomial-tool state.
- TypeScript relation helpers store both `pathL2R` and `pathR2L`; the live legacy UI keeps its existing `terms` shape and uses `R2L` for display only until ambiguity cross-check work begins.
- The header orientation toggle now updates the live legacy relation display while preserving the current relation selection where possible.
- R2L relation display reverses path word order only; it keeps the same multiplication dot separator.
- The extra info panel beneath the output box and the duplicate relation-list label have been removed.
- The graphical relation-builder workflow is deferred to a stretch goal and is not required before Stage 2.
- Draggable splitter behavior lives in `src/frontend/splitters.ts` and is bundled into the single frontend entrypoint `public/assets/app.js`.
- `bun run dev` rebuilds the ignored `public/assets/app.js` bundle at startup so UI changes do not run from stale generated output.
- `maxPathLength` is visible in the output/computation controls, defaults to `50`, and rejects values below `20`.
- Monomial-algebra computations remain staged behind the spec checkpoints.
- Do not begin Stage 2 ambiguity computation until Stage 1 is human-checked.

Useful commands:

```powershell
bun run check
bun run build
bun run dev
```

Specs are split under `spec/`, starting with `spec/MonomialHH-TypeScript-Spec.md`.

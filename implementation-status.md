# Implementation Status

Current implementation boundary: Stage 2 in progress; ambiguity computation and selectable ambiguity rows are implemented, canvas path-piece animation remains.

- Original QPA/GAP `<->` Cytoscape translator behavior has been migrated into TypeScript modules; `legacy/` is reference-only and is not loaded by the root workbench DOM.
- The root UI is the translator workbench, with one output region containing translator output and staged monomial-tool state.
- TypeScript relation helpers store one canonical `L2R` path; the live UI keeps the existing relation `terms` shape and uses `R2L` for display only until ambiguity cross-check work begins.
- The header orientation toggle updates the relation display while preserving the current relation selection where possible.
- R2L relation display reverses path word order only; it keeps the same multiplication dot separator.
- The header shows the assumed/detected characteristic beside path orientation; QPA Draw logs characteristic detection to Info/Log instead of the old input-control status span.
- The extra info panel beneath the output box and the duplicate relation-list label have been removed.
- The graphical relation-builder workflow is deferred to a stretch goal and is not required before Stage 2.
- Draggable splitter behavior lives in `src/frontend/splitters.ts` and is bundled into the single frontend entrypoint `public/assets/app.js`.
- `bun run dev` rebuilds the ignored `public/assets/app.js` bundle at startup so UI changes do not run from stale generated output.
- `maxPathLength` is visible in the output/computation controls, defaults to `50`, and rejects values below `20`.
- Backend helpers now tidy up monomial algebra input, keep generic relation types/formatters in `src/backend/relations.ts`, check `RelationData.terms` for monomial shape, eliminate binomial redundant-arrow relations by path replacement while ignoring scalars, remove duplicate/divisible relation paths with logs, and enumerate admissible paths using the minimised generators up to `maxPathLength`.
- Backend ambiguity helpers now compute lazy primary `R2L` left ambiguities and development-check `L2R` right ambiguities, with `u_-1` stored as the target vertex in both conventions and orientation-mismatch warnings returned by `computeAmbiguities`.
- The frontend has a `Compute ambiguities` trigger that validates the current monomial relation data, runs the backend ambiguity computation, and renders through the shared `Up to` computation bound in the existing Info/Log output area. The shared `Log only last term` option renders only the last requested lazy-sequence term.
- The relation panel becomes a two-tab Relations/Ambiguities panel after a successful ambiguity computation. The Ambiguities tab groups rows by `Gamma[n]`, alternates row colors, and supports row selection.
- Stage 2 canvas path-piece animation for selected ambiguity rows is not implemented yet.

Useful commands:

```powershell
bun run check
bun run build
bun run dev
```

Specs are split under `spec/`, starting with `spec/MonomialHH-TypeScript-Spec.md`.

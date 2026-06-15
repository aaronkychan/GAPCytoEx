# Implementation Status

Current implementation boundary: Stage 4 implemented for degreewise Hochschild cohomology dimensions and representatives; ambiguity computation/visualization, bounded Hochschild cochain-complex computation, and Hochschild cohomology computation are implemented. Stage 5 cup product has not started.

- Original QPA/GAP `<->` Cytoscape translator behavior has been migrated into TypeScript modules; `legacy/` is reference-only and is not loaded by the root workbench DOM.
- The root UI is the translator workbench, with one output region containing translator output and staged monomial-tool state.
- TypeScript relation helpers store one canonical `L2R` path; the live UI keeps the existing relation `terms` shape and uses `R2L` for display only until ambiguity cross-check work begins.
- The header orientation toggle updates the relation display while preserving the current relation selection where possible.
- R2L relation display reverses path word order only; it keeps the same multiplication dot separator.
- The header shows the assumed/detected characteristic beside path orientation; QPA Draw logs characteristic detection to Info/Log instead of the old input-control status span.
- The extra info panel beneath the output box and the duplicate relation-list label have been removed.
- The graphical relation-builder workflow is deferred to a stretch goal and is not required before Stage 2.
- Draggable splitter behavior lives in `src/frontend/splitters.ts` and is bundled into the single frontend entrypoint `docs/assets/app.js`.
- `bun run dev` rebuilds the ignored `docs/assets/app.js` bundle at startup so UI changes do not run from stale generated output.
- `maxPathLength` is visible in the output/computation controls, defaults to `50`, and rejects values below `20`.
- Backend helpers now tidy up monomial algebra input, keep generic relation types/formatters in `src/backend/relations.ts`, check `RelationData.terms` for monomial shape, eliminate binomial redundant-arrow relations by path replacement while ignoring scalars, remove duplicate/divisible relation paths with logs, and enumerate admissible paths using the minimised generators up to `maxPathLength`.
- Backend ambiguity helpers now compute lazy primary `R2L` left ambiguities and development-check `L2R` right ambiguities, with `u_-1` stored as the target vertex in both conventions and orientation-mismatch warnings returned by `computeAmbiguities`.
- The frontend has a `Compute ambiguities` trigger that validates the current monomial relation data, runs the backend ambiguity computation, and renders through the shared `Up to` computation bound in the existing Info/Log output area. The `Log only last term` option remains commented in the HTML source but is not currently visible.
- The relation panel becomes a Relation/Ambiguities tab panel after a successful ambiguity computation. The Ambiguities tab groups rows by `Gamma[n]`, alternates row colors, supports row selection, and drives canvas path-piece animation.
- Backend Hochschild cochain-complex helpers build lazy terms `C^n = k Gamma[n] || B` and sparse coboundaries `d^n : C^n -> C^{n+1}` over rational coefficients. The source comments document the cochain indexing and paper-formula shift.
- `Compute Hochschild cochain complex` reuses the verified monomial algebra, admissible basis, and ambiguity computation when available. If ambiguities have not been computed yet, it computes and renders the Ambiguities tab first, then focuses the Hochschild tab.
- The Hochschild tab in the lower-left panel renders a bounded slice of terms and compact differential controls, compacting zero terms as `C^n (dim=0)`, zero whole differentials as a framed `d^n = 0` button, and zero basis images as `d^n↦0`; clicking a term-level `d^n` toggles only that degree's expanded full differential rows.
- Selecting a Hochschild basis row `p||b` highlights `p` and `b` on the canvas in contrasting colors and writes the color legend to the visible Info/Log textbox.
- Hochschild complex computation logs rational-field use, admissible-basis finite/max-bound status, ambiguity orientation mismatches if present, and checks newly available composites `d^{i+1}d^i`. Successful computations write process-grouped details only to the Info/Log textbox; failed computations also update the compact summary line.
- Backend Hochschild cohomology helpers compute lazy groups `HH^d` over rational coefficients by row-reducing the relevant sparse matrices. `HH^0` uses the vertex term `k Gamma[-1] || B`; positive degrees use the displayed Hochschild cochain complex with the documented one-degree shift.
- The `Hochschild cohomology` button reuses the cached monomial context and Hochschild cochain complex when available, ensures supporting ambiguity/complex output exists, and enhances the Hochschild tab with `HH^0`, `HH^{n+1}` summaries after compact differential buttons, and selectable `Cohom. representative` rows.
- The ambiguity extension rule rejects zero-overlap concatenations of relation words; this is covered by the rank-3 ALOS paper Example 5.5 cohomology-dimension regression.

Useful commands:

```powershell
bun run check
bun run build
bun run dev
```

Specs are split under `spec/`, starting with `spec/MonomialHH-TypeScript-Spec.md`.

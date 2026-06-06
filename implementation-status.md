# Implementation Status

Current implementation boundary: Stage 1 implemented; human check required before Stage 2.

- Original QPA/GAP `<->` Cytoscape translator behavior is preserved by loading the unchanged legacy `GAPToCyto.js` into the root workbench DOM.
- The root UI is the translator workbench, with one output region containing translator output and staged monomial-tool state.
- Relations store both `pathL2R` and `pathR2L`; switching `L2R` / `R2L` rerenders display text without mutating the quiver or GAP/QPA export convention.
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

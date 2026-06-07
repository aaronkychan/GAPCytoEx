# GAPCytoEx

GAPCytoEx is an extension of the original `GAPToCyto`
(translating QPA/GAP code to/from Cytoscape displays for quivers-with-relations) to calculation with monomial algebras.

The first goal is to keep the existing QPA/GAP `<->` Cytoscape translation
workflow intact while adding a staged interface for computing and visualising
ambiguities, Bardzell's chain complex, Hochschild cohomology, and eventually cup
products for monomial algebras.

The project is currently in early scaffolding. The implementation is staged so
that the translator, orientation conventions, ambiguity computations, and later
homological algebra features can be checked independently.

## Development

This subproject uses Bun.

```powershell
bun run check
bun run build
bun run dev
```

For the full specification of the project, see `spec/MonomialHH-TypeScript-Spec.md`,
the other files in the `spec/` folders are the split version of the full spec.
Current progress is tracked in `implementation-status.md`.

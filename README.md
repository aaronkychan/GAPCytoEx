# GAPCytoEx

GAPCytoEx is a TypeScript/Bun extension of the original `GAPToCyto`
translator for working with quivers, QPA/GAP input, Cytoscape displays, and
monomial algebra computations.

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

The TypeScript specification is split under `spec/`, starting with
`spec/MonomialHH-TypeScript-Spec.md`. Current progress is tracked in
`implementation-status.md`.

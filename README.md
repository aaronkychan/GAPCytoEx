# GAPCytoEx

GAPCytoEx is an extension of the original `GAPToCyto`
(translating QPA/GAP code to/from Cytoscape displays for quivers-with-relations) to calculation with monomial algebras.

The first goal is to keep the existing QPA/GAP-Cytoscape translation
workflow intact while adding a interface for computing and visualising
ambiguities, Hochschild complex/cohomology, and (maybe) eventually cup
products for monomial algebras.

## Development

This subproject uses Bun for compile and bundling.

For the full specification of the project, see `spec/MonomialHH-TypeScript-Spec.md`,
the other files in the `spec/` folders are the split version of the full spec.
Current progress is tracked in `implementation-status.md`.

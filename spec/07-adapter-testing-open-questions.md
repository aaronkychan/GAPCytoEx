## Backend/Frontend Adapter

Create a conversion layer:

```ts
function cytoscapeToMonomialInput(
  cyData: CytoscapeElementData[],
  relations: RelationPath[],
  activeOrientation: PathOrientation
): MonomialAlgebraInput;
```

Rules:

- Cytoscape nodes become `Vertex`.
- Cytoscape edges become `Arrow`.
- Edge `id` is the canonical `ArrowId`; edge `label` is display only.
- Relation paths are stored by arrow IDs, not labels.
- Relations produced from Cytoscape selection are recorded as `L2R` traversal paths.
- The adapter stores canonical `L2R` relation paths. Display code calls `reverseOrientation` for `R2L` output.
- `MonomialAlgebraInput.activeOrientation` records the user's current display convention. Ambiguity computation still uses the primary `R2L` algorithm plus the development `L2R` cross-check.
- `MonomialAlgebraInput.maxPathLength` records the user's admissible-path enumeration bound and must default to `50` when no explicit value is provided.
- The adapter allows an empty relation list and validates that each listed relation path is composable in the current quiver.

Frontend should never parse relation paths from display strings for backend computation.

## Testing Requirements

Backend tests:

- path composition, divisor detection, residual path extraction, and relation containment;
- `reverseOrientation` reverses path-word order, toggles `L2R`/`R2L`, preserves mathematical source/target, and does not reverse quiver arrows;
- `reverseOrientationOfAmbiguity` reverses ambiguity piece order, applies `reverseOrientation` to each piece, and preserves the mathematical underlying path;
- `tidyUpMonomialAlgebra` stores `originalRelations` and `minimisedRelations` for every verified monomial relation list;
- `maxPathLength` defaults to `50`, rejects values below `20`, and is used as the admissible-path enumeration safety bound;
- `underlyingPathOfAmbiguity` concatenates ambiguity pieces correctly, including length-zero vertex paths;
- minimal relation antichain minimising;
- empty relation lists produce populated `Gamma[-1]` and `Gamma[0]`, with empty `Gamma[n]` for every `n >= 1`;
- lazy ambiguity, Hochschild cochain term, coboundary, and cohomology sequences compute only requested degrees and cache repeated `getAt(n)` calls;
- `getArray(start, endInclusive)` returns the same data as repeated cached `getAt(n)` calls over that interval;
- admissible basis enumeration and finite-dimensional failure path;
- ambiguity sets for hand-computed examples;
- `computeLeftAmbiguitiesR2L` follows the paper-style left-ambiguity convention `u_{-1} | u_0 | ... | u_n`;
- `computeRightAmbiguitiesL2R` follows the equivalent traversal-style right-ambiguity convention `u_n | ... | u_0 | u_{-1}`;
- after applying `reverseOrientationOfAmbiguity`, `computeLeftAmbiguitiesR2L` and `computeRightAmbiguitiesL2R` return identical ambiguity sets degree by degree on test examples;
- when the two ambiguity implementations disagree, `computeAmbiguities` returns an `orientation-mismatch` warning rather than silently choosing one;
- Hochschild cochain indexing: `terms.getAt(n)` is defined only for `n >= 0`, `terms.getAt(n)` uses `Gamma[n]`, and `coboundaries.getAt(n)` is `d^n : terms[n] -> terms[n + 1]` for `n >= 0`;
- negative `getAt` requests are rejected for every lazy sequence except ambiguity, where `getAt(-1)` is valid;
- coboundary matrices satisfy `d^{n + 1} * d^n = 0`;
- cohomology for small known examples;
- cup product for quadratic and triangular examples.

Frontend tests:

- relation builder only allows composable next arrows;
- path-orientation control switches relation and ambiguity display between `L2R` and `R2L` without mutating Cytoscape edge direction or GAP/QPA export output;
- path-orientation control can switch after relations, output rows, and a selected ambiguity already exist, preserving graph, relation list, output content, and selection;
- `maxPathLength` is visible in the computation controls, defaults to `50`, rejects values below `20`, and blocks computation with an `InfoPanel` warning when invalid;
- relation save disabled for paths of length 0 or 1;
- confirm accepts a valid quiver with no listed relations;
- deleting/renaming arrows updates or removes affected relations;
- confirm button disabled/enabled in correct states;
- stale-state behavior after editing confirmed data;
- ambiguity selection drives edge animation and info-panel highlighting;
- light/dark theme switching persists for the session or local storage.

Visual QA:

- verify desktop and mobile layouts;
- verify no text overlaps controls;
- verify canvas remains usable with side panels open;
- verify dark and light themes have sufficient contrast;
- verify reduced-motion mode does not rely on animated gradients.

## Open Questions Requiring Resolution

1. Which field should v1 implement first: rationals, prime finite fields `F_p`, or both?
2. Should the frontend be rebuilt as a Vite/React TypeScript app, or kept as a vanilla TypeScript app compiled into the existing two-file style?
3. After `Confirm monomial algebra`, should graph editing be locked, or should edits be allowed while marking computations stale?
4. Should QPA text import remain fully supported, or only be preserved as a best-effort legacy import/export path?

## Non-Goals for v1

- No GAP/QPA dependency.
- No non-monomial relations or linear-combination relations.
- No symbolic field extensions unless explicitly added later.
- No automatic proof of finite-dimensionality beyond admissible-path enumeration termination.
- No server persistence unless a separate storage spec is added.


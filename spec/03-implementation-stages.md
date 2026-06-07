## Implementation Stages

Implement the TypeScript project in staged checkpoints. Do not start a later mathematical stage until the previous stage has been implemented, tested, and human-checked.

Stage 1: translator-preserving UI and orientation foundation

- Keep all original `GAPToCyto` translator capabilities.
- Establish the redesigned single-output UI layout.
- Implement the `L2R` / `R2L` display switch.
- Provide TypeScript helpers that store canonical `L2R` relation paths and derive `R2L` display with `reverseOrientation`.
- Keep the existing relation `terms` shape; `R2L` is display-only until ambiguity cross-check work begins.
- Add visible `maxPathLength` control with default `50` and minimum `20`.
- Defer the graphical relation-builder workflow to a stretch goal; it is not required before Stage 2.
- Human check required before Stage 2.

Stage 2: ambiguity computation and visualization

- Implement `computeLeftAmbiguitiesR2L`.
- Implement `computeRightAmbiguitiesL2R` as the development cross-check.
- Compare both ambiguity conventions via `reverseOrientationOfAmbiguity`.
- Show orientation mismatch warnings in `InfoPanel` and `OutputPanel`.
- Implement clickable ambiguity rows and path-piece animation.
- Human check required before Stage 3.

Stage 3: Hochschild cochain complex

- Implement the Hochschild cochain complex with terms
  `Hom_{A^e}(Bzl_{n+1}(A), A) \cong \Bbbk \Gamma_n || \mathcal{B}`.
- Use cochain degree `n >= 0`; degree `n` is built from `Gamma[n]` and admissible basis paths.
- Use only non-negative cochain indices. Any negative `getAt` request outside the ambiguity sequence is an implementation error.
- Human check required before Stage 4.

Stage 4: Hochschild cohomology

- Compute degreewise Hochschild cohomology from the approved Hochschild cochain complex.
- Add output rendering for cohomology groups and selected representatives.
- Human check required before Stage 5.

Stage 5: cup product UI design, implementation, and visualization

- First decide how the UI should expose and visualize cup products.
- Then implement cup-product computation.
- Add cup-product visualization/output only after the UI change is agreed.


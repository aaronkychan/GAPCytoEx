## Backend Algorithms

### 0. Align Path Orientation

Before ambiguity, Hochschild cochain-complex, cohomology, or cup-product computation, align the path orientation data.

Rules:

- The user may choose the displayed path convention: `L2R` or `R2L`.
- `L2R` is the frontend/Cytoscape traversal convention and the only convention used for GAP/QPA import/export compatibility.
- `R2L` is the paper convention and is the primary backend convention for ambiguity computation.
- Every monomial relation stores one canonical `L2R` traversal path in backend state.
- If the user chooses `R2L`, relation rows, ambiguity rows, and path displays should derive paper-order words with `reverseOrientation`; the quiver itself is not changed.
- `reverseOrientation(path)` must be the only helper that switches a path between `L2R` and `R2L` word order.
- `reverseOrientation` reverses only the stored arrow-word order and toggles the `orientation`; it preserves the mathematical path's `source` and `target` and does not reverse arrow directions.
- `tidyUpMonomialAlgebra(input)` validates relation composability using the stored `L2R` path, keeps `originalRelations`, and produces `minimisedRelations`.
- Invalid or stale relation orientation data must block computation and report a warning in `InfoPanel`.

### 1. Minimise Relation Generators

- Validate unique vertex IDs and arrow IDs.
- Validate every arrow source/target exists.
- Allow the relation list to be empty.
- Validate each listed relation path is composable and has length at least 2.
- Check the original relation list without changing it: if any linear-combination relation contains a term of length 1, log a warning naming that relation.
- Remove duplicate relation paths.
- Replace the relation list by the minimal monomial antichain: discard any relation that properly contains another relation as a divisor.
- Log every relation generator removed while minimising.
- Use orientation-aligned relations from `tidyUpMonomialAlgebra(input)`.
- Derive `R2L` words from `minimisedRelations` to construct the primary `R2L` left-ambiguity `Gamma[1]`.
- Use stored `L2R` words from `minimisedRelations` to construct the development cross-check `L2R` right-ambiguity `Gamma[1]`.
- For monomial-algebra checking from `RelationData`, first reject and log the count of relations with more than two terms.
- If a monomial relation consists of a single length-one path `a`, remove arrow `a` from the quiver and remove every relation containing `a` from the relation list.
- For a binomial `RelationData` relation with a length-one term, treat that term as the redundant arrow and treat the other term's monomial as the replacement path. If both binomial terms have length one, use the first term as the redundant arrow and the second term as the replacement path.
- Remove the redundant arrow from the quiver, remove the arrow-redundant relation itself, and replace every occurrence of that arrow in the remaining relation paths by the replacement path.
- Scalars play no role in this monomial-algebra check.
- After redundant-arrow replacement, remove duplicate relation paths and any relation path that properly contains another relation path as a contiguous divisor.
- Redundant-arrow elimination is part of checking a `RelationDataAlgebraInput` for monomial algebra computation. Do not apply it for unrelated relation-list inspection.
- Finally, check again that every remaining relation is monomial. If not, log that the computed list of relations is not monomial and terminate.

### 2. Enumerate Admissible Paths

The admissible basis `B` consists of all paths that do not contain any minimal relation as a contiguous divisor.

Algorithm:

- Check that the relation list is monomial.
- Minimise relation generators internally, log what was removed, and enumerate using the minimised list.
- Start with length-zero vertex paths and length-one arrow paths.
- Repeatedly extend admissible paths by one composable arrow.
- Reject any extension containing a relation divisor.
- Stop when no admissible extension exists.
- Only enumerate paths with length no greater than `maxPathLength`.
- If the user-configurable `maxPathLength` is reached before termination, report that finite-dimensionality was not confirmed.

### 3. Compute Ambiguities

Use the paper's ambiguity definitions with explicit orientation handling.

The primary backend ambiguity computation uses `R2L` path words and follows the paper closely. In that convention the implementation computes **left ambiguities**:

```text
u_{-1} | u_0 | ... | u_n
```

where `u_{-1}` is the target vertex path on the left in paper order.

The backend also implements the equivalent `L2R` **right ambiguity** construction:

```text
u_n | u_{n-1} | ... | u_0 | u_{-1}
```

where `u_{-1}` is the target vertex path on the right in traversal order. This second implementation exists as a development cross-check. During the development phase, pressing `Compute ambiguities` computes both versions, applies `reverseOrientationOfAmbiguity` to compare them, and reports a warning in `InfoPanel` and `OutputPanel` if the two lists differ.

Ambiguities are represented by an `AmbiguitySequence`, a memoized lazy sequence indexed by `n >= -1`. Calling `getAt(n)` computes any missing lower degrees required by the induction and then returns `Gamma[n]`. Calling `getArray(-1, N)` is the bounded helper used by the frontend and tests.

Store each ambiguity by its path-piece decomposition:

```ts
interface Ambiguity {
  n: number;
  pieces: Path[];
  orientation: PathOrientation;
  kind: AmbiguityKind;
}
```

Use `underlyingPathOfAmbiguity(ambiguity)` whenever the concatenated path is needed.

Primary `R2L` left-ambiguity base data:

- `Gamma[-1]`: one-piece decompositions containing length-zero vertex paths.
- `Gamma[0]`: decompositions `[targetVertexPath, arrowPathR2L]`.
- `Gamma[1]`: decompositions `[targetVertexPath, a, p]` for minimal monomial relations `a p` in `R2L` convention, where `a` is one arrow and `p` is a nonzero path.
- If `Gamma[1]` is empty, then every `Gamma[n]` for `n >= 1` is empty.

For `n >= 2`, compute the primary `R2L` left-ambiguity `Gamma[n]` inductively from `Gamma[n - 1]`:

- assume the previous left-ambiguity decomposition `u_{-1} | u_0 | ... | u_{n-1}` is already valid by induction;
- do not rescan or revalidate the whole underlying path from the beginning;
- test only new paths `u_n` for which the adjacent pair `u_{n-1}u_n` is exactly a minimal relation generator;
- for a candidate minimal relation `r`, the previous piece `u_{n-1}` must be a proper prefix of `r`;
- append only the remaining suffix of `r`;
- reject the candidate if any strict suffix of `u_{n-1}u_n` is itself a minimal relation generator;
- split the right-appended part so `u_{n-1}` grows by all but its rightmost arrow, and that rightmost arrow becomes `u_n`;
- do not extend by arbitrary admissible paths;
- deduplicate by the full path word returned by `underlyingPathOfAmbiguity`.

Primary `R2L` left-ambiguity implementation logic:

1. Minimise the input relation generators to the minimal monomial antichain `Rmin`.
2. Initialize:
   - `Gamma[-1] = [{ pieces: [vertexPath] }]`;
   - `Gamma[0] = [{ pieces: [targetVertexPath, arrowPathR2L] }]`;
   - `Gamma[1] = relationToLeftPiecesR2L(r)` for each `r in RminR2L`.
3. For every requested `n >= 2`, compute `Gamma[n]` from `Gamma[n - 1]`.
4. For each previous ambiguity `amb` with pieces `[u_{-1}, u_0, ..., u_{n-1}]`, treat the previous ambiguity as already valid. Do not check the earlier pieces again.
5. For each candidate extension, look only at `u_{n-1}` together with the proposed right-appended piece `u_n`.
6. For each minimal relation `r`, require `u_{n-1}` to be a proper prefix of `r`.
7. Define `rightAppend` to be the remaining suffix of `r` after this prefix.
8. The candidate is valid only when `u_{n-1} + rightAppend = r`.
9. Reject the candidate if any strict suffix of `u_{n-1} + rightAppend` is itself a minimal relation generator.
10. Form the candidate underlying path `pNew = underlyingPathOfAmbiguity(amb) + rightAppend`. This concatenated path is used to construct and deduplicate the candidate, not to revalidate the old ambiguity from the beginning.
11. Form the candidate piece list by replacing the previous rightmost non-vertex piece:
   - old pieces: `[u_{-1}, u_0, ..., u_{n-2}, u_{n-1}]`;
   - split the right-appended word as `rightAppend = r1...rk`;
   - new pieces: `[u_{-1}, u_0, ..., u_{n-2}, u_{n-1} r1...r_{k-1}, r_k]`.
12. If `rightAppend` has length `1`, then `u_{n-1} r1...r_{k-1}` means just `u_{n-1}`, so the new pieces are `[u_{-1}, u_0, ..., u_{n-1}, r1]`.
13. Store these ambiguities with `orientation: "R2L"` and `kind: "left"`.
14. Deduplicate candidates in `Gamma[n]` by the arrow word `pNew`.

Development cross-check:

- Implement `computeRightAmbiguitiesL2R` using the equivalent `L2R` right-ambiguity construction.
- `L2R` right ambiguities are stored as `u_n | u_{n-1} | ... | u_0 | u_{-1}`.
- During development, `computeAmbiguities(input)` must:
  1. call `tidyUpMonomialAlgebra(input)`;
  2. compute `primaryLeftR2L`;
  3. compute `checkRightL2R`;
  4. map one side through `reverseOrientationOfAmbiguity`;
  5. compare degree-by-degree after aligning display-only differences;
  6. emit an `orientation-mismatch` warning if the two lists are not identical.
- A mismatch warning must appear in both `InfoPanel` and the `OutputPanel` ambiguity section. It must not be hidden in the console.
- The mismatch warning should include the lowest degree where the two conventions diverge and enough display text to inspect the differing ambiguity rows.
- Once the two implementations are stable, the cross-check may be kept behind a development flag, but the spec requires it during the development phase.

The POC implementation must keep comments attached to these steps in the ambiguity computation code. If future corrections to the mathematical definition change the acceptance criterion for a candidate overlap, update this numbered logic first and then update the code comments to match.

The implementation must include focused tests for non-quadratic examples where ambiguity pieces are longer than one arrow.

### 4. Build Hochschild Cochain Complex

Build the Hochschild cochain complex used to compute Hochschild cohomology. Do not implement or expose a standalone Bardzell chain complex as the user-facing stage. Bardzell's resolution appears here only through the notation `Bzl_{n+1}(A)` in the term

```text
C^n = Hom_{A^e}(Bzl_{n+1}(A), A) \cong \Bbbk \Gamma_n || \mathcal{B}.
```

The complex is a virtually infinite object whose individual cochain degrees are finite-dimensional vector spaces over the selected field.

The `HochschildCochainComplex` object contains:

- `terms.getAt(n)`: the cochain term `C^n` in degree `n`;
- `coboundaries.getAt(n)`: the cochain coboundary `d^n : C^n -> C^{n + 1}`;
- `getArray(start, endInclusive)` helpers on both sequences for UI display, testing, and finite exports.

Indexing convention:

- Use cochain-complex convention.
- `terms.getAt(n)` is defined only for non-negative integers `n >= 0`.
- Calling `terms.getAt(n)` with `n < 0` is an error; no Hochschild cochain implementation should need it.
- `terms.getAt(n)` uses `Gamma[n]` and admissible basis paths.
- `coboundaries.getAt(n)` is the cochain map `d^n : terms[n] -> terms[n + 1]`.
- `coboundaries.getAt(n)` is defined for `n >= 0`.
- Calling `coboundaries.getAt(n)` with `n < 0` is an error.

For a cochain degree `n >= 0`, basis elements are pairs:

```ts
interface CochainBasisElement {
  ambiguity: Ambiguity; // p in Gamma[n]
  basisPath: Path;      // b in B
}
```

where `underlyingPathOfAmbiguity(ambiguity)` and `basisPath` have the same source and target.

Represent coboundaries as sparse matrices:

```ts
interface SparseMatrix {
  rows: number;
  cols: number;
  entries: Array<{ row: number; col: number; value: FieldElement }>;
}
```

Use the paper's Hochschild coboundary formulas with the cochain indexing above and the explicit `R2L`/`L2R` path-orientation rules from the ambiguity stage.

Field support for v1:

- rational numbers, or
- prime finite fields `F_p`.

The spec needs one field implementation chosen before coding.

### 5. Compute Cohomology

Hochschild cohomology is virtual degreewise data, implemented only after the Hochschild cochain-complex stage has been human-checked. `computeHochschildCohomology(input)` returns an object whose `groups.getAt(d)` computes `HH^d` only when requested, using the cached cochain data needed in that degree.

Compute:

```text
HH^d = Ext^d_{A^e}(A, A)
```

Use TypeScript linear algebra over the selected field:

- sparse-to-row-reduction conversion is acceptable for v1;
- expose kernel bases, image bases, quotient representatives, and coordinate maps;
- retain `p || b` metadata so results remain readable.

To compute `HH^d`, the backend must compute enough Hochschild cochain terms and coboundaries to form the degreewise kernel/image quotient. To get the array of `HH^0` through `HH^N`, it is acceptable and expected that the lazy backend computes cochain data through the needed degrees.

### 6. Compute Cup Product

Use formula `(5.3)` from the paper, translated to left-to-right paths.

Requirements:

- multiply cochain representatives;
- verify products of cocycles are cocycles in tests;
- reduce product cochains modulo boundaries into the chosen Hochschild basis;
- return multiplication tables for all `HH^i x HH^j -> HH^{i+j}` with `i + j <= maxDegree`.

Return product data in both machine-readable and display-ready forms.


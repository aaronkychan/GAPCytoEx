## Backend Algorithms

### 0. Normalize Path Orientation

Before ambiguity, Bardzell, cohomology, or cup-product computation, normalize the path orientation data.

Rules:

- The user may choose the displayed path convention: `L2R` or `R2L`.
- `L2R` is the frontend/Cytoscape traversal convention and the only convention used for GAP/QPA import/export compatibility.
- `R2L` is the paper convention and is the primary backend convention for ambiguity computation.
- Every monomial relation must have both copies in backend state:
  - `pathL2R`: arrow word in Cytoscape traversal order;
  - `pathR2L`: arrow word in paper right-to-left order.
- If the user chooses `R2L`, relation rows, ambiguity rows, and path displays should use `pathR2L`; the quiver itself is not changed.
- `reverseOrientation(path)` must be the only helper that switches a path between `L2R` and `R2L` word order.
- `reverseOrientation` reverses only the stored arrow-word order and toggles the `orientation`; it preserves the mathematical path's `source` and `target` and does not reverse arrow directions.
- `normalizeOrientedInput(input)` validates relation composability using the `L2R` copy, then produces `relationsL2R` and `relationsR2L`.
- Invalid or stale relation orientation data must block computation and report a warning in `InfoPanel`.

### 1. Normalize Input

- Validate unique vertex IDs and arrow IDs.
- Validate every arrow source/target exists.
- Allow the relation list to be empty.
- Validate each listed relation path is composable and has length at least 2.
- Remove duplicate relation paths.
- Replace the relation list by the minimal monomial antichain: discard any relation that properly contains another relation as a divisor.
- Use orientation-normalized relations from `normalizeOrientedInput(input)`.
- Use normalized `relationsR2L` to construct the primary `R2L` left-ambiguity `Gamma[1]`.
- Use normalized `relationsL2R` to construct the development cross-check `L2R` right-ambiguity `Gamma[1]`.

### 2. Enumerate Admissible Paths

The admissible basis `B` consists of all paths that do not contain any minimal relation as a contiguous divisor.

Algorithm:

- Start with length-zero vertex paths and length-one arrow paths.
- Repeatedly extend admissible paths by one composable arrow.
- Reject any extension containing a relation divisor.
- Stop when no admissible extension exists.
- If the user-configurable `maxPathLength` is reached before termination, report that finite-dimensionality was not confirmed.

### 3. Compute Ambiguities

Use the paper's ambiguity definitions with explicit orientation handling.

The primary backend ambiguity computation uses `R2L` path words and follows the paper closely. In that convention the implementation computes **left ambiguities**:

```text
u_{-1} | u_0 | ... | u_n
```

where `u_{-1}` is the length-zero vertex path on the left in paper order.

The backend also implements the equivalent `L2R` **right ambiguity** construction:

```text
u_n | u_{n-1} | ... | u_0 | u_{-1}
```

where `u_{-1}` is the length-zero vertex path on the right in traversal order. This second implementation exists as a development cross-check. During the development phase, pressing `Compute ambiguities` computes both versions, applies `reverseOrientationOfAmbiguity` to compare them, and reports a warning in `InfoPanel` and `OutputPanel` if the two lists differ.

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
- `Gamma[0]`: decompositions `[sourceVertexPath, arrowPathR2L]`.
- `Gamma[1]`: canonical left-ambiguity decompositions of minimal monomial relations in `R2L` convention, not arrow-by-arrow decompositions and not opaque whole-path-only values.
- If `Gamma[1]` is empty, then every `Gamma[n]` for `n >= 1` is empty.

For `n >= 2`, compute the primary `R2L` left-ambiguity `Gamma[n]` inductively from `Gamma[n - 1]`:

- assume the previous left-ambiguity decomposition `u_{-1} | u_0 | ... | u_{n-1}` is already valid by induction;
- do not rescan or revalidate the whole underlying path from the beginning;
- test only new paths `u_n` that right-append to the existing `(n - 1)`-ambiguity;
- for a candidate minimal relation `r`, an overlap means that a nonempty word at the right end of `u_{n-1}` is exactly the same arrow word as a word at the left end of `r`;
- right-append only the part of `r` that comes after this shared word;
- after right-appending, the newly formed word `u_{n-1}u_n` must end with the whole relation `r`;
- split the right-appended part so `u_{n-1}` grows by all but its rightmost arrow, and that rightmost arrow becomes `u_n`;
- do not extend by arbitrary admissible paths;
- deduplicate by the full path word returned by `underlyingPathOfAmbiguity`.

Primary `R2L` left-ambiguity implementation logic:

1. Normalize the input relation paths to the minimal monomial antichain `Rmin`.
2. Initialize:
   - `Gamma[-1] = [{ pieces: [vertexPath] }]`;
   - `Gamma[0] = [{ pieces: [sourceVertexPath, arrowPathR2L] }]`;
   - `Gamma[1] = relationToLeftPiecesR2L(r)` for each `r in RminR2L`.
3. For every requested `n >= 2`, compute `Gamma[n]` from `Gamma[n - 1]`.
4. For each previous ambiguity `amb` with pieces `[u_{-1}, u_0, ..., u_{n-1}]`, treat the previous ambiguity as already valid. Do not check the earlier pieces again.
5. For each candidate extension, look only at `u_{n-1}` together with the proposed right-appended piece `u_n`.
6. For each minimal relation `r`, find every proper overlap length `ell` satisfying:
   - `1 <= ell < length(r)`;
   - `ell <= length(u_{n-1})`;
   - `suffix(u_{n-1}, ell) = prefix(r, ell)`.
7. This means the rightmost `ell` arrows of `u_{n-1}` already match the leftmost `ell` arrows of `r`.
8. For each valid overlap, define `rightAppend = r[ell:]`, the part of `r` after the shared word.
9. The candidate is valid only when `suffix(u_{n-1} + rightAppend, length(r)) = r`, so the two rightmost non-vertex pieces `u_{n-1} | u_n` together contain the new relation occurrence on their right side.
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
  1. call `normalizeOrientedInput(input)`;
  2. compute `primaryLeftR2L`;
  3. compute `checkRightL2R`;
  4. map one side through `reverseOrientationOfAmbiguity`;
  5. compare degree-by-degree after normalizing display-only differences;
  6. emit an `orientation-mismatch` warning if the two lists are not identical.
- A mismatch warning must appear in both `InfoPanel` and the `OutputPanel` ambiguity section. It must not be hidden in the console.
- The mismatch warning should include the lowest degree where the two conventions diverge and enough display text to inspect the differing ambiguity rows.
- Once the two implementations are stable, the cross-check may be kept behind a development flag, but the spec requires it during the development phase.

The POC implementation must keep comments attached to these steps in the ambiguity computation code. If future corrections to the mathematical definition change the acceptance criterion for a candidate overlap, update this numbered logic first and then update the code comments to match.

The implementation must include focused tests for non-quadratic examples where ambiguity pieces are longer than one arrow.

### 4. Build Bardzell Chain Complex

Build the Bardzell resolution as a chain complex, following the paper's indexing convention as closely as possible. The resolution is a virtually infinite object whose individual degrees are finite-dimensional vector spaces over a field.

The `BardzellComplex` object contains:

- `terms.getAt(k)`: the chain term in degree `k`;
- `differentials.getAt(k)`: the chain differential in degree `k`;
- `getArray(start, endInclusive)` helpers on both sequences for UI display, testing, and finite exports.

Indexing convention:

- Use chain-complex convention.
- `terms.getAt(k)` is defined only for non-negative integers `k >= 0`.
- Calling `terms.getAt(k)` with `k < 0` is an error; no Bardzell implementation should need it.
- The `(n + 1)`-st chain term is built from `n`-ambiguities.
- Equivalently, `terms.getAt(n + 1)` uses `Gamma[n]`.
- In particular:
  - `terms.getAt(0)` is the degree-zero algebra term of the resolution;
  - `terms.getAt(1)` uses `Gamma[0]`;
  - `terms.getAt(2)` uses `Gamma[1]`;
  - `terms.getAt(k)` uses `Gamma[k - 1]` for `k >= 1`.
- `differentials.getAt(k)` is the chain map `d_k : terms[k] -> terms[k - 1]`.
- `differentials.getAt(k)` is defined for `k >= 1`.
- Calling `differentials.getAt(k)` with `k < 0` is an error.
- If a caller asks for `differentials.getAt(0)`, the implementation may return the zero map `d_0` without calling `terms.getAt(-1)`, or may reject it as outside the public differential range. It must never request a negative Bardzell term internally.

For a chain degree `k >= 1`, basis elements are pairs:

```ts
interface ChainBasisElement {
  ambiguity: Ambiguity; // p in Gamma[k - 1]
  basisPath: Path;      // b in B
}
```

where `underlyingPathOfAmbiguity(ambiguity)` and `basisPath` have the same source and target.

Represent differentials as sparse matrices:

```ts
interface SparseMatrix {
  rows: number;
  cols: number;
  entries: Array<{ row: number; col: number; value: FieldElement }>;
}
```

Use the paper's Bardzell differential formulas with the chain indexing above and the explicit `R2L`/`L2R` path-orientation rules from the ambiguity stage.

Field support for v1:

- rational numbers, or
- prime finite fields `F_p`.

The spec needs one field implementation chosen before coding.

### 5. Compute Cohomology

Hochschild cohomology is virtual degreewise data, implemented only after the Bardzell chain-complex stage has been human-checked. `computeHochschildCohomology(input)` returns an object whose `groups.getAt(d)` computes `HH^d` only when requested, using the cached Bardzell resolution data needed in that degree.

Compute:

```text
HH^d = Ext^d_{A^e}(A, A)
```

Use TypeScript linear algebra over the selected field:

- sparse-to-row-reduction conversion is acceptable for v1;
- expose kernel bases, image bases, quotient representatives, and coordinate maps;
- retain `p || b` metadata so results remain readable.

To compute `HH^d`, the backend must compute enough of the Bardzell resolution, apply the appropriate Hom construction, and then compute the degreewise kernel/image quotient. To get the array of `HH^0` through `HH^N`, it is acceptable and expected that the lazy backend computes Bardzell chain data through the degrees needed by the Hom complex.

### 6. Compute Cup Product

Use formula `(5.3)` from the paper, translated to left-to-right paths.

Requirements:

- multiply cochain representatives;
- verify products of cocycles are cocycles in tests;
- reduce product cochains modulo boundaries into the chosen Hochschild basis;
- return multiplication tables for all `HH^i x HH^j -> HH^{i+j}` with `i + j <= maxDegree`.

Return product data in both machine-readable and display-ready forms.


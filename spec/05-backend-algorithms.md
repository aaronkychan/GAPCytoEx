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
- Invalid or stale relation orientation data must block computation and report a warning in the compact summary line, with details in the Info/Log textbox when available.

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

where `u_{-1}` is the target vertex path on the right in traversal order. This second implementation exists as a development cross-check. During the development phase, pressing `Compute ambiguities` computes both versions, applies `reverseOrientationOfAmbiguity` to compare them, and reports any mismatch warning in the visible Info/Log textbox.

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

==WARNING: original paper, which uses `R2L` uses "`a` is prefix of `p` if `p=qa`"; in the `R2L` convention, the following doc uses prefix in the literal sense, i.e. `a` is a prefix of `p` if `p=aq`. Likewise for suffix!!==

Primary `R2L` left-ambiguity base data:

- `Gamma[-1]`: one-piece decompositions containing length-zero vertex paths.
- `Gamma[0]`: decompositions `[targetVertexPath, arrowPathR2L]`.
- `Gamma[1]`: decompositions `[targetVertexPath, a, p]` for minimal monomial relations `a p` in `R2L` convention, where `a` is one arrow and `p` is a nonzero path.
- If `Gamma[1]` is empty, then every `Gamma[n]` for `n >= 1` is empty.

For `n >= 2`, compute the primary `R2L` left-ambiguity `Gamma[n]` inductively from `Gamma[n - 1]`:

- assume the previous left-ambiguity decomposition `u_{-1} | u_0 | ... | u_{n-1}` is already valid by induction;
- do not rescan or revalidate the whole underlying path from the beginning;
- test only new paths `u_n` for which the adjacent pair `u_{n-1}u_n` ~~is exactly a minimal relation generator~~ ==Correction: is equal to `pr` where `r` is a relation and `p` a path;==
- ~~for a candidate minimal relation `r`, the previous piece `u_{n-1}` must be a proper prefix of `r`;~~ (this is completely wrong)
- ~~append only the remaining suffix of `r`;~~ (no, `u_n` is either a suffix of a relation path or has a relation path as suffix; where suffix is in the usual literal sense, not the sense of the original paper)
- reject the candidate if any strict ~~suffix~~ ==Correction: prefix (in the literal sense)== of `u_{n-1}u_n` is itself a minimal relation generator;
- ~~split the right-appended part so `u_{n-1}` grows by all but its rightmost arrow, and that rightmost arrow becomes `u_n`;~~ (this is nonsense?)
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
6. Choose `rightAppend` so that the adjacent word `u_{n-1} + rightAppend` is a valid path in the quiver and is of the form `p r`, where `r` is a minimal relation generator and `p` is a path. Equivalently, `u_{n-1} + rightAppend` is a path with a minimal relation generator as its literal suffix.
    - The overlap between `u_{n-1}` and `r` must be nontrivial. Zero-overlap concatenations of two unrelated relation words are not Bardzell ambiguities and must be rejected even when the quiver path composes.
7. Reject the candidate if any strict literal prefix of the path `u_{n-1} + rightAppend` is itself a minimal relation generator.
8. Form the candidate underlying path `pNew = underlyingPathOfAmbiguity(amb) + rightAppend`. This concatenated path is used to construct and deduplicate the candidate, not to revalidate the old ambiguity from the beginning.
9. Form the candidate piece list by appending `rightAppend` as the next piece `u_n`. Do not split `rightAppend`, and do not change the previous piece `u_{n-1}`:

- old pieces: `[u_{-1}, u_0, ..., u_{n-2}, u_{n-1}]`;
- new pieces: `[u_{-1}, u_0, ..., u_{n-2}, u_{n-1}, rightAppend]`.

10. Store these ambiguities with `orientation: "R2L"` and `kind: "left"`.
11. Deduplicate candidates in `Gamma[n]` by the arrow word `pNew`.

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
- A mismatch warning must appear in the visible Info/Log textbox. It must not be hidden in the console. Per the accepted summary-log policy, a successful computation with a mismatch warning does not update the compact summary line; only failed computations update that summary line.
- The mismatch warning should include the lowest degree where the two conventions diverge and enough display text to inspect the differing ambiguity rows.
- Once the two implementations are stable, the cross-check may be kept behind a development flag, but the spec requires it during the development phase.

The POC implementation must keep comments attached to these steps in the ambiguity computation code. If future corrections to the mathematical definition change the acceptance criterion for a candidate overlap, update this numbered logic first and then update the code comments to match.

The implementation must include focused tests for non-quadratic examples where ambiguity pieces are longer than one arrow.

### 4. Build Hochschild Cochain Complex

Build the Hochschild cochain complex used to compute Hochschild cohomology. Do not implement or expose a standalone Bardzell chain complex as the user-facing stage. Bardzell's resolution appears here only through the notation `Bzl_{n+1}(A)` in the term

```text
C^n = Hom_{A^e}(Bzl_{n+1}(A), A) \cong \Bbbk \Gamma_n || \mathcal{B}.
```

Terminology and indexing:

- The object is called the Hochschild **cochain** complex because it computes Hochschild cohomology.
- The implementation enumerates its terms using the natural non-negative chain-complex-style index set `0, 1, 2, ...`.
- Thus `terms.getAt(n)` returns the cochain term `C^n`, not a shifted chain term.
- Internally, the paper's coboundary formula `partial^m : k Gamma_{m-1} || B -> k Gamma_m || B` is used with `m = n + 1` to compute the implementation map `d^n : C^n -> C^{n + 1}`.

The complex is a virtually infinite object whose individual cochain degrees are finite-dimensional vector spaces over the selected field.

The `HochschildCochainComplex` object contains:

- `terms.getAt(n)`: the cochain term `C^n` in degree `n`;
- `coboundaries.getAt(n)`: the cochain coboundary `d^n : C^n -> C^{n + 1}`;
- `getArray(start, endInclusive)` helpers on both sequences for UI display, testing, and finite exports.
- the admissible basis enumeration and ambiguity computation used to build the complex, so UI pipelines can reuse checked intermediate data instead of recomputing it.

Indexing convention:

- Use chain-complex convention.
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
    basisPath: Path; // b in B
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

When computing a bounded range of terms through `C^N`, check all newly available identities `d^{i + 1} d^i = 0`. The first bounded computation checks from `i = 0`; if a later computation raises the bound, start from the first previously unchecked index. If a composite is nonzero, log a visible warning that `d` is not a differential and report the troublesome index.

If the user computes the Hochschild cochain complex before computing ambiguities, the frontend must first compute the admissible basis and ambiguity data, populate the Ambiguities tab with the usual ambiguity rows, then focus the Hochschild tab.

The lower-left relation-list panel may show a Hochschild tab after a successful computation. This tab displays the finite requested slice of terms and compact differential controls. Zero terms display only `C^n (dim=0)`. Nonzero terms display `C^n (dim=d)`. If `d^n` is available in the displayed slice, show a small framed `d^n` button after the term heading, or `d^n = 0` when the whole differential is zero. Clicking the term-heading differential button toggles only that degree's expanded full differential rows; the expansion state is retained across ordinary tab rerenders until the computation is replaced or cleared.

Each basis row `p||b` in `C^n` also shows a small framed `d^n` button, except a zero image displays as `d^n↦0`. Hovering this button, or clicking/tapping it on touch devices, shows only the right-hand side of the image of `p||b`. The tooltip displays one monomial summand per line, with signs at the start of each non-first signed line, for example:

```text
  q1||c1
+q2||c2
-q3||c3
```

Selecting a Hochschild basis row `p||b` highlights the ambiguity path `p` and basis path `b` in two contrasting colors on the canvas and writes a concise color legend to the visible Info/Log textbox.

Field support for v1:

- rational numbers.

When this computation is triggered from the UI, append a visible computation log line saying `Computing in rationals.`.

Prime finite fields `F_p` are deferred until the cohomology linear-algebra stage needs field-parametric row reduction.

### 5. Compute Cohomology

Hochschild cohomology is virtual degreewise data. `buildHochschildCohomology(input)` returns an object whose `groups.getAt(d)` computes `HH^d` only when requested, using the cached cochain data needed in that degree.

Compute:

```text
HH^d = Ext^d_{A^e}(A, A)
```

Important indexing distinction:

- The lower-left Hochschild tab intentionally displays the non-negative sequence `C^n = k Gamma[n] || B`.
- Hochschild cohomology itself uses the usual degree-zero vertex term `k Gamma[-1] || B`.
- Therefore `HH^0` is computed from `k Gamma[-1] || B -> k Gamma[0] || B`.
- For `d > 0`, `HH^d` is computed from displayed cochain term `C^{d - 1}`:

```text
HH^d = ker(C^{d - 1} -> C^d) / im(C^{d - 2} -> C^{d - 1})  for d > 1,
HH^1 = ker(C^0 -> C^1) / im(k Gamma[-1] || B -> C^0).
```

The missing degree-zero differential is the standard commutator map on vertex cochains. For a vertex cochain supported at vertex `v` by an admissible cycle `b`, and an arrow `a`, it contributes `a b` when `t(a) = v` and `- b a` when `s(a) = v`, discarding products that vanish in the monomial algebra.

Use TypeScript linear algebra over rational coefficients:

- sparse-to-row-reduction conversion is acceptable for v1;
- expose kernel bases, image bases, quotient representatives, and coordinate maps;
- retain `p || b` metadata so results remain readable.

To compute `HH^d`, the backend must compute enough Hochschild cochain terms and coboundaries to form the degreewise kernel/image quotient. To get the array of `HH^0` through `HH^N`, it is acceptable and expected that the lazy backend computes cochain data through the needed degrees.

The frontend `Hochschild cohomology` button must reuse the cached monomial context and Hochschild cochain complex when available. The Hochschild tab is enhanced with cohomology data rather than replaced by a disconnected table:

- a top vertex-term block displays `HH^0`;
- each displayed `C^n` block is ordered as: `C^n (dim=d)` plus compact `d^n` button, basis rows with compact `d^n` image buttons, `HH^{n + 1}: dim=...`, `(dim ker=..., dim im=...)`, then representative rows;
- cohomology summaries use the accent color, while `C^n` and `d^n` headings use the muted term-heading color;
- representative rows are grouped under the heading `Cohom. representative`;
- representative rows display only the representative expression, not a prefixed `[HH^d.k]` label;
- selecting a representative row highlights all involved displayed basis rows when they lie in the displayed cochain complex, and highlights all involved `p` and `b` paths on the canvas using the existing Hochschild basis colors.

### 6. Compute Cup Product

Use formula `(5.3)` from the paper, translated to left-to-right paths.

Requirements:

- multiply cochain representatives;
- verify products of cocycles are cocycles in tests;
- reduce product cochains modulo boundaries into the chosen Hochschild basis;
- return multiplication tables for all `HH^i x HH^j -> HH^{i+j}` with `i + j <= maxDegree`.

Return product data in both machine-readable and display-ready forms.

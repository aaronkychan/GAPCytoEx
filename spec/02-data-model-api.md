## Backend Data Model

Core types:

```ts
type VertexId = string;
type ArrowId = string;
type PathOrientation = "L2R" | "R2L";

interface Vertex {
  id: VertexId;
  label?: string;
}

interface Arrow {
  id: ArrowId;
  source: VertexId;
  target: VertexId;
  label: string;
}

interface Quiver {
  vertices: Vertex[];
  arrows: Arrow[];
}

interface Path {
  arrows: ArrowId[];
  source: VertexId;
  target: VertexId;
  orientation: PathOrientation;
}

interface RelationGenerator {
  id: string;
  path: Path; // canonical L2R traversal path
}

interface MonomialAlgebraInput {
  quiver: Quiver;
  relations: RelationGenerator[];
  activeOrientation: PathOrientation;
  maxPathLength: number;
}

interface Monomial {
  scalar?: string;
  monomial: ArrowId[];
}

interface RelationData {
  id?: string;
  reln?: string;
  fieldChar?: number;
  terms?: Monomial[];
}

interface VerifiedMonomialAlgebra {
  quiver: Quiver;
  originalRelations: RelationGenerator[];
  minimisedRelations: RelationGenerator[];
  activeOrientation: PathOrientation;
  maxPathLength: number;
  logs: MonomialAlgebraLogEntry[];
}
```

Path rules:

- `L2R` path words are ordered left-to-right in traversal order.
- `R2L` path words are ordered right-to-left in the paper's written convention. They store the same mathematical path with the arrow word reversed, but source and target still refer to the actual source and target of the mathematical path.
- A length-zero path is represented explicitly by `arrows: []`, with `source = target = vertexId`.
- The relation list may be empty.
- Every listed relation path must have length at least 2.
- Every listed relation path must be composable in the quiver when read as its `L2R` traversal copy.
- Monomial relations are single paths only; linear combinations are out of scope for this TypeScript backend.
- The backend stores one canonical relation path in `L2R` traversal order.
- The UI may display either convention. Changing the convention changes path display and relation-row text, not the underlying quiver.
- GAP/QPA compatibility remains `L2R` only. Any GAP/QPA export or comparison path must use the stored canonical relation path.

Orientation helper:

```ts
function reverseOrientation(path: Path): Path;

function reverseOrientationOfAmbiguity(ambiguity: Ambiguity): Ambiguity;

function tidyUpMonomialAlgebra(input: MonomialAlgebraInput): VerifiedMonomialAlgebra;
```

`reverseOrientation` switches between `L2R` and `R2L` path-word conventions by reversing `path.arrows` and toggling `path.orientation`. It must preserve the mathematical path's `source` and `target`; it does not reverse quiver arrows. `tidyUpMonomialAlgebra` validates relation composability on the stored `L2R` traversal path, keeps `originalRelations`, and stores `minimisedRelations` before any ambiguity, Bardzell, cohomology, or cup-product computation runs. Callers derive `R2L` words with `reverseOrientation` when they need paper-order display or computation.

`reverseOrientationOfAmbiguity` switches between the equivalent `R2L` left-ambiguity and `L2R` right-ambiguity forms. It must reverse the order of the ambiguity pieces and apply `reverseOrientation` to each nontrivial piece, while preserving the mathematical underlying path.

Computation bounds:

- `maxPathLength` is the safety bound used while enumerating admissible paths.
- Default `maxPathLength` is `50`.
- The minimum allowed user value is `20`; UI input and backend validation must reject smaller values.

Ambiguity representation:

```ts
type AmbiguityKind = "left" | "right";

interface Ambiguity {
  n: number;
  pieces: Path[];
  orientation: PathOrientation;
  kind: AmbiguityKind;
}

function underlyingPathOfAmbiguity(ambiguity: Ambiguity): Path;
```

The backend supports two equivalent ambiguity conventions during development:

1. Primary computation: **left ambiguities in `R2L` convention**, following the paper closely.

```text
u_{-1} | u_0 | ... | u_n
```

Here `u_{-1}` is the target vertex path on the left in paper order.

2. Cross-check computation: **right ambiguities in `L2R` convention**, matching frontend traversal order.

```text
u_n | u_{n-1} | ... | u_0 | u_{-1}
```

Here `u_{-1}` is the target vertex path on the right.

The helper `underlyingPathOfAmbiguity` concatenates the pieces in their stored word convention and returns a `Path` with the same `orientation` and mathematical `source`/`target` as the ambiguity.

Conventions:

- `Gamma[-1]` entries have `pieces = [vertexPath]`, where `vertexPath` has length zero.
- For `R2L` left ambiguities, `Gamma[0]` entries have `pieces = [targetVertexPath, arrowPathR2L]`, and `Gamma[1]` relation `r = a p` in `R2L` word order is stored as `[targetVertexPath, a, p]`, where `a` is one arrow and `p` is a nonzero path.
- For `L2R` right ambiguities, `Gamma[0]` entries have `pieces = [arrowPathL2R, targetVertexPath]`, and `Gamma[1]` relation `r = p a` in `L2R` word order is stored as `[p, a, targetVertexPath]`, where `a` is one arrow and `p` is a nonzero path.
- If the minimal relation set is empty, then `Gamma[1]` is empty and `Gamma[n]` is empty for every `n >= 1`.
- For `n >= 2`, `pieces` is the inductively constructed ambiguity decomposition in its declared `orientation` and `kind`.
- Deduplication is by `underlyingPathOfAmbiguity(ambiguity)`, but UI display and differential logic must retain `pieces`.

## Backend API

Provide one public function for each computational goal:

```ts
interface LazySequence<T> {
  getAt(index: number): T;
  getIteratorFrom(start: number): IterableIterator<[number, T]>;
  getArray(start: number, endInclusive: number): Array<[number, T]>;
}

interface AmbiguitySequence extends LazySequence<Ambiguity[]> {
  getAt(index: -1): Ambiguity[];
}

interface AmbiguityComparisonWarning {
  kind: "orientation-mismatch";
  degree: number;
  message: string;
  leftR2L: Ambiguity[];
  rightL2R: Ambiguity[];
}

interface AmbiguityComputation {
  primaryLeftR2L: AmbiguitySequence;
  checkRightL2R: AmbiguitySequence;
  warnings: AmbiguityComparisonWarning[];
}

interface BardzellComplex {
  terms: LazySequence<ChainSpace>;
  differentials: LazySequence<SparseMatrix>;
}

interface HochschildCohomology {
  groups: LazySequence<CohomologyGroup>;
}

function computeLeftAmbiguitiesR2L(input: VerifiedMonomialAlgebra): AmbiguitySequence;

function computeRightAmbiguitiesL2R(input: VerifiedMonomialAlgebra): AmbiguitySequence;

function computeAmbiguities(input: MonomialAlgebraInput): AmbiguityComputation;

function buildBardzellComplex(input: MonomialAlgebraInput): BardzellComplex;

function computeHochschildCohomology(input: MonomialAlgebraInput): HochschildCohomology;

function computeCupProduct(input: MonomialAlgebraInput, maxDegree: number): CupProductResult;
```

Also provide a convenience pipeline:

```ts
function analyzeMonomialAlgebra(input: MonomialAlgebraInput, maxDegree: number): MonomialHHResult;
```

The core objects are virtually infinite: they compute degree `n` only when `getAt(n)` or `getArray(...)` asks for it, cache the result, and reuse cached lower degrees for inductive computations. The bounded `maxDegree` arguments on convenience functions and UI actions only control how much of these lazy objects is converted into arrays for display, export, or finite cup-product tables.

Prefer memoized lazy indexed sequences over plain one-shot generators for the core API. A JavaScript `Generator` or `IterableIterator` may be exposed for streaming via `getIteratorFrom(start)`, but repeated degreewise access must go through cached `getAt(index)`.

The pipeline should reuse intermediate lazy sequences instead of recomputing ambiguities, admissible basis paths, Bardzell term bases, differentials, and homology groups independently.


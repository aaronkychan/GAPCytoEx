## Frontend State Architecture

Keep frontend state split by responsibility:

```ts
interface FrontendState {
  graph: GraphUiState;
  relations: RelationUiState;
  monomialComputation: MonomialComputationState;
  computations: ComputationUiState;
  selection: SelectionState;
  orientation: OrientationState;
  theme: ThemeState;
}
```

State roles:

- `GraphUiState`: Cytoscape element data, selected graph edit mode, and canvas display preferences.
- `RelationUiState`: relation builder state, saved relation paths, selected relation index, and relation validation messages.
- `MonomialComputationState`: last valid `MonomialAlgebraInput`, aligned backend algebra, valid/stale status, and monomial-validation summary.
- `ComputationUiState`: lazy backend objects plus finite rendered slices requested by the UI.
- `SelectionState`: selected vertex, arrow, relation, ambiguity, cohomology class, or output item.
- `OrientationState`: active path display convention, either `L2R` or `R2L`.
- `ThemeState`: current light/dark theme and reduced-motion preference.

Use a single computation controller as the boundary between UI events and backend math:

```ts
interface ComputationController {
  validateMonomialComputationInput(): MonomialComputationState;
  computeAmbiguities(maxN: number): ComputationOutputItem[];
  computeHochschildComplexTerms(startDegree: number, endDegree: number): ComputationOutputItem[];
  computeCohomology(startDegree: number, endDegree: number): ComputationOutputItem[];
  computeCupProducts(maxDegree: number): ComputationOutputItem[];
}

interface ComputationOutputItem {
  id: string;
  kind: "ambiguities" | "bardzell-term" | "differential" | "cohomology" | "cup-product" | "warning" | "error";
  degree?: number;
  title: string;
  summary: string;
  rows: ComputationOutputRow[];
  raw: unknown;
}

interface ComputationOutputRow {
  id: string;
  label: string;
  display: string;
  degree?: number;
  selectable: boolean;
  raw: unknown;
}
```

The controller writes computation summaries only to `OutputPanel`. It may update `InfoPanel` with status and selected-item details, but it must not append large result tables to the info box, relation list, canvas, or old debug text areas.

Debuggability rules:

- DOM event handlers should be thin: read UI values, call a named controller method, then render returned state.
- Backend computation functions must not read from or write to DOM nodes.
- Cytoscape code must not parse relation display text; it receives structured arrow-ID paths.
- Relation builder state must be explicit, not inferred from editable DOM contents.
- Computation output should keep both `display` text and `raw` structured data so UI bugs can be distinguished from math bugs.
- Every module should expose small functions that can be unit tested without launching the whole page.


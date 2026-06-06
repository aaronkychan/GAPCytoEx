export interface SparseMatrix {
  rows: number;
  cols: number;
  entries: Array<{ row: number; col: number; value: number }>;
}

export interface ChainSpace {
  degree: number;
  dimension: number;
}

export interface BardzellComplex {
  terms: unknown;
  differentials: unknown;
}

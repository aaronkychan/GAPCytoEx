import { underlyingPathOfAmbiguity, type Ambiguity, type LazySequence } from "./ambiguities";
import {
  buildHochschildCochainComplex,
  buildHochschildCochainComplexFromContext,
  type CochainBasisElement,
  type CochainSpace,
  type HochschildCochainComplex,
  type HochschildCochainComplexContext,
  type RationalFieldElement,
  type SparseMatrix
} from "./chainCpx";
import type { MonomialAlgebraInput } from "./monomial-algebra";
import type { Path } from "./paths";
import { vertexPath } from "./paths";
import { arrowById, printArrowWord, type ArrowId, type Quiver } from "./quiver";

const EPSILON = 1e-10;

export interface CohomologyClassRepresentative {
  vector: RationalFieldElement[];
  terms: Array<{
    coefficient: RationalFieldElement;
    basisElement: CochainBasisElement;
  }>;
}

export interface HochschildCohomologyGroup {
  degree: number;
  term: CochainSpace;
  kernelBasis: RationalFieldElement[][];
  imageBasis: RationalFieldElement[][];
  representatives: CohomologyClassRepresentative[];
  dimension: number;
  kernelDimension: number;
  imageDimension: number;
}

export interface HochschildCohomology {
  groups: LazySequence<HochschildCohomologyGroup>;
  complex: HochschildCochainComplex;
  field: "Q";
  logs: string[];
}

interface RrefResult {
  matrix: RationalFieldElement[][];
  pivots: number[];
  rank: number;
}

function assertNonNegativeCohomologyDegree(index: number): void {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(
      "Hochschild cohomology degrees must be non-negative integers.",
    );
  }
}

function makeLazySequence<T>(
  assertIndex: (index: number) => void,
  compute: (index: number) => T,
): LazySequence<T> {
  const cache = new Map<number, T>();
  let sequence: LazySequence<T>;
  sequence = {
    getAt(index: number): T {
      assertIndex(index);
      if (!cache.has(index)) {
        cache.set(index, compute(index));
      }
      return cache.get(index) as T;
    },
    *getIteratorFrom(start: number): IterableIterator<[number, T]> {
      assertIndex(start);
      let index = start;
      while (true) {
        yield [index, sequence.getAt(index)];
        index += 1;
      }
    },
    getArray(start: number, endInclusive: number): Array<[number, T]> {
      assertIndex(start);
      if (endInclusive < start) {
        return [];
      }
      const result: Array<[number, T]> = [];
      for (let index = start; index <= endInclusive; index += 1) {
        result.push([index, sequence.getAt(index)]);
      }
      return result;
    },
  };
  return sequence;
}

function normalizeNumber(value: number): number {
  return Math.abs(value) < EPSILON ? 0 : value;
}

function sparseToDense(matrix: SparseMatrix): RationalFieldElement[][] {
  const dense = Array.from({ length: matrix.rows }, () =>
    Array.from({ length: matrix.cols }, () => 0),
  );
  for (const entry of matrix.entries) {
    dense[entry.row][entry.col] += entry.value;
  }
  return dense.map((row) => row.map(normalizeNumber));
}

function pathKey(path: Path): string {
  return `${path.source}:${path.target}:${printArrowWord(path.arrows)}`;
}

function termBasisKey(element: CochainBasisElement): string {
  return `${pathKey(underlyingPathOfAmbiguity(element.ambiguity))}||${pathKey(element.basisPath)}`;
}

function pathFromL2RWord(
  quiver: Quiver,
  arrows: ArrowId[],
  emptyVertexId: string,
): Path | null {
  if (arrows.length === 0) {
    return vertexPath(emptyVertexId, "L2R");
  }
  const first = arrowById(quiver, arrows[0]);
  if (!first) {
    return null;
  }
  let previous = first;
  for (const arrowId of arrows.slice(1)) {
    const next = arrowById(quiver, arrowId);
    if (!next || previous.target !== next.source) {
      return null;
    }
    previous = next;
  }
  return {
    arrows: [...arrows],
    source: first.source,
    target: previous.target,
    orientation: "L2R",
  };
}

function buildVertexCochainTerm(complex: HochschildCochainComplex): CochainSpace {
  const admissiblePaths = complex.admissiblePathEnumeration.paths;
  const basis: CochainBasisElement[] = [];
  for (const vertex of complex.admissiblePathEnumeration.relationGenerators.quiver.vertices) {
    const ambiguity: Ambiguity = {
      n: -1,
      pieces: [vertexPath(vertex.id, "R2L")],
      orientation: "R2L",
      kind: "left",
    };
    for (const basisPath of admissiblePaths) {
      if (basisPath.source === vertex.id && basisPath.target === vertex.id) {
        basis.push({ ambiguity, basisPath });
      }
    }
  }
  return {
    degree: 0,
    basis,
    dimension: basis.length,
  };
}

function addSparseEntry(
  values: Map<string, number>,
  row: number,
  col: number,
  value: number,
): void {
  const key = `${row}:${col}`;
  values.set(key, (values.get(key) ?? 0) + value);
}

function buildDegreeZeroDifferential(
  complex: HochschildCochainComplex,
  source: CochainSpace,
): SparseMatrix {
  const quiver = complex.admissiblePathEnumeration.relationGenerators.quiver;
  const admissibleBasisByKey = new Map(
    complex.admissiblePathEnumeration.paths.map((path) => [pathKey(path), path]),
  );
  const target = complex.terms.getAt(0);
  const targetBasisByKey = new Map(
    target.basis.map((element, index) => [termBasisKey(element), index]),
  );
  const values = new Map<string, number>();

  source.basis.forEach((sourceElement, col) => {
    const vertexId = underlyingPathOfAmbiguity(sourceElement.ambiguity).target;
    const cycleWord = sourceElement.basisPath.arrows;
    for (const arrow of quiver.arrows) {
      const targetAmbiguity = target.basis.find(
        (element) => underlyingPathOfAmbiguity(element.ambiguity).arrows[0] === arrow.id,
      )?.ambiguity;
      if (!targetAmbiguity) {
        continue;
      }
      if (arrow.target === vertexId) {
        const product = pathFromL2RWord(quiver, [arrow.id, ...cycleWord], arrow.source);
        const basisPath = product ? admissibleBasisByKey.get(pathKey(product)) : null;
        if (basisPath) {
          const row = targetBasisByKey.get(
            `${pathKey(underlyingPathOfAmbiguity(targetAmbiguity))}||${pathKey(basisPath)}`,
          );
          if (row !== undefined) {
            addSparseEntry(values, row, col, 1);
          }
        }
      }
      if (arrow.source === vertexId) {
        const product = pathFromL2RWord(quiver, [...cycleWord, arrow.id], arrow.target);
        const basisPath = product ? admissibleBasisByKey.get(pathKey(product)) : null;
        if (basisPath) {
          const row = targetBasisByKey.get(
            `${pathKey(underlyingPathOfAmbiguity(targetAmbiguity))}||${pathKey(basisPath)}`,
          );
          if (row !== undefined) {
            addSparseEntry(values, row, col, -1);
          }
        }
      }
    }
  });

  return {
    rows: target.dimension,
    cols: source.dimension,
    entries: [...values.entries()]
      .map(([key, value]) => {
        const [row, col] = key.split(":").map(Number);
        return { row, col, value: normalizeNumber(value) };
      })
      .filter((entry) => entry.value !== 0)
      .sort((left, right) =>
        left.row === right.row ? left.col - right.col : left.row - right.row,
      ),
  };
}

function rref(
  rows: RationalFieldElement[][],
  columnCount = rows[0]?.length ?? 0,
): RrefResult {
  const matrix = rows.map((row) => {
    const copy = row.slice(0, columnCount);
    while (copy.length < columnCount) {
      copy.push(0);
    }
    return copy;
  });
  const pivots: number[] = [];
  let pivotRow = 0;

  for (let col = 0; col < columnCount && pivotRow < matrix.length; col += 1) {
    let bestRow = pivotRow;
    for (let row = pivotRow + 1; row < matrix.length; row += 1) {
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[bestRow][col])) {
        bestRow = row;
      }
    }
    if (Math.abs(matrix[bestRow][col]) < EPSILON) {
      continue;
    }

    [matrix[pivotRow], matrix[bestRow]] = [matrix[bestRow], matrix[pivotRow]];
    const pivot = matrix[pivotRow][col];
    for (let index = col; index < columnCount; index += 1) {
      matrix[pivotRow][index] = normalizeNumber(matrix[pivotRow][index] / pivot);
    }

    for (let row = 0; row < matrix.length; row += 1) {
      if (row === pivotRow) {
        continue;
      }
      const factor = matrix[row][col];
      if (Math.abs(factor) < EPSILON) {
        continue;
      }
      for (let index = col; index < columnCount; index += 1) {
        matrix[row][index] = normalizeNumber(
          matrix[row][index] - factor * matrix[pivotRow][index],
        );
      }
    }

    pivots.push(col);
    pivotRow += 1;
  }

  return {
    matrix,
    pivots,
    rank: pivots.length,
  };
}

function kernelBasis(matrix: SparseMatrix): RationalFieldElement[][] {
  const reduced = rref(sparseToDense(matrix), matrix.cols);
  const pivotSet = new Set(reduced.pivots);
  const basis: RationalFieldElement[][] = [];

  for (let freeCol = 0; freeCol < matrix.cols; freeCol += 1) {
    if (pivotSet.has(freeCol)) {
      continue;
    }
    const vector = Array.from({ length: matrix.cols }, () => 0);
    vector[freeCol] = 1;
    reduced.pivots.forEach((pivotCol, pivotRow) => {
      vector[pivotCol] = normalizeNumber(-reduced.matrix[pivotRow][freeCol]);
    });
    basis.push(vector);
  }

  return basis;
}

function columnVectors(matrix: SparseMatrix): RationalFieldElement[][] {
  const columns = Array.from({ length: matrix.cols }, () =>
    Array.from({ length: matrix.rows }, () => 0),
  );
  for (const entry of matrix.entries) {
    columns[entry.col][entry.row] += entry.value;
  }
  return columns.map((column) => column.map(normalizeNumber));
}

function vectorSpanRank(vectors: RationalFieldElement[][], ambientDimension: number): number {
  if (vectors.length === 0) {
    return 0;
  }
  return rref(vectors, ambientDimension).rank;
}

function independentVectors(
  vectors: RationalFieldElement[][],
  ambientDimension: number,
): RationalFieldElement[][] {
  const independent: RationalFieldElement[][] = [];
  let rank = 0;
  for (const vector of vectors) {
    const nextRank = vectorSpanRank([...independent, vector], ambientDimension);
    if (nextRank > rank) {
      independent.push(vector);
      rank = nextRank;
    }
  }
  return independent;
}

function representativeTerms(
  vector: RationalFieldElement[],
  term: CochainSpace,
): CohomologyClassRepresentative["terms"] {
  return vector
    .map((coefficient, index) => ({
      coefficient: normalizeNumber(coefficient),
      basisElement: term.basis[index],
    }))
    .filter((entry) => entry.coefficient !== 0);
}

function computeGroup(
  complex: HochschildCochainComplex,
  degree: number,
  vertexTerm: CochainSpace,
  degreeZeroDifferential: SparseMatrix,
): HochschildCohomologyGroup {
  const term = degree === 0 ? vertexTerm : complex.terms.getAt(degree - 1);
  const outgoing = degree === 0
    ? degreeZeroDifferential
    : complex.coboundaries.getAt(degree - 1);
  const incoming = degree === 0
    ? { rows: term.dimension, cols: 0, entries: [] }
    : degree === 1
      ? degreeZeroDifferential
      : complex.coboundaries.getAt(degree - 2);
  const kernel = kernelBasis(outgoing);
  const image = independentVectors(columnVectors(incoming), term.dimension);
  const span = [...image];
  let spanRank = vectorSpanRank(span, term.dimension);
  const representatives: CohomologyClassRepresentative[] = [];

  // Coordinates use the relevant cochain basis.  The displayed complex starts
  // at Gamma[0] as C^0, but Hochschild cohomology has the usual vertex term in
  // degree zero: k Gamma[-1] || B -> k Gamma[0] || B -> ...
  // Thus HH^0 uses the vertex term, while HH^n for n > 0 uses displayed C^{n-1}.
  for (const vector of kernel) {
    const nextRank = vectorSpanRank([...span, vector], term.dimension);
    if (nextRank > spanRank) {
      span.push(vector);
      spanRank = nextRank;
      representatives.push({
        vector,
        terms: representativeTerms(vector, term),
      });
    }
  }

  return {
    degree,
    term,
    kernelBasis: kernel,
    imageBasis: image,
    representatives,
    dimension: representatives.length,
    kernelDimension: kernel.length,
    imageDimension: image.length,
  };
}

export function buildHochschildCohomologyFromComplex(
  complex: HochschildCochainComplex,
): HochschildCohomology {
  const vertexTerm = buildVertexCochainTerm(complex);
  const degreeZeroDifferential = buildDegreeZeroDifferential(complex, vertexTerm);
  return {
    groups: makeLazySequence(assertNonNegativeCohomologyDegree, (degree) =>
      computeGroup(complex, degree, vertexTerm, degreeZeroDifferential),
    ),
    complex,
    field: "Q",
    logs: ["Computing Hochschild cohomology over Q."],
  };
}

export function buildHochschildCohomologyFromContext(
  context: HochschildCochainComplexContext,
): HochschildCohomology {
  return buildHochschildCohomologyFromComplex(
    buildHochschildCochainComplexFromContext(context),
  );
}

export function buildHochschildCohomology(
  input: MonomialAlgebraInput,
): HochschildCohomology {
  return buildHochschildCohomologyFromComplex(
    buildHochschildCochainComplex(input),
  );
}

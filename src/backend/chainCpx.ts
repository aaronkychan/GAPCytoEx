import {
    computeAmbiguitiesFromVerified,
    underlyingPathOfAmbiguity,
    type Ambiguity,
    type AmbiguityComputation,
    type LazySequence,
} from "./ambiguities";
import {
    enumerateAdmissiblePaths,
    enumerateAdmissiblePathsFromVerified,
    type AdmissiblePathEnumeration,
    type MonomialAlgebraInput,
    type VerifiedMonomialAlgebra,
} from "./monomial-algebra";
import type { Path } from "./paths";
import { vertexPath } from "./paths";
import { arrowById, printArrowWord, type ArrowId, type Quiver } from "./quiver";

export type RationalFieldElement = number;

export interface SparseMatrix {
    rows: number;
    cols: number;
    entries: Array<{ row: number; col: number; value: RationalFieldElement }>;
}

export interface CochainBasisElement {
    ambiguity: Ambiguity;
    basisPath: Path;
}

export interface CochainSpace {
    degree: number;
    basis: CochainBasisElement[];
    dimension: number;
}

export interface HochschildCochainComplex {
    terms: LazySequence<CochainSpace>;
    coboundaries: LazySequence<SparseMatrix>;
    field: "Q";
    logs: string[];
    admissiblePathEnumeration: AdmissiblePathEnumeration;
    ambiguityComputation: AmbiguityComputation;
}

export interface HochschildCochainComplexContext {
    verified: VerifiedMonomialAlgebra;
    admissiblePathEnumeration: AdmissiblePathEnumeration;
    ambiguityComputation: AmbiguityComputation;
}

export interface DifferentialCheckFailure {
    degree: number;
    entries: Array<{ row: number; col: number; value: RationalFieldElement }>;
}

export interface DifferentialCheckResult {
    ok: boolean;
    checkedThroughDegree: number;
    failure?: DifferentialCheckFailure;
}

export interface ChainSpace {
    degree: number;
    dimension: number;
}

export interface BardzellComplex {
    terms: unknown;
    differentials: unknown;
}

export function assertNonNegativeChainDegree(k: number): void {
    if (!Number.isInteger(k) || k < 0) {
        throw new RangeError("Bardzell chain degrees must be non-negative integers.");
    }
}

function assertNonNegativeCochainDegree(k: number): void {
    if (!Number.isInteger(k) || k < 0) {
        throw new RangeError(
            "Hochschild cochain degrees must be non-negative integers.",
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

function pathKey(path: Path): string {
    return `${path.source}:${path.target}:${printArrowWord(path.arrows)}`;
}

function wordsEqual(left: ArrowId[], right: ArrowId[]): boolean {
    return (
        left.length === right.length &&
        left.every((arrow, index) => arrow === right[index])
    );
}

function r2lWord(path: Path): ArrowId[] {
    return path.orientation === "R2L"
        ? [...path.arrows]
        : [...path.arrows].reverse();
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

function occurrencesOfWord(word: ArrowId[], subword: ArrowId[]): number[] {
    if (subword.length === 0 || subword.length > word.length) {
        return [];
    }
    const starts: number[] = [];
    for (let start = 0; start <= word.length - subword.length; start += 1) {
        if (wordsEqual(word.slice(start, start + subword.length), subword)) {
            starts.push(start);
        }
    }
    return starts;
}

function termBasisKey(element: CochainBasisElement): string {
    return `${pathKey(underlyingPathOfAmbiguity(element.ambiguity))}||${pathKey(element.basisPath)}`;
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

function multiplyR2LWordsInA(
    quiver: Quiver,
    admissibleBasisByKey: Map<string, Path>,
    targetAmbiguity: Ambiguity,
    factors: ArrowId[][],
): Path | null {
    const productR2L = factors.flat();
    const targetPath = underlyingPathOfAmbiguity(targetAmbiguity);
    const productL2R = [...productR2L].reverse();
    const emptyVertexId = targetPath.source === targetPath.target
        ? targetPath.source
        : "";
    if (productL2R.length === 0 && emptyVertexId === "") {
        return null;
    }
    const productPath = pathFromL2RWord(quiver, productL2R, emptyVertexId);
    if (!productPath) {
        return null;
    }
    if (
        productPath.source !== targetPath.source ||
        productPath.target !== targetPath.target
    ) {
        return null;
    }
    return admissibleBasisByKey.get(pathKey(productPath)) ?? null;
}

function buildTerm(
    degree: number,
    ambiguities: Ambiguity[],
    admissibleBasis: Path[],
): CochainSpace {
    const basis: CochainBasisElement[] = [];
    for (const ambiguity of ambiguities) {
        const ambiguityPath = underlyingPathOfAmbiguity(ambiguity);
        for (const basisPath of admissibleBasis) {
            if (
                basisPath.source === ambiguityPath.source &&
                basisPath.target === ambiguityPath.target
            ) {
                basis.push({ ambiguity, basisPath });
            }
        }
    }
    return {
        degree,
        basis,
        dimension: basis.length,
    };
}

function coboundaryImageEntries(
    quiver: Quiver,
    admissibleBasisByKey: Map<string, Path>,
    targetBasisByKey: Map<string, number>,
    cochainIndex: number,
    source: CochainBasisElement,
    targetAmbiguity: Ambiguity,
): Array<{ row: number; value: number }> {
    const sourceWord = r2lWord(underlyingPathOfAmbiguity(source.ambiguity));
    const targetWord = r2lWord(underlyingPathOfAmbiguity(targetAmbiguity));
    const basisWord = r2lWord(source.basisPath);
    const paperIndex = cochainIndex + 1;
    const entries: Array<{ row: number; value: number }> = [];

    // The public object is cochain-indexed: d^n : C^n -> C^{n+1}.
    // The paper writes partial^m : k Gamma_{m-1}||B -> k Gamma_m||B,
    // so this implementation evaluates formulas (5.1)/(5.2) with m = n + 1.
    // Ambiguities are searched in their paper-order R2L words, while basis paths
    // stay canonical L2R; each product is converted back to L2R before lookup in B.
    if (paperIndex % 2 === 0) {
        for (const start of occurrencesOfWord(targetWord, sourceWord)) {
            const left = targetWord.slice(0, start);
            const right = targetWord.slice(start + sourceWord.length);
            if (right.length === 0) {
                const product = multiplyR2LWordsInA(
                    quiver,
                    admissibleBasisByKey,
                    targetAmbiguity,
                    [left, basisWord],
                );
                if (product) {
                    const row = targetBasisByKey.get(
                        `${pathKey(underlyingPathOfAmbiguity(targetAmbiguity))}||${pathKey(product)}`,
                    );
                    if (row !== undefined) {
                        entries.push({ row, value: 1 });
                    }
                }
            }
            if (left.length === 0) {
                const product = multiplyR2LWordsInA(
                    quiver,
                    admissibleBasisByKey,
                    targetAmbiguity,
                    [basisWord, right],
                );
                if (product) {
                    const row = targetBasisByKey.get(
                        `${pathKey(underlyingPathOfAmbiguity(targetAmbiguity))}||${pathKey(product)}`,
                    );
                    if (row !== undefined) {
                        entries.push({ row, value: -1 });
                    }
                }
            }
        }
        return entries;
    }

    const seenRightRemainders = new Set<string>();
    for (const start of occurrencesOfWord(targetWord, sourceWord)) {
        const left = targetWord.slice(0, start);
        const right = targetWord.slice(start + sourceWord.length);
        const rightKey = printArrowWord(right);
        if (seenRightRemainders.has(rightKey)) {
            continue;
        }
        seenRightRemainders.add(rightKey);
        const product = multiplyR2LWordsInA(
            quiver,
            admissibleBasisByKey,
            targetAmbiguity,
            [left, basisWord, right],
        );
        if (!product) {
            continue;
        }
        const row = targetBasisByKey.get(
            `${pathKey(underlyingPathOfAmbiguity(targetAmbiguity))}||${pathKey(product)}`,
        );
        if (row !== undefined) {
            entries.push({ row, value: 1 });
        }
    }
    return entries;
}

export function buildHochschildCochainComplex(
    input: MonomialAlgebraInput,
): HochschildCochainComplex {
    const admissible = enumerateAdmissiblePaths(input);
    return buildHochschildCochainComplexFromContext({
        verified: admissible.relationGenerators,
        admissiblePathEnumeration: admissible,
        ambiguityComputation: computeAmbiguitiesFromVerified(
            admissible.relationGenerators,
            admissible.relationGenerators.maxPathLength,
        ),
    });
}

export function buildHochschildCochainComplexFromVerified(
    input: VerifiedMonomialAlgebra,
): HochschildCochainComplex {
    const admissible = enumerateAdmissiblePathsFromVerified(input);
    return buildHochschildCochainComplexFromContext({
        verified: input,
        admissiblePathEnumeration: admissible,
        ambiguityComputation: computeAmbiguitiesFromVerified(
            input,
            input.maxPathLength,
        ),
    });
}

export function buildHochschildCochainComplexFromContext(
    context: HochschildCochainComplexContext,
): HochschildCochainComplex {
    const admissible = context.admissiblePathEnumeration;
    const ambiguityComputation = context.ambiguityComputation;
    const admissibleBasisByKey = new Map(
        admissible.paths.map((path) => [pathKey(path), path]),
    );

    let terms: LazySequence<CochainSpace>;
    terms = makeLazySequence(assertNonNegativeCochainDegree, (degree) =>
        buildTerm(
            degree,
            ambiguityComputation.primaryLeftR2L.getAt(degree),
            admissible.paths,
        ),
    );

    const coboundaries = makeLazySequence<SparseMatrix>(
        assertNonNegativeCochainDegree,
        (degree) => {
            const source = terms.getAt(degree);
            const target = terms.getAt(degree + 1);
            const targetBasisByKey = new Map(
                target.basis.map((element, index) => [
                    termBasisKey(element),
                    index,
                ]),
            );
            const values = new Map<string, number>();
            const targetAmbiguities = [
                ...new Map(
                    target.basis.map((element) => [
                        pathKey(underlyingPathOfAmbiguity(element.ambiguity)),
                        element.ambiguity,
                    ]),
                ).values(),
            ];
            source.basis.forEach((sourceElement, col) => {
                for (const targetAmbiguity of targetAmbiguities) {
                    for (const entry of coboundaryImageEntries(
                        admissible.relationGenerators.quiver,
                        admissibleBasisByKey,
                        targetBasisByKey,
                        degree,
                        sourceElement,
                        targetAmbiguity,
                    )) {
                        addSparseEntry(values, entry.row, col, entry.value);
                    }
                }
            });
            return normalizeSparseMatrix({
                rows: target.dimension,
                cols: source.dimension,
                entries: [...values.entries()].map(([key, value]) => {
                    const [row, col] = key.split(":").map(Number);
                    return { row, col, value };
                }),
            });
        },
    );

    return {
        terms,
        coboundaries,
        field: "Q",
        logs: ["Computing in rationals."],
        admissiblePathEnumeration: admissible,
        ambiguityComputation,
    };
}

function normalizeSparseMatrix(matrix: SparseMatrix): SparseMatrix {
    const values = new Map<string, number>();
    for (const entry of matrix.entries) {
        const key = `${entry.row}:${entry.col}`;
        values.set(key, (values.get(key) ?? 0) + entry.value);
    }
    return {
        rows: matrix.rows,
        cols: matrix.cols,
        entries: [...values.entries()]
            .map(([key, value]) => {
                const [row, col] = key.split(":").map(Number);
                return { row, col, value };
            })
            .filter((entry) => entry.value !== 0)
            .sort((left, right) =>
                left.row === right.row
                    ? left.col - right.col
                    : left.row - right.row,
            ),
    };
}

function composeSparseMatrices(left: SparseMatrix, right: SparseMatrix): SparseMatrix {
    if (left.cols !== right.rows) {
        throw new Error(
            `Cannot compose matrices with dimensions ${left.rows} x ${left.cols} and ${right.rows} x ${right.cols}.`,
        );
    }
    const values = new Map<string, number>();
    const leftByCol = new Map<number, SparseMatrix["entries"]>();
    for (const entry of left.entries) {
        const entries = leftByCol.get(entry.col) ?? [];
        entries.push(entry);
        leftByCol.set(entry.col, entries);
    }
    for (const rightEntry of right.entries) {
        for (const leftEntry of leftByCol.get(rightEntry.row) ?? []) {
            addSparseEntry(
                values,
                leftEntry.row,
                rightEntry.col,
                leftEntry.value * rightEntry.value,
            );
        }
    }
    return normalizeSparseMatrix({
        rows: left.rows,
        cols: right.cols,
        entries: [...values.entries()].map(([key, value]) => {
            const [row, col] = key.split(":").map(Number);
            return { row, col, value };
        }),
    });
}

export function checkHochschildDifferential(
    complex: HochschildCochainComplex,
    startDegree: number,
    endDegreeInclusive: number,
): DifferentialCheckResult {
    assertNonNegativeCochainDegree(startDegree);
    assertNonNegativeCochainDegree(endDegreeInclusive);
    if (endDegreeInclusive < startDegree) {
        return {
            ok: true,
            checkedThroughDegree: endDegreeInclusive,
        };
    }
    for (let degree = startDegree; degree <= endDegreeInclusive; degree += 1) {
        const composite = composeSparseMatrices(
            complex.coboundaries.getAt(degree + 1),
            complex.coboundaries.getAt(degree),
        );
        if (composite.entries.length > 0) {
            return {
                ok: false,
                checkedThroughDegree: degree,
                failure: {
                    degree,
                    entries: composite.entries,
                },
            };
        }
    }
    return {
        ok: true,
        checkedThroughDegree: endDegreeInclusive,
    };
}

import type { Path, PathOrientation } from "./paths";
import { vertexPath } from "./paths";
import { reverseOrientation } from "./path-orientation";
import {
    tidyUpMonomialAlgebra,
    type MonomialAlgebraInput,
    type VerifiedMonomialAlgebra,
} from "./monomial-algebra";
import { arrowById, printArrowWord, type ArrowId, type Quiver } from "./quiver";

export type AmbiguityKind = "left" | "right";

export interface Ambiguity {
    n: number;
    pieces: Path[];
    orientation: PathOrientation;
    kind: AmbiguityKind;
}

export interface AmbiguityComparisonWarning {
    kind: "orientation-mismatch";
    degree: number;
    message: string;
    leftR2L: Ambiguity[];
    rightL2R: Ambiguity[];
}

export interface LazySequence<T> {
    getAt(index: number): T;
    getIteratorFrom(start: number): IterableIterator<[number, T]>;
    getArray(start: number, endInclusive: number): Array<[number, T]>;
}

export interface AmbiguitySequence extends LazySequence<Ambiguity[]> {
    getAt(index: -1): Ambiguity[];
    getAt(index: number): Ambiguity[];
}

export interface AmbiguityComputation {
    primaryLeftR2L: AmbiguitySequence;
    checkRightL2R: AmbiguitySequence;
    warnings: AmbiguityComparisonWarning[];
}

const AMBIGUITY_LOG_PREFIX = "[GAPCytoEx ambiguity]";
const SHOULD_LOG_AMBIGUITIES = typeof window !== "undefined";

function ambiguityLog(message: string, details?: unknown): void {
    if (!SHOULD_LOG_AMBIGUITIES) {
        return;
    }
    if (details === undefined) {
        console.log(message);
        return;
    }
    console.log(message, details);
}

function ambiguityTime(label: string): void {
    if (SHOULD_LOG_AMBIGUITIES) {
        console.time(label);
    }
}

function ambiguityTimeEnd(label: string): void {
    if (SHOULD_LOG_AMBIGUITIES) {
        console.timeEnd(label);
    }
}

function ambiguityGroupCollapsed(label: string): void {
    if (SHOULD_LOG_AMBIGUITIES) {
        console.groupCollapsed(label);
    }
}

function ambiguityGroupEnd(): void {
    if (SHOULD_LOG_AMBIGUITIES) {
        console.groupEnd();
    }
}

function formatOrientation(orientation: PathOrientation): string {
    return orientation === "R2L" ? "right-to-left" : "left-to-right";
}

export function getLazySequenceTerms<T>(
    sequence: LazySequence<T>,
    start: number,
    endInclusive: number,
    logOnlyLastTerm = false,
): Array<[number, T]> {
    if (endInclusive < start) {
        return [];
    }
    return logOnlyLastTerm
        ? [[endInclusive, sequence.getAt(endInclusive)]]
        : sequence.getArray(start, endInclusive);
}

export function underlyingPathOfAmbiguity(ambiguity: Ambiguity): Path {
    const nonVertexPieces = ambiguity.pieces.filter(
        (piece) => piece.arrows.length > 0,
    );
    const first =
        ambiguity.orientation === "R2L"
            ? nonVertexPieces[nonVertexPieces.length - 1]
            : ambiguity.pieces[0];
    const last =
        ambiguity.orientation === "R2L"
            ? ambiguity.pieces[0]
            : ambiguity.pieces[ambiguity.pieces.length - 1];
    return {
        arrows: ambiguity.pieces.flatMap((piece) => piece.arrows),
        source: first?.source ?? "",
        target: last?.target ?? "",
        orientation: ambiguity.orientation,
    };
}

export function reverseOrientationOfAmbiguity(ambiguity: Ambiguity): Ambiguity {
    return {
        n: ambiguity.n,
        pieces: ambiguity.pieces
            .map((piece) => reverseOrientation(piece))
            .reverse(),
        orientation: reverseOrientation(underlyingPathOfAmbiguity(ambiguity))
            .orientation,
        kind: ambiguity.kind === "left" ? "right" : "left",
    };
}

function pathFromWord(
    quiver: Quiver,
    arrows: ArrowId[],
    orientation: PathOrientation,
): Path {
    if (arrows.length === 0) {
        throw new Error(
            "Cannot build a non-vertex path from an empty arrow word.",
        );
    }
    const l2rWord = orientation === "L2R" ? arrows : [...arrows].reverse();
    const first = arrowById(quiver, l2rWord[0]);
    if (!first) {
        throw new Error(`Unknown arrow '${l2rWord[0]}'.`);
    }
    let previous = first;
    for (const arrowId of l2rWord.slice(1)) {
        const next = arrowById(quiver, arrowId);
        if (!next) {
            throw new Error(`Unknown arrow '${arrowId}'.`);
        }
        if (previous.target !== next.source) {
            throw new Error(
                `Arrow word '${l2rWord.join("*")}' is not composable at '${previous.id}' followed by '${next.id}'.`,
            );
        }
        previous = next;
    }
    return {
        arrows: [...arrows],
        source: first.source,
        target: previous.target,
        orientation,
    };
}

function isPathWord(
    quiver: Quiver,
    arrows: ArrowId[],
    orientation: PathOrientation,
): boolean {
    try {
        pathFromWord(quiver, arrows, orientation);
        return true;
    } catch {
        return false;
    }
}

function suffix(word: ArrowId[], length: number): ArrowId[] {
    return word.slice(word.length - length);
}

function prefix(word: ArrowId[], length: number): ArrowId[] {
    return word.slice(0, length);
}

function wordsEqual(left: ArrowId[], right: ArrowId[]): boolean {
    return (
        left.length === right.length &&
        left.every((arrow, index) => arrow === right[index])
    );
}

function isStrictSuffixRelation(
    word: ArrowId[],
    relationWords: ArrowId[][],
): boolean {
    for (let length = 1; length < word.length; length += 1) {
        const wordSuffix = suffix(word, length);
        if (
            relationWords.some((relationWord) =>
                wordsEqual(wordSuffix, relationWord),
            )
        ) {
            return true;
        }
    }
    return false;
}

function isStrictPrefixRelation(
    word: ArrowId[],
    relationWords: ArrowId[][],
): boolean {
    for (let length = 1; length < word.length; length += 1) {
        const wordPrefix = prefix(word, length);
        if (
            relationWords.some((relationWord) =>
                wordsEqual(wordPrefix, relationWord),
            )
        ) {
            return true;
        }
    }
    return false;
}

function rightAppendsForRelationSuffix(
    lastPieceWord: ArrowId[],
    relationWord: ArrowId[],
): ArrowId[][] {
    const appends: ArrowId[][] = [];
    const maxOverlap = Math.min(lastPieceWord.length, relationWord.length - 1);
    for (let overlap = maxOverlap; overlap >= 0; overlap -= 1) {
        if (
            wordsEqual(
                suffix(lastPieceWord, overlap),
                prefix(relationWord, overlap),
            )
        ) {
            appends.push(relationWord.slice(overlap));
        }
    }
    return appends;
}

function leftPrependsForRelationPrefix(
    firstPieceWord: ArrowId[],
    relationWord: ArrowId[],
): ArrowId[][] {
    const prepends: ArrowId[][] = [];
    const maxOverlap = Math.min(firstPieceWord.length, relationWord.length - 1);
    for (let overlap = maxOverlap; overlap >= 0; overlap -= 1) {
        if (
            wordsEqual(
                prefix(firstPieceWord, overlap),
                suffix(relationWord, overlap),
            )
        ) {
            prepends.push(relationWord.slice(0, relationWord.length - overlap));
        }
    }
    return prepends;
}

function ambiguityKey(ambiguity: Ambiguity): string {
    const path = underlyingPathOfAmbiguity(ambiguity);
    return `${path.orientation}:${path.source}:${path.target}:${printArrowWord(path.arrows)}`;
}

function makeSequence(
    label: string,
    compute: (index: number) => Ambiguity[],
): AmbiguitySequence {
    const cache = new Map<number, Ambiguity[]>();
    const sequence: AmbiguitySequence = {
        getAt(index: number): Ambiguity[] {
            if (index < -1) {
                throw new RangeError("Ambiguity degree must be at least -1.");
            }
            if (!cache.has(index)) {
                ambiguityTime(
                    `${AMBIGUITY_LOG_PREFIX} ${label} Gamma[${index}]`,
                );
                const value = compute(index);
                ambiguityTimeEnd(
                    `${AMBIGUITY_LOG_PREFIX} ${label} Gamma[${index}]`,
                );
                ambiguityLog(
                    `${AMBIGUITY_LOG_PREFIX} ${label} Gamma[${index}]`,
                    {
                        ambiguities: value.length,
                    },
                );
                cache.set(index, value);
            }
            return cache.get(index) ?? [];
        },
        *getIteratorFrom(
            start: number,
        ): IterableIterator<[number, Ambiguity[]]> {
            if (start < -1) {
                throw new RangeError("Ambiguity degree must be at least -1.");
            }
            let index = start;
            while (true) {
                yield [index, sequence.getAt(index)];
                index += 1;
            }
        },
        getArray(
            start: number,
            endInclusive: number,
        ): Array<[number, Ambiguity[]]> {
            if (start < -1) {
                throw new RangeError("Ambiguity degree must be at least -1.");
            }
            if (endInclusive < start) {
                return [];
            }
            const result: Array<[number, Ambiguity[]]> = [];
            for (let index = start; index <= endInclusive; index += 1) {
                result.push([index, sequence.getAt(index)]);
            }
            return result;
        },
    };
    return sequence;
}

function dedupeAmbiguities(ambiguities: Ambiguity[]): Ambiguity[] {
    const seen = new Set<string>();
    const result: Ambiguity[] = [];
    for (const ambiguity of ambiguities) {
        const key = ambiguityKey(ambiguity);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(ambiguity);
    }
    return result;
}

function gammaMinusOne(
    quiver: Quiver,
    orientation: PathOrientation,
    kind: AmbiguityKind,
): Ambiguity[] {
    return quiver.vertices.map((vertex) => ({
        n: -1,
        pieces: [vertexPath(vertex.id, orientation)],
        orientation,
        kind,
    }));
}

function gammaZeroR2L(quiver: Quiver): Ambiguity[] {
    return quiver.arrows.map((arrow) => ({
        n: 0,
        pieces: [
            vertexPath(arrow.target, "R2L"),
            pathFromWord(quiver, [arrow.id], "R2L"),
        ],
        orientation: "R2L" as const,
        kind: "left" as const,
    }));
}

function gammaZeroL2R(quiver: Quiver): Ambiguity[] {
    return quiver.arrows.map((arrow) => ({
        n: 0,
        pieces: [
            pathFromWord(quiver, [arrow.id], "L2R"),
            vertexPath(arrow.target, "L2R"),
        ],
        orientation: "L2R" as const,
        kind: "right" as const,
    }));
}

function gammaOneR2L(input: VerifiedMonomialAlgebra): Ambiguity[] {
    return input.minimisedRelations.map((relation) => {
        const relationWord = [...relation.path.arrows].reverse();
        return {
            n: 1,
            pieces: [
                vertexPath(relation.path.target, "R2L"),
                pathFromWord(input.quiver, [relationWord[0]], "R2L"),
                pathFromWord(input.quiver, relationWord.slice(1), "R2L"),
            ],
            orientation: "R2L" as const,
            kind: "left" as const,
        };
    });
}

function gammaOneL2R(input: VerifiedMonomialAlgebra): Ambiguity[] {
    return input.minimisedRelations.map((relation) => {
        const relationWord = relation.path.arrows;
        return {
            n: 1,
            pieces: [
                pathFromWord(input.quiver, relationWord.slice(0, -1), "L2R"),
                pathFromWord(
                    input.quiver,
                    [relationWord[relationWord.length - 1]],
                    "L2R",
                ),
                vertexPath(relation.path.target, "L2R"),
            ],
            orientation: "L2R" as const,
            kind: "right" as const,
        };
    });
}

function computeNextLeftR2L(
    input: VerifiedMonomialAlgebra,
    previous: Ambiguity[],
    degree: number,
): Ambiguity[] {
    const relationWords = input.minimisedRelations.map((relation) =>
        [...relation.path.arrows].reverse(),
    );
    const candidates: Ambiguity[] = [];
    ambiguityLog(`${AMBIGUITY_LOG_PREFIX} left R2L extension start`, {
        degree,
        previous: previous.length,
        relations: relationWords.length,
    });

    for (const ambiguity of previous) {
        // Spec 05, steps 4-5: extend only the previous rightmost non-vertex piece.
        const lastPiece = ambiguity.pieces[ambiguity.pieces.length - 1];
        if (!lastPiece || lastPiece.arrows.length === 0) {
            continue;
        }

        for (const relationWord of relationWords) {
            for (const rightAppend of rightAppendsForRelationSuffix(
                lastPiece.arrows,
                relationWord,
            )) {
                const joinedRight = [...lastPiece.arrows, ...rightAppend];
                if (
                    !isPathWord(input.quiver, joinedRight, "R2L") ||
                    !wordsEqual(
                        suffix(joinedRight, relationWord.length),
                        relationWord,
                    ) ||
                    isStrictPrefixRelation(joinedRight, relationWords)
                ) {
                    continue;
                }

                const nextPieces = [
                    ...ambiguity.pieces,
                    pathFromWord(input.quiver, rightAppend, "R2L"),
                ];
                candidates.push({
                    n: degree,
                    pieces: nextPieces,
                    orientation: "R2L",
                    kind: "left",
                });
            }
        }
    }

    const deduped = dedupeAmbiguities(candidates);
    ambiguityLog(`${AMBIGUITY_LOG_PREFIX} left R2L extension end`, {
        degree,
        candidates: candidates.length,
        deduped: deduped.length,
    });
    return deduped;
}

function computeNextRightL2R(
    input: VerifiedMonomialAlgebra,
    previous: Ambiguity[],
    degree: number,
): Ambiguity[] {
    const relationWords = input.minimisedRelations.map(
        (relation) => relation.path.arrows,
    );
    const candidates: Ambiguity[] = [];
    ambiguityLog(`${AMBIGUITY_LOG_PREFIX} right L2R extension start`, {
        degree,
        previous: previous.length,
        relations: relationWords.length,
    });

    for (const ambiguity of previous) {
        // L2R mirror of Spec 05, steps 4-5: extend only the previous leftmost non-vertex piece.
        const firstPiece = ambiguity.pieces[0];
        if (!firstPiece || firstPiece.arrows.length === 0) {
            continue;
        }

        for (const relationWord of relationWords) {
            for (const leftPrepend of leftPrependsForRelationPrefix(
                firstPiece.arrows,
                relationWord,
            )) {
                const joinedLeft = [...leftPrepend, ...firstPiece.arrows];
                if (
                    !isPathWord(input.quiver, joinedLeft, "L2R") ||
                    !wordsEqual(
                        prefix(joinedLeft, relationWord.length),
                        relationWord,
                    ) ||
                    isStrictSuffixRelation(joinedLeft, relationWords)
                ) {
                    continue;
                }

                const nextPieces: Path[] = [
                    pathFromWord(input.quiver, leftPrepend, "L2R"),
                    ...ambiguity.pieces,
                ];
                candidates.push({
                    n: degree,
                    pieces: nextPieces,
                    orientation: "L2R",
                    kind: "right",
                });
            }
        }
    }

    const deduped = dedupeAmbiguities(candidates);
    ambiguityLog(`${AMBIGUITY_LOG_PREFIX} right L2R extension end`, {
        degree,
        candidates: candidates.length,
        deduped: deduped.length,
    });
    return deduped;
}

export function computeLeftAmbiguitiesR2L(
    input: VerifiedMonomialAlgebra,
): AmbiguitySequence {
    let sequence: AmbiguitySequence;
    sequence = makeSequence("left R2L", (index) => {
        if (index === -1) {
            return gammaMinusOne(input.quiver, "R2L", "left");
        }
        if (index === 0) {
            return gammaZeroR2L(input.quiver);
        }
        if (index === 1) {
            return gammaOneR2L(input);
        }
        const previous = sequence.getAt(index - 1);
        if (previous.length === 0) {
            return [];
        }
        return computeNextLeftR2L(input, previous, index);
    });
    return sequence;
}

export function computeRightAmbiguitiesL2R(
    input: VerifiedMonomialAlgebra,
): AmbiguitySequence {
    let sequence: AmbiguitySequence;
    sequence = makeSequence("right L2R", (index) => {
        if (index === -1) {
            return gammaMinusOne(input.quiver, "L2R", "right");
        }
        if (index === 0) {
            return gammaZeroL2R(input.quiver);
        }
        if (index === 1) {
            return gammaOneL2R(input);
        }
        const previous = sequence.getAt(index - 1);
        if (previous.length === 0) {
            return [];
        }
        return computeNextRightL2R(input, previous, index);
    });
    return sequence;
}

function ambiguitySignatures(ambiguities: Ambiguity[]): string[] {
    return ambiguities.map(ambiguityKey).sort();
}

function equivalentAmbiguityLists(
    leftR2L: Ambiguity[],
    rightL2R: Ambiguity[],
): boolean {
    const leftAsRight = leftR2L.map((ambiguity) =>
        reverseOrientationOfAmbiguity(ambiguity),
    );
    const leftKeys = ambiguitySignatures(leftAsRight);
    const rightKeys = ambiguitySignatures(rightL2R);
    return wordsEqual(leftKeys, rightKeys);
}

export function computeAmbiguitiesFromVerified(
    verified: VerifiedMonomialAlgebra,
    comparisonMaxDegree = verified.maxPathLength,
): AmbiguityComputation {
    const checkedComparisonMaxDegree = Math.max(
        -1,
        Math.floor(comparisonMaxDegree),
    );
    ambiguityGroupCollapsed(`${AMBIGUITY_LOG_PREFIX} orientation cross-check`);
    ambiguityLog("cross-check input", {
        arrows: verified.quiver.arrows.length,
        minimisedRelations: verified.minimisedRelations.length,
        maxPathLength: verified.maxPathLength,
        comparisonMaxDegree: checkedComparisonMaxDegree,
    });
    const primaryLeftR2L = computeLeftAmbiguitiesR2L(verified);
    const checkRightL2R = computeRightAmbiguitiesL2R(verified);
    const warnings: AmbiguityComparisonWarning[] = [];

    for (let degree = -1; degree <= checkedComparisonMaxDegree; degree += 1) {
        ambiguityTime(`${AMBIGUITY_LOG_PREFIX} compare Gamma[${degree}]`);
        const left = primaryLeftR2L.getAt(degree);
        const right = checkRightL2R.getAt(degree);
        ambiguityTimeEnd(`${AMBIGUITY_LOG_PREFIX} compare Gamma[${degree}]`);
        ambiguityLog(`${AMBIGUITY_LOG_PREFIX} compare Gamma[${degree}]`, {
            leftR2L: left.length,
            rightL2R: right.length,
        });
        if (!equivalentAmbiguityLists(left, right)) {
            warnings.push({
                kind: "orientation-mismatch",
                degree,
                message: `${formatOrientation("R2L")} left ambiguities and ${formatOrientation("L2R")} right ambiguities differ in degree ${degree}.`,
                leftR2L: left,
                rightL2R: right,
            });
            break;
        }
    }
    ambiguityLog("cross-check warnings", warnings.length);
    ambiguityGroupEnd();

    return {
        primaryLeftR2L,
        checkRightL2R,
        warnings,
    };
}

export function computeAmbiguities(
    input: MonomialAlgebraInput,
    comparisonMaxDegree?: number,
): AmbiguityComputation {
    return computeAmbiguitiesFromVerified(
        tidyUpMonomialAlgebra(input),
        comparisonMaxDegree,
    );
}

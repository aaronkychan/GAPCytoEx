import type { Path, PathOrientation } from "./paths";
import { vertexPath } from "./paths";
import { reverseOrientation } from "./path-orientation";
import {
  tidyUpMonomialAlgebra,
  type MonomialAlgebraInput,
  type VerifiedMonomialAlgebra
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
}

export interface AmbiguityComputation {
  primaryLeftR2L: AmbiguitySequence;
  checkRightL2R: AmbiguitySequence;
  warnings: AmbiguityComparisonWarning[];
}

export function underlyingPathOfAmbiguity(ambiguity: Ambiguity): Path {
  const nonVertexPieces = ambiguity.pieces.filter((piece) => piece.arrows.length > 0);
  const first = ambiguity.orientation === "R2L" ? nonVertexPieces[nonVertexPieces.length - 1] : ambiguity.pieces[0];
  const last = ambiguity.orientation === "R2L" ? ambiguity.pieces[0] : ambiguity.pieces[ambiguity.pieces.length - 1];
  return {
    arrows: ambiguity.pieces.flatMap((piece) => piece.arrows),
    source: first?.source ?? "",
    target: last?.target ?? "",
    orientation: ambiguity.orientation
  };
}

export function reverseOrientationOfAmbiguity(ambiguity: Ambiguity): Ambiguity {
  return {
    n: ambiguity.n,
    pieces: ambiguity.pieces.map((piece) => reverseOrientation(piece)).reverse(),
    orientation: reverseOrientation(underlyingPathOfAmbiguity(ambiguity)).orientation,
    kind: ambiguity.kind === "left" ? "right" : "left"
  };
}

function pathFromWord(quiver: Quiver, arrows: ArrowId[], orientation: PathOrientation): Path {
  if (arrows.length === 0) {
    throw new Error("Cannot build a non-vertex path from an empty arrow word.");
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
      throw new Error(`Arrow word '${l2rWord.join("*")}' is not composable at '${previous.id}' followed by '${next.id}'.`);
    }
    previous = next;
  }
  return {
    arrows: [...arrows],
    source: first.source,
    target: previous.target,
    orientation
  };
}

function suffix(word: ArrowId[], length: number): ArrowId[] {
  return word.slice(word.length - length);
}

function prefix(word: ArrowId[], length: number): ArrowId[] {
  return word.slice(0, length);
}

function wordsEqual(left: ArrowId[], right: ArrowId[]): boolean {
  return left.length === right.length && left.every((arrow, index) => arrow === right[index]);
}

function ambiguityKey(ambiguity: Ambiguity): string {
  const path = underlyingPathOfAmbiguity(ambiguity);
  return `${path.orientation}:${path.source}:${path.target}:${printArrowWord(path.arrows)}`;
}

function makeSequence(compute: (index: number) => Ambiguity[]): AmbiguitySequence {
  const cache = new Map<number, Ambiguity[]>();
  const sequence: AmbiguitySequence = {
    getAt(index: number): Ambiguity[] {
      if (index < -1) {
        throw new RangeError("Ambiguity degree must be at least -1.");
      }
      if (!cache.has(index)) {
        cache.set(index, compute(index));
      }
      return cache.get(index) ?? [];
    },
    *getIteratorFrom(start: number): IterableIterator<[number, Ambiguity[]]> {
      if (start < -1) {
        throw new RangeError("Ambiguity degree must be at least -1.");
      }
      let index = start;
      while (true) {
        yield [index, sequence.getAt(index)];
        index += 1;
      }
    },
    getArray(start: number, endInclusive: number): Array<[number, Ambiguity[]]> {
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
    }
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

function gammaMinusOne(quiver: Quiver, orientation: PathOrientation, kind: AmbiguityKind): Ambiguity[] {
  return quiver.vertices.map((vertex) => ({
    n: -1,
    pieces: [vertexPath(vertex.id, orientation)],
    orientation,
    kind
  }));
}

function gammaZeroR2L(quiver: Quiver): Ambiguity[] {
  return quiver.arrows.map((arrow) => ({
    n: 0,
    pieces: [
      vertexPath(arrow.target, "R2L"),
      pathFromWord(quiver, [arrow.id], "R2L")
    ],
    orientation: "R2L" as const,
    kind: "left" as const
  }));
}

function gammaZeroL2R(quiver: Quiver): Ambiguity[] {
  return quiver.arrows.map((arrow) => ({
    n: 0,
    pieces: [
      pathFromWord(quiver, [arrow.id], "L2R"),
      vertexPath(arrow.target, "L2R")
    ],
    orientation: "L2R" as const,
    kind: "right" as const
  }));
}

function gammaOneR2L(input: VerifiedMonomialAlgebra): Ambiguity[] {
  return input.minimisedRelations.map((relation) => ({
    n: 1,
    pieces: [
      vertexPath(relation.path.target, "R2L"),
      pathFromWord(input.quiver, [...relation.path.arrows].reverse(), "R2L")
    ],
    orientation: "R2L" as const,
    kind: "left" as const
  }));
}

function gammaOneL2R(input: VerifiedMonomialAlgebra): Ambiguity[] {
  return input.minimisedRelations.map((relation) => ({
    n: 1,
    pieces: [
      pathFromWord(input.quiver, relation.path.arrows, "L2R"),
      vertexPath(relation.path.target, "L2R")
    ],
    orientation: "L2R" as const,
    kind: "right" as const
  }));
}

function computeNextLeftR2L(input: VerifiedMonomialAlgebra, previous: Ambiguity[], degree: number): Ambiguity[] {
  const relationWords = input.minimisedRelations.map((relation) => [...relation.path.arrows].reverse());
  const candidates: Ambiguity[] = [];

  for (const ambiguity of previous) {
    // Spec 05, steps 4-5: extend only the previous rightmost non-vertex piece.
    const lastPiece = ambiguity.pieces[ambiguity.pieces.length - 1];
    if (!lastPiece || lastPiece.arrows.length === 0) {
      continue;
    }

    for (const relationWord of relationWords) {
      // Spec 05, steps 6-9: find a proper overlap and append only the relation tail.
      for (let overlap = 1; overlap < relationWord.length && overlap <= lastPiece.arrows.length; overlap += 1) {
        if (!wordsEqual(suffix(lastPiece.arrows, overlap), prefix(relationWord, overlap))) {
          continue;
        }
        const rightAppend = relationWord.slice(overlap);
        if (rightAppend.length === 0) {
          continue;
        }
        const joinedRight = [...lastPiece.arrows, ...rightAppend];
        if (!wordsEqual(suffix(joinedRight, relationWord.length), relationWord)) {
          continue;
        }

        // Spec 05, steps 10-14: split the appended tail into the updated old piece and new final piece.
        const appendedExceptLast = rightAppend.slice(0, -1);
        const finalArrow = rightAppend[rightAppend.length - 1];
        const nextPieces = ambiguity.pieces.slice(0, -1);
        if (appendedExceptLast.length > 0) {
          nextPieces.push(pathFromWord(input.quiver, [...lastPiece.arrows, ...appendedExceptLast], "R2L"));
        } else {
          nextPieces.push(lastPiece);
        }
        nextPieces.push(pathFromWord(input.quiver, [finalArrow], "R2L"));
        candidates.push({
          n: degree,
          pieces: nextPieces,
          orientation: "R2L",
          kind: "left"
        });
      }
    }
  }

  return dedupeAmbiguities(candidates);
}

function computeNextRightL2R(input: VerifiedMonomialAlgebra, previous: Ambiguity[], degree: number): Ambiguity[] {
  const relationWords = input.minimisedRelations.map((relation) => relation.path.arrows);
  const candidates: Ambiguity[] = [];

  for (const ambiguity of previous) {
    // L2R mirror of Spec 05, steps 4-5: extend only the previous leftmost non-vertex piece.
    const firstPiece = ambiguity.pieces[0];
    if (!firstPiece || firstPiece.arrows.length === 0) {
      continue;
    }

    for (const relationWord of relationWords) {
      // L2R mirror of Spec 05, steps 6-9: find a proper overlap and prepend only the relation head.
      for (let overlap = 1; overlap < relationWord.length && overlap <= firstPiece.arrows.length; overlap += 1) {
        if (!wordsEqual(suffix(relationWord, overlap), prefix(firstPiece.arrows, overlap))) {
          continue;
        }
        const leftPrepend = relationWord.slice(0, relationWord.length - overlap);
        if (leftPrepend.length === 0) {
          continue;
        }
        const joinedLeft = [...leftPrepend, ...firstPiece.arrows];
        if (!wordsEqual(prefix(joinedLeft, relationWord.length), relationWord)) {
          continue;
        }

        // L2R mirror of Spec 05, steps 10-14: split the prepended head into the new first piece and updated old piece.
        const firstArrow = leftPrepend[0];
        const remainingPrepend = leftPrepend.slice(1);
        const nextPieces: Path[] = [pathFromWord(input.quiver, [firstArrow], "L2R")];
        if (remainingPrepend.length > 0) {
          nextPieces.push(pathFromWord(input.quiver, [...remainingPrepend, ...firstPiece.arrows], "L2R"));
          nextPieces.push(...ambiguity.pieces.slice(1));
        } else {
          nextPieces.push(...ambiguity.pieces);
        }
        candidates.push({
          n: degree,
          pieces: nextPieces,
          orientation: "L2R",
          kind: "right"
        });
      }
    }
  }

  return dedupeAmbiguities(candidates);
}

export function computeLeftAmbiguitiesR2L(input: VerifiedMonomialAlgebra): AmbiguitySequence {
  let sequence: AmbiguitySequence;
  sequence = makeSequence((index) => {
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

export function computeRightAmbiguitiesL2R(input: VerifiedMonomialAlgebra): AmbiguitySequence {
  let sequence: AmbiguitySequence;
  sequence = makeSequence((index) => {
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

function equivalentAmbiguityLists(leftR2L: Ambiguity[], rightL2R: Ambiguity[]): boolean {
  const leftAsRight = leftR2L.map((ambiguity) => reverseOrientationOfAmbiguity(ambiguity));
  const leftKeys = ambiguitySignatures(leftAsRight);
  const rightKeys = ambiguitySignatures(rightL2R);
  return wordsEqual(leftKeys, rightKeys);
}

export function computeAmbiguities(input: MonomialAlgebraInput): AmbiguityComputation {
  const verified = tidyUpMonomialAlgebra(input);
  const primaryLeftR2L = computeLeftAmbiguitiesR2L(verified);
  const checkRightL2R = computeRightAmbiguitiesL2R(verified);
  const warnings: AmbiguityComparisonWarning[] = [];

  for (let degree = -1; degree <= verified.maxPathLength; degree += 1) {
    const left = primaryLeftR2L.getAt(degree);
    const right = checkRightL2R.getAt(degree);
    if (!equivalentAmbiguityLists(left, right)) {
      warnings.push({
        kind: "orientation-mismatch",
        degree,
        message: `R2L left ambiguities and L2R right ambiguities differ in degree ${degree}.`,
        leftR2L: left,
        rightL2R: right
      });
      break;
    }
  }

  return {
    primaryLeftR2L,
    checkRightL2R,
    warnings
  };
}

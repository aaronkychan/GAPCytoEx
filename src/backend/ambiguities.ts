import type { Path, PathOrientation } from "./paths";
import { reverseOrientation } from "./path-orientation";

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
  const first = ambiguity.pieces[0];
  const last = ambiguity.pieces[ambiguity.pieces.length - 1];
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

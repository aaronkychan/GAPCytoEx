import type { Path, PathOrientation } from "./paths";
import { reverseOrientation } from "./path-orientation";
import type { Quiver } from "./quiver";

export interface MonomialRelation {
  id: string;
  path: Path;
  pathL2R: Path;
  pathR2L: Path;
}

export interface MonomialAlgebraInput {
  quiver: Quiver;
  relations: MonomialRelation[];
  activeOrientation: PathOrientation;
  maxPathLength: number;
}

export interface NormalizedMonomialAlgebra {
  quiver: Quiver;
  relationsL2R: MonomialRelation[];
  relationsR2L: MonomialRelation[];
  activeOrientation: PathOrientation;
  maxPathLength: number;
}

export function relationFromL2R(id: string, pathL2R: Path, activeOrientation: PathOrientation = "L2R"): MonomialRelation {
  const pathR2L = reverseOrientation(pathL2R);
  return {
    id,
    path: activeOrientation === "L2R" ? pathL2R : pathR2L,
    pathL2R,
    pathR2L
  };
}

export function normalizeOrientedInput(input: MonomialAlgebraInput): NormalizedMonomialAlgebra {
  if (input.maxPathLength < 20) {
    throw new RangeError("maxPathLength must be at least 20.");
  }

  const relationsL2R = input.relations.map((relation) => ({
    ...relation,
    path: relation.pathL2R
  }));
  const relationsR2L = input.relations.map((relation) => ({
    ...relation,
    path: relation.pathR2L
  }));

  return {
    quiver: input.quiver,
    relationsL2R,
    relationsR2L,
    activeOrientation: input.activeOrientation,
    maxPathLength: input.maxPathLength
  };
}

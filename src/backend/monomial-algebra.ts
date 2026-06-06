import type { Path, PathOrientation } from "./paths";
import { reverseOrientation } from "./path-orientation";
import { arrowById, type Quiver } from "./quiver";

export const DEFAULT_MAX_PATH_LENGTH = 50;
export const MIN_MAX_PATH_LENGTH = 20;

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
  maxPathLength?: number;
}

export interface NormalizedMonomialAlgebra {
  quiver: Quiver;
  relationsL2R: MonomialRelation[];
  relationsR2L: MonomialRelation[];
  activeOrientation: PathOrientation;
  maxPathLength: number;
}

export function relationFromL2R(id: string, pathL2R: Path, activeOrientation: PathOrientation = "L2R"): MonomialRelation {
  const l2rPath = { ...pathL2R, orientation: "L2R" as const };
  const pathR2L = reverseOrientation(l2rPath);
  return {
    id,
    path: activeOrientation === "L2R" ? l2rPath : pathR2L,
    pathL2R: l2rPath,
    pathR2L
  };
}

export function pathFromArrowIdsL2R(quiver: Quiver, arrows: string[]): Path {
  if (arrows.length === 0) {
    throw new Error("Relation paths must contain at least two arrows.");
  }

  const first = arrowById(quiver, arrows[0]);
  if (!first) {
    throw new Error(`Relation path references unknown arrow '${arrows[0]}'.`);
  }

  let previous = first;
  for (const arrowId of arrows.slice(1)) {
    const next = arrowById(quiver, arrowId);
    if (!next) {
      throw new Error(`Relation path references unknown arrow '${arrowId}'.`);
    }
    if (previous.target !== next.source) {
      throw new Error(`Relation path is not composable at '${previous.id}' followed by '${next.id}'.`);
    }
    previous = next;
  }

  return {
    arrows: [...arrows],
    source: first.source,
    target: previous.target,
    orientation: "L2R"
  };
}

export function validateRelationPath(quiver: Quiver, relation: MonomialRelation): void {
  if (relation.pathL2R.arrows.length < 2) {
    throw new Error("Relation paths must contain at least two arrows.");
  }

  const normalizedPath = pathFromArrowIdsL2R(quiver, relation.pathL2R.arrows);
  if (normalizedPath.source !== relation.pathL2R.source || normalizedPath.target !== relation.pathL2R.target) {
    throw new Error(`Relation '${relation.id}' has inconsistent source or target data.`);
  }
}

export function normalizeOrientedInput(input: MonomialAlgebraInput): NormalizedMonomialAlgebra {
  const maxPathLength = input.maxPathLength ?? DEFAULT_MAX_PATH_LENGTH;
  if (maxPathLength < MIN_MAX_PATH_LENGTH) {
    throw new RangeError(`maxPathLength must be at least ${MIN_MAX_PATH_LENGTH}.`);
  }

  input.relations.forEach((relation) => validateRelationPath(input.quiver, relation));

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
    maxPathLength
  };
}

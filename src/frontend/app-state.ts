import type { PathOrientation } from "../backend/paths";
import { DEFAULT_MAX_PATH_LENGTH, MIN_MAX_PATH_LENGTH } from "../backend/monomial-algebra";
import type { Quiver } from "../backend/quiver";
import type { RelationGenerator } from "../backend/relations";

export interface OrientationState {
  active: PathOrientation;
}

export interface FrontendState {
  orientation: OrientationState;
  maxPathLength: number;
  quiver: Quiver;
  relations: RelationGenerator[];
  selectedRelationId: string | null;
  infoMessage: string;
  outputText: string;
}

export function initialState(): FrontendState {
  return {
    orientation: { active: "L2R" },
    maxPathLength: DEFAULT_MAX_PATH_LENGTH,
    quiver: { vertices: [], arrows: [] },
    relations: [],
    selectedRelationId: null,
    infoMessage: "Ready.",
    outputText: "Use Draw and Translate to QPA Quiver for translator output. Monomial computations are staged until the human check after Stage 1."
  };
}

export function validateMaxPathLength(value: number): string | null {
  return Number.isFinite(value) && value >= MIN_MAX_PATH_LENGTH
    ? null
    : `maxPathLength must be at least ${MIN_MAX_PATH_LENGTH}.`;
}

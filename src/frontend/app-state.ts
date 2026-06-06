import type { PathOrientation } from "../backend/paths";

export interface OrientationState {
  active: PathOrientation;
}

export interface FrontendState {
  orientation: OrientationState;
  maxPathLength: number;
}

export function initialState(): FrontendState {
  return {
    orientation: { active: "L2R" },
    maxPathLength: 50
  };
}

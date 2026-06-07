import type { RelationData } from "../backend/relations";
import type { CytoscapeElementData } from "../backend/qpa-translator";
import type { PathOrientation } from "../backend/paths";

export type EditMode = "default" | "add" | "rename" | "delete";

export interface WorkbenchState {
  quiverData: { nodes: CytoscapeElementData[]; edges: CytoscapeElementData[] } | null;
  cy: any | null;
  relations: RelationData[];
  mode: EditMode;
  addingArrow: boolean;
  sourceNodeId: string | null;
  selectedRelationIndex: number;
  addRelationMode: boolean;
  autoNameVertexCounter: number;
  autoNameArrowCounter: number;
  animationTimer: ReturnType<typeof setInterval> | null;
  activePathOrientation: PathOrientation;
  activeFieldCharacteristic: number;
}

export function createWorkbenchState(): WorkbenchState {
  return {
    quiverData: null,
    cy: null,
    relations: [],
    mode: "default",
    addingArrow: false,
    sourceNodeId: null,
    selectedRelationIndex: -1,
    addRelationMode: false,
    autoNameVertexCounter: 0,
    autoNameArrowCounter: 1,
    animationTimer: null,
    activePathOrientation: "L2R",
    activeFieldCharacteristic: 0
  };
}

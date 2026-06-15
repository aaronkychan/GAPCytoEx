import type { RelationData } from "../backend/relations";
import type { CytoscapeElementData } from "../backend/qpa-translator";
import type { PathOrientation } from "../backend/paths";
import type { Ambiguity } from "../backend/ambiguities";
import type { CochainSpace, HochschildCochainComplex, HochschildCochainComplexContext, SparseMatrix } from "../backend/chainCpx";
import type { HochschildCohomologyGroup } from "../backend/cohomology";

export type EditMode = "default" | "add" | "rename" | "delete";
export type RelationPanelTab = "relations" | "ambiguities" | "hochschild-complex";

export interface AmbiguityDegreeGroup {
  degree: number;
  ambiguities: Ambiguity[];
}

export interface HochschildComplexDisplayData {
  terms: CochainSpace[];
  coboundaries: SparseMatrix[];
  cohomologyGroups?: HochschildCohomologyGroup[];
  checkedDifferentialThrough: number;
}

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
  monomialComputationContext: HochschildCochainComplexContext | null;
  ambiguityGroupsByOrientation: Record<PathOrientation, AmbiguityDegreeGroup[]> | null;
  hochschildCochainComplex: HochschildCochainComplex | null;
  hochschildComplex: HochschildComplexDisplayData | null;
  expandedHochschildDifferentials: Set<number>;
  selectedAmbiguityId: string | null;
  selectedHochschildBasisId: string | null;
  selectedHochschildRepresentativeId: string | null;
  relationPanelTab: RelationPanelTab;
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
    activeFieldCharacteristic: 0,
    monomialComputationContext: null,
    ambiguityGroupsByOrientation: null,
    hochschildCochainComplex: null,
    hochschildComplex: null,
    expandedHochschildDifferentials: new Set(),
    selectedAmbiguityId: null,
    selectedHochschildBasisId: null,
    selectedHochschildRepresentativeId: null,
    relationPanelTab: "relations"
  };
}

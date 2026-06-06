import type { PathOrientation } from "../backend/paths";
import type { Quiver } from "../backend/quiver";
import {
  DEFAULT_MAX_PATH_LENGTH,
  pathFromArrowIdsL2R,
  relationFromL2R,
  type MonomialAlgebraInput,
  type MonomialRelation
} from "../backend/monomial-algebra";

export interface CytoscapeElementData {
  group?: "nodes" | "edges";
  data: {
    id: string;
    label?: string;
    source?: string;
    target?: string;
  };
}

export interface RelationPath {
  id?: string;
  arrows: string[];
}

export function cytoscapeToQuiver(cyData: CytoscapeElementData[]): Quiver {
  return {
    vertices: cyData
      .filter((element) => element.group === "nodes" || (!element.data.source && !element.data.target))
      .map((node) => ({
        id: node.data.id,
        label: node.data.label
      })),
    arrows: cyData
      .filter((element) => element.group === "edges" || (element.data.source !== undefined && element.data.target !== undefined))
      .map((edge) => {
        if (!edge.data.source || !edge.data.target) {
          throw new Error(`Cytoscape edge '${edge.data.id}' is missing source or target.`);
        }
        return {
          id: edge.data.id,
          source: edge.data.source,
          target: edge.data.target,
          label: edge.data.label ?? edge.data.id
        };
      })
  };
}

export function relationPathsToRelations(
  quiver: Quiver,
  relations: RelationPath[],
  activeOrientation: PathOrientation
): MonomialRelation[] {
  return relations.map((relation, index) => {
    const pathL2R = pathFromArrowIdsL2R(quiver, relation.arrows);
    return relationFromL2R(relation.id ?? `r${index + 1}`, pathL2R, activeOrientation);
  });
}

export function cytoscapeToMonomialInput(
  cyData: CytoscapeElementData[],
  relations: RelationPath[],
  activeOrientation: PathOrientation,
  maxPathLength = DEFAULT_MAX_PATH_LENGTH
): MonomialAlgebraInput {
  const quiver = cytoscapeToQuiver(cyData);
  return {
    quiver,
    relations: relationPathsToRelations(quiver, relations, activeOrientation),
    activeOrientation,
    maxPathLength
  };
}

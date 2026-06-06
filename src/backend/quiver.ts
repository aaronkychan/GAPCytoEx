export type VertexId = string;
export type ArrowId = string;

export interface Vertex {
  id: VertexId;
  label?: string;
}

export interface Arrow {
  id: ArrowId;
  source: VertexId;
  target: VertexId;
  label: string;
}

export interface Quiver {
  vertices: Vertex[];
  arrows: Arrow[];
}

export function arrowById(quiver: Quiver, arrowId: ArrowId): Arrow | undefined {
  return quiver.arrows.find((arrow) => arrow.id === arrowId);
}

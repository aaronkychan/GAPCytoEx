import type { ArrowId, VertexId } from "./quiver";

export type PathOrientation = "L2R" | "R2L";

export interface Path {
    arrows: ArrowId[];
    source: VertexId;
    target: VertexId;
    orientation: PathOrientation;
}

export function vertexPath(
    vertexId: VertexId,
    orientation: PathOrientation,
): Path {
    return {
        arrows: [],
        source: vertexId,
        target: vertexId,
        orientation,
    };
}

export function printPath(path: Path): string {
    return `(${path.orientation})${path.arrows.join("*")}:${path.source}~>${path.target}`;
}

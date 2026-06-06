import type { Path, PathOrientation } from "./paths";

export function oppositeOrientation(orientation: PathOrientation): PathOrientation {
  return orientation === "L2R" ? "R2L" : "L2R";
}

export function reverseOrientation(path: Path): Path {
  return {
    ...path,
    arrows: [...path.arrows].reverse(),
    orientation: oppositeOrientation(path.orientation)
  };
}

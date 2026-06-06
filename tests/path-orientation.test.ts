import { expect, test } from "bun:test";
import {
  relationFromL2R,
  normalizeOrientedInput,
  pathFromArrowIdsL2R
} from "../src/backend/monomial-algebra";
import { reverseOrientation } from "../src/backend/path-orientation";
import type { Path } from "../src/backend/paths";
import type { Quiver } from "../src/backend/quiver";
import { cytoscapeToMonomialInput } from "../src/frontend/cytoscape-adapter";
import {
  reverseOrientationOfAmbiguity,
  underlyingPathOfAmbiguity,
  type Ambiguity
} from "../src/backend/ambiguities";

test("reverseOrientation reverses word order without swapping source or target", () => {
  const path: Path = {
    arrows: ["a", "b", "c"],
    source: "v1",
    target: "v4",
    orientation: "L2R"
  };

  expect(reverseOrientation(path)).toEqual({
    arrows: ["c", "b", "a"],
    source: "v1",
    target: "v4",
    orientation: "R2L"
  });
});

test("reverseOrientation is an involution", () => {
  const path: Path = {
    arrows: ["x", "y"],
    source: "s",
    target: "t",
    orientation: "R2L"
  };

  expect(reverseOrientation(reverseOrientation(path))).toEqual(path);
});

test("reverseOrientationOfAmbiguity reverses piece order and preserves path under double reversal", () => {
  const ambiguity: Ambiguity = {
    n: 1,
    orientation: "R2L",
    kind: "left",
    pieces: [
      { arrows: [], source: "v1", target: "v1", orientation: "R2L" },
      { arrows: ["b"], source: "v1", target: "v2", orientation: "R2L" },
      { arrows: ["d", "c"], source: "v2", target: "v4", orientation: "R2L" }
    ]
  };

  const reversed = reverseOrientationOfAmbiguity(ambiguity);

  expect(reversed.kind).toBe("right");
  expect(reversed.orientation).toBe("L2R");
  expect(reversed.pieces.map((piece) => piece.arrows)).toEqual([["c", "d"], ["b"], []]);
  expect(reversed.pieces.map((piece) => piece.orientation)).toEqual(["L2R", "L2R", "L2R"]);
  expect(reverseOrientationOfAmbiguity(reversed)).toEqual(ambiguity);
  expect(underlyingPathOfAmbiguity(reverseOrientationOfAmbiguity(reversed))).toEqual(underlyingPathOfAmbiguity(ambiguity));
});

test("relations keep L2R and R2L copies", () => {
  const path: Path = {
    arrows: ["a", "b"],
    source: "x",
    target: "z",
    orientation: "L2R"
  };

  const relation = relationFromL2R("r1", path, "R2L");
  expect(relation.path.arrows).toEqual(["b", "a"]);
  expect(relation.pathL2R.arrows).toEqual(["a", "b"]);
  expect(relation.pathR2L.arrows).toEqual(["b", "a"]);
});

test("normalizeOrientedInput rejects maxPathLength below 20", () => {
  expect(() =>
    normalizeOrientedInput({
      quiver: { vertices: [], arrows: [] },
      relations: [],
      activeOrientation: "L2R",
      maxPathLength: 19
    })
  ).toThrow("maxPathLength");
});

test("normalizeOrientedInput defaults maxPathLength to 50", () => {
  const normalized = normalizeOrientedInput({
    quiver: { vertices: [], arrows: [] },
    relations: [],
    activeOrientation: "L2R"
  });

  expect(normalized.maxPathLength).toBe(50);
});

test("pathFromArrowIdsL2R rejects non-composable relation paths", () => {
  const quiver: Quiver = {
    vertices: [{ id: "x" }, { id: "y" }, { id: "z" }],
    arrows: [
      { id: "a", source: "x", target: "y", label: "a" },
      { id: "b", source: "x", target: "z", label: "b" }
    ]
  };

  expect(() => pathFromArrowIdsL2R(quiver, ["a", "b"])).toThrow("not composable");
});

test("cytoscapeToMonomialInput stores both relation orientations from arrow IDs", () => {
  const input = cytoscapeToMonomialInput(
    [
      { group: "nodes", data: { id: "v1" } },
      { group: "nodes", data: { id: "v2" } },
      { group: "nodes", data: { id: "v3" } },
      { group: "edges", data: { id: "a", source: "v1", target: "v2" } },
      { group: "edges", data: { id: "b", source: "v2", target: "v3" } }
    ],
    [{ id: "r1", arrows: ["a", "b"] }],
    "R2L"
  );

  expect(input.maxPathLength).toBe(50);
  expect(input.relations[0].path.arrows).toEqual(["b", "a"]);
  expect(input.relations[0].pathL2R.arrows).toEqual(["a", "b"]);
  expect(input.relations[0].pathR2L.arrows).toEqual(["b", "a"]);
});

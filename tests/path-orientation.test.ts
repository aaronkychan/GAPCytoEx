import { expect, test } from "bun:test";
import { relationFromL2R, normalizeOrientedInput } from "../src/backend/monomial-algebra";
import { reverseOrientation } from "../src/backend/path-orientation";
import type { Path } from "../src/backend/paths";

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

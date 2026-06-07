import { expect, test } from "bun:test";
import {
  checkLengthOneTermsInRelations,
  checkRelationsAreMonomial,
  enumerateAdmissiblePaths,
  MonomialAlgebraError,
  relationFromL2R,
  pathFromArrowIdsL2R,
  tidyUpMonomialAlgebra,
  tidyUpRelationDataAlgebra
} from "../src/backend/monomial-algebra";
import { reverseOrientation } from "../src/backend/path-orientation";
import type { Path } from "../src/backend/paths";
import type { Quiver } from "../src/backend/quiver";
import { cytoscapeToMonomialInput } from "../src/frontend/cytoscape-adapter";
import { formatRelationData } from "../src/backend/relations";
import {
  computeAmbiguities,
  computeLeftAmbiguitiesR2L,
  computeRightAmbiguitiesL2R,
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

test("relations store one canonical L2R path", () => {
  const path: Path = {
    arrows: ["a", "b"],
    source: "x",
    target: "z",
    orientation: "L2R"
  };

  const relation = relationFromL2R("r1", path);
  expect(relation.path.arrows).toEqual(["a", "b"]);
  expect(reverseOrientation(relation.path).arrows).toEqual(["b", "a"]);
});

test("tidyUpMonomialAlgebra rejects maxPathLength below 20", () => {
  expect(() =>
    tidyUpMonomialAlgebra({
      quiver: { vertices: [], arrows: [] },
      relations: [],
      activeOrientation: "L2R",
      maxPathLength: 19
    })
  ).toThrow("maxPathLength");
});

test("tidyUpMonomialAlgebra defaults maxPathLength to 50", () => {
  const verified = tidyUpMonomialAlgebra({
    quiver: { vertices: [], arrows: [] },
    relations: [],
    activeOrientation: "L2R"
  });

  expect(verified.maxPathLength).toBe(50);
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

test("tidyUpMonomialAlgebra validation errors include the problematic path", () => {
  const quiver: Quiver = {
    vertices: [{ id: "x" }, { id: "y" }],
    arrows: [{ id: "a", source: "x", target: "y", label: "a" }]
  };
  const relation = relationFromL2R("short", { arrows: ["a"], source: "x", target: "y", orientation: "L2R" });

  expect(() =>
    tidyUpMonomialAlgebra({
      quiver,
      relations: [relation],
      activeOrientation: "L2R"
    })
  ).toThrow("a");
});

test("cytoscapeToMonomialInput stores canonical relation paths from arrow IDs", () => {
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
  expect(input.relations[0].path.arrows).toEqual(["a", "b"]);
  expect(reverseOrientation(input.relations[0].path).arrows).toEqual(["b", "a"]);
});

test("checkLengthOneTermsInRelations warns without changing relation terms", () => {
  const relations = [
    {
      reln: "a+b*c",
      terms: [
        { scalar: "", monomial: ["a"] },
        { scalar: "", monomial: ["b", "c"] }
      ]
    }
  ];

  const logs = checkLengthOneTermsInRelations(relations);

  expect(logs).toHaveLength(1);
  expect(logs[0].message).toContain("There exists redundant arrow");
  expect(logs[0].message).toContain("a+b·c");
  expect(relations[0].terms[0].monomial).toEqual(["a"]);
});

test("formatRelationData matches relation panel display convention", () => {
  const relation = {
    reln: "a-b*c",
    terms: [
      { scalar: "", monomial: ["a"] },
      { scalar: "-", monomial: ["b", "c"] }
    ]
  };

  expect(formatRelationData(relation, "L2R")).toBe("a-b·c");
  expect(formatRelationData(relation, "R2L")).toBe("a-c·b");
});

test("checkRelationsAreMonomial rejects linear-combination relations", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }, { id: "v5" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v2", target: "v3", label: "b" },
      { id: "c", source: "v1", target: "v4", label: "c" },
      { id: "d", source: "v4", target: "v5", label: "d" }
    ]
  };

  const result = checkRelationsAreMonomial({
    quiver,
    activeOrientation: "L2R",
    relations: [
      { reln: "a*b", terms: [{ monomial: ["a", "b"] }] },
      {
        reln: "a*b+c*d",
        terms: [
          { monomial: ["a", "b"] },
          { monomial: ["c", "d"] }
        ]
      },
      { reln: "0", terms: [] }
    ]
  });

  expect(result.ok).toBe(false);
  expect(result.logs.some((entry) => entry.relationId === "a*b+c*d")).toBe(true);
});

test("checkRelationsAreMonomial eliminates redundant arrows for algebra input", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v1", target: "v3", label: "b" },
      { id: "c", source: "v3", target: "v2", label: "c" }
    ]
  };

  const result = checkRelationsAreMonomial({
    quiver,
    activeOrientation: "L2R",
    relations: [
      {
        reln: "a-b*c",
        terms: [
          { scalar: "", monomial: ["a"] },
          { scalar: "-", monomial: ["b", "c"] }
        ]
      }
    ]
  });

  expect(result.ok).toBe(true);
  expect(result.quiver.arrows.map((arrow) => arrow.id)).toEqual(["b", "c"]);
  expect(result.relations).toEqual([]);
  expect(result.logs.some((entry) => entry.message.includes("Removed redundant arrow 'a'"))).toBe(true);
});

test("checkRelationsAreMonomial treats the second length-one term as the replacement path", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v1", target: "v2", label: "b" },
      { id: "c", source: "v2", target: "v3", label: "c" }
    ]
  };

  const result = checkRelationsAreMonomial({
    quiver,
    activeOrientation: "L2R",
    relations: [
      {
        reln: "a-b",
        terms: [
          { scalar: "", monomial: ["a"] },
          { scalar: "-", monomial: ["b"] }
        ]
      },
      { reln: "a*c", terms: [{ scalar: "", monomial: ["a", "c"] }] }
    ]
  });

  expect(result.ok).toBe(true);
  expect(result.quiver.arrows.map((arrow) => arrow.id)).toEqual(["b", "c"]);
  expect(result.relations.map((relation) => relation.terms?.[0]?.monomial)).toEqual([["b", "c"]]);
  expect(result.logs.some((entry) => entry.message.includes("replacing arrow 'a' with path 'b'"))).toBe(true);
});

test("checkRelationsAreMonomial removes a length-one monomial relation and relations containing that arrow", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v2", target: "v3", label: "b" },
      { id: "c", source: "v3", target: "v4", label: "c" }
    ]
  };

  const result = checkRelationsAreMonomial({
    quiver,
    activeOrientation: "L2R",
    relations: [
      { reln: "a", terms: [{ scalar: "", monomial: ["a"] }] },
      { reln: "a*b", terms: [{ scalar: "", monomial: ["a", "b"] }] },
      { reln: "b*c", terms: [{ scalar: "", monomial: ["b", "c"] }] }
    ]
  });

  expect(result.ok).toBe(true);
  expect(result.quiver.arrows.map((arrow) => arrow.id)).toEqual(["b", "c"]);
  expect(result.relations.map((relation) => relation.reln)).toEqual(["b*c"]);
  expect(result.logs.some((entry) => entry.message.includes("removed 2 relation(s) containing that arrow"))).toBe(true);
});

test("tidyUpMonomialAlgebra removes duplicates and paths containing smaller generators", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v2", target: "v3", label: "b" },
      { id: "c", source: "v3", target: "v4", label: "c" }
    ]
  };
  const ab = relationFromL2R("ab", pathFromArrowIdsL2R(quiver, ["a", "b"]));
  const abDuplicate = relationFromL2R("ab2", pathFromArrowIdsL2R(quiver, ["a", "b"]));
  const abc = relationFromL2R("abc", pathFromArrowIdsL2R(quiver, ["a", "b", "c"]));

  const result = tidyUpMonomialAlgebra({
    quiver,
    relations: [ab, abDuplicate, abc],
    activeOrientation: "L2R"
  });

  expect(result.originalRelations.map((relation) => relation.id)).toEqual(["ab", "ab2", "abc"]);
  expect(result.minimisedRelations.map((relation) => relation.id)).toEqual(["ab"]);
  expect(result.logs.map((entry) => entry.removedRelationId)).toEqual(["ab2", "abc"]);
});

test("enumerateAdmissiblePaths internally minimises relations and excludes relation divisors", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v2", target: "v3", label: "b" },
      { id: "c", source: "v3", target: "v4", label: "c" }
    ]
  };
  const ab = relationFromL2R("ab", pathFromArrowIdsL2R(quiver, ["a", "b"]));
  const abc = relationFromL2R("abc", pathFromArrowIdsL2R(quiver, ["a", "b", "c"]));

  const result = enumerateAdmissiblePaths({
    quiver,
    relations: [abc, ab],
    activeOrientation: "L2R",
    maxPathLength: 20
  });

  expect(result.relationGenerators.minimisedRelations.map((relation) => relation.id)).toEqual(["ab"]);
  expect(result.logs.some((entry) => entry.removedRelationId === "abc")).toBe(true);
  expect(result.paths.map((path) => path.arrows)).toContainEqual([]);
  expect(result.paths.map((path) => path.arrows)).toContainEqual(["a"]);
  expect(result.paths.map((path) => path.arrows)).toContainEqual(["b", "c"]);
  expect(result.paths.map((path) => path.arrows)).not.toContainEqual(["a", "b"]);
  expect(result.finiteDimensionalityConfirmed).toBe(true);
});

test("tidyUpRelationDataAlgebra removes a redundant arrow and substitutes its monomial replacement", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v1", target: "v3", label: "b" },
      { id: "c", source: "v3", target: "v2", label: "c" },
      { id: "d", source: "v2", target: "v4", label: "d" }
    ]
  };

  const result = tidyUpRelationDataAlgebra({
    quiver,
    activeOrientation: "L2R",
    relations: [
      {
        reln: "a-b*c",
        terms: [
          { scalar: "", monomial: ["a"] },
          { scalar: "-", monomial: ["b", "c"] }
        ]
      },
      { reln: "a*d", terms: [{ scalar: "", monomial: ["a", "d"] }] }
    ]
  });

  expect(result.quiver.arrows.map((arrow) => arrow.id)).toEqual(["b", "c", "d"]);
  expect(result.minimisedRelations.map((relation) => relation.path.arrows)).toEqual([["b", "c", "d"]]);
  expect(result.logs.some((entry) => entry.message.includes("Removed redundant arrow 'a'"))).toBe(true);
});

test("tidyUpRelationDataAlgebra rejects redundant-arrow replacement that makes relations non-monomial", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v1", target: "v3", label: "b" },
      { id: "c", source: "v3", target: "v2", label: "c" },
      { id: "d", source: "v1", target: "v4", label: "d" },
      { id: "e", source: "v4", target: "v2", label: "e" }
    ]
  };

  expect(() =>
    tidyUpRelationDataAlgebra({
      quiver,
      activeOrientation: "L2R",
      relations: [
        {
          reln: "a+b*c+d*e",
          terms: [
            { scalar: "", monomial: ["a"] },
            { scalar: "", monomial: ["b", "c"] },
            { scalar: "", monomial: ["d", "e"] }
          ]
        }
      ]
    })
  ).toThrow(MonomialAlgebraError);
});

test("tidyUpRelationDataAlgebra ignores scalars when eliminating redundant arrows for monomial checks", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v1", target: "v3", label: "b" },
      { id: "c", source: "v3", target: "v2", label: "c" }
    ]
  };

  const result = tidyUpRelationDataAlgebra({
    quiver,
    activeOrientation: "L2R",
    fieldCharacteristic: 5,
    relations: [
      {
        reln: "2*a+b*c",
        terms: [
          { scalar: "2", monomial: ["a"] },
          { scalar: "", monomial: ["b", "c"] }
        ]
      }
    ]
  });

  expect(result.quiver.arrows.map((arrow) => arrow.id)).toEqual(["b", "c"]);
  expect(result.logs.some((entry) => entry.message.includes("replaced occurrences by path 'b*c'"))).toBe(true);
});

test("enumerateAdmissiblePaths reports when maxPathLength stops a possible extension", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v" }],
    arrows: [{ id: "a", source: "v", target: "v", label: "a" }]
  };

  const result = enumerateAdmissiblePaths({
    quiver,
    relations: [],
    activeOrientation: "L2R",
    maxPathLength: 20
  });

  expect(result.reachedMaxPathLength).toBe(true);
  expect(result.finiteDimensionalityConfirmed).toBe(false);
  expect(result.logs.some((entry) => entry.message.includes("finite-dimensionality"))).toBe(true);
});

test("computeLeftAmbiguitiesR2L stores target vertex as u minus one", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }],
    arrows: [{ id: "a", source: "v1", target: "v2", label: "a" }]
  };
  const verified = tidyUpMonomialAlgebra({
    quiver,
    relations: [],
    activeOrientation: "R2L",
    maxPathLength: 20
  });

  const gamma0 = computeLeftAmbiguitiesR2L(verified).getAt(0);

  expect(gamma0).toHaveLength(1);
  expect(gamma0[0].pieces.map((piece) => piece.arrows)).toEqual([[], ["a"]]);
  expect(gamma0[0].pieces[0].source).toBe("v2");
  expect(underlyingPathOfAmbiguity(gamma0[0])).toEqual({
    arrows: ["a"],
    source: "v1",
    target: "v2",
    orientation: "R2L"
  });
});

test("compute ambiguity sequences agree after reversing orientation", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }, { id: "v5" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v2", target: "v3", label: "b" },
      { id: "c", source: "v3", target: "v4", label: "c" },
      { id: "d", source: "v4", target: "v5", label: "d" },
      { id: "e", source: "v5", target: "v1", label: "e" }
    ]
  };
  const verified = tidyUpMonomialAlgebra({
    quiver,
    relations: [
      relationFromL2R("abc", pathFromArrowIdsL2R(quiver, ["a", "b", "c"])),
      relationFromL2R("cde", pathFromArrowIdsL2R(quiver, ["c", "d", "e"]))
    ],
    activeOrientation: "R2L",
    maxPathLength: 20
  });

  const leftGamma2 = computeLeftAmbiguitiesR2L(verified).getAt(2);
  const rightGamma2 = computeRightAmbiguitiesL2R(verified).getAt(2);

  expect(leftGamma2.map((ambiguity) => underlyingPathOfAmbiguity(ambiguity).arrows)).toContainEqual(["e", "d", "c", "b", "a"]);
  expect(leftGamma2.some((ambiguity) => ambiguity.pieces.some((piece) => piece.arrows.length > 1))).toBe(true);
  expect(rightGamma2.map((ambiguity) => underlyingPathOfAmbiguity(ambiguity).arrows)).toContainEqual(["a", "b", "c", "d", "e"]);
  expect(leftGamma2.map((ambiguity) => reverseOrientationOfAmbiguity(ambiguity).pieces.map((piece) => piece.arrows))).toContainEqual([["a"], ["b", "c", "d", "e"], []]);
});

test("computeAmbiguities reports no warning when R2L and L2R conventions agree", () => {
  const quiver: Quiver = {
    vertices: [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }, { id: "v5" }],
    arrows: [
      { id: "a", source: "v1", target: "v2", label: "a" },
      { id: "b", source: "v2", target: "v3", label: "b" },
      { id: "c", source: "v3", target: "v4", label: "c" },
      { id: "d", source: "v4", target: "v5", label: "d" },
      { id: "e", source: "v5", target: "v1", label: "e" }
    ]
  };

  const result = computeAmbiguities({
    quiver,
    relations: [
      relationFromL2R("abc", pathFromArrowIdsL2R(quiver, ["a", "b", "c"])),
      relationFromL2R("cde", pathFromArrowIdsL2R(quiver, ["c", "d", "e"]))
    ],
    activeOrientation: "R2L",
    maxPathLength: 20
  });

  expect(result.warnings).toEqual([]);
  expect(result.primaryLeftR2L.getAt(2)).not.toHaveLength(0);
  expect(result.checkRightL2R.getAt(2)).not.toHaveLength(0);
});

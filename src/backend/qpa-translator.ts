import type { ArrowId, Quiver, VertexId } from "./quiver";
import {
    formatRelationData,
    type RelationData,
} from "./relations";

export interface CytoscapeElementData {
    group: "nodes" | "edges";
    data: {
        id: string;
        label?: string;
        source?: string;
        target?: string;
    };
    position?: {
        x: number;
        y: number;
    };
}

export interface QpaParseOptions {
    forceVertexIds: boolean;
    forceArrowIds: boolean;
}

export interface QpaParseResult {
    elements: CytoscapeElementData[];
    relations: RelationData[];
    characteristic: number;
}

const letters = [...Array(52).keys()].map((index) =>
    String.fromCharCode(97 + (index % 26) + (index < 26 ? 0 : -32)),
);
const primes = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61,
];
const generators = [1, 2, 2, 3, 2, 2, 3, 2, 5, 2, 3, 2, 6, 3, 5, 2, 2, 2];

export function generatedArrowName(index: number): string {
    const base = letters[index % 52];
    return (
        base +
        Array(Math.trunc(index / 52 + 1))
            .fill("")
            .reduce((previous) => `${previous}^`)
    );
}

function stripLineBreaksAndSpaces(value: string): string {
    return value.replace(/(\\\r\n|\\\r|\\\n)/, "").replace(/\s+/g, "");
}

function matchDeepestBrackets(value: string): RegExpMatchArray | null {
    return value.match(/\[([^\[\]])*\]/g);
}

function isPowerOfPrime(value: number): [number, number] {
    for (const prime of primes) {
        if (value === prime) {
            return [prime, 1];
        }
        const exponent = Math.log(value) / Math.log(prime);
        if (exponent % 1 === 0) {
            return [prime, exponent];
        }
    }
    return [0, 0];
}

export function findFieldCharacteristic(scalar: string): number {
    return scalar[1] === "Z"
        ? isPowerOfPrime(
              Number.parseInt(scalar.slice(3, scalar.indexOf(")")), 10),
          )[0]
        : 0;
}

function complexNumberText(value: string): string {
    if (value.includes("/")) {
        return value;
    }
    if (value.includes(".")) {
        return value;
    }
    if (value.includes("i")) {
        return value;
    }
    return value.includes("(") ? value.slice(1, -1) : value;
}

export function translateScalar(
    rawScalar: string,
    characteristic: number,
): string {
    if (characteristic < 0) {
        return rawScalar;
    }
    if (characteristic === 0) {
        const scalar = complexNumberText(rawScalar);
        if (scalar[0] !== "(") {
            if (scalar === "+1" || scalar === "1") {
                return "";
            }
            return scalar === "-1" ? "-" : scalar;
        }
        return scalar;
    }

    const exponentMarker = rawScalar.indexOf("^");
    const exponent =
        exponentMarker !== -1 ? rawScalar.slice(exponentMarker + 1, -1) : "1";
    if (exponent === "0") {
        return "";
    }
    const result = Math.pow(
        generators[primes.indexOf(characteristic)],
        Number.parseInt(exponent, 10),
    );
    return result === characteristic - 1 ? "-" : `${result}`;
}

function splitRelationTerms(relationInput: string): string[] {
    const terms: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < relationInput.length; index += 1) {
        const char = relationInput[index];
        if (char === "(") {
            depth += 1;
        }
        if (char === ")") {
            depth = Math.max(0, depth - 1);
        }
        if ((char === "+" || char === "-") && depth === 0 && index > start) {
            terms.push(relationInput.slice(start, index));
            start = index;
        }
    }
    terms.push(relationInput.slice(start));
    return terms.filter((term) => term !== "");
}

function parseRelationTerm(termInput: string): {
    scalarRaw: string;
    generators: string[];
} {
    let term = termInput.trim();
    let leadingSign = "";
    if (term[0] === "+" || term[0] === "-") {
        leadingSign = term[0];
        term = term.slice(1);
    }

    const explicitScalar = term.match(/^\((.*?)\)\*(.*)$/);
    if (explicitScalar) {
        const scalar =
            leadingSign === "-" && !explicitScalar[1].startsWith("-")
                ? `-${explicitScalar[1]}`
                : explicitScalar[1];
        return {
            scalarRaw: scalar,
            generators: explicitScalar[2].split("*"),
        };
    }

    return {
        scalarRaw: leadingSign === "-" ? "-1" : "+1",
        generators: term.split("*"),
    };
}

export function parseRelationData(
    relationInput: string,
    generatorReference: string[],
    fieldCharacteristic: number,
    options: QpaParseOptions,
): RelationData {
    const relation: RelationData = {
        reln: "",
        terms: [],
        fieldChar: fieldCharacteristic,
    };

    for (const termInput of splitRelationTerms(relationInput)) {
        const { scalarRaw, generators: termGenerators } =
            parseRelationTerm(termInput);
        if (
            !termGenerators.length ||
            termGenerators.some((generator) => generator === "")
        ) {
            throw new Error(
                `Relation string ${relationInput}, term ${termInput} is of invalid format.`,
            );
        }

        if (relation.fieldChar === -1) {
            relation.fieldChar = findFieldCharacteristic(scalarRaw);
        }

        relation.terms?.push({
            scalar: translateScalar(scalarRaw, relation.fieldChar ?? 0),
            monomial: termGenerators.map((generator) => {
                const index = generatorReference.indexOf(generator);
                return index !== -1
                    ? options.forceArrowIds
                        ? generatedArrowName(index)
                        : generator
                    : generator;
            }),
        });
    }

    relation.reln = formatRelationData(relation);
    return relation;
}

export function splitRelationEntries(relationInput: string): string[] {
    return relationInput
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry !== "");
}

export function parseRelationList(
    relationInput: string,
    quiver: [VertexId[], [VertexId, VertexId, ArrowId][]],
    options: QpaParseOptions,
): { relations: RelationData[]; characteristic: number } {
    const arrowNames = quiver[1].map((arrow) => arrow[2]);
    const entries = relationInput
        .replace(/(\\\r\n|\\\r|\\\n)/g, "")
        .replace(/[\s\[\]]/g, "")
        .split(",")
        .filter(
            (entry, index, list) =>
                !(list.length === 1 && index === 0 && entry === ""),
        );

    const relations: RelationData[] = [];
    let characteristic = -1;
    for (const entry of entries) {
        const relation = parseRelationData(
            entry,
            arrowNames,
            characteristic,
            options,
        );
        relations.push(relation);
        characteristic =
            characteristic === -1 ? (relation.fieldChar ?? 0) : characteristic;
    }

    relations.sort((left, right) => {
        if (
            (left.terms?.length ?? 0) === 1 &&
            (right.terms?.length ?? 0) === 1
        ) {
            const leftScalar = left.terms?.[0]?.scalar ?? "";
            const rightScalar = right.terms?.[0]?.scalar ?? "";
            return leftScalar > "0" ? (rightScalar > "0" ? 0 : -1) : 1;
        }
        return (left.terms?.length ?? 0) - (right.terms?.length ?? 0);
    });

    return {
        relations,
        characteristic: characteristic === -1 ? 0 : characteristic,
    };
}

export function parseRelationEntries(
    relationInput: string,
    quiver: [VertexId[], [VertexId, VertexId, ArrowId][]],
    options: QpaParseOptions,
): { relations: RelationData[]; characteristic: number } {
    const entries = splitRelationEntries(relationInput);
    return parseRelationList(entries.join(","), quiver, options);
}

export function parseSingleRelation(
    relationInput: string,
    quiver: [VertexId[], [VertexId, VertexId, ArrowId][]],
    options: QpaParseOptions,
): RelationData {
    const { relations } = parseRelationList(
        relationInput.trim(),
        quiver,
        options,
    );
    if (relations.length !== 1) {
        throw new Error("Please enter exactly one relation.");
    }
    return relations[0];
}

export function splitQuiverAndRelationInput(input: string): [string, string] {
    const deepest = matchDeepestBrackets(input);
    if (!deepest) {
        return [input, ""];
    }
    const levelTwoStart = input.search(/\[\s*\[/);
    const levelTwoEnd = input.search(/\]\s*\]/);
    const levelTwoMatch = input.match(/\]\s*\]/);
    if (levelTwoStart === -1 || levelTwoEnd === -1 || !levelTwoMatch) {
        return [input, ""];
    }
    const levelTwoCount =
        matchDeepestBrackets(
            input.slice(
                levelTwoStart + 1,
                levelTwoEnd + levelTwoMatch[0].length - 1,
            ),
        )?.length ?? 0;
    const relationStart =
        deepest.length - levelTwoCount === 2
            ? input.search(/\[([^\[\]])*\]\s*$/)
            : input.length;
    return [input.slice(0, relationStart), input.slice(relationStart)];
}

export function parseQpaInput(
    input: string,
    fallbackRelationInput: string,
    options: QpaParseOptions,
): QpaParseResult {
    const [quiverInput, relationInputFromQuiver] =
        splitQuiverAndRelationInput(input);
    let quiverJson = stripLineBreaksAndSpaces(quiverInput)
        .replace(/(\r\n|\n|\r)/g, "")
        .replace(/\\/g, "")
        .replace(/;/g, "");
    quiverJson = quiverJson
        .replace(/^(\s*)Quiver(\(*)/, "")
        .replace(/\)(\s*)$/, "");

    if (quiverJson[0] !== "[") {
        const vertexCount = Number.parseInt(quiverJson.split(",", 1)[0], 10);
        if (vertexCount > 0) {
            const vertices = Array.from(
                { length: vertexCount },
                (_, index) => index + 1,
            );
            quiverJson =
                JSON.stringify(vertices) +
                quiverJson.slice(quiverJson.indexOf(","));
        }
    }

    const quiverQpa = JSON.parse(`[${quiverJson}]`) as [
        Array<string | number>,
        [string | number, string | number, string][],
    ];
    if (quiverQpa[0].length > 70) {
        throw new Error("More than 70 vertices! Abort translation.");
    }

    const vertexIds = quiverQpa[0].map((vertex, index) =>
        options.forceVertexIds ? `${index + 1}` : `${vertex}`.replace(/"/g, ""),
    );
    const vertices: CytoscapeElementData[] = vertexIds.map((id) => ({
        group: "nodes",
        data: { id },
    }));
    const arrows: CytoscapeElementData[] = quiverQpa[1].map((arrow, index) => {
        const label = options.forceArrowIds
            ? generatedArrowName(index)
            : arrow[2];
        return {
            group: "edges",
            data: {
                id: label,
                source: options.forceVertexIds
                    ? `${quiverQpa[0].indexOf(arrow[0]) + 1}`
                    : `${arrow[0]}`,
                target: options.forceVertexIds
                    ? `${quiverQpa[0].indexOf(arrow[1]) + 1}`
                    : `${arrow[1]}`,
                label,
            },
        };
    });

    const relationSource =
        relationInputFromQuiver === ""
            ? fallbackRelationInput
            : relationInputFromQuiver;
    const relationQuiver: [VertexId[], [VertexId, VertexId, ArrowId][]] = [
        quiverQpa[0].map((vertex) => `${vertex}`),
        quiverQpa[1].map((arrow) => [`${arrow[0]}`, `${arrow[1]}`, arrow[2]]),
    ];
    const { relations, characteristic } = parseRelationList(
        relationSource,
        relationQuiver,
        options,
    );

    return {
        elements: [...vertices, ...arrows],
        relations,
        characteristic,
    };
}

export function quiverFromCytoscape(cyInstance: {
    nodes: () => Array<{ id: () => string }>;
    edges: () => Array<{ data: (key: string) => string; id: () => string }>;
}): [VertexId[], [VertexId, VertexId, ArrowId][]] {
    return [
        cyInstance.nodes().map((node) => node.id()),
        cyInstance
            .edges()
            .map((edge) => [
                edge.data("source"),
                edge.data("target"),
                edge.id(),
            ]),
    ];
}

export function exportQpa(
    elements: {
        nodes?: Array<{ data: { id: string } }>;
        edges?: Array<{
            data: {
                source: string;
                target: string;
                label?: string;
                id: string;
            };
        }>;
    },
    relations: RelationData[],
): string {
    const nodes = elements.nodes ?? [];
    const edges = elements.edges ?? [];
    const vertices = nodes.map((node) => node.data.id);
    const arrows = edges.map((edge) => {
        const { source, target, label, id } = edge.data;
        return `["${source}", "${target}", "${label ?? id}"]`;
    });
    const relationText = `[${relations.map((relation) => formatRelationData(relation, "L2R", "*")).join(", ")}]`;
    return `Q:=Quiver([${vertices.map((vertex) => `"${vertex}"`).join(", ")}], [${arrows.join(", ")}]);\nR:=${relationText};`;
}

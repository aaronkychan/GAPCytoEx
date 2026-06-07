import type { Path, PathOrientation } from "./paths";
import { reverseOrientation } from "./path-orientation";
import type { ArrowId, Quiver } from "./quiver";

export interface Monomial {
    scalar?: string;
    monomial: ArrowId[];
}

export interface RelationData {
    id?: string;
    reln?: string;
    fieldChar?: number;
    terms?: Monomial[];
}

export interface RelationDataAlgebraInput {
    quiver: Quiver;
    relations: RelationData[];
    activeOrientation: PathOrientation;
    maxPathLength?: number;
    fieldCharacteristic?: number;
}

export interface RelationGenerator {
    id: string;
    path: Path;
}

export function relationDisplayId(relation: RelationData, index: number): string {
    return relation.id ?? relation.reln ?? `relation ${index + 1}`;
}

export function formatRelationTerms(terms: Monomial[], join = "·"): string {
    return terms
        .map((term, index) => {
            const monomial = term.monomial.join(join);
            if (term.scalar === undefined || term.scalar === "") {
                return `${index === 0 ? "" : "+"}${monomial}`;
            }
            if (term.scalar === "-") {
                return `-${monomial}`;
            }
            const scalar = `${term.scalar}`;
            const sign = scalar.startsWith("-") || index === 0 ? "" : "+";
            return `${sign}${scalar}${join}${monomial}`;
        })
        .join("");
}

export function formatRelationData(
    relation: RelationData,
    orientation: PathOrientation = "L2R",
    join = "·",
): string {
    const terms = (relation.terms ?? []).map((term) => ({
        ...term,
        monomial:
            orientation === "R2L"
                ? [...term.monomial].reverse()
                : term.monomial,
    }));
    return formatRelationTerms(terms, join);
}

export function relationLogText(relation: RelationData, index: number): string {
    const formatted = formatRelationData(relation);
    const id = relationDisplayId(relation, index);
    return formatted ? `${id}: ${formatted}` : id;
}

export function scalarToInputScalar(scalar: string | undefined): string {
    if (scalar === undefined || scalar === "") {
        return "+1";
    }
    if (scalar === "-") {
        return "-1";
    }
    return `${scalar}`;
}

export function formatRelationDataForInput(relation: RelationData): string {
    return (relation.terms ?? [])
        .map((term, index) => {
            const scalar = scalarToInputScalar(term.scalar);
            const sign = index === 0 ? "" : "+";
            return `${sign}(${scalar})*${term.monomial.join("*")}`;
        })
        .join("");
}

export function formatRelationGenerator(
    relation: RelationGenerator,
    orientation: PathOrientation = "L2R",
    join = "·",
): string {
    const path =
        orientation === "L2R"
            ? relation.path
            : reverseOrientation(relation.path);
    return path.arrows.join(join);
}

export function relationArrowNames(relations: RelationData[]): Set<string> {
    return new Set(
        relations.flatMap((relation) =>
            (relation.terms ?? []).flatMap((term) => term.monomial),
        ),
    );
}

export function cloneRelationData(relations: RelationData[]): RelationData[] {
    return relations.map((relation) => ({
        ...relation,
        terms: relation.terms?.map((term) => ({
            ...term,
            monomial: [...term.monomial],
        })),
    }));
}

export function replaceArrowInWord(
    word: ArrowId[],
    arrowId: ArrowId,
    replacementPath: ArrowId[],
): ArrowId[] {
    const replaced: ArrowId[] = [];
    for (const arrow of word) {
        if (arrow === arrowId) {
            replaced.push(...replacementPath);
        } else {
            replaced.push(arrow);
        }
    }
    return replaced;
}

export function wordContainsArrow(word: ArrowId[], arrowId: ArrowId): boolean {
    return word.includes(arrowId);
}

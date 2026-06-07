import type { Path, PathOrientation } from "./paths";
import { printPath, vertexPath } from "./paths";
import { arrowById, printArrowWord, type ArrowId, type Quiver } from "./quiver";
import {
    cloneRelationData,
    formatRelationData,
    relationDisplayId,
    relationLogText,
    replaceArrowInWord,
    wordContainsArrow,
    type Monomial,
    type RelationData,
    type RelationDataAlgebraInput,
    type RelationGenerator,
} from "./relations";

export const DEFAULT_MAX_PATH_LENGTH = 50;
export const MIN_MAX_PATH_LENGTH = 20;

export interface MonomialAlgebraInput {
    quiver: Quiver;
    relations: RelationGenerator[];
    activeOrientation: PathOrientation;
    maxPathLength?: number;
}

export interface VerifiedMonomialAlgebra {
    quiver: Quiver;
    originalRelations: RelationGenerator[];
    minimisedRelations: RelationGenerator[];
    activeOrientation: PathOrientation;
    maxPathLength: number;
    logs: MonomialAlgebraLogEntry[];
}

export type MonomialAlgebraLogLevel = "info" | "warning";

export interface MonomialAlgebraLogEntry {
    level: MonomialAlgebraLogLevel;
    message: string;
    relationId?: string;
    keptRelationId?: string;
    removedRelationId?: string;
}

export interface RelationCheckResult {
    ok: boolean;
    logs: MonomialAlgebraLogEntry[];
}

export interface RelationDataMonomialCheckResult extends RelationCheckResult {
    quiver: Quiver;
    relations: RelationData[];
}

export interface AdmissiblePathEnumeration {
    paths: Path[];
    relationGenerators: VerifiedMonomialAlgebra;
    logs: MonomialAlgebraLogEntry[];
    reachedMaxPathLength: boolean;
    finiteDimensionalityConfirmed: boolean;
}

export class MonomialAlgebraError extends Error {
    logs: MonomialAlgebraLogEntry[];

    constructor(message: string, logs: MonomialAlgebraLogEntry[]) {
        super(message);
        this.name = "MonomialAlgebraError";
        this.logs = logs;
    }
}

export function relationFromL2R(id: string, path: Path): RelationGenerator {
    return {
        id,
        path: { ...path, orientation: "L2R" as const },
    };
}

export function pathFromArrowIdsL2R(quiver: Quiver, arrows: string[]): Path {
    if (arrows.length === 0) {
        throw new Error("Relation paths must contain at least two arrows.");
    }
    if (arrows.length === 1) {
        throw new Error("Relation paths must contain at least two arrows.");
    }

    return pathFromNonemptyArrowIdsL2R(quiver, arrows);
}

function pathFromNonemptyArrowIdsL2R(quiver: Quiver, arrows: string[]): Path {
    if (arrows.length === 0) {
        throw new Error("Arrow words must contain at least one arrow.");
    }
    const first = arrowById(quiver, arrows[0]);
    if (!first) {
        throw new Error(
            `Relation path references unknown arrow '${arrows[0]}'.`,
        );
    }

    let previous = first;
    for (const arrowId of arrows.slice(1)) {
        const next = arrowById(quiver, arrowId);
        if (!next) {
            throw new Error(
                `Relation path references unknown arrow '${arrowId}'.`,
            );
        }
        if (previous.target !== next.source) {
            throw new Error(
                `Relation path is not composable at '${previous.id}' followed by '${next.id}'.`,
            );
        }
        previous = next;
    }

    return {
        arrows: [...arrows],
        source: first.source,
        target: previous.target,
        orientation: "L2R",
    };
}

function relationGeneratorLogText(relation: RelationGenerator): string {
    const arrowWord = relation.path.arrows.join("*") || "<vertex path>";
    return `${relation.id}: ${arrowWord}`;
}

export function checkLengthOneTermsInRelations(
    relations: RelationData[],
): MonomialAlgebraLogEntry[] {
    const logs: MonomialAlgebraLogEntry[] = [];

    relations.forEach((relation, relationIndex) => {
        const relationId = relationDisplayId(relation, relationIndex);
        const redundant = arrowRedundantInfo(relation.terms ?? []);
        if (redundant) {
            const relationText = relationLogText(relation, relationIndex);
            logs.push({
                level: "warning",
                relationId,
                message: `There exists redundant arrow '${redundant.redundantArrow}' in relation '${relationText}'.`,
            });
        }
    });

    return logs;
}

export function checkRelationsAreMonomial(
    input: RelationDataAlgebraInput,
): RelationDataMonomialCheckResult {
    validateQuiver(input.quiver);
    const logs: MonomialAlgebraLogEntry[] = [];
    const tooManyTerms = countNonMonomialRelations(input.relations);
    if (tooManyTerms > 0) {
        logs.push({
            level: "warning",
            message: `${tooManyTerms} relation(s) have more than two terms, so the algebra is not monomial.`,
        });
        input.relations.forEach((relation, relationIndex) => {
            const termCount = relation.terms?.length ?? 0;
            if (termCount <= 2) {
                return;
            }
            const relationId = relationDisplayId(relation, relationIndex);
            const relationText = relationLogText(relation, relationIndex);
            logs.push({
                level: "warning",
                relationId,
                message: `Relation '${relationText}' has ${termCount} terms.`,
            });
        });
        return {
            ok: false,
            quiver: input.quiver,
            relations: cloneRelationData(input.relations),
            logs,
        };
    }

    const replaced = eliminateRedundantArrowRelations(input);
    removeRelationDataDivisors(replaced.relations, replaced.logs);

    logNonMonomialRelationCount(replaced.relations, replaced.logs);

    return {
        ok: !replaced.logs.some((log) => log.level === "warning"),
        ...replaced,
    };
}

export function validateQuiver(quiver: Quiver): void {
    const vertexIds = new Set<string>();
    for (const vertex of quiver.vertices) {
        if (vertexIds.has(vertex.id)) {
            throw new Error(`Duplicate vertex id '${vertex.id}'.`);
        }
        vertexIds.add(vertex.id);
    }

    const arrowIds = new Set<string>();
    for (const arrow of quiver.arrows) {
        if (arrowIds.has(arrow.id)) {
            throw new Error(`Duplicate arrow id '${arrow.id}'.`);
        }
        arrowIds.add(arrow.id);
        if (!vertexIds.has(arrow.source)) {
            throw new Error(
                `Arrow '${arrow.id}' references unknown source vertex '${arrow.source}'.`,
            );
        }
        if (!vertexIds.has(arrow.target)) {
            throw new Error(
                `Arrow '${arrow.id}' references unknown target vertex '${arrow.target}'.`,
            );
        }
    }
}

export function validateRelationPath(
    quiver: Quiver,
    relation: RelationGenerator,
): void {
    const relationPath = relation.path.arrows.join("*") || "<empty>";
    if (relation.path.arrows.length < 2) {
        throw new Error(
            `Relation '${relation.id}' has path '${relationPath}', but relation paths must contain at least two arrows.`,
        );
    }

    let checkedPath: Path;
    try {
        checkedPath = pathFromArrowIdsL2R(quiver, relation.path.arrows);
    } catch (error) {
        throw new Error(
            `Relation '${relation.id}' has problematic path '${relationPath}': ${(error as Error).message}`,
        );
    }
    if (
        checkedPath.source !== relation.path.source ||
        checkedPath.target !== relation.path.target
    ) {
        throw new Error(
            `Relation '${relation.id}' has path '${relationPath}' with stored endpoints '${relation.path.source}' to '${relation.path.target}', but the quiver gives '${checkedPath.source}' to '${checkedPath.target}'.`,
        );
    }
}

function checkedMaxPathLength(maxPathLength: number | undefined): number {
    const checked = maxPathLength ?? DEFAULT_MAX_PATH_LENGTH;
    if (checked < MIN_MAX_PATH_LENGTH) {
        throw new RangeError(
            `maxPathLength must be at least ${MIN_MAX_PATH_LENGTH}.`,
        );
    }
    return checked;
}

function verifiedBeforeMinimising(
    input: MonomialAlgebraInput,
): Omit<VerifiedMonomialAlgebra, "minimisedRelations" | "logs"> {
    const maxPathLength = checkedMaxPathLength(input.maxPathLength);
    validateQuiver(input.quiver);
    input.relations.forEach((relation) =>
        validateRelationPath(input.quiver, relation),
    );

    return {
        quiver: input.quiver,
        originalRelations: input.relations.map((relation) => ({ ...relation })),
        activeOrientation: input.activeOrientation,
        maxPathLength,
    };
}

function containsContiguousWord(path: ArrowId[], divisor: ArrowId[]): boolean {
    if (divisor.length === 0 || divisor.length > path.length) {
        return false;
    }

    for (let start = 0; start <= path.length - divisor.length; start += 1) {
        let matches = true;
        for (let offset = 0; offset < divisor.length; offset += 1) {
            if (path[start + offset] !== divisor[offset]) {
                matches = false;
                break;
            }
        }
        if (matches) {
            return true;
        }
    }

    return false;
}

function isProperDivisor(divisor: ArrowId[], path: ArrowId[]): boolean {
    return (
        divisor.length < path.length && containsContiguousWord(path, divisor)
    );
}

function throwWithLog(
    message: string,
    logs: MonomialAlgebraLogEntry[],
    entry: MonomialAlgebraLogEntry,
): never {
    logs.push(entry);
    throw new MonomialAlgebraError(message, logs);
}

function countNonMonomialRelations(relations: RelationData[]): number {
    return relations.filter((relation) => (relation.terms?.length ?? 0) > 2)
        .length;
}

function findArrowRedundantTerm(terms: Monomial[]): {
    redundantTerm: Monomial;
    replacementTerm: Monomial;
} | null {
    if (terms.length !== 2) {
        return null;
    }
    if (terms[0].monomial.length === 1) {
        return {
            redundantTerm: terms[0],
            replacementTerm: terms[1],
        };
    }
    if (terms[1].monomial.length === 1) {
        return {
            redundantTerm: terms[1],
            replacementTerm: terms[0],
        };
    }
    return null;
}

function arrowRedundantInfo(terms: Monomial[]): {
    redundantArrow: ArrowId;
    replacementPath: ArrowId[];
} | null {
    const redundant = findArrowRedundantTerm(terms);
    if (!redundant) {
        return null;
    }
    return {
        redundantArrow: redundant.redundantTerm.monomial[0],
        replacementPath: [...redundant.replacementTerm.monomial],
    };
}

function lengthOneMonomialRelationInfo(relation: RelationData): {
    redundantArrow: ArrowId;
} | null {
    const terms = relation.terms ?? [];
    if (terms.length !== 1 || terms[0].monomial.length !== 1) {
        return null;
    }
    return {
        redundantArrow: terms[0].monomial[0],
    };
}

function logNonMonomialRelationCount(
    relations: RelationData[],
    logs: MonomialAlgebraLogEntry[],
): void {
    const nonMonomialRelations = relations.filter(
        (relation) => (relation.terms?.length ?? 0) > 1,
    );
    if (nonMonomialRelations.length === 0) {
        return;
    }

    logs.push({
        level: "warning",
        message: `${nonMonomialRelations.length} relation(s) are not monomial.`,
    });
    nonMonomialRelations.forEach((relation, relationIndex) => {
        const relationId = relationDisplayId(relation, relationIndex);
        const relationText = relationLogText(relation, relationIndex);
        logs.push({
            level: "warning",
            relationId,
            message: `Relation '${relationText}' is not monomial because it has ${relation.terms?.length ?? 0} terms.`,
        });
    });
}

function eliminateRedundantArrowRelations(input: RelationDataAlgebraInput): {
    quiver: Quiver;
    relations: RelationData[];
    logs: MonomialAlgebraLogEntry[];
} {
    const logs: MonomialAlgebraLogEntry[] = [];
    const quiver: Quiver = {
        vertices: input.quiver.vertices.map((vertex) => ({ ...vertex })),
        arrows: input.quiver.arrows.map((arrow) => ({ ...arrow })),
    };
    const relations = cloneRelationData(input.relations);

    while (true) {
        const lengthOneIndex = relations.findIndex(
            (relation) => lengthOneMonomialRelationInfo(relation) !== null,
        );
        if (lengthOneIndex !== -1) {
            const relation = relations[lengthOneIndex];
            const relationId = relationDisplayId(relation, lengthOneIndex);
            const relationText = relationLogText(relation, lengthOneIndex);
            const redundant = lengthOneMonomialRelationInfo(relation);
            if (!redundant) {
                break;
            }
            const { redundantArrow } = redundant;
            const arrow = arrowById(quiver, redundantArrow);
            if (!arrow) {
                throwWithLog(
                    `Relation '${relationText}' references unknown redundant arrow '${redundantArrow}'.`,
                    logs,
                    {
                        level: "warning",
                        relationId,
                        message: `Relation '${relationText}' references unknown redundant arrow '${redundantArrow}'.`,
                    },
                );
            }

            quiver.arrows = quiver.arrows.filter(
                (candidate) => candidate.id !== redundantArrow,
            );

            const removedRelations: string[] = [];
            for (let index = relations.length - 1; index >= 0; index -= 1) {
                const currentRelation = relations[index];
                const containsArrow = (currentRelation.terms ?? []).some(
                    (term) => wordContainsArrow(term.monomial, redundantArrow),
                );
                if (!containsArrow) {
                    continue;
                }
                removedRelations.push(relationLogText(currentRelation, index));
                relations.splice(index, 1);
            }

            logs.push({
                level: "info",
                relationId,
                message: `Removed redundant arrow '${redundantArrow}' using monomial relation '${relationText}' and removed ${removedRelations.length} relation(s) containing that arrow: ${removedRelations.reverse().join("; ")}.`,
            });
            continue;
        }

        const redundantIndex = relations.findIndex((relation) =>
            findArrowRedundantTerm(relation.terms ?? []) !== null,
        );

        if (redundantIndex === -1) {
            break;
        }

        const relation = relations[redundantIndex];
        const relationId = relationDisplayId(relation, redundantIndex);
        const relationText = relationLogText(relation, redundantIndex);
        const redundant = arrowRedundantInfo(relation.terms ?? []);
        if (!redundant) {
            break;
        }

        const { redundantArrow, replacementPath } = redundant;
        const arrow = arrowById(quiver, redundantArrow);
        if (!arrow) {
            throwWithLog(
                `Relation '${relationText}' references unknown redundant arrow '${redundantArrow}'.`,
                logs,
                {
                    level: "warning",
                    relationId,
                    message: `Relation '${relationText}' references unknown redundant arrow '${redundantArrow}'.`,
                },
            );
        }

        if (replacementPath.includes(redundantArrow)) {
            throwWithLog(
                `Replacement path for redundant arrow '${redundantArrow}' contains the same arrow.`,
                logs,
                {
                    level: "warning",
                    relationId,
                    message: `Replacement path '${replacementPath.join("*")}' for redundant arrow '${redundantArrow}' in relation '${relationText}' contains '${redundantArrow}'.`,
                },
            );
        }

        const replacementCheckedPath = pathFromNonemptyArrowIdsL2R(
            quiver,
            replacementPath,
        );
        if (
            replacementCheckedPath.source !== arrow.source ||
            replacementCheckedPath.target !== arrow.target
        ) {
            throwWithLog(
                `Replacement path for redundant arrow '${redundantArrow}' has incompatible endpoints.`,
                logs,
                {
                    level: "warning",
                    relationId,
                    message: `Replacement path '${replacementPath.join("*")}' for redundant arrow '${redundantArrow}' in relation '${relationText}' runs '${replacementCheckedPath.source}' to '${replacementCheckedPath.target}', but '${redundantArrow}' runs '${arrow.source}' to '${arrow.target}'.`,
                },
            );
        }

        quiver.arrows = quiver.arrows.filter(
            (candidate) => candidate.id !== redundantArrow,
        );
        relations.splice(redundantIndex, 1);

        for (const currentRelation of relations) {
            const currentRelationTextBefore = formatRelationData(currentRelation);
            let relationChanged = false;
            const nextTerms: Monomial[] = [];
            for (const term of currentRelation.terms ?? []) {
                const hasReplacement = wordContainsArrow(
                    term.monomial,
                    redundantArrow,
                );
                const replacedWord = hasReplacement
                    ? replaceArrowInWord(
                          term.monomial,
                          redundantArrow,
                          replacementPath,
                      )
                    : [...term.monomial];
                relationChanged = relationChanged || hasReplacement;
                nextTerms.push({
                    scalar: term.scalar,
                    monomial: replacedWord,
                });
            }
            currentRelation.terms = nextTerms;
            if (relationChanged) {
                currentRelation.reln = formatRelationData(currentRelation, "L2R", "*");
                logs.push({
                    level: "info",
                    relationId: relationDisplayId(currentRelation, -1),
                    message: `Updated relation '${currentRelationTextBefore}' to '${formatRelationData(currentRelation)}' by replacing arrow '${redundantArrow}' with path '${replacementPath.join("*")}'.`,
                });
            }
        }

        logs.push({
            level: "info",
            relationId,
            message: `Removed redundant arrow '${redundantArrow}' using relation '${relationText}' and replaced occurrences by path '${replacementPath.join("*")}'.`,
        });
    }

    return { quiver, relations, logs };
}

function relationDataPath(relation: RelationData): ArrowId[] | null {
    const terms = relation.terms ?? [];
    if (terms.length !== 1) {
        return null;
    }
    return terms[0].monomial;
}

function removeRelationDataDivisors(
    relations: RelationData[],
    logs: MonomialAlgebraLogEntry[],
): void {
    const kept: RelationData[] = [];
    const seen = new Map<string, RelationData>();

    for (let index = 0; index < relations.length; index += 1) {
        const relation = relations[index];
        const path = relationDataPath(relation);
        if (!path) {
            kept.push(relation);
            continue;
        }

        const key = printArrowWord(path);
        const duplicate = seen.get(key);
        if (duplicate) {
            logs.push({
                level: "info",
                relationId: relationDisplayId(relation, index),
                keptRelationId: duplicate.id ?? duplicate.reln,
                removedRelationId: relation.id ?? relation.reln,
                message: `Removed duplicate relation '${relationLogText(relation, index)}'; kept '${formatRelationData(duplicate)}'.`,
            });
            continue;
        }
        seen.set(key, relation);
        kept.push(relation);
    }

    const minimised = kept.filter((relation, relationIndex) => {
        const path = relationDataPath(relation);
        if (!path) {
            return true;
        }
        const divisor = kept.find((candidate) => {
            if (candidate === relation) {
                return false;
            }
            const divisorPath = relationDataPath(candidate);
            return divisorPath
                ? isProperDivisor(divisorPath, path)
                : false;
        });
        if (!divisor) {
            return true;
        }

        logs.push({
            level: "info",
            relationId: relationDisplayId(relation, relationIndex),
            keptRelationId: divisor.id ?? divisor.reln,
            removedRelationId: relation.id ?? relation.reln,
            message: `Removed redundant relation '${relationLogText(relation, relationIndex)}' because it contains '${formatRelationData(divisor)}' as a contiguous divisor.`,
        });
        return false;
    });

    relations.splice(0, relations.length, ...minimised);
}

export function tidyUpRelationDataAlgebra(
    input: RelationDataAlgebraInput,
): VerifiedMonomialAlgebra {
    const monomialCheck = checkRelationsAreMonomial(input);
    if (!monomialCheck.ok) {
        throw new MonomialAlgebraError(
            "The computed list of relations is not monomial.",
            monomialCheck.logs,
        );
    }

    const monomialRelations = monomialCheck.relations.flatMap(
        (relation, index) => {
            const terms = relation.terms ?? [];
            if (terms.length === 0) {
                return [];
            }
            const term = terms[0];
            const path = pathFromArrowIdsL2R(
                monomialCheck.quiver,
                term.monomial,
            );
            return [
                relationFromL2R(
                    relation.id ?? relation.reln ?? `r${index + 1}`,
                    path,
                ),
            ];
        },
    );

    const verified = tidyUpMonomialAlgebra({
        quiver: monomialCheck.quiver,
        relations: monomialRelations,
        activeOrientation: input.activeOrientation,
        maxPathLength: input.maxPathLength,
    });

    return {
        ...verified,
        logs: [...monomialCheck.logs, ...verified.logs],
    };
}

export function tidyUpMonomialAlgebra(
    input: MonomialAlgebraInput,
): VerifiedMonomialAlgebra {
    const verified = verifiedBeforeMinimising(input);
    const logs: MonomialAlgebraLogEntry[] = [];
    const kept: RelationGenerator[] = [];
    const seen = new Map<string, RelationGenerator>();

    for (const relation of verified.originalRelations) {
        const key = printArrowWord(relation.path.arrows);
        const duplicate = seen.get(key);
        if (duplicate) {
            logs.push({
                level: "info",
                relationId: relation.id,
                keptRelationId: duplicate.id,
                removedRelationId: relation.id,
                message: `Removed duplicate relation generator '${relationGeneratorLogText(relation)}'; kept '${relationGeneratorLogText(duplicate)}'.`,
            });
            continue;
        }
        seen.set(key, relation);
        kept.push(relation);
    }

    const relationGenerators = kept.filter((relation) => {
        const divisor = kept.find(
            (candidate) =>
                candidate.id !== relation.id &&
                isProperDivisor(candidate.path.arrows, relation.path.arrows),
        );
        if (!divisor) {
            return true;
        }

        logs.push({
            level: "info",
            relationId: relation.id,
            keptRelationId: divisor.id,
            removedRelationId: relation.id,
            message: `Removed redundant relation generator '${relationGeneratorLogText(relation)}' because it contains '${relationGeneratorLogText(divisor)}' as a contiguous divisor.`,
        });
        return false;
    });

    return {
        ...verified,
        minimisedRelations: relationGenerators.map((relation) => ({
            ...relation,
        })),
        logs,
    };
}

function arrowPathL2R(quiver: Quiver, arrowId: ArrowId): Path {
    const arrow = arrowById(quiver, arrowId);
    if (!arrow) {
        throw new Error(`Unknown arrow '${arrowId}'.`);
    }
    return {
        arrows: [arrow.id],
        source: arrow.source,
        target: arrow.target,
        orientation: "L2R",
    };
}

function extendPathL2R(path: Path, arrowId: ArrowId, quiver: Quiver): Path {
    const arrow = arrowById(quiver, arrowId);
    if (!arrow) {
        throw new Error(`Unknown arrow '${arrowId}'.`);
    }
    if (path.target !== arrow.source) {
        throw new Error(
            `Cannot extend path ending at '${path.target}' by arrow '${arrow.id}'.`,
        );
    }
    return {
        arrows: [...path.arrows, arrow.id],
        source: path.source,
        target: arrow.target,
        orientation: "L2R",
    };
}

function containsRelationGenerator(
    path: Path,
    relationGenerators: RelationGenerator[],
): boolean {
    return relationGenerators.some((relation) =>
        containsContiguousWord(path.arrows, relation.path.arrows),
    );
}

export function enumerateAdmissiblePaths(
    input: MonomialAlgebraInput,
): AdmissiblePathEnumeration {
    const relationGenerators = tidyUpMonomialAlgebra(input);
    const logs = [...relationGenerators.logs];
    const paths: Path[] = [];
    const seen = new Set<string>();
    let frontier: Path[] = [];

    const addPath = (path: Path): boolean => {
        const key = printPath(path);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        paths.push(path);
        return true;
    };

    for (const vertex of relationGenerators.quiver.vertices) {
        addPath(vertexPath(vertex.id, "L2R"));
    }

    for (const arrow of relationGenerators.quiver.arrows) {
        const path = arrowPathL2R(relationGenerators.quiver, arrow.id);
        if (
            !containsRelationGenerator(
                path,
                relationGenerators.minimisedRelations,
            ) &&
            addPath(path)
        ) {
            frontier.push(path);
        }
    }

    let reachedMaxPathLength = false;

    while (frontier.length > 0) {
        const nextFrontier: Path[] = [];
        for (const path of frontier) {
            const composableArrows = relationGenerators.quiver.arrows.filter(
                (arrow) => arrow.source === path.target,
            );
            if (path.arrows.length >= relationGenerators.maxPathLength) {
                if (
                    composableArrows.some((arrow) => {
                        const extended = extendPathL2R(
                            path,
                            arrow.id,
                            relationGenerators.quiver,
                        );
                        return !containsRelationGenerator(
                            extended,
                            relationGenerators.minimisedRelations,
                        );
                    })
                ) {
                    reachedMaxPathLength = true;
                }
                continue;
            }

            for (const arrow of composableArrows) {
                const extended = extendPathL2R(
                    path,
                    arrow.id,
                    relationGenerators.quiver,
                );
                if (
                    containsRelationGenerator(
                        extended,
                        relationGenerators.minimisedRelations,
                    )
                ) {
                    continue;
                }
                if (addPath(extended)) {
                    nextFrontier.push(extended);
                }
            }
        }
        frontier = nextFrontier;
    }

    if (reachedMaxPathLength) {
        logs.push({
            level: "warning",
            message: `Reached maxPathLength ${relationGenerators.maxPathLength}; finite-dimensionality was not confirmed.`,
        });
    }

    return {
        paths,
        relationGenerators,
        logs,
        reachedMaxPathLength,
        finiteDimensionalityConfirmed: !reachedMaxPathLength,
    };
}

import {
  computeAmbiguitiesFromVerified,
  getLazySequenceTerms,
  underlyingPathOfAmbiguity,
} from "../backend/ambiguities";
import {
  buildHochschildCochainComplexFromContext,
  checkHochschildDifferential,
  type HochschildCochainComplexContext
} from "../backend/chainCpx";
import { buildHochschildCohomologyFromComplex } from "../backend/cohomology";
import type { PathOrientation } from "../backend/paths";
import {
  enumerateAdmissiblePathsFromVerified,
  tidyUpRelationDataAlgebra,
  MonomialAlgebraError
} from "../backend/monomial-algebra";
import type { Quiver } from "../backend/quiver";
import { appendOutputHtml, setError, setInfoStatus } from "./log-panel";
import { refreshAmbiguitiesOutput, refreshHochschildComplexOutput, setRelationPanelTab } from "./relation-ui";
import type { WorkbenchState } from "./workbench-state";

const DEFAULT_COMPUTE_TERM_BOUND = 5;
const COMPUTATION_LOG_PREFIX = "[GAPCytoEx ambiguity]";

function currentQuiver(state: WorkbenchState): Quiver | null {
  if (!state.cy) {
    return null;
  }
  return {
    vertices: state.cy.nodes().map((node: any) => ({
      id: node.id(),
      label: node.data("label")
    })),
    arrows: state.cy.edges().map((edge: any) => ({
      id: edge.id(),
      source: edge.data("source"),
      target: edge.data("target"),
      label: edge.data("label") ?? edge.id()
    }))
  };
}

function maxPathLengthValue(): number {
  const input = document.getElementById("max-path-length") as HTMLInputElement | null;
  const value = Number(input?.value ?? "");
  return Number.isFinite(value) ? value : 50;
}

function computeTermBoundValue(): number {
  const input = document.getElementById("compute-term-bound") as HTMLInputElement | null;
  const value = Number(input?.value ?? "");
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_COMPUTE_TERM_BOUND;
}

function logOnlyLastTermValue(): boolean {
  return (document.getElementById("log-only-last-term") as HTMLInputElement | null)?.checked ?? false;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatOrientation(orientation: PathOrientation): string {
  return orientation === "R2L" ? "right-to-left" : "left-to-right";
}

function termCountText(maxDegree: number): string {
  return `${maxDegree} ${maxDegree === 1 ? "term" : "terms"}`;
}

function monomialComputationLogs(context: HochschildCochainComplexContext): string[] {
  if (context.admissiblePathEnumeration.reachedMaxPathLength) {
    return [
      `Reached maxPathLength ${context.verified.maxPathLength}; admissible path enumeration may not have exhausted every basis path.`
    ];
  }
  const loewyLength = Math.max(...context.admissiblePathEnumeration.paths.map((path) => path.arrows.length), 0) + 1;
  return [`Computing monomial algebra of Loewy length ${loewyLength} -> all admissible paths enumerated.`];
}

function buildMonomialComputationContext(state: WorkbenchState, quiver: Quiver, maxPathLength: number): HochschildCochainComplexContext {
  if (state.monomialComputationContext?.verified.maxPathLength === maxPathLength) {
    return state.monomialComputationContext;
  }
  state.ambiguityGroupsByOrientation = null;
  state.hochschildCochainComplex = null;
  state.hochschildComplex = null;
  state.expandedHochschildDifferentials = new Set();
  state.selectedAmbiguityId = null;
  state.selectedHochschildBasisId = null;
  state.selectedHochschildRepresentativeId = null;
  const verified = tidyUpRelationDataAlgebra({
    quiver,
    relations: state.relations,
    activeOrientation: state.activePathOrientation,
    maxPathLength,
    fieldCharacteristic: state.activeFieldCharacteristic
  });
  const admissiblePathEnumeration = enumerateAdmissiblePathsFromVerified(verified);
  const ambiguityComputation = computeAmbiguitiesFromVerified(verified, maxPathLength);
  state.monomialComputationContext = {
    verified,
    admissiblePathEnumeration,
    ambiguityComputation
  };
  return state.monomialComputationContext;
}

function getOrBuildHochschildCochainComplex(state: WorkbenchState, context: HochschildCochainComplexContext) {
  if (!state.hochschildCochainComplex) {
    state.hochschildCochainComplex = buildHochschildCochainComplexFromContext(context);
  }
  return state.hochschildCochainComplex;
}

function formatAmbiguityWarningTerms(context: HochschildCochainComplexContext): string[] {
  return context.ambiguityComputation.warnings.flatMap((warning) => [
    warning.message,
    `R2L Gamma[${warning.degree}]: ${warning.leftR2L.map((ambiguity) => underlyingPathOfAmbiguity(ambiguity).arrows.join("·") || `(${underlyingPathOfAmbiguity(ambiguity).target})`).join(", ") || "(empty)"}`,
    `L2R Gamma[${warning.degree}]: ${warning.rightL2R.map((ambiguity) => underlyingPathOfAmbiguity(ambiguity).arrows.join("·") || `(${underlyingPathOfAmbiguity(ambiguity).target})`).join(", ") || "(empty)"}`
  ]);
}

function appendLogLines(lines: string[]): void {
  appendOutputHtml(lines.map(escapeHtml).join("<br>"));
}

function appendLogGroups(groups: string[][]): void {
  groups.filter((group) => group.length > 0).forEach(appendLogLines);
}

function appendWarningLogLines(lines: string[]): void {
  appendOutputHtml(lines.map((line) => `<div class="status-warn">${escapeHtml(line)}</div>`).join(""));
}

function storeAmbiguityGroups(state: WorkbenchState, context: HochschildCochainComplexContext, maxDegree: number, logOnlyLastTerm: boolean): void {
  const ambiguityGroupsR2L = getLazySequenceTerms(context.ambiguityComputation.primaryLeftR2L, -1, maxDegree, logOnlyLastTerm).map(([degree, ambiguities]) => ({
    degree,
    ambiguities
  }));
  const ambiguityGroupsL2R = getLazySequenceTerms(context.ambiguityComputation.checkRightL2R, -1, maxDegree, logOnlyLastTerm).map(([degree, ambiguities]) => ({
    degree,
    ambiguities
  }));
  state.ambiguityGroupsByOrientation = {
    L2R: ambiguityGroupsL2R,
    R2L: ambiguityGroupsR2L
  };
  state.selectedAmbiguityId = null;
}

export function computeAndRenderAmbiguities(state: WorkbenchState): void {
  const quiver = currentQuiver(state);
  if (!quiver) {
    setError("Draw a quiver before computing ambiguities.");
    return;
  }

  try {
    const maxPathLength = maxPathLengthValue();
    const maxDegree = computeTermBoundValue();
    const logOnlyLastTerm = logOnlyLastTermValue();
    console.groupCollapsed(`${COMPUTATION_LOG_PREFIX} compute button`);
    console.log("input", {
      vertices: quiver.vertices.length,
      arrows: quiver.arrows.length,
      relations: state.relations.length,
      activeOrientation: formatOrientation(state.activePathOrientation),
      maxPathLength,
      maxDegree,
      logOnlyLastTerm
    });
    console.time(`${COMPUTATION_LOG_PREFIX} total`);
    console.time(`${COMPUTATION_LOG_PREFIX} tidy algebra`);
    const context = buildMonomialComputationContext(state, quiver, maxPathLength);
    const verified = context.verified;
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} tidy algebra`);
    console.log("verified algebra", {
      arrows: verified.quiver.arrows.length,
      originalRelations: verified.originalRelations.length,
      minimisedRelations: verified.minimisedRelations.length,
      maxPathLength: verified.maxPathLength,
      logs: verified.logs.map((entry) => entry.message)
    });
    console.time(`${COMPUTATION_LOG_PREFIX} build/check ambiguity sequences`);
    const computation = context.ambiguityComputation;
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} build/check ambiguity sequences`);
    console.time(`${COMPUTATION_LOG_PREFIX} render requested terms`);
    storeAmbiguityGroups(state, context, maxDegree, logOnlyLastTerm);
    refreshAmbiguitiesOutput(state);
    setRelationPanelTab(state, "ambiguities");

    for (const { degree, ambiguities } of state.ambiguityGroupsByOrientation[state.activePathOrientation]) {
      console.log("render term", { degree, ambiguities: ambiguities.length });
    }
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} render requested terms`);

    const ambiguityLogLines = [
      `Ambiguities computed up to ${termCountText(maxDegree)}.`
    ];
    ambiguityLogLines.push(...formatAmbiguityWarningTerms(context));
    appendLogGroups([
      monomialComputationLogs(context),
      ambiguityLogLines
    ]);
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} total`);
    console.groupEnd();
  } catch (error) {
    console.error(`${COMPUTATION_LOG_PREFIX} failed`, error);
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} total`);
    console.groupEnd();
    if (error instanceof MonomialAlgebraError) {
      appendWarningLogLines(error.logs.map((entry) => entry.message));
      setInfoStatus("Relations are not monomial.", true);
      return;
    }
    setError((error as Error).message);
    setInfoStatus("Ambiguity computation failed.", true);
  }
}

export function computeAndRenderHochschildComplex(state: WorkbenchState): void {
  const quiver = currentQuiver(state);
  if (!quiver) {
    setError("Draw a quiver before computing the Hochschild cochain complex.");
    return;
  }

  try {
    const maxPathLength = maxPathLengthValue();
    const maxDegree = computeTermBoundValue();
    const logOnlyLastTerm = logOnlyLastTermValue();
    const context = buildMonomialComputationContext(state, quiver, maxPathLength);
    const complex = getOrBuildHochschildCochainComplex(state, context);
    const terms = complex.terms.getArray(0, maxDegree);
    const coboundaries = maxDegree > 0 ? complex.coboundaries.getArray(0, maxDegree - 1) : [];
    const previousCheckedThrough = state.hochschildComplex?.checkedDifferentialThrough ?? -1;
    const checkStart = Math.max(0, previousCheckedThrough + 1);
    const checkEnd = maxDegree - 1;
    const differentialCheck = checkEnd >= checkStart
      ? checkHochschildDifferential(complex, checkStart, checkEnd)
      : { ok: true, checkedThroughDegree: previousCheckedThrough };
    state.hochschildComplex = {
      terms: terms.map(([, term]) => term),
      coboundaries: coboundaries.map(([, matrix]) => matrix),
      cohomologyGroups: undefined,
      checkedDifferentialThrough: Math.max(previousCheckedThrough, differentialCheck.checkedThroughDegree)
    };
    state.expandedHochschildDifferentials = new Set();
    if (!state.ambiguityGroupsByOrientation) {
      storeAmbiguityGroups(state, context, maxDegree, logOnlyLastTerm);
      refreshAmbiguitiesOutput(state);
    }
    refreshHochschildComplexOutput(state);
    setRelationPanelTab(state, "hochschild-complex");
    const ambiguityLogLines = [
      `Ambiguities computed up to ${termCountText(maxDegree)}.`,
      ...formatAmbiguityWarningTerms(context)
    ];
    const hochschildLogLines = [
      `Hochschild cochain complex computed through C^${maxDegree}.`,
      differentialCheck.ok
        ? `Checked d^{i + 1} d^i = 0 for ${checkStart <= checkEnd ? `${checkStart} <= i <= ${checkEnd}` : "no new differential pairs"}.`
        : `WARNING: d is not a differential at index ${differentialCheck.failure?.degree}.`,
      ...terms.map(([degree, term]) => `C^${degree}: dimension ${term.dimension}`),
      ...coboundaries.map(([degree, matrix]) => `d^${degree}: ${matrix.rows} x ${matrix.cols}, ${matrix.entries.length} nonzero ${matrix.entries.length === 1 ? "entry" : "entries"}`)
    ];
    appendLogGroups([
      complex.logs,
      monomialComputationLogs(context),
      ambiguityLogLines,
      hochschildLogLines
    ]);
    if (!differentialCheck.ok) {
      setInfoStatus("d is not a differential.", true);
    }
  } catch (error) {
    if (error instanceof MonomialAlgebraError) {
      appendWarningLogLines(error.logs.map((entry) => entry.message));
      setInfoStatus("Relations are not monomial.", true);
      return;
    }
    setError((error as Error).message);
    setInfoStatus("Hochschild cochain computation failed.", true);
  }
}

export function computeAndRenderHochschildCohomology(state: WorkbenchState): void {
  const quiver = currentQuiver(state);
  if (!quiver) {
    setError("Draw a quiver before computing Hochschild cohomology.");
    return;
  }

  try {
    const maxPathLength = maxPathLengthValue();
    const maxDegree = computeTermBoundValue();
    const logOnlyLastTerm = logOnlyLastTermValue();
    const context = buildMonomialComputationContext(state, quiver, maxPathLength);
    const complex = getOrBuildHochschildCochainComplex(state, context);
    const cohomology = buildHochschildCohomologyFromComplex(complex);
    const groups = cohomology.groups.getArray(0, maxDegree);
    const terms = complex.terms.getArray(0, maxDegree);
    const coboundaries = maxDegree > 0 ? complex.coboundaries.getArray(0, maxDegree - 1) : [];
    const differentialCheck = maxDegree > 0
      ? checkHochschildDifferential(complex, 0, maxDegree - 1)
      : { ok: true, checkedThroughDegree: -1 };

    state.hochschildComplex = {
      terms: terms.map(([, term]) => term),
      coboundaries: coboundaries.map(([, matrix]) => matrix),
      cohomologyGroups: groups.map(([, group]) => group),
      checkedDifferentialThrough: Math.max(
        state.hochschildComplex?.checkedDifferentialThrough ?? -1,
        differentialCheck.checkedThroughDegree,
      )
    };
    state.expandedHochschildDifferentials = new Set();
    if (!state.ambiguityGroupsByOrientation) {
      storeAmbiguityGroups(state, context, maxDegree, logOnlyLastTerm);
      refreshAmbiguitiesOutput(state);
    }
    refreshHochschildComplexOutput(state);
    setRelationPanelTab(state, "hochschild-complex");

    const ambiguityLogLines = [
      `Ambiguities computed up to ${termCountText(maxDegree)}.`,
      ...formatAmbiguityWarningTerms(context)
    ];
    const complexLogLines = [
      `Hochschild cochain complex available through C^${maxDegree}.`,
      differentialCheck.ok
        ? `Checked d^{i + 1} d^i = 0 for ${maxDegree > 0 ? `0 <= i <= ${maxDegree - 1}` : "no differential pairs"}.`
        : `WARNING: d is not a differential at index ${differentialCheck.failure?.degree}.`
    ];
    const cohomologyLogLines = [
      `Hochschild cohomology computed through HH^${maxDegree}.`,
      ...groups.map(([degree, group]) =>
        `HH^${degree}: dimension ${group.dimension} (ker ${group.kernelDimension}, im ${group.imageDimension})`,
      )
    ];
    appendLogGroups([
      complex.logs,
      monomialComputationLogs(context),
      ambiguityLogLines,
      complexLogLines,
      cohomologyLogLines
    ]);
    if (!differentialCheck.ok) {
      setInfoStatus("d is not a differential.", true);
    }
  } catch (error) {
    if (error instanceof MonomialAlgebraError) {
      appendWarningLogLines(error.logs.map((entry) => entry.message));
      setInfoStatus("Relations are not monomial.", true);
      return;
    }
    setError((error as Error).message);
    setInfoStatus("Hochschild cohomology computation failed.", true);
  }
}

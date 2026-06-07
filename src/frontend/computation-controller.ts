import {
  computeAmbiguitiesFromVerified,
  getLazySequenceTerms,
} from "../backend/ambiguities";
import type { PathOrientation } from "../backend/paths";
import { tidyUpRelationDataAlgebra, MonomialAlgebraError } from "../backend/monomial-algebra";
import type { Quiver } from "../backend/quiver";
import { appendOutputHtml, setError, setInfoStatus } from "./log-panel";
import { formatAmbiguityForDisplay, refreshAmbiguitiesOutput, setRelationPanelTab } from "./relation-ui";
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
    const verified = tidyUpRelationDataAlgebra({
      quiver,
      relations: state.relations,
      activeOrientation: state.activePathOrientation,
      maxPathLength,
      fieldCharacteristic: state.activeFieldCharacteristic
    });
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} tidy algebra`);
    console.log("verified algebra", {
      arrows: verified.quiver.arrows.length,
      originalRelations: verified.originalRelations.length,
      minimisedRelations: verified.minimisedRelations.length,
      maxPathLength: verified.maxPathLength,
      logs: verified.logs.map((entry) => entry.message)
    });
    console.time(`${COMPUTATION_LOG_PREFIX} build/check ambiguity sequences`);
    const computation = computeAmbiguitiesFromVerified(verified, maxDegree);
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} build/check ambiguity sequences`);
    const lines: string[] = [];

    lines.push(`<div><strong>Ambiguities (${formatOrientation(state.activePathOrientation)})</strong></div>`);
    for (const warning of computation.warnings) {
      lines.push(`<div class="status-warn">${escapeHtml(warning.message)}</div>`);
    }
    console.time(`${COMPUTATION_LOG_PREFIX} render requested terms`);
    const ambiguityGroupsR2L = getLazySequenceTerms(computation.primaryLeftR2L, -1, maxDegree, logOnlyLastTerm).map(([degree, ambiguities]) => ({
      degree,
      ambiguities
    }));
    const ambiguityGroupsL2R = getLazySequenceTerms(computation.checkRightL2R, -1, maxDegree, logOnlyLastTerm).map(([degree, ambiguities]) => ({
      degree,
      ambiguities
    }));
    state.ambiguityGroupsByOrientation = {
      L2R: ambiguityGroupsL2R,
      R2L: ambiguityGroupsR2L
    };
    state.selectedAmbiguityId = null;
    refreshAmbiguitiesOutput(state);
    setRelationPanelTab(state, "ambiguities");

    const ambiguityGroups = state.ambiguityGroupsByOrientation[state.activePathOrientation];
    for (const { degree, ambiguities } of ambiguityGroups) {
      console.log("render term", { degree, ambiguities: ambiguities.length });
      lines.push(`<div><strong>Gamma[${degree}]</strong> (${ambiguities.length})</div>`);
      if (ambiguities.length === 0) {
        lines.push(`<pre class="output-pre">(empty)</pre>`);
        continue;
      }
      lines.push(`<pre class="output-pre">${escapeHtml(ambiguities.map(formatAmbiguityForDisplay).join("\n"))}</pre>`);
    }
    lines.push(`<div class="field-note">${logOnlyLastTerm ? `Showing Gamma[${maxDegree}] only.` : `Showing Gamma[-1] through Gamma[${maxDegree}].`}</div>`);
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} render requested terms`);

    appendOutputHtml(lines.join(""));
    setInfoStatus(computation.warnings.length > 0 ? computation.warnings[0].message : "Ambiguities computed.");
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} total`);
    console.groupEnd();
  } catch (error) {
    console.error(`${COMPUTATION_LOG_PREFIX} failed`, error);
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} total`);
    console.groupEnd();
    if (error instanceof MonomialAlgebraError) {
      appendOutputHtml(error.logs.map((entry) => `<div class="status-warn">${escapeHtml(entry.message)}</div>`).join(""));
      setInfoStatus("Ambiguity computation blocked: relations are not monomial.", true);
      return;
    }
    setError((error as Error).message);
    setInfoStatus("Ambiguity computation failed.", true);
  }
}

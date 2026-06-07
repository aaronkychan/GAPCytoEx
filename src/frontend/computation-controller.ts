import {
  computeAmbiguitiesFromVerified,
  getLazySequenceTerms,
  underlyingPathOfAmbiguity,
  type Ambiguity
} from "../backend/ambiguities";
import { tidyUpRelationDataAlgebra, MonomialAlgebraError } from "../backend/monomial-algebra";
import type { Quiver } from "../backend/quiver";
import { setError, setInfoStatus, setOutputHtml } from "./log-panel";
import type { WorkbenchState } from "./workbench-state";

const DEFAULT_COMPUTE_TERM_BOUND = 5;

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

function formatPathWord(arrows: string[]): string {
  return arrows.length === 0 ? "e" : arrows.join("·");
}

function formatAmbiguity(ambiguity: Ambiguity): string {
  const path = underlyingPathOfAmbiguity(ambiguity);
  const pieces = ambiguity.pieces.map((piece) => formatPathWord(piece.arrows)).join(" | ");
  return `${pieces}    (${path.source} -> ${path.target}; ${formatPathWord(path.arrows)})`;
}

export function computeAndRenderAmbiguities(state: WorkbenchState): void {
  const quiver = currentQuiver(state);
  if (!quiver) {
    setError("Draw a quiver before computing ambiguities.");
    return;
  }

  try {
    const verified = tidyUpRelationDataAlgebra({
      quiver,
      relations: state.relations,
      activeOrientation: state.activePathOrientation,
      maxPathLength: maxPathLengthValue(),
      fieldCharacteristic: state.activeFieldCharacteristic
    });
    const computation = computeAmbiguitiesFromVerified(verified);
    const sequence = state.activePathOrientation === "R2L" ? computation.primaryLeftR2L : computation.checkRightL2R;
    const maxDegree = computeTermBoundValue();
    const logOnlyLastTerm = logOnlyLastTermValue();
    const lines: string[] = [];

    lines.push(`<div><strong>Ambiguities (${state.activePathOrientation})</strong></div>`);
    for (const warning of computation.warnings) {
      lines.push(`<div class="status-warn">${escapeHtml(warning.message)}</div>`);
    }
    for (const [degree, ambiguities] of getLazySequenceTerms(sequence, -1, maxDegree, logOnlyLastTerm)) {
      lines.push(`<div><strong>Gamma[${degree}]</strong> (${ambiguities.length})</div>`);
      if (ambiguities.length === 0) {
        lines.push(`<pre class="output-pre">(empty)</pre>`);
        continue;
      }
      lines.push(`<pre class="output-pre">${escapeHtml(ambiguities.map(formatAmbiguity).join("\n"))}</pre>`);
    }
    lines.push(`<div class="field-note">${logOnlyLastTerm ? `Showing Gamma[${maxDegree}] only.` : `Showing Gamma[-1] through Gamma[${maxDegree}].`}</div>`);

    setOutputHtml(lines.join(""));
    setInfoStatus(computation.warnings.length > 0 ? computation.warnings[0].message : "Ambiguities computed.");
  } catch (error) {
    if (error instanceof MonomialAlgebraError) {
      setOutputHtml(error.logs.map((entry) => `<div class="status-warn">${escapeHtml(entry.message)}</div>`).join(""));
      setInfoStatus("Ambiguity computation blocked: relations are not monomial.", true);
      return;
    }
    setError((error as Error).message);
    setInfoStatus("Ambiguity computation failed.", true);
  }
}

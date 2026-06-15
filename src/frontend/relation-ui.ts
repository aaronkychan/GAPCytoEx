import type { RelationData } from "../backend/relations";
import { underlyingPathOfAmbiguity, type Ambiguity } from "../backend/ambiguities";
import type { CochainBasisElement, CochainSpace, SparseMatrix } from "../backend/chainCpx";
import type { CohomologyClassRepresentative, HochschildCohomologyGroup } from "../backend/cohomology";
import type { Path } from "../backend/paths";
import {
  formatRelationData,
  formatRelationDataForInput,
  relationArrowNames
} from "../backend/relations";
import { parseRelationEntries, parseSingleRelation, quiverFromCytoscape } from "../backend/qpa-translator";
import type { WorkbenchState } from "./workbench-state";
import { appendInfoLog, setError } from "./log-panel";
import { cytoThemeColors, relationHighlightColor } from "./cytoscape-style";

function formatPathWord(arrows: string[]): string {
  return arrows.join("·");
}

function formatPathForDisplay(path: Path): string {
  if (path.arrows.length === 0) {
    return `(${path.target})`;
  }
  return formatPathWord(path.arrows);
}

function formatPathForL2RDisplay(path: Path): string {
  if (path.arrows.length === 0) {
    return `(${path.target})`;
  }
  const arrows = path.orientation === "R2L" ? [...path.arrows].reverse() : path.arrows;
  return formatPathWord(arrows);
}

function formatAmbiguityPiece(piece: Path): string {
  return formatPathForDisplay(piece);
}

export function formatAmbiguityForDisplay(ambiguity: Ambiguity): string {
  return ambiguity.pieces.map(formatAmbiguityPiece).join(" | ");
}

function ambiguityRowId(degree: number, index: number): string {
  return `ambiguity-${degree}-${index}`;
}

function hochschildBasisRowId(degree: number, index: number): string {
  return `hochschild-${degree}-${index}`;
}

function hochschildRepresentativeRowId(degree: number, index: number): string {
  return `hochschild-rep-${degree}-${index}`;
}

function ambiguityByIndex(state: WorkbenchState, degree: number, index: number): Ambiguity | null {
  const groups = state.ambiguityGroupsByOrientation?.[state.activePathOrientation];
  const group = groups?.find((candidate) => candidate.degree === degree);
  return group?.ambiguities[index] ?? null;
}

function hochschildBasisByIndex(state: WorkbenchState, degree: number, index: number): CochainBasisElement | null {
  const term = state.hochschildComplex?.terms.find((candidate) => candidate.degree === degree);
  return term?.basis[index] ?? null;
}

function hochschildRepresentativeByIndex(state: WorkbenchState, degree: number, index: number): CohomologyClassRepresentative | null {
  const group = state.hochschildComplex?.cohomologyGroups?.find((candidate) => candidate.degree === degree);
  return group?.representatives[index] ?? null;
}

function resetCanvasEdgeStyles(state: WorkbenchState): void {
  if (!state.cy) {
    return;
  }
  const colors = cytoThemeColors();
  for (const edge of state.cy.edges()) {
    edge.style({
      width: 2,
      "line-color": colors.edge,
      "target-arrow-color": colors.edge,
      "target-arrow-shape": "triangle"
    });
    edge.removeStyle("line-fill line-gradient-stop-colors line-gradient-stop-positions");
  }
}

function setAmbiguityPieceClasses(row: Element | null, currentPieceIndex: number, highlightedPieceIndexes: Set<number>): void {
  row?.querySelectorAll<HTMLElement>(".ambiguity-piece").forEach((piece) => {
    const pieceIndex = Number(piece.dataset.pieceIndex ?? "-1");
    piece.classList.toggle("is-pair-highlighted", highlightedPieceIndexes.has(pieceIndex));
    piece.classList.toggle("is-flow-current", pieceIndex === currentPieceIndex);
  });
}

function renderAmbiguityRowContents(row: HTMLElement, ambiguity: Ambiguity): void {
  row.textContent = "";
  ambiguity.pieces.forEach((piece, pieceIndex) => {
    if (pieceIndex > 0) {
      row.appendChild(document.createTextNode(" | "));
    }
    const pieceElement = document.createElement("span");
    pieceElement.className = "ambiguity-piece";
    pieceElement.dataset.pieceIndex = String(pieceIndex);
    pieceElement.textContent = formatAmbiguityPiece(piece);
    row.appendChild(pieceElement);
  });
}

export function setRelationPanelTab(state: WorkbenchState, tab: "relations" | "ambiguities" | "hochschild-complex"): void {
  if (tab === "ambiguities" && !state.ambiguityGroupsByOrientation) {
    tab = "relations";
  }
  if (tab === "hochschild-complex" && !state.hochschildComplex) {
    tab = "relations";
  }
  state.relationPanelTab = tab;
  document.querySelectorAll<HTMLButtonElement>("[data-relation-panel-tab]").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.relationPanelTab === tab ? "true" : "false");
  });

  const relationPanel = document.getElementById("relationsTabPanel");
  const ambiguityPanel = document.getElementById("ambiguitiesTabPanel");
  const hochschildPanel = document.getElementById("hochschildComplexTabPanel");
  if (relationPanel) {
    relationPanel.hidden = tab !== "relations";
  }
  if (ambiguityPanel) {
    ambiguityPanel.hidden = tab !== "ambiguities";
  }
  if (hochschildPanel) {
    hochschildPanel.hidden = tab !== "hochschild-complex";
  }
}

function refreshRelationPanelTabs(state: WorkbenchState): void {
  const ambiguityButton = document.getElementById("ambiguitiesTabButton");
  const hochschildButton = document.getElementById("hochschildComplexTabButton");
  const hasAmbiguities = state.ambiguityGroupsByOrientation !== null;
  const hasHochschildComplex = state.hochschildComplex !== null;
  if (ambiguityButton) {
    ambiguityButton.hidden = !hasAmbiguities;
  }
  if (hochschildButton) {
    hochschildButton.hidden = !hasHochschildComplex;
  }
  const hasActiveTab =
    state.relationPanelTab === "relations" ||
    (state.relationPanelTab === "ambiguities" && hasAmbiguities) ||
    (state.relationPanelTab === "hochschild-complex" && hasHochschildComplex);
  setRelationPanelTab(state, hasActiveTab ? state.relationPanelTab : "relations");
}

export function refreshAmbiguitiesOutput(state: WorkbenchState): void {
  refreshRelationPanelTabs(state);
  const output = document.getElementById("ambiguityOutput");
  if (!output) {
    return;
  }
  output.innerHTML = "";
  state.selectedAmbiguityId = null;
  const groups = state.ambiguityGroupsByOrientation?.[state.activePathOrientation];
  if (!groups) {
    return;
  }

  let rowIndex = 0;
  for (const [groupIndex, group] of groups.entries()) {
    if (groupIndex > 0) {
      output.appendChild(document.createElement("hr")).className = "ambiguity-divider";
    }
    const heading = document.createElement("div");
    heading.className = "ambiguity-degree";
    heading.textContent = `Gamma[${group.degree}] (${group.ambiguities.length})`;
    output.appendChild(heading);

    if (group.ambiguities.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ambiguityRow row-even";
      empty.textContent = "(empty)";
      output.appendChild(empty);
      rowIndex += 1;
      continue;
    }

    group.ambiguities.forEach((ambiguity, ambiguityIndex) => {
      const row = document.createElement("div");
      row.className = `ambiguityRow ${rowIndex % 2 === 0 ? "row-even" : "row-odd"}`;
      row.dataset.ambiguityId = ambiguityRowId(group.degree, ambiguityIndex);
      renderAmbiguityRowContents(row, ambiguity);
      row.addEventListener("click", () => selectAmbiguity(state, group.degree, ambiguityIndex));
      output.appendChild(row);
      rowIndex += 1;
    });
  }
}

function clearAmbiguityResults(state: WorkbenchState): void {
  state.monomialComputationContext = null;
  state.ambiguityGroupsByOrientation = null;
  state.hochschildCochainComplex = null;
  state.hochschildComplex = null;
  state.expandedHochschildDifferentials = new Set();
  state.selectedAmbiguityId = null;
  state.selectedHochschildBasisId = null;
  state.selectedHochschildRepresentativeId = null;
  state.relationPanelTab = "relations";
  refreshAmbiguitiesOutput(state);
  refreshHochschildComplexOutput(state);
}

function formatCochainBasisElement(element: CochainBasisElement): string {
  return `${formatPathForL2RDisplay(underlyingPathOfAmbiguity(element.ambiguity))}||${formatPathForL2RDisplay(element.basisPath)}`;
}

function formatCoefficient(value: number, isFirst: boolean): string {
  if (value === 1) {
    return isFirst ? "" : "+ ";
  }
  if (value === -1) {
    return "- ";
  }
  if (value < 0) {
    return `${value} `;
  }
  return isFirst ? `${value} ` : `+ ${value} `;
}

function formatDifferentialImageLines(matrix: SparseMatrix, target: CochainSpace, col: number): string[] {
  const entries = matrix.entries.filter((entry) => entry.col === col);
  if (entries.length === 0) {
    return ["0"];
  }
  return entries.map((entry, index) => {
    const basis = formatCochainBasisElement(target.basis[entry.row]);
    if (entry.value === 1) {
      return index === 0 ? `  ${basis}` : `+${basis}`;
    }
    if (entry.value === -1) {
      return `-${basis}`;
    }
    if (entry.value > 0) {
      return index === 0 ? `  ${entry.value} ${basis}` : `+${entry.value} ${basis}`;
    }
    return `${entry.value} ${basis}`;
  });
}

function formatDifferentialImageInline(matrix: SparseMatrix, target: CochainSpace, col: number): string {
  const entries = matrix.entries.filter((entry) => entry.col === col);
  if (entries.length === 0) {
    return "0";
  }
  return entries
    .map((entry, index) => `${formatCoefficient(entry.value, index === 0)}${formatCochainBasisElement(target.basis[entry.row])}`)
    .join(" ");
}

function closeDifferentialTooltips(): void {
  document.querySelectorAll(".differential-tooltip-wrap.is-open").forEach((element) => element.classList.remove("is-open"));
}

function appendDifferentialButton(
  container: HTMLElement,
  label: string,
  imageLines?: string[],
  onClick?: () => void
): void {
  const wrap = document.createElement("span");
  wrap.className = "differential-tooltip-wrap";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "differential-chip";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (imageLines) {
      const shouldOpen = !wrap.classList.contains("is-open");
      closeDifferentialTooltips();
      wrap.classList.toggle("is-open", shouldOpen);
    }
    onClick?.();
  });
  wrap.appendChild(button);

  if (imageLines) {
    const tooltip = document.createElement("span");
    tooltip.className = "differential-tooltip";
    imageLines.forEach((line) => {
      const lineElement = document.createElement("span");
      lineElement.textContent = line;
      tooltip.appendChild(lineElement);
    });
    wrap.appendChild(tooltip);
  }

  container.appendChild(wrap);
}

function toggleExpandedDifferential(state: WorkbenchState, degree: number): void {
  if (state.expandedHochschildDifferentials.has(degree)) {
    state.expandedHochschildDifferentials.delete(degree);
  } else {
    state.expandedHochschildDifferentials.add(degree);
  }
  refreshHochschildComplexOutput(state);
}

function formatCohomologyRepresentative(representative: CohomologyClassRepresentative): string {
  if (representative.terms.length === 0) {
    return "0";
  }
  return representative.terms
    .map((term, index) => `${formatCoefficient(term.coefficient, index === 0)}${formatCochainBasisElement(term.basisElement)}`)
    .join(" ");
}

function appendCohomologySummary(output: HTMLElement, group: HochschildCohomologyGroup): void {
  const summary = document.createElement("div");
  summary.className = "hochschild-cohomology-summary";
  summary.textContent = `HH^${group.degree}: dim=${group.dimension}`;
  output.appendChild(summary);
  const detail = document.createElement("div");
  detail.className = "hochschild-cohomology-detail";
  detail.textContent = `(dim ker=${group.kernelDimension}, dim im=${group.imageDimension})`;
  output.appendChild(detail);
}

function appendCohomologyRepresentatives(
  output: HTMLElement,
  state: WorkbenchState,
  group: HochschildCohomologyGroup,
  rowIndex: { value: number }
): void {
  if (group.representatives.length === 0) {
    return;
  }
  const heading = document.createElement("div");
  heading.className = "ambiguity-degree hochschild-representative-heading";
  heading.textContent = "Cohom. representative";
  output.appendChild(heading);

  group.representatives.forEach((representative, representativeIndex) => {
    const row = document.createElement("div");
    row.className = `hochschildRow cohomology-representative-row ${rowIndex.value % 2 === 0 ? "row-even" : "row-odd"}`;
    row.dataset.hochschildRepresentativeId = hochschildRepresentativeRowId(group.degree, representativeIndex);
    row.textContent = formatCohomologyRepresentative(representative);
    row.addEventListener("click", () => selectHochschildRepresentative(state, group.degree, representativeIndex));
    output.appendChild(row);
    rowIndex.value += 1;
  });
}

function appendHochschildTerm(
  output: HTMLElement,
  state: WorkbenchState,
  term: CochainSpace,
  target: CochainSpace | undefined,
  matrix: SparseMatrix | undefined,
  rowIndex: { value: number }
): void {
  const heading = document.createElement("div");
  heading.className = "ambiguity-degree";
  heading.appendChild(document.createTextNode(`C^${term.degree} (dim=${term.dimension})`));
  if (target && matrix) {
    heading.appendChild(document.createTextNode("  "));
    appendDifferentialButton(
      heading,
      matrix.entries.length === 0 ? `d^${term.degree} = 0` : `d^${term.degree}`,
      undefined,
      () => toggleExpandedDifferential(state, term.degree),
    );
  }
  output.appendChild(heading);

  if (term.basis.length === 0) {
    return;
  }

  term.basis.forEach((basisElement, basisIndex) => {
    const row = document.createElement("div");
    row.className = `hochschildRow ${rowIndex.value % 2 === 0 ? "row-even" : "row-odd"}`;
    row.dataset.hochschildBasisId = hochschildBasisRowId(term.degree, basisIndex);
    row.appendChild(document.createTextNode(formatCochainBasisElement(basisElement)));
    if (target && matrix) {
      row.appendChild(document.createTextNode("  "));
      const imageLines = formatDifferentialImageLines(matrix, target, basisIndex);
      appendDifferentialButton(
        row,
        imageLines.length === 1 && imageLines[0] === "0" ? `d^${term.degree}↦0` : `d^${term.degree}`,
        imageLines,
      );
    }
    row.addEventListener("click", () => selectHochschildBasis(state, term.degree, basisIndex));
    output.appendChild(row);
    rowIndex.value += 1;
  });
}

function appendExpandedHochschildDifferential(
  output: HTMLElement,
  source: CochainSpace,
  target: CochainSpace,
  matrix: SparseMatrix,
  rowIndex: { value: number }
): void {
  if (source.basis.length === 0 || matrix.entries.length === 0) {
    return;
  }

  source.basis.forEach((basisElement, col) => {
    if (!matrix.entries.some((entry) => entry.col === col)) {
      return;
    }
    const row = document.createElement("div");
    row.className = `hochschildRow differential-row ${rowIndex.value % 2 === 0 ? "row-even" : "row-odd"}`;
    row.textContent = `${formatCochainBasisElement(basisElement)} ↦ ${formatDifferentialImageInline(matrix, target, col)}`;
    output.appendChild(row);
    rowIndex.value += 1;
  });
}

export function refreshHochschildComplexOutput(state: WorkbenchState): void {
  refreshRelationPanelTabs(state);
  const output = document.getElementById("hochschildComplexOutput");
  if (!output) {
    return;
  }
  output.innerHTML = "";
  state.selectedHochschildBasisId = null;
  state.selectedHochschildRepresentativeId = null;
  const complex = state.hochschildComplex;
  if (!complex) {
    return;
  }

  const rowIndex = { value: 0 };
  const cohomologyGroupsByDegree = new Map((complex.cohomologyGroups ?? []).map((group) => [group.degree, group]));
  const hh0 = cohomologyGroupsByDegree.get(0);
  if (hh0) {
    const heading = document.createElement("div");
    heading.className = "ambiguity-degree";
    heading.textContent = `Vertex term k Gamma[-1]||B (dim=${hh0.term.dimension})`;
    output.appendChild(heading);
    appendCohomologySummary(output, hh0);
    appendCohomologyRepresentatives(output, state, hh0, rowIndex);
  }
  for (let index = 0; index < complex.terms.length; index += 1) {
    if (index > 0 || hh0) {
      output.appendChild(document.createElement("hr")).className = "ambiguity-divider";
    }
    const nextTerm = complex.terms[index + 1];
    const differential = complex.coboundaries[index];
    appendHochschildTerm(output, state, complex.terms[index], nextTerm, differential, rowIndex);
    if (nextTerm && differential && state.expandedHochschildDifferentials.has(complex.terms[index].degree)) {
      appendExpandedHochschildDifferential(output, complex.terms[index], nextTerm, differential, rowIndex);
    }
    const cohomologyGroup = cohomologyGroupsByDegree.get(complex.terms[index].degree + 1);
    if (cohomologyGroup) {
      appendCohomologySummary(output, cohomologyGroup);
      appendCohomologyRepresentatives(output, state, cohomologyGroup, rowIndex);
    }
  }
}

export function selectAmbiguity(state: WorkbenchState, degree: number, index: number): void {
  const ambiguity = ambiguityByIndex(state, degree, index);
  if (!ambiguity) {
    return;
  }
  state.selectedRelationIndex = -1;
  state.selectedAmbiguityId = ambiguityRowId(degree, index);
  state.selectedHochschildBasisId = null;
  clearRelationAnimation(state);
  resetCanvasEdgeStyles(state);
  document.querySelectorAll("#relOutput .relationRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#ambiguityOutput .ambiguityRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#hochschildComplexOutput .hochschildRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#ambiguityOutput .ambiguity-piece").forEach((piece) => piece.classList.remove("is-pair-highlighted", "is-flow-current"));
  const row = document.querySelector(`#ambiguityOutput [data-ambiguity-id="${state.selectedAmbiguityId}"]`);
  row?.classList.add("selectedRelationRow");
  animateAmbiguity(state, ambiguity, row);
}

export function selectHochschildBasis(state: WorkbenchState, degree: number, index: number): void {
  const basisElement = hochschildBasisByIndex(state, degree, index);
  if (!basisElement) {
    return;
  }
  state.selectedRelationIndex = -1;
  state.selectedAmbiguityId = null;
  state.selectedHochschildBasisId = hochschildBasisRowId(degree, index);
  state.selectedHochschildRepresentativeId = null;
  clearRelationAnimation(state);
  resetCanvasEdgeStyles(state);
  document.querySelectorAll("#relOutput .relationRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#ambiguityOutput .ambiguityRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#hochschildComplexOutput .hochschildRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  const row = document.querySelector(`#hochschildComplexOutput [data-hochschild-basis-id="${state.selectedHochschildBasisId}"]`);
  row?.classList.add("selectedRelationRow");

  const pColor = relationHighlightColor(0);
  const bColor = relationHighlightColor(1);
  const pPath = underlyingPathOfAmbiguity(basisElement.ambiguity);
  pPath.arrows.forEach((arrow) => {
    state.cy?.getElementById(arrow).style({
      width: 4,
      "line-color": pColor,
      "target-arrow-color": pColor,
      "target-arrow-shape": "triangle"
    });
  });
  basisElement.basisPath.arrows.forEach((arrow) => {
    state.cy?.getElementById(arrow).style({
      width: 5,
      "line-color": bColor,
      "target-arrow-color": bColor,
      "target-arrow-shape": "triangle"
    });
  });
  appendInfoLog(
    `Selecting basis ${formatCochainBasisElement(basisElement)} of the ${degree}-th term of Hochschild complex. (p displayed in orange/amber color, b displayed in blue/green color)`
  );
}

export function selectHochschildRepresentative(state: WorkbenchState, degree: number, index: number): void {
  const representative = hochschildRepresentativeByIndex(state, degree, index);
  if (!representative) {
    return;
  }
  state.selectedRelationIndex = -1;
  state.selectedAmbiguityId = null;
  state.selectedHochschildBasisId = null;
  state.selectedHochschildRepresentativeId = hochschildRepresentativeRowId(degree, index);
  clearRelationAnimation(state);
  resetCanvasEdgeStyles(state);
  document.querySelectorAll("#relOutput .relationRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#ambiguityOutput .ambiguityRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#hochschildComplexOutput .hochschildRow").forEach((row) => row.classList.remove("selectedRelationRow"));

  const representativeRow = document.querySelector(`#hochschildComplexOutput [data-hochschild-representative-id="${state.selectedHochschildRepresentativeId}"]`);
  representativeRow?.classList.add("selectedRelationRow");

  const displayedTermDegree = degree - 1;
  if (displayedTermDegree >= 0) {
    const displayedTerm = state.hochschildComplex?.terms.find((term) => term.degree === displayedTermDegree);
    representative.terms.forEach((term) => {
      const basisIndex = displayedTerm?.basis.indexOf(term.basisElement) ?? -1;
      if (basisIndex >= 0) {
        document
          .querySelector(`#hochschildComplexOutput [data-hochschild-basis-id="${hochschildBasisRowId(displayedTermDegree, basisIndex)}"]`)
          ?.classList.add("selectedRelationRow");
      }
    });
  }

  const pColor = relationHighlightColor(0);
  const bColor = relationHighlightColor(1);
  representative.terms.forEach((term) => {
    underlyingPathOfAmbiguity(term.basisElement.ambiguity).arrows.forEach((arrow) => {
      state.cy?.getElementById(arrow).style({
        width: 4,
        "line-color": pColor,
        "target-arrow-color": pColor,
        "target-arrow-shape": "triangle"
      });
    });
    term.basisElement.basisPath.arrows.forEach((arrow) => {
      state.cy?.getElementById(arrow).style({
        width: 5,
        "line-color": bColor,
        "target-arrow-color": bColor,
        "target-arrow-shape": "triangle"
      });
    });
  });
  appendInfoLog(
    `Selecting representative HH^${degree}.${index + 1}. (p displayed in orange/amber color, b displayed in blue/green color; multiple summands are highlighted)`
  );
}

export function validateRelationArrowReferences(relations: RelationData[], cyInstance: any): boolean {
  if (!cyInstance) {
    return true;
  }
  const arrows = new Set(cyInstance.edges().map((edge: any) => edge.id()));
  const missing = [...relationArrowNames(relations)].filter((name) => !arrows.has(name));
  if (missing.length > 0) {
    setError(`Relations refer to unknown arrow(s): ${[...new Set(missing)].join(", ")}`);
    return false;
  }
  return true;
}

export function renameArrowInRelations(oldName: string, newName: string, relations: RelationData[], cyInstance: any, state: WorkbenchState): boolean {
  if (!relations.length) {
    return false;
  }

  let renamed = false;
  for (const relation of relations) {
    if (!relation.terms) {
      continue;
    }
    let relationChanged = false;
    for (const term of relation.terms) {
      for (let index = 0; index < term.monomial.length; index += 1) {
        if (term.monomial[index] === oldName) {
          term.monomial[index] = newName;
          relationChanged = true;
          renamed = true;
        }
      }
    }
    if (relationChanged) {
      relation.reln = formatRelationData(relation);
    }
  }

  if (renamed) {
    clearAmbiguityResults(state);
    validateRelationArrowReferences(relations, cyInstance);
    refreshRelationsOutput(state);
  }
  return renamed;
}

export function refreshRelationsOutput(state: WorkbenchState): void {
  state.addRelationMode = false;
  refreshRelationPanelTabs(state);
  const output = document.getElementById("relOutput");
  if (!output) {
    return;
  }
  output.innerHTML = "";
  output.classList.remove("add-relation-mode");
  output.contentEditable = "false";
  state.selectedRelationIndex = -1;
  state.selectedHochschildBasisId = null;
  state.selectedHochschildRepresentativeId = null;

  state.relations.forEach((relation, index) => {
    const row = document.createElement("div");
    row.classList.add("relationRow");
    row.contentEditable = "false";
    row.setAttribute("id", relation.reln ?? formatRelationData(relation));
    row.innerHTML = formatRelationData(relation, state.activePathOrientation);
    row.addEventListener("click", () => selectRelation(state, index));
    output.appendChild(row);
  });

  const addButton = document.getElementById("btnAddReln") as HTMLInputElement | null;
  if (addButton) {
    addButton.value = "Add relation(s)";
  }
}

export function applyPathOrientationLabel(state: WorkbenchState): void {
  document.querySelectorAll<HTMLButtonElement>("[data-orientation]").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.orientation === state.activePathOrientation ? "true" : "false");
  });
}

export function setPathOrientation(state: WorkbenchState, orientation: "L2R" | "R2L"): void {
  if (orientation !== "L2R" && orientation !== "R2L") {
    return;
  }
  if (orientation === state.activePathOrientation) {
    applyPathOrientationLabel(state);
    return;
  }

  const relationToSelect = state.selectedRelationIndex;
  state.activePathOrientation = orientation;
  applyPathOrientationLabel(state);

  refreshRelationsOutput(state);
  refreshAmbiguitiesOutput(state);
  refreshHochschildComplexOutput(state);
  if (state.cy && relationToSelect >= 0 && relationToSelect < state.relations.length) {
    selectRelation(state, relationToSelect);
  }
}

export function clearRelationAnimation(state: WorkbenchState): void {
  if (!state.animationTimer) {
    return;
  }
  clearInterval(state.animationTimer);
  state.animationTimer = null;
}

function animateAmbiguity(state: WorkbenchState, ambiguity: Ambiguity, row: Element | null): void {
  if (!state.cy) {
    return;
  }
  const nonVertexPieces = ambiguity.pieces
    .map((piece, pieceIndex) => ({ piece, pieceIndex }))
    .filter(({ piece }) => piece.arrows.length > 0);
  if (nonVertexPieces.length < 2) {
    const onlyPiece = nonVertexPieces[0];
    setAmbiguityPieceClasses(row, onlyPiece?.pieceIndex ?? -1, new Set(onlyPiece ? [onlyPiece.pieceIndex] : []));
    return;
  }

  const color = relationHighlightColor(Math.max(0, ambiguity.n));
  const flowColor = "#dafd13";
  const stepsPerArrow = 36;
  let step = 0;
  const totalArrows = nonVertexPieces.reduce((sum, { piece }) => sum + piece.arrows.length, 0);
  const totalSteps = Math.max(1, totalArrows * stepsPerArrow);

  state.animationTimer = setInterval(() => {
    resetCanvasEdgeStyles(state);
    const currentArrowOffset = Math.min(totalArrows - 1, Math.floor(step / stepsPerArrow));
    let consumedArrows = 0;
    let currentPiecePosition = 0;
    for (let index = 0; index < nonVertexPieces.length; index += 1) {
      const pieceLength = nonVertexPieces[index].piece.arrows.length;
      if (currentArrowOffset < consumedArrows + pieceLength) {
        currentPiecePosition = index;
        break;
      }
      consumedArrows += pieceLength;
    }

    const currentPiece = nonVertexPieces[currentPiecePosition];
    const nextPiece = nonVertexPieces[currentPiecePosition + 1];
    const highlightedPieceIndexes = new Set<number>([currentPiece.pieceIndex]);
    if (nextPiece) {
      highlightedPieceIndexes.add(nextPiece.pieceIndex);
    }
    setAmbiguityPieceClasses(row, currentPiece.pieceIndex, highlightedPieceIndexes);

    const highlightedArrows = new Set<string>();
    for (const { pieceIndex, piece } of nonVertexPieces) {
      if (highlightedPieceIndexes.has(pieceIndex)) {
        piece.arrows.forEach((arrow) => highlightedArrows.add(arrow));
      }
    }
    highlightedArrows.forEach((arrow) => {
      const edge = state.cy.getElementById(arrow);
      edge.style({
        width: 3,
        "line-color": color,
        "target-arrow-color": color,
        "target-arrow-shape": "triangle"
      });
    });

    const currentPieceLocalArrow = currentArrowOffset - consumedArrows;
    const currentArrow = currentPiece.piece.arrows[currentPieceLocalArrow];
    const localProgress = (step % stepsPerArrow) / stepsPerArrow;
    const center = localProgress * 100;
    const start = Math.max(0, center - 18);
    const end = Math.min(100, center + 18);
    state.cy.getElementById(currentArrow).style({
      width: 5,
      "line-fill": "linear-gradient",
      "line-gradient-stop-colors": `${color} ${color} ${flowColor} ${color} ${color}`,
      "line-gradient-stop-positions": `0 ${start} ${center} ${end} 100`
    });

    step += 1;
    if (step > totalSteps) {
      clearRelationAnimation(state);
      resetCanvasEdgeStyles(state);
      setAmbiguityPieceClasses(row, -1, new Set());
    }
  }, 60);
}

export function selectRelation(state: WorkbenchState, index: number): void {
  state.selectedRelationIndex = index;
  state.selectedAmbiguityId = null;
  state.selectedHochschildBasisId = null;
  state.selectedHochschildRepresentativeId = null;
  clearRelationAnimation(state);
  if (!state.cy) {
    return;
  }

  const rows = document.querySelectorAll("#relOutput .relationRow");
  resetCanvasEdgeStyles(state);

  rows.forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#ambiguityOutput .ambiguityRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#hochschildComplexOutput .hochschildRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#ambiguityOutput .ambiguity-piece").forEach((piece) => piece.classList.remove("is-pair-highlighted", "is-flow-current"));
  if (index < 0 || index >= rows.length || index >= state.relations.length) {
    return;
  }

  rows[index].classList.add("selectedRelationRow");
  const color = relationHighlightColor(index);
  const pathsToAnimate: any[][] = [];
  let allEdges = state.cy.collection();
  for (const term of state.relations[index].terms ?? []) {
    const edgesInPath: any[] = [];
    for (const arrow of term.monomial) {
      const edge = state.cy.getElementById(arrow);
      edgesInPath.push(edge);
      allEdges = allEdges.union(edge);
    }
    pathsToAnimate.push(edgesInPath);
  }

  allEdges.style({
    width: 2,
    "line-color": color,
    "target-arrow-color": color,
    "target-arrow-shape": "triangle"
  });
  allEdges.style({
    "line-fill": "linear-gradient",
    "line-gradient-stop-colors": `${color} ${color} #dafd13 ${color} ${color}`,
    "line-gradient-stop-positions": "0 0 0 0 0"
  });

  let position = 0;
  state.animationTimer = setInterval(() => {
    position = (position + 4) % 200;
    const t = position / 200;
    const edgeUpdates = new Map<string, { stops: number[]; colors: string[] }>();

    for (const path of pathsToAnimate) {
      const length = path.length;
      const globalPosition = t * length * 100;
      for (let edgeIndex = 0; edgeIndex < length; edgeIndex += 1) {
        const edge = path[edgeIndex];
        const edgeId = edge.id();
        const localCenter = globalPosition - edgeIndex * 100;
        const isVisible = localCenter >= -20 && localCenter <= 120;
        if (!isVisible) {
          continue;
        }
        const distance = Math.abs(localCenter - 50);
        const highlightWidth = Math.max(8, 26 - distance * 0.18);
        const start = Math.max(0, Math.min(100, localCenter - highlightWidth));
        const middle = Math.max(0, Math.min(100, localCenter));
        const end = Math.max(0, Math.min(100, localCenter + highlightWidth));
        const update = edgeUpdates.get(edgeId) ?? { stops: [], colors: [] };
        update.stops.push(0, start, middle, end, 100);
        update.colors.push(color, color, "#dafd13", color, color);
        edgeUpdates.set(edgeId, update);
      }
    }

    for (const [edgeId, update] of edgeUpdates) {
      state.cy.getElementById(edgeId).style({
        "line-fill": "linear-gradient",
        "line-gradient-stop-colors": update.colors.join(" "),
        "line-gradient-stop-positions": update.stops.join(" ")
      });
    }
  }, 45);
}

export function editSelectedRelation(state: WorkbenchState): void {
  if (!state.relations.length) {
    setError("No relation to edit.");
    return;
  }
  if (state.selectedRelationIndex < 0 || state.selectedRelationIndex >= state.relations.length) {
    setError("Please select a relation to edit.");
    return;
  }
  const current = formatRelationDataForInput(state.relations[state.selectedRelationIndex]);
  const relationInput = prompt("Edit relation:", current);
  if (relationInput === null) {
    return;
  }

  try {
    const relation = parseSingleRelation(relationInput, quiverFromCytoscape(state.cy), {
      forceArrowIds: (document.getElementById("forceArrow") as HTMLInputElement | null)?.checked ?? false,
      forceVertexIds: (document.getElementById("forceID") as HTMLInputElement | null)?.checked ?? false
    });
    state.relations[state.selectedRelationIndex] = relation;
    const relationToSelect = state.selectedRelationIndex;
    clearAmbiguityResults(state);
    refreshRelationsOutput(state);
    selectRelation(state, relationToSelect);
  } catch (error) {
    setError((error as Error).message);
  }
}

function ensureAddRelationEditor(): HTMLElement {
  let editor = document.getElementById("addRelationEditor");
  if (editor) {
    return editor;
  }
  editor = document.createElement("div");
  editor.id = "addRelationEditor";
  editor.className = "relationRow add-relation-editor";
  editor.contentEditable = "true";
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const button = document.getElementById("btnAddReln");
      button?.click();
    }
  });
  document.getElementById("relOutput")?.appendChild(editor);
  return editor;
}

export function enterAddRelationMode(state: WorkbenchState): void {
  if (!state.cy) {
    setError("Draw a quiver before adding relations.");
    return;
  }
  state.addRelationMode = true;
  const output = document.getElementById("relOutput");
  output?.classList.add("add-relation-mode");
  const editor = ensureAddRelationEditor();
  editor.focus();
  const addButton = document.getElementById("btnAddReln") as HTMLInputElement | null;
  if (addButton) {
    addButton.value = "Save added relations";
  }
}

export function exitAddRelationMode(state: WorkbenchState, commitChanges = true): void {
  const editor = document.getElementById("addRelationEditor");
  const addedText = editor?.innerText.trim() ?? "";
  if (commitChanges && addedText !== "") {
    try {
      const { relations } = parseRelationEntries(addedText, quiverFromCytoscape(state.cy), {
        forceArrowIds: (document.getElementById("forceArrow") as HTMLInputElement | null)?.checked ?? false,
        forceVertexIds: (document.getElementById("forceID") as HTMLInputElement | null)?.checked ?? false
      });
      if (relations.length === 0) {
        setError("No valid relation entered.");
      } else {
        state.relations = state.relations.concat(relations);
        clearAmbiguityResults(state);
      }
    } catch (error) {
      setError((error as Error).message);
    }
  }
  editor?.remove();
  state.addRelationMode = false;
  refreshRelationsOutput(state);
}

export function toggleAddRelationMode(state: WorkbenchState): void {
  if (state.addRelationMode) {
    exitAddRelationMode(state, true);
  } else {
    enterAddRelationMode(state);
  }
}

export function guardRelationOutputEdit(state: WorkbenchState, event: InputEvent): void {
  if (state.addRelationMode && event.target instanceof Node && document.getElementById("addRelationEditor")?.contains(event.target)) {
    return;
  }
  event.preventDefault();
}

export function focusAddRelationEditor(state: WorkbenchState, event: MouseEvent): void {
  if (!state.addRelationMode) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target?.closest(".relationRow")) {
    return;
  }
  const editor = document.getElementById("addRelationEditor");
  if (editor && !editor.contains(target)) {
    event.preventDefault();
    editor.focus();
  }
}

export function removeRelationsUsingArrows(state: WorkbenchState, removedArrows: string[]): void {
  if (!removedArrows.length) {
    return;
  }
  state.relations = state.relations.filter((relation) => !(relation.terms ?? []).some((term) => term.monomial.some((arrow) => removedArrows.includes(arrow))));
  clearAmbiguityResults(state);
  refreshRelationsOutput(state);
}

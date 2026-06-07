import type { RelationData } from "../backend/relations";
import {
  formatRelationData,
  formatRelationDataForInput,
  relationArrowNames
} from "../backend/relations";
import { parseRelationEntries, parseSingleRelation, quiverFromCytoscape } from "../backend/qpa-translator";
import type { WorkbenchState } from "./workbench-state";
import { setError } from "./log-panel";
import { cytoThemeColors, relationHighlightColor } from "./cytoscape-style";

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
    validateRelationArrowReferences(relations, cyInstance);
    refreshRelationsOutput(state);
  }
  return renamed;
}

export function refreshRelationsOutput(state: WorkbenchState): void {
  state.addRelationMode = false;
  const output = document.getElementById("relOutput");
  if (!output) {
    return;
  }
  output.innerHTML = "";
  output.classList.remove("add-relation-mode");
  output.contentEditable = "false";
  state.selectedRelationIndex = -1;

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

export function selectRelation(state: WorkbenchState, index: number): void {
  state.selectedRelationIndex = index;
  clearRelationAnimation(state);
  if (!state.cy) {
    return;
  }

  const rows = document.querySelectorAll("#relOutput .relationRow");
  const colors = cytoThemeColors();
  for (const edge of state.cy.edges()) {
    edge.style({
      width: 2,
      "line-color": colors.edge,
      "target-arrow-color": colors.edge,
      "target-arrow-shape": "triangle",
      "curve-style": "bezier"
    });
    edge.removeStyle("line-fill line-gradient-stop-colors line-gradient-stop-positions");
  }

  rows.forEach((row) => row.classList.remove("selectedRelationRow"));
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
    "target-arrow-shape": "triangle",
    "curve-style": "bezier"
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
  refreshRelationsOutput(state);
}

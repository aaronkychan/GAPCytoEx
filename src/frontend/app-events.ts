import { parseQpaInput } from "../backend/qpa-translator";
import type { WorkbenchState } from "./workbench-state";
import { bendArrow, clearAll, createInitialVertexAtClick, doubleQuiver, presentData } from "./cytoscape-view";
import { editSelectedRelation, focusAddRelationEditor, guardRelationOutputEdit, selectRelation, setPathOrientation, setRelationPanelTab, toggleAddRelationMode } from "./relation-ui";
import { appendInfoLog, setError, setFieldCharacteristic, setOutputHtml } from "./log-panel";
import { loadJsonFile, saveFile, translateToQpa } from "./file-actions";
import { applyTheme, initialTheme, toggleTheme } from "./theme";
import { computeAndRenderAmbiguities, computeAndRenderHochschildCohomology, computeAndRenderHochschildComplex } from "./computation-controller";

function bindClick(id: string, handler: (event: MouseEvent) => void): void {
  document.getElementById(id)?.addEventListener("click", (event) => handler(event as MouseEvent));
}

let lastDrawnQpaInput = "";

const RANK_4_NAKAYAMA_QPA = `Quiver(["v1","v2","v3","v4"], [["v1","v2","a"],["v2","v3","b"],["v3","v4","c"],["v4","v1","d"]])
[(+1)*a*b*c, (+1)*c*d*a]`;

const ALOS_RANK_3_MONOMIAL_QPA = `Quiver(["v1","v2","v3"], [["v1","v2","a"],["v1","v3","b"],["v3","v2","c"],["v2","v1","z"]])
[(+1)*z*b, (+1)*c*z, (+1)*a*z*a, (+1)*z*a*z]`;

function cyclicArrowIndex(index: number, rank: number): number {
  return ((index - 1) % rank) + 1;
}

function cyclicBrauerStarRelation(rank: number, startIndex: number): string {
  const arrows: string[] = [];
  for (let offset = 0; offset <= rank + 1; offset += 1) {
    arrows.push(`a${cyclicArrowIndex(startIndex + offset, rank)}`);
  }
  return arrows.join("*");
}

function buildBrauerStarQpa(rank: number): string {
  const vertices = Array.from({ length: rank }, (_, index) => `"v${index + 1}"`);
  const arrows = Array.from({ length: rank }, (_, index) => {
    const source = index + 1;
    const target = cyclicArrowIndex(source + 1, rank);
    return `["v${source}","v${target}","a${source}"]`;
  });
  arrows.push(`["v1","v1","b"]`);

  const cycle = Array.from({ length: rank }, (_, index) => `a${index + 1}`).join("*");
  const relations = [
    ...Array.from({ length: rank }, (_, index) => `(+1)*${cyclicBrauerStarRelation(rank, index + 1)}`),
    `(+1)*b*b+(-1)*${cycle}`,
    "(+1)*b*a1",
    `(+1)*a${rank}*b`,
    "(+1)*b*b*b"
  ];

  return `Quiver([${vertices.join(",")}], [${arrows.join(",")}])\n[${relations.join(", ")}]`;
}

function promptBrauerStarRank(): void {
  const input = prompt("Rank n for Brauer star (1-9):", "3");
  if (input === null) {
    return;
  }
  const rank = Number(input);
  if (!Number.isInteger(rank) || rank < 1 || rank >= 10) {
    setError("rank-n Brauer star requires an integer rank n with 1 <= n < 10.");
    return;
  }
  replaceQpaInput(buildBrauerStarQpa(rank));
}

function bindMaxPathLengthTooltip(): void {
  const button = document.getElementById("maxPathLengthInfo") as HTMLButtonElement | null;
  const control = button?.closest(".max-path-control");
  if (!button || !control) {
    return;
  }
  const closeTooltip = (): void => {
    control.classList.remove("is-tooltip-open");
    button.setAttribute("aria-expanded", "false");
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = control.classList.toggle("is-tooltip-open");
    button.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", (event) => {
    if (!control.contains(event.target as Node)) {
      closeTooltip();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTooltip();
    }
  });
}

function replaceQpaInput(value: string): void {
  const input = document.getElementById("inQuiver") as HTMLTextAreaElement | null;
  if (input) {
    input.value = value;
    updateDrawButtonLabel();
  }
}

function currentQpaInputValue(): string {
  return (document.getElementById("inQuiver") as HTMLTextAreaElement | null)?.value ?? "";
}

function updateDrawButtonLabel(): void {
  const button = document.getElementById("translateBtn") as HTMLButtonElement | null;
  if (!button) {
    return;
  }
  button.textContent = currentQpaInputValue() !== lastDrawnQpaInput
    ? "Update canvas"
    : "Draw to canvas";
}

export function translateQpaFromInputs(state: WorkbenchState): void {
  try {
    const qpaInput = currentQpaInputValue();
    const relationInput = (document.getElementById("inRelation") as HTMLTextAreaElement | null)?.value ?? "";
    const result = parseQpaInput(qpaInput, relationInput, {
      forceVertexIds: (document.getElementById("forceID") as HTMLInputElement | null)?.checked ?? false,
      forceArrowIds: (document.getElementById("forceArrow") as HTMLInputElement | null)?.checked ?? false
    });
    state.activeFieldCharacteristic = result.characteristic;
    setFieldCharacteristic(result.characteristic, true);
    const nodes = result.elements.filter((element) => element.group === "nodes");
    const edges = result.elements.filter((element) => element.group === "edges");
    presentData(state, { nodes, edges }, result.relations);
    lastDrawnQpaInput = qpaInput;
    updateDrawButtonLabel();
  } catch (error) {
    setError((error as Error).message);
  }
}

export function bindWorkbenchEvents(state: WorkbenchState): void {
  applyTheme(state, initialTheme());

  bindClick("bendLeft", () => bendArrow(state, "L"));
  bindClick("bendRight", () => bendArrow(state, "R"));
  bindClick("fixCyto", () => state.cy?.fit());
  bindClick("saveSVG", () => saveFile(state, "svg"));
  bindClick("saveJSON", () => saveFile(state, "json"));
  bindClick("themeToggle", () => toggleTheme(state));
  bindClick("translateBtn", () => translateQpaFromInputs(state));
  bindClick("btnDoubleQuiver", () => doubleQuiver(state));
  bindClick("btnUnselectRelns", () => selectRelation(state, -1));
  bindClick("btnAddReln", () => toggleAddRelationMode(state));
  bindClick("btnEditReln", () => editSelectedRelation(state));
  bindClick("toQPABtn", () => translateToQpa(state));
  bindClick("computeAmbiguitiesBtn", () => computeAndRenderAmbiguities(state));
  bindClick("computeHochschildComplexBtn", () => computeAndRenderHochschildComplex(state));
  bindClick("computeHochschildCohomologyBtn", () => computeAndRenderHochschildCohomology(state));
  bindClick("resetCanvasRelations", () => {
    clearAll(state);
    updateDrawButtonLabel();
  });
  bindClick("clearOutput", () => setOutputHtml(""));
  bindClick("rank4NakayamaPreset", () => replaceQpaInput(RANK_4_NAKAYAMA_QPA));
  bindClick("alosRank3Preset", () => replaceQpaInput(ALOS_RANK_3_MONOMIAL_QPA));
  bindClick("brauerStarPreset", () => promptBrauerStarRank());
  bindClick("clearQuiverInput", () => {
    const input = document.getElementById("inQuiver") as HTMLTextAreaElement | null;
    if (input) {
      input.value = "";
      updateDrawButtonLabel();
    }
  });
  bindClick("clearRelationInput", () => {
    const input = document.getElementById("inRelation") as HTMLTextAreaElement | null;
    if (input) {
      input.value = "";
    }
  });

  document.getElementById("loadJsonBtn")?.addEventListener("change", (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      loadJsonFile(state, file);
    }
  });

  document.getElementById("inQuiver")?.addEventListener("input", () => updateDrawButtonLabel());

  document.querySelectorAll<HTMLInputElement>('input[name="editMode"]').forEach((element) => {
    element.addEventListener("change", (event) => {
      const value = (event.target as HTMLInputElement).value;
      if (value === "default" || value === "add" || value === "rename" || value === "delete") {
        state.mode = value;
      }
      state.cy?.elements().unselect();
    });
  });

  document.getElementById("relOutput")?.addEventListener("beforeinput", (event) => guardRelationOutputEdit(state, event as InputEvent));
  document.getElementById("relOutput")?.addEventListener("mousedown", (event) => focusAddRelationEditor(state, event));
  document.querySelectorAll<HTMLButtonElement>("[data-relation-panel-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.relationPanelTab;
      if (tab === "relations" || tab === "ambiguities" || tab === "hochschild-complex") {
        setRelationPanelTab(state, tab);
      }
    });
  });
  document.getElementById("wriggle")?.addEventListener("click", () => {
    state.cy?.layout({ name: "cose", animate: true, animationDuration: 1500, randomize: false, nodeDimensionsIncludeLabels: true }).run();
  });
  document.getElementById("cy")?.addEventListener("click", (event) => createInitialVertexAtClick(state, event));

  document.querySelectorAll<HTMLButtonElement>("[data-orientation]").forEach((button) => {
    button.addEventListener("click", () => {
      const orientation = button.dataset.orientation;
      if (orientation === "L2R" || orientation === "R2L") {
        setPathOrientation(state, orientation);
      }
    });
  });

  lastDrawnQpaInput = currentQpaInputValue();
  setPathOrientation(state, state.activePathOrientation);
  setFieldCharacteristic(0, false);
  bindMaxPathLengthTooltip();
  updateDrawButtonLabel();
  appendInfoLog("Ready.");
}

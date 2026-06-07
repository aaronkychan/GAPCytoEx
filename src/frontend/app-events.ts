import { parseQpaInput } from "../backend/qpa-translator";
import type { WorkbenchState } from "./workbench-state";
import { bendArrow, clearAll, createInitialVertexAtClick, doubleQuiver, presentData } from "./cytoscape-view";
import { editSelectedRelation, focusAddRelationEditor, guardRelationOutputEdit, selectRelation, setPathOrientation, setRelationPanelTab, toggleAddRelationMode } from "./relation-ui";
import { appendInfoLog, setError, setFieldCharacteristic, setOutputHtml } from "./log-panel";
import { loadJsonFile, saveFile, translateToQpa } from "./file-actions";
import { applyTheme, initialTheme, toggleTheme } from "./theme";
import { computeAndRenderAmbiguities } from "./computation-controller";

function bindClick(id: string, handler: (event: MouseEvent) => void): void {
  document.getElementById(id)?.addEventListener("click", (event) => handler(event as MouseEvent));
}

export function translateQpaFromInputs(state: WorkbenchState): void {
  try {
    const qpaInput = (document.getElementById("inQuiver") as HTMLTextAreaElement | null)?.value ?? "";
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
  bindClick("resetCanvasRelations", () => clearAll(state));
  bindClick("clearOutput", () => setOutputHtml(""));
  bindClick("clearQuiverInput", () => {
    const input = document.getElementById("inQuiver") as HTMLTextAreaElement | null;
    if (input) {
      input.value = "";
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
      if (tab === "relations" || tab === "ambiguities") {
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

  setPathOrientation(state, state.activePathOrientation);
  setFieldCharacteristic(0, false);
  appendInfoLog("Ready.");
}

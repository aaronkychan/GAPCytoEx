import type { WorkbenchState } from "./workbench-state";
import { exportQpa } from "../backend/qpa-translator";
import { presentData } from "./cytoscape-view";
import { setOutputHtml } from "./log-panel";

declare const saveAs: (blob: Blob, filename: string) => void;

export function saveFile(state: WorkbenchState, type: "svg" | "json"): void {
  if (!state.cy) {
    return;
  }

  let content: string;
  let blob: Blob;
  if (type === "svg") {
    content = state.cy.svg({ scale: 1, full: true, bg: "#ffffff" });
    blob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });
  } else {
    content = JSON.stringify({ cy: state.cy.json(), reln: state.relations });
    blob = new Blob([content], { type: "application/json;charset=utf-8" });
  }

  const filename = (document.getElementById("filenameInput") as HTMLInputElement | null)?.value ?? "quiver";
  saveAs(blob, `${filename}.${type}`);
}

export function loadJsonFile(state: WorkbenchState, file: File): void {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const result = JSON.parse(`${reader.result}`);
    presentData(state, result.cy.elements, result.reln, true);
  });
  reader.readAsText(file);
}

export function translateToQpa(state: WorkbenchState): void {
  if (!state.cy) {
    return;
  }
  const qpaCode = exportQpa(state.cy.json().elements, state.relations);
  setOutputHtml(qpaCode);
}

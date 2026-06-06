import { initialState, validateMaxPathLength } from "./app-state";
import { renderOutputPanel } from "./output-panel";
import { bindOrientationControl } from "./orientation-control";
import { renderRelationList } from "./relation-list-panel";
import "./splitters";

const state = initialState();

const relationList = document.getElementById("relation-list");
const infoStatus = document.getElementById("info-status");
const outputPanel = document.getElementById("output-panel");
const maxPathLength = document.getElementById("max-path-length") as HTMLInputElement | null;

declare global {
  interface Window {
    cy?: { fit: () => void; resize?: () => void };
    GAPCytoEx?: {
      setPathOrientation?: (orientation: "L2R" | "R2L") => void;
      splittersBound?: {
        info: boolean;
        relations: boolean;
      };
    };
  }
}

function render(): void {
  if (relationList) {
    renderRelationList(relationList, state.relations, state.orientation.active, state.selectedRelationId, (relationId) => {
      state.selectedRelationId = relationId;
      render();
    });
  }
  if (infoStatus) {
    infoStatus.textContent = state.infoMessage;
    infoStatus.classList.toggle("status-warn", state.infoMessage.startsWith("maxPathLength"));
  }
  if (outputPanel) {
    renderOutputPanel(outputPanel, state);
  }
}

function applyLegacyPathOrientation(orientation: "L2R" | "R2L"): void {
  window.GAPCytoEx?.setPathOrientation?.(orientation);
}

bindOrientationControl((orientation) => {
  state.orientation.active = orientation;
  applyLegacyPathOrientation(orientation);
  render();
});

maxPathLength?.addEventListener("input", () => {
  const value = Number(maxPathLength.value);
  state.maxPathLength = value;
  state.infoMessage = validateMaxPathLength(value) ?? "Ready.";
  render();
});

render();
applyLegacyPathOrientation(state.orientation.active);
window.addEventListener("load", () => applyLegacyPathOrientation(state.orientation.active), { once: true });

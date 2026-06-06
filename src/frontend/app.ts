import { initialState, validateMaxPathLength } from "./app-state";
import { renderInfoPanel } from "./info-panel";
import { renderOutputPanel } from "./output-panel";
import { bindOrientationControl } from "./orientation-control";
import { renderRelationList } from "./relation-list-panel";

const state = initialState();

const relationOrientation = document.getElementById("relation-orientation");
const relationList = document.getElementById("relation-list");
const infoPanel = document.getElementById("info-panel");
const infoStatus = document.getElementById("info-status");
const outputPanel = document.getElementById("output-panel");
const maxPathLength = document.getElementById("max-path-length") as HTMLInputElement | null;

declare global {
  interface Window {
    cy?: { fit: () => void; resize?: () => void };
  }
}

function render(): void {
  if (relationOrientation) {
    relationOrientation.textContent = `Path orientation: ${state.orientation.active === "L2R" ? "left-to-right" : "right-to-left"}`;
  }
  if (relationList) {
    renderRelationList(relationList, state.relations, state.orientation.active, state.selectedRelationId, (relationId) => {
      state.selectedRelationId = relationId;
      render();
    });
  }
  if (infoPanel) {
    renderInfoPanel(infoPanel, state);
  }
  if (infoStatus) {
    infoStatus.textContent = state.infoMessage;
    infoStatus.classList.toggle("status-warn", state.infoMessage.startsWith("maxPathLength"));
  }
  if (outputPanel) {
    renderOutputPanel(outputPanel, state);
  }
}

bindOrientationControl((orientation) => {
  state.orientation.active = orientation;
  state.infoMessage = `Display convention changed to ${orientation}.`;
  render();
});

maxPathLength?.addEventListener("input", () => {
  const value = Number(maxPathLength.value);
  state.maxPathLength = value;
  state.infoMessage = validateMaxPathLength(value) ?? "Ready.";
  render();
});

render();

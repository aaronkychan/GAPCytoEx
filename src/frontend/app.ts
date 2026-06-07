import { createWorkbenchState } from "./workbench-state";
import { bindWorkbenchEvents } from "./app-events";
import "./splitters";

const state = createWorkbenchState();
const maxPathLength = document.getElementById("max-path-length") as HTMLInputElement | null;

declare global {
  interface Window {
    cy?: { fit: () => void; resize?: () => void };
  }
}

maxPathLength?.addEventListener("input", () => {
  const value = Number(maxPathLength.value);
  if (Number.isFinite(value) && value >= 20) {
    return;
  }
  const infoStatus = document.getElementById("info-status");
  if (infoStatus) {
    infoStatus.textContent = "maxPathLength must be at least 20.";
    infoStatus.classList.add("status-warn");
  }
});

bindWorkbenchEvents(state);

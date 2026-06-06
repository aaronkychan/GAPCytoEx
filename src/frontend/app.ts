import { initialState } from "./app-state";
import { bindOrientationControl } from "./orientation-control";

const state = initialState();

const relationOrientation = document.getElementById("relation-orientation");
const infoStatus = document.getElementById("info-status");
const maxPathLength = document.getElementById("max-path-length") as HTMLInputElement | null;

bindOrientationControl((orientation) => {
  state.orientation.active = orientation;
  if (relationOrientation) {
    relationOrientation.textContent = `Display convention: ${orientation}`;
  }
});

maxPathLength?.addEventListener("input", () => {
  const value = Number(maxPathLength.value);
  state.maxPathLength = value;
  if (infoStatus) {
    infoStatus.textContent = value < 20 ? "maxPathLength must be at least 20." : "Ready.";
  }
});

import type { FrontendState } from "./app-state";
import { formatRelationPath } from "./relation-list-panel";

export function renderInfoPanel(root: HTMLElement, state: FrontendState): void {
  const selectedRelation = state.relations.find((relation) => relation.id === state.selectedRelationId);
  root.innerHTML = "";

  const status = document.createElement("div");
  status.className = state.infoMessage.startsWith("maxPathLength") ? "status status-warn" : "status";
  status.textContent = state.infoMessage;

  const summary = document.createElement("dl");
  summary.className = "info-grid";
  summary.append(
    infoItem("Vertices", String(state.quiver.vertices.length)),
    infoItem("Arrows", String(state.quiver.arrows.length)),
    infoItem("Relations", String(state.relations.length)),
    infoItem("Convention", state.orientation.active),
    infoItem("maxPathLength", String(state.maxPathLength))
  );

  root.append(status, summary);

  if (selectedRelation) {
    const selected = document.createElement("div");
    selected.className = "selected-detail";
    selected.innerHTML = `
      <h3>Selected relation</h3>
      <p><strong>${selectedRelation.id}</strong> <span class="path-word">${formatRelationPath(
        selectedRelation,
        state.orientation.active
      )}</span></p>
    `;
    root.append(selected);
  }
}

function infoItem(label: string, value: string): HTMLElement {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  wrapper.append(term, description);
  return wrapper;
}

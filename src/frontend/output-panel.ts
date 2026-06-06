import type { FrontendState } from "./app-state";

export function renderOutputPanel(root: HTMLElement, state: FrontendState): void {
  root.dataset.activeOrientation = state.orientation.active;
}

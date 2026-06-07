import type { WorkbenchState } from "./workbench-state";
import { applyCytoscapeTheme } from "./cytoscape-view";

export function initialTheme(): "light" | "dark" {
  const savedTheme = localStorage.getItem("gapToCytoTheme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(state: WorkbenchState, theme: "light" | "dark"): void {
  document.body.dataset.theme = theme;
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) {
    return;
  }
  const isDark = theme === "dark";
  themeToggle.textContent = isDark ? "Light theme" : "Dark theme";
  themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
  applyCytoscapeTheme(state);
}

export function toggleTheme(state: WorkbenchState): void {
  const currentTheme = (document.body.dataset.theme as "light" | "dark" | undefined) ?? initialTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("gapToCytoTheme", nextTheme);
  applyTheme(state, nextTheme);
}

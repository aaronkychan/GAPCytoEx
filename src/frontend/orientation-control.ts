import type { PathOrientation } from "../backend/paths";

export function bindOrientationControl(onChange: (orientation: PathOrientation) => void): void {
  document.querySelectorAll<HTMLButtonElement>("[data-orientation]").forEach((button) => {
    button.addEventListener("click", () => {
      const orientation = button.dataset.orientation;
      if (orientation !== "L2R" && orientation !== "R2L") {
        return;
      }
      document.querySelectorAll<HTMLButtonElement>("[data-orientation]").forEach((item) => {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
      onChange(orientation);
    });
  });
}

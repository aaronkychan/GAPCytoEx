function fitCy(): void {
  if (window.cy && typeof window.cy.resize === "function") {
    window.cy.resize();
  }
  if (window.cy && typeof window.cy.fit === "function") {
    window.cy.fit();
  }
}

interface ResizeOptions {
  variableName: string;
  min: number;
  max: number;
  side: "left" | "right";
  gridTemplate: (width: number) => string;
}

declare global {
  interface Window {
    GAPCytoEx?: {
      splittersBound?: {
        info: boolean;
        relations: boolean;
      };
    };
  }
}

function bindHorizontalResize(splitter: HTMLElement | null, target: HTMLElement | null, options: ResizeOptions): void {
  if (!splitter || !target || splitter.dataset.resizeBound === "true") {
    return;
  }
  splitter.dataset.resizeBound = "true";

  function updateWidth(clientX: number): void {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const rawWidth = options.side === "right" ? rect.right - clientX : clientX - rect.left;
    const width = Math.max(options.min, Math.min(options.max, rawWidth));
    const roundedWidth = Math.round(width);
    target.style.setProperty(options.variableName, `${roundedWidth}px`);
    target.style.gridTemplateColumns = options.gridTemplate(roundedWidth);
    fitCy();
  }

  function start(event: MouseEvent | PointerEvent): void {
    if (event.type === "mousedown" && "button" in event && event.button !== 0) {
      return;
    }
    event.preventDefault();
    document.body.classList.add("is-resizing");

    function onMove(moveEvent: MouseEvent | PointerEvent): void {
      updateWidth(moveEvent.clientX);
    }

    function onUp(): void {
      document.body.classList.remove("is-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  splitter.addEventListener("mousedown", start);
  splitter.addEventListener("pointerdown", start);
}

function bindSplittersNow(): void {
  const infoSplitter = document.querySelector<HTMLElement>("[data-resize-splitter='info']");
  const infoTarget = document.querySelector<HTMLElement>(".workbench-grid");
  const relationSplitter = document.querySelector<HTMLElement>("[data-resize-splitter='relations']");
  const relationTarget = document.querySelector<HTMLElement>(".canvas-row");

  bindHorizontalResize(
    infoSplitter,
    infoTarget,
    {
      variableName: "--info-width",
      min: 300,
      max: 620,
      side: "right",
      gridTemplate: (width) => `minmax(0, 1fr) 12px minmax(300px, ${width}px)`
    }
  );

  bindHorizontalResize(
    relationSplitter,
    relationTarget,
    {
      variableName: "--relation-width",
      min: 190,
      max: 520,
      side: "left",
      gridTemplate: (width) => `minmax(190px, ${width}px) 12px minmax(0, 1fr)`
    }
  );

  window.GAPCytoEx = {
    ...(window.GAPCytoEx || {}),
    splittersBound: {
      info: Boolean(infoSplitter && infoTarget),
      relations: Boolean(relationSplitter && relationTarget)
    }
  };
}

function bindSplitters(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSplittersNow, { once: true });
    return;
  }

  bindSplittersNow();
}

bindSplitters();

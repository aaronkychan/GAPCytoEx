(function () {
  function fitCy() {
    if (window.cy && typeof window.cy.resize === "function") {
      window.cy.resize();
    }
    if (window.cy && typeof window.cy.fit === "function") {
      window.cy.fit();
    }
  }

  function bindHorizontalResize(splitter, target, options) {
    if (!splitter || !target || splitter.dataset.resizeBound === "true") {
      return;
    }
    splitter.dataset.resizeBound = "true";

    function updateWidth(clientX) {
      var rect = target.getBoundingClientRect();
      var rawWidth = options.side === "right" ? rect.right - clientX : clientX - rect.left;
      var width = Math.max(options.min, Math.min(options.max, rawWidth));
      target.style.setProperty(options.variableName, Math.round(width) + "px");
      fitCy();
    }

    function start(event) {
      if (event.type === "mousedown" && event.button !== 0) {
        return;
      }
      event.preventDefault();
      document.body.classList.add("is-resizing");

      function onMove(moveEvent) {
        updateWidth(moveEvent.clientX);
      }

      function onUp() {
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

  function bindSplitters() {
    bindHorizontalResize(
      document.querySelector("[data-resize-splitter='info']"),
      document.querySelector(".workbench-grid"),
      { variableName: "--info-width", min: 300, max: 620, side: "right" }
    );

    bindHorizontalResize(
      document.querySelector("[data-resize-splitter='relations']"),
      document.querySelector(".canvas-row"),
      { variableName: "--relation-width", min: 190, max: 520, side: "left" }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSplitters);
  } else {
    bindSplitters();
  }
})();

export function activeTheme(): "light" | "dark" {
  return document.body.dataset.theme === "dark" ? "dark" : "light";
}

export function cytoThemeColors(theme: "light" | "dark" = activeTheme()): {
  nodeFill: string;
  nodeBorder: string;
  nodeText: string;
  selectedNode: string;
  edge: string;
  selectedEdge: string;
  edgeLabel: string;
  edgeLabelOutline: string;
} {
  return theme === "dark"
    ? {
        nodeFill: "#111827",
        nodeBorder: "#cbd5e1",
        nodeText: "#e5edf7",
        selectedNode: "#f87171",
        edge: "#d1d5db",
        selectedEdge: "#93c5fd",
        edgeLabel: "#fca5a5",
        edgeLabelOutline: "#1f2937"
      }
    : {
        nodeFill: "#ffffff",
        nodeBorder: "#000000",
        nodeText: "#000000",
        selectedNode: "#fa5252",
        edge: "#000000",
        selectedEdge: "#7379f4",
        edgeLabel: "#ff1818",
        edgeLabelOutline: "#eeee00"
      };
}

export function relationHighlightColor(index: number): string {
  return activeTheme() === "dark" ? (index % 2 === 0 ? "#fbbf24" : "#86efac") : index % 2 === 0 ? "#ff6f00" : "#0080ff";
}

function coloredEdgeStyle(color: string): Record<string, string | number> {
  return {
    width: 2,
    "line-color": color,
    "target-arrow-color": color,
    "target-arrow-shape": "triangle",
    "curve-style": "bezier",
    "loop-direction": "0deg",
    "loop-sweep": "45deg"
  };
}

export function cytoStyle(theme: "light" | "dark" = activeTheme()): Array<Record<string, unknown>> {
  const colors = cytoThemeColors(theme);
  return [
    {
      selector: "node",
      style: {
        width: 25,
        height: 25,
        shape: "ellipse",
        "background-color": colors.nodeFill,
        "border-width": "1px",
        "border-style": "solid",
        "border-color": colors.nodeBorder,
        color: colors.nodeText,
        content: "data(id)",
        "text-valign": "center",
        "text-halign": "center"
      }
    },
    {
      selector: "node:selected",
      style: {
        "background-color": colors.selectedNode,
        width: 30,
        height: 30
      }
    },
    { selector: "edge", style: coloredEdgeStyle(colors.edge) },
    { selector: "edge:selected", style: coloredEdgeStyle(colors.selectedEdge) },
    {
      selector: "edge[label]",
      style: {
        label: "data(label)",
        color: colors.edgeLabel,
        "font-size": "22pt",
        "font-weight": "bold",
        "text-outline-color": colors.edgeLabelOutline,
        "text-outline-width": 2
      }
    }
  ];
}

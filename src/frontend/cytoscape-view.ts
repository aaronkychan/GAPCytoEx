import type { CytoscapeElementData } from "../backend/qpa-translator";
import { generatedArrowName } from "../backend/qpa-translator";
import type { WorkbenchState } from "./workbench-state";
import { setError, setOutputHtml } from "./log-panel";
import {
    refreshRelationsOutput,
    removeRelationsUsingArrows,
    renameArrowInRelations,
    selectRelation,
} from "./relation-ui";
import { cytoStyle } from "./cytoscape-style";

declare const cytoscape: any;

export function applyCytoscapeTheme(state: WorkbenchState): void {
    if (!state.cy) {
        return;
    }
    state.cy.style(cytoStyle());
    if (state.selectedRelationIndex >= 0) {
        selectRelation(state, state.selectedRelationIndex);
    }
}

function promptNameAndCheck(
    message: string,
    cyInstance: any,
    type: "vertex" | "arrow",
    state: WorkbenchState,
): string | null {
    const autoName =
        (document.getElementById("autoName") as HTMLInputElement | null)
            ?.checked ?? false;
    if (autoName) {
        const prefix = type === "vertex" ? "v" : "a";
        let counter =
            type === "vertex"
                ? state.autoNameVertexCounter
                : state.autoNameArrowCounter;
        let name = `${prefix}${counter}`;
        while (cyInstance && cyInstance.getElementById(name).length !== 0) {
            counter += 1;
            name = `${prefix}${counter}`;
        }
        if (type === "vertex") {
            state.autoNameVertexCounter = counter + 1;
        } else {
            state.autoNameArrowCounter = counter + 1;
        }
        return name;
    }

    const name = prompt(message);
    if (!name) {
        return null;
    }
    if (cyInstance && cyInstance.getElementById(name).length !== 0) {
        setError("Vertex/Arrow with this name already exists.");
        return null;
    }
    return name;
}

function clickOnCanvas(
    event: any,
    cyInstance: any,
    state: WorkbenchState,
): void {
    const target = event.target;
    if (state.mode === "add") {
        if (target === cyInstance) {
            const name = promptNameAndCheck(
                "Enter name for new vertex:",
                cyInstance,
                "vertex",
                state,
            );
            if (name) {
                cyInstance.add({
                    group: "nodes",
                    data: { id: name },
                    position: event.position,
                });
            }
        } else if (target.isNode()) {
            if (state.addingArrow) {
                const name = promptNameAndCheck(
                    "Enter name for new arrow:",
                    cyInstance,
                    "arrow",
                    state,
                );
                if (name) {
                    cyInstance.add({
                        group: "edges",
                        data: {
                            id: name,
                            source: state.sourceNodeId,
                            target: target.id(),
                            label: name,
                        },
                    });
                    state.addingArrow = false;
                    state.sourceNodeId = null;
                    setTimeout(() => target.unselect(), 50);
                }
            } else {
                state.addingArrow = true;
                state.sourceNodeId = target.id();
            }
        }
        return;
    }

    if (state.mode === "delete") {
        if (target !== cyInstance) {
            let removedArrows: string[] = [];
            if (target.isNode()) {
                removedArrows = target
                    .connectedEdges()
                    .map((edge: any) => edge.id());
            } else if (target.isEdge()) {
                removedArrows = [target.id()];
            }
            cyInstance.remove(target);
            removeRelationsUsingArrows(state, removedArrows);
        }
        return;
    }

    if (state.mode === "rename" && target !== cyInstance) {
        const oldId = target.id();
        const type = target.isNode() ? "vertex" : "arrow";
        const newName = promptNameAndCheck(
            `Enter new name for ${type} (current: ${oldId}):`,
            cyInstance,
            type,
            state,
        );
        target.unselect();
        if (!newName) {
            return;
        }

        if (target.isNode()) {
            const edges = target.connectedEdges();
            const edgesJson = edges.jsons();
            const nodeJson = target.json();
            cyInstance.remove(target);
            nodeJson.data.id = newName;
            cyInstance.add(nodeJson);
            edgesJson.forEach((edge: any) => {
                if (edge.data.source === oldId) {
                    edge.data.source = newName;
                }
                if (edge.data.target === oldId) {
                    edge.data.target = newName;
                }
                cyInstance.add(edge);
            });
        } else {
            const edgeJson = target.json();
            cyInstance.remove(target);
            edgeJson.data.id = newName;
            edgeJson.data.label = newName;
            cyInstance.add(edgeJson);
            renameArrowInRelations(
                oldId,
                newName,
                state.relations,
                cyInstance,
                state,
            );
        }
    }
}

export function initCytoscape(
    state: WorkbenchState,
    inputData:
        | { nodes?: CytoscapeElementData[]; edges?: CytoscapeElementData[] }
        | CytoscapeElementData[],
    isPreset = false,
): any {
    const layout = isPreset
        ? { name: "preset", fit: false }
        : {
              name: "breadthfirst",
              fit: true,
              padding: 20,
              nodeDimensionsIncludeLabels: true,
          };
    const cyInstance = cytoscape({
        container: document.getElementById("cy"),
        elements: inputData,
        style: cytoStyle(),
        layout,
        selectionType: "single",
        userZoomingEnabled: true,
        userPanningEnabled: true,
        wheelSensitivity: 0.5,
        pan: { x: 40, y: 40 },
    });
    cyInstance.on("tap", (event: any) =>
        clickOnCanvas(event, cyInstance, state),
    );
    state.cy = cyInstance;
    window.cy = cyInstance;
    return cyInstance;
}

export function presentData(
    state: WorkbenchState,
    quiver: { nodes: CytoscapeElementData[]; edges: CytoscapeElementData[] },
    relations: any[],
    isPreset = false,
): void {
    state.quiverData = quiver;
    state.relations = relations;
    state.monomialComputationContext = null;
    state.ambiguityGroupsByOrientation = null;
    state.hochschildComplex = null;
    state.selectedAmbiguityId = null;
    state.selectedHochschildBasisId = null;
    state.relationPanelTab = "relations";
    refreshRelationsOutput(state);
    ["saveSVG", "fixCyto", "wriggle", "toQPABtn"].forEach((id) => {
        const button = document.getElementById(id) as
            | HTMLButtonElement
            | HTMLInputElement
            | null;
        if (button) {
            button.disabled = false;
        }
    });
    state.cy = initCytoscape(state, quiver, isPreset);
}

export function bendArrow(
    state: WorkbenchState,
    direction: "L" | "R" | "S",
): void {
    const edges = state.cy?.$("edge:selected");
    if (!edges) {
        return;
    }
    for (const edge of edges) {
        const currentDistance = edge.style("control-point-distance");
        let distance = 0;
        if (direction === "L") {
            distance = -40;
        } else if (direction === "R") {
            distance = 40;
        }
        if (currentDistance) {
            const current = Number.parseInt(
                currentDistance.substring(0, currentDistance.indexOf("px")),
                10,
            );
            if (
                (current >= 0 && distance > 0) ||
                (current <= 0 && distance < 0)
            ) {
                edge.style("control-point-distance", current + distance);
            } else {
                edge.style("control-point-distance", 0);
            }
            edge.style("control-point-weights", 0.5);
        } else {
            edge.style("control-point-weights", 0.5);
            edge.style("control-point-distance", distance);
        }
        if (edge.codirectedEdges().length === 1) {
            edge.style("curve-style", "unbundled-bezier");
        }
    }
}

export function doubleQuiver(state: WorkbenchState): void {
    if (!state.cy) {
        setError("Draw a quiver before doubling arrows.");
        return;
    }
    const existingArrowIds = new Set(
        state.cy.edges().map((edge: any) => edge.id()),
    );
    const arrowsToDouble = state.cy
        .edges()
        .filter((edge: any) => !edge.id().endsWith("*"));
    const reverseArrows: any[] = [];
    const skipped: string[] = [];
    for (const edge of arrowsToDouble) {
        const reverseId = `${edge.id()}*`;
        if (existingArrowIds.has(reverseId)) {
            skipped.push(reverseId);
            continue;
        }
        reverseArrows.push({
            group: "edges",
            data: {
                id: reverseId,
                source: edge.data("target"),
                target: edge.data("source"),
                label: reverseId,
            },
        });
    }
    if (reverseArrows.length > 0) {
        state.monomialComputationContext = null;
        state.ambiguityGroupsByOrientation = null;
        state.hochschildComplex = null;
        state.selectedAmbiguityId = null;
        state.selectedHochschildBasisId = null;
        state.relationPanelTab = "relations";
        refreshRelationsOutput(state);
        state.cy.add(reverseArrows);
        state.cy.forceRender();
    }
    setOutputHtml(
        [
            `Added ${reverseArrows.length} reverse arrow(s).`,
            skipped.length > 0
                ? `Skipped existing reverse arrow(s): ${skipped.join(", ")}`
                : "",
        ]
            .filter(Boolean)
            .join("<br>"),
    );
}

export function clearAll(state: WorkbenchState): void {
    state.addRelationMode = false;
    state.quiverData = null;
    state.relations = [];
    state.monomialComputationContext = null;
    state.ambiguityGroupsByOrientation = null;
    state.hochschildComplex = null;
    state.selectedAmbiguityId = null;
    state.selectedHochschildBasisId = null;
    state.relationPanelTab = "relations";
    state.cy = null;
    const quiverInput = document.getElementById(
        "inQuiver",
    ) as HTMLTextAreaElement | null;
    const relationInput = document.getElementById(
        "inRelation",
    ) as HTMLTextAreaElement | null;
    if (quiverInput) {
        quiverInput.value = "";
    }
    if (relationInput) {
        relationInput.value = "";
    }
    ["toQPABtn", "fixCyto", "wriggle", "saveSVG"].forEach((id) => {
        const button = document.getElementById(id) as
            | HTMLButtonElement
            | HTMLInputElement
            | null;
        if (button) {
            button.disabled = true;
        }
    });
    refreshRelationsOutput(state);
}

export function createInitialVertexAtClick(
    state: WorkbenchState,
    event: MouseEvent,
): void {
    if (state.cy || state.mode !== "add") {
        return;
    }
    const name = promptNameAndCheck(
        "Enter name for new vertex:",
        null,
        "vertex",
        state,
    );
    if (!name) {
        return;
    }
    const element = {
        group: "nodes" as const,
        data: { id: name },
        position: { x: event.offsetX - 40, y: event.offsetY - 40 },
    };
    state.quiverData = { nodes: [element], edges: [] };
    state.cy = initCytoscape(state, state.quiverData, true);
    ["toQPABtn", "fixCyto", "wriggle", "saveSVG"].forEach((id) => {
        const button = document.getElementById(id) as
            | HTMLButtonElement
            | HTMLInputElement
            | null;
        if (button) {
            button.disabled = false;
        }
    });
}

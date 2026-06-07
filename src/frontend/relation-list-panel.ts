import type { PathOrientation } from "../backend/paths";
import {
    formatRelationGenerator,
    type RelationGenerator,
} from "../backend/relations";

export function renderRelationList(
    root: HTMLElement,
    relations: RelationGenerator[],
    activeOrientation: PathOrientation,
    selectedRelationId: string | null,
    onSelect: (relationId: string) => void,
): void {
    root.innerHTML = "";

    if (relations.length === 0) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "No monomial relations saved.";
        root.append(empty);
        return;
    }

    for (const relation of relations) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "relation-row";
        button.dataset.selected =
            relation.id === selectedRelationId ? "true" : "false";
        button.addEventListener("click", () => onSelect(relation.id));

        const name = document.createElement("span");
        name.className = "row-id";
        name.textContent = relation.id;

        const path = document.createElement("span");
        path.className = "path-word";
        path.textContent = formatRelationGenerator(
            relation,
            activeOrientation,
            "\u0000",
        );

        button.append(name, path);
        root.append(button);
    }
}

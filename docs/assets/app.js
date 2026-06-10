// src/frontend/workbench-state.ts
function createWorkbenchState() {
  return {
    quiverData: null,
    cy: null,
    relations: [],
    mode: "default",
    addingArrow: false,
    sourceNodeId: null,
    selectedRelationIndex: -1,
    addRelationMode: false,
    autoNameVertexCounter: 0,
    autoNameArrowCounter: 1,
    animationTimer: null,
    activePathOrientation: "L2R",
    activeFieldCharacteristic: 0,
    ambiguityGroupsByOrientation: null,
    selectedAmbiguityId: null,
    relationPanelTab: "relations"
  };
}

// src/backend/path-orientation.ts
function oppositeOrientation(orientation) {
  return orientation === "L2R" ? "R2L" : "L2R";
}
function reverseOrientation(path) {
  return {
    ...path,
    arrows: [...path.arrows].reverse(),
    orientation: oppositeOrientation(path.orientation)
  };
}

// src/backend/relations.ts
function relationDisplayId(relation, index) {
  return relation.id ?? relation.reln ?? `relation ${index + 1}`;
}
function formatRelationTerms(terms, join = "·") {
  return terms.map((term, index) => {
    const monomial = term.monomial.join(join);
    if (term.scalar === undefined || term.scalar === "") {
      return `${index === 0 ? "" : "+"}${monomial}`;
    }
    if (term.scalar === "-") {
      return `-${monomial}`;
    }
    const scalar = `${term.scalar}`;
    const sign = scalar.startsWith("-") || index === 0 ? "" : "+";
    return `${sign}${scalar}${join}${monomial}`;
  }).join("");
}
function formatRelationData(relation, orientation = "L2R", join = "·") {
  const terms = (relation.terms ?? []).map((term) => ({
    ...term,
    monomial: orientation === "R2L" ? [...term.monomial].reverse() : term.monomial
  }));
  return formatRelationTerms(terms, join);
}
function relationLogText(relation, index) {
  const formatted = formatRelationData(relation);
  const id = relationDisplayId(relation, index);
  return formatted ? `${id}: ${formatted}` : id;
}
function scalarToInputScalar(scalar) {
  if (scalar === undefined || scalar === "") {
    return "+1";
  }
  if (scalar === "-") {
    return "-1";
  }
  return `${scalar}`;
}
function formatRelationDataForInput(relation) {
  return (relation.terms ?? []).map((term, index) => {
    const scalar = scalarToInputScalar(term.scalar);
    const sign = index === 0 ? "" : "+";
    return `${sign}(${scalar})*${term.monomial.join("*")}`;
  }).join("");
}
function relationArrowNames(relations) {
  return new Set(relations.flatMap((relation) => (relation.terms ?? []).flatMap((term) => term.monomial)));
}
function cloneRelationData(relations) {
  return relations.map((relation) => ({
    ...relation,
    terms: relation.terms?.map((term) => ({
      ...term,
      monomial: [...term.monomial]
    }))
  }));
}
function replaceArrowInWord(word, arrowId, replacementPath) {
  const replaced = [];
  for (const arrow of word) {
    if (arrow === arrowId) {
      replaced.push(...replacementPath);
    } else {
      replaced.push(arrow);
    }
  }
  return replaced;
}
function wordContainsArrow(word, arrowId) {
  return word.includes(arrowId);
}

// src/backend/qpa-translator.ts
var letters = [...Array(52).keys()].map((index) => String.fromCharCode(97 + index % 26 + (index < 26 ? 0 : -32)));
var primes = [
  2,
  3,
  5,
  7,
  11,
  13,
  17,
  19,
  23,
  29,
  31,
  37,
  41,
  43,
  47,
  53,
  59,
  61
];
var generators = [1, 2, 2, 3, 2, 2, 3, 2, 5, 2, 3, 2, 6, 3, 5, 2, 2, 2];
function generatedArrowName(index) {
  const base = letters[index % 52];
  return base + Array(Math.trunc(index / 52 + 1)).fill("").reduce((previous) => `${previous}^`);
}
function stripLineBreaksAndSpaces(value) {
  return value.replace(/(\\\r\n|\\\r|\\\n)/, "").replace(/\s+/g, "");
}
function matchDeepestBrackets(value) {
  return value.match(/\[([^\[\]])*\]/g);
}
function isPowerOfPrime(value) {
  for (const prime of primes) {
    if (value === prime) {
      return [prime, 1];
    }
    const exponent = Math.log(value) / Math.log(prime);
    if (exponent % 1 === 0) {
      return [prime, exponent];
    }
  }
  return [0, 0];
}
function findFieldCharacteristic(scalar) {
  return scalar[1] === "Z" ? isPowerOfPrime(Number.parseInt(scalar.slice(3, scalar.indexOf(")")), 10))[0] : 0;
}
function complexNumberText(value) {
  if (value.includes("/")) {
    return value;
  }
  if (value.includes(".")) {
    return value;
  }
  if (value.includes("i")) {
    return value;
  }
  return value.includes("(") ? value.slice(1, -1) : value;
}
function translateScalar(rawScalar, characteristic) {
  if (characteristic < 0) {
    return rawScalar;
  }
  if (characteristic === 0) {
    const scalar = complexNumberText(rawScalar);
    if (scalar[0] !== "(") {
      if (scalar === "+1" || scalar === "1") {
        return "";
      }
      return scalar === "-1" ? "-" : scalar;
    }
    return scalar;
  }
  const exponentMarker = rawScalar.indexOf("^");
  const exponent = exponentMarker !== -1 ? rawScalar.slice(exponentMarker + 1, -1) : "1";
  if (exponent === "0") {
    return "";
  }
  const result = Math.pow(generators[primes.indexOf(characteristic)], Number.parseInt(exponent, 10));
  return result === characteristic - 1 ? "-" : `${result}`;
}
function splitRelationTerms(relationInput) {
  const terms = [];
  let depth = 0;
  let start = 0;
  for (let index = 0;index < relationInput.length; index += 1) {
    const char = relationInput[index];
    if (char === "(") {
      depth += 1;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
    }
    if ((char === "+" || char === "-") && depth === 0 && index > start) {
      terms.push(relationInput.slice(start, index));
      start = index;
    }
  }
  terms.push(relationInput.slice(start));
  return terms.filter((term) => term !== "");
}
function parseRelationTerm(termInput) {
  let term = termInput.trim();
  let leadingSign = "";
  if (term[0] === "+" || term[0] === "-") {
    leadingSign = term[0];
    term = term.slice(1);
  }
  const explicitScalar = term.match(/^\((.*?)\)\*(.*)$/);
  if (explicitScalar) {
    const scalar = leadingSign === "-" && !explicitScalar[1].startsWith("-") ? `-${explicitScalar[1]}` : explicitScalar[1];
    return {
      scalarRaw: scalar,
      generators: explicitScalar[2].split("*")
    };
  }
  return {
    scalarRaw: leadingSign === "-" ? "-1" : "+1",
    generators: term.split("*")
  };
}
function parseRelationData(relationInput, generatorReference, fieldCharacteristic, options) {
  const relation = {
    reln: "",
    terms: [],
    fieldChar: fieldCharacteristic
  };
  for (const termInput of splitRelationTerms(relationInput)) {
    const { scalarRaw, generators: termGenerators } = parseRelationTerm(termInput);
    if (!termGenerators.length || termGenerators.some((generator) => generator === "")) {
      throw new Error(`Relation string ${relationInput}, term ${termInput} is of invalid format.`);
    }
    if (relation.fieldChar === -1) {
      relation.fieldChar = findFieldCharacteristic(scalarRaw);
    }
    relation.terms?.push({
      scalar: translateScalar(scalarRaw, relation.fieldChar ?? 0),
      monomial: termGenerators.map((generator) => {
        const index = generatorReference.indexOf(generator);
        return index !== -1 ? options.forceArrowIds ? generatedArrowName(index) : generator : generator;
      })
    });
  }
  relation.reln = formatRelationData(relation);
  return relation;
}
function splitRelationEntries(relationInput) {
  return relationInput.split(/[\n,]+/).map((entry) => entry.trim()).filter((entry) => entry !== "");
}
function parseRelationList(relationInput, quiver, options) {
  const arrowNames = quiver[1].map((arrow) => arrow[2]);
  const entries = relationInput.replace(/(\\\r\n|\\\r|\\\n)/g, "").replace(/[\s\[\]]/g, "").split(",").filter((entry, index, list) => !(list.length === 1 && index === 0 && entry === ""));
  const relations = [];
  let characteristic = -1;
  for (const entry of entries) {
    const relation = parseRelationData(entry, arrowNames, characteristic, options);
    relations.push(relation);
    characteristic = characteristic === -1 ? relation.fieldChar ?? 0 : characteristic;
  }
  relations.sort((left, right) => {
    if ((left.terms?.length ?? 0) === 1 && (right.terms?.length ?? 0) === 1) {
      const leftScalar = left.terms?.[0]?.scalar ?? "";
      const rightScalar = right.terms?.[0]?.scalar ?? "";
      return leftScalar > "0" ? rightScalar > "0" ? 0 : -1 : 1;
    }
    return (left.terms?.length ?? 0) - (right.terms?.length ?? 0);
  });
  return {
    relations,
    characteristic: characteristic === -1 ? 0 : characteristic
  };
}
function parseRelationEntries(relationInput, quiver, options) {
  const entries = splitRelationEntries(relationInput);
  return parseRelationList(entries.join(","), quiver, options);
}
function parseSingleRelation(relationInput, quiver, options) {
  const { relations } = parseRelationList(relationInput.trim(), quiver, options);
  if (relations.length !== 1) {
    throw new Error("Please enter exactly one relation.");
  }
  return relations[0];
}
function splitQuiverAndRelationInput(input) {
  const deepest = matchDeepestBrackets(input);
  if (!deepest) {
    return [input, ""];
  }
  const levelTwoStart = input.search(/\[\s*\[/);
  const levelTwoEnd = input.search(/\]\s*\]/);
  const levelTwoMatch = input.match(/\]\s*\]/);
  if (levelTwoStart === -1 || levelTwoEnd === -1 || !levelTwoMatch) {
    return [input, ""];
  }
  const levelTwoCount = matchDeepestBrackets(input.slice(levelTwoStart + 1, levelTwoEnd + levelTwoMatch[0].length - 1))?.length ?? 0;
  const relationStart = deepest.length - levelTwoCount === 2 ? input.search(/\[([^\[\]])*\]\s*$/) : input.length;
  return [input.slice(0, relationStart), input.slice(relationStart)];
}
function parseQpaInput(input, fallbackRelationInput, options) {
  const [quiverInput, relationInputFromQuiver] = splitQuiverAndRelationInput(input);
  let quiverJson = stripLineBreaksAndSpaces(quiverInput).replace(/(\r\n|\n|\r)/g, "").replace(/\\/g, "").replace(/;/g, "");
  quiverJson = quiverJson.replace(/^(\s*)Quiver(\(*)/, "").replace(/\)(\s*)$/, "");
  if (quiverJson[0] !== "[") {
    const vertexCount = Number.parseInt(quiverJson.split(",", 1)[0], 10);
    if (vertexCount > 0) {
      const vertices2 = Array.from({ length: vertexCount }, (_, index) => index + 1);
      quiverJson = JSON.stringify(vertices2) + quiverJson.slice(quiverJson.indexOf(","));
    }
  }
  const quiverQpa = JSON.parse(`[${quiverJson}]`);
  if (quiverQpa[0].length > 70) {
    throw new Error("More than 70 vertices! Abort translation.");
  }
  const vertexIds = quiverQpa[0].map((vertex, index) => options.forceVertexIds ? `${index + 1}` : `${vertex}`.replace(/"/g, ""));
  const vertices = vertexIds.map((id) => ({
    group: "nodes",
    data: { id }
  }));
  const arrows = quiverQpa[1].map((arrow, index) => {
    const label = options.forceArrowIds ? generatedArrowName(index) : arrow[2];
    return {
      group: "edges",
      data: {
        id: label,
        source: options.forceVertexIds ? `${quiverQpa[0].indexOf(arrow[0]) + 1}` : `${arrow[0]}`,
        target: options.forceVertexIds ? `${quiverQpa[0].indexOf(arrow[1]) + 1}` : `${arrow[1]}`,
        label
      }
    };
  });
  const relationSource = relationInputFromQuiver === "" ? fallbackRelationInput : relationInputFromQuiver;
  const relationQuiver = [
    quiverQpa[0].map((vertex) => `${vertex}`),
    quiverQpa[1].map((arrow) => [`${arrow[0]}`, `${arrow[1]}`, arrow[2]])
  ];
  const { relations, characteristic } = parseRelationList(relationSource, relationQuiver, options);
  return {
    elements: [...vertices, ...arrows],
    relations,
    characteristic
  };
}
function quiverFromCytoscape(cyInstance) {
  return [
    cyInstance.nodes().map((node) => node.id()),
    cyInstance.edges().map((edge) => [
      edge.data("source"),
      edge.data("target"),
      edge.id()
    ])
  ];
}
function exportQpa(elements, relations) {
  const nodes = elements.nodes ?? [];
  const edges = elements.edges ?? [];
  const vertices = nodes.map((node) => node.data.id);
  const arrows = edges.map((edge) => {
    const { source, target, label, id } = edge.data;
    return `["${source}", "${target}", "${label ?? id}"]`;
  });
  const relationText = `[${relations.map((relation) => formatRelationData(relation, "L2R", "*")).join(", ")}]`;
  return `Q:=Quiver([${vertices.map((vertex) => `"${vertex}"`).join(", ")}], [${arrows.join(", ")}]);
R:=${relationText};`;
}

// src/frontend/log-panel.ts
function setOutputHtml(html) {
  const output = document.getElementById("outTxtBox");
  if (output) {
    output.innerHTML = html;
  }
}
function appendLogDivider(output) {
  const divider = document.createElement("div");
  divider.textContent = "-----------";
  output.appendChild(divider);
  output.appendChild(document.createElement("br"));
}
function appendOutputHtml(html) {
  const output = document.getElementById("outTxtBox");
  if (!output) {
    return;
  }
  const entry = document.createElement("div");
  entry.innerHTML = html;
  output.appendChild(entry);
  appendLogDivider(output);
}
function setError(message) {
  setOutputHtml(`<span style='color:red; font-size: 20pt'>${message}</span>`);
}
function setInfoStatus(message, isWarning = false) {
  const status = document.getElementById("info-status");
  if (!status) {
    return;
  }
  status.textContent = message;
  status.classList.toggle("status-warn", isWarning);
}
function appendInfoLog(message) {
  const output = document.getElementById("outTxtBox");
  if (!output) {
    return;
  }
  const line = document.createElement("div");
  line.textContent = message;
  output.appendChild(line);
  appendLogDivider(output);
}
function characteristicText(characteristic) {
  return characteristic === 0 ? "Characteristic 0 (real)" : `Characteristic ${characteristic}`;
}
function setFieldCharacteristic(characteristic, shouldLog = false) {
  const activeCharacteristic = characteristic || 0;
  const display = document.getElementById("field-characteristic");
  if (display) {
    display.textContent = characteristicText(activeCharacteristic);
  }
  if (shouldLog) {
    appendInfoLog(`${characteristicText(activeCharacteristic)}.`);
  }
}

// src/frontend/cytoscape-style.ts
function activeTheme() {
  return document.body.dataset.theme === "dark" ? "dark" : "light";
}
function cytoThemeColors(theme = activeTheme()) {
  return theme === "dark" ? {
    nodeFill: "#111827",
    nodeBorder: "#cbd5e1",
    nodeText: "#e5edf7",
    selectedNode: "#f87171",
    edge: "#d1d5db",
    selectedEdge: "#93c5fd",
    edgeLabel: "#fca5a5",
    edgeLabelOutline: "#1f2937"
  } : {
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
function relationHighlightColor(index) {
  return activeTheme() === "dark" ? index % 2 === 0 ? "#fbbf24" : "#86efac" : index % 2 === 0 ? "#ff6f00" : "#0080ff";
}
function coloredEdgeStyle(color) {
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
function cytoStyle(theme = activeTheme()) {
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

// src/frontend/relation-ui.ts
function formatPathWord(arrows) {
  return arrows.join("·");
}
function formatAmbiguityPiece(piece) {
  if (piece.arrows.length === 0) {
    return `(${piece.target})`;
  }
  return formatPathWord(piece.arrows);
}
function ambiguityRowId(degree, index) {
  return `ambiguity-${degree}-${index}`;
}
function ambiguityByIndex(state, degree, index) {
  const groups = state.ambiguityGroupsByOrientation?.[state.activePathOrientation];
  const group = groups?.find((candidate) => candidate.degree === degree);
  return group?.ambiguities[index] ?? null;
}
function resetCanvasEdgeStyles(state) {
  if (!state.cy) {
    return;
  }
  const colors = cytoThemeColors();
  for (const edge of state.cy.edges()) {
    edge.style({
      width: 2,
      "line-color": colors.edge,
      "target-arrow-color": colors.edge,
      "target-arrow-shape": "triangle"
    });
    edge.removeStyle("line-fill line-gradient-stop-colors line-gradient-stop-positions");
  }
}
function setAmbiguityPieceClasses(row, currentPieceIndex, highlightedPieceIndexes) {
  row?.querySelectorAll(".ambiguity-piece").forEach((piece) => {
    const pieceIndex = Number(piece.dataset.pieceIndex ?? "-1");
    piece.classList.toggle("is-pair-highlighted", highlightedPieceIndexes.has(pieceIndex));
    piece.classList.toggle("is-flow-current", pieceIndex === currentPieceIndex);
  });
}
function renderAmbiguityRowContents(row, ambiguity) {
  row.textContent = "";
  ambiguity.pieces.forEach((piece, pieceIndex) => {
    if (pieceIndex > 0) {
      row.appendChild(document.createTextNode(" | "));
    }
    const pieceElement = document.createElement("span");
    pieceElement.className = "ambiguity-piece";
    pieceElement.dataset.pieceIndex = String(pieceIndex);
    pieceElement.textContent = formatAmbiguityPiece(piece);
    row.appendChild(pieceElement);
  });
}
function setRelationPanelTab(state, tab) {
  if (tab === "ambiguities" && !state.ambiguityGroupsByOrientation) {
    tab = "relations";
  }
  state.relationPanelTab = tab;
  document.querySelectorAll("[data-relation-panel-tab]").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.relationPanelTab === tab ? "true" : "false");
  });
  const relationPanel = document.getElementById("relationsTabPanel");
  const ambiguityPanel = document.getElementById("ambiguitiesTabPanel");
  if (relationPanel) {
    relationPanel.hidden = tab !== "relations";
  }
  if (ambiguityPanel) {
    ambiguityPanel.hidden = tab !== "ambiguities";
  }
}
function refreshRelationPanelTabs(state) {
  const ambiguityButton = document.getElementById("ambiguitiesTabButton");
  const hasAmbiguities = state.ambiguityGroupsByOrientation !== null;
  if (ambiguityButton) {
    ambiguityButton.hidden = !hasAmbiguities;
  }
  setRelationPanelTab(state, hasAmbiguities ? state.relationPanelTab : "relations");
}
function refreshAmbiguitiesOutput(state) {
  refreshRelationPanelTabs(state);
  const output = document.getElementById("ambiguityOutput");
  if (!output) {
    return;
  }
  output.innerHTML = "";
  state.selectedAmbiguityId = null;
  const groups = state.ambiguityGroupsByOrientation?.[state.activePathOrientation];
  if (!groups) {
    return;
  }
  let rowIndex = 0;
  for (const [groupIndex, group] of groups.entries()) {
    if (groupIndex > 0) {
      output.appendChild(document.createElement("hr")).className = "ambiguity-divider";
    }
    const heading = document.createElement("div");
    heading.className = "ambiguity-degree";
    heading.textContent = `Gamma[${group.degree}] (${group.ambiguities.length})`;
    output.appendChild(heading);
    if (group.ambiguities.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ambiguityRow row-even";
      empty.textContent = "(empty)";
      output.appendChild(empty);
      rowIndex += 1;
      continue;
    }
    group.ambiguities.forEach((ambiguity, ambiguityIndex) => {
      const row = document.createElement("div");
      row.className = `ambiguityRow ${rowIndex % 2 === 0 ? "row-even" : "row-odd"}`;
      row.dataset.ambiguityId = ambiguityRowId(group.degree, ambiguityIndex);
      renderAmbiguityRowContents(row, ambiguity);
      row.addEventListener("click", () => selectAmbiguity(state, group.degree, ambiguityIndex));
      output.appendChild(row);
      rowIndex += 1;
    });
  }
}
function clearAmbiguityResults(state) {
  state.ambiguityGroupsByOrientation = null;
  state.selectedAmbiguityId = null;
  state.relationPanelTab = "relations";
  refreshAmbiguitiesOutput(state);
}
function selectAmbiguity(state, degree, index) {
  const ambiguity = ambiguityByIndex(state, degree, index);
  if (!ambiguity) {
    return;
  }
  state.selectedRelationIndex = -1;
  state.selectedAmbiguityId = ambiguityRowId(degree, index);
  clearRelationAnimation(state);
  resetCanvasEdgeStyles(state);
  document.querySelectorAll("#relOutput .relationRow").forEach((row2) => row2.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#ambiguityOutput .ambiguityRow").forEach((row2) => row2.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#ambiguityOutput .ambiguity-piece").forEach((piece) => piece.classList.remove("is-pair-highlighted", "is-flow-current"));
  const row = document.querySelector(`#ambiguityOutput [data-ambiguity-id="${state.selectedAmbiguityId}"]`);
  row?.classList.add("selectedRelationRow");
  animateAmbiguity(state, ambiguity, row);
}
function validateRelationArrowReferences(relations, cyInstance) {
  if (!cyInstance) {
    return true;
  }
  const arrows = new Set(cyInstance.edges().map((edge) => edge.id()));
  const missing = [...relationArrowNames(relations)].filter((name) => !arrows.has(name));
  if (missing.length > 0) {
    setError(`Relations refer to unknown arrow(s): ${[...new Set(missing)].join(", ")}`);
    return false;
  }
  return true;
}
function renameArrowInRelations(oldName, newName, relations, cyInstance, state) {
  if (!relations.length) {
    return false;
  }
  let renamed = false;
  for (const relation of relations) {
    if (!relation.terms) {
      continue;
    }
    let relationChanged = false;
    for (const term of relation.terms) {
      for (let index = 0;index < term.monomial.length; index += 1) {
        if (term.monomial[index] === oldName) {
          term.monomial[index] = newName;
          relationChanged = true;
          renamed = true;
        }
      }
    }
    if (relationChanged) {
      relation.reln = formatRelationData(relation);
    }
  }
  if (renamed) {
    clearAmbiguityResults(state);
    validateRelationArrowReferences(relations, cyInstance);
    refreshRelationsOutput(state);
  }
  return renamed;
}
function refreshRelationsOutput(state) {
  state.addRelationMode = false;
  refreshRelationPanelTabs(state);
  const output = document.getElementById("relOutput");
  if (!output) {
    return;
  }
  output.innerHTML = "";
  output.classList.remove("add-relation-mode");
  output.contentEditable = "false";
  state.selectedRelationIndex = -1;
  state.relations.forEach((relation, index) => {
    const row = document.createElement("div");
    row.classList.add("relationRow");
    row.contentEditable = "false";
    row.setAttribute("id", relation.reln ?? formatRelationData(relation));
    row.innerHTML = formatRelationData(relation, state.activePathOrientation);
    row.addEventListener("click", () => selectRelation(state, index));
    output.appendChild(row);
  });
  const addButton = document.getElementById("btnAddReln");
  if (addButton) {
    addButton.value = "Add relation(s)";
  }
}
function applyPathOrientationLabel(state) {
  document.querySelectorAll("[data-orientation]").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.orientation === state.activePathOrientation ? "true" : "false");
  });
}
function setPathOrientation(state, orientation) {
  if (orientation !== "L2R" && orientation !== "R2L") {
    return;
  }
  if (orientation === state.activePathOrientation) {
    applyPathOrientationLabel(state);
    return;
  }
  const relationToSelect = state.selectedRelationIndex;
  state.activePathOrientation = orientation;
  applyPathOrientationLabel(state);
  refreshRelationsOutput(state);
  refreshAmbiguitiesOutput(state);
  if (state.cy && relationToSelect >= 0 && relationToSelect < state.relations.length) {
    selectRelation(state, relationToSelect);
  }
}
function clearRelationAnimation(state) {
  if (!state.animationTimer) {
    return;
  }
  clearInterval(state.animationTimer);
  state.animationTimer = null;
}
function animateAmbiguity(state, ambiguity, row) {
  if (!state.cy) {
    return;
  }
  const nonVertexPieces = ambiguity.pieces.map((piece, pieceIndex) => ({ piece, pieceIndex })).filter(({ piece }) => piece.arrows.length > 0);
  if (nonVertexPieces.length < 2) {
    const onlyPiece = nonVertexPieces[0];
    setAmbiguityPieceClasses(row, onlyPiece?.pieceIndex ?? -1, new Set(onlyPiece ? [onlyPiece.pieceIndex] : []));
    return;
  }
  const color = relationHighlightColor(Math.max(0, ambiguity.n));
  const flowColor = "#dafd13";
  const stepsPerArrow = 36;
  let step = 0;
  const totalArrows = nonVertexPieces.reduce((sum, { piece }) => sum + piece.arrows.length, 0);
  const totalSteps = Math.max(1, totalArrows * stepsPerArrow);
  state.animationTimer = setInterval(() => {
    resetCanvasEdgeStyles(state);
    const currentArrowOffset = Math.min(totalArrows - 1, Math.floor(step / stepsPerArrow));
    let consumedArrows = 0;
    let currentPiecePosition = 0;
    for (let index = 0;index < nonVertexPieces.length; index += 1) {
      const pieceLength = nonVertexPieces[index].piece.arrows.length;
      if (currentArrowOffset < consumedArrows + pieceLength) {
        currentPiecePosition = index;
        break;
      }
      consumedArrows += pieceLength;
    }
    const currentPiece = nonVertexPieces[currentPiecePosition];
    const nextPiece = nonVertexPieces[currentPiecePosition + 1];
    const highlightedPieceIndexes = new Set([currentPiece.pieceIndex]);
    if (nextPiece) {
      highlightedPieceIndexes.add(nextPiece.pieceIndex);
    }
    setAmbiguityPieceClasses(row, currentPiece.pieceIndex, highlightedPieceIndexes);
    const highlightedArrows = new Set;
    for (const { pieceIndex, piece } of nonVertexPieces) {
      if (highlightedPieceIndexes.has(pieceIndex)) {
        piece.arrows.forEach((arrow) => highlightedArrows.add(arrow));
      }
    }
    highlightedArrows.forEach((arrow) => {
      const edge = state.cy.getElementById(arrow);
      edge.style({
        width: 3,
        "line-color": color,
        "target-arrow-color": color,
        "target-arrow-shape": "triangle"
      });
    });
    const currentPieceLocalArrow = currentArrowOffset - consumedArrows;
    const currentArrow = currentPiece.piece.arrows[currentPieceLocalArrow];
    const localProgress = step % stepsPerArrow / stepsPerArrow;
    const center = localProgress * 100;
    const start = Math.max(0, center - 18);
    const end = Math.min(100, center + 18);
    state.cy.getElementById(currentArrow).style({
      width: 5,
      "line-fill": "linear-gradient",
      "line-gradient-stop-colors": `${color} ${color} ${flowColor} ${color} ${color}`,
      "line-gradient-stop-positions": `0 ${start} ${center} ${end} 100`
    });
    step += 1;
    if (step > totalSteps) {
      clearRelationAnimation(state);
      resetCanvasEdgeStyles(state);
      setAmbiguityPieceClasses(row, -1, new Set);
    }
  }, 60);
}
function selectRelation(state, index) {
  state.selectedRelationIndex = index;
  state.selectedAmbiguityId = null;
  clearRelationAnimation(state);
  if (!state.cy) {
    return;
  }
  const rows = document.querySelectorAll("#relOutput .relationRow");
  resetCanvasEdgeStyles(state);
  rows.forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#ambiguityOutput .ambiguityRow").forEach((row) => row.classList.remove("selectedRelationRow"));
  document.querySelectorAll("#ambiguityOutput .ambiguity-piece").forEach((piece) => piece.classList.remove("is-pair-highlighted", "is-flow-current"));
  if (index < 0 || index >= rows.length || index >= state.relations.length) {
    return;
  }
  rows[index].classList.add("selectedRelationRow");
  const color = relationHighlightColor(index);
  const pathsToAnimate = [];
  let allEdges = state.cy.collection();
  for (const term of state.relations[index].terms ?? []) {
    const edgesInPath = [];
    for (const arrow of term.monomial) {
      const edge = state.cy.getElementById(arrow);
      edgesInPath.push(edge);
      allEdges = allEdges.union(edge);
    }
    pathsToAnimate.push(edgesInPath);
  }
  allEdges.style({
    width: 2,
    "line-color": color,
    "target-arrow-color": color,
    "target-arrow-shape": "triangle"
  });
  allEdges.style({
    "line-fill": "linear-gradient",
    "line-gradient-stop-colors": `${color} ${color} #dafd13 ${color} ${color}`,
    "line-gradient-stop-positions": "0 0 0 0 0"
  });
  let position = 0;
  state.animationTimer = setInterval(() => {
    position = (position + 4) % 200;
    const t = position / 200;
    const edgeUpdates = new Map;
    for (const path of pathsToAnimate) {
      const length = path.length;
      const globalPosition = t * length * 100;
      for (let edgeIndex = 0;edgeIndex < length; edgeIndex += 1) {
        const edge = path[edgeIndex];
        const edgeId = edge.id();
        const localCenter = globalPosition - edgeIndex * 100;
        const isVisible = localCenter >= -20 && localCenter <= 120;
        if (!isVisible) {
          continue;
        }
        const distance = Math.abs(localCenter - 50);
        const highlightWidth = Math.max(8, 26 - distance * 0.18);
        const start = Math.max(0, Math.min(100, localCenter - highlightWidth));
        const middle = Math.max(0, Math.min(100, localCenter));
        const end = Math.max(0, Math.min(100, localCenter + highlightWidth));
        const update = edgeUpdates.get(edgeId) ?? { stops: [], colors: [] };
        update.stops.push(0, start, middle, end, 100);
        update.colors.push(color, color, "#dafd13", color, color);
        edgeUpdates.set(edgeId, update);
      }
    }
    for (const [edgeId, update] of edgeUpdates) {
      state.cy.getElementById(edgeId).style({
        "line-fill": "linear-gradient",
        "line-gradient-stop-colors": update.colors.join(" "),
        "line-gradient-stop-positions": update.stops.join(" ")
      });
    }
  }, 45);
}
function editSelectedRelation(state) {
  if (!state.relations.length) {
    setError("No relation to edit.");
    return;
  }
  if (state.selectedRelationIndex < 0 || state.selectedRelationIndex >= state.relations.length) {
    setError("Please select a relation to edit.");
    return;
  }
  const current = formatRelationDataForInput(state.relations[state.selectedRelationIndex]);
  const relationInput = prompt("Edit relation:", current);
  if (relationInput === null) {
    return;
  }
  try {
    const relation = parseSingleRelation(relationInput, quiverFromCytoscape(state.cy), {
      forceArrowIds: document.getElementById("forceArrow")?.checked ?? false,
      forceVertexIds: document.getElementById("forceID")?.checked ?? false
    });
    state.relations[state.selectedRelationIndex] = relation;
    const relationToSelect = state.selectedRelationIndex;
    clearAmbiguityResults(state);
    refreshRelationsOutput(state);
    selectRelation(state, relationToSelect);
  } catch (error) {
    setError(error.message);
  }
}
function ensureAddRelationEditor() {
  let editor = document.getElementById("addRelationEditor");
  if (editor) {
    return editor;
  }
  editor = document.createElement("div");
  editor.id = "addRelationEditor";
  editor.className = "relationRow add-relation-editor";
  editor.contentEditable = "true";
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const button = document.getElementById("btnAddReln");
      button?.click();
    }
  });
  document.getElementById("relOutput")?.appendChild(editor);
  return editor;
}
function enterAddRelationMode(state) {
  if (!state.cy) {
    setError("Draw a quiver before adding relations.");
    return;
  }
  state.addRelationMode = true;
  const output = document.getElementById("relOutput");
  output?.classList.add("add-relation-mode");
  const editor = ensureAddRelationEditor();
  editor.focus();
  const addButton = document.getElementById("btnAddReln");
  if (addButton) {
    addButton.value = "Save added relations";
  }
}
function exitAddRelationMode(state, commitChanges = true) {
  const editor = document.getElementById("addRelationEditor");
  const addedText = editor?.innerText.trim() ?? "";
  if (commitChanges && addedText !== "") {
    try {
      const { relations } = parseRelationEntries(addedText, quiverFromCytoscape(state.cy), {
        forceArrowIds: document.getElementById("forceArrow")?.checked ?? false,
        forceVertexIds: document.getElementById("forceID")?.checked ?? false
      });
      if (relations.length === 0) {
        setError("No valid relation entered.");
      } else {
        state.relations = state.relations.concat(relations);
        clearAmbiguityResults(state);
      }
    } catch (error) {
      setError(error.message);
    }
  }
  editor?.remove();
  state.addRelationMode = false;
  refreshRelationsOutput(state);
}
function toggleAddRelationMode(state) {
  if (state.addRelationMode) {
    exitAddRelationMode(state, true);
  } else {
    enterAddRelationMode(state);
  }
}
function guardRelationOutputEdit(state, event) {
  if (state.addRelationMode && event.target instanceof Node && document.getElementById("addRelationEditor")?.contains(event.target)) {
    return;
  }
  event.preventDefault();
}
function focusAddRelationEditor(state, event) {
  if (!state.addRelationMode) {
    return;
  }
  const target = event.target;
  if (target?.closest(".relationRow")) {
    return;
  }
  const editor = document.getElementById("addRelationEditor");
  if (editor && !editor.contains(target)) {
    event.preventDefault();
    editor.focus();
  }
}
function removeRelationsUsingArrows(state, removedArrows) {
  if (!removedArrows.length) {
    return;
  }
  state.relations = state.relations.filter((relation) => !(relation.terms ?? []).some((term) => term.monomial.some((arrow) => removedArrows.includes(arrow))));
  clearAmbiguityResults(state);
  refreshRelationsOutput(state);
}

// src/frontend/cytoscape-view.ts
function applyCytoscapeTheme(state) {
  if (!state.cy) {
    return;
  }
  state.cy.style(cytoStyle());
  if (state.selectedRelationIndex >= 0) {
    selectRelation(state, state.selectedRelationIndex);
  }
}
function promptNameAndCheck(message, cyInstance, type, state) {
  const autoName = document.getElementById("autoName")?.checked ?? false;
  if (autoName) {
    const prefix = type === "vertex" ? "v" : "a";
    let counter = type === "vertex" ? state.autoNameVertexCounter : state.autoNameArrowCounter;
    let name2 = `${prefix}${counter}`;
    while (cyInstance && cyInstance.getElementById(name2).length !== 0) {
      counter += 1;
      name2 = `${prefix}${counter}`;
    }
    if (type === "vertex") {
      state.autoNameVertexCounter = counter + 1;
    } else {
      state.autoNameArrowCounter = counter + 1;
    }
    return name2;
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
function clickOnCanvas(event, cyInstance, state) {
  const target = event.target;
  if (state.mode === "add") {
    if (target === cyInstance) {
      const name = promptNameAndCheck("Enter name for new vertex:", cyInstance, "vertex", state);
      if (name) {
        cyInstance.add({
          group: "nodes",
          data: { id: name },
          position: event.position
        });
      }
    } else if (target.isNode()) {
      if (state.addingArrow) {
        const name = promptNameAndCheck("Enter name for new arrow:", cyInstance, "arrow", state);
        if (name) {
          cyInstance.add({
            group: "edges",
            data: {
              id: name,
              source: state.sourceNodeId,
              target: target.id(),
              label: name
            }
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
      let removedArrows = [];
      if (target.isNode()) {
        removedArrows = target.connectedEdges().map((edge) => edge.id());
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
    const newName = promptNameAndCheck(`Enter new name for ${type} (current: ${oldId}):`, cyInstance, type, state);
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
      edgesJson.forEach((edge) => {
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
      renameArrowInRelations(oldId, newName, state.relations, cyInstance, state);
    }
  }
}
function initCytoscape(state, inputData, isPreset = false) {
  const layout = isPreset ? { name: "preset", fit: false } : {
    name: "breadthfirst",
    fit: true,
    padding: 20,
    nodeDimensionsIncludeLabels: true
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
    pan: { x: 40, y: 40 }
  });
  cyInstance.on("tap", (event) => clickOnCanvas(event, cyInstance, state));
  state.cy = cyInstance;
  window.cy = cyInstance;
  return cyInstance;
}
function presentData(state, quiver, relations, isPreset = false) {
  state.quiverData = quiver;
  state.relations = relations;
  state.ambiguityGroupsByOrientation = null;
  state.selectedAmbiguityId = null;
  state.relationPanelTab = "relations";
  refreshRelationsOutput(state);
  ["saveSVG", "fixCyto", "wriggle", "toQPABtn"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = false;
    }
  });
  state.cy = initCytoscape(state, quiver, isPreset);
}
function bendArrow(state, direction) {
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
      const current = Number.parseInt(currentDistance.substring(0, currentDistance.indexOf("px")), 10);
      if (current >= 0 && distance > 0 || current <= 0 && distance < 0) {
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
function doubleQuiver(state) {
  if (!state.cy) {
    setError("Draw a quiver before doubling arrows.");
    return;
  }
  const existingArrowIds = new Set(state.cy.edges().map((edge) => edge.id()));
  const arrowsToDouble = state.cy.edges().filter((edge) => !edge.id().endsWith("*"));
  const reverseArrows = [];
  const skipped = [];
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
        label: reverseId
      }
    });
  }
  if (reverseArrows.length > 0) {
    state.ambiguityGroupsByOrientation = null;
    state.selectedAmbiguityId = null;
    state.relationPanelTab = "relations";
    refreshRelationsOutput(state);
    state.cy.add(reverseArrows);
    state.cy.forceRender();
  }
  setOutputHtml([
    `Added ${reverseArrows.length} reverse arrow(s).`,
    skipped.length > 0 ? `Skipped existing reverse arrow(s): ${skipped.join(", ")}` : ""
  ].filter(Boolean).join("<br>"));
}
function clearAll(state) {
  state.addRelationMode = false;
  state.quiverData = null;
  state.relations = [];
  state.ambiguityGroupsByOrientation = null;
  state.selectedAmbiguityId = null;
  state.relationPanelTab = "relations";
  state.cy = null;
  const quiverInput = document.getElementById("inQuiver");
  const relationInput = document.getElementById("inRelation");
  if (quiverInput) {
    quiverInput.value = "";
  }
  if (relationInput) {
    relationInput.value = "";
  }
  ["toQPABtn", "fixCyto", "wriggle", "saveSVG"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = true;
    }
  });
  refreshRelationsOutput(state);
}
function createInitialVertexAtClick(state, event) {
  if (state.cy || state.mode !== "add") {
    return;
  }
  const name = promptNameAndCheck("Enter name for new vertex:", null, "vertex", state);
  if (!name) {
    return;
  }
  const element = {
    group: "nodes",
    data: { id: name },
    position: { x: event.offsetX - 40, y: event.offsetY - 40 }
  };
  state.quiverData = { nodes: [element], edges: [] };
  state.cy = initCytoscape(state, state.quiverData, true);
  ["toQPABtn", "fixCyto", "wriggle", "saveSVG"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = false;
    }
  });
}

// src/frontend/file-actions.ts
function saveFile(state, type) {
  if (!state.cy) {
    return;
  }
  let content;
  let blob;
  if (type === "svg") {
    content = state.cy.svg({ scale: 1, full: true, bg: "#ffffff" });
    blob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });
  } else {
    content = JSON.stringify({ cy: state.cy.json(), reln: state.relations });
    blob = new Blob([content], { type: "application/json;charset=utf-8" });
  }
  const filename = document.getElementById("filenameInput")?.value ?? "quiver";
  saveAs(blob, `${filename}.${type}`);
}
function loadJsonFile(state, file) {
  const reader = new FileReader;
  reader.addEventListener("load", () => {
    const result = JSON.parse(`${reader.result}`);
    presentData(state, result.cy.elements, result.reln, true);
  });
  reader.readAsText(file);
}
function translateToQpa(state) {
  if (!state.cy) {
    return;
  }
  const qpaCode = exportQpa(state.cy.json().elements, state.relations);
  setOutputHtml(qpaCode);
}

// src/frontend/theme.ts
function initialTheme() {
  const savedTheme = localStorage.getItem("gapToCytoTheme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applyTheme(state, theme) {
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
function toggleTheme(state) {
  const currentTheme = document.body.dataset.theme ?? initialTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("gapToCytoTheme", nextTheme);
  applyTheme(state, nextTheme);
}

// src/backend/paths.ts
function vertexPath(vertexId, orientation) {
  return {
    arrows: [],
    source: vertexId,
    target: vertexId,
    orientation
  };
}

// src/backend/quiver.ts
function arrowById(quiver, arrowId) {
  return quiver.arrows.find((arrow) => arrow.id === arrowId);
}
function printArrowWord(arrows) {
  return arrows.join("\x00");
}

// src/backend/monomial-algebra.ts
var DEFAULT_MAX_PATH_LENGTH = 50;
var MIN_MAX_PATH_LENGTH = 20;

class MonomialAlgebraError extends Error {
  logs;
  constructor(message, logs) {
    super(message);
    this.name = "MonomialAlgebraError";
    this.logs = logs;
  }
}
function relationFromL2R(id, path) {
  return {
    id,
    path: { ...path, orientation: "L2R" }
  };
}
function pathFromArrowIdsL2R(quiver, arrows) {
  if (arrows.length === 0) {
    throw new Error("Relation paths must contain at least two arrows.");
  }
  if (arrows.length === 1) {
    throw new Error("Relation paths must contain at least two arrows.");
  }
  return pathFromNonemptyArrowIdsL2R(quiver, arrows);
}
function pathFromNonemptyArrowIdsL2R(quiver, arrows) {
  if (arrows.length === 0) {
    throw new Error("Arrow words must contain at least one arrow.");
  }
  const first = arrowById(quiver, arrows[0]);
  if (!first) {
    throw new Error(`Relation path references unknown arrow '${arrows[0]}'.`);
  }
  let previous = first;
  for (const arrowId of arrows.slice(1)) {
    const next = arrowById(quiver, arrowId);
    if (!next) {
      throw new Error(`Relation path references unknown arrow '${arrowId}'.`);
    }
    if (previous.target !== next.source) {
      throw new Error(`Relation path is not composable at '${previous.id}' followed by '${next.id}'.`);
    }
    previous = next;
  }
  return {
    arrows: [...arrows],
    source: first.source,
    target: previous.target,
    orientation: "L2R"
  };
}
function relationGeneratorLogText(relation) {
  const arrowWord = relation.path.arrows.join("*") || "<vertex path>";
  return `${relation.id}: ${arrowWord}`;
}
function checkRelationsAreMonomial(input) {
  validateQuiver(input.quiver);
  const logs = [];
  const tooManyTerms = countNonMonomialRelations(input.relations);
  if (tooManyTerms > 0) {
    logs.push({
      level: "warning",
      message: `${tooManyTerms} relation(s) have more than two terms, so the algebra is not monomial.`
    });
    input.relations.forEach((relation, relationIndex) => {
      const termCount = relation.terms?.length ?? 0;
      if (termCount <= 2) {
        return;
      }
      const relationId = relationDisplayId(relation, relationIndex);
      const relationText = relationLogText(relation, relationIndex);
      logs.push({
        level: "warning",
        relationId,
        message: `Relation '${relationText}' has ${termCount} terms.`
      });
    });
    return {
      ok: false,
      quiver: input.quiver,
      relations: cloneRelationData(input.relations),
      logs
    };
  }
  const replaced = eliminateRedundantArrowRelations(input);
  removeRelationDataDivisors(replaced.relations, replaced.logs);
  logNonMonomialRelationCount(replaced.relations, replaced.logs);
  return {
    ok: !replaced.logs.some((log) => log.level === "warning"),
    ...replaced
  };
}
function validateQuiver(quiver) {
  const vertexIds = new Set;
  for (const vertex of quiver.vertices) {
    if (vertexIds.has(vertex.id)) {
      throw new Error(`Duplicate vertex id '${vertex.id}'.`);
    }
    vertexIds.add(vertex.id);
  }
  const arrowIds = new Set;
  for (const arrow of quiver.arrows) {
    if (arrowIds.has(arrow.id)) {
      throw new Error(`Duplicate arrow id '${arrow.id}'.`);
    }
    arrowIds.add(arrow.id);
    if (!vertexIds.has(arrow.source)) {
      throw new Error(`Arrow '${arrow.id}' references unknown source vertex '${arrow.source}'.`);
    }
    if (!vertexIds.has(arrow.target)) {
      throw new Error(`Arrow '${arrow.id}' references unknown target vertex '${arrow.target}'.`);
    }
  }
}
function validateRelationPath(quiver, relation) {
  const relationPath = relation.path.arrows.join("*") || "<empty>";
  if (relation.path.arrows.length < 2) {
    throw new Error(`Relation '${relation.id}' has path '${relationPath}', but relation paths must contain at least two arrows.`);
  }
  let checkedPath;
  try {
    checkedPath = pathFromArrowIdsL2R(quiver, relation.path.arrows);
  } catch (error) {
    throw new Error(`Relation '${relation.id}' has problematic path '${relationPath}': ${error.message}`);
  }
  if (checkedPath.source !== relation.path.source || checkedPath.target !== relation.path.target) {
    throw new Error(`Relation '${relation.id}' has path '${relationPath}' with stored endpoints '${relation.path.source}' to '${relation.path.target}', but the quiver gives '${checkedPath.source}' to '${checkedPath.target}'.`);
  }
}
function checkedMaxPathLength(maxPathLength) {
  const checked = maxPathLength ?? DEFAULT_MAX_PATH_LENGTH;
  if (checked < MIN_MAX_PATH_LENGTH) {
    throw new RangeError(`maxPathLength must be at least ${MIN_MAX_PATH_LENGTH}.`);
  }
  return checked;
}
function verifiedBeforeMinimising(input) {
  const maxPathLength = checkedMaxPathLength(input.maxPathLength);
  validateQuiver(input.quiver);
  input.relations.forEach((relation) => validateRelationPath(input.quiver, relation));
  return {
    quiver: input.quiver,
    originalRelations: input.relations.map((relation) => ({ ...relation })),
    activeOrientation: input.activeOrientation,
    maxPathLength
  };
}
function containsContiguousWord(path, divisor) {
  if (divisor.length === 0 || divisor.length > path.length) {
    return false;
  }
  for (let start = 0;start <= path.length - divisor.length; start += 1) {
    let matches = true;
    for (let offset = 0;offset < divisor.length; offset += 1) {
      if (path[start + offset] !== divisor[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return true;
    }
  }
  return false;
}
function isProperDivisor(divisor, path) {
  return divisor.length < path.length && containsContiguousWord(path, divisor);
}
function throwWithLog(message, logs, entry) {
  logs.push(entry);
  throw new MonomialAlgebraError(message, logs);
}
function countNonMonomialRelations(relations) {
  return relations.filter((relation) => (relation.terms?.length ?? 0) > 2).length;
}
function findArrowRedundantTerm(terms) {
  if (terms.length !== 2) {
    return null;
  }
  if (terms[0].monomial.length === 1) {
    return {
      redundantTerm: terms[0],
      replacementTerm: terms[1]
    };
  }
  if (terms[1].monomial.length === 1) {
    return {
      redundantTerm: terms[1],
      replacementTerm: terms[0]
    };
  }
  return null;
}
function arrowRedundantInfo(terms) {
  const redundant = findArrowRedundantTerm(terms);
  if (!redundant) {
    return null;
  }
  return {
    redundantArrow: redundant.redundantTerm.monomial[0],
    replacementPath: [...redundant.replacementTerm.monomial]
  };
}
function lengthOneMonomialRelationInfo(relation) {
  const terms = relation.terms ?? [];
  if (terms.length !== 1 || terms[0].monomial.length !== 1) {
    return null;
  }
  return {
    redundantArrow: terms[0].monomial[0]
  };
}
function logNonMonomialRelationCount(relations, logs) {
  const nonMonomialRelations = relations.filter((relation) => (relation.terms?.length ?? 0) > 1);
  if (nonMonomialRelations.length === 0) {
    return;
  }
  logs.push({
    level: "warning",
    message: `${nonMonomialRelations.length} relation(s) are not monomial.`
  });
  nonMonomialRelations.forEach((relation, relationIndex) => {
    const relationId = relationDisplayId(relation, relationIndex);
    const relationText = relationLogText(relation, relationIndex);
    logs.push({
      level: "warning",
      relationId,
      message: `Relation '${relationText}' is not monomial because it has ${relation.terms?.length ?? 0} terms.`
    });
  });
}
function eliminateRedundantArrowRelations(input) {
  const logs = [];
  const quiver = {
    vertices: input.quiver.vertices.map((vertex) => ({ ...vertex })),
    arrows: input.quiver.arrows.map((arrow) => ({ ...arrow }))
  };
  const relations = cloneRelationData(input.relations);
  while (true) {
    const lengthOneIndex = relations.findIndex((relation2) => lengthOneMonomialRelationInfo(relation2) !== null);
    if (lengthOneIndex !== -1) {
      const relation2 = relations[lengthOneIndex];
      const relationId2 = relationDisplayId(relation2, lengthOneIndex);
      const relationText2 = relationLogText(relation2, lengthOneIndex);
      const redundant2 = lengthOneMonomialRelationInfo(relation2);
      if (!redundant2) {
        break;
      }
      const { redundantArrow: redundantArrow2 } = redundant2;
      const arrow2 = arrowById(quiver, redundantArrow2);
      if (!arrow2) {
        throwWithLog(`Relation '${relationText2}' references unknown redundant arrow '${redundantArrow2}'.`, logs, {
          level: "warning",
          relationId: relationId2,
          message: `Relation '${relationText2}' references unknown redundant arrow '${redundantArrow2}'.`
        });
      }
      quiver.arrows = quiver.arrows.filter((candidate) => candidate.id !== redundantArrow2);
      const removedRelations = [];
      for (let index = relations.length - 1;index >= 0; index -= 1) {
        const currentRelation = relations[index];
        const containsArrow = (currentRelation.terms ?? []).some((term) => wordContainsArrow(term.monomial, redundantArrow2));
        if (!containsArrow) {
          continue;
        }
        removedRelations.push(relationLogText(currentRelation, index));
        relations.splice(index, 1);
      }
      logs.push({
        level: "info",
        relationId: relationId2,
        message: `Removed redundant arrow '${redundantArrow2}' using monomial relation '${relationText2}' and removed ${removedRelations.length} relation(s) containing that arrow: ${removedRelations.reverse().join("; ")}.`
      });
      continue;
    }
    const redundantIndex = relations.findIndex((relation2) => findArrowRedundantTerm(relation2.terms ?? []) !== null);
    if (redundantIndex === -1) {
      break;
    }
    const relation = relations[redundantIndex];
    const relationId = relationDisplayId(relation, redundantIndex);
    const relationText = relationLogText(relation, redundantIndex);
    const redundant = arrowRedundantInfo(relation.terms ?? []);
    if (!redundant) {
      break;
    }
    const { redundantArrow, replacementPath } = redundant;
    const arrow = arrowById(quiver, redundantArrow);
    if (!arrow) {
      throwWithLog(`Relation '${relationText}' references unknown redundant arrow '${redundantArrow}'.`, logs, {
        level: "warning",
        relationId,
        message: `Relation '${relationText}' references unknown redundant arrow '${redundantArrow}'.`
      });
    }
    if (replacementPath.includes(redundantArrow)) {
      throwWithLog(`Replacement path for redundant arrow '${redundantArrow}' contains the same arrow.`, logs, {
        level: "warning",
        relationId,
        message: `Replacement path '${replacementPath.join("*")}' for redundant arrow '${redundantArrow}' in relation '${relationText}' contains '${redundantArrow}'.`
      });
    }
    const replacementCheckedPath = pathFromNonemptyArrowIdsL2R(quiver, replacementPath);
    if (replacementCheckedPath.source !== arrow.source || replacementCheckedPath.target !== arrow.target) {
      throwWithLog(`Replacement path for redundant arrow '${redundantArrow}' has incompatible endpoints.`, logs, {
        level: "warning",
        relationId,
        message: `Replacement path '${replacementPath.join("*")}' for redundant arrow '${redundantArrow}' in relation '${relationText}' runs '${replacementCheckedPath.source}' to '${replacementCheckedPath.target}', but '${redundantArrow}' runs '${arrow.source}' to '${arrow.target}'.`
      });
    }
    quiver.arrows = quiver.arrows.filter((candidate) => candidate.id !== redundantArrow);
    relations.splice(redundantIndex, 1);
    for (const currentRelation of relations) {
      const currentRelationTextBefore = formatRelationData(currentRelation);
      let relationChanged = false;
      const nextTerms = [];
      for (const term of currentRelation.terms ?? []) {
        const hasReplacement = wordContainsArrow(term.monomial, redundantArrow);
        const replacedWord = hasReplacement ? replaceArrowInWord(term.monomial, redundantArrow, replacementPath) : [...term.monomial];
        relationChanged = relationChanged || hasReplacement;
        nextTerms.push({
          scalar: term.scalar,
          monomial: replacedWord
        });
      }
      currentRelation.terms = nextTerms;
      if (relationChanged) {
        currentRelation.reln = formatRelationData(currentRelation, "L2R", "*");
        logs.push({
          level: "info",
          relationId: relationDisplayId(currentRelation, -1),
          message: `Updated relation '${currentRelationTextBefore}' to '${formatRelationData(currentRelation)}' by replacing arrow '${redundantArrow}' with path '${replacementPath.join("*")}'.`
        });
      }
    }
    logs.push({
      level: "info",
      relationId,
      message: `Removed redundant arrow '${redundantArrow}' using relation '${relationText}' and replaced occurrences by path '${replacementPath.join("*")}'.`
    });
  }
  return { quiver, relations, logs };
}
function relationDataPath(relation) {
  const terms = relation.terms ?? [];
  if (terms.length !== 1) {
    return null;
  }
  return terms[0].monomial;
}
function removeRelationDataDivisors(relations, logs) {
  const kept = [];
  const seen = new Map;
  for (let index = 0;index < relations.length; index += 1) {
    const relation = relations[index];
    const path = relationDataPath(relation);
    if (!path) {
      kept.push(relation);
      continue;
    }
    const key = printArrowWord(path);
    const duplicate = seen.get(key);
    if (duplicate) {
      logs.push({
        level: "info",
        relationId: relationDisplayId(relation, index),
        keptRelationId: duplicate.id ?? duplicate.reln,
        removedRelationId: relation.id ?? relation.reln,
        message: `Removed duplicate relation '${relationLogText(relation, index)}'; kept '${formatRelationData(duplicate)}'.`
      });
      continue;
    }
    seen.set(key, relation);
    kept.push(relation);
  }
  const minimised = kept.filter((relation, relationIndex) => {
    const path = relationDataPath(relation);
    if (!path) {
      return true;
    }
    const divisor = kept.find((candidate) => {
      if (candidate === relation) {
        return false;
      }
      const divisorPath = relationDataPath(candidate);
      return divisorPath ? isProperDivisor(divisorPath, path) : false;
    });
    if (!divisor) {
      return true;
    }
    logs.push({
      level: "info",
      relationId: relationDisplayId(relation, relationIndex),
      keptRelationId: divisor.id ?? divisor.reln,
      removedRelationId: relation.id ?? relation.reln,
      message: `Removed redundant relation '${relationLogText(relation, relationIndex)}' because it contains '${formatRelationData(divisor)}' as a contiguous divisor.`
    });
    return false;
  });
  relations.splice(0, relations.length, ...minimised);
}
function tidyUpRelationDataAlgebra(input) {
  const monomialCheck = checkRelationsAreMonomial(input);
  if (!monomialCheck.ok) {
    throw new MonomialAlgebraError("The computed list of relations is not monomial.", monomialCheck.logs);
  }
  const monomialRelations = monomialCheck.relations.flatMap((relation, index) => {
    const terms = relation.terms ?? [];
    if (terms.length === 0) {
      return [];
    }
    const term = terms[0];
    const path = pathFromArrowIdsL2R(monomialCheck.quiver, term.monomial);
    return [
      relationFromL2R(relation.id ?? relation.reln ?? `r${index + 1}`, path)
    ];
  });
  const verified = tidyUpMonomialAlgebra({
    quiver: monomialCheck.quiver,
    relations: monomialRelations,
    activeOrientation: input.activeOrientation,
    maxPathLength: input.maxPathLength
  });
  return {
    ...verified,
    logs: [...monomialCheck.logs, ...verified.logs]
  };
}
function tidyUpMonomialAlgebra(input) {
  const verified = verifiedBeforeMinimising(input);
  const logs = [];
  const kept = [];
  const seen = new Map;
  for (const relation of verified.originalRelations) {
    const key = printArrowWord(relation.path.arrows);
    const duplicate = seen.get(key);
    if (duplicate) {
      logs.push({
        level: "info",
        relationId: relation.id,
        keptRelationId: duplicate.id,
        removedRelationId: relation.id,
        message: `Removed duplicate relation generator '${relationGeneratorLogText(relation)}'; kept '${relationGeneratorLogText(duplicate)}'.`
      });
      continue;
    }
    seen.set(key, relation);
    kept.push(relation);
  }
  const relationGenerators = kept.filter((relation) => {
    const divisor = kept.find((candidate) => candidate.id !== relation.id && isProperDivisor(candidate.path.arrows, relation.path.arrows));
    if (!divisor) {
      return true;
    }
    logs.push({
      level: "info",
      relationId: relation.id,
      keptRelationId: divisor.id,
      removedRelationId: relation.id,
      message: `Removed redundant relation generator '${relationGeneratorLogText(relation)}' because it contains '${relationGeneratorLogText(divisor)}' as a contiguous divisor.`
    });
    return false;
  });
  return {
    ...verified,
    minimisedRelations: relationGenerators.map((relation) => ({
      ...relation
    })),
    logs
  };
}

// src/backend/ambiguities.ts
var AMBIGUITY_LOG_PREFIX = "[GAPCytoEx ambiguity]";
var SHOULD_LOG_AMBIGUITIES = typeof window !== "undefined";
function ambiguityLog(message, details) {
  if (!SHOULD_LOG_AMBIGUITIES) {
    return;
  }
  if (details === undefined) {
    console.log(message);
    return;
  }
  console.log(message, details);
}
function ambiguityTime(label) {
  if (SHOULD_LOG_AMBIGUITIES) {
    console.time(label);
  }
}
function ambiguityTimeEnd(label) {
  if (SHOULD_LOG_AMBIGUITIES) {
    console.timeEnd(label);
  }
}
function ambiguityGroupCollapsed(label) {
  if (SHOULD_LOG_AMBIGUITIES) {
    console.groupCollapsed(label);
  }
}
function ambiguityGroupEnd() {
  if (SHOULD_LOG_AMBIGUITIES) {
    console.groupEnd();
  }
}
function formatOrientation(orientation) {
  return orientation === "R2L" ? "right-to-left" : "left-to-right";
}
function getLazySequenceTerms(sequence, start, endInclusive, logOnlyLastTerm = false) {
  if (endInclusive < start) {
    return [];
  }
  return logOnlyLastTerm ? [[endInclusive, sequence.getAt(endInclusive)]] : sequence.getArray(start, endInclusive);
}
function underlyingPathOfAmbiguity(ambiguity) {
  const nonVertexPieces = ambiguity.pieces.filter((piece) => piece.arrows.length > 0);
  const first = ambiguity.orientation === "R2L" ? nonVertexPieces[nonVertexPieces.length - 1] : ambiguity.pieces[0];
  const last = ambiguity.orientation === "R2L" ? ambiguity.pieces[0] : ambiguity.pieces[ambiguity.pieces.length - 1];
  return {
    arrows: ambiguity.pieces.flatMap((piece) => piece.arrows),
    source: first?.source ?? "",
    target: last?.target ?? "",
    orientation: ambiguity.orientation
  };
}
function reverseOrientationOfAmbiguity(ambiguity) {
  return {
    n: ambiguity.n,
    pieces: ambiguity.pieces.map((piece) => reverseOrientation(piece)).reverse(),
    orientation: reverseOrientation(underlyingPathOfAmbiguity(ambiguity)).orientation,
    kind: ambiguity.kind === "left" ? "right" : "left"
  };
}
function pathFromWord(quiver, arrows, orientation) {
  if (arrows.length === 0) {
    throw new Error("Cannot build a non-vertex path from an empty arrow word.");
  }
  const l2rWord = orientation === "L2R" ? arrows : [...arrows].reverse();
  const first = arrowById(quiver, l2rWord[0]);
  if (!first) {
    throw new Error(`Unknown arrow '${l2rWord[0]}'.`);
  }
  let previous = first;
  for (const arrowId of l2rWord.slice(1)) {
    const next = arrowById(quiver, arrowId);
    if (!next) {
      throw new Error(`Unknown arrow '${arrowId}'.`);
    }
    if (previous.target !== next.source) {
      throw new Error(`Arrow word '${l2rWord.join("*")}' is not composable at '${previous.id}' followed by '${next.id}'.`);
    }
    previous = next;
  }
  return {
    arrows: [...arrows],
    source: first.source,
    target: previous.target,
    orientation
  };
}
function isPathWord(quiver, arrows, orientation) {
  try {
    pathFromWord(quiver, arrows, orientation);
    return true;
  } catch {
    return false;
  }
}
function suffix(word, length) {
  return word.slice(word.length - length);
}
function prefix(word, length) {
  return word.slice(0, length);
}
function wordsEqual(left, right) {
  return left.length === right.length && left.every((arrow, index) => arrow === right[index]);
}
function isStrictSuffixRelation(word, relationWords) {
  for (let length = 1;length < word.length; length += 1) {
    const wordSuffix = suffix(word, length);
    if (relationWords.some((relationWord) => wordsEqual(wordSuffix, relationWord))) {
      return true;
    }
  }
  return false;
}
function isStrictPrefixRelation(word, relationWords) {
  for (let length = 1;length < word.length; length += 1) {
    const wordPrefix = prefix(word, length);
    if (relationWords.some((relationWord) => wordsEqual(wordPrefix, relationWord))) {
      return true;
    }
  }
  return false;
}
function rightAppendsForRelationSuffix(lastPieceWord, relationWord) {
  const appends = [];
  const maxOverlap = Math.min(lastPieceWord.length, relationWord.length - 1);
  for (let overlap = maxOverlap;overlap >= 0; overlap -= 1) {
    if (wordsEqual(suffix(lastPieceWord, overlap), prefix(relationWord, overlap))) {
      appends.push(relationWord.slice(overlap));
    }
  }
  return appends;
}
function leftPrependsForRelationPrefix(firstPieceWord, relationWord) {
  const prepends = [];
  const maxOverlap = Math.min(firstPieceWord.length, relationWord.length - 1);
  for (let overlap = maxOverlap;overlap >= 0; overlap -= 1) {
    if (wordsEqual(prefix(firstPieceWord, overlap), suffix(relationWord, overlap))) {
      prepends.push(relationWord.slice(0, relationWord.length - overlap));
    }
  }
  return prepends;
}
function ambiguityKey(ambiguity) {
  const path = underlyingPathOfAmbiguity(ambiguity);
  return `${path.orientation}:${path.source}:${path.target}:${printArrowWord(path.arrows)}`;
}
function makeSequence(label, compute) {
  const cache = new Map;
  const sequence = {
    getAt(index) {
      if (index < -1) {
        throw new RangeError("Ambiguity degree must be at least -1.");
      }
      if (!cache.has(index)) {
        ambiguityTime(`${AMBIGUITY_LOG_PREFIX} ${label} Gamma[${index}]`);
        const value = compute(index);
        ambiguityTimeEnd(`${AMBIGUITY_LOG_PREFIX} ${label} Gamma[${index}]`);
        ambiguityLog(`${AMBIGUITY_LOG_PREFIX} ${label} Gamma[${index}]`, {
          ambiguities: value.length
        });
        cache.set(index, value);
      }
      return cache.get(index) ?? [];
    },
    *getIteratorFrom(start) {
      if (start < -1) {
        throw new RangeError("Ambiguity degree must be at least -1.");
      }
      let index = start;
      while (true) {
        yield [index, sequence.getAt(index)];
        index += 1;
      }
    },
    getArray(start, endInclusive) {
      if (start < -1) {
        throw new RangeError("Ambiguity degree must be at least -1.");
      }
      if (endInclusive < start) {
        return [];
      }
      const result = [];
      for (let index = start;index <= endInclusive; index += 1) {
        result.push([index, sequence.getAt(index)]);
      }
      return result;
    }
  };
  return sequence;
}
function dedupeAmbiguities(ambiguities) {
  const seen = new Set;
  const result = [];
  for (const ambiguity of ambiguities) {
    const key = ambiguityKey(ambiguity);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(ambiguity);
  }
  return result;
}
function gammaMinusOne(quiver, orientation, kind) {
  return quiver.vertices.map((vertex) => ({
    n: -1,
    pieces: [vertexPath(vertex.id, orientation)],
    orientation,
    kind
  }));
}
function gammaZeroR2L(quiver) {
  return quiver.arrows.map((arrow) => ({
    n: 0,
    pieces: [
      vertexPath(arrow.target, "R2L"),
      pathFromWord(quiver, [arrow.id], "R2L")
    ],
    orientation: "R2L",
    kind: "left"
  }));
}
function gammaZeroL2R(quiver) {
  return quiver.arrows.map((arrow) => ({
    n: 0,
    pieces: [
      pathFromWord(quiver, [arrow.id], "L2R"),
      vertexPath(arrow.target, "L2R")
    ],
    orientation: "L2R",
    kind: "right"
  }));
}
function gammaOneR2L(input) {
  return input.minimisedRelations.map((relation) => {
    const relationWord = [...relation.path.arrows].reverse();
    return {
      n: 1,
      pieces: [
        vertexPath(relation.path.target, "R2L"),
        pathFromWord(input.quiver, [relationWord[0]], "R2L"),
        pathFromWord(input.quiver, relationWord.slice(1), "R2L")
      ],
      orientation: "R2L",
      kind: "left"
    };
  });
}
function gammaOneL2R(input) {
  return input.minimisedRelations.map((relation) => {
    const relationWord = relation.path.arrows;
    return {
      n: 1,
      pieces: [
        pathFromWord(input.quiver, relationWord.slice(0, -1), "L2R"),
        pathFromWord(input.quiver, [relationWord[relationWord.length - 1]], "L2R"),
        vertexPath(relation.path.target, "L2R")
      ],
      orientation: "L2R",
      kind: "right"
    };
  });
}
function computeNextLeftR2L(input, previous, degree) {
  const relationWords = input.minimisedRelations.map((relation) => [...relation.path.arrows].reverse());
  const candidates = [];
  ambiguityLog(`${AMBIGUITY_LOG_PREFIX} left R2L extension start`, {
    degree,
    previous: previous.length,
    relations: relationWords.length
  });
  for (const ambiguity of previous) {
    const lastPiece = ambiguity.pieces[ambiguity.pieces.length - 1];
    if (!lastPiece || lastPiece.arrows.length === 0) {
      continue;
    }
    for (const relationWord of relationWords) {
      for (const rightAppend of rightAppendsForRelationSuffix(lastPiece.arrows, relationWord)) {
        const joinedRight = [...lastPiece.arrows, ...rightAppend];
        if (!isPathWord(input.quiver, joinedRight, "R2L") || !wordsEqual(suffix(joinedRight, relationWord.length), relationWord) || isStrictPrefixRelation(joinedRight, relationWords)) {
          continue;
        }
        const nextPieces = [
          ...ambiguity.pieces,
          pathFromWord(input.quiver, rightAppend, "R2L")
        ];
        candidates.push({
          n: degree,
          pieces: nextPieces,
          orientation: "R2L",
          kind: "left"
        });
      }
    }
  }
  const deduped = dedupeAmbiguities(candidates);
  ambiguityLog(`${AMBIGUITY_LOG_PREFIX} left R2L extension end`, {
    degree,
    candidates: candidates.length,
    deduped: deduped.length
  });
  return deduped;
}
function computeNextRightL2R(input, previous, degree) {
  const relationWords = input.minimisedRelations.map((relation) => relation.path.arrows);
  const candidates = [];
  ambiguityLog(`${AMBIGUITY_LOG_PREFIX} right L2R extension start`, {
    degree,
    previous: previous.length,
    relations: relationWords.length
  });
  for (const ambiguity of previous) {
    const firstPiece = ambiguity.pieces[0];
    if (!firstPiece || firstPiece.arrows.length === 0) {
      continue;
    }
    for (const relationWord of relationWords) {
      for (const leftPrepend of leftPrependsForRelationPrefix(firstPiece.arrows, relationWord)) {
        const joinedLeft = [...leftPrepend, ...firstPiece.arrows];
        if (!isPathWord(input.quiver, joinedLeft, "L2R") || !wordsEqual(prefix(joinedLeft, relationWord.length), relationWord) || isStrictSuffixRelation(joinedLeft, relationWords)) {
          continue;
        }
        const nextPieces = [
          pathFromWord(input.quiver, leftPrepend, "L2R"),
          ...ambiguity.pieces
        ];
        candidates.push({
          n: degree,
          pieces: nextPieces,
          orientation: "L2R",
          kind: "right"
        });
      }
    }
  }
  const deduped = dedupeAmbiguities(candidates);
  ambiguityLog(`${AMBIGUITY_LOG_PREFIX} right L2R extension end`, {
    degree,
    candidates: candidates.length,
    deduped: deduped.length
  });
  return deduped;
}
function computeLeftAmbiguitiesR2L(input) {
  let sequence;
  sequence = makeSequence("left R2L", (index) => {
    if (index === -1) {
      return gammaMinusOne(input.quiver, "R2L", "left");
    }
    if (index === 0) {
      return gammaZeroR2L(input.quiver);
    }
    if (index === 1) {
      return gammaOneR2L(input);
    }
    const previous = sequence.getAt(index - 1);
    if (previous.length === 0) {
      return [];
    }
    return computeNextLeftR2L(input, previous, index);
  });
  return sequence;
}
function computeRightAmbiguitiesL2R(input) {
  let sequence;
  sequence = makeSequence("right L2R", (index) => {
    if (index === -1) {
      return gammaMinusOne(input.quiver, "L2R", "right");
    }
    if (index === 0) {
      return gammaZeroL2R(input.quiver);
    }
    if (index === 1) {
      return gammaOneL2R(input);
    }
    const previous = sequence.getAt(index - 1);
    if (previous.length === 0) {
      return [];
    }
    return computeNextRightL2R(input, previous, index);
  });
  return sequence;
}
function ambiguitySignatures(ambiguities) {
  return ambiguities.map(ambiguityKey).sort();
}
function equivalentAmbiguityLists(leftR2L, rightL2R) {
  const leftAsRight = leftR2L.map((ambiguity) => reverseOrientationOfAmbiguity(ambiguity));
  const leftKeys = ambiguitySignatures(leftAsRight);
  const rightKeys = ambiguitySignatures(rightL2R);
  return wordsEqual(leftKeys, rightKeys);
}
function computeAmbiguitiesFromVerified(verified, comparisonMaxDegree = verified.maxPathLength) {
  const checkedComparisonMaxDegree = Math.max(-1, Math.floor(comparisonMaxDegree));
  ambiguityGroupCollapsed(`${AMBIGUITY_LOG_PREFIX} orientation cross-check`);
  ambiguityLog("cross-check input", {
    arrows: verified.quiver.arrows.length,
    minimisedRelations: verified.minimisedRelations.length,
    maxPathLength: verified.maxPathLength,
    comparisonMaxDegree: checkedComparisonMaxDegree
  });
  const primaryLeftR2L = computeLeftAmbiguitiesR2L(verified);
  const checkRightL2R = computeRightAmbiguitiesL2R(verified);
  const warnings = [];
  for (let degree = -1;degree <= checkedComparisonMaxDegree; degree += 1) {
    ambiguityTime(`${AMBIGUITY_LOG_PREFIX} compare Gamma[${degree}]`);
    const left = primaryLeftR2L.getAt(degree);
    const right = checkRightL2R.getAt(degree);
    ambiguityTimeEnd(`${AMBIGUITY_LOG_PREFIX} compare Gamma[${degree}]`);
    ambiguityLog(`${AMBIGUITY_LOG_PREFIX} compare Gamma[${degree}]`, {
      leftR2L: left.length,
      rightL2R: right.length
    });
    if (!equivalentAmbiguityLists(left, right)) {
      warnings.push({
        kind: "orientation-mismatch",
        degree,
        message: `${formatOrientation("R2L")} left ambiguities and ${formatOrientation("L2R")} right ambiguities differ in degree ${degree}.`,
        leftR2L: left,
        rightL2R: right
      });
      break;
    }
  }
  ambiguityLog("cross-check warnings", warnings.length);
  ambiguityGroupEnd();
  return {
    primaryLeftR2L,
    checkRightL2R,
    warnings
  };
}

// src/frontend/computation-controller.ts
var DEFAULT_COMPUTE_TERM_BOUND = 5;
var COMPUTATION_LOG_PREFIX = "[GAPCytoEx ambiguity]";
function currentQuiver(state) {
  if (!state.cy) {
    return null;
  }
  return {
    vertices: state.cy.nodes().map((node) => ({
      id: node.id(),
      label: node.data("label")
    })),
    arrows: state.cy.edges().map((edge) => ({
      id: edge.id(),
      source: edge.data("source"),
      target: edge.data("target"),
      label: edge.data("label") ?? edge.id()
    }))
  };
}
function maxPathLengthValue() {
  const input = document.getElementById("max-path-length");
  const value = Number(input?.value ?? "");
  return Number.isFinite(value) ? value : 50;
}
function computeTermBoundValue() {
  const input = document.getElementById("compute-term-bound");
  const value = Number(input?.value ?? "");
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_COMPUTE_TERM_BOUND;
}
function logOnlyLastTermValue() {
  return document.getElementById("log-only-last-term")?.checked ?? false;
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatOrientation2(orientation) {
  return orientation === "R2L" ? "right-to-left" : "left-to-right";
}
function termCountText(maxDegree) {
  return `${maxDegree} ${maxDegree === 1 ? "term" : "terms"}`;
}
function computeAndRenderAmbiguities(state) {
  const quiver = currentQuiver(state);
  if (!quiver) {
    setError("Draw a quiver before computing ambiguities.");
    return;
  }
  try {
    const maxPathLength = maxPathLengthValue();
    const maxDegree = computeTermBoundValue();
    const logOnlyLastTerm = logOnlyLastTermValue();
    console.groupCollapsed(`${COMPUTATION_LOG_PREFIX} compute button`);
    console.log("input", {
      vertices: quiver.vertices.length,
      arrows: quiver.arrows.length,
      relations: state.relations.length,
      activeOrientation: formatOrientation2(state.activePathOrientation),
      maxPathLength,
      maxDegree,
      logOnlyLastTerm
    });
    console.time(`${COMPUTATION_LOG_PREFIX} total`);
    console.time(`${COMPUTATION_LOG_PREFIX} tidy algebra`);
    const verified = tidyUpRelationDataAlgebra({
      quiver,
      relations: state.relations,
      activeOrientation: state.activePathOrientation,
      maxPathLength,
      fieldCharacteristic: state.activeFieldCharacteristic
    });
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} tidy algebra`);
    console.log("verified algebra", {
      arrows: verified.quiver.arrows.length,
      originalRelations: verified.originalRelations.length,
      minimisedRelations: verified.minimisedRelations.length,
      maxPathLength: verified.maxPathLength,
      logs: verified.logs.map((entry) => entry.message)
    });
    console.time(`${COMPUTATION_LOG_PREFIX} build/check ambiguity sequences`);
    const computation = computeAmbiguitiesFromVerified(verified, maxDegree);
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} build/check ambiguity sequences`);
    console.time(`${COMPUTATION_LOG_PREFIX} render requested terms`);
    const ambiguityGroupsR2L = getLazySequenceTerms(computation.primaryLeftR2L, -1, maxDegree, logOnlyLastTerm).map(([degree, ambiguities]) => ({
      degree,
      ambiguities
    }));
    const ambiguityGroupsL2R = getLazySequenceTerms(computation.checkRightL2R, -1, maxDegree, logOnlyLastTerm).map(([degree, ambiguities]) => ({
      degree,
      ambiguities
    }));
    state.ambiguityGroupsByOrientation = {
      L2R: ambiguityGroupsL2R,
      R2L: ambiguityGroupsR2L
    };
    state.selectedAmbiguityId = null;
    refreshAmbiguitiesOutput(state);
    setRelationPanelTab(state, "ambiguities");
    for (const { degree, ambiguities } of state.ambiguityGroupsByOrientation[state.activePathOrientation]) {
      console.log("render term", { degree, ambiguities: ambiguities.length });
    }
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} render requested terms`);
    const logLines = [`Ambiguities computed up to ${termCountText(maxDegree)}.`];
    for (const warning of computation.warnings) {
      logLines.push(warning.message);
    }
    appendOutputHtml(logLines.join("<br>"));
    setInfoStatus(computation.warnings.length > 0 ? computation.warnings[0].message : "Ambiguities computed.");
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} total`);
    console.groupEnd();
  } catch (error) {
    console.error(`${COMPUTATION_LOG_PREFIX} failed`, error);
    console.timeEnd(`${COMPUTATION_LOG_PREFIX} total`);
    console.groupEnd();
    if (error instanceof MonomialAlgebraError) {
      appendOutputHtml(error.logs.map((entry) => `<div class="status-warn">${escapeHtml(entry.message)}</div>`).join(""));
      setInfoStatus("Ambiguity computation blocked: relations are not monomial.", true);
      return;
    }
    setError(error.message);
    setInfoStatus("Ambiguity computation failed.", true);
  }
}

// src/frontend/app-events.ts
function bindClick(id, handler) {
  document.getElementById(id)?.addEventListener("click", (event) => handler(event));
}
function translateQpaFromInputs(state) {
  try {
    const qpaInput = document.getElementById("inQuiver")?.value ?? "";
    const relationInput = document.getElementById("inRelation")?.value ?? "";
    const result = parseQpaInput(qpaInput, relationInput, {
      forceVertexIds: document.getElementById("forceID")?.checked ?? false,
      forceArrowIds: document.getElementById("forceArrow")?.checked ?? false
    });
    state.activeFieldCharacteristic = result.characteristic;
    setFieldCharacteristic(result.characteristic, true);
    const nodes = result.elements.filter((element) => element.group === "nodes");
    const edges = result.elements.filter((element) => element.group === "edges");
    presentData(state, { nodes, edges }, result.relations);
  } catch (error) {
    setError(error.message);
  }
}
function bindWorkbenchEvents(state) {
  applyTheme(state, initialTheme());
  bindClick("bendLeft", () => bendArrow(state, "L"));
  bindClick("bendRight", () => bendArrow(state, "R"));
  bindClick("fixCyto", () => state.cy?.fit());
  bindClick("saveSVG", () => saveFile(state, "svg"));
  bindClick("saveJSON", () => saveFile(state, "json"));
  bindClick("themeToggle", () => toggleTheme(state));
  bindClick("translateBtn", () => translateQpaFromInputs(state));
  bindClick("btnDoubleQuiver", () => doubleQuiver(state));
  bindClick("btnUnselectRelns", () => selectRelation(state, -1));
  bindClick("btnAddReln", () => toggleAddRelationMode(state));
  bindClick("btnEditReln", () => editSelectedRelation(state));
  bindClick("toQPABtn", () => translateToQpa(state));
  bindClick("computeAmbiguitiesBtn", () => computeAndRenderAmbiguities(state));
  bindClick("resetCanvasRelations", () => clearAll(state));
  bindClick("clearOutput", () => setOutputHtml(""));
  bindClick("clearQuiverInput", () => {
    const input = document.getElementById("inQuiver");
    if (input) {
      input.value = "";
    }
  });
  bindClick("clearRelationInput", () => {
    const input = document.getElementById("inRelation");
    if (input) {
      input.value = "";
    }
  });
  document.getElementById("loadJsonBtn")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) {
      loadJsonFile(state, file);
    }
  });
  document.querySelectorAll('input[name="editMode"]').forEach((element) => {
    element.addEventListener("change", (event) => {
      const value = event.target.value;
      if (value === "default" || value === "add" || value === "rename" || value === "delete") {
        state.mode = value;
      }
      state.cy?.elements().unselect();
    });
  });
  document.getElementById("relOutput")?.addEventListener("beforeinput", (event) => guardRelationOutputEdit(state, event));
  document.getElementById("relOutput")?.addEventListener("mousedown", (event) => focusAddRelationEditor(state, event));
  document.querySelectorAll("[data-relation-panel-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.relationPanelTab;
      if (tab === "relations" || tab === "ambiguities") {
        setRelationPanelTab(state, tab);
      }
    });
  });
  document.getElementById("wriggle")?.addEventListener("click", () => {
    state.cy?.layout({ name: "cose", animate: true, animationDuration: 1500, randomize: false, nodeDimensionsIncludeLabels: true }).run();
  });
  document.getElementById("cy")?.addEventListener("click", (event) => createInitialVertexAtClick(state, event));
  document.querySelectorAll("[data-orientation]").forEach((button) => {
    button.addEventListener("click", () => {
      const orientation = button.dataset.orientation;
      if (orientation === "L2R" || orientation === "R2L") {
        setPathOrientation(state, orientation);
      }
    });
  });
  setPathOrientation(state, state.activePathOrientation);
  setFieldCharacteristic(0, false);
  appendInfoLog("Ready.");
}

// src/frontend/splitters.ts
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
    if (!target)
      return;
    const rect = target.getBoundingClientRect();
    const rawWidth = options.side === "right" ? rect.right - clientX : clientX - rect.left;
    const width = Math.max(options.min, Math.min(options.max, rawWidth));
    const roundedWidth = Math.round(width);
    target.style.setProperty(options.variableName, `${roundedWidth}px`);
    target.style.gridTemplateColumns = options.gridTemplate(roundedWidth);
    fitCy();
  }
  function start(event) {
    if (event.type === "mousedown" && "button" in event && event.button !== 0) {
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
function bindSplittersNow() {
  const infoSplitter = document.querySelector("[data-resize-splitter='info']");
  const infoTarget = document.querySelector(".workbench-grid");
  const relationSplitter = document.querySelector("[data-resize-splitter='relations']");
  const relationTarget = document.querySelector(".canvas-row");
  bindHorizontalResize(infoSplitter, infoTarget, {
    variableName: "--info-width",
    min: 300,
    max: 620,
    side: "right",
    gridTemplate: (width) => `minmax(0, 1fr) 12px minmax(300px, ${width}px)`
  });
  bindHorizontalResize(relationSplitter, relationTarget, {
    variableName: "--relation-width",
    min: 190,
    max: 520,
    side: "left",
    gridTemplate: (width) => `minmax(190px, ${width}px) 12px minmax(0, 1fr)`
  });
}
function bindSplitters() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSplittersNow, { once: true });
    return;
  }
  bindSplittersNow();
}
bindSplitters();

// src/frontend/app.ts
var state = createWorkbenchState();
var maxPathLength = document.getElementById("max-path-length");
maxPathLength?.addEventListener("input", () => {
  const value = Number(maxPathLength.value);
  if (Number.isFinite(value) && value >= 20) {
    return;
  }
  const infoStatus = document.getElementById("info-status");
  if (infoStatus) {
    infoStatus.textContent = "maxPathLength must be at least 20.";
    infoStatus.classList.add("status-warn");
  }
});
bindWorkbenchEvents(state);

//# debugId=1C183397E498C18C64756E2164756E21
//# sourceMappingURL=app.js.map

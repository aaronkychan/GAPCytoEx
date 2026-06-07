const letters = [...Array(52).keys()].map((i) =>
    String.fromCharCode(97 + (i % 26) + (i < 26 ? 0 : -32)),
);
// 26 small letters, then 26 capital letters
var QuiverData, cy, Relations;
let mode = "default";
let addingArrow = false;
let sourceNodeID = null;
let selectedRelationIndex = -1;
let addRelationMode = false;
let autoNameVertexCounter = 0;
let autoNameArrowCounter = 1;
let animationTimer = null;
let activePathOrientation = "L2R";
let activeFieldCharacteristic = 0;

function infLetters(i) {
    // i=0,...,51 gives alphabet, othersie alphabet-with-hat
    var res = letters[i % 52];
    res += Array(parseInt(i / 52 + 1))
        .fill("")
        .reduce((prev, curr) => prev + "^");
    return res;
}

const primes = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61,
];
const gens = [1, 2, 2, 3, 2, 2, 3, 2, 5, 2, 3, 2, 6, 3, 5, 2, 2, 2];

const pa = (msg) => {
    document.getElementById("outTxtBox").innerHTML =
        `<span style='color:red; font-size: 20pt'>${msg}</span>`;
};

function appendInfoLog(message) {
    const log = document.getElementById("outTxtBox");
    if (!log) return;
    const line = document.createElement("div");
    line.textContent = message;
    log.appendChild(line);
}

function characteristicText(characteristic) {
    return characteristic === 0
        ? "Characteristic 0 (real)"
        : `Characteristic ${characteristic}`;
}

function setFieldCharacteristic(characteristic, shouldLog = false) {
    activeFieldCharacteristic = characteristic || 0;
    const display = document.getElementById("field-characteristic");
    if (display) {
        display.textContent = characteristicText(activeFieldCharacteristic);
    }
    if (shouldLog) {
        appendInfoLog(`${characteristicText(activeFieldCharacteristic)}.`);
    }
}

const stripLineBreaksAndSpaces = (str) =>
    str.replace(/(\\\r\n|\\\r|\\\n)/, "").replace(/\s+/g, "");

const matchDeepestBrackets = (str) => str.match(/\[([^\[\]])*\]/g);

function isPowerOfPrime(x) {
    for (let p of primes) {
        if (x == p) return [p, 1];
        let logp = Math.log(x) / Math.log(p);
        if (logp % 1 === 0) return [p, logp];
    }
    console.log(`Cannot find ${x} as a power of prime less than 62`);
    return [0, 0];
}

//#region  *** Translation ***
function findFieldChar(str) {
    // find the charactersitic of the field,
    // str is of the form "(Z(n)^d)"" or "(Z(n))" for some integers n,d if over finite field
    // over rations, it will be of the form (1)
    return str[1] == "Z"
        ? isPowerOfPrime(parseInt(str.slice(3, str.indexOf(")"))))[0]
        : 0;
}

function getCpxNum(str) {
    // if str is of the form (n) for some integer n, then return n; otherwise return everything
    if (str.indexOf("/") != -1) return str;
    if (str.indexOf(".") != -1) return str;
    if (str.indexOf("i") != -1) return str;
    return str.indexOf("(") != -1 ? str.slice(1, -1) : str;
}

function translateScalar(a, char) {
    //input a is of the form "(s)" for string s
    if (char == -1) return a; //something is strange
    if (char == 0) {
        var res = getCpxNum(a);
        if (res[0] != "(") {
            return res == "+1" || res == "1" ? "" : res == "-1" ? "-" : res;
        } else {
            return res;
        }
    }
    // char p case, a is of the form "(Z(n)^d)"" or "(Z(n))" for some integers n,d
    var hasExpo = a.indexOf("^");
    var expo = hasExpo != -1 ? a.slice(hasExpo + 1, -1) : 1; //exponent
    if (expo == 0) return "";
    else {
        var result = Math.pow(gens[primes.indexOf(char)], parseInt(expo));
        return result == char - 1 ? "-" : result; //convert to just a minus sign if it is p-1
    }
}

function detectRelation(str) {
    // brackets that do not contain brackets inside
    let deepest = matchDeepestBrackets(str);
    // console.log(deepest);
    // match a double bracket
    // ! there should be only one such; code breaks if this is not the case
    let s = str.search(/\[\s*\[/),
        t = str.search(/\]\s*\]/);
    // the sliced string contains the list of arrays inside the 2-dim array
    // without the outermost bracket
    let m = matchDeepestBrackets(
        str.slice(s + 1, t + str.match(/\]\s*\]/)[0].length - 1),
    ).length;

    // bad if deepest.length-m is neither 2 nor 1
    // console.log("deepest.len - level2.len = ", deepest.length - m);
    s = deepest.length - m == 2 ? str.search(/\[([^\[\]])*\]\s*$/) : str.length;
    return [str.slice(0, s), str.slice(s)];
}

const positiveCoeffFirst = (x, y) =>
    x.scalar > 0 ? (y.scalar > 0 ? 0 : -1) : 1;
const increasingMonomialLength = (x, y) =>
    x.monomial.length - y.monomial.length;
const increasingNumOfTerms = (r1, r2) => r1.terms.length - r2.terms.length;
const monomialWithPositiveCoeffFirst = (r1, r2) =>
    r1.terms.length == 1 && r2.terms.length == 1
        ? positiveCoeffFirst(r1.terms[0], r2.terms[0])
        : increasingNumOfTerms(r1, r2);

/**
 * @typedef {object} TermsData
 * @property {string} scalar
 * @property {number[]} monomial  index (in the arrow array) of each generator in the monomial
 */
/**
 * @param  {TermsData} terms
 */
function termsToRelation(terms, joinStr = "·") {
    return terms
        .map((t, i) => {
            const monomial = t.monomial.join(joinStr);
            const joinToken = joinStr;
            if (t.scalar === "") return `${i === 0 ? "" : "+"}${monomial}`;
            if (t.scalar === "-") return `-${monomial}`;
            const scalar = `${t.scalar}`;
            const sign = scalar.startsWith("-") || i === 0 ? "" : "+";
            return `${sign}${scalar}${joinToken}${monomial}`;
        })
        .join("");
}

function monomialDisplay(monomial, orientation) {
    const arrows = orientation === "R2L" ? [...monomial].reverse() : monomial;
    return arrows.join("·");
}

function termsToDisplayRelation(terms, orientation = activePathOrientation) {
    return terms
        .map((t, i) => {
            const monomial = monomialDisplay(t.monomial, orientation);
            if (t.scalar === "") return `${i === 0 ? "" : "+"}${monomial}`;
            if (t.scalar === "-") return `-${monomial}`;
            const scalar = `${t.scalar}`;
            const sign = scalar.startsWith("-") || i === 0 ? "" : "+";
            return `${sign}${scalar}·${monomial}`;
        })
        .join("");
}

function scalarToInputScalar(scalar) {
    if (scalar === "") return "+1";
    if (scalar === "-") return "-1";
    return `${scalar}`;
}

function termsToRelationInput(terms) {
    return terms
        .map((term, i) => {
            const scalar = scalarToInputScalar(term.scalar);
            const sign = i === 0 ? "" : "+";
            return `${sign}(${scalar})*${term.monomial.join("*")}`;
        })
        .join("");
}

function relationArrowNames(relations) {
    return new Set(
        (relations || []).flatMap((rel) =>
            (rel.terms || []).flatMap((term) => term.monomial || []),
        ),
    );
}

function currentArrowNames(cyInstance) {
    if (!cyInstance) return new Set();
    return new Set(cyInstance.edges().map((edge) => edge.id()));
}

function validateRelationArrowReferences(relations, cyInstance) {
    const arrows = currentArrowNames(cyInstance);
    const missing = [...relationArrowNames(relations)].filter(
        (name) => !arrows.has(name),
    );
    if (missing.length > 0) {
        pa(
            `Relations refer to unknown arrow(s): ${[
                ...new Set(missing),
            ].join(", ")}`,
        );
        return false;
    }
    return true;
}

function renameArrowInRelations(oldName, newName, relations, cyInstance) {
    if (!relations || relations.length === 0) return false;

    let renamed = false;
    for (const rel of relations) {
        if (!rel.terms) continue;
        let relationChanged = false;
        for (const term of rel.terms) {
            if (!term.monomial) continue;
            for (let i = 0; i < term.monomial.length; i++) {
                if (term.monomial[i] === oldName) {
                    term.monomial[i] = newName;
                    relationChanged = true;
                    renamed = true;
                }
            }
        }
        if (relationChanged) rel.reln = termsToRelation(rel.terms);
    }

    if (renamed) {
        validateRelationArrowReferences(relations, cyInstance);
        refreshRelationsOutput(relations);
    }
    return renamed;
}

function splitRelationTerms(relInputStr) {
    const terms = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < relInputStr.length; i++) {
        const char = relInputStr[i];
        if (char === "(") depth++;
        if (char === ")") depth = Math.max(0, depth - 1);
        if ((char === "+" || char === "-") && depth === 0 && i > start) {
            terms.push(relInputStr.slice(start, i));
            start = i;
        }
    }
    terms.push(relInputStr.slice(start));
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
        const scalar =
            leadingSign === "-" && !explicitScalar[1].startsWith("-")
                ? `-${explicitScalar[1]}`
                : explicitScalar[1];
        return { scalarRaw: scalar, generators: explicitScalar[2].split("*") };
    }

    return {
        scalarRaw: leadingSign === "-" ? "-1" : "+1",
        generators: term.split("*"),
    };
}

/**
 * @typedef {object} RelationData
 * @property {string} reln  string display in output
 * @property {TermsData[]} terms  details of each term
 * @property {number} [fieldChar]
 */
/**
 * @param  {string} relInputStr
 * @param  {string[]} generatorReference
 * @param  {number} fieldChar
 * @return {RelationData}
 */
function QPARelationToRelationData(relInputStr, generatorReference, fieldChar) {
    /** @type {RelationData} */
    let relData = { reln: "", terms: [], fieldChar: fieldChar };

    let terms = splitRelationTerms(relInputStr);
    for (let i = 0; i < terms.length; i++) {
        const { scalarRaw, generators } = parseRelationTerm(terms[i]);
        if (!generators.length || generators.some((generator) => generator === "")) {
            pa(
                `Relation string ${relInputStr}, term ${terms[i]} is of invalid format`,
            );
            throw new Error("Invalid format in a term of relation");
        }

        if (relData.fieldChar == -1) {
            // try to find characteristic if not yet known
            relData.fieldChar = findFieldChar(scalarRaw);
            setFieldCharacteristic(relData.fieldChar, true);
        }

        // translate scalar string to more readable form if possible
        // empty string if scalar is 1
        const scalar = translateScalar(scalarRaw, relData.fieldChar);
        let termData = { scalar: scalar, monomial: [] };

        // translate the monomial part in the term
        generators
            .map((x) => {
                let q = generatorReference.indexOf(x);
                // q!=-1 => return replaced letters; otherwise its a scalar elt
                let arr =
                    q != -1
                        ? document.getElementById("forceArrow").checked
                            ? infLetters(q)
                            : x
                        : x;
                termData.monomial.push(arr);
                return arr;
            });

        relData.terms.push(termData);
    }
    relData.reln = termsToRelation(relData.terms);
    return relData;
}

function translateGraphToQPA(graphData) {
    const nodes = graphData.nodes || [];
    const edges = graphData.edges || [];
    const vxNames = nodes.map((node) => node.data.id);
    const arrStrs = edges.map((edge) => {
        const { source, target, label } = edge.data;
        return `["${source}", "${target}", "${label}"]`;
    });
    const relStrs = Relations
        ? Relations.map(({ terms }) => termsToRelation(terms, "*"))
        : [];
    const relations = `[${relStrs.join(", ")}]`;
    return `Q:=Quiver([${vxNames.map((v) => `"${v}"`).join(", ")}], [${arrStrs.join(", ")}]);\nR:=${relations};`;
}

/**
 * @typedef {[string, string, string]} Arrow
 * An arrow: [source, target, name]
 */

/**
 * @typedef {[string[], Arrow[]]} Quiver
 * [nameOfVertices, arrows]
 */

//#region ** Relation **

/**
 * @param  {string} relnStr
 * @param  {Quiver} quiver
 * @return {RelationData}
 */
function transalteQPARelation(relationStr, quiver, updateRelationInput = true) {
    const arrows = quiver[1];
    var arrRef = arrows.map((a) => a[2]);
    // strip brackets and whitespaces
    relationStr =
        relationStr === ""
            ? document.getElementById("inRelation").value
            : relationStr;
    if (updateRelationInput) {
        document.getElementById("inRelation").value = relationStr;
    }
    // remove line change and spaces
    var arrRelns = relationStr
        .replace(/(\\\r\n|\\\r|\\\n)/g, "")
        .replace(/[\s\[\]]/g, "")
        .split(",");
    if (arrRelns.length == 1 && arrRelns[0] === "") {
        arrRelns = [];
    }
    var charFound = -1; // charactersitic of the field

    /** @type {RelationData[]} */
    var relData = [];
    for (let rel of arrRelns) {
        // let readIndex = 0;
        // let terms = rel.split(/[\+-]/);
        // // console.log("rel: ", rel, " | monomial:", monomial);
        // let newRel = "";
        // let reldataentry = Array(terms.length).fill({
        //     scalar: 1,
        //     monomial: [],
        //     originalIdx: 0,
        // });
        // for (let i = 0; i < terms.length; i++) {
        //     reldataentry[i].originalIdx = i;
        //     // split each monomial into scalar and generating factors
        //     let factors = terms[i].split("*");
        //     let arrInMon = [],
        //         scalar = "1";
        //     if (factors[0][0] != "(") {
        //         // first factor is probably not a scalar
        //         if (arrRef.indexOf(factors[0]) > -1) {
        //             arrInMon = factors;
        //         } else {
        //             scalar = factors[0];
        //             arrInMon = factors.slice(1);
        //         }
        //     } else {
        //         scalar = factors[0];
        //         arrInMon = factors.slice(1);
        //     }
        //     // let [scalar, ...arrs] = monomial[i].split("*");
        //     if (charFound == -1) {
        //         // try to find characteristic if not yet known
        //         charFound = findFieldChar(scalar);
        //     }
        //     // translate scalar string to more readable form if possible
        //     scalar = translateScalar(scalar, charFound);
        //     reldataentry[i].scalar = scalar; // empty string if scalar is 1

        //     // translate a summand of the relation
        //     let newMono = arrInMon
        //         .map((x) => {
        //             let q = arrRef.indexOf(x);
        //             // q!=-1 => return replaced letters; otherwise its a scalar elt
        //             let arr =
        //                 q != -1
        //                     ? document.getElementById("forceArrow").checked
        //                         ? infLetters(q)
        //                         : x
        //                     : x;
        //             reldataentry[i].monomial.push(arr);
        //             return arr;
        //         })
        //         .join("·");
        //     readIndex += terms[i].length;
        //     newMono += i + 1 == terms.length ? "" : rel[readIndex];
        //     newRel +=
        //         scalar == ""
        //             ? newMono
        //             : scalar == "-"
        //               ? `-${newMono}`
        //               : `${scalar}·${newMono}`;
        //     readIndex++;
        // }
        // relData.push({ reln: newRel, terms: reldataentry });
        // // relns.push(newRel);
        let relobj = QPARelationToRelationData(rel, arrRef, charFound);
        console.log(relobj);
        relData.push(relobj);
        charFound = charFound == -1 ? relobj.fieldChar : charFound;
    }
    relData.sort(monomialWithPositiveCoeffFirst);
    if (charFound == -1) {
        setFieldCharacteristic(0, false);
    }

    return relData;
}

function quiverFromCyto(cyInstance) {
    return [
        cyInstance.nodes().map((node) => node.id()),
        cyInstance
            .edges()
            .map((edge) => [
                edge.data("source"),
                edge.data("target"),
                edge.id(),
            ]),
    ];
}

function parseSingleRelationInput(relationInput, cyInstance) {
    const input = relationInput.trim();
    if (!input) return null;

    const relationData = transalteQPARelation(
        input,
        quiverFromCyto(cyInstance),
        false,
    );
    if (relationData.length !== 1) {
        pa("Please enter exactly one relation.");
        return null;
    }
    return relationData[0];
}

function splitRelationEntries(relationInput) {
    return relationInput
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry !== "");
}

function parseRelationEntriesInput(relationInput, cyInstance) {
    const entries = splitRelationEntries(relationInput);
    if (entries.length === 0) return [];

    return transalteQPARelation(
        entries.join(","),
        quiverFromCyto(cyInstance),
        false,
    );
}

function translateQPA() {
    var [quiverIn, relationStr] = detectRelation(
        document.getElementById("inQuiver").value,
    );

    // console.log("quiver: ", quiverIn);
    // console.log("relations: ", relationStr);

    quiverIn = stripLineBreaksAndSpaces(quiverIn);
    quiverIn = quiverIn.replace(/(\r\n|\n|\r)/g, ""); // remove linebreaks
    quiverIn = quiverIn.replace(/\\/g, ""); // replace " \ "
    quiverIn = quiverIn.replace(/;/g, ""); // replace " ; "
    quiverIn = quiverIn.replace(/^(\s*)Quiver(\(*)/, "");
    quiverIn = quiverIn.replace(/\)(\s*)$/, "");
    // turn input Quiver([vxs], [arrows]) into array [ [vxs], [arrows] ]
    if (quiverIn[0] != "[") {
        // input is possibly in the from Quiver( n, [arrows] )
        let numVx = parseInt(quiverIn.split(",", 1));
        if (numVx > 0) {
            let arrv = Array.from({ length: numVx }, (_, i) => i + 1);
            quiverIn =
                JSON.stringify(arrv) + quiverIn.slice(quiverIn.indexOf(","));
        } else {
            console.log("not a number before first comma");
        }
    }
    quiverIn = "[" + quiverIn + "]";
    /** @type {QuiverData} */
    var quiverQPA = JSON.parse(quiverIn);

    // Forbid too many vertices
    if (quiverQPA[0].length > 70) {
        pa("More than 70 vertices! Abort translation.");
        // document.getElementById("outTxtBox").innerHTML =
        //     "<span style='color:red; font-size: 20pt'>More than 25 vertices! Abort translation.</span>";
        clearAll();
        return;
    }

    //region# Vertices
    var forceID = document.getElementById("forceID").checked;
    var vxQPA = quiverQPA[0].map((v, i) =>
        forceID ? i + 1 : `${v}`.replace(/"/g, ""),
    );
    var vx = vxQPA.map((v) => {
        return {
            data: { id: v },
        };
    });
    //console.table(vxQPA);
    //console.table(vx);

    //region# Arrows
    var arrows = quiverQPA[1].map((ar, i) => {
        var idlabel = document.getElementById("forceArrow").checked
            ? infLetters(i)
            : ar[2];
        var core = {
            id: idlabel,
            source: forceID ? quiverQPA[0].indexOf(ar[0]) + 1 : ar[0],
            target: forceID ? quiverQPA[0].indexOf(ar[1]) + 1 : ar[1],
            label: idlabel,
        };
        return { data: core };
    });

    //Tidy up data
    QuiverData = { nodes: vx, edges: arrows };
    Relations = transalteQPARelation(relationStr, quiverQPA);
    //console.log("Quiver prepared: ", QuiverData);
    //console.log("Relations: ", Relations);
    presentData(QuiverData, Relations);
}

function refreshRelationsOutput(relations) {
    addRelationMode = false;
    let outputDiv = document.getElementById("relOutput");
    outputDiv.innerHTML = "";
    outputDiv.classList.remove("add-relation-mode");
    outputDiv.contentEditable = "false";
    selectedRelationIndex = -1;
    for (let i = 0; i < relations.length; i++) {
        // for (const r of relations) {
        let divElt = document.createElement("div");
        divElt.classList.add("relationRow");
        divElt.contentEditable = "false";
        divElt.setAttribute("id", relations[i].reln);
        divElt.innerHTML = termsToDisplayRelation(
            relations[i].terms,
            activePathOrientation,
        );
        divElt.addEventListener("click", () => {
            selectNthRelation(i);
        });
        outputDiv.appendChild(divElt);
    }
    document.getElementById("btnAddReln").value = "Add relation(s)";
}

function applyPathOrientationLabel() {
    document.querySelectorAll("[data-orientation]").forEach((button) => {
        button.setAttribute(
            "aria-pressed",
            button.dataset.orientation === activePathOrientation
                ? "true"
                : "false",
        );
    });
}

function setPathOrientation(orientation) {
    if (orientation !== "L2R" && orientation !== "R2L") return;
    if (orientation === activePathOrientation) {
        applyPathOrientationLabel();
        return;
    }

    const relationToSelect = selectedRelationIndex;
    activePathOrientation = orientation;
    applyPathOrientationLabel();

    if (Relations) {
        refreshRelationsOutput(Relations);
        if (
            cy &&
            relationToSelect >= 0 &&
            relationToSelect < Relations.length
        ) {
            selectNthRelation(relationToSelect);
        }
    }
}

window.GAPCytoEx = {
    ...(window.GAPCytoEx || {}),
    setPathOrientation,
};

function presentData(quiver, relations, isPreset = false) {
    refreshRelationsOutput(relations);
    // get Cyto ready
    document.getElementById("saveSVG").disabled = false;
    document.getElementById("fixCyto").disabled = false;
    document.getElementById("wriggle").disabled = false;
    document.getElementById("toQPABtn").disabled = false;
    cy = initCyto(quiver, isPreset);
}

// composition of comparisons (sort order)
/**
 * @param  {[ [any,any]->int ]} compfuncs array of comparison functions
 * @param  {any} a
 * @param  {any} b
 */
function composeCompares(compfuncs, a, b) {
    let c = range(compfuncs.length).map((i) => compfuncs[i](a[i], b[i]));
    return c.reduce((accum, curr) => (accum ? accum : curr));
}

function selectNthRelation(n) {
    selectedRelationIndex = n;
    if (animationTimer) {
        if (Array.isArray(animationTimer)) {
            animationTimer.forEach((t) => clearInterval(t));
        } else {
            clearInterval(animationTimer);
        }
        animationTimer = null;
    }
    let rows = document.querySelectorAll("#relOutput .relationRow");
    // unselect all paths
    const colors = cytoThemeColors();
    for (const e of cy.edges()) {
        e.style(coloredEdgeStyle(colors.edge));
        e.removeStyle(
            "line-fill line-gradient-stop-colors line-gradient-stop-positions",
        );
    }
    // un/highlight the row and select new paths
    // if n=-1, then it will just unhighlight all rows and select no path
    for (let i = 0; i < rows.length; i++) {
        if (i == n) {
            rows[i].classList.add("selectedRelationRow");
            let color = relationHighlightColor(i);
            const pathsToAnimate = [];
            let allEdges = cy.collection();
            console.log(Relations[i]);
            for (const t of Relations[i].terms) {
                const edgesInPath = [];
                console.log("t: ", t.monomial.join("."));
                for (const m of t.monomial) {
                    let edge = cy.getElementById(m);
                    edgesInPath.push(edge);
                    allEdges = allEdges.union(edge);
                }
                pathsToAnimate.push(edgesInPath);
                console.log(
                    "pathsToAnimate length: ",
                    pathsToAnimate.length,
                    " | edges added: ",
                    edgesInPath.length,
                );
            }

            allEdges.style(coloredEdgeStyle(color));
            allEdges.style({
                "line-fill": "linear-gradient",
                "line-gradient-stop-colors": `${color} ${color} #dafd13 ${color} ${color}`,
                "line-gradient-stop-positions": "0 0 0 0 0",
            });

            let pos = 0;
            console.log(
                `pathsToAnimate: `,
                pathsToAnimate
                    .map((p) => p.map((e) => e.id()).join("."))
                    .join(" / "),
            );
            animationTimer = setInterval(() => {
                pos = (pos + 2) % 200; // Cycle through 100 steps for the animation
                const t = pos / 200; // Normalized time from 0 to 1
                const edgeUpdates = new Map();

                for (const path of pathsToAnimate) {
                    const L = path.length;
                    if (L === 0) continue;
                    const global_pos = t * L * 100; // Total distance traveled along the whole path

                    for (let k = 0; k < L; k++) {
                        const edge = path[k];
                        const edgeId = edge.id();
                        const localCenter = global_pos - k * 100;
                        const isVisible =
                            localCenter > -20 && localCenter < 120;
                        const dist = Math.abs(localCenter - 50);

                        const stops = [
                            0,
                            localCenter - 15,
                            localCenter,
                            localCenter + 15,
                            100,
                        ].map((p) => Math.max(0, Math.min(100, p)));
                        const stopsStr = stops.join(" ");

                        const update = {
                            dist,
                            stops: stopsStr,
                            isVisible,
                        };

                        if (!edgeUpdates.has(edgeId)) {
                            edgeUpdates.set(edgeId, update);
                        } else {
                            const curr = edgeUpdates.get(edgeId);
                            // Prioritize visible pulses, then those closest to the center
                            if (isVisible && !curr.isVisible) {
                                edgeUpdates.set(edgeId, update);
                            } else if (
                                isVisible &&
                                curr.isVisible &&
                                dist < curr.dist
                            ) {
                                edgeUpdates.set(edgeId, update);
                            }
                        }
                    }
                }

                edgeUpdates.forEach((update, edgeId) => {
                    cy.getElementById(edgeId).style(
                        "line-gradient-stop-positions",
                        update.stops,
                    );
                });
            }, 60);
        } else {
            rows[i].classList.remove("selectedRelationRow");
        }
    }
}

function editSelectedRelation() {
    if (!Relations || Relations.length === 0) {
        pa("There are no relations to edit.");
        return;
    }
    if (selectedRelationIndex < 0 || selectedRelationIndex >= Relations.length) {
        pa("Select one relation first.");
        return;
    }

    const oldRelation = termsToRelationInput(
        Relations[selectedRelationIndex].terms,
    );
    const relationInput = prompt(
        "Enter the replacement relation:",
        oldRelation,
    );
    if (relationInput === null) return;

    let newRelation;
    try {
        newRelation = parseSingleRelationInput(relationInput, cy);
    } catch (err) {
        pa(`Invalid relation: ${err.message}`);
        return;
    }
    if (!newRelation) return;

    Relations[selectedRelationIndex] = newRelation;
    const relationToSelect = selectedRelationIndex;
    refreshRelationsOutput(Relations);
    selectNthRelation(relationToSelect);
}

function doubleQuiver() {
    if (!cy) {
        pa("Draw or load a quiver before doubling it.");
        return;
    }

    const existingArrowIds = new Set(cy.edges().map((edge) => edge.id()));
    const arrowsToDouble = cy.edges().filter((edge) => {
        return !edge.data("isDoubleReverse");
    });
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
                label: reverseId,
                isDoubleReverse: true,
            },
        });
        existingArrowIds.add(reverseId);
    }

    if (reverseArrows.length > 0) {
        cy.add(reverseArrows);
        cy.layout({
            name: "preset",
            fit: false,
        }).run();
    }

    const message = [
        reverseArrows.length > 0
            ? `Added ${reverseArrows.length} reverse arrow(s).`
            : "No reverse arrows were added.",
        skipped.length > 0
            ? `Skipped existing arrow name(s): ${skipped.join(", ")}.`
            : "",
    ]
        .filter((part) => part !== "")
        .join(" ");
    document.getElementById("outTxtBox").innerHTML = message;
}

function ensureAddRelationEditor() {
    let editor = document.getElementById("addRelationEditor");
    if (editor) return editor;

    editor = document.createElement("div");
    editor.id = "addRelationEditor";
    editor.classList.add("relation-editor");
    editor.contentEditable = "true";
    editor.tabIndex = 0;
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.addEventListener("keydown", handleAddRelationEditorKeydown);
    document.getElementById("relOutput").appendChild(editor);
    return editor;
}

function enterAddRelationMode() {
    if (!cy) {
        pa("Draw or load a quiver before adding relations.");
        return;
    }
    addRelationMode = true;
    selectNthRelation(-1);

    const outputDiv = document.getElementById("relOutput");
    outputDiv.classList.add("add-relation-mode");
    outputDiv.contentEditable = "false";
    outputDiv.querySelectorAll(".relationRow").forEach((row) => {
        row.contentEditable = "false";
    });

    const editor = ensureAddRelationEditor();
    editor.textContent = "";
    document.getElementById("btnAddReln").value = "Save added relations";
    editor.focus();
}

function exitAddRelationMode(commitChanges = true) {
    const outputDiv = document.getElementById("relOutput");
    const editor = document.getElementById("addRelationEditor");
    const addedText = editor ? editor.innerText.trim() : "";

    if (commitChanges && addedText !== "") {
        let newRelations;
        try {
            newRelations = parseRelationEntriesInput(addedText, cy);
        } catch (err) {
            pa(`Invalid relation: ${err.message}`);
            if (editor) editor.focus();
            return false;
        }
        if (newRelations.length === 0) {
            pa("No relation was entered.");
            if (editor) editor.focus();
            return false;
        }

        Relations = (Relations || []).concat(newRelations);
        refreshRelationsOutput(Relations);
        return true;
    }

    addRelationMode = false;
    outputDiv.classList.remove("add-relation-mode");
    outputDiv.contentEditable = "false";
    if (editor) editor.remove();
    document.getElementById("btnAddReln").value = "Add relation(s)";
    return true;
}

function toggleAddRelationMode() {
    if (addRelationMode) {
        exitAddRelationMode(true);
    } else {
        enterAddRelationMode();
    }
}

function handleAddRelationEditorKeydown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    exitAddRelationMode(true);
}

function relationEditTarget(eventTarget) {
    const editor = document.getElementById("addRelationEditor");
    if (!editor || !eventTarget) return null;
    return editor.contains(eventTarget) ? editor : null;
}

function guardRelationOutputEdit(event) {
    if (!addRelationMode) {
        event.preventDefault();
        return;
    }
    if (!relationEditTarget(event.target)) {
        event.preventDefault();
    }
}

function focusAddRelationEditor(event) {
    if (!addRelationMode) return;
    if (event.target.closest && event.target.closest(".relationRow")) return;

    const editor = document.getElementById("addRelationEditor");
    if (!editor || editor.contains(event.target)) return;
    event.preventDefault();
    editor.focus();
}

// var testdata = {
//     nodes: [
//         { data: { id: "a1" } },
//         { data: { id: "a2" } },
//         { data: { id: "b1" } },
//         { data: { id: "b2" } },
//         { data: { id: "c1" } },
//         { data: { id: "c2" } },
//     ],
//     edges: [
//         {
//             data: {
//                 id: "a1a2",
//                 source: "a1",
//                 target: "a2",
//                 label: "a",
//             },
//         },
//         {
//             data: {
//                 id: "b1b2",
//                 source: "b1",
//                 target: "b2",
//                 label: "b",
//             },
//         },
//         {
//             data: {
//                 id: "b1b22",
//                 source: "b1",
//                 target: "b2",
//                 label: "b'",
//             },
//         },
//         {
//             data: {
//                 id: "c1c2",
//                 source: "c1",
//                 target: "c2",
//                 label: "c",
//             },
//         },
//         {
//             data: {
//                 id: "AB",
//                 source: "a2",
//                 target: "b1",
//                 label: "ab",
//             },
//         },
//         {
//             data: {
//                 id: "AC",
//                 source: "a2",
//                 target: "c1",
//                 label: "ac",
//             },
//         },
//         {
//             data: {
//                 id: "cc",
//                 source: "c2",
//                 target: "c2",
//                 label: "cc",
//             },
//            classes: "loop"
//         },
//         {
//             data: {
//                 id: "d",
//                 source: "b2",
//                 target: "a1",
//                 label: "d",
//             },
//         },
//     ],
// };]
const coloredEdgeStyle = (color) => {
    return {
        width: 2,
        "line-color": color,
        "target-arrow-color": color,
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        "loop-direction": "0deg",
        "loop-sweep": "45deg",
    };
};

function activeTheme() {
    return document.body.dataset.theme === "dark" ? "dark" : "light";
}

function cytoThemeColors(theme = activeTheme()) {
    if (theme === "dark") {
        return {
            nodeFill: "#111827",
            nodeBorder: "#cbd5e1",
            nodeText: "#e5edf7",
            selectedNode: "#f87171",
            edge: "#d1d5db",
            selectedEdge: "#93c5fd",
            edgeLabel: "#fca5a5",
            edgeLabelOutline: "#1f2937",
        };
    }
    return {
        nodeFill: "#ffffff",
        nodeBorder: "#000000",
        nodeText: "#000000",
        selectedNode: "#fa5252",
        edge: "#000000",
        selectedEdge: "#7379f4",
        edgeLabel: "#ff1818",
        edgeLabelOutline: "#eeee00",
    };
}

function relationHighlightColor(i) {
    if (activeTheme() === "dark") {
        return i % 2 == 0 ? "#fbbf24" : "#86efac";
    }
    return i % 2 == 0 ? "#ff6f00" : "#0080ff";
}

function cytoStyle(theme = activeTheme()) {
    const colors = cytoThemeColors(theme);
    return [
        {
            selector: "node",
            css: {
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
                "text-halign": "center",
            },
        },
        {
            selector: "node:selected",
            style: {
                "background-color": colors.selectedNode,
                width: 30,
                height: 30,
            },
        },
        {
            selector: "edge",
            style: coloredEdgeStyle(colors.edge),
        },
        {
            selector: "edge:selected",
            style: coloredEdgeStyle(colors.selectedEdge),
        },
        {
            selector: "edge[label]",
            style: {
                label: "data(label)",
                color: colors.edgeLabel,
                "font-size": "22pt",
                "font-weight": "bold",
                "text-outline-color": colors.edgeLabelOutline,
                "text-outline-width": 2,
            },
        },
    ];
}

function applyCytoTheme(cyInstance = cy) {
    if (!cyInstance) return;
    cyInstance.style(cytoStyle());
    selectNthRelation(selectedRelationIndex);
}

function promptNameAndCheck(msg, cyInstance, type) {
    const autoName = document.getElementById("autoName").checked;
    let name;
    if (autoName) {
        let [t, counter] =
            type === "vertex"
                ? ["v", autoNameVertexCounter]
                : ["a", autoNameArrowCounter];
        do {
            name = `${t}${counter++}`;
        } while (cyInstance && cyInstance.getElementById(name).length !== 0);
        return name;
    }

    name = prompt(msg);
    if (name) {
        if (cyInstance && cyInstance.getElementById(name).length !== 0) {
            pa("Vertex/Arrow with this name already exists.");
            return null;
        }
        return name;
    }
    return null;
}

//#region *** Cyto ***
function initCyto(inputData, isPreset = false) {
    let layout = isPreset
        ? { name: "preset", fit: false }
        : {
              // name: "dagre",
              // rankDir: "LR",
              name: "breadthfirst",
              fit: true,
              padding: 20,
              nodeDimensionsIncludeLabels: true,
          };
    // TODO: add relation handling; c.f. https://github.com/dmx-systems/cytoscape-edge-connections
    let cyInstance = cytoscape({
        container: document.getElementById("cy"),
        elements: inputData,
        style: cytoStyle(),

        layout: layout,

        selectionType: "single",
        userZoomingEnabled: true,
        userPanningEnabled: true,
        wheelSensitivity: 0.5,
        pan: { x: 40, y: 40 },
    });

    cyInstance.on("tap", (ev) => clickOnCanvas(ev, cyInstance));

    return cyInstance;
}

//#region Edit Quiver
function clickOnCanvas(ev, cyInstance) {
    var evtTarget = ev.target;
    if (mode === "add") {
        if (evtTarget === cyInstance) {
            // Clicked on background: Add Node
            let name = promptNameAndCheck(
                "Enter name for new vertex:",
                cyInstance,
                "vertex",
            );
            if (name) {
                cyInstance.add({
                    group: "nodes",
                    data: { id: name },
                    position: ev.position,
                });
            }
        } else if (evtTarget.isNode()) {
            if (addingArrow) {
                let name = promptNameAndCheck(
                    "Enter name for new arrow:",
                    cyInstance,
                    "arrow",
                );
                if (name) {
                    cyInstance.add({
                        group: "edges",
                        data: {
                            id: name,
                            source: sourceNodeID,
                            target: evtTarget.id(),
                            label: name,
                        },
                    });
                    addingArrow = false;
                    sourceNodeID = null;
                    // prompt cancel the event loop that unselect the vertex, so setTimeout to make sure it runs
                    setTimeout(() => evtTarget.unselect(), 50);
                }
            } else {
                addingArrow = true;
                sourceNodeID = evtTarget.id();
                // pa("Select arrow target");
            }
        }
    } else if (mode === "delete") {
        if (evtTarget !== cyInstance) {
            let removedArrows = [];
            if (evtTarget.isNode()) {
                removedArrows = evtTarget.connectedEdges().map((e) => e.id());
            } else if (evtTarget.isEdge()) {
                removedArrows = [evtTarget.id()];
            }
            cyInstance.remove(evtTarget);

            if (removedArrows.length > 0) {
                Relations = Relations.filter(
                    (rel) =>
                        !rel.terms.some((term) =>
                            term.monomial.some((m) =>
                                removedArrows.includes(m),
                            ),
                        ),
                );
                refreshRelationsOutput(Relations);
            }
        }
    } else if (mode === "rename") {
        if (evtTarget !== cyInstance) {
            let oldId = evtTarget.id();
            let typeName = evtTarget.isNode() ? "vertex" : "arrow";
            let newName = promptNameAndCheck(
                `Enter new name for ${typeName} (current: ${oldId}):`,
                cyInstance,
                typeName,
            );
            evtTarget.unselect();
            if (newName) {
                if (evtTarget.isNode()) {
                    let edges = evtTarget.connectedEdges();
                    let edgesJson = edges.jsons();
                    let nodeJson = evtTarget.json();

                    // remove -> change -> add, instead of jsut change
                    // because we cannot alter data id
                    cyInstance.remove(evtTarget);
                    nodeJson.data.id = newName;
                    cyInstance.add(nodeJson);

                    edgesJson.forEach((edge) => {
                        if (edge.data.source === oldId)
                            edge.data.source = newName;
                        if (edge.data.target === oldId)
                            edge.data.target = newName;
                        cyInstance.add(edge);
                    });
                } else {
                    let edgeJson = evtTarget.json();
                    cyInstance.remove(evtTarget);
                    edgeJson.data.id = newName;
                    edgeJson.data.label = newName;
                    cyInstance.add(edgeJson);
                    renameArrowInRelations(
                        oldId,
                        newName,
                        Relations,
                        cyInstance,
                    );
                }
            }
        }
    }
}

function bendArrow(dir) {
    let edges = cy.$("edge:selected");
    for (let e of edges) {
        let strCurrDist = e.style("control-point-distance");
        let dist = 0;
        switch (dir) {
            case "L":
                dist = -40;
                break;
            case "R":
                dist = 40;
                break;
            case "S":
                dist = 0;
                break;
        }
        console.log(strCurrDist);
        if (!strCurrDist) {
            e.style("control-point-weights", 0.5); // at midpoint
            e.style("control-point-distance", dist); // >0 = bend right, <0 = bend left
        } else {
            let currDist = parseInt(
                strCurrDist.substring(0, strCurrDist.indexOf("px")),
            );
            if ((currDist >= 0 && dist > 0) || (currDist <= 0 && dist < 0)) {
                e.style("control-point-distance", currDist + dist);
            } else {
                e.style("control-point-distance", 0);
            }
            e.style("control-point-weights", 0.5);
        }
        if (e.codirectedEdges().length == 1) {
            // need this to make it curve
            e.style("curve-style", "unbundled-bezier");
        }
    }
}

function clearAll() {
    if (addRelationMode) exitAddRelationMode(false);
    document.getElementById("inQuiver").value = "";
    document.getElementById("inRelation").value = "";
    document.getElementById("toQPABtn").disabled = true;
    document.getElementById("fixCyto").disabled = true;
    document.getElementById("wriggle").disabled = true;
    document.getElementById("saveSVG").disabled = true;
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;
    const themeToggle = document.getElementById("themeToggle");
    if (!themeToggle) return;

    const isDark = theme === "dark";
    themeToggle.textContent = isDark ? "Light theme" : "Dark theme";
    themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    applyCytoTheme();
}

function initialTheme() {
    const savedTheme = localStorage.getItem("gapToCytoTheme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

    return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

function toggleTheme() {
    const currentTheme = document.body.dataset.theme || initialTheme();
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem("gapToCytoTheme", nextTheme);
    applyTheme(nextTheme);
}

function savefile(type) {
    var content, blob, fn;
    switch (type) {
        case "svg":
            content = cy.svg({ scale: 1, full: true, bg: "#ffffff" });
            blob = new Blob([content], {
                type: "image/svg+xml;charset=utf-8",
            });
            break;
        case "json":
            content = { cy: cy.json(), reln: Relations };
            console.log(JSON.stringify(content));
            blob = new Blob([JSON.stringify(content)], {
                type: "application/json;charset=utf-8",
            });
            break;
        default:
            console.log("Invalid filetype");
    }
    saveAs(blob, document.getElementById("filenameInput").value + "." + type);
}

//region# Event handlers
document
    .getElementById("bendLeft")
    .addEventListener("click", () => bendArrow("L"));
document
    .getElementById("bendRight")
    .addEventListener("click", () => bendArrow("R"));

document.getElementById("fixCyto").addEventListener("click", () => cy.fit());
document
    .getElementById("saveSVG")
    .addEventListener("click", () => savefile("svg"));
document
    .getElementById("saveJSON")
    .addEventListener("click", () => savefile("json"));
document.getElementById("loadJsonBtn").addEventListener("change", (event) => {
    let reader = new FileReader();
    reader.addEventListener(
        "load",
        () => {
            let res = JSON.parse(reader.result);
            presentData(res.cy.elements, res.reln, true);
            // this will then display a text file
        },
        false,
    );
    reader.readAsText(event.target.files[0]);
});

// document
//     .getElementById("testBtn")
// .addEventListener("click", () => initCyto(testdata));
applyTheme(initialTheme());
document
    .getElementById("themeToggle")
    .addEventListener("click", () => toggleTheme());

document
    .getElementById("translateBtn")
    .addEventListener("click", () => translateQPA());

document.querySelectorAll('input[name="editMode"]').forEach((elem) => {
    elem.addEventListener("change", (event) => {
        mode = event.target.value;
        if (cy) cy.elements().unselect();
    });
});

document
    .getElementById("btnDoubleQuiver")
    .addEventListener("click", () => doubleQuiver());

document
    .getElementById("btnUnselectRelns")
    .addEventListener("click", () => selectNthRelation(-1));
document
    .getElementById("btnAddReln")
    .addEventListener("click", () => toggleAddRelationMode());
document
    .getElementById("btnEditReln")
    .addEventListener("click", () => editSelectedRelation());
document
    .getElementById("relOutput")
    .addEventListener("beforeinput", (event) => guardRelationOutputEdit(event));
document
    .getElementById("relOutput")
    .addEventListener("mousedown", (event) => focusAddRelationEditor(event));

document.getElementById("wriggle").addEventListener("click", () => {
    cy.layout({
        name: "cose",
        animate: true,
        animationDuration: 1500,
        randomize: false,
        nodeDimensionsIncludeLabels: true,
    }).run();
});

document.getElementById("toQPABtn").addEventListener("click", () => {
    const qpaCode = translateGraphToQPA(cy.json().elements);
    console.log(qpaCode);
    document.getElementById("outTxtBox").innerHTML = qpaCode;
});

document.getElementById("cy").addEventListener("click", (e) => {
    if (!cy && mode === "add") {
        let name = promptNameAndCheck(
            "Enter name for new vertex:",
            null,
            "vertex",
        );
        if (name) {
            cy = initCyto(
                {
                    nodes: [
                        {
                            data: { id: name },
                            position: { x: e.offsetX - 40, y: e.offsetY - 40 },
                        },
                    ],
                    edges: [],
                },
                true,
            );
        }
        ["toQPABtn", "fixCyto", "wriggle", "saveSVG"].forEach((id) => {
            document.getElementById(id).disabled = false;
        });
    }
});

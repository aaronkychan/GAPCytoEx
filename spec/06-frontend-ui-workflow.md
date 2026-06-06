## Frontend Scope

The frontend should be a polished Cytoscape-based QPA `<->` Cytoscape translator. It is an extension of the original `GAPToCyto` program, not a replacement with a narrower feature set. Monomial-algebra computations are optional tools inside the translator, not the app's whole identity.

It must keep all original `GAPToCyto` capabilities unless a specific behavior change is explicitly approved and documented:

- Cytoscape rendering and graph editing;
- add/delete/rename vertices and arrows;
- save/load JSON;
- SVG export;
- relation highlighting and path-flow animation.
- QPA/GAP-to-Cytoscape translation;
- Cytoscape-to-QPA/GAP translation.

It should replace or simplify:

- QPA text parsing as the main workflow;
- old inline styles and unstructured debug areas, while preserving the current compact grouped control boxes;
- manually edited relation text as the primary relation creation flow;
- unstructured status text and debug output.

## Frontend Layout

Use the current updated frontend layout as the baseline. The goal is to evolve it, not replace it with a different app shell.

Current Stage 1 decisions:

- The separate persistent `InfoPanel`/info box is not part of the current accepted UI. Status and validation messages should remain compact and scoped to the single output/workbench area unless a later stage explicitly reintroduces an info region.
- Relation rows in the legacy UI continue to use the existing `terms` shape. The `R2L` convention is display-only for now: reverse the displayed arrow word order, but do not change relation storage, graph arrows, QPA import, or QPA export.
- The graphical relation-builder workflow is deferred to a stretch goal and is not required for Stage 1 completion.

- top bar with app title, light/dark theme switch, save/load/export actions, and status;
- an `Advanced text input` accordion for QPA/text import/export and debugging;
- an output/workbench panel containing graph editing controls, relation tools, the single `OutputPanel`, and the Cytoscape canvas;
- a controls region containing compact grouped controls for graph editing and frequent translator actions;
- a persistent info box for current graph status, validation warnings, selected relation, selected ambiguity, and selected output-row details;
- one `OutputPanel` for translator output, optional computation controls, warnings/errors, and computation results;
- a relation list panel that remains visible beside the Cytoscape canvas and owns relation display, relation selection, and relation editing controls;
- central Cytoscape canvas as the main workspace;

The existing text boxes should not dominate the opening view. They remain available for import/export or debugging.

The previous two-output mockup is rejected. Do not implement a separate `Output details` region below or beside a smaller output region. All translator output, compute controls, ambiguity rows, Bardzell/cohomology/cup-product rows, copy/export actions, warnings, and errors belong in the single `OutputPanel`.

Recommended desktop geometry:

- top: app header and theme/actions;
- below header: collapsible advanced text input;
- workbench: controls on the left or top-left, with a single right-side `OutputPanel` and a compact `InfoPanel` status box;
- canvas row: `RelationListPanel` beside the Cytoscape viewer, with relation creation/edit/removal controls inside `RelationListPanel`.
- if horizontal space is tight on desktop, prefer reducing/folding infrequent control groups before introducing any second output area.

Recommended narrow/mobile behavior:

- stack controls, info box, output panel, relation list, and canvas vertically;
- keep the output panel collapsible so ambiguity/cohomology tables do not push the canvas too far down;
- preserve selected relation/ambiguity state when panels collapse.

Panel responsibilities:

- `InfoPanel`: current quiver summary, selected relation, selected ambiguity metadata, validation messages, and selected output-row details.
- `OutputPanel`: QPA/Cytoscape translation output, optional monomial-computation controls, finite rendered slices of lazy backend data, warnings/errors, and copy/clear/export actions.
- `RelationListPanel`: saved relation paths plus relation-selection and relation-editing controls. It owns `New relation`, `Undo`, `Cancel`, `Save`, `Edit`, `Remove`, and `Unselect` actions while relation-building mode is active.
- `ControlPanel`: buttons and inputs that trigger graph edits, translator actions, and infrequent folded utility controls.
- `CanvasPanel`: Cytoscape graph rendering and path/ambiguity animation.

Recommended UI improvements that preserve the current structure:

- Split the controls into stable groups with short headers: `Edit quiver`, `Translator`, and folded utility accordions such as `Canvas zoom / fit`, `File save / export`, `Bend arrows`, and `Display options`.
- Keep relation creation/edit/removal controls inside `RelationListPanel`, not in the general controls strip. The general controls must not contain a separate `Relations` control card that duplicates relation-panel commands.
- Put optional computation controls inside `OutputPanel`, because they produce output and should not compete with graph-editing controls.
- Include a compact path-orientation control, preferably a two-option segmented control: `L2R` and `R2L`. It may live near relation display/output controls, but it must not be confused with graph direction or arrow reversal.
- The user may switch between `L2R` and `R2L` at any time, before or after relations and computation output exist. Switching convention re-renders relation rows, ambiguity rows, selected-item details, and path text in place; it must not clear the graph, relation list, output panel, or current selection.
- Use tabs or segmented buttons inside the single `OutputPanel` for `QPA`, `Cytoscape JSON`, `Ambiguities`, `Bardzell`, `Cohomology`, and `Cup product` once multiple result types exist.
- Keep relation rows clickable and selectable; selected relation should update the info box and highlight the corresponding path on the canvas.
- Keep computation rows clickable and selectable; selected ambiguity/cohomology item should update the info box and, when path data exists, highlight the canvas.
- Replace long status strings near buttons with compact badges: `Unconfirmed`, `Confirmed`, `Stale`, `Computing`, `Error`.
- Use disabled button states plus short inline helper text instead of alerts for invalid operations.
- Add a `Clear output` action scoped only to `OutputPanel`.
- Add a small `Copy` action for output sections that copies display text, not raw internal objects.
- Preserve the advanced QPA/text accordion, but keep it collapsed by default once the graphical workflow is ready.
- Keep the canvas visually dominant; `OutputPanel` should scroll internally rather than expanding until the canvas becomes unusable.

## Frontend Workflow

### 1. Draw Quiver

The user can:

- add vertices by clicking the canvas in add mode;
- add arrows by selecting source and target vertices;
- rename vertices and arrows;
- delete vertices and arrows;
- bend arrows for readability;
- auto-name vertices and arrows.

Validation:

- duplicate vertex and arrow IDs are disallowed;
- deleting an arrow removes any relation path using that arrow;
- renaming an arrow updates relation paths using that arrow.

### 2. Build Monomial Relations by Path Selection

Replace free-form relation editing as the primary workflow.

Relation builder behavior:

- User clicks `New relation`.
- Frontend enters relation-selection mode.
- User selects a starting arrow.
- The next selectable arrows are restricted to arrows whose source equals the current path target.
- Non-composable arrows are visually disabled or muted.
- Each selected arrow is appended to the current path word.
- User may undo the most recently selected arrow, cancel, or save relation.
- Save is disabled until the selected path has length at least 2.
- Saved relation appears in the relation list and in the persistent info panel.
- Relation-builder controls are rendered inside `RelationListPanel`. When a new relation is being built, the panel should show the current path word, available next-step status, and `Undo`, `Cancel`, and `Save` controls without consuming space in the general `ControlPanel`.

This records monomial relation paths directly as arrow ID arrays for backend input.

Path-orientation display behavior:

- Relation builder records paths in `L2R` Cytoscape traversal order.
- After saving a relation, the frontend stores both `pathL2R` and `pathR2L`.
- If the user selects `L2R`, relation rows display `pathL2R`.
- If the user selects `R2L`, relation rows display `pathR2L`.
- Switching the display convention is allowed at any time and must not mutate the quiver, reverse arrows, clear results, or change GAP/QPA export behavior.
- GAP/QPA import/export remains `L2R` only, regardless of the active display convention.

### 3. Optional Monomial Computations

Optional monomial-only computation controls live in `OutputPanel`, not in a separate `Algebra` section.

Available controls:

- maximum ambiguity index `N`;
- `maxPathLength` for admissible path enumeration, shown as a numeric input or stepper, default `50`, minimum `20`;
- compute ambiguities;
- Bardzell, Hochschild cohomology, and cup-product controls may appear as disabled or staged placeholders before their implementation stage, but they must not run placeholder computations.

Before running any monomial-only computation:

- convert the current Cytoscape graph data and structured relation path data into the backend input;
- validate that every listed relation is a single composable path of length at least 2;
- allow an empty relation list;
- if any relation is a linear combination, has multiple terms, contains a malformed path, or otherwise is not monomial, show a warning in `InfoPanel` and do not run the computation;
- specifically, pressing `Compute ambiguities` must first run this validation guard. If validation reports a non-monomial relation, malformed path, or stale unparsable relation state, the handler must return immediately before calling `computeAmbiguities` or any backend ambiguity helper;
- after validation passes, pressing `Compute ambiguities` must normalize both `L2R` and `R2L` relation copies before computing;
- validate `maxPathLength >= 20`; if not, show a warning in `InfoPanel` and do not run the computation;
- leave the previous `OutputPanel` results unchanged unless the user explicitly clears or reruns a valid computation;
- do not silently skip non-monomial relations and compute from the remaining subset.

Computation output behavior:

- computation buttons write their finite rendered results to `OutputPanel`;
- the panel is append-or-replace by computation type: rerunning ambiguities replaces the previous ambiguity block, while later Bardzell/cohomology/cup-product blocks may coexist as separate sections;
- there is no separate detail output panel. Detailed rows are expanded in place inside the single `OutputPanel`, and row selection sends concise details to `InfoPanel`;
- each output section has a header, degree range, timestamp or stale marker, compact summary, and expandable detailed rows;
- each row keeps a stable `id` so selecting it can update `InfoPanel` and trigger canvas highlighting/animation;
- errors and warnings appear as output items in the same panel instead of alert boxes or console-only messages;
- ambiguity orientation cross-check warnings appear visibly in both `OutputPanel` and `InfoPanel`;
- the panel must be clearable without clearing the relation list or canvas.

When ambiguities are available:

- show a list grouped by `n`;
- each item uses the user's selected display convention:
  - `R2L`: show the primary left-ambiguity decomposition `u_{-1} | u_0 | ... | u_n`;
  - `L2R`: show the equivalent right-ambiguity decomposition `u_n | u_{n-1} | ... | u_0 | u_{-1}`;
- the full concatenated path may be shown as secondary detail, but the decomposition is the primary display;
- each ambiguity row is clickable/selectable, like relation rows in `RelationListPanel`;
- selecting an ambiguity updates `InfoPanel` and starts its path-piece animation on the quiver.

Animation:

- use Cytoscape edge linear gradients to simulate a pulse flowing through paths;
- for a relation row, flow once through the selected relation path;
- for an ambiguity row, animate its pieces sequentially in the displayed decomposition order: highlight the current piece, flow through that piece, wait briefly, then highlight the next piece with a different color, and continue until every piece has flowed;
- each ambiguity piece should have a distinguishable color or tone, cycling through a readable palette if needed;
- after the rightmost displayed ambiguity piece finishes, stop on the completed highlighted state; do not loop back automatically;
- gradient movement should proceed along each selected arrow sequence in traversal order;
- repeated arrows and loops must still show a coherent pulse;
- provide play/pause and speed controls when animation is active;
- respect `prefers-reduced-motion` by offering a static highlight fallback.

Persistent info panel:

- shows concise current-state data: confirmed/stale status, quiver size, relation count, selected relation, selected computation item, and selected ambiguity metadata;
- for a selected ambiguity, shows precise data: `n`, active convention, ambiguity kind, decomposition, full underlying path, relation overlaps, source, target;
- highlights the corresponding word segment as the flow reaches each arrow or subpath;
- selected arrows in the quiver and highlighted words in the info panel must stay synchronized;
- does not contain long ambiguity lists, differential matrices, homology tables, or cup-product tables; those belong in `OutputPanel`.

## Visual Design Requirements

- Modernize the current hand-coded UI without turning it into a marketing page.
- Use an operational tool aesthetic: clear, dense enough for repeated work, but polished.
- The logical layout from the single-output mockup is accepted, but its visual styling is not. Do not implement the mockup as a stack of large rounded rectangles.
- Support light and dark themes with a visible toggle.
- Use CSS variables for palette, spacing, radii, borders, focus rings, and animation timing.
- Use icons for common controls where helpful: save, load, export, play, pause, undo, delete, fit, theme.
- Ensure keyboard/focus accessibility for all controls.
- Use semantic buttons and form labels.
- Avoid nested cards and avoid giving every group its own rounded rectangle. Use panels, sidebars, toolbars, section headers, dividers, and background bands for app chrome.
- Keep Cytoscape canvas large and visually dominant.
- Keep the relation builder, info box, and computation output box readable on laptop and mobile widths.

Visual composition:

- Use a compact workbench aesthetic closer to a professional editor or database console than a dashboard of cards.
- Prefer two or three strong structural surfaces: app background, workbench surface, and canvas/output surfaces. Avoid wrapping every control cluster in a separate bordered box.
- Use thin dividers, subtle shaded headers, and whitespace to separate `Edit quiver`, `Translator`, and utility controls instead of card borders around each group.
- Keep the top header visually calm: one continuous bar or flat title row, not a bulky hero banner.
- Use a crisp grid with aligned left edges, consistent gutters, and stable panel widths. Controls, relation rows, output rows, and info rows should line up on the same spacing scale.
- Keep vertical spacing tight: use roughly `4px`, `8px`, `12px`, `16px`, and `24px` spacing tokens. Avoid large empty gaps inside panels.
- Use `OutputPanel`, `InfoPanel`, and `RelationListPanel` as functional regions, not decorative cards. Their headings may be separated by a bottom border or tinted header strip rather than a fully boxed card treatment.
- The canvas should have the strongest spatial claim. Adjacent panels should feel like tools docked to the canvas, not floating cards around it.

Corners, borders, and elevation:

- Default radius should be small: `4px` for buttons, inputs, tabs, rows, and small controls; at most `6px` for major panels. Do not use large pill-like or soft rounded-rectangle styling except for compact status badges.
- Use borders sparingly. Prefer a single outer workbench border plus internal dividers over borders around every subgroup.
- Avoid heavy drop shadows. If elevation is needed, use one subtle shadow on the main workbench only; inner panels should rely on borders or background contrast.
- Buttons should read as tools, not cards: compact height, clear icon or text label, small radius, and restrained hover/focus states.
- Segmented controls and tabs should be rectangular with small radius and shared borders; avoid separated rounded buttons that look like loose cards.

Typography and density:

- Use one UI font and one monospace font for paths, QPA text, and algebra output.
- Section titles should be compact and high-contrast, not oversized. Reserve larger type for the app title only.
- Helper text should be short and muted. Do not place explanatory sentences inside every control group.
- Relation rows and ambiguity rows should have stable row height, monospace path text, and a clear selected state using a left accent bar or tinted row background.

State styling:

- Status badges such as `Unconfirmed`, `Confirmed`, `Stale`, `Computing`, and `Error` may use pill shapes because they are compact labels, but they should not set the shape language for the whole app.
- Warnings in `InfoPanel` should use an amber accent strip or icon plus text, not a large warning card.
- Selection and animation colors should be vivid enough to track paths on the canvas, while the rest of the UI remains quiet.

Suggested theme direction:

- Light: off-white background, ink text, subtle grid/canvas surface, teal or blue primary action, amber warning/stale state.
- Dark: charcoal background, high-contrast text, muted canvas grid, cyan/green path highlights, amber warning/stale state.


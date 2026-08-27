# State Chart

Chart is the visual authoring surface for the same state machine edited in Editor. Semantic changes made on either
surface appear on the other. Chart also stores presentation-only state placement, UML indicators, and unconfigured
draft transition lines.

## Chart Overview

Select **Chart** in the Model tree. The page contains a narrow Palette, the zoomable and pannable Canvas, and a bottom
action panel with **Automatic Layout**, **Fit Chart**, and **Save As Image**.

The Canvas uses a top-left coordinate origin. Viewport zoom and pan do not change project geometry, dirty state, routing
input, or image-export bounds. Releasing a dragged state preserves the current translation and zoom; opening a fresh
projection, running Automatic Layout, and choosing Fit Chart intentionally establish a fitted view.

## Palette

The Palette contains four labelled icon tiles:

| Item | Drop result |
|---|---|
| **State** | One generated semantic state and its Chart placement. |
| **Initial Indicator** | The single UML initial indicator, connected or orphaned. |
| **Terminal Indicator** | One chart-only UML final indicator, connected or orphaned. |
| **Transition** | One chart-only draft with two independent endpoints. |

All four controls are drag-only placement sources. Clicking them or pressing Enter or Space is intentionally inert. The
Initial Indicator remains visible but disabled while the single indicator already exists.

## Creating States

Drag **State** to the Canvas. One atomic command immediately creates an empty-description state using the lowest unused
positive name in the form `state_N` and records its placement.

Double-click the new state, or focus it and press Enter or Space, to open **Edit State**. Renaming it uses the same
reference-safe command as Editor, so transitions, action assignments, initialization, and Chart references remain
synchronized. A state created in Editor can exist without a placement; Chart gives it a deterministic placement when a
visual operation needs one.

Collapsed states show only the state name. Expanded states also show ordered **Entry Actions** and **Exit Actions**,
including duplicates. Use **View → Expand Chart States** or the matching toolbar command to switch the document-wide
Chart presentation.

## Initial Indicator

Drag **Initial Indicator** into open space to create an orphan without changing the semantic initial state. Drop it on a
state to select that state as initial and position the filled UML dot above it. Placement, semantic initialization, and
any required collision displacement commit together.

A connected initial relation is the only visible initial-state notation; the state node does not repeat it with a badge.
Deleting the connected relation or the indicator clears the semantic initial state. Deleting an orphan removes only its
Chart record. Changing initialization in Editor updates an attached indicator but leaves an orphan visually orphaned.

## Terminal Indicators

Drag **Terminal Indicator** into open space to create an orphan, or drop it on a state to place it below that state and
create a visual relation. One state may have at most one terminal-indicator relation, while one indicator may receive
relations from several states.

Despite the name, a terminal indicator is UML chart notation only. It does not classify a semantic state, add a
transition, stop execution, emit actions, affect Solver evidence, or change Simulator behavior. Deleting an indicator
removes its visual relations in the same chart-only command.

Double-click a terminal indicator, or focus it and press Enter, to choose its source state through the textual dialog.
Replacing a relation is explicit when the chosen state is already connected to another terminal indicator.

## Creating and Configuring Transitions

Drag **Transition** to create a persisted unconfigured draft immediately. Its source and target are coordinate-only
endpoints. A draft has no transition-table row and no semantic or runtime effect.

Drag either endpoint independently. Releasing it inside a state snaps its coordinate to that state's current geometric
center, but does not attach the endpoint to the state. The endpoint therefore stays where it was if that state later
moves.

Double-click the draft, or focus it and press Enter or Space, to configure a source state, event, and destination state.
Confirming a valid unique `(state,event)` key atomically adds the semantic transition and removes the complete draft.
Cancel, invalid references, duplicate keys, or a stale revision leave both the draft and semantic model unchanged.

Double-click or right-click a configured transition, or focus it and press Enter or Space, to edit it. The Editor
Transition Table remains the complete textual alternative.

## Moving and Resizing States

Drag one state or a multi-selection to move it. A completed gesture commits its coordinates once; individual pointer
pixels do not create separate history entries. With **Snap to Grid** enabled, movement follows the configured Grid Size.

Collapsed width and height and expanded width are application preferences and cannot be resized on the Canvas. Only an
expanded state's height is resizable through its top and bottom handles. The effective height can never be smaller than
the configured expanded minimum or the measured content requirement.

The saved enlarged height survives collapse and re-expansion. One completed resize is one document revision and one Undo
record. Press Escape before pointer release to cancel a resize preview without mutation.

## Editing Transition Endpoints

Selecting a configured semantic transition exposes source and target controls at its visible clipped endpoints. Drag a
control onto the opaque body of another state to change that semantic source or destination while preserving the event.

The update is atomic. A duplicate `(state,event)` key, invalid reference, or stale revision leaves both endpoints and the
transition row unchanged. Use Edit Transition or the Editor Transition Table for the complete keyboard workflow.

## Quick Connections

Select one Chart element, then Shift+left-click an eligible second element:

| Pair | Result |
|---|---|
| State, then State | Open Add Transition with source and destination preselected. |
| State and Initial Indicator, in either order | Make the state initial immediately. |
| State and Terminal Indicator, in either order | Create or replace the visual terminal relation immediately. |

The state-to-state direction follows selection order. All Add Transition fields remain editable, so the source and
destination may be changed to the same state for a self-transition. Confirm creates one transition; Cancel changes
nothing. With one eligible primary selection, Shift+Enter on the focused second element performs the same connection for
keyboard users.

## Selection and Deletion

Click an element for primary selection or drag a selection rectangle around several elements. When Chart is active and
the count is nonzero, the global status bar reports **Chart Elements Selected: N**.

Press Delete while Chart owns focus and focus is not inside an editable control. Chart deletion is immediate and has no
confirmation dialog. A mixed semantic and visual selection is planned and deleted atomically, and one Undo restores the
complete selection. Editor deletion retains its impact-confirmation workflow. Chart has no Delete button.

## Automatic Layout

Choose **Automatic Layout** to arrange states in deterministic top-to-bottom flow. It prefers the initial state as the
root, then the first transition source, then the first declared state. Actual state sizes and transition-label estimates
participate, and final coordinates always align to Grid Size even when interactive snapping is disabled.

Automatic Layout runs only when requested. It commits all changed geometry and cleanup as one command, so one Undo
restores the complete previous layout.

The **Delete Orphaned Chart Items During Automatic Layout** preference controls cleanup. When enabled, layout removes
orphan initial and terminal indicators and whole unconfigured drafts. It never removes configured semantic transitions
or connected indicator relations. When disabled, it shelves orphan indicators outside the main graph and preserves
authored draft endpoint coordinates.

## Transition Routing

Routes and labels are derived presentation state; they are never written as manual anchors or lanes in the project file.
Automata Lab recomputes the complete relation set after relevant geometry, sizing, wrapping, or routing-preference
changes.

Ordinary transitions avoid state, indicator, and accepted-label obstacles. Clear direct relations render as straight
cubic curves; obstacle detours, parallel and reciprocal lanes, and self-transition loops add curvature only where
needed. Event labels use the configured Start, Center, or End alignment and move among deterministic positions to avoid
collisions.

If bounded route or label search cannot prove a normal placement, the relation stays visibly solid and uses a
deterministic exterior fallback. An accessible description and Console diagnostic report the condition. Routing never
mutates the document, and a failed or stale routing request leaves the current preview visible.

## Zooming, Panning, and Fit Chart

Use the Canvas zoom controls or mouse wheel to zoom; editable Chart zoom reaches 10 percent. Pan the Canvas to move the
viewport without moving model elements. **Fit Chart** changes only the viewport so the complete diagram fits the
available Canvas.

Zoom, pan, and Fit Chart do not change project coordinates, revision, dirty state, or Undo history. Automatic Layout is
different because it intentionally commits new document geometry and then fits the result.

## Saving the Chart as an Image

Choose **Save As Image** to capture one non-mutating snapshot of the complete Chart. The command uses the settings already
committed under **Application Settings → Chart → Image Export** and opens one format-specific save picker, or performs one
download when the browser cannot retain a file destination.

The image contains complete Chart bounds, one grid unit of padding, nodes, routed relations, arrowheads, labels, the
current theme, and the grid only when Show Grid is enabled. It excludes the Palette, Canvas controls, attribution, action
panel, selections, focus outlines, endpoint controls, and resize handles.

PNG and JPG use the configured unit and DPI. Before allocating a raster bitmap, Automata Lab rejects output above the
configured **Maximum Megapixels** limit. SVG remains vector, contains inert text and no active or external content, and
does not consume the pending DPI or megapixel values. Cancelling the picker makes no project or Console change.

## Chart Keyboard Operation

Tab to Chart elements and controls, and use Enter or Space on focused states, drafts, and semantic transitions to open
their edit workflows. Shift+Enter provides eligible quick connections. Arrow-key movement uses bounded steps; with Snap
to Grid enabled it moves by one grid unit, or four units with Shift. Use Alt+Up/Down on an expanded state resize edge,
adding Shift for the larger step.

Palette placement itself is intentionally drag-only. Keyboard users can create and edit the complete semantic model in
Editor, configure transitions through dialogs, operate Chart selection and movement, connect indicators, and use every
bottom command without relying on pointer-only semantic behavior.

Previous: [Editor](./editor)

Next: [Solver](./solver)

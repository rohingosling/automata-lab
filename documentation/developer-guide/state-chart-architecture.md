# State Chart Architecture

The State Chart is a visual command surface over the same `AuthoringDraft` used by Editor. It persists authoring choices
that users must recover—positions, selected expanded heights, indicators, visual terminal relations, and unconfigured
transition drafts—while deriving layout, routes, labels, lanes, selection, and viewport state.

This boundary is essential: React Flow and the routing worker never become alternative authorities for the semantic
state machine.

## Chart Projection

`createAuthoringChartProjection` in `automata-web/src/presentation/chart/chart-projection.ts` combines the draft with
application preferences to produce immutable Chart view models. The projection resolves effective node dimensions,
fallback positions, indicator geometry, model relations, and draft endpoints without modifying the document.

Presentation maps those view models to React Flow nodes and edges. User actions are translated back into typed document
commands. A new projection is rebuilt after a successful revision, so stale component objects cannot silently become
the source of truth.

State placements use stored top-left coordinates. Effective collapsed and expanded widths, collapsed height, and the
expanded minimum come from application preferences; only a selected expanded height is document data. Grid snapping
and coordinate conversion are explicit projection functions so stored geometry is independent of React Flow internals.

## Persisted and Derived Data

The persistence boundary is deliberate.

| Persisted in `/chart` | Derived or transient |
|---|---|
| Expand-states choice | Effective node dimensions from preferences and content. |
| State top-left positions and selected expanded heights | Automatic-layout ordering and intermediate ELK graph. |
| Initial-indicator position and nullable state attachment | Connection handles and accessible interaction geometry. |
| Terminal-indicator IDs, positions, and visual relations | Semantic routes, label rectangles, sides, and lane offsets. |
| Draft IDs, coordinates, state/indicator attachments, remembered event and table position | Cubic spans, gravity points, fallback state, and diagnostics. |
| Canonical origin setting | Selection, focus, pan, zoom, and drag feedback. |

Automatic route data never enters JSON, semantic revision hashes, or Undo history. UML terminal relations are persisted
visual notation but have no runtime, Solver, acceptance, or stopping semantics.

## Viewport and Selection Presentation

`Application` owns the editable translation and zoom and passes them through `ChartPage` to each Canvas. Navigation
unmounts Chart without discarding this memory. Document/preference projections also retain it. Successful Open/Pull
resets the previous view and schedules one first-visit fit; New/Close clears both. Standalone Chart instances, including
Print capture, use a separate local fallback. Viewport memory is transient and never enters a file or Undo history.

Selected states retain their 2-pixel theme border and use an outer, zero-blur 4-pixel-spread shadow behind the node.
`--chart-selection-halo` is #999999 in Light and #666666 in Dark. The shadow changes neither bounds nor content layout.
Forced colors uses a 4-pixel outer Highlight outline; SVG export clears computed selection shadows and outlines from
clones without changing the live selection. Selected configured and draft curves are 6 pixels thick. The `--chart-selected-transition` token retains
the normal black line color in Light and the theme selection color in Dark. Shared `chart-endpoint` controls are excluded from button palettes and retain state fill through interaction.
Their diameters are 16 pixels for configured endpoints and 24 for draft endpoints. Explicit minimum-height reset
prevents native button styling from stretching circles into ovals. Expanded-state resize controls suppress React Flow
line borders, use 28-pixel-square targets and 10-pixel-square markers with 2-pixel borders, and mirror their centers 10.5 pixels outside each
vertical edge.
In Light mode, chart state outlines, compartment separators, text, initial/terminal notation, transitions,
arrowheads, and grip outlines are black. State and grip interiors retain their light surfaces; the gray
state-selection halo remains unchanged. Expanded-state resize grip borders are 2 CSS pixels in both
themes, matching unselected state borders. Forced colors continues to use system colors.
These styles affect presentation only and leave routing, saved geometry, and export composition intact.

## Drag-and-Drop Creation

All four Palette controls are drag-only placement sources. Click, Enter, and Space on a Palette tile are inert. Native
drag feedback uses an icon copy prepared before drag start and kept alive through the drag. It contains no tile frame,
label, hover surface, or focus treatment, and refreshes when its theme changes.

Palette tiles retain transparent resting backgrounds and borders, theme text/icon colors, and the
raised theme surface with selection borders on hover, press, or keyboard focus. Both button-color
preferences exclude the entire Palette. Chart action-panel and Canvas zoom buttons still use the
application palette.

The Palette remains a vertical intrinsic-width column beside the Canvas at every breakpoint. Its
longest unwrapped label retains a 4-CSS-pixel leading inset including the tile border. The trailing
tile edge and bottom content edge use `scrollContentEdgeInsetPixels`, initially 4px, with tile and
pane borders separate. The default pane width is therefore the longest label plus 10 CSS pixels
before any scrollbar. The Canvas takes the remaining width, and the Palette can scroll vertically
when height is limited. Glyph size remains 32 by 32 CSS pixels. Its `panel-title-bar` spans the pane
and uses the shared header theme surface and a 30-pixel height matching the State Chart header.

Dropping State calculates the lowest available positive integer name such as `state_1`, then dispatches one command
that creates the semantic declaration and placement. Dropping an Initial or Terminal Indicator creates or moves the
appropriate chart record, including a relation when the drop target determines one.

Dropping Transition creates a chart-only draft with a stable non-negative safe-integer ID and two independently stored
coordinates. No semantic transition is created at this point. This makes an unfinished gesture persistable, undoable,
and visually recoverable without weakening the deterministic transition table.

## Draft and Semantic Transitions

Each draft endpoint stores coordinates and an optional state or indicator reference. The revision-checked
`update_chart_draft_endpoint` command changes one end while preserving the other. Explicit pointer release or keyboard
entry attaches; passive overlap never does. A shared resolver derives effective endpoints from current state rectangles and indicator centers
for previews, commits, deletion snapshots, export, and printing. Whole-draft movement changes only free ends.

For an eventless state-to-state draft, the second successful attachment schedules one configuration request in the stable ChartPage owner. That request
survives the revision-keyed canvas remount and is consumed once; document identity/revision checks reject stale requests.
State and Next State follow source/target roles and Event remains empty. Cancel keeps both attachments. Enter, Space,
or double-click on the draft or either endpoint reopens configuration, including coincident grips.

The existing `configure_chart_draft_transition` command validates declarations and the deterministic key, inserts the
semantic row, and removes the draft atomically. Rename rewrites attachment references; deletion detaches affected ends
at captured current centers. History restores attachments without scheduling dialogs. The file codec reads strict
`1.0.0`, `1.1.0`, `1.2.0`, and `1.3.0` documents and writes the minimum needed for attachments or remembered metadata.

Semantic transitions are projections of `/state_machine/transition_table`. Moving a source or destination endpoint over
a state body dispatches `update_transition`, preserving the event while replacing that endpoint. Duplicate-key, stale
revision, or reference rejection changes neither the transition nor its rendered endpoints.

Releasing into free Canvas space dispatches `detach_transition_endpoint`. One domain plan removes the semantic row and
creates a draft retaining its event, table index, free coordinate, and other state attachment. Completing both draft
attachments with a remembered event makes `update_chart_draft_endpoint` atomically restore the semantic row and remove
the draft; no configuration dialog is scheduled. Conflict or capacity failure rolls the entire drop back. Event rename
updates the memory; event deletion clears it and the ordering hint while retaining the chart scaffold.

Draft selection thickens the curve instead of outlining its React Flow node rectangle. Each attached grip comes from
the actual boundary-clipped curve endpoint, independently of whether the other end is attached. The same derived
geometry supplies the visible stroke, arrowhead, grip positions, export, and printing.

## Draft Indicator Connections

Draft hit testing adds visible indicator circles to the existing state-body targets. Pointer indicator hit tests use
the unsnapped Canvas point so a small off-grid indicator remains reachable; ordinary movement and free-space snapping
keep their existing behavior. Keyboard attachment uses the same command boundary. Preview and commit resolve attached
logical endpoints to the current indicator center, then reuse the shared circular boundary and route descriptors.
Each successful wrong-end indicator drop normalizes roles immediately, including the first attachment. Target-to-initial
and source-to-terminal drops atomically swap both endpoint coordinate pairs and their state/indicator references. The free
endpoint keeps its physical location, while focus follows the moved grip under its new role. Pointer and keyboard paths
share the command rule. No-move, cancelled, stale, or rejected gestures preserve coordinates, references, and roles.

On completion, the domain atomically consumes the draft into initial-to-state, state-to-terminal, or direct
initial-to-terminal behavior. Completing an already configured identical initial/state or state/terminal relation
consumes the draft while retaining the existing relation, with no duplicate edge, Error, or event dialog. Other initial
or terminal relation replacements follow their existing command policy. Duplicate direct pairs remain rejections. An unfinished
indicator draft's edit gesture focuses its free endpoint and announces completion guidance. Remembered-event drafts
cannot attach to indicators. Direct relations project as selectable edges using the ordinary routing worker inputs,
without a second routing algorithm or semantic transition row.

Deleting an initial-to-state relation clears semantic initialization and the retained indicator attachment in the
same command, leaving an orphan at the same coordinates. Deleting an orphan initial indicator preserves any independent
semantic selection. Initial-indicator no-op detection includes both the indicator object and resulting semantic initial
state, so an explicit reconnect repairs a mismatch even when indicator geometry is unchanged. Save actions remain
available for open drafts; the existing persistence validator reports blocking integrity errors before any file write.

Deletion includes direct-relation IDs in the shared Chart selection command. Indicator deletion releases attached
draft ends and removes referencing direct edges. Automatic Layout treats direct-linked indicators as connected when
performing orphan cleanup. File `1.3.0` and Worker decoding retain indicator references and direct relations; printed
projection tables label them explicitly. No format beyond 1.3.0 is needed for immediate role reversal. Passive Open,
history, layout, and rerenders neither normalize roles nor complete drafts. Routes, clipped grips, and viewport remain transient.

## Automatic Layout

Automatic Layout runs behind `ChartLayoutPort`; it is not a React component algorithm. Presentation sends actual state
geometry and deterministic event-label estimates to the ELK Layered adapter. Ordering is stable:

1. choose the semantic initial state as root, otherwise the first transition source, otherwise the first state;
2. rank remaining states by descending total degree and declared order;
3. arrange the ranked inputs center-out;
4. use initial-first top-to-bottom layered flow; and
5. grid-align the returned positions.

The adapter returns state positions only. Postprocessing places connected indicators, displaces collisions, and either
shelves or deletes orphan indicators and whole drafts according to preference. The complete changed geometry commits as
one `replace_chart_geometry` command. Fit Chart is separate viewport behavior and never modifies the document.

## Routing Worker

Routing uses a persistent dedicated Worker through `ChartRoutingPort`. Presentation assembles one immutable ordered set
of initial, semantic, terminal, and draft relations plus current obstacles, accepted label obstacles, label dimensions,
endpoint boundaries, and Route Obstacle Offset. Attached drafts supply the same state identities and boundaries as
semantic relations; free ends supply coordinates with no state boundary. Ordinary search, self-loop construction,
parallel/reciprocal lane assignment, and clipping use shared helpers, so completing a draft does not switch algorithms.

For an ordinary relation, the worker first retains a clear direct segment. It then tries clear one-bend Manhattan paths
before constructing a bounded sparse rectilinear visibility graph and running direction-aware A*. Candidate ordering is
lexicographic: Manhattan length, bend count, crossings, then stable ties.

The worker returns point backbones, explicit cubic chains, label rectangles, and an exterior-fallback flag. Results also
carry request and revision identities. Presentation discards stale results, retains the current preview on failure, and
publishes a bounded Console diagnostic when a route or label uses a diagnostic fallback.

Self-transition ellipses and established parallel or reciprocal lanes are resolved as preserved presentation backbones.
They bypass ordinary obstacle search but still pass through the common curve and label pipeline where applicable.

## Cubic Curve Generation

Every visible relation is rendered with cubic Bézier commands. The curve helpers in
`automata-web/src/application/chart-routing-backbone.ts` provide the shared conversions and geometric proofs.

- A clear two-point backbone becomes a neutral straight cubic.
- A backbone with one gravity point becomes a quadratic-equivalent cubic influence.
- Longer preserved backbones use an open-uniform cubic B-spline converted to cubic spans.
- Searched orthogonal backbones use bounded adaptive fitting and may retain every required turn.
- Elliptical self-transitions are emitted as cubic approximations of the visible outside arc.

Ordinary configured and draft relations first resolve attached endpoints to centers and free endpoints to coordinates.
The actual cubic chain is then clipped at the
first source-boundary exit and final target-boundary entry using de Casteljau subdivision. Label arclength and the target
arrow tangent therefore use the visible curve rather than an approximation based on the original polyline.

## Obstacle Clearance and Fallbacks

The router proves returned searched cubic spans clear of fixed-clearance unrelated obstacles using bounded recursive
subdivision. Route Obstacle Offset controls preferred visibility rails and search expansion, not the required rendered
clearance or label spacing. Per-obstacle clamping prevents an inflated rectangle from swallowing a relation endpoint.

When a fitted curve is unsafe, the router selectively widens the implicated search clearance and retries. A combined
failure may widen the complete lattice. A proven exterior candidate is a clean recovery. Capacity exhaustion, search
exhaustion, or an unproved exterior outcome remains visible as a diagnostic fallback rather than being represented as a
normal clear route.

Routing is a two-pass complete-set operation. The second pass retains a first-pass result only when exact checks prove
that it is free of fallback, foreign-label collisions, and proper crossings. Ineligible relations are repaired in a
stable order against the complete first-pass route and label set.

## Label Placement

Start, Center, and End preferences anchor a label at 20, 50, and 80 percent of the boundary-clipped visible cubic
arclength. Collision alternatives are searched strictly along that same curve. The algorithm does not offset labels
along an arbitrary local normal.

Label rectangles participate in complete-set repair. If bounded placement cannot avoid current obstacles, the router
uses a deterministic exterior-right position and marks the relation as a fallback. Presentation emits the durable
diagnostic and exposes an accessible fallback description.

## Chart Image Export

Chart export receives a sanitized, bounded scene rather than capturing the live DOM. It excludes selection, focus,
viewport controls, grids when disabled, transient previews, and developer diagnostic overlays. SVG and raster branches
share the live node, path, label, indicator, and arrow geometry.

The raster branch calculates pixel dimensions from the chosen unit and DPI, then enforces the Maximum Megapixels
preference before allocating a Canvas. Browser adapters own the final save interaction. Printing reuses the sanitized
raster compositor in Light theme with a transparent background and no grid, without opening a save picker or mutating
the model.

## Algorithm Lock and Change Procedure

Layout and routing behavior is a locked baseline. `automata-web/tests/chart/chart-algorithm-lock.json` records the exact
source membership, normalized source hashes, and relevant configuration values. The lock test runs with the unit suite
and aggregate verification.

An intentional algorithm change must be treated as a contract change:

1. describe the visible behavior and invariant being changed;
2. update the relevant design and public documentation;
3. add or adjust exact, property, browser, and performance evidence;
4. run `npm run chart:lock` from `automata-web/` to regenerate the manifest intentionally; and
5. review and commit the implementation, tests, configuration, documentation, and lock manifest together.

Never regenerate the lock merely to make an unexplained test failure pass. Unrelated work must leave locked sources and
configuration untouched.

Previous: [Command Architecture](./command-architecture)

Next: [Solver Architecture](./solver-architecture)

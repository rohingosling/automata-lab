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
| Draft-transition IDs and coordinate-only endpoints | Cubic spans, gravity points, fallback state, and diagnostics. |
| Canonical origin setting | Selection, focus, pan, zoom, and drag feedback. |

Automatic route data never enters JSON, semantic revision hashes, or Undo history. UML terminal relations are persisted
visual notation but have no runtime, Solver, acceptance, or stopping semantics.

## Drag-and-Drop Creation

All four Palette controls are drag-only placement sources. Click, Enter, and Space on a Palette tile are inert. Native
drag feedback contains only the item icon.

Dropping State calculates the lowest available positive integer name such as `state_1`, then dispatches one command
that creates the semantic declaration and placement. Dropping an Initial or Terminal Indicator creates or moves the
appropriate chart record, including a relation when the drop target determines one.

Dropping Transition creates a chart-only draft with a stable non-negative safe-integer ID and two independently stored
coordinates. No semantic transition is created at this point. This makes an unfinished gesture persistable, undoable,
and visually recoverable without weakening the deterministic transition table.

## Draft and Semantic Transitions

A draft endpoint has coordinates only. Releasing it inside a state, or moving it by keyboard into a different state,
snaps the coordinate to that state's current geometric center. It does not retain a state attachment and does not
follow later state movement. Keyboard movement that begins inside the same state advances normally so the endpoint can
escape a large node.

Double-click, Enter, or Space on a focused draft opens transition configuration. A successful
`configure_chart_draft_transition` command validates the declarations and `(state,event)` key, inserts the semantic row,
and removes the entire draft atomically. Cancel or rejection preserves the original draft.

Semantic transitions are projections of `/state_machine/transition_table`. Moving a source or destination endpoint over
a state body dispatches `update_transition`, preserving the event while replacing that endpoint. Duplicate-key, stale
revision, or reference rejection changes neither the transition nor its rendered endpoints.

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
endpoint boundaries, and Route Obstacle Offset.

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

Ordinary configured relations are constructed center-to-center first. The actual cubic chain is then clipped at the
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

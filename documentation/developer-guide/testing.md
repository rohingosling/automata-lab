# Testing

Automata Lab uses layered verification so each contract is checked at the narrowest owner and important workflows are
then repeated across integration and browser boundaries. A passing production build is necessary, but it is not a
substitute for domain, Worker, accessibility, performance, or artifact evidence.

Tests live under `automata-web/tests/`. Vitest owns domain through component tests, while Playwright exercises the
built
GitHub Pages artifact beneath `/automata-lab/` in Chromium, Firefox, and WebKit.

## Test Strategy

The test suite follows three rules:

1. Prove pure policy without React or browser dependencies where possible.
2. Test every adapter at its boundary, including malformed, stale, cancellation, and unavailable-capability paths.
3. Reserve browser tests for behavior that depends on real layout, focus, workers, downloads, print, CSP, or routing.

Determinism is part of correctness. Canonical files, command results, Solver candidates, routes, labels, revisions, and
test inventories must not depend on object identity, timing accidents, locale defaults, or unstable traversal order.

The main application commands are:

| Command | Scope |
|---|---|
| `npm run typecheck` | Strict TypeScript checking without output. |
| `npm run lint` | ESLint across sources, tests, and scripts. |
| `npm run test:unit` | Ordinary Vitest inventory. |
| `npm run test:model` | Model, runtime, domain Solver, application, and infrastructure tests. |
| `npm run test:server` | Server engine, protocol, gateway, workspace, and shell integration. |
| `npm run test:solver` | Solver domain, Worker, workspace, and presentation integration. |
| `npm run test:shell` | React shell and component suites. |
| `npm run test:browser` | Serialized Playwright projects against the built artifact. |
| `npm run test:accessibility` | Focused accessibility browser suite. |
| `npm run build` | Production build followed by artifact verification. |
| `npm run verify` | Schema, type, lint, unit, performance, build, and browser gates. |

## Unit Tests

Pure tests cover codecs, validation, canonical serialization, commands, runtime execution, Solver normalization and
merging, revision hashing, routing geometry, and Server policy. Application tests exercise orchestration with typed
fake
ports so failures and stale results can be controlled without a browser.

Adapter tests cover file and CSV capabilities, preferences, hashing, image export, print handoff, layout, routing,
Solver, and Server Workers. Keep a regression at the narrowest layer that owns the defect; add a broader test only when
the cross-layer workflow itself is part of the contract.

The default Vitest environment is Node. DOM-backed files opt into `jsdom` explicitly and share the setup in
`tests/setup.ts`. Tests should restore spies, fake timers, global objects, and mocked browser capabilities after each
case so order does not affect results.

### Group-Box and Modal Regressions

`tests/browser/group-box-spacing.spec.ts` checks every workspace and modal group box against the
Initialization title font. It measures zero/default/nonuniform outside margins, internal padding and
control typography, and checks that narrow content fits inside group borders.
`tests/browser/modal-variants-spacing.spec.ts` pressures editor and confirmation content at reduced
window heights, checking that body scrolling retains visible footer actions and independent inset
owners. Group margins explicitly add to existing page/modal/scroll insets; preserve that addition
when measuring a group border against its containing pane or scrollbar.

### Transition and Viewport Regressions

The current Chart contract spans several test layers:

| Test files | Contract covered |
|---|---|
| `tests/model/draft-attachments.test.ts`, `detached-transitions.test.ts` | Either-order attachments, event memory, strict file versions, atomic restoration, reference cascades, and exact history. |
| `tests/shell/ChartTransitionRepair.test.tsx`, `StateChartDraftGeometry.test.ts` | Half-attached boundary grips, shared draft/semantic routing, self-loops, selection, and restoration dialogs. |
| `tests/shell/ChartPage.test.tsx` | Same-state quick connection, cancelled configuration, viewport preservation, and first-view fitting. |
| `tests/shell/palette-icons.test.ts`, `chart-palette-drag-image.test.ts` | Smooth SVG sources, matching native drag feedback, theme refresh, and image readiness. |
| `tests/browser/chart-transition-repairs.spec.ts`, `palette-sizing.spec.ts`, `chart.spec.ts`, `server.spec.ts` | Real browser geometry, resize gestures, selection and endpoint colors, Palette title/sizing, navigation viewport memory, and Open/Pull fitting. |

Browser capability skips are reported explicitly and do not count as passed native-drag checks. A documented
endpoint-jump investigation is not evidence that an unimplemented drag remedy has passed regression testing.

### Appearance Verification

`tests/shell/preferences.test.ts` covers button-color defaults, allowlisting, matching persistence, and independent recovery;
`tests/shell/SettingsDialog.test.tsx` covers all three dropdowns, the checked matching default, disabled-state/value retention, and draft transactions.
`tests/browser/button-colors.spec.ts` checks independent title/application/Console scopes, persistence,
palette text contrast in both themes, and forced-colors overrides. Matching tests cover all three Console
severities through rest/hover/press, Apply/Cancel, reload, and restoration of the retained manual color.
They check muted rendered fills while preserving severity-label colors and run a Console-scoped Axe
audit, including hovered error-row contrast. Appearance checks also verify the shared Light/Dark title
color for modal headers and the main application gradient, persisted choices, and contrast for all ten
title colors. The shell regression loads a retired hidden-master preference and verifies desktop recovery
and narrow Model/Detail/Console switching without a master close button.

For layout or selector changes, also inspect excluded menu items, settings groups, tabs, Transition
Table dropdowns, Palette tiles, and Chart endpoint grips in normal and interaction states. Measure the shared close/dropdown
boxes and equal insets, the catalog 1:2 column ratio, and Palette leading-label inset and trailing
tile-to-scrollbar clearance, with tile and pane borders measured separately.
Cover Light/Dark, forced colors, narrow viewports, and limited heights. Existing shell, accessibility,
Chart, and Palette sizing suites complement these targeted browser measurements; one passing palette
color test does not establish all layout or native-drag behavior.

### Spacing Verification

The browser suites `detail-spacing.spec.ts`, `states-spacing.spec.ts`, `modal-spacing.spec.ts`,
`splitter-spacing.spec.ts`, `scroll-spacing.spec.ts`, `shared-scroll-spacing.spec.ts`,
`footer-visibility.spec.ts`, and `zoom-equivalent-spacing.spec.ts` cover the shared spacing contract. Check default and unequal developer values so coincident page/modal edges
keep their owner rather than adding the scroll inset. Include empty and populated pages, nested
scroll areas, absent and present scrollbars, and both initial and final scroll positions.

Table/grid scrollports must retain zero right clearance while preserving bottom clearance and cell
padding. Other lists and reports retain their right gap. Verify visible footer controls, unchanged
splitter targets and minimums, hidden divider tracks, virtual trace row heights and Follow Tail, and
status text above a native horizontal scrollbar. Cover narrow viewports, both themes, forced colors,
and keyboard reveal. The 720-by-450 CSS viewport checks model the available space of a 1440-by-900
viewport at 200 percent zoom; they do not change actual browser zoom. Keep an actual 200-percent
browser zoom check in the manual review, including complex pane footers and modal controls.

## Property Tests

Fast-check tests explore generated valid values and operation sequences beyond maintained examples. Current properties
cover canonical round trips, unique deterministic transition keys, reference-safe renames, deterministic runtime
results, and replay-consistent Solver candidates.

A property must state the invariant rather than mirror one implementation. Keep generators inside product capacity
bounds, preserve enough context to reproduce a failure, and commit a focused regression when a discovered
counterexample
represents a meaningful contract edge.

Property tests supplement explicit boundary examples. They do not replace named cases for empty collections, maximum
sizes, duplicate keys, stale revisions, unsupported versions, or user-visible diagnostics.

## Component Tests

React Testing Library and user-event exercise shell-owned semantics in `tests/shell/`. These tests cover menus,
toolbars, dialogs, navigation, Editor forms, Chart controls, Console behavior, Solver candidate review, Simulator
views,
Page Setup, settings, printable reports, localization, and shared controls.

Query by role, accessible name, label, or visible state before using implementation-specific selectors. Assert focus,
disabled state, validation text, dialog restoration, and semantic table or grid structure along with callback effects.
Avoid snapshots for ordinary behavior; use direct assertions that identify the broken contract.

## Worker and Protocol Tests

Layout, routing, Solver, and Server work cross structured-clone boundaries. Their tests verify exact envelopes, request
correlation, bounded payloads, stale-result rejection, cancellation, timeouts, generation replacement, and recovery.

Protocol decoders receive hostile extra keys, inherited values, accessors, cycles, sparse arrays, prototype-bearing
objects, oversized collections, and non-finite numbers. Server integration also covers compare-and-set conflicts,
idempotent reads, uncertain Put reconciliation, immutable session pinning, disconnect, and restart.

Use a real Worker in browser coverage where lifecycle behavior matters. Use deterministic Worker doubles in unit tests
when the subject is application coordination rather than the browser implementation.

## Browser Tests

Playwright starts an in-process preview of the previously built artifact at `/automata-lab/`. Projects model desktop
Chrome, Firefox, and Safari through the Chromium, Firefox, and WebKit engines. Tests run with one worker so file,
download, routing, and screenshot evidence is stable.

Browser suites cover critical shell, file, CSV, Chart, Server, Simulator, printing, security, responsive, and keyboard
workflows. Reviewed visual baselines run in Chromium on Windows; other platforms and browser projects skip those
platform-specific image comparisons. Behavioral assertions run across all configured projects. Failure screenshots and
traces are retained as test output and must not enter the production artifact.

Do not make browser assertions depend on animation timing or arbitrary sleeps. Wait for an accessible state, a stable
Console code, a Worker result, or another product-owned completion signal.

## Accessibility Tests

Accessibility verification combines axe checks with explicit interaction. Automated rules catch many name, role,
contrast, and structural defects, while Playwright cases verify keyboard reachability, focus containment and
restoration,
roving focus, forced colors, reduced motion, 200-percent zoom, and 320-CSS-pixel reflow.

Test the textual equivalent of Chart operations, not only Canvas pointer behavior. Dialogs, menus, trees, tabs, grids,
splitters, and live regions require pattern-specific keyboard assertions. A clean axe result alone is not acceptance.

## Routing Performance Tests

`npm run test:routing-performance` is an opt-in correctness-validated benchmark separate from ordinary unit discovery.
It enables compile-time counters, performs warmups and repeated samples, and records nearest-rank P50 and P95 evidence
for the maintained FNB document and synthetic routing scenarios.

Before timing, the harness compares spatial-index results with linear scans and sparse routing with the dense oracle.
It
also checks cold/warm equality, selective repair accounting, fallback behavior, and deterministic result signatures.
`npm run test:performance` owns the broader reference performance harness.

Performance results are meaningful only on a recorded environment with no competing load. Never weaken route quality,
sample count, or correctness checks merely to improve a timing result. Production builds compile the diagnostic
counters
out and the artifact verifier rejects their identifying tokens.

## Artifact Tests

The Vite build emits no source maps and immediately runs `scripts/verify-artifact.mjs`. The shared verifier enforces
the
reviewed fixed and hashed file inventory, content types, bundle budgets, subpath-safe shell, CSP directives, license
notices, schema, icons, examples, and expected Worker bundles.

It rejects unreviewed paths, tests, source, caches, user-data directories, credentials, source maps, local machine
paths,
private guidance references, source-map directives, embedded key material, and production routing diagnostics. Its own
fixture tests prove both the accepted inventory and representative fail-closed cases.

Documentation has a separate `npm --prefix documentation run test` gate. It builds and hardens VitePress, checks the
required routes, internal links and fragments, application backlink, local-search output, page-specific CSP hashes,
local runtime assets, source-map absence, private-source markers, and the final documentation base path.

`npm run build:pages` builds the audited application plus documentation and rejects any documentation assembly that
changes or omits an application file. The Playwright documentation specification covers the final paths, direct reload,
local search, keyboard focus, narrow and 200-percent layout, forced colors, reduced motion, CSP, same-origin requests,
and automated accessibility in Chromium, Firefox, and WebKit.

## Test Fixtures

The published light-switch example is the small maintained end-to-end document. Larger comprehensive,
Solver-candidate, and FNB routing documents live under `automata-web/tests/fixtures/` because they are test evidence,
not
additional public examples.

Reuse maintained fixtures when their semantics fit the case. Build a local fixture when the test needs a deliberately
small boundary, hostile value, malformed envelope, or long printable table. Never mutate a shared imported document in
place; clone it or pass it through the same codec or command path used by production.

Browser screenshots are platform-specific reviewed evidence. Update them only for an intentional visual change after
inspecting the rendered result and preserving accessibility behavior.

## Clean Verification

Install application and documentation dependencies from their committed lockfiles:

```powershell
npm --prefix automata-web ci
npm --prefix documentation ci
```

Then run the application and documentation gates:

```powershell
npm --prefix automata-web run verify
```

Run focused suites while developing, but finish with locked installs and the complete commands appropriate to the
changed surface. Review generated artifacts and failure output without committing `dist/`, `.vitepress/dist/`,
`coverage/`, `playwright-report/`, or `test-results/`.

Previous: [Printing Architecture](./printing-architecture)

Next: [Security and Privacy](./security-and-privacy)

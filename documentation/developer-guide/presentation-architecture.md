# Presentation Architecture

Automata Lab's presentation layer renders immutable application and document state and dispatches typed intents. It
owns interaction, focus, responsive composition, and semantic styling; it does not validate or mutate documents,
execute state machines, decode files, infer Solver candidates, or communicate with raw Workers.

`automata-web/src/Application.tsx` is the outer React composition boundary. Feature components beneath
`automata-web/src/presentation/` receive the values, command availability, and callbacks needed for one workflow.

## Application Shell

The desktop-style shell composes a title, menu bar, toolbar, master navigation tree, detail region, lower Console, and
status bar. Splitters adjust the master and Console regions while keeping minimum usable sizes. At narrow widths, region
navigation presents Master, Workspace, and Console without unmounting the underlying application stores.

Routes are a closed `ShellRoute` union. The navigation tree has one stable hierarchy, while View-menu and toolbar
commands dispatch the same navigation callback. Selecting a route derives detail content; it does not create a second
feature instance or duplicate workflow state.

Outer composition also creates default browser adapters for files, CSV, printing, hashing, layout, routing, Solver, and
server operations. `ApplicationProperties` lets tests replace those ports without teaching feature components about
their concrete implementations.

## View Models

Application contracts define narrow presentation values such as `StatusBarViewModel`, `HostedModelStatusViewModel`,
Console entries, and command-availability results. Selectors and workspace functions derive them from current revisions,
validation, connection state, preferences, active route, selection, and other explicit application state.

Presentation may receive a document-shaped editor value where direct fields are the view model, but it still treats that
value as immutable. Mutations go back through command factories with an expected revision. Derived Chart routes,
validation summaries, hosted status, and Simulator snapshots remain projections rather than alternative stores.

Keep expensive derivation keyed by the smallest relevant revision or immutable input. Do not use React render timing,
DOM order, or object identity accidents as business-state signals.

## Dialog Patterns

`ModalDialog` centralizes native modal behavior, safe initial focus, Escape cancellation, focus containment, and invoker
restoration. Higher-level patterns supply message, warning, impact-confirmation, CSV, Solver, Simulator, and other
workflow content without reimplementing the modal lifecycle.

Dialog edits use explicit draft state. Application Settings and Page Setup copy the committed preferences when opened;
Apply publishes one coherent replacement and Cancel discards the draft. Destructive Editor commands present the complete
immutable command impact before commit. Chart Delete remains immediate because that surface's contract deliberately
differs, even though both routes use the same command planner.

All modal forms share measured label alignment. `ModalDialog` measures the longest visible field label and places every
value at one common origin; responsive styles stack labels above values at the narrow breakpoint. Individual dialogs
must not introduce competing column offsets.

## Menus and Command Enablement

Menus and toolbar entries are data definitions with identifiers, labels, icons, callbacks, disabled state, and optional
pressed state. Enablement is derived from authoritative inputs immediately before rendering. Examples include document
presence and completeness, undo/redo stack depth, server connection and readiness, operation-in-progress flags, active
session state, and Chart capability.

Feature pages receive composed decisions instead of recreating prerequisite logic. Simulator Run, Step, and Reset, for
example, use one application-level availability function that combines session, validation, server, hosted-revision,
and pending-operation state. The page displays stable unmet prerequisites; it does not infer them from button state.

A command reachable from several surfaces must share one handler and one enablement contract. Adding a menu or toolbar
entry is presentation wiring, not a new use case.

## Console

The application publishes structured `ConsoleEntry` values through a bounded diagnostic channel. Each entry has a stable
identifier, UTC timestamp, severity, code, source, text, and optional route context. The channel caps individual field
lengths, diagnostic batches, and total retained entries before presentation receives them.

`ConsolePanel` filters Message, Warning, and Error entries without changing the underlying channel. It implements an
accessible grid with roving focus, selection, copy support, optional contextual navigation, and Follow Tail behavior.
Rows use an open visual treatment: severity remains available through leading accent, symbol, text, and semantic color,
not separators or color alone.

Full models, event buffers, Solver observations, traces, credentials, and other large or sensitive payloads must never
be copied into Console entries. Report operation, disposition, identifiers where safe, and actionable remediation.

## Status Contributions

The status bar renders an application view model rather than reading feature stores. Durable document segments include
entity and assignment counts, initial state, and server connection. Feature-specific context is appended only while its
page is active.

Chart selection count appears only while Chart is active and the count is nonzero. Simulator contributes current state
and staleness while Simulator is active. Short-lived Chart export success may contribute a bounded status segment, while
failures and remediation belong in Console.

New feature contributions should be concise, derived, and scoped to the active route. The status bar is not a diagnostic
log and must not become a second state store.

## Responsive Layout

Responsive presentation rearranges existing regions and commands; it does not fork application logic. Master and Console
visibility and splitter sizes are application preferences. Narrow-region selection is transient shell state. Resizing
keeps the same document, history, jobs, sessions, and feature components mounted.

Shared controls own minimum dimensions, command-bar measurement, progressive rendering, and splitter constraints.
Feature pages should use those controls instead of adding page-specific breakpoint calculations. Workflows must remain
operable at 200-percent zoom and a 320-CSS-pixel viewport.

## Focus Management

Native controls retain native keyboard behavior. Composite trees, lists, tabs, grids, menus, splitters, and Chart
interactions implement their applicable ARIA pattern with roving focus where required.

Navigation can focus the detail heading after route changes. Dialogs capture and restore their invoker; nested error
dialogs restore focus to the still-open owner before that owner later returns to its own invoker. A successful Chart
command may request focus by stable node, edge, control, or Canvas identity after the new projection renders. If the
target no longer exists, focus falls back to Canvas; deletion requests Canvas directly.

Store logical focus intent only when restoration crosses a render or modal boundary. Do not retain disposable DOM nodes
as document or application data.

## Accessibility Patterns

Use native HTML controls first and associate every label programmatically. Visible focus, modal containment, keyboard
equivalence, landmarks, headings, names, descriptions, validation state, and live-region announcements are part of the
component contract, not a final audit layer.

Selection, connectivity, validation, runtime state, and severity cannot rely on color alone. Semantic CSS tokens cover
Light, Dark, forced-colors, and reduced-motion modes. User content is inserted as text, and imported strings never become
HTML. Chart-only operations retain equivalent textual workflows in Editor.

Test accessibility at unit or component level where a pattern is owned, then cover keyboard, zoom, narrow layout,
screen-reader semantics, and forced colors in browser tests.

## Localization Resources

User-facing application strings live in `automata-web/src/localization/messages.ts`. `MessageKey` is derived from the
English message object, so calls to `text` are checked against the maintained key set. The current supported locale is
English and `resolveLocale` falls back deterministically to it.

Add or change a string at the localization boundary rather than embedding prose in a feature component. Model names,
file names, diagnostics, and other user content are values, not translation keys. Keep interpolation explicit so
untrusted values remain text and translators can see the stable surrounding message.

Previous: [Server and Simulator Architecture](./server-and-simulator-architecture)

Next: [Configuration and Preferences](./configuration-and-preferences)

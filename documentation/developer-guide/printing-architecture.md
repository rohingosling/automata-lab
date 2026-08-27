# Printing Architecture

Automata Lab printing is a snapshot-and-handoff workflow. The application captures one authoring revision and the
committed print preferences, converts them into a presentation-neutral report, renders an isolated report surface, and
then asks the browser to print that surface. The workflow never prints the live application shell.

This separation keeps a pending report stable while editing continues and prevents browser print cancellation from
changing the document, history, dirty state, revision, or file association.

## Print Snapshot

`automata-web/src/application/printing.ts` defines `PrintableReport` and its section values. `createPrintableReport`
copies the selected fields from the current `AuthoringDraft`, records the document revision and file name, and extracts
an immutable `PrintPageSetup` from the committed `ApplicationPreferences`.

The snapshot includes only document-owned information selected for the report:

- model metadata, states, events, actions, action assignments, and transitions;
- persisted Chart projection data and one derived State Chart raster;
- saved Solver observation sequences; and
- saved Simulator event sequences.

It excludes the undo stack, current selection, viewport, transient Solver candidate, editable Simulator buffer, hosted
revision state, live session, traces, Console entries, dialog drafts, and other shell state. The snapshot copies arrays
and records rather than retaining mutable references to the authoring draft.

Print is valid for an incomplete but structurally sound draft. Missing states or an initial state therefore do not
prevent report composition, and the captured values remain an honest projection of that incomplete revision.

## Report Composition

Enabled sections are assembled in a fixed order:

| Order | Section | Source |
|---:|---|---|
| 1 | Model Summary | Metadata, initial state, and collection counts. |
| 2 | States | Descriptions plus ordered entry and exit action lists. |
| 3 | Events | Declared event names and descriptions. |
| 4 | Actions | Declared action names and descriptions. |
| 5 | Transition Table | Ordered source, event, and destination rows. |
| 6 | State Chart | Derived, bounded PNG raster of the rendered chart scene. |
| 7 | Chart Projection | Persisted placements, indicators, relations, and drafts. |
| 8 | Solver Observation Sequences | Saved document sequences only. |
| 9 | Simulator Event Sequences | Saved document sequences only. |

`PrintableReportSurface` renders the snapshot as one semantic `article`. It uses headings, description lists, tables
with scoped headers, and one-item-per-line list cells. It renders user values through React text nodes and contains no
buttons, inputs, menus, or other interactive controls.

Print-only CSS hides the application shell, exposes the isolated report, starts major sections on new pages, repeats
table headings where the browser supports it, and applies the compact report typography. Academic and Industry styles
change typography and table treatment without changing report content.

## Print Preferences

Page Setup and Application Settings edit one shared allowlisted preference snapshot. Printing reads these committed
values only:

- A4, Letter, or Legal paper;
- Portrait or Landscape orientation;
- independent top, right, bottom, and left margins in millimetres;
- inclusion of each of the nine report sections; and
- Academic or Industry report style.

Defaults and bounds come from `compile-time-configuration.ts`. `extractPrintPageSetup` projects the print subset and
supplies safe defaults for legacy runtime snapshots that predate a field. It does not clamp arbitrary invalid values at
print time; preference decoding and the settings UI enforce the same central constraints before the snapshot exists.

`createPrintPageStyle` converts only validated allowlisted values into the `@page` rule. It maps paper and orientation,
applies all four margins, escapes the running header, and derives the available State Chart height. Model text cannot
inject CSS through that path.

## Chart Rasterization

State Chart is the one derived-scene exception in the report. The print workflow uses the same sanitized image
compositor as Save As Image, but fixes the capture contract for print:

- PNG raster output with no save picker;
- Light-theme color adaptation, transparent background, and no grid;
- black state, transition-label, and terminal-indicator detail;
- fixed print DPI and megapixel safety limits from compile-time configuration; and
- fit-to-limit behavior before Canvas allocation.

The compositor captures the immutable document and preference request, not the user's current pan, zoom, selection, or
debug overlays. It explicitly preserves transition labels and the UML terminal indicator's inner disc. The resulting
data URL is inserted into the State Chart section; the separate Chart Projection section remains textual.

If raster capture fails, the application reports the failure and does not hand an incomplete report to the print port.
Capture neither saves an image nor writes derived scene data back into the document.

## Browser Print Handoff

`BrowserPrintPort` is deliberately small: its `print` method calls `window.print()` exactly once. The report is already
rendered and the print media rules are active before that boundary is invoked. Page rendering, printer selection, PDF
output, and cancellation are browser-owned behavior.

The application treats the call as a handoff, not a document transaction. A return from `window.print()`, including a
user cancellation, removes the pending report surface without committing document or preference changes. A thrown
adapter failure becomes a bounded Console diagnostic and leaves authoring state intact.

## Print Testing

Printing evidence is split by owner:

| Layer | Principal checks |
|---|---|
| Application | Section order, selection, duplicate action order, incomplete drafts, and deep snapshot isolation. |
| Component | Semantic tables, control-free output, malicious text, style selection, typography, and exact page CSS. |
| Adapter | One browser print call and resolved handoff behavior. |
| Browser | Page Setup, paper rules, raster details, snapshot isolation, and cancellation. |

When changing printing, run the focused tests first and then the full verification command. A change to Chart capture
also requires the Chart image-export and browser Chart suites because print deliberately reuses that compositor.

Previous: [Configuration and Preferences](./configuration-and-preferences)

Next: [Testing](./testing)

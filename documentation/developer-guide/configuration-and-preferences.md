# Configuration and Preferences

Automata Lab separates compile-time tuning from user-owned application preferences and document-owned data.
`automata-web/src/configuration/compile-time-configuration.ts` is the central source for application defaults, numeric
bounds, presentation spacing, shell tuning, routing constants, persistence metadata, and diagnostic switches. The browser preference adapter
stores only the explicit content-independent allowlist.

Do not introduce a second default in a component or adapter. A setting belongs in this pipeline only when it is truly an
application preference rather than document geometry, runtime state, or an algorithm invariant.

## Compile-Time Configuration

`COMPILE_TIME_CONFIGURATION` groups values by responsibility:

| Group | Owns |
|---|---|
| `applicationSettings` | Defaults exposed through application behavior or settings UI. |
| `applicationSettingConstraints` | Numeric and string bounds for those preferences. |
| `chart` | Fixed layout, viewport, routing, and transition-line tuning. |
| `debug` | Non-persisted development diagnostics and overlay appearance. |
| `dialog`, `shell` | Shared presentation tuning and shell defaults. |
| `persistence` | Preference envelope version and storage key. |
| `presentation.spacing` | Page/modal insets, splitter gaps, scroll clearance, and additional group-box outer spacing. |
| `server` | Built-in gateway timeout tuning. |

`createDefaultApplicationPreferences` projects the complete `applicationSettings` groups into one typed immutable
snapshot. `DEFAULT_APPLICATION_PREFERENCES` is the only default value consumers should import. Settings controls,
printing, Chart projection, adapters, and tests must not repeat literal defaults locally.

Fixed algorithm values remain compile-time configuration when users cannot choose them. Domain capacity limits remain
with their domain owner unless the same value is also an application-setting bound.

### Presentation Spacing

`COMPILE_TIME_CONFIGURATION.presentation.spacing` defines four shared CSS-pixel distances and
independent additional outer spacing for group boxes. `Application.tsx` exposes them as inherited CSS
custom properties on the live application shell, including its native modal descendants. CSS
consumers do not duplicate their defaults.

| Setting | CSS custom property | Default |
|---|---|---:|
| `detailPageContentInsetPixels` | `--detail-page-content-inset` | 8px |
| `modalContentInsetPixels` | `--modal-content-inset` | 8px |
| `splitterSideGapPixels` | `--splitter-side-gap` | 4px |
| `scrollContentEdgeInsetPixels` | `--scroll-content-edge-inset` | 4px |

For these four shared distances, each physical edge has one owner. Page and modal settings take
precedence when their outer edge coincides with a scroll boundary; independent scroll areas use the
scroll setting. These shared distances are never added together or resolved by taking their maximum.
Table/grid scrollports are the exception: their right content clearance is zero, with or without a
vertical scrollbar. Their bottom clearance retains its existing owner. See [Presentation Architecture](./presentation-architecture#content-insets-and-scrolling)
for footer, nested-scroll, and splitter responsibilities.

The additional `groupBoxOuterSpacingPixels` object configures each side independently:

| Field | CSS custom property | Default |
|---|---|---:|
| `top` | `--group-box-outer-spacing-top` | 0px |
| `right` | `--group-box-outer-spacing-right` | 4px |
| `bottom` | `--group-box-outer-spacing-bottom` | 0px |
| `left` | `--group-box-outer-spacing-left` | 4px |

These values apply as margins outside every group-box border in the workspace and application-owned
modal dialogs. They deliberately add to existing page, modal, and scroll insets and inter-group gaps,
allowing group boxes to be tuned without changing other spacing or their internal padding. See
[Group Boxes](./presentation-architecture#group-boxes) for the shared title styling.

These settings are compiled into the application and have no Application Settings controls or
persistence fields. They do not enter model files, command history, chart layout/routing geometry,
image exports, or print layout. Printed paper margins remain separate millimetre-based preferences.

## Application Preferences

`ApplicationPreferences` is an explicit allowlist. It includes:

- theme, independent title-bar/application/Console message button colors, Save Backup, and Follow Tail;
- Console visibility and bounded panel sizes; master visibility is no longer persisted.
- Server URL;
- Chart grid, state-size, name-wrapping, automatic-layout, transition, and image-export choices; and
- paper, orientation, margins, section inclusion, and report style for printing.

Preferences are content-independent and apply across documents. They never contain state coordinates, selected expanded
heights, routes, labels, Solver observations or candidates, Simulator sessions or traces, hosted documents, Console
entries, credentials, or current file associations.

The Settings dialog works with a complete draft snapshot. General, Appearance, Console, Chart, Server, and Print groups
currently expose preferences. Solver, Editor, and Simulator group labels are reserved but disabled because they have no
independent preference fields in the current contract.

Application color names are allowlisted by `application/button-colors.ts`; their Blue/Blue/Gray title/application/Console defaults live
under `applicationSettings.appearance`. Presentation maps the names to solid palettes and scopes the
Console palette to buttons inside `.console-row`. Console title-bar controls inherit the application
palette. Menu-bar items, popup menus, toolbar menu entries, the Application Settings group list,
tab-page tabs, Transition Table dropdown buttons, and Palette tiles are excluded from button-color styling and use
theme colors. Selected tabs use a lighter surface in both themes. The darker, muted palette uses a lighter theme-specific Gray. Missing stored fields use their defaults without a preference-version change; unsupported
color values fall back independently and report corruption.

## Application Color Ownership

`application/button-colors.ts` owns `ButtonColor`, the ordered ten-name allowlist, and `readButtonColor`.
The stored fields are `titleBarColor` (default Blue), `applicationButtonColor`, `consoleMessageButtonColor`, and the boolean
`matchConsoleMessageColor`, whose central default is true. The checkbox disables the Console dropdown
without replacing its draft or stored color. Apply commits all fields; Cancel discards the draft.
`presentation/shared/button-colors.ts` maps those names to surface, hover, active, text, and icon-filter
tokens through `buttonColorStyle`; `Application.tsx` supplies them on the shell.
Title bars use `--title-bar-surface` and `--title-bar-text`, taking the palette surface in Light and
its active shade in Dark, with the same readable foreground. Forced colors overrides the derived
application-title token.
Legacy `masterPanelVisible` values are ignored and omitted on save without a version bump or corruption
warning; desktop always retains the master/detail layout, while narrow region switching stays transient.
Gray uses #383838 in Dark and #fafbfc in Light. When matching is enabled, Console surface/hover/active
tokens are omitted so CSS uses row-local `--console-severity-surface/hover/active` tokens supplied by
`consoleSeverityButtonStyle` on ConsolePanel rows. These reuse the same named Green message, Blue
warning, and Red error palettes in both themes, preserving severity labels and accents. Matched buttons
use white text and icons with no text shadow. Dark-mode inline text stays white for manual palettes too;
`--console-button-shadow` adds a fine 1-pixel #17212b edge only for manual Yellow/White fills.
Light-mode manual foregrounds and icon filters retain their palette rules. Missing or invalid matching values decode to true without a format-version change.

The shared rule in `application.css` styles native buttons and the toolbar overflow summary. It excludes
controls with non-button roles, toolbar overflow menu descendants, `.drop-down-list-box-button`, and
`.chart-palette` descendants, plus `.chart-endpoint` grips. Keep those exclusions effective for hover, pressed, selected, expanded,
focus, and icon styling as well as the resting surface. Console row buttons override the inherited token
set with `--console-button-*`; the title bar inherits `--button-*` from the application shell.

Application buttons use `1px solid #000000` borders. Console entries override that border with a 1-pixel
theme border, including theme interaction colors. Excluded controls retain their own theme styling.
Forced-colors rules use system button, highlight, and disabled colors. Fixed border thickness, close-control
geometry, tab highlighting, catalog proportions, and Palette sizing are CSS presentation rules, not new
stored preferences. See [Presentation Architecture](./presentation-architecture#control-appearance-and-layout).

## Defaults and Bounds

Every numeric preference is decoded against the constraint beside its default. Examples include grid size, state
dimensions, image DPI and megapixels, minimum state distance, transition geometry values, print margins, panel sizes,
and Server URL length. Integer-only fields reject fractional values; other numeric fields still require finite values
inside inclusive bounds.

An invalid stored field falls back to its central default instead of being clamped silently. Enum-like preferences accept
only their declared values. Grid colors require a valid six-digit hexadecimal color. The Server URL field accepts a
non-empty trimmed value within its length bound; the installed gateway separately rejects unsupported schemes and
currently connects only to `builtin://` URLs.

Apply the same constraints in the settings controls and storage decoder, but keep their authority centralized. UI
validation prevents bad drafts; adapter validation protects startup from manually altered or older storage.

## Persistence Allowlist

The browser adapter stores one JSON envelope in `localStorage`:

```json
{
  "version": 1,
  "preferences": {}
}
```

The actual `preferences` member is the complete typed allowlist. The storage key and format version come from compile-time
configuration. Unknown object keys are ignored and never round-trip through the typed snapshot. Saving serializes only
the `ApplicationPreferences` value supplied by the application.

Preference loading and saving are capability adapters. A browser that denies storage access still launches with
defaults. Preference failure must never block document authoring, mutate a document, or cause application data to be
written to another storage mechanism.

## Corrupt-Preference Recovery

Startup parses storage as untrusted input. Missing storage returns defaults without a warning. Malformed JSON, an invalid
envelope, inaccessible storage, or invalid allowlisted content produces a bounded `PREFERENCE_CORRUPT` warning. An
unsupported envelope version returns defaults with `PREFERENCE_VERSION_UNSUPPORTED`.

For a structurally usable current-version preference object, each missing or invalid field independently falls back to
its default. The adapter also detects when a supplied allowlisted value normalized differently and reports one warning
for the load rather than one warning per field.

The application seeds the diagnostic channel with the load warning and continues. A save failure publishes one bounded
Console warning and avoids repeating it on every render; a later successful save clears that suppression. Do not expose
raw stored text in diagnostics.

## Preference Transactions

Opening Application Settings copies committed preferences into a dialog draft. Field edits replace that draft only.
Apply publishes the complete snapshot, closes the dialog, and lets one persistence effect save it. Cancel closes the
dialog without changing committed preferences.

Page Setup uses the same transaction pattern for its synchronized print subset. Apply merges paper, orientation,
margins, and section inclusion back into the full preference snapshot. The Application Settings Print group reads the
same fields and additionally owns report style; neither dialog maintains a separate print store.

A changed Server URL initiates reconnection only after Apply and is rejected while a server operation is pending. Other
preference consumers receive the new immutable snapshot together, preventing a render from mixing old and new layout,
routing, export, or print values.

## Diagnostic Switches

Developer diagnostics belong to compile-time configuration, not `ApplicationPreferences`. Current Chart switches cover
routing performance counters and derived overlays for gravity points, transition center connectors, and hidden
center-to-boundary segments.

These values are non-interactive, non-persisted, and excluded from documents, command history, semantic hashes, image
exports, and printed reports. Overlay switches and values do not enter routing requests; the performance switch controls
instrumentation rather than algorithm input. Production builds keep that opt-in instrumentation disabled through the
build-time definition.

When adding a diagnostic switch, give it a safe production default, keep it outside the settings dialog and storage
allowlist, and verify that enabling it cannot change document semantics or deterministic algorithm output.

Previous: [Presentation Architecture](./presentation-architecture)

Next: [Printing Architecture](./printing-architecture)

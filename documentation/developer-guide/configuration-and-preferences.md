# Configuration and Preferences

Automata Lab separates compile-time tuning from user-owned application preferences and document-owned data.
`automata-web/src/configuration/compile-time-configuration.ts` is the central source for application defaults, numeric
bounds, shell tuning, routing constants, persistence metadata, and diagnostic switches. The browser preference adapter
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
| `server` | Built-in gateway timeout tuning. |

`createDefaultApplicationPreferences` projects the complete `applicationSettings` groups into one typed immutable
snapshot. `DEFAULT_APPLICATION_PREFERENCES` is the only default value consumers should import. Settings controls,
printing, Chart projection, adapters, and tests must not repeat literal defaults locally.

Fixed algorithm values remain compile-time configuration when users cannot choose them. Domain capacity limits remain
with their domain owner unless the same value is also an application-setting bound.

## Application Preferences

`ApplicationPreferences` is an explicit allowlist. It includes:

- theme, Save Backup, and Follow Tail;
- master/Console visibility and bounded panel sizes;
- Server URL;
- Chart grid, state-size, name-wrapping, automatic-layout, transition, and image-export choices; and
- paper, orientation, margins, section inclusion, and report style for printing.

Preferences are content-independent and apply across documents. They never contain state coordinates, selected expanded
heights, routes, labels, Solver observations or candidates, Simulator sessions or traces, hosted documents, Console
entries, credentials, or current file associations.

The Settings dialog works with a complete draft snapshot. General, Appearance, Console, Chart, Server, and Print groups
currently expose preferences. Solver, Editor, and Simulator group labels are reserved but disabled because they have no
independent preference fields in the current contract.

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

# User Reference

This chapter collects the current `1.0.0` command names, shortcuts, status fields, exchange formats, common diagnostics,
and terminology. Earlier chapters explain the workflows and their safeguards in context.

## Menu Commands

### File

| Command | Availability and effect |
|---|---|
| New | Starts an untitled project after protecting dirty work. |
| Open | Selects and transactionally opens one Automata Lab JSON project. |
| Save | Writes the current persistable project to its association or download fallback. |
| Save As | Requests one new JSON destination and associates it when supported. |
| Close | Closes the client project without deleting local or hosted data. |
| Validate State Machine | Reports complete model validation for the open project. |
| Pull Model from Server | Replaces the client project with the current valid hosted document. |
| Push Model to Server | Compare-and-set hosts the current complete valid project. |
| Import from CSV | Imports one selected collection as an atomic project command. |
| Export to CSV | Exports one selected collection without changing the project. |
| Connect to Server | Connects to the configured server URL. |
| Disconnect from Server | Closes the client connection while preserving a live built-in worker. |
| Test Server | Runs handshake, liveness, and readiness checks. |
| Page Setup | Edits paper, orientation, margins, and included report sections. |
| Print | Composes the current project revision and opens the browser print dialog. |
| Settings | Opens Application Settings for global browser preferences. |

CSV submenus offer Model Metadata, States, Events, Actions, State Actions, Transition Table, Solver Observation Sequence,
and Simulator Event Sequence. A selected Solver or Simulator sequence is required for those sequence exports.

### Edit

| Command | Effect |
|---|---|
| Cut | Uses the native edit operation in the active editable context. |
| Copy | Uses the native edit operation or copies a supported focused row. |
| Paste | Uses the native edit operation in the active editable context. |
| Undo | Reverses the newest application document command. |
| Redo | Reapplies the newest undone application document command. |

Text-control undo can remain local while a field is being edited. After a valid edit commits, application Undo treats
the accepted change as one document command.

### View

| Command | Effect |
|---|---|
| Editor, Chart, Solver, Simulator | Selects the corresponding main workspace. |
| Expand All, Collapse All | Expands or collapses the Editor branch in the Model tree. |
| Clear | Deletes retained in-memory Console entries only. |
| Console | Shows or hides the Console region. |
| Expand Chart States | Toggles the open project's persisted Chart expansion setting. |
| Theme → Light, Dark | Selects and persists the application theme. |

### Help

| Command | Effect |
|---|---|
| Documentation | Opens the current User Guide in a new browser context. |
| About Automata Lab | Shows version, description, the application and Fluent icon licences, and release notes. |

## Toolbar Commands

The toolbar mirrors frequent menu commands and uses the same enablement rules.

| Group | Commands |
|---|---|
| Project files | New, Open, Save, Save As |
| Server revision | Pull Model from Server, Push Model to Server |
| History | Undo, Redo |
| Workspace | Editor, Chart, Solver, Simulator |
| Chart display | Expand Chart States |
| Appearance | Theme with Light and Dark choices |

At narrow widths, trailing commands move into the accessible **More** menu without changing their behavior. Arrow keys
move among enabled toolbar controls after the toolbar receives focus.

## Keyboard Shortcuts

### Application shortcuts

| Shortcut | Command |
|---|---|
| Ctrl+N | New |
| Ctrl+O | Open |
| Ctrl+S | Save |
| Ctrl+P | Print |
| Ctrl+X | Cut in the active editable context |
| Ctrl+C | Copy in the active context or focused supported row |
| Ctrl+V | Paste in the active editable context |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Alt or F10 | Enter the menu bar |

Use the equivalent Command-key editing shortcuts on macOS where the browser and operating system provide them. A text
control may consume a shortcut for native editing before the application command layer sees it.

### Common composite controls

| Context | Keys |
|---|---|
| Menus | Arrow keys, Enter or Space, Escape |
| Toolbar | Arrow keys among enabled controls |
| Model tree | Up/Down, Left/Right, Home/End, type-ahead, Enter or Space |
| Tabs and lists | Arrow keys; Enter or Space where activation is available |
| Grids and Console | Arrow keys, Home/End, native selection and scrolling keys |
| Splitters | Arrow keys to resize within announced limits |
| Dialogs | Tab/Shift+Tab, Enter where accepted, Escape to cancel |

### Chart shortcuts

| Shortcut | Chart effect |
|---|---|
| Enter or Space | Edits a focused state, draft, semantic transition, or terminal connection. |
| Shift+Enter | Quick-connects the primary and focused eligible Chart items. |
| Delete or Backspace | Immediately deletes the Chart selection through the shared command planner. |
| Arrow keys | Moves selected items or a focused draft endpoint; pans when no item consumes the key. |
| Shift+Arrow | Uses the larger movement step. |
| Alt+Up/Down | Resizes selected expanded states; Shift adds the larger step. |
| Plus or Equals | Zooms in. |
| Minus | Zooms out. |
| Home | Fits the Chart. |

Palette State, Initial Indicator, Terminal Indicator, and Transition controls are drag-only. Click, Enter, and Space do
not place an item; complete semantic creation remains available in Editor and dialogs.

## Status-Bar Fields

| Field | Meaning |
|---|---|
| Initial State | Current semantic initial state, or `N/A` without an open project. |
| States | Declared state count. |
| Events | Declared event count. |
| Declared Actions | Reusable action count. |
| Entry Actions | Ordered entry-assignment count, including duplicates. |
| Exit Actions | Ordered exit-assignment count, including duplicates. |
| Transitions | Semantic transition-table row count. |
| Server | Connected, Connecting, or Disconnected with text and symbol cues. |
| Chart Elements Selected | Active-Chart selection count; omitted when zero or another page is active. |
| Chart export status | Successful filename or browser download-location limitation while Chart is active. |
| Simulator State | Current state of the active Simulator session. |
| Session Stale | Indicates that the session remains pinned to an older hosted revision. |

Durable failures, warnings, operation outcomes, and remedies belong in Console. At compact sizes, secondary status
values can move into an accessible details popover.

## File and CSV Formats

An Automata Lab JSON file is UTF-8, has `file_id: "automata-lab-state-machine"` and `file_version: "1.0.0"`, and requires
the top-level members `settings`, `state_machine`, `chart`, `solver`, and `simulator`. Save emits deterministic two-space
JSON with one trailing newline. See [Files and Data Exchange](./files-and-data-exchange) for completeness, canonicalization,
and strict-reader rules.

Canonical CSV columns are:

| Collection | Header |
|---|---|
| Model Metadata | `name,description,version,initial_state` |
| States | `name,description` |
| Events | `name,description` |
| Actions | `name,description` |
| State Actions | `state,action,schedule` |
| Transition Table | `state,event,next_state` |
| Solver Observation Sequence | `name,type` |
| Simulator Event Sequence | `name` |

CSV input is UTF-8, accepts quoted fields and embedded newlines, matches required headers without case or surrounding
whitespace, and ignores unknown columns. Export uses canonical column order, RFC 4180 escaping, CRLF records, and one
final CRLF. One invalid row rejects the entire import.

## Common Diagnostic Codes

| Code | Meaning or next action |
|---|---|
| `SHELL_READY` | Application startup completed. |
| `VALIDATION_PASSED` | The current model passed complete validation. |
| `STATE_DEFINITIONS_MISSING` | Add at least one state before strict operations. |
| `INITIAL_STATE_REQUIRED` | Choose an initial state before strict operations. |
| `JSON_MALFORMED` | Correct JSON syntax before Open. |
| `DUPLICATE_JSON_MEMBER` | Keep one occurrence of each JSON object member. |
| `FILE_ID_INVALID` | Use the exact Automata Lab file identity. |
| `FILE_VERSION_UNSUPPORTED` | Open with a release supporting that file version or convert explicitly. |
| `FILE_TOO_LARGE` or `CSV_FILE_TOO_LARGE` | Reduce input below 5 MiB. |
| `FILE_OPENED` | Open transaction committed successfully. |
| `FILE_SAVED` | Canonical JSON write or download completed. |
| `FILE_BACKUP_SKIPPED` | Current Save succeeded without the optional sibling backup. |
| `CSV_IMPORT_COMPLETED` | The complete selected collection import committed. |
| `CSV_HEADER_MISSING` | Add every required canonical header. |
| `CSV_REFERENCE_INVALID` | Declare the referenced model elements or correct the names. |
| `DIAGNOSTICS_TRUNCATED` | More diagnostics exist than the bounded Console publication shows. |
| `CHART_ROUTING_FALLBACK` | A relation remains visible without a proved normal route; inspect Chart geometry. |
| `CHART_IMAGE_EXPORTED` | Image save or download completed. |
| `NO_OBSERVATIONS` | Enable and populate Solver evidence before Solve. |
| `SOLVER_CANDIDATE_READY` | A reviewable candidate was produced. |
| `SOLVER_CANDIDATE_STALE` | Solve again against the current document and observations. |
| `SOLVER_CANCELLED` | The requested solve stopped without project mutation. |
| `SERVER_CONNECTED` | Server handshake and connection completed. |
| `HOSTED_MODEL_CONFLICT` | Hosted revision changed; Pull and reconcile before another Push. |
| `HOSTED_MODEL_PUSHED` | The complete client project became the hosted head. |
| `SIMULATION_SESSION_STALE` | Session remains pinned to an older revision; reset or replace it explicitly. |
| `UNKNOWN_EVENT` | Event was consumed without state change or actions; Run continues. |
| `NO_TRANSITION` | Declared event had no transition from the current state; Run continues. |
| `PREFERENCE_CORRUPT` | Invalid stored preferences were replaced with safe defaults. |
| `PRINT_FAILED` | Browser handoff or report composition failed; project state is unchanged. |

Console supplies the authoritative message and remedy for the actual occurrence. Codes are stable identifiers, not a
substitute for the associated context.

## Glossary

| Term | Meaning |
|---|---|
| Action | Inert reusable name reported during state entry or exit; never executable code. |
| Authoring draft | Editable project, which may be incomplete only by having no states or no initial state. |
| Canonical document | Strict, deterministic `1.0.0` JSON representation used for Save and hosting. |
| Chart draft | Coordinate-only visual transition with no semantic or runtime effect until configured. |
| Complete model | Valid model containing at least one state and a declared initial state. |
| Entry action | Action reported after entering a destination state or on the first execution after Reset. |
| Event | Input symbol consumed by the deterministic transition function. |
| Exit action | Action reported before leaving a source state, including a self-transition. |
| Hosted revision | Immutable canonical project snapshot identified by server revision. |
| Initial indicator | Sole UML filled dot whose optional visual attachment follows initial-state rules. |
| Initial state | Semantic state selected when a Simulator session starts or resets. |
| Observation | Typed partial evidence supplied to the Solver. |
| Partial transition table | Deterministic mapping in which some state-and-event pairs may be undefined. |
| Pinned session | Simulator session that continues using the hosted revision on which it started. |
| Revision conflict | Compare-and-set rejection because the hosted baseline changed unexpectedly. |
| Solver candidate | Immutable inferred model available for review before an explicit Apply. |
| Stale candidate | Candidate whose source document or observation revision changed. |
| Stale session | Pinned session whose semantic revision differs from the current hosted head. |
| State | Named runtime condition with ordered entry and exit action lists. |
| Terminal indicator | Chart-only UML final notation with no runtime stopping behavior. |
| Transition | Deterministic destination selected by one source-state and event pair. |

Previous: [Limits, Privacy, and Security](./limits-privacy-and-security)

Next: [Developer Guide](../developer-guide/)

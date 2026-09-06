# File and Data Contracts

Automata Lab treats JSON projects, CSV collections, browser file capabilities, and Worker messages as untrusted
boundaries. Decode and import pipelines validate a complete candidate value before they replace any document state.

The JSON codec lives in `automata-web/src/infrastructure/files/`; file-independent mappings and validation live in
`automata-web/src/domain/model/`; document lifecycle coordination lives in
`automata-web/src/application/document-workspace.ts`.

## JSON File Identity and Version

Every project file is a UTF-8 JSON object with these leading identity fields:

```json
{
  "file_id": "automata-lab-state-machine",
  "file_version": "1.0.0"
}
```

The identity distinguishes Automata Lab projects from unrelated JSON. The file version selects an exact structural and
mapping contract; it is independent of `settings.version`, which is the user's model version.

Versions `1.0.0`, `1.1.0`, and `1.2.0` are supported; the writer selects the minimum version needed by the document. A missing or incorrect identity reports `FILE_ID_INVALID`.
An absent, non-string, or unsupported file version reports `FILE_VERSION_UNSUPPORTED`. Either result leaves the active
workspace unchanged.

## JSON Schema

`automata-web/src/infrastructure/files/schema-v1.ts` defines both closed JSON Schemas. The corresponding public schemas
live beneath `automata-web/public/schema/`. The generated validator shares their common shape and explicitly forbids
attachment fields in `1.0.0`.
`npm run schema:generate` creates the checked-in validator beneath `src/infrastructure/files/generated/`, and
`npm run schema:check` fails when that generated output no longer matches the source schema.

The schema verifies required members, exact types and enums, closed object shapes, array bounds, string bounds, numeric
bounds, identifier forms, and compatible optional members before a file value reaches semantic mapping. Unknown
properties are rejected; adding a TypeScript field alone does not extend the file format.

When changing the schema, update the file mapping, semantic validator, fixtures, examples, compatibility tests,
canonical-output tests, and public reference documentation together. Regenerate the validator through the script rather
than editing generated JavaScript.

## Structural and Semantic Validation

The Open pipeline applies ordered gates:

1. Reject a file larger than 5 MiB before parsing.
2. Decode the selected bytes as UTF-8.
3. Parse with `parseStrictJson`, which detects duplicate object members before an ordinary JavaScript object can discard
   them.
4. Verify `file_id`.
5. Select the exact parser for `file_version`.
6. Validate the closed JSON Schema with the generated validator.
7. Decode file naming and compatibility fields into domain naming.
8. Validate uniqueness, references, determinism, model rules, Chart integrity, sequence rules, and capacities.
9. Replace the workspace atomically only after all blocking gates pass.

Malformed JSON, duplicate members, unknown fields, non-finite or out-of-range values, dangling references, duplicate
keys, and capacity violations therefore fail without partially importing a file. Schema failures are projected to
stable domain diagnostics with a JSON Pointer path.

Structural and semantic checks are intentionally separate. JSON Schema proves that a transition row has strings in the
required fields; domain validation proves that those strings name declared entities and that its `(state, event)` key is
unique.

## Complete and Incomplete Project Codecs

Two codecs share the same strict parse, identity, version, schema, and mapping stages:

| Codec | Successful result | Use |
|---|---|---|
| `AuthoringDocumentCodec` | Structurally and referentially sound `AuthoringDraft` | Browser Open, including zero states or a null initial state. |
| `AutomataDocumentCodec` | Fully valid `AutomataDocument` | Pull, Push, hosting, compilation, and runtime boundaries. |

The authoring codec converts only `STATE_REQUIRED` and `INITIAL_STATE_REQUIRED` completeness failures into the warning
codes `STATE_DEFINITIONS_MISSING` and `INITIAL_STATE_UNDEFINED`. It does not downgrade other errors. After an incomplete
file replaces the workspace, presentation acknowledges all missing requirements and publishes the warnings.

Save and Save As use the same persistable-draft gate. They can serialize empty states and a null initial state only after
the user chooses Save Anyway. Hosted and runnable operations always use the strict complete contract.

## Canonical Serialization

`serializeCanonicalDocument` maps domain names to the selected version's snake-case file shape and emits deterministic
JSON with:

- schema property order;
- preserved display order for arrays;
- two-space indentation;
- canonical top-left Chart coordinates;
- explicit current compatibility values and empty optional collections; and
- one trailing newline.

The serializer does not alphabetically reorder declarations, state actions, transitions, or saved sequences because
their display or execution order is meaningful. The browser adapter writes the resulting text as UTF-8.

Hosted semantic revisions use a narrower canonical projection containing only `settings` and `state_machine`. Chart
geometry and saved Solver or Simulator libraries can therefore change the complete document without changing the
semantic model revision.

Canonical serialization should be idempotent: opening canonical output and saving it without edits must reproduce the
same text. Add exact-text and round-trip tests whenever the format mapping changes.

## Version Adapters

`file-codec.ts` dispatches through maps from a supported version string to an explicit parser. The `1.0.0` decoder also
contains narrowly defined compatibility reads for earlier conforming files of that version:

- absent initial-indicator attachment defaults to the semantic initial state;
- absent terminal-indicator, terminal-relation, or draft-transition arrays become empty;
- legacy centered state coordinates are converted to top-left coordinates; and
- legacy per-state width is used only during that coordinate conversion and is not saved.

The removed `/chart/transition_anchors` member is not a compatibility field and is rejected as unknown.

Version `1.1.0` adds optional nullable `source_state` and `target_state` references to each
`/chart/draft_transitions` record. Non-null values must name declared states. Canonical output omits free references
and writes at least `1.1.0` when an endpoint is attached. Even null attachment fields are invalid in `1.0.0`;
legacy coordinates are never interpreted as attachments. The semantic hosted-content digest still excludes Chart data.

For example, this Chart draft record requires `1.1.0`:

```json
{
  "id": 0,
  "source": { "x": 150, "y": 50 },
  "target": { "x": 550, "y": 50 },
  "source_state": "state_off",
  "target_state": "state_on"
}
```

Version `1.2.0` adds two optional nullable draft fields:

| Field | Validation and meaning |
|---|---|
| `remembered_event` | Declared event name retained when a semantic transition becomes a draft. |
| `remembered_transition_index` | Zero-based table position from 0 through 49,999; requires a non-null remembered event. |

For example, this retained transition has its source attached and its target free:

```json
{
  "id": 7,
  "source": { "x": 150, "y": 50 },
  "target": { "x": 500, "y": 300 },
  "source_state": "state_off",
  "remembered_event": "event_switch",
  "remembered_transition_index": 1
}
```

Canonical Save chooses `1.2.0` whenever remembered metadata is non-null, even if both endpoints are free. Otherwise it
chooses `1.1.0` for state attachments or `1.0.0` for ordinary documents. Null optional references are omitted. A `1.0.0`
or `1.1.0` file containing either remembered field is invalid even when its value is null. Earlier schemas remain
strict; public schemas, source schemas, and the generated validator retain identical version boundaries.

The remembered event is a chart reference and participates in event rename, deletion impact, and reference validation.
Deleting its event clears both remembered fields while preserving the draft and its state attachments. State deletion
detaches affected ends at captured current coordinates. Open never restores a transition merely because a draft has
complete attachments; only an explicit endpoint completion or confirmed configuration can change the semantic table.
A future format must add a new version parser and mapping rather than weakening the current schema or guessing from
object shape. Migrate into current domain values, retain deterministic diagnostics, and keep unsupported versions
non-destructive.

## CSV Formats

CSV transfer operates on one collection and never opens, replaces, saves, or reassociates the JSON project file.

| Collection | Required columns | Notes |
|---|---|---|
| Model Metadata | `name`, `description`, `version`, `initial_state` | Uses the first non-empty data row. |
| States | `name`, `description` | Imports ordered named entities. |
| Events | `name`, `description` | Imports ordered named entities. |
| Actions | `name`, `description` | Imports ordered named entities. |
| State Actions | `state`, `action`; optional `schedule` | Missing schedule column defaults all rows to `entry`. |
| Transition Table | `state`, `event`, `next_state` | Validates state and event references before mutation. |
| Solver Observation Sequence | `name`, `type` | Types are `event`, `state`, or `action` and normalize canonical prefixes. |
| Simulator Event Sequence | `name` | Undeclared events remain valid negative-test inputs. |

Header matching ignores surrounding whitespace and case. Unknown columns are ignored, but duplicate or missing required
headers fail. The parser supports quoted fields, escaped quotes, commas, CRLF or LF records, and embedded newlines.

Exports preserve current display order, apply RFC 4180 field escaping, use canonical headers, terminate records with
CRLF, and end with one CRLF. CSV export does not change document revision, dirty state, or JSON file association.

## Import Transactions and Diagnostics

CSV import is a prepare-confirm-commit transaction:

1. Read and size-check the complete UTF-8 file.
2. Parse every record and normalize the header.
3. Validate every field, reference, duplicate, and capacity limit.
4. Build one immutable `ModelElementImport` or sequence replacement plus ordered diagnostics.
5. Inspect all collisions with the current draft.
6. Ask once whether to replace all reported collisions when confirmation is required.
7. Dispatch one revision-checked document command.

Any invalid row rejects the whole import. Cancellation, a stale revision, or command rejection also changes nothing.
Named-entity conflicts replace in place, transition conflicts replace the existing deterministic key, and new rows append
in CSV order. State-action row order and duplicates are preserved.

Model Metadata imports only the first non-empty data row and warn when later rows were ignored. Transition Table missing
references are grouped separately into missing states and missing events for accessible review. Large diagnostic sets
publish the first 100 ordered details followed by an omission summary.

Solver imports normalize `event_`, `state_`, and `action_` prefixes from the `type` column and reject conflicting
canonical prefixes. Simulator imports intentionally do not require event declarations.

## File-API Adapters

`FilePort` and `CsvFilePort` keep browser objects outside application state. The default adapters use the File System
Access API when available and fall back to an explicit file input for reads and a single browser download for writes.
Picker cancellation returns `null`; unexpected adapter failures propagate to the application boundary for diagnostics.

For JSON files, the application retains an opaque `FileAssociation`, not a browser handle. Save reuses a handle held
inside the adapter when one exists. Save As requests one JSON destination with a suggested `.json` name. If no retained
write capability exists, Save produces one current-file download.

The Save Backup preference never justifies an additional prompt or download. When the browser adapter cannot create a
sibling `.json.bak` silently, it saves the current JSON normally and returns a limitation that the application reports
as `FILE_BACKUP_SKIPPED`.

CSV selection and saving use separate adapters and never change the JSON association. File handles, document content,
and history remain volatile and are not persisted in browser storage.

Test adapters at two levels: narrow contract tests should cover capable, fallback, cancellation, oversize, and failure
outcomes; browser tests should prove the platform integration and focus-visible user workflow.

Previous: [Document and Domain Model](./document-and-domain-model)

Next: [Command Architecture](./command-architecture)

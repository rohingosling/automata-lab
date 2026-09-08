# Document and Domain Model

Automata Lab keeps one portable authoring project as the source of truth for Editor, Chart, saved Solver observations,
and saved Simulator sequences. Runtime sessions, derived routes, active Solver candidates, selection, viewport, and
Console messages are deliberately outside that document.

The public contracts are defined in `automata-web/src/domain/model/`. Treat those types and validators as the authority
for application code; do not infer persistence behavior from React component state.

## Authoring Draft

`AuthoringDraft` is the editable in-memory representation. It contains document settings, the semantic state machine,
the persisted Chart projection, and the two saved sequence libraries. Its initial-state field is `string | null` so a
new or intentionally incomplete project can exist while the user is still authoring it.

An authoring draft may have zero states and may lack an initial state. Those two conditions can be saved after an
explicit aggregate warning. All structural, metadata, uniqueness, reference, determinism, coordinate, and capacity
rules still apply: an incomplete project is not an arbitrary invalid object.

`createEmptyAuthoringDraft` creates the initial value. Document commands return replacement values rather than mutating
the current draft in place.

## Valid Document

`AutomataDocument`, also exported as `ValidDocument`, has the same overall structure but requires a non-null initial
state. Promotion from draft to valid document occurs only through semantic validation.

A valid document is required before the model can be compiled, pushed to the server, hosted, or used to create a
Simulator session. The Solver is the deliberate exception: it may consume observations while the current semantic
model is incomplete because applying a candidate replaces that model after validating the complete result.

Do not use a type assertion to bypass this boundary. If code needs a runnable document, make validation part of the
operation and handle the unsuccessful result explicitly.

## State-Machine Entities

The semantic state machine contains:

| Value | Contract |
|---|---|
| Settings | Model name, description, and Semantic Versioning value. |
| States | Ordered unique named entities. |
| Events | Ordered unique named entities. |
| Actions | Ordered unique named entities. |
| Entry actions | Ordered state-to-action mappings executed after entering a state. |
| Exit actions | Ordered state-to-action mappings executed before leaving a state. |
| Transition table | Ordered rows containing source state, event, and next state. |
| Initial state | A declared state name in a valid document; nullable only in an authoring draft. |

Transitions are deterministic by the `(state, event)` key. A missing key represents an undefined transition; the file
format does not require a complete Cartesian transition table. State-action mappings preserve order and may repeat an
action intentionally.

Names are references, so rename and deletion must traverse all typed consumers. Commands update or remove affected
state-action mappings, transition rows, the initial selection, and relevant Chart records atomically.

## Chart-Only Data

The persisted `chart` member contains authoring choices needed to reconstruct the visual projection:

| Value | Persisted meaning |
|---|---|
| Expand states | Whether Chart state nodes display their action details. |
| State placements | State name, top-left x/y position, and selected expanded height. |
| Initial indicator | Position plus a declared-state attachment or `null` for no state relation; direct indicator links are independent. |
| Terminal indicators | Stable numeric identifiers and positions for UML final-state symbols. |
| Terminal relations | Visual state-to-indicator relations. |
| Direct indicator connections | Stable ID and initial-to-terminal indicator references; visual only. |
| Draft transitions | Stable ID, endpoint coordinates, state or indicator attachments, and optional remembered event/table position. |

Terminal indicators are notation only. They do not create terminal-state membership, acceptance semantics, runtime
stopping, Simulator behavior, or Solver evidence. An unfinished draft transition likewise has no semantic effect. State-to-state completion can atomically add a transition-table row through confirmed configuration or remembered restoration; initial-to-state completion can select the semantic initial state. State-to-terminal and direct indicator completion only change visual relations. Each successful completion removes its draft in the same command.

Configured transition routes, gravity points, label rectangles, lanes, clipping, fallback state, selection, and viewport
are derived presentation data and are never serialized. Global node dimensions, grid behavior, routing preferences, and
image-export preferences are application preferences rather than per-document Chart data.

A semantic state may exist without a placement. Automatic Layout can create missing placements deterministically.

Free-space semantic endpoint release uses `detach_transition_endpoint` to replace one row with a chart draft in a single
history entry. The planner derives its event and original table index from the current transition, retaining whichever
state remains attached. The draft can then have one or both ends free. Completing its attachments through
`update_chart_draft_endpoint` restores the remembered transition automatically, using the same declaration, capacity,
and deterministic-key checks as confirmed configuration. A rejected drop preserves the complete pre-gesture draft.

Restoration inserts at the lesser of its saved index and the current table length. State/event rename updates retained
references. State deletion detaches affected ends; event deletion clears its remembered event and ordering hint without
deleting the draft. Save/Open and exact Undo/Redo preserve these lifecycle changes. Retained event data requires at least strict file
version `1.2.0`; other indicator data in the same document can require `1.3.0`. The retained event data stays outside the semantic hosted-content digest while the transition is detached.

An eventless draft endpoint can instead name an initial or terminal indicator. Completing a state/indicator pair
consumes the draft and applies the existing initial-state or terminal-relation policy atomically without an event.
If the same relation already exists, completion keeps it and removes the redundant draft without an error.
Completing an indicator pair creates a direct initial-to-terminal visual relation and leaves initial-state selection
unchanged. A wrong-end indicator drop immediately swaps the endpoint roles, points, and references, including on the first attachment. Other pairs and indicator drops from remembered-event
drafts reject the entire command. Indicator deletion releases draft references at the captured current center and
removes direct relations. These new records require file `1.3.0`; all route geometry remains derived.

## Saved Solver Sequences

`solver.sequences` is an ordered library of named observation sequences. Each record contains a name, description,
`initial`, `continuation`, or `infer` start context, and an ordered array of raw observation tokens.

The library is portable document data. The currently edited text buffer, active Worker job, progress, candidate,
candidate evidence views, and candidate staleness are application state. A generated candidate is immutable and is not
persisted unless the user confirms Apply, which uses one ordinary document command.

Solver token validation and normalization occur before inference. Saved order is significant for both the sequence
library and the tokens within a sequence.

## Saved Simulator Sequences

`simulator.sequences` is an ordered library of named event sequences. Each record contains a name, description, and an
ordered event-name array. Undeclared event names are allowed so users can preserve negative test cases.

Only this saved library belongs to the project. Connection state, the hosted snapshot, active session identifier,
current runtime state, Step cursor, transition trace, action trace, warnings, and session staleness remain transient
application or server state.

## Reference Integrity

Semantic validation checks the whole object graph. Important invariants include:

- unique state, event, action, sequence, Chart-placement, terminal-indicator, and draft-transition identities;
- a declared initial state for a valid document;
- declared state and action references in every state-action mapping;
- declared source state, event, and next state in every transition;
- at most one transition for each `(state, event)` key;
- Chart placements and visual relations that resolve to existing records;
- a non-null initial-indicator attachment equal to the semantic initial state;
- no more than one terminal-indicator relation for a state;
- finite bounded Chart coordinates and dimensions; and
- bounded, correctly classified Solver tokens.

Validation also emits non-blocking warnings for conditions such as unreachable states and unused declarations. Every
diagnostic carries a stable code, severity, source, message, remediation, and contextual path when available.

Commands should prevent invalid references at the point of mutation, while whole-document validation remains the final
promotion gate from draft to valid document.

## Revisions, Dirty State, Undo, and Redo

The document workspace associates each open draft with a positive `document_revision`, a saved baseline, and command
history. New, Open, and Pull establish revision 1 and clear history. Every successful document command increments the
revision exactly once and marks the document dirty when it differs from the baseline.

Save changes the baseline after a successful write but does not increment the document revision. Simulation and other
read-only operations also leave it unchanged. Rejected or cancelled commands change neither the revision nor history.

Undo and redo restore the complete before/after draft snapshots recorded by each command, then increment the current
revision and revalidate. They do not cross New, Open, Pull, or Close. Gesture-heavy Chart interactions coalesce their
persisted result so a completed drag, resize, or keyboard nudge becomes one document revision rather than a stream of
history entries.

Server model revisions are different values. They are SHA-256 digests of canonical semantic content used for
compare-and-set hosting and session staleness; they are not the local integer `document_revision`.

## Capacity Limits

Limits are centralized in `automata-web/src/domain/model/limits.ts` and enforced at commands, decoders, protocols, or
other relevant boundaries.

| Item | Maximum |
|---|---:|
| JSON or CSV input file | 5 MiB |
| Name | 128 Unicode code points |
| Description | 4,096 Unicode code points |
| States | 10,000 |
| Events | 256 |
| Actions | 1,000 |
| Transitions | 50,000 |
| Entry-action mappings | 50,000 |
| Exit-action mappings | 50,000 |
| Chart draft transitions | 10,000 |
| Terminal indicators | 10,000 |
| Terminal relations | 10,000 |
| Saved Solver sequences | 1,000 |
| Solver tokens across the saved library | 50,000 |
| Saved Simulator sequences | 1,000 |
| Events in one Simulator run buffer | 10,000 |

Do not duplicate these numbers in feature code. Import the shared constants or consume the narrower protocol and
configuration contract derived from them. Tests should cover both the accepted boundary and the first rejected value.

Previous: [Architecture](./architecture)

Next: [File and Data Contracts](./file-and-data-contracts)

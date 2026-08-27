# Command Architecture

Every editable project change in Automata Lab travels through one typed command system. Editor, Chart, CSV import,
Solver Apply, and saved-sequence editing do not mutate an `AuthoringDraft` directly. They describe an intent, plan its
complete effect, and commit a replacement value only if the plan is still current.

The command contracts and pure planning logic live in `automata-web/src/domain/model/commands.ts`. The application-level
workspace integration lives in `automata-web/src/application/document-workspace.ts`.

## Command Planning

`DocumentCommand` is a discriminated union whose `kind` identifies a supported mutation. Command payloads contain typed
values rather than UI controls or unvalidated property paths. Every command also carries `expectedRevision`, which
binds the intent to the document version that the user saw.

The command families cover:

| Family | Examples |
|---|---|
| Document and declarations | Update metadata; add, update, move, rename, or delete an entity. |
| State behavior | Set the initial state; add, update, move, or delete an entry or exit action. |
| Transitions | Add, update, move, or delete a deterministic transition. |
| Chart data | Place indicators, replace geometry, manage drafts, and delete a mixed selection. |
| Saved inputs | Replace Solver or Simulator sequences. |
| Bulk operations | Import model elements or apply an immutable Solver candidate. |

`planDocumentCommand` validates the command against the current `DocumentEditorState`. A successful plan contains the
original command, a complete `resultingDraft`, and an immutable `CommandImpactSummary`. A failure returns a specific
code such as `REVISION_MISMATCH`, `ENTITY_EXISTS`, `REFERENCE_INVALID`, or `TRANSITION_EXISTS` and no candidate state.

Planning is intentionally separate from execution. A presentation workflow may show the impact summary, request
confirmation, or cancel without recalculating or partially applying the operation.

## Atomic Mutation

`executeDocumentCommand` accepts a previously produced plan. It verifies that the plan still matches the current
revision, then replaces the draft as one transaction. A successful commit:

1. installs the complete planned draft;
2. increments the document revision once;
3. updates the Solver-input revision when applicable;
4. appends one history entry;
5. clears the redo stack;
6. recalculates validation and dirty state; and
7. returns a new immutable editor state.

No observer can see a half-renamed model, a transition without its declaration, or only part of a Chart deletion.
Failure, cancellation, an invalid reference, or a stale revision leaves the current state and history unchanged.

Application code uses `planWorkspaceDocumentCommand` and `commitWorkspaceDocumentCommand` so the same operation also
updates workspace validation status. Keep new mutation policy in the domain planner; do not reproduce it in a React
event handler or adapter.

## Reference Cascades

Names are typed references throughout the document. Renaming a declaration traverses every affected consumer rather
than performing text replacement. Deletion calculates a bounded impact across declarations, state-action mappings,
transitions, the initial selection, Chart placements and indicators, saved Solver tokens, and saved Simulator events.

`CommandImpactSummary` reports counts for each affected category. This gives confirmation dialogs a stable description
of the operation before it commits. The planned `resultingDraft` is the authority; the dialog does not reconstruct the
cascade from those counts.

Deleting the initial state deliberately leaves `initialState: null`, producing an incomplete but persistable authoring
draft. It does not guess a replacement. Deleting a state also removes its dependent transition rows, state-action rows,
and Chart references in the same command.

## Editor and Chart Parity

Editor and Chart are two projections of the same draft, not separate model owners. Semantic Chart actions dispatch the
same command kinds as their textual equivalents:

| Chart interaction | Shared command behavior |
|---|---|
| Drop a State | Adds the semantic state and its initial placement together. |
| Edit a state | Uses the entity update or rename path. |
| Configure a draft transition | Adds a semantic transition and removes the complete draft atomically. |
| Move a semantic endpoint | Uses `update_transition` after validating the new deterministic key. |
| Delete semantic items | Uses the same cascade planner as Editor. |

Presentation policy may differ. Editor shows an impact confirmation before semantic deletion; Chart deletion is
immediate. Both execute the same validated plan and create one undo entry. Chart-only commands manage persisted visual
data such as coordinates, UML terminal indicators, and unconfigured drafts, but they still use the shared revision and
history infrastructure.

## Revision Checks

`documentRevision` is a monotonic local edit counter. Every command records the revision it expects, and planning fails
when that value differs from the current editor state. This prevents a dialog, pointer gesture, worker result, or async
adapter response from overwriting an intervening edit.

Solver Apply has an additional `expectedSolverRevision`. A candidate captures both baselines when inference starts and
may replace the model only while both still match. An edit to saved Solver evidence can therefore stale a candidate
even when unrelated document state appears similar.

Revision checks are optimistic concurrency guards, not persistence identifiers. They are volatile workspace state and
are not serialized into project JSON. Hosted server revisions use a separate canonical semantic hash.

## Undo and Redo

Each successful commit appends a `DocumentHistoryEntry` containing the command kind and the complete before/after draft
values. Undo installs the `before` value; redo installs the `after` value. Both operations create a new current revision
and revalidate the restored draft.

This snapshot-based history preserves exact ordering, duplicate action assignments, Chart coordinates, draft IDs, and
cascade effects without inventing fragile inverse commands. New edits after Undo clear the redo stack. The dirty flag
compares the current draft with `cleanDraft`, so undoing back to the saved baseline clears dirty state naturally.

Keep transient presentation state out of history. Selection, focus, viewport, Console messages, open dialogs, active
Solver jobs, hosted snapshots, and Simulator sessions do not belong in a document history entry.

## Testing Commands

Test command behavior at the pure domain boundary first. For every new command or command branch, cover:

- the successful plan and exact resulting draft;
- the impact summary when references cascade;
- stale revision rejection;
- invalid references, duplicates, bounds, and deterministic-key conflicts;
- atomic failure with the original state unchanged;
- Undo and Redo round trips; and
- validation, dirty-state, and Solver-revision effects.

Add application tests for confirmation and workspace coordination, then component or browser tests for the user-facing
interaction. Where Editor and Chart expose the same semantic operation, assert equivalent final document state rather
than maintaining two independent policy suites.

Previous: [File and Data Contracts](./file-and-data-contracts)

Next: [State Chart Architecture](./state-chart-architecture)

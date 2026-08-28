# Console and Diagnostics

Console is Automata Lab's single durable message view for application, validation, file, CSV, Chart, Solver, server, and
Simulator activity. It replaces separate diagnostic and server logs and keeps operation outcomes available after a
dialog closes or the active page changes.

Show or hide Console through **View → Console**, its panel-close control, or the responsive **Console** region control.
Visibility and panel height are application preferences; entries are volatile and are not written into project files.

## Message Severities

Every row contains local time in `hh:mm:ss`, severity, a stable code, source, concise text, and, when safe, a context
action. Rows use an open treatment without horizontal separators or cell grid lines.

| Severity | Normal accent | Use |
|---|---|---|
| Message | Green, with M and Message text | Successful operations and ordinary lifecycle information. |
| Warning | Blue, with W and Warning text | Recoverable limitations, incomplete work, or conditions needing review. |
| Error | Red, with E and Error text | Failed operations, invalid input, or unavailable required services. |

Color is supplemental. Symbols, severity text, codes, sources, and message text remain available in both themes and
forced-colors mode.

## Filtering Messages

The title bar contains **Messages**, **Warnings**, and **Errors** checkboxes. Turn a filter off to hide that severity and
turn it on to show retained matching rows again. Filtering never deletes history or prevents new entries from being
recorded.

**Follow Tail** defaults on and keeps the newest visible row in view. Turn it off before reviewing or copying earlier
entries so a new message does not move the view. The same preference is available in Application Settings.

Within the Console grid, use Up and Down Arrow to move one row, Home and End to reach the first or last visible entry,
and Ctrl+C or Command+C to copy the focused row as tab-separated time, severity, code, source, and text. Enter or Space
activates an available context action.

## Clearing the Console

Choose **Clear** to remove the retained displayed history. Clearing does not change the project, undo or redo a command,
cancel a worker, disconnect the server, close a session, or resolve the condition that produced a diagnostic.

Filters and Clear affect only the current in-memory Console. Reload begins a new Console with `SHELL_READY` and any
preference-recovery warning detected during startup.

## Validation Diagnostics

Validation diagnostics identify the affected path or entity and a useful remedy. Blocking structural and integrity
errors leave the current operation unchanged. Completeness warnings for zero states or a missing initial state allow the
specific Open, Save, and Print workflows described elsewhere but continue to block compilation, Push, and simulation.

Use a row's context action when present to navigate to the relevant Editor, Chart, Solver, or Simulator page. Critical
errors may also open a modal acknowledgement; the corresponding Console entry remains after dismissal.

Validation is transactional. A failed rename, deletion plan, CSV import, Open, Pull, Push, Solver Apply, or Chart command
does not apply a valid prefix before reporting later errors.

## File and CSV Diagnostics

File diagnostics distinguish parsing, identity, schema, version, reference, capacity, read, write, and browser-capability
failures. Common application codes include:

| Code | Meaning |
|---|---|
| `FILE_OPENED` | A project replaced the client document successfully. |
| `FILE_SAVED` | Canonical JSON was written or downloaded successfully. |
| `FILE_BACKUP_SKIPPED` | Save Backup was enabled, but the adapter could not create a silent sibling backup. |
| `JSON_MALFORMED` | The input is not valid strict JSON. |
| `DUPLICATE_JSON_MEMBER` | One JSON object repeats a member name. |
| `FILE_VERSION_UNSUPPORTED` | The JSON file contract is not supported. |
| `CSV_IMPORT_COMPLETED` | One validated collection import committed atomically. |
| `CSV_FILE_TOO_LARGE` | The CSV exceeds the 5 MiB input limit. |
| `CSV_READ_FAILED` or `CSV_WRITE_FAILED` | The browser adapter could not complete I/O. |

CSV errors preserve row order in their diagnostics. Transition Table reference failures group missing states separately
from missing events, while the modal summary keeps those bounded lists selectable and copyable.

## Server and Simulator Diagnostics

Server entries report connection, readiness, worker instance, hosted revision, conflicts, Pull or Push outcomes, and
recovery without logging complete hosted documents or protocol payloads. Useful codes include `SERVER_CONNECTED`,
`SERVER_DISCONNECTED`, `HOSTED_MODEL_PULLED`, `HOSTED_MODEL_PUSHED`, and `HOSTED_MODEL_CONFLICT`.

Simulator entries identify session creation, reset, closure, staleness, unknown events, missing transitions, request
failure, and worker recreation. `UNKNOWN_EVENT` and `NO_TRANSITION` are warnings: the event is consumed, the current
state is retained, no action is emitted, and Run continues. Restarting the built-in worker produces a new instance and
invalidates prior sessions; Console records the recovery rather than implying those sessions survived.

## Solver Diagnostics

Solver diagnostics cover token normalization, contradictory observations, capacity, cancellation, worker failure,
candidate completion, replay verification, staleness, and Apply. A failure or cancellation never mutates the project or
partially publishes a candidate.

Typical hard-evidence codes include `MULTIPLE_STATES_IN_INTERVAL`, `DETERMINISM_CONFLICT`, `INITIAL_STATE_CONFLICT`, and
`ACTION_WORD_CONFLICT`. `NO_OBSERVATIONS` means there is no evidence from which to infer a candidate. `SOLVER_CANCELLED`
and `SOLVER_FAILURE` distinguish an intentional cancellation from a failed worker or job.

Candidate inference reports contain model-specific justification and replay coverage; Console provides the bounded
operation summary and navigation rather than duplicating the complete report.

## Diagnostic Limits

Console retains the newest 1,000 entries and evicts the oldest first. Large lists are progressively rendered so retained
history does not require every row to be mounted at once.

One diagnostic publication contributes at most 100 individual entries, followed when necessary by one
`DIAGNOSTICS_TRUNCATED` omission summary. This is a display and logging bound, not permission to apply the first 100
items of a failed operation; the underlying command remains atomic.

Codes, identifiers, and source names are limited to 256 Unicode code points, timestamps to 64, and message text and
context labels to 4,096. Truncation includes its visible marker within the limit. Complete models, Solver observations,
event buffers, hosted documents, sessions, and traces are never copied into Console entries.

Previous: [Accessibility](./accessibility)

Next: [Troubleshooting](./troubleshooting)

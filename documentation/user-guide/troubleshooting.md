# Troubleshooting

Start with the first blocking dialog and the newest matching Console entry. The dialog explains the immediate decision;
Console preserves the diagnostic code, source, context, and remedy after the dialog closes. Retrying without resolving
that condition does not bypass validation or partially apply an operation.

## Project Will Not Open

Open reads at most 5 MiB of UTF-8 JSON and validates the complete project before replacement. The current project stays
open when the selected file is malformed, repeats a JSON member, has the wrong `file_id` or `file_version`, contains an
unknown property, exceeds a capacity, or has an invalid or dangling model reference.

Use the reported JSON path and code to correct the source file. Do not remove a field merely because it is unfamiliar:
compare the file with the [JSON file reference](./files-and-data-exchange#automata-lab-json-files) and the published
`1.0.0` schema. A project with no states or no initial state is permitted when everything else is sound; acknowledge the
incomplete-project warning and finish it in Editor.

If the browser reports `FILE_READ_FAILED`, confirm that the file is still available and readable, then select it again.
Automata Lab never repairs or imports the valid prefix of a rejected file.

## Project Will Not Save

Save requires a structurally and referentially sound authoring project. Choose **File → Validate State Machine** and fix
invalid names, versions, duplicate transition keys, dangling references, non-finite Chart geometry, or exceeded limits.
Zero states and a missing initial state are the only completeness conditions that may be accepted through **Save
Anyway**.

`FILE_WRITE_FAILED` means the browser adapter could not finish the requested write or download. Use **Save As** to choose
a new destination, verify browser download permissions and free space, and retry. `FILE_BACKUP_SKIPPED` is only a
warning: the current JSON was still written once, but that browser could not silently create the optional sibling
`.json.bak`.

Cancellation is not a failure. If no file appears after a download fallback, check the browser's downloads list and
configured download location; the application cannot reveal a path that the browser withholds.

## Push or Simulator Commands Are Disabled

Push and Simulator commands require more than an open draft. Check these conditions in order:

1. A project is open and passes complete validation, including at least one state and an initial state.
2. The server status is **Connected** and ready, with no server operation already pending.
3. The client knows the current hosted revision. Pull or reconnect when that baseline is unknown.
4. For Simulator Run, Step, and Reset, a session exists and the required sequence or event is selected.

A Push can also stop at a compare-and-set conflict when the hosted revision changed after the client baseline was read.
Pull and review the hosted project, or deliberately reconcile the local work before attempting another Push. Automata
Lab does not overwrite an unexpected hosted revision silently.

## Solver Produces No Candidate

Confirm that at least one enabled observation sequence contains valid Event, State, or Action tokens and that the chosen
start contexts match the evidence. Choose **Validate Sequences** before Solve. `NO_OBSERVATIONS` means there is no usable
evidence; grammar, capacity, or hard-evidence codes identify a more specific rejection.

Contradictory hard observations cannot be smoothed or discarded. For example, two explicit states in one interval,
incompatible entry-action words, different destinations for the same known state and event, or conflicting initial
states must be corrected in the observations. The Solver may merge compatible evidence and invent disclosed hidden
states, but it will not invent evidence that resolves a contradiction.

Cancellation and `SOLVER_FAILURE` leave the project unchanged. Correct the input or wait for worker recovery, then run
Solve again.

## Solver Candidate Is Stale

A candidate is tied to the document revision and observation revision from which it was inferred. Any semantic project
edit or observation change makes the candidate stale. Chart-only presentation changes can be rebased only when they do
not change that evidence.

Review or discard the stale result, then choose Solve again. Apply never silently rebases a semantic candidate and never
replaces a project when either baseline has changed.

## Chart Layout or Routing Fails

Automatic Layout rejects an interactive projection above 1,000 nodes or 10,000 relations. Reduce the Chart or edit the
model textually when that boundary is reached. A layout worker failure leaves the current geometry visible and does not
commit cleanup or a partial layout.

Routing is bounded and may publish `CHART_ROUTING_FALLBACK` when a route cannot be proved clear within its search limits.
The relation remains visible with diagnostic styling, and Editor still exposes the exact semantic transition. Try
moving crowded states apart, increasing **Route Obstacle Offset** within its allowed range, running Automatic Layout, or
removing unnecessary visual obstacles. There is no reduced-quality routing mode to select.

If editing becomes hard to see, use **Fit Chart**, zoom out, or use Editor and Transition Table. Viewport changes do not
alter saved Chart geometry or routing inputs.

## Worker Recovery

Solver, Chart layout/routing, and the built-in server use separate browser workers. A timeout, malformed response,
uncooperative cancellation, or crash terminates the affected worker so stale output cannot mutate the project.

- Solver recovery clears running work and any unpublished result; run Solve again.
- Chart-worker recovery preserves the visible preview and recomputes after the next relevant request.
- Server-worker recreation starts a new instance, reloads the bundled light-switch project, and closes earlier sessions.

Disconnect is different from recreation: it preserves the live built-in worker's hosted revision and sessions. Review
the Console code before assuming that reconnecting will recover a session.

## Printing Problems

Printing requires an open project but permits an incomplete one after its warning. If the browser print dialog does not
appear, dismiss another modal or pending print operation and try again. Check browser pop-up and print permissions, then
select an available printer or **Save to PDF** destination in the browser-owned dialog.

`PRINT_FAILED` or a State Chart capture error leaves the project unchanged. Reduce the diagram bounds or simplify a very
large Chart, confirm that the State Chart section can be rasterized within its fixed print cap, or temporarily exclude
that section in Page Setup. For clipping or excess pages, verify paper, orientation, and all four margins before changing
report sections.

## Browser Capability Limitations

Automata Lab's core model workflows do not require the optional File System Access API. Without it, Save, CSV export,
and image export use explicit browser downloads and cannot retain or reveal a filesystem association. Silent sibling
backups are unavailable, so Save Backup records `FILE_BACKUP_SKIPPED` without causing a second download.

Print destinations, file pickers, download locations, clipboard permission, and operating-system key bindings are
browser-owned and can differ. Use a current supported desktop browser, allow user-initiated downloads and pop-ups for
the application origin, and retry from an explicit command rather than an automated browser gesture.

## Reporting a Problem

Search the [Automata Lab issues](https://github.com/rohingosling/automata-lab/issues) before opening a new report. Include:

- the Automata Lab version from the title bar or About dialog;
- browser name, version, operating system, zoom, and forced-colors or reduced-motion state when relevant;
- exact steps, expected result, and observed result;
- the Console severity, code, source, and bounded message; and
- a minimal sanitized project or CSV only when it contains no private information.

Do not publish credentials, personal data, private models, complete hosted payloads, local paths, or screenshots that
expose unrelated content. A diagnostic code and minimal reproduction are usually more useful than a full Console dump.

Previous: [Console and Diagnostics](./console-and-diagnostics)

Next: [Limits, Privacy, and Security](./limits-privacy-and-security)

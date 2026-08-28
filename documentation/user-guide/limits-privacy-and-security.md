# Limits, Privacy, and Security

Automata Lab keeps authoring, inference, hosting, and simulation bounded and explicit. Project content is untrusted
input, remains volatile by default, and crosses a file, print, clipboard, or server boundary only through a user command.

## Product Scope and Non-Goals

The `1.0.0` release provides deterministic state transducers with ordered state entry and exit actions, a partial
transition table, visual authoring, constrained passive inference, a browser-local server, and revision-pinned
simulation.

It does not provide arbitrary action execution, nondeterministic or probabilistic runtime behavior, guards, timers,
history states, hierarchical UML statecharts, orthogonal regions, collaboration, authentication, telemetry, or a
production remote server. Actions are inert names. Terminal Chart indicators are visual notation and do not stop the
Simulator or create terminal-state semantics.

The Solver returns a deterministic candidate consistent with supplied evidence; it does not promise a unique or
globally minimal machine. The built-in `builtin://` server is an in-browser worker. A future HTTP adapter is an extension
boundary, not a dormant remote service in this release.

## Model and File Limits

The principal hard limits are:

| Resource | Maximum |
|---|---:|
| JSON or CSV input | 5 MiB |
| Name | 128 Unicode code points |
| Description | 4,096 Unicode code points |
| States | 10,000 |
| Events | 256 |
| Actions | 1,000 |
| Transitions | 50,000 |
| Entry mappings | 50,000 |
| Exit mappings | 50,000 |
| Terminal indicators, terminal relations, or Chart drafts | 10,000 each |
| Solver sequences | 1,000 |
| Solver tokens in the saved sequence library | 50,000 |
| Simulator sequences | 1,000 |
| Events in one Simulator sequence or Run request | 10,000 |

The built-in server accepts a canonical hosted document and protocol payload only up to the same 5 MiB bound, supports
at most 64 live sessions, and retains the newest 50,000 entries in each session trace. Console retains the newest 1,000
entries and publishes at most 100 individual diagnostics from one result before an omission summary.

Limits are checked before mutation or at the relevant worker boundary. Exceeding one rejects the complete operation;
it does not import, host, solve, or execute the valid prefix.

## Solver and Chart Limits

The Solver is intended for bounded experimental evidence. A solve can consume at most 1,000 saved sequences and 50,000
tokens, remains cancellable, and runs away from the main UI thread. Larger or contradictory evidence is rejected with a
bounded diagnostic rather than sampled or silently discarded.

The interactive Chart and Automatic Layout accept at most 1,000 nodes and 10,000 relations. One routing generation is
further bounded to 500 relations, 250 route obstacles and 250 label obstacles per relation, and 16 preferred points per
relation. Search time, graph size, output size, and worker traffic are also capped. A failed, timed-out, cancelled, or
stale result cannot replace the visible preview or mutate the project.

Raster Chart export checks the configured 1–1,000 **Maximum Megapixels** value before Canvas allocation. SVG is vector
but remains bounded by Chart-element limits. These limits are safety boundaries, not quality settings.

## Local Browser Storage

Durable browser storage contains only one versioned allowlist of non-content application preferences, such as theme,
panel sizes, Chart presentation, export choices, server URL, and print settings. Unknown or invalid preference data is
ignored or replaced with safe defaults and reported in Console.

Project models, file handles, Undo/Redo history, Solver observations and candidates, hosted documents, sessions, traces,
and Console history are not persisted in local storage, IndexedDB, or caches by Automata Lab. They remain in page or
worker memory until reload or close unless you explicitly Save, download, Print, or Copy them.

The browser may independently retain static application assets, download history, print history, or ordinary browsing
data under its own settings. Automata Lab does not install a Service Worker or claim permanent offline availability.

## Network Behavior

Normal application use makes no automatic content upload. The built-in server, Solver, layout, and routing workers run
within the loaded application origin. After the required static application and documentation assets load, authoring,
inference, built-in hosting, simulation, and local search require no third-party runtime service.

The release bundles its required scripts, styles, icons, fonts, search data, schemas, examples, and notices locally. It
does not require a runtime CDN, hosted search, remote font, advertising endpoint, or analytics service. Explicitly
following a link to GitHub or another named destination is ordinary browser navigation, not project upload.

## Telemetry Policy

Automata Lab includes no telemetry, analytics, advertising, tracking, or automatic crash-report submission. It does not
send models, observations, candidates, traces, Console entries, filenames, or preferences to the project maintainer.

If you report a problem, you choose what to include. Sanitize examples and screenshots first, and prefer the smallest
model and relevant diagnostic code.

## Untrusted File Handling

JSON and CSV inputs are treated as untrusted text. Automata Lab:

- rejects oversized input before parsing;
- detects malformed JSON, duplicate members, unknown properties, forbidden prototype keys, invalid types, and non-finite
  numbers;
- validates every reference, unique key, name, version, coordinate, and capacity before mutation;
- parses CSV with bounded quoted-field support and validates every row before one atomic import;
- renders imported strings as text rather than HTML; and
- never evaluates a model action or imported string as JavaScript.

Open, CSV import, Solver Apply, Pull, and Push are transactional. Malformed input, cancellation, conflict, timeout, or
worker failure leaves the prior accepted state intact. Exported SVG contains inert text and no scripts, event handlers,
or external active content.

## License Information

Automata Lab is released under the [MIT License](https://github.com/rohingosling/automata-lab/blob/main/LICENSE). The
About dialog provides the application licence, Fluent icon licence, and release information. The static artifact also
carries the lockfile-derived third-party runtime notice and Microsoft Fluent UI System Icons notice.

Project files you create remain your content. The application licence does not make a project public or upload it; you
control whether to save, copy, print, share, or publish that content.

Previous: [Troubleshooting](./troubleshooting)

Next: [User Reference](./user-reference)

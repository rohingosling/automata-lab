# Architecture

Automata Lab is a static browser application organized around a conventional dependency rule: presentation and
adapters depend inward on application and domain policy. The domain remains independent of React, the DOM, browser
storage, workers, transport, and graph libraries.

This separation keeps state-machine behavior deterministic and directly testable while still allowing browser-specific
capabilities to vary by platform.

## System Context

Automata Lab runs several cooperating components inside one browser page.

| Component | Responsibility | Runtime boundary |
|---|---|---|
| React client | Owns the volatile authoring workspace and presents all user workflows. | Main browser thread. |
| Solver Worker | Infers and verifies one immutable candidate from saved observations. | Dedicated Worker. |
| Chart-routing Worker | Calculates derived routes and label positions without mutating the document. | Dedicated Worker. |
| Built-in server | Hosts immutable revisions and revision-pinned Simulator sessions. | Dedicated Worker. |
| Browser file APIs | Read and write explicitly selected JSON, CSV, and image files. | Browser capability boundary. |
| Preference storage | Retains only allowlisted application preferences. | Browser storage boundary. |
| GitHub Pages | Serves the application and documentation as static files. | Hosting boundary; no application backend. |

The built-in `builtin://` gateway does not make a network request. It nevertheless implements an HTTP-shaped gateway
contract so a future remote adapter can replace the transport without moving server policy into presentation code.

## Presentation Layer

`automata-web/src/presentation/` contains React components, interaction handling, focus management, responsive
composition, and semantic styling. Its feature areas include the application shell, fixed navigation tree, Editor,
Chart, Solver, Simulator, Console, dialogs, and printable reports.

Presentation receives immutable values and dispatches typed intents. It may translate a pointer gesture or keyboard
operation into a command request, but it does not:

- validate or mutate a document directly;
- calculate rename or delete cascades;
- parse JSON or CSV;
- run a state-machine transition;
- infer a Solver candidate;
- hash a hosted revision; or
- communicate with a raw Worker or file handle.

This rule gives visual and textual command surfaces the same application behavior. For example, Editor and Chart may
present deletion differently, but both dispatch the same domain command plan.

## Application Layer

`automata-web/src/application/` coordinates use cases and owns workflow state that does not belong in the portable
document. This includes the active document revision, dirty baseline, undo and redo history, validation summary, Solver
job and candidate state, server synchronization state, Simulator session reference, and bounded Console channel.

Application modules coordinate operations such as:

- New, Open, Save, Save As, Pull, Push, and Close;
- command planning, confirmation, commit, undo, and redo;
- CSV import and export;
- Solver job lifecycle and candidate application;
- server connection, conditional replacement, and recovery;
- Simulator session creation and execution;
- Chart layout, routing, status, and image export;
- preference transactions; and
- immutable print-report capture.

The application layer calls pure domain functions and typed ports. It does not import React, manipulate the DOM, or
select a concrete browser adapter.

## Domain Layer

`automata-web/src/domain/` contains browser-independent policy. The principal areas are:

| Area | Responsibility |
|---|---|
| `model/` | Document contracts, validation, commands, diagnostics, limits, and canonicalization. |
| `runtime/` | Compilation and deterministic transition execution. |
| `solver/` | Observation parsing, normalization, constrained merging, replay, and candidate evidence. |

Domain functions accept values and return values. They do not read global state, persist data, render UI, or post
messages. This makes domain behavior suitable for unit and property testing without a browser.

The domain distinguishes an editable `AuthoringDraft` from a fully valid `AutomataDocument`. That type boundary prevents
incomplete authoring data from being treated as hostable or runnable merely because it has the same broad shape.

## Infrastructure and Data Layer

`automata-web/src/infrastructure/` implements the volatile and external boundaries declared by the application. Its
adapters include:

| Adapter family | Implementation responsibility |
|---|---|
| `files/` | Strict JSON, schema validation, browser file selection, canonical save, and CSV transfer. |
| `preferences/` | Versioned, allowlisted application-preference persistence and corruption recovery. |
| `solver/` | Solver Worker creation, correlation, cancellation, progress, and recovery. |
| `server/` | Built-in server gateway, request correlation, timeouts, and lifecycle events. |
| `chart/` | ELK layout, routing Worker coordination, reuse caches, and image composition. |
| `hashing/` | SHA-256 content revisions over canonical semantic content. |
| `printing/` | Browser print-dialog handoff for an isolated report. |

`automata-web/src/workers/` contains the Worker entry points and the built-in server implementation.
`automata-web/src/protocol/` contains the immutable message contracts shared across those boundaries.

An adapter may depend on application ports and domain serialization contracts, but it must not leak browser-specific
objects into domain values.

## Dependency Direction

The permitted compile-time direction is:

| From | May depend on | Must not depend on |
|---|---|---|
| Presentation | Application contracts and presentation utilities | Domain repositories, raw Workers, file handles, transport details |
| Application | Domain modules and application ports | React, the DOM, concrete browser adapters |
| Domain | Other domain modules | React, the DOM, storage, transport, Workers, graph libraries |
| Infrastructure | Application ports and domain serialization contracts | Presentation components |

Keep imports within these boundaries. Expose stable feature entry points where a feature is shared, and extract common
code only when it represents a genuine shared concept. A broad miscellaneous utility module makes ownership and
dependency review harder.

## Application Composition

`automata-web/src/main.tsx` is deliberately small: it locates the document root and mounts `Application` under React
Strict Mode. `Application.tsx` composes the shell, application workspaces, and default browser adapters.

The `ApplicationProperties` boundary also allows tests to supply controlled ports. A component or application test can
therefore replace file, preference, print, Solver, server, clock, identity, hashing, layout, or routing behavior without
changing domain policy or using the real browser capability.

Keep composition at this outer boundary. Feature components should receive the state and callbacks they need rather
than constructing infrastructure services internally.

## Immutable Values and Commands

Portable documents, hosted snapshots, Solver candidates, protocol messages, traces, diagnostics, and view models are
treated as immutable exchange values. A document change goes through a named command with an expected revision:

1. Presentation dispatches an intent.
2. Application builds a typed command.
3. Domain planning checks the revision, references, limits, conflicts, and complete impact without mutation.
4. Presentation requests confirmation when the plan requires it.
5. Domain execution produces the replacement draft and inverse data.
6. Application commits once, increments the revision once, updates history and dirty state, and revalidates.

Any stale revision, invalid reference, duplicate deterministic key, cancelled confirmation, or failed adapter operation
leaves the document unchanged. A rename traverses typed references; it is never implemented as an unrestricted string
replacement.

## Ports and Adapters

Application ports live beneath `automata-web/src/application/ports/` or with the feature contract they support. Major
ports include file and CSV access, document decoding, preferences, printing, Solver jobs, server operations, hashing,
time, UUID generation, Chart layout, and Chart routing.

Use a port when a capability is external, browser-specific, asynchronous, replaceable, or nondeterministic. Keep the
port expressed in application or domain values. For example, `FilePort` exchanges text, byte counts, portable file
associations, and canonical documents; it does not expose `FileSystemFileHandle` to the application.

When adding an adapter:

- implement an existing application-facing contract where possible;
- validate all data crossing the boundary;
- keep cancellation, timeout, correlation, and recovery behavior explicit;
- return immutable plain data instead of platform objects; and
- add narrow contract tests before relying on a browser workflow test.

Previous: [Public Repository Structure](./public-repository-structure)

Next: [Document and Domain Model](./document-and-domain-model)

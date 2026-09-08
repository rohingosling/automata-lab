# Server and Simulator Architecture

Automata Lab separates authoring from execution. The React client owns the editable document, while a dedicated built-in
server Worker owns one hosted document and the Simulator sessions created from it. The client reaches that Worker only
through a transport-neutral application gateway.

This boundary keeps hosted revisions immutable, makes session behavior independent of later client edits, and leaves a
future remote transport possible without moving server policy into presentation components.

## Server Gateway

`automata-web/src/application/server-contracts.ts` defines `ServerGateway`. Its methods express application operations:
connect, disconnect, test, get or conditionally replace the hosted document, start or operate a session, restart, and
dispose. Callers exchange immutable document, revision, session, trace, warning, and structured-failure values rather
than URLs, Worker messages, or browser objects.

`server-workspace.ts` coordinates those methods with client state. It tracks connection and readiness, the last known
hosted revision, synchronization with the local document, and one active session reference. React dispatches these use
cases and renders their returned state; it does not decode transport envelopes or advance a machine.

## Built-in Worker Transport

`BrowserServerWorkerGateway` implements the gateway for `builtin://server`. It creates a persistent dedicated Worker,
correlates pending requests, applies timeouts, validates every outbound message, and reports lifecycle or connection
loss through bounded callbacks.

Disconnect is a client operation: it rejects pending requests and clears the client connection without discarding the
Worker's hosted document or sessions. Reconnecting to the same Worker refreshes its identity and readiness. Explicit
restart, a Worker failure, or connecting to a different supported built-in URL destroys that transport generation; a
fresh Worker reloads the bundled light-switch document and invalidates prior session references.

The adapter never falls back to running the server engine on the main thread. An unsupported URL or unavailable Worker
API is a visible gateway failure.

## Protocol Envelopes

The Worker protocol version is `automata-lab-server/1`. Each request has an exact discriminated shape containing the
protocol, kind, request identifier, operation, conditional model revision, session identifier, and payload. Supported
operations are:

| Family | Operations |
|---|---|
| Handshake and health | `server.hello`, `health.live`, `health.ready` |
| Hosted document | `model.get`, `model.put` |
| Simulation | `simulation.start`, `simulation.run`, `simulation.step`, `simulation.reset`, `simulation.close` |

Success and error responses correlate the request. Lifecycle, diagnostic, and model-changed events use the same
strictly increasing server sequence. The protocol codecs reject extra keys, malformed identifiers, invalid revisions,
oversized values, and operation-specific field mismatches at both ends of the Worker boundary.

The client may retry read-only handshake, health, and get operations once with a fresh request identifier after a
timeout. It never blindly replays a hosted replacement or session mutation.

## Hosted Revisions

The server stages a replacement before changing its hosted pointer. Staging strictly decodes the complete canonical
document, validates it, compiles the runtime model, and calculates its semantic SHA-256 revision. A failure leaves the
previous hosted snapshot intact.

The snapshot contains the canonical complete document, decoded valid document, compiled runtime model, and semantic
revision. The revision digest covers canonical `settings` plus `state_machine` content. Chart geometry and saved Solver
or Simulator sequences remain part of the hosted document, but changing only those auxiliary sections does not change
the semantic revision or make existing sessions stale.

## Compare-and-Set Updates

`model.put` supplies the client's expected hosted revision. The Worker serializes requests and replaces the hosted
pointer only when that expected revision still matches. A mismatch returns a conflict and current revision without
mutating the hosted document.

An exact complete-document repeat is idempotent. A different complete document may replace the hosted pointer even when
its semantic revision is unchanged because only auxiliary content changed. Compare-and-set therefore detects semantic
concurrency, not auxiliary-only edits with the same semantic digest.

If Put times out, the gateway reads the hosted document. Exact canonical equality confirms the replacement; any other
outcome remains uncertain and requires an explicit Pull and review.

## Pull and Push

Push begins from an immutable local document snapshot and requires a complete valid model. The application predicts the
semantic revision, sends the canonical complete document with the expected hosted baseline, and accepts the result only
if the local snapshot is still current. Successful Push updates synchronization state but does not rewrite local
history.

Pull retrieves the canonical hosted document, enforces the file-size cap, decodes it through the strict document codec,
recomputes the semantic revision, and rejects any mismatch between content and claimed revision. Document replacement
then follows the ordinary dirty-document decision flow; transport success alone never bypasses local replacement
guards.

## Pinned Sessions

Starting a session captures the current immutable hosted snapshot and its semantic revision. The session begins at the
initial state with initial entry actions pending. Later model publication can mark that session stale, but it cannot
change the state, runtime model, or traces already pinned to it.

Session state is server-owned. The client retains only the session identifier, pinned revision, and latest returned
snapshot. Rebinding is explicit: close the old session and start a new one. A stale session remains operable against its
original snapshot.

The Worker bounds live sessions, event-buffer size, trace length, remembered request identifiers, and diagnostics.
Session records contain copied runtime values rather than references to client data.

## Runtime Semantics

Only the server Worker imports the pure runtime functions that advance a session. Reset selects the initial state,
clears traces and processed-event count, and leaves initial entry actions pending without emitting them. The first Run
or Step emits those entry actions once before normal event processing.

For a transition, execution emits the source state's ordered exit actions, changes state, then emits the destination's
ordered entry actions. Unknown events and defined events without transitions are consumed with warnings and do not stop
Run. Step consumes at most one buffered event; Run consumes the submitted buffer within protocol limits.

Saved Simulator sequences remain ordinary document data. The editable event text and Step cursor are client state, but
the current machine state and all runtime effects come only from Worker snapshots.

## Trace Handling

Each session keeps bounded transition and action traces plus a processed-event count. When a trace exceeds its capacity,
the repository retains the newest entries and exposes `traceTruncated`. Reset clears both traces; Close removes the
session.

The main thread validates every returned session identifier and pinned revision before accepting a snapshot. Runtime
warnings, staleness, truncation, and lifecycle outcomes are summarized in the shared Console instead of copying full
event buffers, documents, or traces into diagnostics. The Simulator page renders the latest snapshot and has no parallel
diagnostic store.

## Disconnect, Restart, and Recovery

Late Worker messages are suppressed through request, Worker-generation, and monotonic-sequence checks. A connection
loss rejects every pending operation and clears client connection and active-session state. It does not silently switch
to local execution.

Reconnect preserves state only when it reaches the same still-live built-in Worker instance. Restart is deliberately
destructive to volatile server state: it creates a new instance, reloads the bundled example, and closes every old
session. Callers must refresh hosted status and explicitly create a replacement session.

## Future HTTP Adapter Boundary

The application gateway is shaped so a future HTTP adapter can implement the same methods, failure values, revision
checks, and session semantics. No HTTP adapter or remote server ships with the current application. Adding one must keep
transport details in infrastructure, validate the same bounded contracts, and preserve the application's Pull, Push,
timeout, conflict, and session-recovery behavior.

Previous: [Solver Architecture](./solver-architecture)

Next: [Presentation Architecture](./presentation-architecture)

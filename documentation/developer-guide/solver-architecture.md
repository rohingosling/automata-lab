# Solver Architecture

The Solver performs deterministic passive inference from typed observation sequences. It produces one reproducible,
reviewable candidate that satisfies all hard evidence; it does not claim to recover the uniquely correct machine or a
globally minimal one.

Pure parsing, normalization, inference, canonicalization, and replay live in `automata-web/src/domain/solver/`. Worker
transport and job lifecycle stay outside that domain policy.

## Observation Model

A saved observation has a name, a `startContext`, and an ordered list of raw token strings. Parsing classifies each token
as an event, state, or action and records its original token index for diagnostics and provenance.

Accepted classifier forms include lowercase, title-case, and uppercase `Event`, `State`, or `Action` followed by an
underscore, hyphen, or whitespace separator, plus compact title-case forms. The parser canonicalizes classifiers to the
`event_`, `state_`, and `action_` namespaces while preserving the suffix.

An event token begins a transition step. State and action tokens before the first event describe the starting context;
those after an event describe its destination. State and action tokens may be interleaved, but action order is preserved.

`startContext` has three distinct values:

| Value | Meaning |
|---|---|
| `initial` | The leading interval constrains the candidate's initial state. |
| `continuation` | The sequence continues from a compatible context rather than declaring a fresh initial trace. |
| `infer` | The Solver chooses a compatible attachment and reports weak support where relevant. |

## Normalization

Normalization converts parsed tokens into event-delimited `NormalizedSolverInterval` values. Each interval contains an
incoming event or `null`, an optional explicit state, a complete ordered entry-action word, and its source token range.

The action word is complete evidence. No observed actions means the state's entry-action list is empty; it does not mean
telemetry is missing. Two different explicit states in one interval are a hard conflict. Repeated observations of the
same state must agree on their complete action word.

All diagnostics retain sequence and token ranges. Normalization never drops a conflicting observation, invents a
repair, or chooses one source silently. A failed normalization ends the job before inference.

## Evidence Graph

Inference builds a prefix-style evidence graph from normalized sequences. Nodes represent observed contexts and carry:

- an optional explicit state identity;
- a complete ordered entry-action word;
- outgoing observed event edges;
- start-context constraints; and
- sequence/token provenance.

Nodes forced equal by repeated prefixes or explicit state identity are unified first. Determinism can imply additional
destination unifications. Conflicting names, action words, initial constraints, or transition destinations reject the
relevant construction instead of weakening the evidence.

The evidence graph is a positive partial model. A missing `(state,event)` observation remains undefined and does not
generate a rejection state, catch-all transition, success state, or Finalize event.

## Constrained State Merging

The production algorithm uses deterministic red-blue-style constrained state merging. A proposed merge is evaluated on
a temporary partition and accepted only when its complete closure remains consistent:

1. distinct explicit state names never unify;
2. each resulting state has exactly one complete entry-action word;
3. each `(state,event)` key has at most one destination;
4. every destination merge implied by determinism also succeeds;
5. initial-state constraints remain compatible; and
6. the observations remain replayable.

Compatibility is therefore recursive. A locally plausible pair is rejected when its outgoing edges force a later hard
conflict. Accepted and rejected decisions are recorded for statistics and the inference report.

The Solver infers entry actions only. Candidate exit-action lists are empty because the observation language provides no
sound evidence for them.

## Deterministic Ordering

Equivalent input must produce byte-for-byte stable candidate structure and review data. Canonical ordering uses observed
access paths, declared evidence order, Unicode code-point comparison, and explicit stable tie-breaks rather than Map
iteration accidents or Worker timing.

Merge scoring prefers stronger shared compatible evidence, fewer generated states, and fewer weak attachments. Named
states retain their observed names. Unnamed states receive collision-free `state_generated_NNNN` names in deterministic
traversal order.

Events, actions, state-action rows, transitions, provenance, coverage, and report entries are canonicalized before the
candidate crosses the Worker boundary. Do not introduce randomization, locale-dependent comparison, or wall-clock data
into inference.

## Candidate Generation

A successful result contains an immutable `SolverCandidate` with:

| Member | Purpose |
|---|---|
| `stateMachine` | Complete valid semantic replacement, including empty exit-action lists. |
| `chart` | Deterministic initial projection for reviewing and applying the replacement. |
| Baseline revisions | Document and Solver-input revisions captured when the job began. |
| `provenance` | Observed/generated identities and source ranges for states and transitions. |
| `traceCoverage` | Per-sequence normalized intervals and their replayed candidate states. |
| `inferenceReport` | Structured assumptions, merges, provenance, conflicts, and summary entries. |
| `statistics` | Observation, token, evidence, candidate, transition, and merge counts. |
| `consistencyStatement` | The bounded claim established by replay verification. |

Candidate Apply is a separate document command. It preserves project settings and saved Solver/Simulator sequences,
replaces the semantic state machine, and installs the candidate Chart projection in one undoable revision. It does not
change the hosted server until the user explicitly Pushes.

## Replay Verification

`replaySolverObservation` evaluates every normalized sequence against the candidate. Replay checks explicit states,
complete entry-action words, observed event destinations, and start-context behavior. It returns the traversed state
names or the first structured diagnostic.

Inference must replay all hard observations successfully before presenting a candidate. The application independently
revalidates the returned candidate and its baselines before Apply. Replay coverage in the review UI is therefore
evidence of the consistency claim, not a second heuristic score.

Keep replay pure and independent of the Simulator runtime. Solver observations describe destination entry-action words;
Simulator execution additionally emits source exit actions and operates on a hosted revision.

## Worker Protocol

Solver inference runs in a dedicated terminable Worker. The main thread sends an exact, bounded solve envelope containing
the protocol version, job ID, and immutable `SolverInferenceRequest`. That request includes the document revision,
Solver-input revision, and observation values.

Worker messages are exact-key decoded and correlated by job ID. Progress reports bounded stage/count information rather
than mutable partial candidates. Completion contains either one validated immutable result or a structured failure.
Malformed, oversized, mismatched, or unexpected messages are rejected at the adapter boundary.

The Solver Worker is independent of the built-in server and Chart-routing Workers. It shares no mutable repository,
session, cache, or lifecycle with either one.

## Cancellation and Recovery

The application owns at most one active Solver job. Starting a replacement job, choosing Cancel, timing out, receiving
an invalid message, or encountering a Worker error disposes of the current Worker generation. A subsequent solve starts
with a fresh instance.

Cancellation and failure never mutate the document or publish a partial candidate. Late messages are ignored through
job and generation correlation. A prior complete candidate remains immutable but becomes stale whenever its captured
document or Solver-input revision no longer matches the workspace.

Expose failures through bounded diagnostics and Console messages. Do not fall back to running inference synchronously on
the main thread, and do not reuse the server Worker as an emergency execution path.

## Solver Limitations

Finite positive observations underdetermine a hidden state machine. The Solver therefore has explicit boundaries:

- it does not guarantee a unique or globally smallest machine;
- it never repairs, smooths, discards, or probabilistically ranks conflicting evidence;
- it does not infer exit actions;
- it leaves unobserved transitions undefined;
- it may generate hidden states only when needed and reports them;
- it does not create protocol-oriented Finalize, success, or invalid entities; and
- it cannot apply a candidate whose baselines are stale or whose replacement fails complete document validation.

New inference heuristics must preserve hard constraints, deterministic output, structured provenance, replay success, and
the worker boundary. If a change broadens the claim made by `consistencyStatement`, update the public contract and tests
with the implementation.

Previous: [State Chart Architecture](./state-chart-architecture)

Next: [Server and Simulator Architecture](./server-and-simulator-architecture)

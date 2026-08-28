# Developer Reference

This chapter is a compact lookup for Automata Lab's public development contracts. The earlier Developer Guide chapters
explain ownership, invariants, and workflows in context; this page collects commands, identities, bounds, codes, and
terms that are useful during implementation and review.

When a summary here and an executable contract disagree, treat the checked-in package metadata, types, schema, codecs,
and tests as the implementation evidence, then update the affected guide in the same change.

## npm Commands

Use the exact Node.js and npm versions declared by each package, install with `npm ci`, and run application commands
from `automata-web/` unless the command uses the `documentation` prefix shown below. Lifecycle hooks run automatically:
`dev` first checks icons and schema and builds the hardened documentation preview, while `build` checks icons, schema,
and the runtime notice.

### Application development and build

| Command | Purpose |
|---|---|
| `npm run dev` | Start the loopback application server and same-origin hardened documentation preview. |
| `npm run preview` | Serve the completed application artifact locally. |
| `npm run typecheck` | Run TypeScript without emitting JavaScript. |
| `npm run lint` | Run ESLint across the application package. |
| `npm run build` | Build and verify the application artifact. |
| `npm run build:pages` | Build and verify the combined application/documentation Pages artifact. |
| `npm run test:artifact` | Verify an existing application artifact. |
| `npm run verify` | Run application, locked documentation, combined-artifact, and browser gates. |

### Application tests

| Command | Purpose |
|---|---|
| `npm run test:unit` | Run the complete Vitest suite. |
| `npm run test:model` | Run model, runtime, Solver-domain, application, and infrastructure suites. |
| `npm run test:server` | Run server contracts, gateway, workspace, Worker, and shell integration tests. |
| `npm run test:solver` | Run Solver domain, workspace, Worker, and shell integration tests. |
| `npm run test:shell` | Run presentation and shell tests. |
| `npm run test:performance` | Run the general performance suite. |
| `npm run test:routing-performance` | Run the exact Chart routing benchmark suite. |
| `npm run test:browser:install` | Install Playwright's Chromium, Firefox, and WebKit browsers. |
| `npm run test:browser` | Run the complete Playwright browser suite. |
| `npm run test:accessibility` | Run the focused Playwright accessibility specification. |

### Generated contracts and audits

| Command | Purpose |
|---|---|
| `npm run schema:check` | Verify that the generated file-schema validator matches its source. |
| `npm run schema:generate` | Regenerate the checked-in file-schema validator. |
| `npm run icons:check` | Verify the selected Fluent icon set, manifest, and hashes. |
| `npm run icons:import -- --source <directory>` | Refresh selected icons from a complete local Fluent collection. |
| `npm run audit:runtime` | Verify the production dependency closure and committed runtime notice. |
| `npm run audit:runtime:write` | Regenerate the runtime notice, which must then be reviewed. |
| `npm run audit:advisories:offline` | Check cached production advisories without network access. |
| `npm run chart:lock` | Deliberately restamp the Chart algorithm lock after an approved change. |

The Chart lock command is not a formatting or routine update command. Read
[State Chart Architecture](./state-chart-architecture) before changing locked layout or routing sources.

### Documentation package

| Command | Purpose |
|---|---|
| `npm --prefix documentation run dev` | Start the VitePress authoring server. |
| `npm --prefix documentation run build` | Build and CSP-harden the standalone documentation site. |
| `npm --prefix documentation run build:combined` | Build hardened documentation beneath the application artifact's `docs/` directory. |
| `npm --prefix documentation run test` | Build and verify routes, links, fragments, search, CSP, local assets, and leakage gates. |
| `npm --prefix documentation run preview` | Serve the completed documentation artifact locally. |
| `npm --prefix documentation run audit:dependencies` | Verify the locked documentation closure and committed dependency inventory. |
| `npm --prefix documentation run audit:dependencies:write` | Regenerate the dependency inventory, which must then be reviewed. |

See [Testing](./testing), [Building and Deployment](./building-and-deployment), and
[Writing the Documentation](./writing-the-documentation) for gate selection and artifact integration.

## File-Format Reference

| Item | Contract |
|---|---|
| Encoding | UTF-8 JSON, bounded to 5 MiB before parsing. |
| Identity | `file_id: "automata-lab-state-machine"`. |
| Version | `file_version: "1.0.0"`; independent of the user's model version. |
| Required sections | `settings`, `state_machine`, `chart`, `solver`, and `simulator`. |
| Structure | Closed JSON Schema; unknown properties and duplicate JSON members are rejected. |
| Semantics | Unique names and identifiers, valid references, deterministic transition keys, and bounded collections. |
| Canonical output | Schema order, preserved meaningful array order, two-space indentation, and one trailing newline. |
| Public schema | `automata-web/public/schema/automata-lab-state-machine-1.0.0.schema.json`. |

`AuthoringDocumentCodec` accepts a structurally and referentially sound draft with zero states or no initial state and
returns explicit completeness warnings. `AutomataDocumentCodec` requires a complete valid model and owns Pull, Push,
hosting, compilation, and runtime boundaries. Neither codec silently repairs invalid input.

The source schema is `automata-web/src/infrastructure/files/schema-v1.ts`; its generated validator is checked in beneath
`src/infrastructure/files/generated/`. See [File and Data Contracts](./file-and-data-contracts) for validation order,
compatibility reads, canonical serialization, and adapter behavior.

## CSV Reference

| Collection | Canonical header | Import behavior |
|---|---|---|
| Model Metadata | `name,description,version,initial_state` | Apply the first non-empty row; warn about later rows. |
| States | `name,description` | Replace collisions in place and append new declarations in row order. |
| Events | `name,description` | Replace collisions in place and append new declarations in row order. |
| Actions | `name,description` | Replace collisions in place and append new declarations in row order. |
| State Actions | `state,action,schedule` | Preserve order and duplicates; absent `schedule` means `entry`. |
| Transition Table | `state,event,next_state` | Replace the same deterministic key; validate all references first. |
| Solver Observation Sequence | `name,type` | Accept `event`, `state`, or `action` and canonicalize the prefix. |
| Simulator Event Sequence | `name` | Preserve undeclared events as intentional negative-test input. |

Header matching ignores case and surrounding whitespace. Unknown columns are ignored, but duplicate or missing required
headers fail. Import accepts quoted fields, escaped quotes, commas, embedded newlines, and CRLF or LF records. Export
uses RFC 4180 escaping, canonical column order, CRLF records, and one final CRLF.

Every import validates the complete candidate before one revision-checked command. Invalid rows, rejected collision
confirmation, cancellation, or a stale revision leave the document unchanged.

## Server Protocol Reference

The built-in Worker protocol is `automata-lab-server/1`. Every request contains exactly these seven keys:
`protocol`, `kind`, `requestId`, `operation`, `conditionalModelRevision`, `sessionId`, and `payload`.

| Family | Operations |
|---|---|
| Negotiation and health | `server.hello`, `health.live`, `health.ready` |
| Hosted document | `model.get`, `model.put` |
| Simulation lifecycle | `simulation.start`, `simulation.reset`, `simulation.close` |
| Simulation execution | `simulation.run`, `simulation.step` |

Success and error responses correlate their request. Unsolicited `server.lifecycle`, `server.diagnostic`, and
`model.changed` events carry a strictly increasing server sequence. Both sides reject unknown keys, malformed values,
operation-specific shape mismatches, and oversized payloads.

Only the idempotent hello, health, and model-read operations may be retried automatically after timeout. A timed-out
`model.put` is reconciled through a fresh read; session mutations are never replayed blindly. `model.put` uses
compare-and-set against the expected semantic model revision.

See [Server and Simulator Architecture](./server-and-simulator-architecture) for revision hashing, pinned sessions,
runtime semantics, recovery, and the future HTTP adapter boundary.

## Configuration Reference

| Owner | Location and responsibility |
|---|---|
| Compile-time configuration | `src/configuration/compile-time-configuration.ts`: defaults, bounds, tuning, and switches. |
| Application preferences | Typed content-independent allowlist projected from central defaults. |
| Domain limits | `src/domain/model/limits.ts`: file, model, Solver, and sequence capacities. |
| Interactive Chart limits | `src/application/chart-layout-limits.ts`: accepted node and relation counts. |
| Server protocol limits | `src/workers/server/protocol.ts`: payload, session, trace, request, and diagnostic bounds. |
| Vite configuration | `automata-web/vite.config.ts`: application base path and production build behavior. |
| Documentation configuration | `documentation/.vitepress/config.mts`: docs base path, navigation, and local search. |

Use `DEFAULT_APPLICATION_PREFERENCES` wherever a consumer needs a preference default. Do not repeat a default or bound
in a component, dialog, adapter, or test helper. Developer diagnostic switches are compile-time, non-persisted values;
they do not belong to application settings or project files.

See [Configuration and Preferences](./configuration-and-preferences) for the persistence envelope, recovery, and
transaction rules.

## Capacity Limits

| Resource | Maximum |
|---|---:|
| JSON or CSV input; server document or payload | 5 MiB |
| Name or Solver token | 128 Unicode code points |
| Description | 4,096 Unicode code points |
| States | 10,000 |
| Events | 256 |
| Actions | 1,000 |
| Transitions, entry mappings, or exit mappings | 50,000 each |
| Terminal indicators, terminal relations, or Chart drafts | 10,000 each |
| Solver sequences; Simulator sequences | 1,000 each |
| Solver tokens across the saved library | 50,000 |
| Events in one Simulator sequence or server Run request | 10,000 |
| Interactive Chart nodes; relations | 1,000 nodes; 10,000 relations |
| Built-in live sessions; retained entries in one trace | 64 sessions; 50,000 entries |
| Console history; details from one diagnostic result | 1,000 entries; 100 details plus summary |

Worker routing and output bounds add narrower per-request protections. See
[Limits, Privacy, and Security](../user-guide/limits-privacy-and-security) for the user-facing limit contract and
[Security and Privacy](./security-and-privacy) for boundary enforcement.

## Diagnostic Codes

Codes are stable identifiers for tests, support, and Console filtering. The accompanying severity, source, message,
path or context, and remediation remain part of the diagnostic; do not branch on human-readable message text.

| Family | Representative codes |
|---|---|
| Document and validation | `DOCUMENT_INVALID`, `STATE_REQUIRED`, `INITIAL_STATE_REQUIRED`, `DETERMINISM_CONFLICT` |
| JSON and file I/O | `JSON_MALFORMED`, `DUPLICATE_JSON_MEMBER`, `FILE_SCHEMA_INVALID`, `FILE_READ_FAILED` |
| CSV | `CSV_HEADER_MISSING`, `CSV_REFERENCE_INVALID`, `CSV_CAPACITY_EXCEEDED`, `CSV_IMPORT_COMPLETED` |
| Commands and Chart | `COMMAND_INVALID`, `REVISION_MISMATCH`, `CHART_ROUTING_FALLBACK`, `CHART_IMAGE_EXPORTED` |
| Solver | `NO_OBSERVATIONS`, `ACTION_WORD_CONFLICT`, `SOLVER_CANDIDATE_READY`, `SOLVER_CANDIDATE_STALE` |
| Server and revisions | `SERVER_PROTOCOL_FAILURE`, `HOSTED_MODEL_CONFLICT`, `HOSTED_MODEL_PUSHED`, `PULL_REVISION_MISMATCH` |
| Simulator | `SIMULATION_SESSION_STALE`, `UNKNOWN_EVENT`, `NO_TRANSITION`, `SIMULATION_TRACE_TRUNCATED` |
| Preferences and print | `PREFERENCE_CORRUPT`, `PREFERENCE_SAVE_FAILED`, `PRINT_FAILED` |
| Console bounding | `DIAGNOSTICS_TRUNCATED` |

Add a code at the layer that owns the condition, keep its spelling stable, localize presentation text separately, and
test severity plus transactional outcome. See [Console and Diagnostics](../user-guide/console-and-diagnostics) and
[User Reference](../user-guide/user-reference#common-diagnostic-codes) for the common user-facing lookup.

## Glossary

| Term | Developer meaning |
|---|---|
| Authoring draft | Editable project that may lack states or an initial state but remains structurally sound. |
| Canonical document | Deterministic strict `1.0.0` JSON used for Save and complete-document boundaries. |
| Command plan | Immutable validated description of one atomic, revision-checked document mutation. |
| Derived scene | Presentation-only Chart geometry computed from document data and preferences. |
| Hosted revision | Immutable hosted snapshot identified by the semantic hash of settings and state machine. |
| Partial transition function | Deterministic mapping in which an unlisted state-and-event pair remains undefined. |
| Port | Application-owned capability contract implemented by infrastructure or a test adapter. |
| Pinned session | Server-owned Simulator session that keeps the hosted snapshot on which it started. |
| Solver candidate | Immutable inferred model requiring review and explicit confirmed application. |
| Stale result | Worker, candidate, command, or response whose source revision no longer matches. |
| Transactional boundary | Operation that commits its complete validated result or leaves prior state unchanged. |
| Worker generation | Identity used to reject late messages from a replaced Solver, Server, layout, or routing Worker. |

The [User Reference glossary](../user-guide/user-reference#glossary) defines model and interface terms such as action,
Chart draft, initial indicator, terminal indicator, transition, and stale session.

Previous: [Contributing](./contributing)

Next: [Licenses and Acknowledgements](./licenses-and-acknowledgements)

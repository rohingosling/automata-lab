# Security and Privacy

Automata Lab is a static, local-first browser application. Its security model treats project files, CSV files, names,
descriptions, Worker messages, and stored preferences as untrusted input. Its privacy model keeps user content in
memory
unless the user explicitly opens, saves, downloads, prints, or copies it.

No client-only application can make hostile input safe by convention alone. The repository therefore enforces the same
boundaries in codecs, application transactions, presentation, Workers, browser policy, tests, and production-artifact
inspection.

## Trust Boundaries

The principal boundaries are:

| Boundary | Required treatment |
|---|---|
| JSON and CSV input | Bound bytes and collections, parse strictly, validate completely, then commit atomically. |
| Presentation | Insert user content as text; never interpret names or actions as markup or code. |
| Worker messages | Decode exact envelopes again on receipt and correlate every response. |
| Browser capabilities | Use explicit file, download, clipboard, print, and storage adapters. |
| Built artifact | Allow only reviewed files and scan content for leakage before release. |

Domain actions are inert names. The application does not evaluate them, execute scripts from them, or transform them
into HTML. UUIDs and request identifiers provide correlation and stale-response protection; they are not credentials or
authentication tokens.

## Untrusted JSON and CSV

Project Open first enforces the file-size limit and parses JSON with duplicate-member and forbidden-key detection. The
version dispatcher, generated JSON Schema validator, explicit codecs, referential checks, and completeness checks each
own a distinct validation stage. Unknown fields, malformed values, unsupported versions, duplicate identifiers,
dangling references, and exceeded limits are rejected before document replacement.

CSV readers treat file names, headers, cells, and line structure as untrusted text. They bound input, parse quoted
data,
validate every row, collect a bounded ordered diagnostic set, and prepare one collision plan. No valid prefix of a bad
file is applied. Confirmation commits the complete valid import as one undoable command.

Do not repair hostile or malformed input silently. Return structured diagnostics with safe paths or identifiers and
leave the previous document unchanged.

## Prototype-Pollution Protection

JSON and Worker decoders reject `__proto__`, `prototype`, and `constructor` where they could alter object semantics.
They require ordinary own data properties, reject inherited or accessor-backed values, and validate arrays for density,
length, and element type.

This protection must happen before spreading, assigning, or mapping an untrusted object. TypeScript types do not
validate
runtime messages, and `structuredClone` does not replace exact-key decoding. New protocol fields require synchronized
encoders, decoders, limits, and hostile-input tests on both sides of the boundary.

## Content Security Policy

`automata-web/index.html` supplies a restrictive same-origin Content Security Policy. Scripts load from the application
origin, objects, frames, and form submission are disabled, and `unsafe-eval` is absent. Images, fonts, media, and
Workers
allow only the local schemes required by application-generated data and bundled Worker modules.

Inline styles remain allowed because React and the current UI libraries require them; inline script does not. Localhost
WebSocket allowances support local development and preview, not a shipped remote service. The production artifact test
checks the complete reviewed directive set, and the browser security test proves dynamic evaluation is rejected without
breaking ordinary workflows.

If a dependency requires a wider directive, treat that as a security-design change. Document the need, keep the grant
as
narrow as possible, and update artifact and runtime tests with the dependency review.

## Worker Boundaries

Automatic layout, transition routing, Solver inference, and the built-in Server run in dedicated Workers. Each boundary
uses a versioned or discriminated protocol with bounded identifiers, operation-specific payloads, exact keys, and
validated results.

Gateways correlate requests, enforce timeouts, ignore stale generations, and suppress late messages. Cancellation or
Worker failure cannot mutate a draft. Solver candidates are copied and frozen before review; Server revisions and
session snapshots are immutable; routing results apply only to the document revision and request that produced them.

Workers receive only the data needed for their operation. Diagnostics summarize safe identifiers and dispositions
rather than returning complete models, observation sets, event buffers, traces, or malformed payload text.

## Storage Restrictions

The only automatic durable browser record is the versioned, content-independent application-preference allowlist in
`localStorage`. It may contain theme, shell layout, Chart presentation choices, print setup, and the built-in Server
URL.
It must not contain model data, file handles, Solver observations or candidates, Simulator buffers or traces, hosted
documents, Console entries, or user credentials.

The application does not use IndexedDB, Cache Storage, or `sessionStorage` for content. Missing, inaccessible,
malformed,
or unsupported preference storage falls back to central defaults with a bounded warning where appropriate. It never
causes project content to be copied into another persistence mechanism.

Open, Save, Save As, CSV transfer, Chart image export, Print, and Copy are explicit user actions. Capability adapters
keep cancellation and unavailable-browser fallbacks transactional.

## Network Restrictions

Normal runtime behavior uses same-origin static GET requests for the application, assets, notices, examples, and Worker
bundles. The built-in Server is a local Web Worker behind the `builtin://` gateway; Pull, Push, and Simulator commands
do
not upload a document to an HTTP service.

The release includes no telemetry, analytics, advertising, tracking, hosted search, remote fonts, CDN dependency, or
automatic content upload. VitePress local search and documentation assets are bundled with the site.

Adding a future HTTP Server adapter changes the trust boundary. It must be explicit to the user, preserve the gateway's
validation and transactional semantics, define credential handling separately, and update CSP, privacy documentation,
runtime-network tests, and threat analysis before release.

## Logging and Redaction

The shared diagnostic channel bounds every retained field, every published diagnostic batch, and the total number of
Console entries. When a batch exceeds its display limit, it emits a truncation summary instead of flooding the UI.
Oldest entries are evicted when the retained-entry limit is reached.

Diagnostics may include an operation, stable code, safe entity or request identifier, outcome, and remediation. They
must not include a complete document, raw malformed file, observation corpus, candidate, event buffer, session
snapshot,
trace, file handle, credential, or full protocol payload. Worker lifecycle events and correlation failures follow the
same rule.

Rendered Console text remains selectable and accessible but is never HTML. Do not rely on presentation truncation to
protect a sensitive value; redact at the publisher or protocol owner before creating the entry.

## Artifact Leakage Prevention

Production builds disable source maps and compile routing performance instrumentation out. The artifact verifier then
checks an allowlisted directory and file inventory, expected hashed bundles, content types, size budgets, CSP, schemas,
examples, icons, notices, and license closure.

It rejects source and test directories, source maps, caches, user-data folders, environment or key files, private
metadata, local development paths, source-map directives, embedded PEM material, and identifying performance-counter
tokens. Textual formats are scanned regardless of whether they are HTML, JavaScript, CSS, JSON, SVG, XML, or notices;
binary PNG assets receive signature and credential checks.

The documentation build has its own required-route, local-search, source-map, and private-source scan. A release must
run
both package gates and inspect the combined Pages artifact. Promotion rules are an additional publication boundary, not
a substitute for build-time leakage checks.

Previous: [Testing](./testing)

Next: [Building and Deployment](./building-and-deployment)

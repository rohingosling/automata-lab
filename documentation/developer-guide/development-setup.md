# Development Setup

Automata Lab keeps the application and documentation in separate Node packages with committed lockfiles. Install and
run each package from the public repository root so commands remain easy to reproduce in local development and
automation.

## Prerequisites

Install these tools before cloning the repository:

- Git;
- Node.js `24.15.0`;
- npm `11.12.1`; and
- the operating-system libraries required by Playwright's Chromium, Firefox, and WebKit builds when running browser
  tests.

The exact Node.js and npm versions are declared in both package manifests. Use those versions when producing release
evidence. The package lockfiles pin JavaScript dependencies; do not replace `npm ci` with an unlocked install in a
verification workflow.

The public repository contains the curated Fluent icons required to build and run Automata Lab. Access to a complete
external Fluent icon collection is necessary only when deliberately changing that curated subset.

## Cloning the Public Repository

Clone the repository and enter its root directory:

```powershell
git clone https://github.com/rohingosling/automata-lab.git
cd automata-lab
```

The remaining examples in this guide run from that directory. They use npm's `--prefix` option to select a package
without relying on terminal-specific directory changes.

## Installing Dependencies

Install the application and documentation dependency graphs independently:

```powershell
npm --prefix automata-web ci
npm --prefix documentation ci
```

`npm ci` requires the manifest and lockfile to agree, removes an existing package-local `node_modules` directory, and
installs the exact locked graph. Review and commit both `package.json` and `package-lock.json` whenever an intentional
dependency change modifies either file.

Playwright browser binaries are versioned separately from npm packages. Before the first browser-test run on a clean
machine, install the browsers pinned by the package-local Playwright version:

```powershell
npm --prefix automata-web run test:browser:install
```

That command can require network access when its matching browser cache is absent. Ordinary application and
documentation builds use repository assets and do not download runtime content.

## Starting the Development Server

Start the integrated application and documentation authoring surface:

```powershell
npm --prefix automata-web run dev
```

The command verifies the curated icons and generated JSON-schema validator, builds and hardens the current
documentation, then starts the application and documentation preview on loopback-only ports. The application remains
at `/automata-lab/`; its same-origin `/automata-lab/docs/` proxy makes **Help → Documentation** use the same URL as
the combined production artifact. One **Ctrl+C** stops both processes.

When actively writing guide prose, use VitePress's hot-reload authoring server separately:

```powershell
npm --prefix documentation run dev
```

That server binds only to `127.0.0.1`. It is a development-only tool: do not expose it through a network interface,
reverse proxy, tunnel, or port-forward, and stop it when the authoring session ends.

## Running a Production Preview

Build and preview the combined Pages artifact at its production base path:

```powershell
npm --prefix automata-web run build:pages
npm --prefix automata-web run preview
```

The combined builder audits the application, places the hardened documentation beneath `dist/docs/`, verifies that no
application file changed, and checks every documentation route and notice. Follow the URL printed by Vite and test the
application, **Help → Documentation**, documentation home, both guide entries, local search, direct nested routes, and
browser reload.

A documentation-only build and preview remains available for focused guide review:

```powershell
npm --prefix documentation run build
npm --prefix documentation run preview
```

## Common Development Commands

Run application commands with `npm --prefix automata-web run <script>`.

| Script | Purpose |
|---|---|
| `dev` | Build the guides, then start the application and same-origin documentation preview. |
| `schema:check` | Verify that the generated JSON-schema validator is current. |
| `schema:generate` | Regenerate the validator after an intentional schema change. |
| `icons:check` | Verify the curated Fluent icon names and hashes. |
| `typecheck` | Run strict TypeScript checks without emitting files. |
| `lint` | Run ESLint across source, tests, scripts, and configuration. |
| `test:unit` | Run the complete Vitest inventory. |
| `test:model` | Run model, runtime, application, and infrastructure suites. |
| `test:solver` | Run Solver-focused suites. |
| `test:server` | Run server and server-workspace suites. |
| `test:shell` | Run presentation-shell suites. |
| `test:performance` | Run reference performance tests. |
| `test:routing-performance` | Run the dedicated Chart-routing benchmark. |
| `test:browser` | Run Playwright in Chromium, Firefox, and WebKit. |
| `test:accessibility` | Run the dedicated browser accessibility suite. |
| `audit:runtime` | Verify the locked production closure and runtime notices offline. |
| `audit:advisories:offline` | Query only advisory data already available in npm's local cache. |
| `build` | Build and audit the application production artifact. |
| `build:pages` | Assemble and verify the combined application/documentation Pages artifact. |
| `test:artifact` | Audit an already-built application artifact. |
| `verify` | Run every application, documentation, artifact, performance, and browser gate. |

The repository-root `build.bat` performs a clean application install, installs the pinned Playwright browsers, and runs
the complete application verification workflow while preserving the first failing exit status.

Documentation commands use `npm --prefix documentation run <script>`:

| Script | Purpose |
|---|---|
| `dev` | Start the loopback-only VitePress hot-reload authoring server. |
| `audit:dependencies` | Verify the locked documentation dependency inventory. |
| `audit:dependencies:write` | Regenerate that inventory after a reviewed lockfile change. |
| `build` | Audit dependencies and generate the hardened documentation site. |
| `test` | Build and verify routes, search, notices, CSP, and artifact-safety rules. |
| `preview` | Serve the generated documentation at its production base path on loopback. |

## Editor Recommendations

Use an editor with TypeScript language-service support, ESLint integration, and Markdown preview. Configure it to
preserve UTF-8 text, respect the repository's existing line endings, and avoid format-on-save rules that rewrite
unrelated files.

Treat generated files deliberately. Update the JSON-schema validator only through `schema:generate`, update the Chart
algorithm lock only through `chart:lock` after an approved algorithm change, and never edit production `dist`
directories or installed `node_modules` content.

Previous: [Introduction](./)

Next: [Public Repository Structure](./public-repository-structure)

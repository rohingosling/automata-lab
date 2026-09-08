# Public Repository Structure

The public repository contains the source, locked metadata, tests, curated assets, examples, and documentation needed to
build and review Automata Lab. Generated output and internal project-management material are not part of that source
surface.

## Application Package

`automata-web/` is the application package. Its main paths are:

| Path | Responsibility |
|---|---|
| `src/` | TypeScript and React application source. |
| `public/` | Static schema, notices, release notes, and project-owned icons copied into the build. |
| `tests/` | Unit, property, component, worker, browser, accessibility, and performance tests. |
| `scripts/` | Deterministic schema, icon, dependency, algorithm-lock, and artifact tooling. |
| `index.html` | Vite application entry document. |
| `package.json`, `package-lock.json` | Exact application commands and locked dependency graph. |
| `vite.config.ts` | Static build, repository base path, and curated-icon emission. |
| `tsconfig.json` | Strict TypeScript compiler contract. |
| `eslint.config.js` | JavaScript, TypeScript, React, and script lint rules. |
| `vitest*.{ts,mjs}` | General, performance, and routing-benchmark test configurations. |
| `playwright.config.ts` | Cross-browser, visual, responsive, and accessibility configuration. |

The source tree follows the application's dependency direction:

| Source area | Role |
|---|---|
| `presentation/` | React views, dialogs, navigation, Chart rendering, printing, and accessible interaction. |
| `application/` | Use cases, workspaces, revision checks, diagnostic coordination, and ports. |
| `domain/` | Model, validation, commands, runtime, and Solver policy independent of browser frameworks. |
| `infrastructure/` | Browser files, preferences, hashing, Chart adapters, printing, Solver, and server gateways. |
| `workers/` | Solver, Chart-routing, and built-in server worker entry points and server implementation. |
| `protocol/` | Typed messages shared across worker and server boundaries. |
| `configuration/` | Compile-time defaults, bounds, preferences, and diagnostic switches. |
| `localization/` | User-facing message resources. |

`src/main.tsx` is the browser entry point, and `src/Application.tsx` composes the shell. Later architecture chapters
explain the layer boundaries and runtime composition in detail.

## Documentation Package

`documentation/` is an independent VitePress package. Public guide Markdown lives in `user-guide/` and
`developer-guide/`; `.vitepress/config.mts` owns the final subpath, navigation, local search, and theme configuration.
The package-local `scripts/verify-documentation.mjs` checks stable route output, search generation, source-map exclusion,
and basic forbidden-content rules.

Documentation dependencies are development-only build tools. The emitted site bundles the scripts, styles, and local
search data required for reading beneath `/automata-lab/docs/`; it does not depend on a hosted search provider or a
runtime content service.

## Examples and Assets

The public source surface keeps examples and shared assets intentionally small:

| Path | Content |
|---|---|
| `examples/state-machine-light-switch.json` | Maintained `1.0.0` example and built-in server seed document. |
| `assets/images/icons/fluent/` | Curated Microsoft Fluent UI System Icons used by the application. |
| `assets/images/icons/fluent-icons.json` | Deterministic selection and hash manifest for the curated icon subset. |
| `assets/images/screenshots/demo-1.gif` | Sanitized animated product tour used by the repository overview. |

The application package imports the example and curated icons from these sibling directories. Vite's development and
production configurations therefore treat the repository root as a deliberate asset boundary. Do not move those paths
inside `automata-web/` without updating the imports, build plugin, tests, and public documentation together.

## Tests

Application tests are grouped by responsibility beneath `automata-web/tests/`:

| Area | Coverage |
|---|---|
| `model/`, `runtime/`, `domain-solver/` | Domain contracts, validation, commands, execution, normalization, and inference. |
| `application/` | Workspaces, revision handling, transfers, printing, and Chart coordination. |
| `infrastructure/`, `server/`, `solver/` | Browser adapters, worker protocols, gateways, routing, server behavior, and Solver policy. |
| `shell/`, `chart/` | React presentation, dialogs, command enablement, Chart rendering, and algorithm lock. |
| `browser/` | Cross-browser workflows, screenshots, accessibility, security, printing, and responsive behavior. |
| `performance/` | Reference performance and Chart-routing benchmark evidence. |
| `fixtures/` | Curated input documents shared by tests. |

Place a test with the narrowest layer that can prove the contract. Add a browser test when the risk depends on actual
browser APIs, focus, layout, rendering, workers, CSP, or repository-subpath navigation; do not use an end-to-end test as
the only evidence for domain policy.

Documentation verification lives with the documentation package because it audits generated guide routes and assets.
Combined release-artifact checks belong to the build and deployment workflow rather than to either package's unit-test
inventory alone.

## GitHub Actions

`.github/workflows/` owns public continuous verification and GitHub Pages assembly and deployment. Workflow commands
must use committed lockfiles, the package-local CLIs, the repository subpaths, and official Pages artifact actions.
Generated application or documentation output is uploaded as build evidence; it is not committed to a deployment
branch.

Keep workflow permissions minimal. A verification job needs source read access, while a Pages deployment job receives
deployment permissions only for the deployment boundary. Never place credentials, generated environment files, or
user projects in a workflow artifact.

## Build Outputs

The principal generated paths are:

| Path | Producer |
|---|---|
| `automata-web/node_modules/` | Locked application dependency install. |
| `documentation/node_modules/` | Locked documentation dependency install. |
| `automata-web/dist/` | Audited Vite application production build. |
| `documentation/.vitepress/cache/` | VitePress build cache. |
| `documentation/.vitepress/dist/` | VitePress documentation production build. |
| `automata-web/coverage/` | Optional test coverage output. |
| `automata-web/test-results/` | Playwright run artifacts. |
| `automata-web/playwright-report/` | Optional Playwright HTML report. |

These directories are disposable products of locked source and commands. Remove or regenerate them as needed; never
hand-edit them or treat a successful local preview as a substitute for the source and artifact verification gates.

## Files That Must Not Be Committed

Do not commit:

- installed `node_modules` directories;
- application or documentation `dist` output, build caches, coverage, browser reports, or test results;
- source maps;
- `.env` files, credentials, private keys, or machine-specific editor settings;
- scratch, backup, or temporary files;
- private user projects, traces, Console exports, screenshots, or test data containing personal or confidential
  information; or
- internal design, planning, audit, acceptance, request, or agent-guidance material that is outside the public
  repository contract.

Before opening a pull request, inspect the complete staged diff as well as `git status`. Artifact and forbidden-content
checks provide defence in depth, but they do not replace a deliberate source review.

Previous: [Development Setup](./development-setup)

Next: [Architecture](./architecture)

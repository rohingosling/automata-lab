# Building and Deployment

Automata Lab produces two static sites from independent locked packages: the React application at
`/automata-lab/` and the VitePress documentation at `/automata-lab/docs/`. Release assembly places both outputs in
one GitHub Pages artifact without changing either package's source boundary.

A successful local build proves only that its own package emitted valid output. Deployment additionally requires a
clean locked install, both verification gates, collision-safe combined assembly, and review of the final artifact.

## Locked Dependency Installation

The application and documentation each own a `package.json` and `package-lock.json`. Install them independently from
the repository root:

```powershell
npm --prefix automata-web ci
npm --prefix documentation ci
npm --prefix automata-web run test:browser:install
```

Use the Node.js and npm versions declared in both package manifests. `npm ci` rejects manifest-lockfile drift and
recreates the package-local dependency tree from exact locked metadata. The Playwright command installs the browser
revisions selected by the locked application package.

Do not use a floating global Vite, VitePress, TypeScript, Vitest, or Playwright executable for verification. An
intentional dependency update must change the manifest and lockfile together and pass license, advisory, build, and
artifact review before merge.

## Application Production Build

Build the application from the repository root:

```powershell
npm --prefix automata-web run build
```

The package's `prebuild` hook checks the curated icon manifest, generated JSON Schema validator, and runtime dependency
notice. Vite then emits `automata-web/dist/` with source maps disabled, and the artifact verifier immediately checks
the
output inventory, content, CSP, bundle budgets, and repository-subpath contract.

`build.bat` is the Windows clean-verification wrapper. It runs the locked application install, installs the pinned
Playwright browsers, and executes the complete application `verify` command while preserving the first failing exit
status.

Preview an already built application with:

```powershell
npm --prefix automata-web run preview
```

Test the application through the printed `/automata-lab/` URL. A domain-root preview does not prove release-path
correctness.

## VitePress Production Build

Build and verify the documentation with:

```powershell
npm --prefix documentation run test
```

The `test` script builds VitePress and then checks required routes, the local-search output, source-map exclusion, and
public-safety markers. Generated output belongs under `documentation/.vitepress/dist/` and must not be committed.

For an interactive production smoke:

```powershell
npm --prefix documentation run preview
```

Open the documentation home, User Guide, and Developer Guide beneath `/automata-lab/docs/`. Exercise direct page
navigation, reload, sidebar links, previous/next links, and local search rather than checking only the home page.

## Combined GitHub Pages Artifact

The release artifact has this ownership:

| Artifact path | Producer |
|---|---|
| `/` | Audited contents of `automata-web/dist/`. |
| `/docs/` | Audited contents of `documentation/.vitepress/dist/`. |

Build and verify that combined tree with:

```powershell
npm --prefix automata-web run build:pages
```

The builder starts from the audited application output, records every application file and SHA-256 digest, builds the
hardened documentation directly beneath `docs/`, runs the documentation verifier against that subtree, and then proves
that no application file was changed or omitted. It fails when either surface is absent or the inventories differ.

Do not copy source packages, dependency trees, test output, caches, or package-local build directories into the Pages
artifact. Do not hand-edit the assembled files. The combined tree is disposable evidence derived from committed source
and locked commands.

A combined-artifact verifier must inspect the final tree after copying. Package-local verification cannot detect an
assembly step that overwrites application files, omits documentation, or introduces unrelated material.

## Repository-Subpath Configuration

`automata-web/vite.config.ts` defaults to `/automata-lab/` and accepts `AUTOMATA_BASE_PATH` for controlled test or
deployment builds. The value is normalized to one leading and trailing slash. Application assets, workers, examples,
icons, Help links, and browser tests must resolve through that base.

`documentation/.vitepress/config.mts` fixes the documentation base to `/automata-lab/docs/`. VitePress rewrites
navigation and generated asset URLs beneath that prefix. Markdown authors should use VitePress-aware root links or
relative page links rather than a hard-coded GitHub Pages host.

Verification must cover:

- loading and reloading both entry routes;
- direct navigation to nested guide pages;
- hashed application, Worker, and documentation assets;
- Help and repository backlinks; and
- local search navigation from a result to its final subpath.

## GitHub Actions Pages Deployment

The public `.github/workflows/pages.yml` workflow verifies pull requests, pushes to `main`, and explicit dispatches.
It installs Node.js `24.15.0`, npm `11.12.1`, both exact lockfiles, and the pinned Playwright browsers before running
the complete `npm run verify` gate. Every official GitHub Action is pinned to the immutable SHA of its reviewed
release.

Pull-request jobs receive `contents: read` only and never upload or deploy. A successful `main` build configures Pages
and uploads `automata-web/dist` as the single combined artifact. The dependent deployment job alone receives
`pages: write` and `id-token: write`, and the `github-pages` environment protects the final action.

Generated application or documentation output is never committed to a publication branch. Never deploy from a
partially successful job, an unlocked install, a locally prepared archive, or an artifact that bypassed the combined
audit.

## Dependency and License Audits

The application production closure is audited offline by:

```powershell
npm --prefix automata-web run audit:runtime
```

That command derives the transitive runtime set from the lockfile, compares installed package metadata and complete
license files, and verifies the committed third-party runtime notice byte for byte. Regenerate the notice only after an
intentional dependency change:

```powershell
npm --prefix automata-web run audit:runtime:write
```

Review the regenerated text before committing it. The offline advisory command uses only cached npm data and must not
be represented as a current network vulnerability scan.

The documentation package audits its complete VitePress build closure and committed dependency inventory offline:

```powershell
npm --prefix documentation run audit:dependencies
```

Regenerate the inventory with `audit:dependencies:write` only after an intentional lockfile change. VitePress remains
a build dependency rather than application runtime code, but its exact version, licences, advisories, emitted
JavaScript, and CSP behavior still require review. A development-only label does not exempt code emitted into the
documentation artifact.

## Artifact Audits

The application verifier is fail-closed: it accepts an exact fixed and hashed inventory, validates content types and
budgets, scans text and binary assets for leakage, and checks the expected CSP and Worker bundles. Run it directly on
an
existing application build with:

```powershell
npm --prefix automata-web run test:artifact
```

The documentation verifier checks stable routes, generated internal links and fragments, the application backlink,
local-search output, page-specific hash-based CSP, same-origin runtime assets, source-map exclusion, and forbidden
public markers. The combined builder then proves that documentation assembly changed no audited application file.

Artifact checks provide defence in depth, not permission to skip manual review. Inspect the file inventory, sizes,
entry HTML, notices, direct routes, and network behavior before release.

## Release Verification

A release candidate should progress through these gates in order:

| Gate | Required evidence |
|---|---|
| Source | Intentional diff, clean status, exact lockfiles, and reviewed generated metadata. |
| Application | Typecheck, lint, unit, performance, build, artifact, and browser tests. |
| Documentation | Production build, required routes, links, search, accessibility, CSP, and runtime requests. |
| Combined artifact | Collision-safe assembly, complete inventories, cross-links, leakage scan, and local preview. |
| Deployment | Official Pages artifact provenance, least-privilege permissions, live routes, reloads, and Workers. |

Run the package gates from a clean checkout:

```powershell
npm --prefix automata-web run verify
```

Routing changes also require the isolated routing-performance command and its recorded environment. Before deployment,
preview the combined artifact at the final base, inspect browser Console and network activity, and confirm that no
uncommitted generated output is being used as release input.

Previous: [Security and Privacy](./security-and-privacy)

Next: [Writing the Documentation](./writing-the-documentation)

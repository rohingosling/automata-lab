# Writing the Documentation

The public documentation is product source. It is versioned beside the application, built from an exact lockfile,
tested at its final repository subpath, and reviewed for accuracy, accessibility, privacy, and release identity.

Write from public contracts and shipped behavior. Do not copy planning history, internal acceptance records, local
environment details, user projects, or implementation speculation into a guide.

## Documentation Package

`documentation/` is an independent VitePress package:

| Path | Responsibility |
|---|---|
| `index.md` | Documentation home and guide entry points. |
| `user-guide/` | Task-oriented product documentation. |
| `developer-guide/` | Architecture, setup, testing, build, and contribution documentation. |
| `.vitepress/config.mts` | Base path, navigation, sidebars, local search, and site metadata. |
| `scripts/audit-documentation-dependencies.mjs` | Locked build-closure and licence-inventory audit. |
| `scripts/verify-documentation.mjs` | Generated-route, search, source-map, and public-safety checks. |
| `package.json`, `package-lock.json` | Exact commands and locked build dependency graph. |

Generated `.vitepress/dist/` and `.vitepress/cache/` directories are disposable output. Do not edit or commit them.
Site
behavior belongs in source Markdown, VitePress configuration, local theme code, or verification scripts.

Keep documentation dependencies separate from the application package. A reader must not download an application
runtime library merely to render or search the static guides.

## Running VitePress Locally

Install and start the authoring server from the repository root:

```powershell
npm --prefix documentation ci
npm --prefix documentation run dev
```

Open the loopback URL VitePress prints beneath `/automata-lab/docs/`. Keep this source-serving authoring process on
loopback: do not bind it to a network interface or expose it through a proxy, tunnel, or port forward. Close it when
authoring ends. The development server provides quick feedback, but it does not replace the hardened production build
because generated routes, asset paths, CSP, and local search can differ.

Before review, build and preview the production output:

```powershell
npm --prefix documentation run test
npm --prefix documentation run preview
```

Check a direct nested URL and reload it. Also verify keyboard navigation, narrow reflow, zoom, forced colors, and
search
when a change affects navigation, layout, or theme behavior.

## Adding or Updating Pages

Create one descriptive kebab-case Markdown file per visible guide chapter unless a chapter is intentionally the
directory's `index.md`. Begin with one level-one title matching the sidebar label, then preserve the approved level-two
section order.

When adding a page:

1. add the Markdown source in the correct guide directory;
2. add its numbered sidebar item in `.vitepress/config.mts`;
3. link the preceding and following pages;
4. add the expected generated HTML path to the documentation verifier; and
5. run the production documentation test.

Keep a chapter cohesive. Split it only when page length or navigation materially improves, and update every inbound
link, sidebar label, required route, and previous/next link in the same change.

When product behavior changes, update the narrow user task and developer contract that own it. Do not append a
correction
to a distant troubleshooting page while leaving the primary explanation wrong.

## Navigation and URLs

The stable entry routes are:

| Destination | URL |
|---|---|
| Documentation home | `/automata-lab/docs/` |
| User Guide | `/automata-lab/docs/user-guide/` |
| Developer Guide | `/automata-lab/docs/developer-guide/` |

Sidebar links are VitePress root links relative to the documentation base, such as `/developer-guide/testing`. Links
between nearby Markdown pages should normally be relative, such as `./testing`. VitePress validates internal page links
during the production build.

Use descriptive lowercase kebab-case paths. Do not rename a published route casually: bookmarks, search results, issue
links, and application Help links may depend on it. If a rename is necessary, provide an intentional compatibility or
redirect strategy and test direct navigation.

Application backlinks must derive from the deployment base. Do not hard-code a domain-root path that loses the
`/automata-lab/` repository prefix.

## Local Search

The VitePress configuration uses `provider: "local"`. Search records are generated at build time from page titles,
headings, and body text; reading and searching require no hosted service or analytics request.

Write unique, specific headings that make sense as search results. Put the words a reader is likely to search for in
the
owning section rather than relying on hidden keywords. Avoid repeating the same generic heading across unrelated pages
when a more precise name is available.

After changing navigation, titles, or major terminology, build the site and search for representative user and
developer
terms. Open results by keyboard and confirm they resolve to the expected page and fragment at the final subpath.

## Images and Alternative Text

Use curated local assets only. Place documentation-owned images under a reviewed local public-assets directory and link
them through the VitePress base. Do not hotlink screenshots, fonts, scripts, badges, diagrams, or other active
resources
from a third-party host.

Every meaningful image needs concise alternative text that communicates its purpose, not its file name. Mark a purely
decorative image as decorative through the appropriate theme or markup pattern instead of repeating surrounding text.

Before committing an image:

- crop it to the relevant interface;
- remove account names, local paths, file names, notifications, and unrelated windows;
- verify it represents the current accepted interface;
- inspect both visual quality and readable text at common zoom levels; and
- keep dimensions and file size proportionate to the information conveyed.

Prefer text, tables, and repository-native diagrams when they communicate a contract more clearly and remain easier to
update than a screenshot.

## Internal Links

Use relative links for guide-to-guide relationships and stable public URLs only for external destinations. Link to the
page that owns a concept instead of duplicating its full explanation. Include a fragment only when the target heading
is
stable and the narrower jump is useful.

The first and last lines of each chapter maintain explicit Previous and Next navigation in addition to the sidebar.
When inserting a page, update both adjacent chapters in the same change.

A production build must have no dead page or fragment links. Also inspect generated links that cross between the
application, documentation, repository, issue tracker, examples, schema, and notices because package-local Markdown
validation cannot prove every combined-artifact boundary.

## Style and Terminology

Write direct, task-oriented prose for the User Guide and precise boundary-oriented prose for the Developer Guide. Lead
with the outcome, then explain prerequisites, commands, failure behavior, and recovery. Use tables for compact mappings
and lists for true sequences or choices.

Use product terms consistently:

- Automata Lab, Editor, Chart, Solver, Server, Simulator, Console, and State Chart;
- state, event, action, transition, entry action, exit action, and initial state;
- project for the portable Automata Lab file and document for its in-memory representation; and
- Worker when referring to a browser Web Worker.

Use normative words only when describing an actual contract. Do not claim global Solver minimality, terminal-state
runtime semantics, remote Server support, automatic persistence, or another feature the product does not provide.

Keep examples small, deterministic, and free of confidential content. Render commands and identifiers as code, UI
labels in bold, and paths relative to the public repository.

## Documentation Tests

The package test performs a production build, removes the build-only cross-artifact link marker, adds the required main
landmark, applies page-specific hash-based CSP, and then runs `scripts/verify-documentation.mjs`. The verifier requires
every maintained route, validates generated internal links and fragments, checks the application backlink and local
search, rejects non-local runtime assets and source maps, and scans textual output for local or non-public markers.

VitePress also reports invalid internal links during its build. The browser documentation specification supplies the
final-subpath navigation and reload, keyboard, automated accessibility, narrow and 200-percent layout, forced-colors,
reduced-motion, CSP, runtime-network, local-search, and application-backlink evidence across the supported browsers.

Add a focused verifier assertion when a defect can be caught deterministically from generated files. Add a browser test
when the risk depends on navigation, focus, layout, search interaction, CSP enforcement, or a real browser API.

## Keeping Guides Synchronized

Documentation is part of the same change when code alters:

- commands, menus, settings, dialogs, diagnostics, limits, files, or runtime semantics;
- package scripts, prerequisites, paths, dependencies, or build outputs;
- architecture boundaries, ports, protocols, preferences, or test ownership; or
- public URLs, release identity, notices, licenses, or deployment behavior.

Search both guide families for the old term or behavior before editing. Update cross-links, reference tables,
troubleshooting, examples, and navigation together. Then build the application when needed, build the documentation,
and review the rendered pages rather than only the Markdown diff.

The guides describe the accepted current release. Avoid time-sensitive phrases such as "currently planned" or copying
work-item history into a page. Version history belongs in release notes; durable product and developer behavior belongs
in the guides.

Previous: [Building and Deployment](./building-and-deployment)

Next: [Contributing](./contributing)

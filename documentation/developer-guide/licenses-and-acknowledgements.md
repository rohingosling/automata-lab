# Licenses and Acknowledgements

Automata Lab ships its own licence and the inventories or notices required for the production runtime, documentation,
and selected icon assets. The repository and built artifacts keep those records available without a network request.

This chapter explains how the notice set is maintained. It summarizes the checked-in texts but does not replace them or
provide legal advice.

## Automata Lab License

Automata Lab is released under the [MIT License](https://github.com/rohingosling/automata-lab/blob/main/LICENSE), with
copyright held by Rohin Gosling. The licence permits use, copying, modification, distribution, sublicensing, and sale,
subject to retaining the copyright and permission notice in copies or substantial portions of the software. It also
provides the licence's warranty and liability disclaimer.

The authoritative repository text is `LICENSE`. The application ships an identical copy at
`automata-web/public/notices/automata-lab.txt` so the About dialog and static production artifact do not depend on a
repository-relative fetch. A focused test compares the two files and fails if they drift.

The MIT licence applies to Automata Lab's source and documentation. Project files created with the application remain
their authors' content; using, saving, or sharing a model does not transfer it to the Automata Lab project.

## Third-Party Runtime Notices

`automata-web/public/notices/third-party-runtime.txt` records the complete production dependency closure derived from
the exact lockfile and the installed packages' licence files. The current notice covers 27 runtime packages. Four are
direct dependencies and 23 are transitive dependencies; packages are grouped into ten reproduced licence texts.

The notice is generated mechanically. Do not edit its package rows, fingerprints, or licence bodies by hand.

| Command | Use |
|---|---|
| `npm run audit:runtime` | Recompute the production closure and fail if the committed notice differs. |
| `npm run audit:runtime:write` | Rewrite the notice after an intentional locked dependency change. |
| `npm run audit:advisories:offline` | Check cached production advisories without network access. |

Run these commands from `automata-web/`. After regeneration, review the package inventory, direct/transitive
classification, declared licences, selected source licence files, hashes, and complete text. Commit the notice with the
lockfile change that required it.

The notice records that `elkjs` declares `EPL-2.0 OR GPL-3.0-or-later` and that Automata Lab distributes its included
copy under the EPL-2.0 option. The complete Eclipse Public License 2.0 text is reproduced there. Keep this distribution
choice explicit when the dependency or its declared licence changes.

Development-only packages are not part of the browser production closure solely because they help build or test the
project. Their licence metadata remains in the lockfile, while the shipped runtime notice is derived from packages
reachable from production dependencies.

## Documentation Build Dependency Inventory

The generated documentation includes browser code emitted from VitePress and its locked build closure. The
[documentation dependency inventory](../notices/third-party-documentation.txt) records all 173 packages reachable from
the exact `vitepress@1.6.4` pin, their direct or transitive relationship, declared SPDX licence metadata, npm integrity
digests, and one deterministic closure fingerprint.

Maintain the inventory from `documentation/`:

| Command | Use |
|---|---|
| `npm run audit:dependencies` | Recompute the lockfile closure and fail if the committed inventory differs. |
| `npm run audit:dependencies:write` | Regenerate the inventory after an intentional lockfile change. |

The static Pages artifact contains no documentation `node_modules` tree or development server. The current stable
VitePress line nevertheless depends on an older Vite development toolchain with published development-server
advisories and no supported stable upgrade path. Integrated application development builds and hardens the guides, then
serves them through the production preview path. The separate hot-reload documentation server binds only to
`127.0.0.1`; never expose it through a network interface, proxy, tunnel, or port-forward, and close it after authoring.


## Microsoft Fluent UI System Icons

Automata Lab uses a curated subset of the
[Microsoft Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons). The subset contains selected
16 px and 20 px regular SVG command icons. Microsoft releases those assets under the MIT License, and the application
ships the corresponding copyright and licence text at `automata-web/public/notices/fluent-ui-system-icons.txt`.

The selected SVG files and `assets/images/icons/fluent-icons.json` form a deterministic allowlist. Icon hashes use
canonical UTF-8 SVG text with CRLF and CR line endings normalized to LF, so Windows imports and Linux CI verify the same
asset identity. The application does not require a complete external Fluent checkout for an ordinary install, build,
or verification run.

Use `npm run icons:check` for routine verification. When an intentional UI change needs a new or refreshed icon, obtain
the complete Fluent collection separately and run:

```powershell
npm run icons:import -- --source <directory>
```

Review every changed SVG, manifest entry, hash, source path, and notice before committing. Do not replace a selected
Fluent asset with a visually similar file of unknown provenance, and do not remove the notice from the production
artifact.

The About dialog exposes the Automata Lab and Fluent icon licence texts. The static artifact separately carries the
third-party runtime notice and documentation dependency inventory. Production verification checks every required
notice or inventory file, while focused tests protect the application licence copy, Fluent notice identity, runtime
inventory, and documentation closure expectations.

Previous: [Developer Reference](./developer-reference)

Next: [Documentation Home](../)

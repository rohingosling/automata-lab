# Contributing

Contributions should preserve Automata Lab's deterministic model semantics, layered architecture, local-first privacy,
keyboard accessibility, and reproducible static build. A small coherent change with focused evidence is easier to
review and safer to release than a broad rewrite that mixes unrelated concerns.

By contributing, you agree that submitted work can be distributed under the repository's MIT License.

## Choosing an Issue

Search the [issue tracker](https://github.com/rohingosling/automata-lab/issues) before starting. Prefer an existing
issue
whose expected behavior and scope are clear. For a substantial feature, protocol change, file-format change, dependency
addition, or UI redesign, discuss the proposal before investing in implementation.

A useful issue describes:

- the observed and expected behavior;
- a minimal reproduction or user workflow;
- the affected application version, browser, and operating system;
- relevant Console codes without full project or trace payloads; and
- accessibility, privacy, compatibility, or migration impact.

Do not attach confidential project files, credentials, local paths, personal data, or full traces to a public issue.
Reduce a reproduction to safe invented data.

## Creating a Branch

Create a branch from the repository's current default branch:

```powershell
git switch main
git pull --ff-only
git switch -c fix/short-purpose
```

Choose a short descriptive name such as `fix/dialog-focus` or `feature/csv-diagnostic-copy`. A naming prefix is helpful
but less important than keeping the branch focused on one reviewable outcome.

Before editing, run the relevant baseline test and inspect `git status`. Do not build a change on top of unrelated
local
modifications or generated output. Rebase or merge the latest default branch according to the maintainer's requested
workflow before final review.

## Coding Standards

Match the established source style in the area you change:

- TypeScript uses strict types, explicit contracts, full descriptive names, four-space indentation, Allman braces, and
  spaces inside non-empty parentheses and brackets;
- related declarations and multiline arguments use readable column alignment;
- domain code stays independent of React, DOM APIs, concrete Workers, storage, and transport implementations;
- presentation renders immutable values and dispatches typed application commands;
- user-facing strings belong in the localization resources; and
- comments explain contracts, non-obvious invariants, or recovery behavior rather than restating a statement.

Do not weaken types with `any`, bypass codecs with assertions, or duplicate defaults and bounds in components. Preserve
declared ordering and deterministic tie-breaks. A model, route, candidate, or revision must not depend on incidental
object or iteration order.

Follow the existing file header and section-comment patterns when adding a public source file. Keep formatting changes
local to the code being changed so semantic review remains practical.

## Making Focused Changes

Start at the layer that owns the behavior. Change domain policy before presentation when semantics change; change an
adapter when only a browser capability changes; change a component when the application contract already supplies the
needed value or command.

Keep these synchronized when applicable:

| Contract | Common companions |
|---|---|
| File format | Types, limits, schema, generated validator, codecs, examples, tests, and guides. |
| Command | Planner, mutation, revision handling, undo data, Editor/Chart callers, and tests. |
| Worker protocol | Shared types, both codecs, bounds, gateway, Worker, stale handling, and hostile tests. |
| Preference | Compile-time default, constraints, typed allowlist, storage decoder, UI, and tests. |
| UI command | Localization, menu/toolbar definition, enablement, focus, keyboard path, and documentation. |
| Build output | Package script, lockfile, audit inventory, workflow, notices, and deployment guide. |

Avoid drive-by renames, formatting sweeps, dependency upgrades, generated-file rewrites, and architecture changes in
the
same pull request unless they are necessary for the stated outcome.

## Adding Tests

Add evidence at the narrowest layer that owns the risk:

- unit or property tests for domain invariants and deterministic transformations;
- application tests for transactions, revisions, stale results, and port coordination;
- adapter and Worker tests for capability, protocol, timeout, cancellation, and recovery behavior;
- component tests for semantic controls, enablement, dialogs, focus, and rendering; and
- browser tests for real layout, workers, files, downloads, printing, CSP, accessibility, and subpath routing.

Test success and applicable empty, malformed, cancellation, stale, conflict, limit, and recovery paths. A regression
test
should fail for the original defect and express the durable contract, not private implementation steps.

Do not update visual snapshots automatically and assume the change is correct. Inspect every changed image and retain
behavioral assertions for focus, semantics, and accessibility.

## Updating Documentation

Update the User Guide when a user-visible workflow, label, setting, limit, diagnostic, or file behavior changes. Update
the Developer Guide when architecture, commands, protocols, packages, tests, build, deployment, or contribution rules
change.

Keep previous/next links, sidebar navigation, search terminology, and verifier route inventory synchronized with page
changes. Add useful alternative text for images and keep all documentation assets local.

Run the documentation production test for every guide change:

```powershell
npm --prefix documentation run test
```

Do not expose internal planning records, machine paths, confidential fixtures, or user data while explaining a public
contract.

## Commit Expectations

Create focused commits with an imperative summary that describes the outcome, for example:

```text
Preserve dialog focus after validation failure
```

Before committing:

1. inspect `git status` and the complete diff;
2. remove debugging code and unrelated edits;
3. run the focused test suites;
4. run formatting, type, lint, build, and documentation gates that apply; and
5. confirm generated dependencies, artifacts, caches, reports, and local settings are not staged.

Commit generated source only when the repository deliberately tracks it and its authoritative generation command has
been run. Generated production output and test reports are never source commits.

## Pull-Request Checklist

A pull request should explain the problem, solution, important design decisions, test evidence, and any limitation or
follow-up. Include safe screenshots for intentional visual changes and identify keyboard or accessibility evidence.

Use this checklist before requesting review:

- [ ] The change has one clear purpose and no unrelated diff.
- [ ] Public semantics and architecture boundaries remain intact or the change explains the deliberate contract update.
- [ ] Types, schema, codecs, examples, commands, Workers, and preferences are synchronized where applicable.
- [ ] New and changed behavior has focused automated tests.
- [ ] Keyboard, focus, responsive, forced-colors, privacy, and security impact has been considered.
- [ ] User and developer documentation is current.
- [ ] Exact lockfiles and license notices are current after any dependency change.
- [ ] Application and documentation verification commands pass as applicable.
- [ ] The production artifact contains no source maps, tests, credentials, local paths, or user data.
- [ ] The staged diff contains no generated build output, caches, browser reports, or confidential material.

Reviewers may request a smaller split when a pull request combines independently testable outcomes. Resolve review
comments with additional focused commits or an agreed cleanup, and rerun affected gates after the final change.

Previous: [Writing the Documentation](./writing-the-documentation)

Next: [Developer Reference](./developer-reference)

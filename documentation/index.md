---
layout: home

hero:
  name: Automata Lab
  text: Documentation
  tagline: Author, infer, visualize, host, and simulate deterministic state transducers in your browser.
  actions:
    - theme: brand
      text: Launch Automata Lab
      link: https://application.automata-lab.invalid/
      target: _self
    - theme: brand
      text: Read the User Guide
      link: /user-guide/
    - theme: alt
      text: Read the Developer Guide
      link: /developer-guide/

features:
  - title: One authoring model
    details: Use structured Editor pages and an editable UML-style Chart as equal views of the same project.
  - title: Reviewable inference
    details: Build deterministic candidates from partial observations, inspect the evidence, and apply a candidate only when you choose.
  - title: Browser-local runtime
    details: Host immutable revisions and run pinned Simulator sessions through a built-in worker without a remote service.
---

# Automata Lab Overview

Automata Lab is an experimental browser laboratory for deterministic, Moore-machine-inspired state transducers. A
model contains states, events, reusable actions, ordered entry and exit actions, one initial state, and a partial
deterministic transition function.

The application brings five activities into one project:

- **Editor** provides structured forms, lists, action assignments, and a transition table.
- **Chart** presents and edits the same model as a UML-style graph.
- **Solver** infers a reviewable candidate from partial observations.
- **Server** hosts an immutable project revision inside a dedicated browser worker.
- **Simulator** runs event sequences against a session pinned to a hosted revision.

## User Guide

The [User Guide](./user-guide/) explains the model, application shell, authoring workflow, Chart, Solver, built-in
server, Simulator, files, printing, settings, accessibility, diagnostics, and troubleshooting.

If this is your first visit, continue with [Getting Started](./user-guide/getting-started).

## Developer Guide

The [Developer Guide](./developer-guide/) introduces the public repository, architecture, contracts, test strategy,
build pipeline, documentation workflow, security boundaries, and contribution expectations.

## Application Version and Documentation Scope

This documentation accompanies Automata Lab 1.4.0, built from the same source revision. The release standardizes
workspace and modal spacing, group-box titles, content scrolling, and visible action bars. See
[Application Shell](./user-guide/application-shell#workspace) for the layout behavior and
[Configuration and Preferences](./developer-guide/configuration-and-preferences#presentation-spacing) for developer
spacing settings. Its JSON reader supports strict
file versions `1.0.0`, `1.1.0`, `1.2.0`, and `1.3.0`; Save chooses the minimum version required by the document. Application
version, file-format version, and model metadata version are separate values and do not necessarily change together.

One current documentation set accompanies each deployment. It covers the static browser application and its built-in
browser workers; a remote HTTP server adapter remains outside the implemented scope. Local source builds can include
unreleased changes; see About Automata Lab for the application version and release notes.

## Quick Links

- [Launch Automata Lab](https://application.automata-lab.invalid/)
- [View the GitHub repository](https://github.com/rohingosling/automata-lab)
- [Report an issue](https://github.com/rohingosling/automata-lab/issues)

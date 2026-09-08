# Introduction

The Developer Guide is for contributors who build, test, review, or extend Automata Lab. Use it to understand the
public technical scope and the constraints that keep the application deterministic, portable, accessible, and safe.

## Purpose and Audience

This guide explains the public repository, application architecture, document and runtime contracts, testing, security
boundaries, documentation workflow, build pipeline, and contribution expectations. It assumes familiarity with
TypeScript, React, browser APIs, and command-line development with Node.js and npm.

## Project Scope

Automata Lab is a static browser application. Its React client, Solver Worker, and Server Worker are separate runtimes.
Editor, Chart, and Solver share one authoring document; Simulator sessions execute immutable hosted revisions.

The first public release includes the built-in `builtin://` server gateway. A remote HTTP adapter is an extension point,
not part of the current implemented product scope.

## Technology Stack

The application uses React, TypeScript, Vite, Web Workers, and browser file and print APIs. The documentation uses
VitePress with bundled local search. Production is a static GitHub Pages artifact served beneath `/automata-lab/`, with
this documentation beneath `/automata-lab/docs/`.

## Supported Environment

The repository pins its Node.js, npm, application, test, and documentation dependencies. Use the versions declared by
each package and install from the committed lockfiles with `npm ci`.

The release-verification requirement is to cover the latest two stable major versions available at release time of
Chrome, Edge, Firefox, and Safari. The checked-in automated configuration exercises Chromium, Firefox, and WebKit;
record the actual browser versions and any unverified compatibility targets with each release's evidence.

## Architectural Priorities

- Keep domain policy independent of React, the DOM, workers, storage, and transport implementations.
- Coordinate mutations through named, atomic, revision-checked commands.
- Keep persisted project data distinct from derived Chart geometry and transient runtime state.
- Validate untrusted JSON, CSV, worker messages, and server envelopes before committing state.
- Preserve deterministic Solver, layout, routing, serialization, and revision behavior.
- Keep required assets local and production artifacts free of source maps, private material, and user data.

Return to the [Documentation Home](../).

Next: [Development Setup](./development-setup)

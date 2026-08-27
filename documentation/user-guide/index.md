# Introduction

The User Guide explains how to create, inspect, infer, save, host, and simulate Automata Lab projects. It describes the
current `1.0.0` product scope and uses the labels shown by the application.

## What Automata Lab Is

Automata Lab is an experimental, browser-hosted laboratory for deterministic state transducers. It combines structured
model editing, an editable state chart, passive inference from partial observations, a browser-local server, and a
Simulator in one static application.

Editor, Chart, and Solver work with one authoring project. The Simulator is deliberately separate: it executes a session
pinned to an immutable revision hosted by the built-in server. Editing a project therefore cannot silently change a
running session.

## Supported State-Machine Model

An Automata Lab model is Moore-machine-inspired. It contains:

- A finite set of named states and one initial state;
- Named input events;
- Named, reusable actions;
- An ordered list of entry actions and an ordered list of exit actions for each state; and
- A partial deterministic transition function with at most one destination for each state-and-event pair.

Actions are reported names. Automata Lab does not execute an action as code.

When an event causes a transition, the runtime reports the source state's exit actions in order, changes state, and then
reports the destination state's entry actions in order. A self-transition follows the same exit-then-entry sequence.
Repeated actions are meaningful and remain in their declared positions.

The transition table may be partial. An unknown event or a declared event without a transition is consumed with a
warning; it does not change the current state or produce actions, and a running sequence continues with later events.

## Main Application Areas

| Area | What you do there |
|---|---|
| **Editor** | Define model metadata, states, events, actions, ordered state actions, and transitions. |
| **Chart** | Create and arrange the same model visually, add UML indicators, and edit transitions. |
| **Solver** | Enter partial observations, run deterministic inference, and review a candidate before applying it. |
| **Simulator** | Host a complete model, manage event sequences, and inspect transition and action traces. |
| **Console** | Review validation, file, Solver, Chart, server, and Simulator messages in one persistent lower panel. |

The **File** menu also controls project files, CSV exchange, printing, settings, and the built-in server connection.

## Browser Requirements

Automata Lab is designed for current desktop browsers. Release verification covers the latest two stable major versions
available at release time of Chrome, Edge, Firefox, and Safari.

Core authoring does not require the optional File System Access API. When that API is unavailable, **Save** and
**Save As** use one explicit JSON download instead of a persistent file handle. Browser print, download, and file-picker
interfaces can look different because the browser and operating system provide them.

The application supports keyboard-only operation, browser zoom, narrow viewports, forced-colors mode, reduced motion,
and screen-reader workflows. The Editor and other textual views provide non-visual alternatives to Chart operations.

## Privacy and Offline Operation

Normal use does not require an account, analytics, telemetry, advertising, tracking, a runtime CDN, or an automatic
upload of project content. The built-in server and Solver run in dedicated workers within the browser page.

Projects, observations, candidates, traces, Console entries, file handles, and sessions remain in volatile memory unless
you explicitly use an operation such as **Open**, **Save**, download, **Print**, or copy. Closing or reloading the page can
therefore discard unsaved work and resets browser-worker state.

After the application has been loaded with its required static files, its ordinary authoring, inference, hosting, and
simulation workflows do not depend on a remote runtime service. Browser cache and offline availability remain controlled
by the browser and hosting environment; Automata Lab does not install a Service Worker for offline caching.

Next: [Getting Started](./getting-started)

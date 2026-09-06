# Getting Started

This chapter takes you from launching Automata Lab to saving and reopening a small project. It also shows how to load
the bundled light-switch model and where to find validation details.

## Launching Automata Lab

GitHub Pages deployment is pending Phase 11. Before publication, launch the application from the local production
preview described in the Developer Guide's [Development Setup](../developer-guide/development-setup.md) chapter. The
application requires no account and automatically negotiates a connection to its built-in server at `builtin://server`.

The initial page is **Solver** and the model tree is collapsed. You can create a project immediately or pull the bundled
light-switch model from the connected server.

::: warning Unsaved work is volatile
The current authoring project lives in the browser page until you save it. Before closing or reloading the page, use
**File → Save** or **File → Save As** if you want to keep your changes.
:::

## Application Layout

Automata Lab uses a compact desktop-style shell:

1. The title area identifies the application and current project.
2. The menu bar and toolbar provide project-wide commands.
3. The model tree selects **Editor**, **Chart**, **Solver**, or **Simulator** pages.
4. The main workspace shows the selected page, often as a master-and-detail view.
5. The resizable **Console** records diagnostics and operation outcomes.
6. The status bar shows current context such as validation, server state, document state, and page-specific status.

At narrower widths, the model tree and Console may become toggled drawers or separate panes. Their content remains
available, and toolbar commands that do not fit move into the accessible **More** menu.

## Creating a Project

1. Choose **File → New**, select **New** on the toolbar, or press **Ctrl+N**.
2. In the model tree, open **Editor → State Machine** and enter the model name, description, and model version.
3. Open **Editor → States** and add at least one state.
4. Choose the model's **Initial State**.
5. Add any reusable events and actions under **Editor → Events** and **Editor → Actions**.
6. Select a state and assign its ordered **Entry Actions** and **Exit Actions**.
7. Define state-and-event destinations in **Editor → Transition Table**, or create equivalent semantic transitions in
   **Chart**.
8. Choose **File → Validate State Machine** and review the result in the current page and Console.
9. Choose **File → Save As** to write the portable JSON project.

You can save a structurally sound draft before it is complete. A project with no states or no initial state opens a
warning that lists every missing requirement. **Save Anyway** writes the draft; **Cancel** writes nothing. Hosting and
simulation remain unavailable until complete validation succeeds.

## Opening the Light-Switch Example

The built-in server starts with a complete light-switch demonstration project. To copy that hosted project into the
authoring workspace:

1. Wait until the status bar reports **Server: Connected**.
2. Choose **File → Pull Model from Server**.
3. If an unsaved project is already open, review the replacement warning. Save it first or explicitly confirm that it
   may be replaced.
4. Open **Editor** or **Chart** to inspect the light-switch states, events, actions, and transitions.
5. Choose **File → Save As** if you want a separate local JSON copy.

Pull replaces the authoring workspace with the hosted project. It does not create a Simulator session. The built-in
server retains its hosted revision when you disconnect and reconnect; an explicit server restart recreates the worker,
reloads the bundled light-switch project, and closes earlier sessions.

## Saving and Reopening Projects

Choose **File → Save As** to select a destination for a new or copied project. After a capable browser associates a file
with the project, **File → Save** can write to the same destination. Browsers without persistent file-handle support use
one JSON download for each save operation.

To reopen a project:

1. Choose **File → Open**.
2. Select the Automata Lab JSON file.
3. If the current project has unsaved changes, decide whether to save, discard, or cancel before replacement.
4. Review any incomplete-project acknowledgement or blocking error.

Opening is transactional. Malformed JSON, unsupported versions, duplicate names or transition keys, unknown properties,
dangling references, invalid metadata, and exceeded limits leave the current project untouched. A structurally and
referentially sound project with no states or no initial state may open after an acknowledgement and remains editable.

## Understanding Validation Messages

Choose **File → Validate State Machine** whenever you want a complete validation result. Validation also runs at strict
boundaries such as hosting or simulation.

Messages can appear in two places:

- A dialog explains a blocking error, warning, confirmation, or acknowledgement that needs immediate attention; and
- The **Console** retains validation and operation details so you can inspect them later.

Console rows include severity, a stable diagnostic code where useful, the source, a concise message, and sometimes a
context action. Use the **Messages**, **Warnings**, and **Errors** filters to change what is visible without deleting
entries. **Clear** removes retained entries.

A disabled command is not itself a validation failure. Its accessible description explains the unmet condition, such as
no open project, an incomplete model, a disconnected server, or no active Simulator session. Resolve that condition and
validate again before retrying the workflow.

Previous: [Introduction](./)

Next: [State-Machine Concepts](./state-machine-concepts)

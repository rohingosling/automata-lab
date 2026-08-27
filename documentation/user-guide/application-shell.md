# Application Shell

Automata Lab uses a compact desktop-style shell. Project-wide commands remain in consistent locations while the main
workspace changes between Editor, Chart, Solver, and Simulator.

## Title Bar and Version

The application title bar shows the Automata Lab icon and name, the current filename when the project has an associated
file, and the application version at the far edge. The browser tab title also includes the filename while one is
available.

An unsaved-change marker and accessible announcement identify a dirty project. The application version describes the
installed Automata Lab release; it is separate from the model version entered in the project and the JSON file-format
version.

## Menus and Toolbar

The menu bar contains **File**, **Edit**, **View**, and **Help**.

| Menu | Main purpose |
|---|---|
| **File** | Create, open, save, validate, import, export, host, print, and configure projects. |
| **Edit** | Cut, copy, paste, undo, and redo in the current context. |
| **View** | Navigate pages, expand or collapse the tree, show the Console, expand Chart states, and select a theme. |
| **Help** | Open this User Guide or view application, licence, and release information. |

The toolbar provides the most frequent commands in groups: file commands; server Pull and Push; Undo and Redo; Editor,
Chart, Solver, and Simulator navigation; expanded Chart-state display; and theme selection. A toolbar command and its
menu counterpart invoke the same operation and use the same enabled condition.

Commands remain visible when unavailable. Their accessible descriptions identify the missing condition, such as no open
project, an incomplete model, a disconnected server, or a pending server operation.

Menus support standard desktop keyboard interaction: use **Alt** to enter the menu bar, arrow keys to move, **Enter** or
**Space** to activate, and **Escape** to close and restore focus. The toolbar uses one roving tab stop; once it has focus,
use arrow keys to move among enabled controls.

## Navigation Tree

The Model pane contains this fixed navigation hierarchy:

- **Editor**
  - **State Machine**
  - **States**
  - **Events**
  - **Actions**
  - **Transition Table**
- **Chart**
- **Solver**
- **Simulator**

The tree starts collapsed with Solver selected. Selecting **Editor** opens the read-only State Machine Info page without
changing whether its children are expanded. A command that navigates directly to an Editor child expands Editor only as
needed to reveal the selected item.

Use Up Arrow and Down Arrow to move through visible items. Left Arrow and Right Arrow move to parents and children or
collapse and expand a branch. Home and End move to the first and last visible items, typing searches by name, and Enter
or Space selects the focused item.

## Workspace

The workspace displays one detail page selected by the Model tree or a navigation command. Editor pages provide
structured forms, lists, and a transition grid; Chart provides the visual authoring canvas; Solver manages observation
sequences and candidate review; and Simulator manages event sequences and runtime traces.

Drag the vertical splitter between Model and the workspace to resize the navigation pane. Drag the horizontal splitter
above the Console to change the lower pane's height. A focused splitter also supports arrow-key adjustment and exposes
its current value and limits to assistive technology.

Content that exceeds the available space scrolls inside its pane. At narrow widths or high zoom, Model and Console may
become toggled panes, and toolbar commands that no longer fit move into the **More** menu. The available functions and
information do not change.

## Console

The Console is the persistent lower message area for application, validation, file, CSV, Solver, Chart, server, and
Simulator activity. It replaces separate diagnostic and server logs.

Each row can include a timestamp, severity, diagnostic code, source, concise message, and a context action. Severity is
shown through text and icons as well as color. Activating a safe context action navigates to the affected page or item.

The Console title bar provides these controls:

- **Messages**, **Warnings**, and **Errors** show or hide severities without deleting entries.
- **Follow Tail** keeps the newest visible row in view; turn it off to inspect earlier entries without the view moving.
- **Clear** removes retained Console history.

The Console retains the newest 1,000 entries. A single operation contributes at most 100 individual diagnostics plus an
omission summary. Filters do not alter this retained history.

## Status Bar

For an open project, the status bar reports the initial state; counts of states, events, declared actions, entry actions,
exit actions, and transitions; server connection; and any non-empty status contributed by the active page. With no open
project, model values appear as `N/A`.

Contextual fields follow the active page and are not history. For example, Chart adds its selected-element count only
while Chart is active and the count is greater than zero. Durable warnings and remediation stay in the Console rather
than occupying the status bar.

At compact sizes, secondary values may move into an accessible status-details popover. Connected, Connecting, and
Disconnected retain text and symbol cues in addition to color.

## Keyboard Navigation

Automata Lab follows the normal tab order within the selected page. Use **Tab** and **Shift+Tab** to move between control
groups, then the documented arrow keys within menus, the toolbar, tree, lists, tabs, grids, and splitters.

Common project shortcuts include:

| Shortcut | Command |
|---|---|
| **Ctrl+N** | New project |
| **Ctrl+O** | Open project |
| **Ctrl+S** | Save project |
| **Ctrl+Z** | Undo the latest document command |
| **Ctrl+Y** | Redo the latest undone document command |

On macOS, use the equivalent Command-key shortcuts where the browser and operating system provide them. Editable text
controls retain native Cut, Copy, Paste, selection, and local text-undo behavior. After a validated field value commits,
application Undo treats that complete change as one document command.

Previous: [State-Machine Concepts](./state-machine-concepts)

Next: [Editor](./editor)

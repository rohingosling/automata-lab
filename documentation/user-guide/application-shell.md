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

The main application and modal dialog title bars share **Title Bar Color**, selected under
**Application Settings → Appearance → Application Colors**, with Blue as the default and a darker shade
in Dark mode. The application title bar retains its subtle gradient. Button-color settings do not
change title-bar colors.

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

## Buttons and Tabs

Choose **File → Settings → Appearance → Application Colors** to set application button colors
and Console inline-action colors independently. The optional **Match Console Message Color** checkbox
uses the shared darker Green message, Blue warning, and Red error palettes for inline buttons and is checked by default. Application buttons
default to Blue with 1-pixel black
borders. Menu items, list items, page tabs, Transition Table dropdown controls, Chart Palette tiles,
and Chart endpoint grips retain theme colors. Active tabs are slightly lighter than inactive tabs in Light and Dark.

Panel and dialog **×** close controls use a compact 24-by-22.4-pixel size and align right with matching
top, right, and bottom insets. See [Application Settings](./application-settings#appearance-and-themes)
for the complete color scope and choices.

## Navigation Tree

The Model pane has no title-bar close button and remains beside the workspace on desktop. Previously
saved hidden-master settings are ignored, restoring the navigation and Editor workspace. Narrow layouts
retain the Model/Detail/Console navigation buttons.

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

Workspace pages and application-owned dialogs use consistent outer content insets. Group-box titles share the
same styling as **State Machine → Initialization**, with extra space outside the left and right group borders.
Splitters retain a clear gap on both sides. Scrolling content keeps space before the right and bottom pane edges or
scrollbars; tables meet a vertical scrollbar directly.

Content that exceeds the available space scrolls inside its pane, while the bottom action bar remains visible. On
**Editor → States**, the Entry Actions or Exit Actions list scrolls independently and its buttons align with the
States pane buttons when the panes are side by side. Solver and Simulator likewise keep their action bars outside
the content scrollers. Application-owned dialogs, including Settings, confirmations, and editor forms, keep their
footer buttons outside the scrolling dialog body.

At narrow widths or high zoom, Model and Console may become toggled panes, and toolbar commands that no longer fit
move into the **More** menu. The available functions and information do not change.

The [application overview](./getting-started#figure-ug-01) shows the workspace alongside the Model tree and Console.

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

See the [enlarged Console screenshot](./console-and-diagnostics#figure-ug-34) for the severity filters, Follow Tail, and inline context actions.

## Status Bar

For an open project, the status bar reports the initial state; counts of states, events, declared actions, entry actions,
exit actions, and transitions; server connection; and any non-empty status contributed by the active page. With no open
project, model values appear as `N/A`.

Contextual fields follow the active page and are not history. For example, Chart adds its selected-element count only
while Chart is active and the count is greater than zero. Durable warnings and remediation stay in the Console rather
than occupying the status bar.

When the status fields do not fit, the status bar scrolls horizontally. Connected, Connecting, and Disconnected retain
text and symbol cues in addition to color.

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

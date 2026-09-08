<script setup>
import guideScreenshot26 from '../../assets/images/screenshots/user-guide/UG-26.png';
import guideScreenshot30 from '../../assets/images/screenshots/user-guide/UG-30.png';
import guideScreenshot31 from '../../assets/images/screenshots/user-guide/UG-31.png';
import guideScreenshot32 from '../../assets/images/screenshots/user-guide/UG-32.png';
import guideScreenshot33 from '../../assets/images/screenshots/user-guide/UG-33.png';
</script>

# Application Settings

Application Settings stores global browser preferences for Automata Lab. These values affect the application shell,
Chart presentation, export, server connection, and printing; they are not model content and never make the open project
dirty.

Choose **File → Settings**. The dialog keeps one complete pending preference snapshot. **Apply** validates and
commits that snapshot and closes the dialog. Cancel, Close, or Escape discards all pending changes. Applying relevant Chart settings recomputes effective sizes and routes without adding an Undo entry.

## General Settings

The **General** group contains **Save Backup**, which defaults off. When enabled, a capable file adapter preserves the
previous JSON bytes as a sibling `.json.bak` before Save replaces the current file. Browsers that cannot update a sibling
silently skip the backup, write or download the current JSON once, and record `FILE_BACKUP_SKIPPED` in Console.

The separate **Console** group contains **Follow Tail**, enabled by default. It keeps the newest visible Console row in
view. Turning it off changes only scrolling; it does not stop, filter, or delete messages.

The **Editor** group is visible but disabled because the application has no Editor-specific application
preferences. Document edits and display values must not be stored there.

## Appearance and Themes

The **Appearance** group selects **Light** or **Dark**; Dark is the default when no stored preference exists. The same
choice is available from **View → Theme** and the toolbar. Modal and main application title bars use
the selected Title Bar Color, with a darker shade in Dark mode. A committed selection applies to the application immediately
and survives reload in the allowlisted preference store.

The **Application Colors** group box contains three independent dropdowns:

| Dropdown | Default | Scope |
|---|---|---|
| Title Bar Color | Blue | The main application title bar and every modal dialog title bar. Uses a darker shade in Dark mode and readable title text. |
| Application Buttons | Blue | All application buttons, including dialog, toolbar, workspace, Delete, and Console title-bar buttons such as Clear. Menu items, the Application Settings group list, tab-page tabs, Transition Table dropdown buttons, Palette tiles, and Chart endpoint grips keep theme colors. |
| Console Message Buttons | Gray | Only inline buttons inside Console message, warning, and error entries. |

All three lists offer **Blue, Gray, Green, Teal, Purple, Red, Orange, Yellow, Black, and White** in slightly
darker, muted pastel shades. Gray is slightly lighter, adapting to Dark and Light themes. Text and
icons adapt for readability. Dark-mode Console button text is always white, with a subtle dark text
edge on lighter fills. Light-mode text retains its palette-specific foreground.

**Match Console Message Color** appears below Console Message Buttons and is checked by default.
Check it to use the same darker pastel **Green** palette for messages, **Blue** for warnings, and
**Red** for errors in both themes, including their darker hover and pressed shades. Matched inline
buttons use white text and icons. Severity text and accents keep their usual colors. The Console dropdown
becomes disabled and remembers its selected color. Uncheck the option to use that color again.
Console title-bar buttons, including **Clear**, always use Application Buttons.

Figure UG-30 shows the matching option and its effect on the Console color control.

<figure id="figure-ug-30" class="guide-figure">
    <a :href="guideScreenshot30" aria-label="Open Figure UG-30 at full size">
        <img :src="guideScreenshot30" alt="Appearance settings with Light selected, Blue title bars and application buttons, and disabled Gray Console color while matching is checked." width="900" height="446" loading="lazy" decoding="async">
    </a>
    <figcaption>Figure UG-30. Match Console Message Color disables the Gray dropdown while preserving its selection; Light is selected for these screenshots.</figcaption>
</figure>

Apply saves all three selections and the matching option; Cancel, Close, and Escape discard pending
changes. First-time users start with matching enabled; existing saved checked or unchecked choices remain unchanged. The colors persist across reloads without changing the project or exported diagrams and reports.
Application buttons use a thin, 1-pixel black border. Console entry buttons and the excluded controls
keep their theme borders. Active tab-page tabs are slightly lighter than inactive tabs in both themes,
independently of these color choices. System colors take precedence in forced-colors mode.

Theme changes do not modify the project, Chart coordinates, exported model data, or Undo history. Semantic states retain
text, icons, and shapes in addition to color. In forced-colors mode, system colors take precedence over the selected
theme.

Grid Color is authored against the theme active in the pending dialog. When the other theme is selected, Automata Lab
derives a counterpart with the same hue and saturation and comparable separation from the Canvas. Switching back
restores the exact authored color rather than repeatedly rewriting it.

## Chart Settings

The **Chart** group contains Grid, State Size, Format, and Automatic Layout and Routing sections.

### Grid

| Setting | Choices, range, and default |
|---|---|
| Grid Size | 10–200 CSS pixels; default 50. |
| Grid Color | Six-digit `#RRGGBB`; default `#1e1e1e` in Dark. |
| Grid Style | Dots, Solid, or Dotted; default Solid. |
| Show Grid | Default enabled; also controls whether an opaque image export includes the grid. |
| Snap to Grid | Default enabled for pointer and keyboard geometry edits. |

Grid Style and Show Grid do not control snapping. Automatic Layout always aligns its output to Grid Size even when Snap
to Grid is off.

### State Size and Format

| Setting | Range and default |
|---|---:|
| Collapsed State Width | 1–4,096 px; default 300. |
| Collapsed State Height | 1–4,096 px; default 100. |
| Expanded State Width | 1–4,096 px; default 300. |
| Expanded State Minimum Height | 1–4,096 px; default 100. |

The four sizes are independent global preferences. An expanded state can still grow to fit measured content or a saved
user height. Grid alignment rounds nominal dimensions to the nearest grid value and rounds minima upward when necessary.

**Wrap State Names**, **Wrap Event Names**, and **Wrap Action Names** all default enabled. They change presentation and
derived geometry only. They do not rename model entities or stale a Solver candidate.

Figure UG-31 locates the Grid and State Size fields within the Chart settings page.

<figure id="figure-ug-31" class="guide-figure">
    <a :href="guideScreenshot31" aria-label="Open Figure UG-31 at full size">
        <img :src="guideScreenshot31" alt="Chart settings dialog showing Grid Size 50 and state width and height defaults of 300 and 100 pixels." width="900" height="1176" loading="lazy" decoding="async">
    </a>
    <figcaption>Figure UG-31. Grid and State Size are global preferences. The example's saved expanded heights may exceed the minimum shown here.</figcaption>
</figure>

### Automatic Layout and Routing

| Setting | Range or choices | Default |
|---|---|---:|
| Minimum State Distance | 100–2,000 px | 500 px |
| Route Obstacle Offset | 1–200 px | 100 px |
| Transition Arrowhead Size | 8–160 px | 40 px |
| Transition Label Alignment | Start, Center, End | Start |
| Self-Transition Loop Extension | 1–400 px | 30 px |
| Self-Transition Loop Spacing | 1–200 px | 24 px |
| Self-Transition Loop Aspect | 5–100 percent | 35 percent |
| Delete Orphaned Chart Items During Automatic Layout | On or off | Off |

Minimum State Distance is a center-to-center lower bound for requested Automatic Layout. Route Obstacle Offset controls
preferred state- and indicator-obstacle rails; it does not change label spacing or the fixed curve-clearance proof.
Arrowhead Size applies consistently to live, draft, SVG, and raster arrows. Start, Center, and End prefer positions at
20, 50, and 80 percent of visible curve length, while collision avoidance may choose another position on the same curve.

The three loop values affect elliptical self-transitions only. Orphan cleanup, when enabled, lets Automatic Layout delete
orphan indicators and whole drafts, including attached drafts and drafts with remembered events. It never deletes configured semantic transitions. The deterministic
layout and routing pipeline has no user-selectable algorithm or speed-versus-quality mode.

Figure UG-32 enlarges the Format and Automatic Layout and Routing groups from the same settings page.

<figure id="figure-ug-32" class="guide-figure">
    <a :href="guideScreenshot32" aria-label="Open Figure UG-32 at full size">
        <img :src="guideScreenshot32" alt="Format and routing groups showing wrapping enabled, Minimum State Distance 500, Route Obstacle Offset 100, and orphan cleanup off." width="658" height="460" loading="lazy" decoding="async">
    </a>
    <figcaption>Figure UG-32. The layout and routing controls at their defaults, with orphan cleanup disabled.</figcaption>
</figure>

## Chart Image Export Settings

The **Image Export** section supplies the committed settings used by **Chart → Save As Image**.

| Setting | Choices or range | Default |
|---|---|---:|
| File Format | PNG, JPG, SVG | PNG |
| Transparent Background | Yes or No | No |
| Unit | Centimetres, Inches, Pixels | Inches |
| DPI | 72–1,200 | 300 |
| Maximum Megapixels | 1–1,000 | 1,000 |

Transparent Background is available for PNG and SVG. It is disabled for JPG, which always retains an opaque background.
A transparent export also omits the grid because there is no Canvas surface beneath it.

DPI and Maximum Megapixels are retained but disabled while SVG is selected. SVG remains vector and does not allocate a
raster Canvas. For PNG and JPG, Maximum Megapixels is checked before allocation; reduce DPI or Chart bounds when an
export exceeds the selected limit. Unit never changes the meaning of DPI, which always means dots per inch.

Figure UG-33 locates the committed export preferences. Use Apply in the surrounding settings dialog to save changes before choosing Save As Image.

<figure id="figure-ug-33" class="guide-figure">
    <a :href="guideScreenshot33" aria-label="Open Figure UG-33 at full size">
        <img :src="guideScreenshot33" alt="Image Export controls with PNG, opaque background, Inches, 300 DPI, and Maximum Megapixels 1000." width="642" height="209" loading="lazy" decoding="async">
    </a>
    <figcaption>Figure UG-33. The default PNG export settings. SVG disables DPI and Maximum Megapixels; JPG disables transparency.</figcaption>
</figure>

## Solver Settings

The **Solver** group is visible but disabled. Solver determinism, capacity, scoring, worker bounds, and
cancellation behavior are product contracts rather than user preferences. Observation sequences and start contexts are
project content edited on the Solver page, not global settings.

## Server Settings

The **Server** group contains a required **URL** and **Test Server**. The URL defaults to `builtin://server`, is trimmed
when tested or applied, and is limited to 2,048 characters.

**Test Server** uses the pending URL without first committing the rest of the dialog. It reports handshake, liveness,
and readiness through the dialog and Console. The implemented transport supports `builtin://`; an HTTP adapter is a future
extension. A non-empty URL within the length limit can be saved, but connecting to an unsupported scheme fails visibly.

Applying a changed URL immediately attempts to connect to that server. It does not save, push, or pull a project.
Use the explicit File-menu commands when you want to transfer the hosted project or disconnect.

## Simulator Settings

The **Simulator** group is visible but disabled. Saved event sequences are project content, while live
session state and traces are volatile worker state. Neither belongs in application preferences.

## Print Settings

The final **Print** group contains **Sections** and **Style and Format**. The nine section checkboxes are Model Summary,
States, Events, Actions, Transition Table, State Chart, Chart Projection, Solver Observation Sequences, and Simulator
Event Sequences. Every section defaults enabled and is synchronized with **File → Page Setup**.

**Style** selects Academic or Industry and defaults to Academic. Paper Size, Orientation, and the four margins remain in
Page Setup; they are not duplicated in Application Settings. See [Printing and Export](./printing-and-export) for the
complete report behavior.

Figure UG-26 shows the Print page. Compare the resulting [Academic and Industry report pages](./printing-and-export#figure-ug-27) before choosing a style.

<figure id="figure-ug-26" class="guide-figure">
    <a :href="guideScreenshot26" aria-label="Open Figure UG-26 at full size">
        <img :src="guideScreenshot26" alt="Application Settings Print page with all nine sections checked and Academic selected under Style and Format." width="900" height="426" loading="lazy" decoding="async">
    </a>
    <figcaption>Figure UG-26. Print Settings mirrors the Page Setup section choices and selects the report style; Academic is selected here.</figcaption>
</figure>

## Restoring Defaults

Automata Lab does not provide a bulk **Restore Defaults** button. To restore selected preferences without
affecting the others, enter the documented default values in the relevant groups and choose Apply. Page Setup supplies
the print defaults: A4, Portrait, 12.7 mm on each side, and every report section enabled.

Preferences are stored as one versioned allowlisted object in browser local storage. Unknown keys are ignored. If the
stored envelope is malformed, unsupported, or contains an invalid allowlisted value, Automata Lab substitutes safe
defaults and records `PREFERENCE_CORRUPT` or `PREFERENCE_VERSION_UNSUPPORTED` in Console. Project documents, Solver
observations, Simulator traces, hosted models, file handles, and Console history are never restored from this store.

Previous: [Printing and Export](./printing-and-export)

Next: [Accessibility](./accessibility)

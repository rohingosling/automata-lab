// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Simulator Integration Tests
// Version: 2.0.0
// Date:    2026-08-20
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the Simulator against the real built-in Server Worker: session lifecycle, buffered
//   Run, Step with selection advance, unknown-event warnings, Reset, continuation, and sequence
//   persistence.
//
//   Also verifies what only a real layout engine can show: that the trace splitter moves with the
//   pointer, that the trace columns are of equal width, that every trace row keeps one height as
//   rows accumulate, that a trace pinned to its end follows new rows while one scrolled away from
//   the end does not, that the Events pane and the trace region both open evenly divided, and that
//   an ordinary Step inserts nothing above the panes.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

//--------------------------------------------------------------------------------------------------
// Function: openSimulator
//
// Description:
//
//   Opens the simulator.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
// Returns:
//
//   A promise that resolves when the operation is complete.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

async function openSimulator ( page: Page ): Promise<void>
{
    await expect ( page.getByRole ( "contentinfo" ).getByText ( "Connected", { exact: true } ) ).toBeVisible ();
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-pull']" ) ).toBeEnabled ();
    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
    await page.locator ( "[data-toolbar-entry='toolbar-simulator']" ).click ();
    await expect ( page.getByRole ( "heading", { name: "Event Sequences" } ) ).toBeVisible ();
}

//--------------------------------------------------------------------------------------------------
// Function: startSession
//
// Description:
//
//   Starts the session.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
// Returns:
//
//   A promise that resolves when the operation is complete.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

async function startSession ( page: Page ): Promise<void>
{
    await page.getByRole ( "button", { name: "Start Session" } ).click ();
    await expect ( page.getByRole ( "button", { name: "Run" } ) ).toBeEnabled ();
}

//--------------------------------------------------------------------------------------------------
// Function: transitionRows
//
// Description:
//
//   Derives the transition rows.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
// Returns:
//
//   The value produced by the operation.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

function transitionRows ( page: Page ): Locator
{
    // Return the locator result.

    return page.locator ( ".simulator-transition-trace tbody tr:not(.simulator-trace-spacer)" );
}

//--------------------------------------------------------------------------------------------------
// Function: actionRows
//
// Description:
//
//   Derives the action rows.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
// Returns:
//
//   The value produced by the operation.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

function actionRows ( page: Page ): Locator
{
    // Return the locator result.

    return page.locator ( ".simulator-action-trace tbody tr:not(.simulator-trace-spacer)" );
}

// Current state is reported in the status bar. The page carries no summary region and no message of
// its own.

//--------------------------------------------------------------------------------------------------
// Function: currentStateSegment
//
// Description:
//
//   Derives the current state segment.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - stateName:
//     The state name supplied to the operation.
//
// Returns:
//
//   The value produced by the operation.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

function currentStateSegment ( page: Page, stateName: string ): Locator
{
    // Return the get by text result.

    return page.getByRole ( "contentinfo" ).getByText ( `Simulator State: ${stateName}`, { exact: false } );
}

//--------------------------------------------------------------------------------------------------
// Function: traceScroll
//
// Description:
//
//   Derives the trace scroll.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - trace:
//     The trace supplied to the operation.
//
// Returns:
//
//   The value produced by the operation.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

function traceScroll ( page: Page, trace: "transition" | "action" ): Locator
{
    // Return the locator result.

    return page.locator ( `.simulator-${trace}-trace .simulator-trace-scroll` );
}

//--------------------------------------------------------------------------------------------------
// Function: fillEventBuffer
//
// Description:
//
//   Derives the fill event buffer.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - eventName:
//     The event name supplied to the operation.
//
//   - count:
//     The count supplied to the operation.
//
// Returns:
//
//   A promise that resolves when the operation is complete.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

async function fillEventBuffer ( page: Page, eventName: string, count: number ): Promise<void>
{
    // Initialize the local values needed by this operation.

    const editor = page.getByRole ( "textbox", { name: "Editor" } );

    await editor.fill ( Array.from ( { length: count }, () => eventName ).join ( "\n" ) );
    await editor.blur ();
}

test.beforeEach ( async ( { page } ) =>
{
    await page.goto ( "./" );
    await openSimulator ( page );
} );

test ( "the Add Simulator Event dialog opens in the center of the viewport", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const eventsRegion = page.getByRole ( "heading", { name: "Events" } ).locator ( ".." );

    await eventsRegion.getByRole ( "button", { name: "Add" } ).click ();

    const dialog = page.getByRole ( "dialog", { name: "Add Simulator Event" } );

    await expect ( dialog ).toBeVisible ();


    // Calculate the dialog geometry value from the current inputs.

    const dialogGeometry = await dialog.evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const bounds = element.getBoundingClientRect ();
        const style  = window.getComputedStyle ( element );


        // Return the assembled result.

        return {
            bottom:           bounds.bottom,
            height:           bounds.height,
            horizontalOffset: Math.abs ( bounds.left + bounds.width / 2 - window.innerWidth / 2 ),
            left:             bounds.left,
            margin:           style.margin,
            position:         style.position,
            right:            bounds.right,
            top:              bounds.top,
            verticalOffset:   Math.abs ( bounds.top + bounds.height / 2 - window.innerHeight / 2 ),
            viewportHeight:   window.innerHeight,
            viewportWidth:    window.innerWidth,
            width:            bounds.width,
        };
    } );

    expect ( dialogGeometry.horizontalOffset, JSON.stringify ( dialogGeometry ) ).toBeLessThanOrEqual ( 1 );
    expect ( dialogGeometry.verticalOffset, JSON.stringify ( dialogGeometry ) ).toBeLessThanOrEqual ( 1 );
} );

test ( "the multiline event editor accepts a pasted event buffer", async ( { browserName, page } ) =>
{
    test.skip ( browserName !== "chromium", "Playwright exposes clipboard permissions only in Chromium." );
    await page.context ().grantPermissions ( [ "clipboard-read", "clipboard-write" ] );
    await page.evaluate ( () => navigator.clipboard.writeText (
        "event_toggle_main_supply_on\nevent_toggle_on\nevent_toggle_off",
    ) );

    const editor = page.getByRole ( "textbox", { name: "Editor" } );

    await editor.press ( "ControlOrMeta+A" );
    await editor.press ( "ControlOrMeta+V" );
    await editor.blur ();

    await expect ( editor ).toHaveValue (
        "event_toggle_main_supply_on\nevent_toggle_on\nevent_toggle_off",
    );
} );
test ( "Phase 8 runs a saved sequence against the real Server Worker session", async ( { page } ) =>
{
    // Run, Step, and Reset stay disabled until a session exists, even though the model is already
    // hosted and valid.

    await expect ( page.getByRole ( "button", { name: "Run" } ) ).toBeDisabled ();
    await expect ( page.getByRole ( "button", { name: "Step" } ) ).toBeDisabled ();
    await expect ( page.getByRole ( "button", { name: "Reset" } ) ).toBeDisabled ();

    await startSession ( page );

    await expect ( currentStateSegment ( page, "state_start" ) ).toBeVisible ();
    await expect ( transitionRows ( page ) ).toHaveCount ( 0 );

    await page.getByRole ( "button", { name: "Run" } ).click ();

    // The bundled light-switch sequence 1 drives start -> off -> on -> off -> on -> fuse blown.

    await expect ( transitionRows ( page ) ).toHaveCount ( 5 );
    await expect ( currentStateSegment ( page, "state_fuse_blown" ) ).toBeVisible ();
    await expect ( transitionRows ( page ).first () ).toContainText ( "event_toggle_main_supply_on" );
    await expect ( transitionRows ( page ).first () ).toContainText ( "Transition" );
    await expect ( actionRows ( page ).first () ).toBeVisible ();

    // Run stays available at exhaustion and the session retains its state.

    await expect ( page.getByRole ( "button", { name: "Run" } ) ).toBeEnabled ();
    await expect ( page.getByRole ( "contentinfo" ) ).toContainText ( "Simulator State: state_fuse_blown" );
} );

test ( "Step advances one event at a time and Run continues with the remaining events", async ( { page } ) =>
{
    await startSession ( page );

    const eventList = page.getByRole ( "listbox", { name: "Buffer Position" } );

    await expect ( eventList ).toHaveValue ( "0" );

    await page.getByRole ( "button", { name: "Step" } ).click ();

    await expect ( transitionRows ( page ) ).toHaveCount ( 1 );
    await expect ( eventList ).toHaveValue ( "1" );

    await page.getByRole ( "button", { name: "Step" } ).click ();

    await expect ( transitionRows ( page ) ).toHaveCount ( 2 );
    await expect ( eventList ).toHaveValue ( "2" );
    await expect ( currentStateSegment ( page, "state_on" ) ).toBeVisible ();

    await page.getByRole ( "button", { name: "Run" } ).click ();

    await expect ( transitionRows ( page ) ).toHaveCount ( 5 );
    await expect ( eventList ).toHaveValue ( "4" );
    await expect ( currentStateSegment ( page, "state_fuse_blown" ) ).toBeVisible ();
} );

test ( "Phase 8 consumes an undeclared event with a warning and continues the run", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const editor = page.getByRole ( "textbox", { name: "Editor" } );

    await editor.fill ( "event_not_declared\n\n   event_toggle_main_supply_on   \n" );
    await editor.blur ();
    await startSession ( page );
    await page.getByRole ( "button", { name: "Run" } ).click ();

    await expect ( transitionRows ( page ) ).toHaveCount ( 2 );
    await expect ( transitionRows ( page ).first () ).toContainText ( "Unknown event" );
    await expect ( transitionRows ( page ).nth ( 1 ) ).toContainText ( "Transition" );
    await expect ( page.locator ( ".console-code", { hasText: "UNKNOWN_EVENT" } ) ).toHaveCount ( 1 );

    // Cleanup removed the blank line and trimmed the padded event before the buffer was submitted.

    await expect ( currentStateSegment ( page, "state_off" ) ).toBeVisible ();
} );

test ( "Phase 8 resets without emitting actions and continues a later run from the current state", async ( { page } ) =>
{
    await startSession ( page );
    await page.getByRole ( "button", { name: "Run" } ).click ();
    await expect ( transitionRows ( page ) ).toHaveCount ( 5 );

    await page.getByRole ( "button", { name: "Reset" } ).click ();

    await expect ( transitionRows ( page ) ).toHaveCount ( 0 );
    await expect ( actionRows ( page ) ).toHaveCount ( 0 );
    await expect ( page.locator ( ".console-code", { hasText: "SIMULATION_SESSION_RESET" } ) ).toHaveCount ( 1 );
    await expect ( currentStateSegment ( page, "state_start" ) ).toBeVisible ();

    // Select the third saved sequence, which ends at state_start, and run it from the reset state.

    await page.getByRole ( "listbox", { name: "Event Sequences" } ).selectOption ( "2" );
    await page.getByRole ( "button", { name: "Run" } ).click ();

    await expect ( transitionRows ( page ) ).toHaveCount ( 3 );
    await expect ( currentStateSegment ( page, "state_start" ) ).toBeVisible ();

    // A second run of the same sequence continues from that state rather than restarting the
    // machine.

    await page.getByRole ( "button", { name: "Run" } ).click ();

    await expect ( transitionRows ( page ) ).toHaveCount ( 6 );
} );

test ( "Phase 8 persists a sequence edit as one undoable document change", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const editor = page.getByRole ( "textbox", { name: "Editor" } );

    await editor.fill ( "event_toggle_main_supply_on\nevent_toggle_on" );
    await editor.blur ();

    await expect ( page.locator ( "[data-toolbar-entry='toolbar-undo']" ) ).toBeEnabled ();

    await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();

    await expect ( editor ).toHaveValue (
        "event_toggle_main_supply_on\nevent_toggle_on\nevent_toggle_off\nevent_toggle_on\nevent_blow_fuse",
    );
} );

test ( "Phase 8 closes a session and returns the page to its no-session state", async ( { page } ) =>
{
    await startSession ( page );
    await page.getByRole ( "button", { name: "Run" } ).click ();
    await expect ( transitionRows ( page ) ).toHaveCount ( 5 );

    await page.getByRole ( "button", { name: "Close Session" } ).click ();

    await expect ( page.getByRole ( "button", { name: "Start Session" } ) ).toBeVisible ();
    await expect ( page.getByRole ( "button", { name: "Run" } ) ).toBeDisabled ();
    await expect ( page.locator ( ".simulator-workspace" ) ).not.toContainText ( "No active session" );
    await expect ( page.getByRole ( "heading", { name: "State Machine" } ) ).toHaveCount ( 0 );
    await expect ( transitionRows ( page ) ).toHaveCount ( 0 );
} );

test ( "Phase 8 clamps the sequence splitter so the pane keeps its button bar on one row", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const splitter   = page.locator ( ".simulator-panes .splitter-vertical" ).first ();
    const pane       = page.locator ( ".simulator-sequence-list" );
    const commandBar = page.locator ( ".simulator-sequence-actions" );

    // The clamp is derived from the rendered button bar, so it must exceed the fixed 220px floor
    // rather than equal it.

    const requiredWidth = await commandBar.evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const buttons = Array.from ( element.querySelectorAll ( "button" ) );

        // Return the reduce result.

        return buttons.reduce ( ( total, button ) => total + button.getBoundingClientRect ().width, 0 );
    } );
    const declaredMinimum = Number ( await splitter.getAttribute ( "aria-valuemin" ) );

    expect ( declaredMinimum ).toBeGreaterThanOrEqual ( Math.floor ( requiredWidth ) );

    // Drag the splitter as far left as it will go and confirm the pane refused to collapse past
    // that clamp.

    const splitterBox = await splitter.boundingBox ();

    // Handle the case where splitter box matches an absent value.

    if ( splitterBox === null )
    {
        throw new Error ( "The sequence splitter was not rendered." );
    }

    await page.mouse.move ( splitterBox.x + splitterBox.width / 2, splitterBox.y + splitterBox.height / 2 );
    await page.mouse.down ();
    await page.mouse.move ( 0, splitterBox.y + splitterBox.height / 2, { steps: 12 } );
    await page.mouse.up ();

    const paneBox = await pane.boundingBox ();

    // Handle the case where pane box matches an absent value.

    if ( paneBox === null )
    {
        throw new Error ( "The Event Sequences pane was not rendered." );
    }

    expect ( paneBox.width ).toBeGreaterThanOrEqual ( declaredMinimum - 1 );

    // The bar itself is the thing being protected, so assert directly that it did not wrap onto a
    // second row.

    const rowCount = await commandBar.evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const tops = Array.from ( element.querySelectorAll ( "button" ) )
            .map ( button => Math.round ( button.getBoundingClientRect ().top ) );

        // Return the computed result.

        return new Set ( tops ).size;
    } );

    expect ( rowCount ).toBe ( 1 );
} );

test ( "Phase 8 uses the shared action panel metrics for its page command bar", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const simulatorPanel = page.locator ( ".simulator-command-panel" );

    await expect ( simulatorPanel ).toHaveClass ( /detail-button-panel/u );

    const metrics = await simulatorPanel.evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const style = window.getComputedStyle ( element );

        // Return the assembled result.

        return {
            columnGap:     style.columnGap,
            flexWrap:      style.flexWrap,
            justifyContent: style.justifyContent,
            paddingBottom: style.paddingBottom,
            paddingLeft:   style.paddingLeft,
            paddingRight:  style.paddingRight,
            paddingTop:    style.paddingTop,
        };
    } );

    // Section 6.1: an 8-CSS-pixel inset, a 6-CSS-pixel gap, right alignment, and one non-wrapping
    // row. The trailing inset instead carries the page inset, which is what lines the last button
    // up with the content above it.

    expect ( metrics ).toEqual (
        {
            columnGap:      "6px",
            flexWrap:       "nowrap",
            justifyContent: "flex-end",
            paddingBottom:  "8px",
            paddingLeft:    "8px",
            paddingRight:   "18px",
            paddingTop:     "8px",
        },
    );

    // The Chart page carries the same shared component, so the two panels must measure identically.

    await page.locator ( "[data-toolbar-entry='toolbar-chart']" ).click ();

    const chartMetrics = await page.locator ( ".chart-command-panel" ).evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const style = window.getComputedStyle ( element );

        // Return the assembled result.

        return { columnGap: style.columnGap, paddingLeft: style.paddingLeft, paddingTop: style.paddingTop };
    } );

    // The shared insets match. The trailing inset legitimately differs, because the Chart Canvas
    // reaches the page edge while the Simulator's content carries the page inset.

    expect ( chartMetrics ).toEqual (
        { columnGap: metrics.columnGap, paddingLeft: metrics.paddingLeft, paddingTop: metrics.paddingTop },
    );
} );

test ( "Phase 8 renders the traces with the shared tabular treatment", async ( { page } ) =>
{
    await startSession ( page );
    await page.getByRole ( "button", { name: "Run" } ).click ();
    await expect ( transitionRows ( page ) ).toHaveCount ( 5 );

    const cellStyle = await page.locator ( ".simulator-transition-trace tbody td" ).first ().evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const style = window.getComputedStyle ( element );

        // Return the assembled result.

        return {
            borderTopWidth: style.borderTopWidth,
            padding:        `${style.paddingTop} ${style.paddingRight}`,
            textAlign:      style.textAlign,
            verticalAlign:  style.verticalAlign,
        };
    } );

    expect ( cellStyle ).toEqual (
        { borderTopWidth: "1px", padding: "5px 7px", textAlign: "start", verticalAlign: "top" },
    );

    // The header stays put while a long trace scrolls beneath it.

    const headerPosition = await page.locator ( ".simulator-transition-trace thead th" ).first ()
        .evaluate ( element => window.getComputedStyle ( element ).position );

    expect ( headerPosition ).toBe ( "sticky" );

    // The table keeps its fixed four-column order without forcing horizontal pane scrolling.
    // The assertion also prevents the trace from introducing a sideways scrollbar.

    await expect ( page.locator ( ".simulator-transition-trace thead th" ) ).toHaveText (
        [ "State", "Event", "Next State", "Outcome" ],
    );

    // Calculate the overflows value from the current inputs.

    const overflows = await page.locator ( ".simulator-transition-trace" ).evaluate (
        element => element.scrollWidth > element.clientWidth + 1,
    );

    expect ( overflows ).toBe ( false );
} );

test ( "the trace splitter moves the boundary in the direction it is dragged", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const splitter       = page.getByRole ( "separator", { name: "Resize traces" } );
    const transitionPane = page.locator ( ".simulator-transition-trace" );

    //----------------------------------------------------------------------------------------------
    // Function: paneHeight
    //
    // Description:
    //
    //   Derives the pane height.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    async function paneHeight (): Promise<number>
    {
        // Return the computed result.

        return ( await transitionPane.boundingBox () )?.height ?? 0;
    }

    const grip = await splitter.boundingBox ();

    expect ( grip ).not.toBeNull ();

    // Initialize the local values needed by this operation.

    const startHeight = await paneHeight ();
    const originX     = ( grip?.x ?? 0 ) + ( grip?.width ?? 0 ) / 2;
    const originY     = ( grip?.y ?? 0 ) + ( grip?.height ?? 0 ) / 2;

    // Dragging down grows the pane above the splitter, which is the pane whose size the splitter
    // stores.

    await page.mouse.move ( originX, originY );
    await page.mouse.down ();
    await page.mouse.move ( originX, originY + 70 );
    await page.mouse.up ();

    await expect.poll ( paneHeight ).toBeGreaterThan ( startHeight + 30 );

    const grownHeight = await paneHeight ();

    // Dragging back up shrinks it again.

    const movedGrip = await splitter.boundingBox ();
    const movedY    = ( movedGrip?.y ?? 0 ) + ( movedGrip?.height ?? 0 ) / 2;

    await page.mouse.move ( originX, movedY );
    await page.mouse.down ();
    await page.mouse.move ( originX, movedY - 70 );
    await page.mouse.up ();

    await expect.poll ( paneHeight ).toBeLessThan ( grownHeight - 30 );

    // The keyboard equivalent follows the same direction as the pointer.

    const beforeKeyboard = await paneHeight ();

    await splitter.focus ();
    await page.keyboard.press ( "ArrowDown" );
    await page.keyboard.press ( "ArrowDown" );

    await expect.poll ( paneHeight ).toBeGreaterThan ( beforeKeyboard );
} );

test ( "the Console splitter grows the Console when dragged upward", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const splitter     = page.getByRole ( "separator", { name: "Resize Console" } );
    const consolePanel = page.locator ( ".console-panel" );

    //----------------------------------------------------------------------------------------------
    // Function: consoleHeight
    //
    // Description:
    //
    //   Derives the console height.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    async function consoleHeight (): Promise<number>
    {
        // Return the computed result.

        return ( await consolePanel.boundingBox () )?.height ?? 0;
    }

    const grip = await splitter.boundingBox ();

    expect ( grip ).not.toBeNull ();

    // Initialize the local values needed by this operation.

    const startHeight = await consoleHeight ();
    const originX     = ( grip?.x ?? 0 ) + ( grip?.width ?? 0 ) / 2;
    const originY     = ( grip?.y ?? 0 ) + ( grip?.height ?? 0 ) / 2;

    await page.mouse.move ( originX, originY );
    await page.mouse.down ();
    await page.mouse.move ( originX, originY - 60, { steps: 6 } );
    await page.mouse.up ();

    await expect.poll ( consoleHeight ).toBeGreaterThan ( startHeight + 25 );
} );

test ( "both traces divide their width evenly across their columns", async ( { page } ) =>
{
    await startSession ( page );
    await page.getByRole ( "button", { name: "Run" } ).click ();
    await expect ( transitionRows ( page ) ).toHaveCount ( 5 );

    //----------------------------------------------------------------------------------------------
    // Function: headerWidths
    //
    // Description:
    //
    //   Derives the header widths.
    //
    // Parameters:
    //
    //   - trace:
    //     The trace supplied to the operation.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    async function headerWidths ( trace: string ): Promise<readonly number[]>
    {
        // Return the evaluate all result.

        return page.locator ( `.simulator-${trace}-trace thead th` ).evaluateAll (
            elements => elements.map ( element => element.getBoundingClientRect ().width ),
        );
    }

    // Process each trace from the current value collection in order.

    for ( const trace of [ "transition", "action" ] )
    {
        // Initialize the local values needed by this operation.

        const widths = await headerWidths ( trace );

        expect ( widths.length ).toBeGreaterThan ( 1 );

        // Initialize the local values needed by this operation.

        const smallest = Math.min ( ...widths );
        const largest  = Math.max ( ...widths );

        // One CSS pixel of slack, because a fixed layout distributes a remainder that does not
        // divide evenly.

        expect ( largest - smallest ).toBeLessThanOrEqual ( 1 );
    }
} );

test ( "trace rows keep one height as rows accumulate, and the view follows the tail until scrolled away",
    async ( { page } ) =>
{
    await fillEventBuffer ( page, "event_toggle_main_supply_on", 220 );
    await startSession ( page );
    await page.getByRole ( "button", { name: "Run" } ).click ();

    const scroll = traceScroll ( page, "transition" );

    await expect ( page.locator ( ".simulator-transition-trace tbody tr" ).first () ).toBeVisible ();

    // Every rendered row is the same height, so appending rows never compressed the rows already
    // shown.

    const rowHeights = await transitionRows ( page ).evaluateAll (
        elements => elements.map ( element => Math.round ( element.getBoundingClientRect ().height ) ),
    );

    expect ( rowHeights.length ).toBeGreaterThan ( 1 );
    expect ( new Set ( rowHeights ).size ).toBe ( 1 );

    // The whole trace is reachable by scrolling even though only a window of it is in the DOM.

    const metrics = await scroll.evaluate ( element => ( {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop:    element.scrollTop,
    } ) );

    expect ( metrics.scrollHeight ).toBeGreaterThan ( metrics.clientHeight * 2 );
    expect ( await transitionRows ( page ).count () ).toBeLessThan ( 220 );

    const reportedRowCount = await page.locator ( ".simulator-transition-trace table" )
        .getAttribute ( "aria-rowcount" );

    expect ( Number ( reportedRowCount ) ).toBeGreaterThan ( 220 );

    // It followed the tail: the view sits at the end of the trace rather than at its beginning.

    expect ( metrics.scrollTop + metrics.clientHeight ).toBeGreaterThan ( metrics.scrollHeight - 4 );

    // Scrolling away from the end releases the follow, so a second run leaves the view where the
    // user put it.

    await scroll.evaluate ( element => { element.scrollTop = 0; } );
    await page.getByRole ( "button", { name: "Run" } ).click ();
    await expect ( page.locator ( ".simulator-transition-trace table" ) )
        .not.toHaveAttribute ( "aria-rowcount", String ( reportedRowCount ) );

    expect ( await scroll.evaluate ( element => element.scrollTop ) ).toBe ( 0 );
} );

test ( "the page carries no warning, staleness, or session message of its own", async ( { page } ) =>
{
    await fillEventBuffer ( page, "event_not_declared", 3 );
    await startSession ( page );
    await page.getByRole ( "button", { name: "Run" } ).click ();

    await expect ( page.locator ( ".console-code", { hasText: "UNKNOWN_EVENT" } ) ).not.toHaveCount ( 0 );

    const workspace = page.locator ( ".simulator-workspace" );

    await expect ( workspace ).not.toContainText ( "is not declared" );
    await expect ( workspace ).not.toContainText ( "retention bound" );
    await expect ( workspace ).not.toContainText ( "superseded revision" );
    await expect ( page.getByRole ( "heading", { name: "Warnings" } ) ).toHaveCount ( 0 );
} );

test ( "the Events pane opens evenly divided and its splitter follows the pointer", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const splitter    = page.getByRole ( "separator", { name: "Resize Buffer Position" } );
    const bufferGroup = page.locator ( ".simulator-event-buffer" );
    const editorGroup = page.locator ( ".simulator-event-text" );

    //----------------------------------------------------------------------------------------------
    // Function: groupHeights
    //
    // Description:
    //
    //   Derives the group heights.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    async function groupHeights (): Promise<{ readonly buffer: number; readonly editor: number }>
    {
        // Return the assembled result.

        return {
            buffer: ( await bufferGroup.boundingBox () )?.height ?? 0,
            editor: ( await editorGroup.boundingBox () )?.height ?? 0,
        };
    }

    // The default is an even division, and it is even because it is expressed as two equal
    // fractions rather than as a measurement taken on the first frame -- so it survives a resize
    // while it is still the default.

    const opening = await groupHeights ();

    expect ( opening.buffer ).toBeGreaterThan ( 0 );
    expect ( Math.abs ( opening.buffer - opening.editor ) ).toBeLessThanOrEqual ( 1 );

    await page.setViewportSize ( { height: 1_120, width: 1_440 } );

    const resized = await groupHeights ();

    expect ( resized.buffer ).not.toBe ( opening.buffer );
    expect ( Math.abs ( resized.buffer - resized.editor ) ).toBeLessThanOrEqual ( 1 );

    // Dragging down grows the Buffer Position list, which is the half whose size the splitter
    // stores.

    const grip = await splitter.boundingBox ();

    expect ( grip ).not.toBeNull ();

    // Initialize the local values needed by this operation.

    const originX = ( grip?.x ?? 0 ) + ( grip?.width ?? 0 ) / 2;
    const originY = ( grip?.y ?? 0 ) + ( grip?.height ?? 0 ) / 2;

    await page.mouse.move ( originX, originY );
    await page.mouse.down ();
    await page.mouse.move ( originX, originY + 80 );
    await page.mouse.up ();

    const dragged = await groupHeights ();

    expect ( dragged.buffer ).toBeGreaterThan ( resized.buffer + 40 );
    expect ( dragged.editor ).toBeLessThan ( resized.editor - 40 );

    // A chosen position is held rather than reverting to the even default.
    //
    // The pane is grown rather than shrunk. Growing it goes entirely to the Editor, which is the
    // half still expressed as a fraction, so the chosen height is left exactly as it was. Shrinking
    // would eventually drive the Editor into its own minimum and force the remainder out of the
    // chosen half, which is correct behaviour but says nothing about whether the position was held.

    await page.setViewportSize ( { height: 1_160, width: 1_440 } );

    const afterResize = await groupHeights ();

    expect ( Math.abs ( afterResize.buffer - dragged.buffer ) ).toBeLessThanOrEqual ( 2 );
    expect ( afterResize.buffer - afterResize.editor ).toBeGreaterThan ( 40 );

    // The keyboard equivalent follows the same direction as the pointer.

    await splitter.focus ();
    await page.keyboard.press ( "ArrowUp" );
    await page.keyboard.press ( "ArrowUp" );

    expect ( ( await groupHeights () ).buffer ).toBeLessThan ( afterResize.buffer );
} );

test ( "neither half of the Events pane can be driven below its usable height", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const splitter    = page.getByRole ( "separator", { name: "Resize Buffer Position" } );
    const bufferGroup = page.locator ( ".simulator-event-buffer" );
    const editorGroup = page.locator ( ".simulator-event-text" );
    const grip        = await splitter.boundingBox ();

    expect ( grip ).not.toBeNull ();

    // Initialize the local values needed by this operation.

    const originX = ( grip?.x ?? 0 ) + ( grip?.width ?? 0 ) / 2;
    const originY = ( grip?.y ?? 0 ) + ( grip?.height ?? 0 ) / 2;

    await page.mouse.move ( originX, originY );
    await page.mouse.down ();
    await page.mouse.move ( originX, originY - 4_000, { steps: 10 } );
    await page.mouse.up ();

    expect ( ( await bufferGroup.boundingBox () )?.height ?? 0 ).toBeGreaterThanOrEqual ( 96 );

    const raised = await splitter.boundingBox ();

    await page.mouse.move ( originX, ( raised?.y ?? 0 ) + ( raised?.height ?? 0 ) / 2 );
    await page.mouse.down ();
    await page.mouse.move ( originX, originY + 4_000, { steps: 10 } );
    await page.mouse.up ();

    expect ( ( await editorGroup.boundingBox () )?.height ?? 0 ).toBeGreaterThanOrEqual ( 96 );
} );

test ( "an ordinary Step inserts nothing above the panes", async ( { page } ) =>
{
    await startSession ( page );

    // Recorded from the mutation records rather than by polling for the element, because a reason
    // that appears and is removed within one microtask batch would be gone before any poll could
    // observe it. That is exactly what a pending request used to do, and it is what made the page
    // flicker under the pointer on every Step.

    await page.evaluate ( () =>
    {
        // Initialize the local values needed by this operation.

        const root = document.documentElement;

        root.dataset [ "blockerInsertions" ] = "0";

        new MutationObserver ( records =>
        {
            // Process each record from the records collection in order.

            for ( const record of records )
            {
                // Process each node from the from result collection in order.

                for ( const node of Array.from ( record.addedNodes ) )
                {
                    // Handle the case where all required conditions are satisfied.

                    if ( node instanceof Element && node.classList.contains ( "simulator-blocked" ) )
                    {
                        root.dataset [ "blockerInsertions" ] =
                            String ( Number ( root.dataset [ "blockerInsertions" ] ?? "0" ) + 1 );
                    }
                }
            }
        } ).observe ( document.body, { childList: true, subtree: true } );
    } );

    const panesBefore = await page.locator ( ".simulator-panes" ).boundingBox ();

    await page.getByRole ( "button", { name: "Step" } ).click ();
    await expect ( transitionRows ( page ) ).toHaveCount ( 1 );
    await page.getByRole ( "button", { name: "Step" } ).click ();
    await expect ( transitionRows ( page ) ).toHaveCount ( 2 );

    const insertions = await page.evaluate (
        () => Number ( document.documentElement.dataset [ "blockerInsertions" ] ?? "-1" ) );

    expect ( insertions ).toBe ( 0 );

    // Nothing moved, either.

    const panesAfter = await page.locator ( ".simulator-panes" ).boundingBox ();

    expect ( panesAfter?.y ).toBe ( panesBefore?.y );
    expect ( panesAfter?.height ).toBe ( panesBefore?.height );
} );

test ( "unmet preconditions stay visible while a request is in flight", async ( { page } ) =>
{
    // The commands are disabled for the duration of a request, which is the feedback that one is
    // under way. What the request must not do is add itself to the reported preconditions.

    await startSession ( page );
    await expect ( page.locator ( ".simulator-blocked" ) ).toHaveCount ( 0 );

    await page.getByRole ( "button", { name: "Close Session" } ).click ();
    await expect ( page.getByRole ( "button", { name: "Start Session" } ) ).toBeVisible ();
    await expect ( page.locator ( ".simulator-blocked" ) ).toHaveCount ( 0 );
} );

test ( "the trace region opens evenly divided and holds a chosen division", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const splitter        = page.getByRole ( "separator", { name: "Resize traces" } );
    const transitionTrace = page.locator ( ".simulator-transition-trace" );
    const actionTrace     = page.locator ( ".simulator-action-trace" );

    //----------------------------------------------------------------------------------------------
    // Function: traceHeights
    //
    // Description:
    //
    //   Derives the trace heights.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    async function traceHeights (): Promise<{ readonly action: number; readonly transition: number }>
    {
        // Return the assembled result.

        return {
            action:     ( await actionTrace.boundingBox () )?.height ?? 0,
            transition: ( await transitionTrace.boundingBox () )?.height ?? 0,
        };
    }

    // Even by construction rather than by measurement, which is why it is still even after a
    // resize.

    const opening = await traceHeights ();

    expect ( opening.transition ).toBeGreaterThan ( 0 );
    expect ( Math.abs ( opening.transition - opening.action ) ).toBeLessThanOrEqual ( 1 );

    await page.setViewportSize ( { height: 1000, width: 1400 } );

    const resized = await traceHeights ();

    expect ( resized.transition ).not.toBe ( opening.transition );
    expect ( Math.abs ( resized.transition - resized.action ) ).toBeLessThanOrEqual ( 1 );

    // Dragging down grows the Transition Trace, which is the pane whose size this splitter stores.

    const grip = await splitter.boundingBox ();

    expect ( grip ).not.toBeNull ();

    // Initialize the local values needed by this operation.

    const originX = ( grip?.x ?? 0 ) + ( grip?.width ?? 0 ) / 2;
    const originY = ( grip?.y ?? 0 ) + ( grip?.height ?? 0 ) / 2;

    await page.mouse.move ( originX, originY );
    await page.mouse.down ();
    await page.mouse.move ( originX, originY + 90 );
    await page.mouse.up ();

    const dragged = await traceHeights ();

    expect ( dragged.transition ).toBeGreaterThan ( resized.transition + 40 );
    expect ( dragged.action ).toBeLessThan ( resized.action - 40 );
    expect ( dragged.transition - dragged.action ).toBeGreaterThan ( 40 );

    // A chosen position is held rather than reverting to the even default.

    await page.setViewportSize ( { height: 1100, width: 1400 } );

    // Grown rather than shrunk, for the reason the Events pane test records: the growth goes to the
    // Action Trace, which is the half still expressed as a fraction, leaving the chosen height
    // exactly as it was.

    const afterResize = await traceHeights ();

    expect ( Math.abs ( afterResize.transition - dragged.transition ) ).toBeLessThanOrEqual ( 2 );
    expect ( afterResize.transition - afterResize.action ).toBeGreaterThan ( 40 );
} );

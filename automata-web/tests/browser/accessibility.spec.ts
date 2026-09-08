// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Accessibility Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Scans both themes and verifies modal focus, keyboard focus, forced colors, reduced motion, and
//   200 percent zoom.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

import { openEditorNode } from "./tree-helpers.js";

test.beforeEach ( async ( { page } ) =>
{
    await page.goto ( "./" );
} );

for ( const theme of [ "Light", "Dark" ] as const )
{
    test ( `AL-A11Y-001 has no detectable ${theme.toLocaleLowerCase ()} theme violations`, async ( { page } ) =>
    {
        // Initialize the local values needed by this operation.

        const themeButton = page.locator ( "[data-toolbar-entry='toolbar-theme']" );

        await themeButton.click ();
        await page.getByRole ( "menuitemradio", { name: theme } ).click ();

        const results = await new AxeBuilder ( { page } ).analyze ();

        expect ( results.violations ).toEqual ( [] );
    } );
}

for ( const theme of [ "Light", "Dark" ] as const )
{
    test ( `AL-A11Y-001 has no detectable ${theme.toLocaleLowerCase ()} Simulator violations`, async ( { page } ) =>
    {
        // Initialize the local values needed by this operation.

        const themeButton = page.locator ( "[data-toolbar-entry='toolbar-theme']" );

        await themeButton.click ();
        await page.getByRole ( "menuitemradio", { name: theme } ).click ();

        await expect ( page.locator ( "[data-toolbar-entry='toolbar-pull']" ) ).toBeEnabled ();
        await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
        await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
        await page.locator ( "[data-toolbar-entry='toolbar-simulator']" ).click ();
        await expect ( page.getByRole ( "heading", { name: "Event Sequences" } ) ).toBeVisible ();

        // Scan with a live session so the trace tables, session summary, and command bar are all
        // present.

        await page.getByRole ( "button", { name: "Start Session" } ).click ();
        await expect ( page.getByRole ( "button", { name: "Run" } ) ).toBeEnabled ();
        await page.getByRole ( "button", { name: "Run" } ).click ();
        await expect ( page.locator ( ".simulator-transition-trace tbody tr" ) ).toHaveCount ( 5 );

        const results = await new AxeBuilder ( { page } ).analyze ();

        expect ( results.violations ).toEqual ( [] );
    } );
}

test ( "AL-A11Y-002 About traps and restores focus", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const helpMenu = page.getByRole ( "menuitem", { name: "Help" } );

    await helpMenu.click ();
    await page.getByRole ( "menuitem", { name: "About Automata Lab" } ).click ();
    const dialog = page.getByRole ( "dialog", { name: "About Automata Lab" } );

    await expect ( dialog ).toBeVisible ();
    await expect ( page.getByRole ( "button", { name: "Close dialog" } ) ).toBeFocused ();
    await page.keyboard.press ( "Escape" );
    await expect ( dialog ).toBeHidden ();
    await expect ( helpMenu ).toBeFocused ();
} );

test ( "AL-A11Y-001 and AL-PRN-002 expose an accessible keyboard Page Setup transaction", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const fileMenu = page.getByRole ( "menuitem", { name: "File", exact: true } );

    await fileMenu.click ();
    await page.getByRole ( "menuitem", { name: "Page Setup", exact: true } ).click ();

    const dialog = page.getByRole ( "dialog", { name: "Page Setup" } );

    await expect ( dialog ).toBeVisible ();
    await expect ( dialog.getByRole ( "combobox", { name: "Paper Size" } ) ).toBeFocused ();
    expect ( ( await new AxeBuilder ( { page } ).analyze () ).violations ).toEqual ( [] );
    await page.keyboard.press ( "Tab" );
    await expect ( dialog.getByRole ( "combobox", { name: "Orientation" } ) ).toBeFocused ();
    await page.keyboard.press ( "Escape" );
    await expect ( dialog ).toBeHidden ();
    await expect ( fileMenu ).toBeFocused ();
} );

test ( "AL-A11Y-001 displays a visible focus indicator", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const focusedElement = page.getByRole ( "menuitem", { name: "File", exact: true } );

    await page.evaluate ( () =>
    {
        // Handle the case where the current branch condition is satisfied.

        if ( document.activeElement instanceof HTMLElement )
        {
            document.activeElement.blur ();
        }
    } );


    // Repeat the operation across the bounded iteration range.

    for ( let tabIndex = 0; tabIndex < 4; tabIndex++ )
    {
        // Handle the case where current value is enabled.

        if ( await focusedElement.evaluate ( element => element === document.activeElement ) )
        {
            break;
        }

        await page.keyboard.press ( "Tab" );
    }

    await expect ( focusedElement ).toBeFocused ();
    await expect ( focusedElement ).toBeVisible ();
    const focusIndicator = await focusedElement.evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const style = getComputedStyle ( element );


        // Return the assembled result.

        return { color: style.outlineColor, style: style.outlineStyle, width: style.outlineWidth };
    } );

    expect ( focusIndicator ).toMatchObject ( { style: "solid", width: "2px" } );
    expect ( focusIndicator.color ).not.toBe ( "transparent" );
    expect ( focusIndicator.color ).not.toBe ( "rgba(0, 0, 0, 0)" );
} );

test ( "AL-A11Y-001 and AL-A11Y-002 expose an accessible Editor and entity dialog", async ( { page } ) =>
{
    await page.locator ( "[data-toolbar-entry='toolbar-new']" ).click ();

    const editorResults = await new AxeBuilder ( { page } ).analyze ();

    expect ( editorResults.violations ).toEqual ( [] );

    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();
    await page.locator ( ".states-list-pane" ).getByRole ( "button", { name: "Add" } ).click ();
    await expect ( page.getByRole ( "dialog", { name: "Named entity" } ) ).toBeVisible ();

    const dialogResults = await new AxeBuilder ( { page } ).analyze ();

    expect ( dialogResults.violations ).toEqual ( [] );
} );

test ( "AL-A11Y-003 exposes the transition drop-down list box and restores button focus", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();

    // Initialize the local values needed by this operation.

    const examplePath        = fileURLToPath ( new URL ( "../../../examples/state-machine-light-switch.json", import.meta.url ) );
    const fileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
    await ( await fileChooserPromise ).setFiles ( examplePath );
    await expect ( page.locator ( ".console-code", { hasText: "FILE_OPENED" } ) ).toHaveCount ( 1 );
    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "Transition Table" } ).click ();

    const openButton = page.getByRole (
        "button",
        { name: "Open selection list: Next State 1", exact: true },
    );

    await openButton.click ();
    const listBox = page.getByRole ( "listbox", { name: "Next State 1" } );

    await expect ( listBox ).toBeFocused ();
    expect ( ( await new AxeBuilder ( { page } ).analyze () ).violations ).toEqual ( [] );
    await page.keyboard.press ( "Escape" );
    await expect ( listBox ).toBeHidden ();
    await expect ( openButton ).toBeFocused ();
} );

test ( "AL-A11Y-001 paints the complete transition-cell focus rectangle above its editor", async (
    { browserName, page },
) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();

    // Initialize the local values needed by this operation.

    const examplePath        = fileURLToPath ( new URL ( "../../../examples/state-machine-light-switch.json", import.meta.url ) );
    const fileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
    await ( await fileChooserPromise ).setFiles ( examplePath );
    await expect ( page.locator ( ".console-code", { hasText: "FILE_OPENED" } ) ).toHaveCount ( 1 );
    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "Transition Table" } ).click ();

    const transitionCell = page.locator ( ".editable-grid-cell" ).first ();

    await transitionCell.locator ( ".drop-down-list-box-value" ).click ();
    await expect ( transitionCell ).toBeFocused ();
    await expect ( transitionCell ).toHaveAttribute ( "data-active", "true" );

    const focusIndicator = await transitionCell.evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const cellStyle      = getComputedStyle ( element );
        const indicatorStyle = getComputedStyle ( element, "::after" );

        // Return the assembled result.

        return {
            bottom:            indicatorStyle.bottom,
            borderBottomWidth: indicatorStyle.borderBottomWidth,
            borderLeftWidth:   indicatorStyle.borderLeftWidth,
            borderRightWidth:  indicatorStyle.borderRightWidth,
            borderTopWidth:    indicatorStyle.borderTopWidth,
            content:           indicatorStyle.content,
            forcedColorAdjust: indicatorStyle.forcedColorAdjust,
            left:              indicatorStyle.left,
            outlineStyle:      cellStyle.outlineStyle,
            pointerEvents:     indicatorStyle.pointerEvents,
            position:          indicatorStyle.position,
            right:             indicatorStyle.right,
            top:               indicatorStyle.top,
            zIndex:            indicatorStyle.zIndex,
        };
    } );

    expect ( focusIndicator ).toMatchObject ( {
        bottom:            "0px",
        borderBottomWidth: "2px",
        borderLeftWidth:   "2px",
        borderRightWidth:  "2px",
        borderTopWidth:    "2px",
        content:           "\"\"",
        left:              "0px",
        outlineStyle:      "none",
        pointerEvents:     "none",
        position:          "absolute",
        right:             "0px",
        top:               "0px",
        zIndex:            "2",
    } );

    await page.emulateMedia ( { forcedColors: "active" } );
    const forcedColorsActive = await page.evaluate ( () => matchMedia ( "(forced-colors: active)" ).matches );


    // Handle the case where all required conditions are satisfied.

    if ( forcedColorsActive && browserName !== "webkit" )
    {
        expect ( await transitionCell.evaluate (
            element => getComputedStyle ( element, "::after" ).forcedColorAdjust,
        ) ).toBe ( "none" );
    }
} );

test ( "AL-A11Y-004 supports forced colors and reduced motion", async ( { browserName, page } ) =>
{
    await page.emulateMedia ( { forcedColors: "active", reducedMotion: "reduce" } );

    // Initialize the local values needed by this operation.

    const focusTransitionDuration = await page.locator ( ".application-shell" ).evaluate (
        element => getComputedStyle ( element ).transitionDuration
    );
    const forcedColorsActive = await page.evaluate ( () => matchMedia ( "(forced-colors: active)" ).matches );

    expect ( Number.parseFloat ( focusTransitionDuration ) ).toBeLessThanOrEqual ( 0.001 );


    // Handle the case where all required conditions are satisfied.

    if ( forcedColorsActive && browserName !== "webkit" )
    {
        // Initialize the local values needed by this operation.

        const results = await new AxeBuilder ( { page } )
            .disableRules ( [ "color-contrast" ] )
            .analyze ();

        expect ( results.violations ).toEqual ( [] );
    }
} );

test ( "AL-A11Y-001 and AL-A11Y-003 expose keyboard-operable Solver editing and candidate review", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();

    const chooserPromise = page.waitForEvent ( "filechooser" );

    await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
    await ( await chooserPromise ).setFiles (
        fileURLToPath ( new URL ( "../fixtures/state-machine-comprehensive.json", import.meta.url ) ),
    );
    await page.getByRole ( "treeitem", { name: "Solver" } ).click ();
    const editorResults = await new AxeBuilder ( { page } ).analyze ();

    expect ( editorResults.violations ).toEqual ( [] );

    await page.getByRole ( "button", { name: "Solve", exact: true } ).click ();
    const summaryTab = page.getByRole ( "tab", { name: "Summary" } );

    await summaryTab.focus ();
    await page.keyboard.press ( "ArrowRight" );
    await expect ( page.getByRole ( "tab", { name: "State Chart" } ) ).toBeFocused ();

    const reviewResults = await new AxeBuilder ( { page } ).analyze ();

    expect ( reviewResults.violations ).toEqual ( [] );
} );

test ( "AL-A11Y-003 remains operable at 200 percent browser zoom", async ( { page } ) =>
{
    await page.setViewportSize ( { height: 450, width: 720 } );
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "New", exact: true } ).click ();

    await expect ( page.getByRole ( "button", { name: "Detail", exact: true } ) ).toBeVisible ();
    await expect ( page.getByRole ( "textbox", { name: "Name" } ) ).toBeVisible ();
    const dimensions = await page.evaluate ( () => ( {
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
    } ) );

    expect ( dimensions.documentScrollWidth ).toBeLessThanOrEqual ( dimensions.viewportWidth );
} );

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Shell Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies Pages-path loading, shell interactions, persisted splitters, themes, and responsive
//   reflow.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { openEditorNode } from "./tree-helpers.js";

test.beforeEach ( async ( { page } ) =>
{
    await page.goto ( "./" );
} );


//--------------------------------------------------------------------------------------------------
// Function: expectReviewedScreenshot
//
// Description:
//
//   Verifies reviewed screenshot and reports a failure when it is invalid.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - testInfo:
//     The test info supplied to the operation.
//
//   - screenshotName:
//     The screenshot name supplied to the operation.
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

async function expectReviewedScreenshot ( page: Page, testInfo: TestInfo, screenshotName: string ): Promise<void>
{
    // Handle the case where selected collection value differs from current value.

    if ( testInfo.project.metadata [ "visualBaseline" ] !== true )
    {
        // Return control to the caller.

        return;
    }

    await expect ( page ).toHaveScreenshot ( screenshotName );
}


//--------------------------------------------------------------------------------------------------
// Function: createNewDocument
//
// Description:
//
//   Creates new document for the test scenario.
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

async function createNewDocument ( page: Page ): Promise<void>
{
    await page.locator ( "[data-toolbar-entry='toolbar-new']" ).click ();
}

test ( "AL-UI-005 loads the tree-driven shell and curated icons beneath the repository path", async ( { page } ) =>
{
    await expect ( page ).toHaveTitle ( "Automata Lab" );
    await expect ( page.getByRole ( "treeitem", { name: "Solver" } ) ).toHaveAttribute ( "aria-selected", "true" );
    await expect ( page.getByRole ( "heading", { name: "State Machine Solution Solver" } ) ).toBeVisible ();


    // Initialize the local values needed by this operation.

    const rootTreeOrder         = await page.locator ( "[role='treeitem'][aria-level='1'] > span:last-child" ).allTextContents ();
    const workspaceToolbarOrder = await page.locator ( "[data-toolbar-entry^='toolbar-']" ).evaluateAll ( buttons =>
        buttons
            .filter ( button => [ "Editor", "Chart", "Solver", "Simulator" ].includes ( button.getAttribute ( "aria-label" ) ?? "" ) )
            .map ( button => button.getAttribute ( "aria-label" ) ),
    );

    expect ( rootTreeOrder.map ( label => label.trim () ) ).toEqual ( [ "Editor", "Chart", "Solver", "Simulator" ] );
    expect ( workspaceToolbarOrder ).toEqual ( [ "Editor", "Chart", "Solver", "Simulator" ] );

    await page.getByRole ( "menuitem", { name: "View", exact: true } ).click ();
    const viewMenuOrder = await page.locator ( "[data-menu-entry^='view-'] .menu-label" ).evaluateAll ( labels =>
        labels
            .map ( label => label.textContent?.trim () )
            .filter ( label => label !== undefined && [ "Editor", "Chart", "Solver", "Simulator" ].includes ( label ) ),
    );

    expect ( viewMenuOrder ).toEqual ( [ "Editor", "Chart", "Solver", "Simulator" ] );
    await page.keyboard.press ( "Escape" );

    const resourcePaths = await page.evaluate (
        () => performance.getEntriesByType ( "resource" ).map ( entry => new URL ( entry.name ).pathname )
    );

    expect ( resourcePaths.some ( path => path.startsWith ( "/automata-lab/icons/custom/" ) ) ).toBe ( true );
    expect ( resourcePaths.some ( path => path.startsWith ( "/automata-lab/icons/fluent/" ) ) ).toBe ( true );

    await page.getByRole ( "menuitem", { name: "Help", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "About Automata Lab" } ).click ();


    // Initialize the local values needed by this operation.

    const aboutIcon   = page.getByRole ( "dialog", { name: "About Automata Lab" } ).locator ( ".about-application-icon" );
    const aboutDialog = page.getByRole ( "dialog", { name: "About Automata Lab" } );

    await expect ( aboutIcon ).toBeVisible ();
    await expect ( aboutIcon ).toHaveAttribute ( "src", /icons\/custom\/40\/state-machine-application\.png$/u );


    // Calculate the dialog geometry value from the current inputs.

    const dialogGeometry = await aboutDialog.evaluate ( dialog =>
    {
        // Initialize the local values needed by this operation.

        const bounds = dialog.getBoundingClientRect ();


        // Return the assembled result.

        return {
            horizontalOffset: Math.abs ( bounds.left + bounds.width / 2 - window.innerWidth / 2 ),
            verticalOffset:   Math.abs ( bounds.top + bounds.height / 2 - window.innerHeight / 2 ),
        };
    } );

    expect ( dialogGeometry.horizontalOffset ).toBeLessThanOrEqual ( 1 );
    expect ( dialogGeometry.verticalOffset ).toBeLessThanOrEqual ( 1 );
} );

test ( "Console entries render without horizontal grid lines", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const consoleRow = page.locator ( ".console-row" ).first ();

    await expect ( consoleRow ).toBeVisible ();
    expect ( await consoleRow.evaluate ( row => ( {
        borderBottomStyle: window.getComputedStyle ( row ).borderBottomStyle,
        borderBottomWidth: window.getComputedStyle ( row ).borderBottomWidth,
    } ) ) ).toEqual ( {
        borderBottomStyle: "none",
        borderBottomWidth: "0px",
    } );
} );

test ( "detail page headers match the master pane header height and typography", async ( { page } ) =>
{
    await expect ( page.locator ( ".detail-page-header" ) ).toBeVisible ();

    const headerMetrics = await page.evaluate ( () =>
    {
        //------------------------------------------------------------------------------------------
        // Function: readMetrics
        //
        // Description:
        //
        //   Returns metrics.
        //
        // Parameters:
        //
        //   - headerSelector:
        //     The header selector supplied to the operation.
        //
        //   - textSelector:
        //     The text selector supplied to the operation.
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
        //------------------------------------------------------------------------------------------

        function readMetrics ( headerSelector: string, textSelector: string )
        {
            // Initialize the local values needed by this operation.

            const header = document.querySelector <HTMLElement> ( headerSelector );
            const text   = document.querySelector <HTMLElement> ( textSelector );


            // Handle the case where at least one branch condition is satisfied.

            if ( header === null || text === null )
            {
                throw new Error ( `Missing header elements for '${headerSelector}'.` );
            }

            const textStyle = getComputedStyle ( text );


            // Return the assembled result.

            return {
                fontFamily: textStyle.fontFamily,
                fontSize:   textStyle.fontSize,
                fontWeight: textStyle.fontWeight,
                height:     header.getBoundingClientRect ().height,
            };
        }


        // Return the assembled result.

        return {
            detail: readMetrics ( ".detail-page-header", ".detail-page-header h1" ),
            master: readMetrics ( ".panel-title-bar", ".panel-title-bar h2" ),
        };
    } );

    expect ( headerMetrics.master.height ).toBe ( 30 );
    expect ( headerMetrics.master.fontFamily ).toContain ( "Segoe UI" );
    expect ( headerMetrics.master.fontSize ).toBe ( "13px" );
    expect ( headerMetrics.detail ).toEqual ( headerMetrics.master );
} );

test ( "modal forms align values from the longest visible label plus ten percent", async ( { page } ) =>
{
    await createNewDocument ( page );
    await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();
    await page.locator ( ".states-list-pane" ).getByRole ( "button", { name: "Add" } ).click ();


    // Initialize the local values needed by this operation.

    const dialog = page.getByRole ( "dialog", { name: "Named entity" } );
    const layout = await dialog.evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const labels = Array.from ( element.querySelectorAll<HTMLElement> ( ".form-field-label-text" ) )
            .filter ( label => getComputedStyle ( label ).display !== "none" )
            .map ( label => label.getBoundingClientRect ().width );
        const valueOffsets = Array.from ( element.querySelectorAll<HTMLElement> ( ".form-field > div" ) )
            .map ( value => Math.round ( value.getBoundingClientRect ().left ) );


        // Return the assembled result.

        return {
            labelColumnWidth: Number.parseFloat (
                getComputedStyle ( element ).getPropertyValue ( "--form-label-column-width" ),
            ),
            longestLabelWidth: Math.max ( ...labels ),
            valueOffsets,
        };
    } );

    expect ( new Set ( layout.valueOffsets ).size ).toBe ( 1 );
    expect ( layout.labelColumnWidth ).toBe ( Math.ceil ( layout.longestLabelWidth * 1.1 ) );
    await dialog.getByRole ( "button", { name: "Cancel" } ).click ();
} );

test ( "Application Settings uses its 900-pixel desktop width", async ( { page } ) =>
{
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();

    const dialog = page.getByRole ( "dialog", { name: "Application Settings" } );

    await expect ( dialog ).toHaveCSS ( "max-width", "900px" );
    await expect ( dialog ).toHaveCSS ( "width", "900px" );
} );

test ( "State Machine Info stacks group boxes and aligns values from the longest label", async ( { page } ) =>
{
    await createNewDocument ( page );

    // The shipping default is Dark; this case asserts the reviewed Light validation palette.

    await page.locator ( "[data-toolbar-entry='toolbar-theme']" ).click ();
    await page.getByRole ( "menuitemradio", { name: "Light" } ).click ();
    await expect ( page.locator ( ".application-shell" ) ).toHaveAttribute ( "data-theme", "light" );
    await page.locator ( "[data-toolbar-entry='toolbar-editor']" ).click ();


    // Calculate the layout value from the current inputs.

    const layout = await page.locator ( ".editor-info-page" ).evaluate ( informationPage =>
    {
        // Initialize the local values needed by this operation.

        const dashboard   = informationPage.querySelector <HTMLElement> ( ".editor-dashboard" );
        const buttonPanel = informationPage.querySelector <HTMLElement> ( ".editor-info-actions" );


        // Handle the case where at least one branch condition is satisfied.

        if ( dashboard === null || buttonPanel === null )
        {
            throw new Error ( "The State Machine Info layout is incomplete." );
        }


        // Initialize the local values needed by this operation.

        const fieldsets   = Array.from ( dashboard.querySelectorAll <HTMLFieldSetElement> ( "fieldset" ) );
        const labelWidths = Array.from ( dashboard.querySelectorAll <HTMLElement> ( ".editor-info-label-text" ) )
            .map ( label => label.getBoundingClientRect ().width );
        const valueOffsets = Array.from ( dashboard.querySelectorAll <HTMLElement> ( "dd" ) )
            .map ( value => Math.round ( value.getBoundingClientRect ().left ) );
        const panelBounds          = buttonPanel.getBoundingClientRect ();
        const validateButtonBounds = buttonPanel.querySelector ( "button" )?.getBoundingClientRect ();


        // Return the assembled result.

        return {
            fieldsetLeftOffsets: fieldsets.map ( fieldset => Math.round ( fieldset.getBoundingClientRect ().left ) ),
            fieldsetTopOffsets:  fieldsets.map ( fieldset => Math.round ( fieldset.getBoundingClientRect ().top ) ),
            labelColumnWidth: Number.parseFloat (
                getComputedStyle ( dashboard ).getPropertyValue ( "--editor-info-label-column-width" ),
            ),
            legends: fieldsets.map ( fieldset => fieldset.querySelector ( "legend" )?.textContent ),
            longestLabelWidth: Math.max ( ...labelWidths ),
            panelIsSecondChild: informationPage.children [ 1 ] === buttonPanel,
            rightAlignmentDifference: validateButtonBounds === undefined
                ? Number.POSITIVE_INFINITY
                : Math.abs ( panelBounds.right - validateButtonBounds.right ),
            valueOffsets,
        };
    } );

    expect ( layout.legends ).toEqual (
        [ "Model Metadata", "Initialization", "Validation", "Hosted Model", "Simulation" ],
    );
    expect ( layout.fieldsetTopOffsets ).toEqual ( [ ...layout.fieldsetTopOffsets ].sort ( ( left, right ) => left - right ) );
    expect ( new Set ( layout.fieldsetLeftOffsets ).size ).toBe ( 1 );
    expect ( layout.labelColumnWidth ).toBe ( Math.ceil ( layout.longestLabelWidth * 1.1 ) );
    expect ( new Set ( layout.valueOffsets ).size ).toBe ( 1 );
    expect ( layout.panelIsSecondChild ).toBe ( true );
    // The panel's trailing inset carries the page inset so the Validate button aligns with the
    // content above it.

    expect ( layout.rightAlignmentDifference ).toBeCloseTo ( 18, 3 );

    const failedValidationColors = await page.locator ( ".validation-failed" ).evaluate ( element => ( {
        borderColor: getComputedStyle ( element ).borderInlineStartColor,
        textColor:   getComputedStyle ( element ).color,
    } ) );

    expect ( failedValidationColors ).toEqual ( {
        borderColor: "rgb(180, 35, 24)",
        textColor:   "rgb(180, 35, 24)",
    } );
} );

test ( "State Machine Info preserves semantic validation indicators in dark mode", async ( { page }, testInfo ) =>
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
    await page.locator ( "[data-toolbar-entry='toolbar-editor']" ).click ();

    const themeButton = page.locator ( "[data-toolbar-entry='toolbar-theme']" );

    await themeButton.click ();
    await page.getByRole ( "menuitemradio", { name: "Dark" } ).click ();

    const passedValidationColors = await page.locator ( ".validation-passed" ).evaluate ( element => ( {
        borderColor: getComputedStyle ( element ).borderInlineStartColor,
        textColor:   getComputedStyle ( element ).color,
    } ) );

    expect ( passedValidationColors ).toEqual ( {
        borderColor: "rgb(126, 231, 135)",
        textColor:   "rgb(126, 231, 135)",
    } );

    await expectReviewedScreenshot ( page, testInfo, "state-machine-info-dark-status.png" );

    await createNewDocument ( page );
    await page.locator ( "[data-toolbar-entry='toolbar-editor']" ).click ();

    const failedValidationColors = await page.locator ( ".validation-failed" ).evaluate ( element => ( {
        borderColor: getComputedStyle ( element ).borderInlineStartColor,
        textColor:   getComputedStyle ( element ).color,
    } ) );

    expect ( failedValidationColors ).toEqual ( {
        borderColor: "rgb(255, 123, 114)",
        textColor:   "rgb(255, 123, 114)",
    } );
} );

test ( "AL-A11Y-003 menus, tree, toolbar, and splitters support the documented keyboard model", async (
    { browserName, page },
) =>
{
    // Initialize the local values needed by this operation.

    const fileMenu       = page.getByRole ( "menuitem", { name: "File" } );
    const editMenu       = page.getByRole ( "menuitem", { name: "Edit" } );
    const editorNode     = page.getByRole ( "treeitem", { name: "Editor" } );
    const chartNode      = page.getByRole ( "treeitem", { name: "Chart" } );
    const masterSplitter = page.getByRole ( "separator", { name: "Resize model tree" } );
    const editorButton   = page.locator ( "[data-toolbar-entry='toolbar-editor']" );
    const chartButton    = page.locator ( "[data-toolbar-entry='toolbar-chart']" );
    const originalWidth  = Number ( await masterSplitter.getAttribute ( "aria-valuenow" ) );


    // Handle the case where browser name matches "webkit".

    if ( browserName === "webkit" )
    {
        await fileMenu.focus ();
    }
    else
    {
        // Handle the remaining case after the preceding condition is false.

        await page.keyboard.press ( "F10" );
    }
    await expect ( fileMenu ).toBeFocused ();
    await page.keyboard.press ( "ArrowRight" );
    await expect ( editMenu ).toBeFocused ();
    await page.keyboard.press ( "Escape" );

    await editorNode.focus ();
    await page.keyboard.press ( "ArrowDown" );
    await expect ( chartNode ).toBeFocused ();
    await editorNode.focus ();
    await page.keyboard.press ( "ArrowRight" );
    await expect ( editorNode ).toHaveAttribute ( "aria-expanded", "true" );
    await page.keyboard.press ( "ArrowRight" );
    await expect ( page.getByRole ( "treeitem", { name: "State Machine" } ) ).toBeFocused ();

    await editorButton.focus ();
    await page.keyboard.press ( "ArrowRight" );
    await expect ( chartButton ).toBeFocused ();

    await masterSplitter.focus ();
    await page.keyboard.press ( "ArrowRight" );
    await expect ( masterSplitter ).toHaveAttribute ( "aria-valuenow", String ( originalWidth + 12 ) );

    await page.reload ();
    await expect ( page.getByRole ( "separator", { name: "Resize model tree" } ) )
        .toHaveAttribute ( "aria-valuenow", String ( originalWidth + 12 ) );
} );

test ( "splitters respect the two-thirds cap and preserve the opposing pane minimum", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const masterSplitter         = page.getByRole ( "separator", { name: "Resize model tree" } );
    const consoleSplitter        = page.getByRole ( "separator", { name: "Resize Console" } );
    const upperWorkspaceWidth    = await page.locator ( ".upper-workspace" ).evaluate ( element => element.clientWidth );
    const workspaceHeight        = await page.locator ( ".workspace" ).evaluate ( element => element.clientHeight );
    const expectedConsoleMaximum = Math.floor ( workspaceHeight * 2 / 3 );
    const masterMaximum          = Number ( await masterSplitter.getAttribute ( "aria-valuemax" ) );

    expect ( masterMaximum ).toBeLessThanOrEqual ( Math.floor ( upperWorkspaceWidth * 2 / 3 ) );
    await expect ( consoleSplitter ).toHaveAttribute ( "aria-valuemax", String ( expectedConsoleMaximum ) );

    await masterSplitter.focus ();
    await page.keyboard.press ( "End" );
    await expect ( masterSplitter ).toHaveAttribute ( "aria-valuenow", String ( masterMaximum ) );
    expect ( await page.locator ( ".master-panel" ).evaluate ( element => element.getBoundingClientRect ().width ) )
        .toBe ( masterMaximum );
    expect ( await page.locator ( ".detail-region" ).evaluate ( element => element.getBoundingClientRect ().width ) )
        .toBeGreaterThanOrEqual ( 784 );

    await consoleSplitter.focus ();
    await page.keyboard.press ( "End" );
    await expect ( consoleSplitter ).toHaveAttribute ( "aria-valuenow", String ( expectedConsoleMaximum ) );
    expect ( await page.locator ( ".console-panel" ).evaluate ( element => element.getBoundingClientRect ().height ) )
        .toBe ( expectedConsoleMaximum );
} );

test ( "detail button panels remain right-aligned, single-row, and protected by splitter limits", async ( { page } ) =>
{
    await createNewDocument ( page );
    await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();
    await page.locator ( ".states-list-pane" ).getByRole ( "button", { name: "Add" } ).click ();
    await page.getByRole ( "textbox", { name: "Name" } ).fill ( "state_layout" );
    await page.getByRole ( "button", { name: "Confirm" } ).click ();

    const stateSplitter = page.getByRole ( "separator", { name: "States" } );

    await stateSplitter.focus ();
    await page.keyboard.press ( "Home" );
    expect ( await page.locator ( ".states-list-pane" ).evaluate ( element => element.getBoundingClientRect ().width ) )
        .toBeGreaterThanOrEqual ( 370 );

    await page.keyboard.press ( "End" );
    expect ( await page.locator ( ".state-association-pane" ).evaluate ( element => element.getBoundingClientRect ().width ) )
        .toBeGreaterThanOrEqual ( 370 );


    //----------------------------------------------------------------------------------------------
    // Function: readButtonPanelLayout
    //
    // Description:
    //
    //   Returns button panel layout.
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

    async function readButtonPanelLayout ()
    {
        // Return the evaluate all result.

        return page.locator ( ".detail-button-panel" ).evaluateAll ( panels => panels.map ( panel =>
        {
            // Initialize the local values needed by this operation.

            const panelRectangle   = panel.getBoundingClientRect ();
            const buttonRectangles = Array.from ( panel.querySelectorAll ( "button" ) )
                .map ( button => button.getBoundingClientRect () );


            // Return the assembled result.

            return {
                clientWidth: panel.clientWidth,
                rightGap:    Math.round ( panelRectangle.right - ( buttonRectangles.at ( -1 )?.right ?? 0 ) ),
                rowCount:    new Set ( buttonRectangles.map ( rectangle => Math.round ( rectangle.top ) ) ).size,
                scrollWidth: panel.scrollWidth,
            };
        } ) );
    }


    // Process each layout from the current value collection in order.

    for ( const layout of await readButtonPanelLayout () )
    {
        expect ( layout.rowCount ).toBe ( 1 );
        expect ( layout.scrollWidth ).toBeLessThanOrEqual ( layout.clientWidth );
        // A pane-scoped panel aligns with its pane's content, so it carries no trailing inset of
        // its own.

        expect ( Math.abs ( layout.rightGap ) ).toBe ( 0 );
    }

    await page.setViewportSize ( { height: 720, width: 320 } );
    await page.getByRole ( "button", { name: "Detail", exact: true } ).click ();


    // Process each layout from the current value collection in order.

    for ( const layout of await readButtonPanelLayout () )
    {
        expect ( layout.rowCount ).toBe ( 1 );
        expect ( layout.scrollWidth ).toBeLessThanOrEqual ( layout.clientWidth );
    }
} );

test ( "the Theme toolbar selects semantic palettes and reviewed Chromium baselines", async ( { page }, testInfo ) =>
{
    await expect ( page.getByRole ( "contentinfo" ).getByText ( "Connected", { exact: true } ) ).toBeVisible ();

    // The Light screenshot selects Light explicitly because the application starts in Dark theme.
    // This keeps the palette under test independent of the startup default.

    const lightThemeButton = page.locator ( "[data-toolbar-entry='toolbar-theme']" );

    await lightThemeButton.click ();
    await page.getByRole ( "menuitemradio", { name: "Light" } ).click ();
    await expect ( page.locator ( ".application-shell" ) ).toHaveAttribute ( "data-theme", "light" );
    await expectReviewedScreenshot ( page, testInfo, "shell-light.png" );

    const lightSemanticColors = await page.locator ( ".application-shell" ).evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const styles = getComputedStyle ( element );


        // Return the assembled result.

        return {
            consoleMessage:    styles.getPropertyValue ( "--console-message" ).trim (),
            consoleWarning:    styles.getPropertyValue ( "--console-warning" ).trim (),
            serverConnected:   styles.getPropertyValue ( "--server-connected" ).trim (),
            statusError:       styles.getPropertyValue ( "--status-error" ).trim (),
            statusInformation: styles.getPropertyValue ( "--status-information" ).trim (),
            statusSuccess:     styles.getPropertyValue ( "--status-success" ).trim (),
            statusWarning:     styles.getPropertyValue ( "--status-warning" ).trim (),
        };
    } );

    expect ( lightSemanticColors ).toEqual ( {
        consoleMessage:    "#357a38",
        consoleWarning:    "#075ea8",
        serverConnected:   "#337637",
        statusError:       "#b42318",
        statusInformation: "#075ea8",
        statusSuccess:     "#357a38",
        statusWarning:     "#8a5200",
    } );

    const themeButton = page.locator ( "[data-toolbar-entry='toolbar-theme']" );

    await themeButton.click ();
    await expect ( themeButton ).toHaveAttribute ( "aria-expanded", "true" );
    await page.getByRole ( "menuitemradio", { name: "Dark" } ).click ();
    await expect ( page.locator ( ".application-shell" ) ).toHaveAttribute ( "data-theme", "dark" );

    const darkThemeColors = await page.locator ( ".application-shell" ).evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const styles = getComputedStyle ( element );
        const probe  = document.createElement ( "span" );

        document.body.append ( probe );

        const results = [
            "--accent",
            "--application-title",
            "--border",
            "--console-surface",
            "--control-hover",
            "--focus",
            "--selection",
            "--surface",
        ].map ( property =>
        {
            // Initialize the local values needed by this operation.

            const value = styles.getPropertyValue ( property ).trim ();

            probe.style.color = value;
            const channels = getComputedStyle ( probe ).color.match ( /\d+(?:\.\d+)?/gu )
                ?.slice ( 0, 3 )
                .map ( Number ) ?? [];


            // Return the assembled result.

            return {
                channels,
                grayscale: channels.length === 3 && channels [ 0 ] === channels [ 1 ] && channels [ 1 ] === channels [ 2 ],
                property,
                value,
            };
        } );

        probe.remove ();


        // Return the results.

        return results;
    } );


    // Process each color from the dark theme colors collection in order.

    for ( const color of darkThemeColors )
    {
        expect ( color.grayscale, `${color.property} resolved to ${color.value}` ).toBe ( true );
    }

    const semanticColors = await page.locator ( ".application-shell" ).evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const styles = getComputedStyle ( element );
        const probe  = document.createElement ( "span" );

        document.body.append ( probe );

        const results = [
            "--console-error",
            "--console-message",
            "--console-warning",
            "--server-connected",
            "--server-connecting",
            "--server-disconnected",
            "--status-error",
            "--status-information",
            "--status-success",
            "--status-warning",
        ].map ( property =>
        {
            // Initialize the local values needed by this operation.

            const value = styles.getPropertyValue ( property ).trim ();

            probe.style.color = value;
            const channels = getComputedStyle ( probe ).color.match ( /\d+(?:\.\d+)?/gu )
                ?.slice ( 0, 3 )
                .map ( Number ) ?? [];


            // Return the assembled result.

            return {
                colorApplied: channels.length === 3 && !( channels [ 0 ] === channels [ 1 ] && channels [ 1 ] === channels [ 2 ] ),
                property,
                value,
            };
        } );

        probe.remove ();


        // Return the results.

        return results;
    } );


    // Process each color from the semantic colors collection in order.

    for ( const color of semanticColors )
    {
        expect ( color.colorApplied, `${color.property} resolved to ${color.value}` ).toBe ( true );
    }

    expect ( semanticColors.find ( color => color.property === "--console-message" )?.value ).toBe ( "#7ee787" );
    expect ( semanticColors.find ( color => color.property === "--console-warning" )?.value ).toBe ( "#6cb6ff" );
    expect ( semanticColors.find ( color => color.property === "--status-error" )?.value ).toBe ( "#ff7b72" );
    expect ( semanticColors.find ( color => color.property === "--status-information" )?.value ).toBe ( "#6cb6ff" );
    expect ( semanticColors.find ( color => color.property === "--status-success" )?.value ).toBe ( "#7ee787" );
    expect ( semanticColors.find ( color => color.property === "--status-warning" )?.value ).toBe ( "#fc6" );

    const visibleSemanticColors = await page.evaluate ( () => ( {
        consoleMessage: getComputedStyle ( document.querySelector ( ".console-row-message .console-severity" ) ?? document.body ).color,
        serverIcon: getComputedStyle ( document.querySelector ( ".connection-symbol" ) ?? document.body ).color,
        serverLabel: getComputedStyle ( document.querySelector ( ".connection-status" ) ?? document.body ).color,
        serverStatus: getComputedStyle ( document.querySelector ( ".connection-value-connected" ) ?? document.body ).color,
    } ) );

    expect ( visibleSemanticColors.consoleMessage ).toBe ( "rgb(126, 231, 135)" );
    expect ( visibleSemanticColors.serverIcon ).toBe ( "rgb(242, 242, 242)" );
    expect ( visibleSemanticColors.serverLabel ).toBe ( "rgb(242, 242, 242)" );
    expect ( visibleSemanticColors.serverStatus ).toBe ( "rgb(126, 231, 135)" );

    await expectReviewedScreenshot ( page, testInfo, "shell-dark.png" );
} );

test ( "AL-RSP-001 exposes Model, Detail, and Console as exclusive medium-width regions", async ( { page } ) =>
{
    await page.setViewportSize ( { height: 760, width: 900 } );

    await page.getByRole ( "button", { name: "Model", exact: true } ).click ();
    await expect ( page.getByRole ( "complementary", { name: "Model" } ) ).toBeVisible ();
    await expect ( page.getByRole ( "region", { name: "Detail" } ) ).toBeHidden ();

    await page.getByRole ( "button", { name: "Console", exact: true } ).click ();
    await expect ( page.getByRole ( "region", { name: "Console" } ) ).toBeVisible ();
    await expect ( page.getByRole ( "complementary", { name: "Model" } ) ).toBeHidden ();

    await page.getByRole ( "button", { name: "Detail", exact: true } ).click ();
    await expect ( page.getByRole ( "region", { name: "Detail" } ) ).toBeVisible ();
} );

test ( "AL-RSP-002 reflows at 320 CSS pixels without page-level horizontal scrolling", async ( { page }, testInfo ) =>
{
    // The narrow screenshot fixes the theme to Light so the comparison isolates responsive reflow.
    // Theme variation therefore cannot mask a layout regression.

    await page.locator ( "[data-toolbar-entry='toolbar-theme']" ).click ();
    await page.getByRole ( "menuitemradio", { name: "Light" } ).click ();
    await expect ( page.locator ( ".application-shell" ) ).toHaveAttribute ( "data-theme", "light" );
    await page.setViewportSize ( { height: 720, width: 320 } );
    await page.getByRole ( "button", { name: "Console", exact: true } ).click ();
    await expect ( page.getByRole ( "region", { name: "Console" } ) ).toBeVisible ();
    await page.getByRole ( "button", { name: "Detail", exact: true } ).click ();

    const dimensions = await page.evaluate (
        () => ( {
            bodyScrollWidth: document.body.scrollWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
        } )
    );

    expect ( dimensions.bodyScrollWidth ).toBeLessThanOrEqual ( dimensions.viewportWidth );
    expect ( dimensions.documentScrollWidth ).toBeLessThanOrEqual ( dimensions.viewportWidth );
    await expectReviewedScreenshot ( page, testInfo, "shell-narrow.png" );
} );

test ( "AC-003 and AC-022 create and edit an incomplete draft through keyboard-operable controls", async ( { page } ) =>
{
    await createNewDocument ( page );
    await expect ( page.getByRole ( "heading", { name: /State Machine.*Initialization/u } ) ).toBeVisible ();
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-save']" ) ).toBeEnabled ();
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-push']" ) ).toBeDisabled ();

    await page.getByRole ( "treeitem", { name: "States", exact: true } ).focus ();
    await page.keyboard.press ( "Enter" );
    await expect ( page.getByRole ( "heading", { name: /State Machine.*States/u } ) ).toBeFocused ();
    const addStateButton = page.locator ( ".states-list-pane" ).getByRole ( "button", { name: "Add" } );

    await addStateButton.focus ();
    await expect ( addStateButton ).toBeFocused ();
    await addStateButton.press ( "Enter" );
    await page.getByRole ( "textbox", { name: "Name" } ).fill ( "state_keyboard" );
    await page.getByRole ( "button", { name: "Confirm" } ).focus ();
    await page.keyboard.press ( "Enter" );

    await page.getByRole ( "treeitem", { name: "State Machine" } ).focus ();
    await page.keyboard.press ( "Enter" );
    await page.getByRole ( "combobox", { name: "Initial State" } ).selectOption ( "state_keyboard" );

    const initializationLayout = await page.locator ( ".initialization-form" ).evaluate ( form =>
    {
        // Initialize the local values needed by this operation.

        const labelWidths = Array.from ( form.querySelectorAll <HTMLElement> ( ".form-field-label-text" ) )
            .map ( label => label.getBoundingClientRect ().width );
        const controlOffsets = Array.from ( form.querySelectorAll <HTMLElement> ( ".form-field > div" ) )
            .map ( control => Math.round ( control.getBoundingClientRect ().left ) );


        // Return the assembled result.

        return {
            controlOffsets,
            labelColumnWidth: Number.parseFloat (
                getComputedStyle ( form ).getPropertyValue ( "--initialization-label-column-width" )
            ),
            longestLabelWidth: Math.max ( ...labelWidths ),
        };
    } );

    expect ( initializationLayout.labelColumnWidth )
        .toBe ( Math.ceil ( initializationLayout.longestLabelWidth * 1.1 ) );
    expect ( new Set ( initializationLayout.controlOffsets ).size ).toBe ( 1 );

    await expect ( page.locator ( "[data-toolbar-entry='toolbar-save']" ) ).toBeEnabled ();
    await expect ( page.getByText ( "States: 1" ) ).toBeVisible ();
    await expect ( page ).toHaveTitle ( /Unsaved changes/u );

    await page.setViewportSize ( { height: 720, width: 320 } );
    await page.getByRole ( "button", { name: "Detail", exact: true } ).click ();

    const dimensions = await page.evaluate ( () => ( {
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth:       window.innerWidth,
    } ) );

    expect ( dimensions.documentScrollWidth ).toBeLessThanOrEqual ( dimensions.viewportWidth );
    await expect ( page.getByRole ( "combobox", { name: "Initial State" } ) ).toBeVisible ();
} );

test ( "Phase 4 solves in a worker, reviews all candidate evidence, confirms Apply, and undoes replacement", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();

    const openChooserPromise = page.waitForEvent ( "filechooser" );

    await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
    await ( await openChooserPromise ).setFiles (
        fileURLToPath ( new URL ( "../fixtures/state-machine-comprehensive.json", import.meta.url ) ),
    );
    await page.getByRole ( "treeitem", { name: "Solver" } ).click ();
    await expect ( page.getByRole ( "heading", { name: "Sample Sequences" } ) ).toBeVisible ();
    await expect ( page.getByText ( "Exit Actions: 2" ) ).toBeVisible ();

    await page.getByRole ( "button", { name: "Solve", exact: true } ).click ();
    await expect ( page.getByRole ( "heading", { name: "Candidate Review" } ) ).toBeVisible ();
    await expect ( page.getByRole ( "tablist", { name: "Candidate review views" } ).getByRole ( "tab" ) ).toHaveCount ( 7 );
    await page.getByRole ( "tab", { name: "State Chart" } ).click ();


    // Initialize the local values needed by this operation.

    const candidateChart          = page.getByRole ( "img", { name: "State Chart" } );
    const expandChartStatesButton = page.locator ( "[data-toolbar-entry='toolbar-expand-chart-states']" );

    await expect ( candidateChart.locator ( ".solver-chart-state-box" ).first () ).toHaveAttribute ( "rx", "10" );
    await expect ( candidateChart ).toHaveAttribute ( "data-zoom", "1.00" );

    const candidateChartBounds = await candidateChart.boundingBox ();

    expect ( candidateChartBounds ).not.toBeNull ();


    // Handle the case where candidate chart bounds matches an absent value.

    if ( candidateChartBounds === null )
    {
        throw new Error ( "The Candidate State Chart has no rendered bounds." );
    }


    // Initialize the local values needed by this operation.

    const chartPointerX = candidateChartBounds.x + candidateChartBounds.width / 2;
    const chartPointerY = candidateChartBounds.y + candidateChartBounds.height / 2;

    await page.mouse.move ( chartPointerX, chartPointerY );
    await page.mouse.wheel ( 0, -240 );
    await expect ( candidateChart ).toHaveAttribute ( "data-zoom", "1.10" );


    // Initialize the local values needed by this operation.

    const panXBeforeDrag = Number ( await candidateChart.getAttribute ( "data-pan-x" ) );
    const panYBeforeDrag = Number ( await candidateChart.getAttribute ( "data-pan-y" ) );

    await page.mouse.move ( chartPointerX, chartPointerY );
    await page.mouse.down ( { button: "left" } );
    await page.mouse.move ( chartPointerX + 60, chartPointerY + 40, { steps: 4 } );
    await page.mouse.up ( { button: "left" } );
    expect ( Number ( await candidateChart.getAttribute ( "data-pan-x" ) ) ).not.toBe ( panXBeforeDrag );
    expect ( Number ( await candidateChart.getAttribute ( "data-pan-y" ) ) ).not.toBe ( panYBeforeDrag );
    await expect ( candidateChart.getByText ( "Entry Actions" ).first () ).toBeVisible ();
    await expect ( candidateChart.getByText ( "Exit Actions" ).first () ).toBeVisible ();
    await expect ( expandChartStatesButton ).toBeEnabled ();
    await expect ( expandChartStatesButton ).toHaveAttribute ( "aria-pressed", "true" );
    await expandChartStatesButton.click ();
    await expect ( expandChartStatesButton ).toHaveAttribute ( "aria-pressed", "false" );
    await expect ( candidateChart.getByText ( "Entry Actions" ) ).toHaveCount ( 0 );
    await expect ( candidateChart.locator ( ".solver-chart-state-box" ).first () ).toHaveAttribute ( "height", "60" );
    await expect ( page.getByRole ( "button", { name: "Apply Candidate" } ) ).toBeEnabled ();
    await expandChartStatesButton.click ();

    await page.getByRole ( "tab", { name: "Trace Coverage" } ).click ();
    await expect ( page.getByRole ( "heading", { name: "initial_to_complete" } ) ).toBeVisible ();
    await page.getByRole ( "tab", { name: "Inference Report" } ).click ();
    await expect ( page.getByText ( /not prove uniqueness or global state minimality/iu ) ).toBeVisible ();

    await page.getByRole ( "button", { name: "Apply Candidate" } ).click ();
    await expect ( page.getByRole ( "dialog", { name: "Replace state machine with Solver candidate?" } ) ).toBeVisible ();
    await page.getByRole ( "button", { name: "Cancel" } ).click ();
    await expect ( page.getByText ( "Exit Actions: 2" ) ).toBeVisible ();

    await page.getByRole ( "button", { name: "Apply Candidate" } ).click ();
    await page.getByRole ( "button", { name: "Replace State Machine" } ).click ();
    await expect ( page.getByText ( "Exit Actions: 0" ) ).toBeVisible ();
    await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
    await expect ( page.getByText ( "Exit Actions: 2" ) ).toBeVisible ();
} );

test ( "Solver fills its Sequence pane and infers a complete model from human-friendly event/action observations", async ( { page } ) =>
{
    await createNewDocument ( page );
    await page.getByRole ( "treeitem", { name: "Solver" } ).click ();
    await expect ( page.getByRole ( "option", { name: /observation_1.*infer/u } ) ).toBeVisible ();

    const sequenceEditor = page.getByRole ( "textbox", { name: "Sequence" } );

    await sequenceEditor.fill (
        "event-start\nevent-next\naction-left\nevent-next\nevent-next\nevent-next\naction-right\nevent-next\naction-left\nevent-stop",
    );
    await expect ( page.getByText ( "One token per line" ) ).toHaveCount ( 0 );


    // Calculate the editor fill ratio value from the current inputs.

    const editorFillRatio = await page.locator ( ".solver-token-editor" ).evaluate ( editorPane =>
    {
        // Initialize the local values needed by this operation.

        const textArea = editorPane.querySelector ( "textarea" );


        // Handle the case where text area matches an absent value.

        if ( textArea === null )
        {
            // Return the computed result.

            return 0;
        }


        // Return the computed result.

        return textArea.getBoundingClientRect ().height / editorPane.getBoundingClientRect ().height;
    } );

    expect ( editorFillRatio ).toBeGreaterThan ( 0.7 );
    const sequenceCommandButtons = await page.locator ( ".solver-page-command-bar button" ).allTextContents ();

    expect ( sequenceCommandButtons ).toEqual ( [ "Validate Sequences", "Solve" ] );
    await expect ( page.getByRole ( "button", { name: /^(Move Up|Move Down|Add|Delete|Edit)$/u } ) ).toHaveCount ( 5 );


    // Initialize the local values needed by this operation.

    const sequenceListCommandBarAlignment = await page.locator ( ".solver-sequence-actions" ).evaluate ( commandBar =>
    {
        // Initialize the local values needed by this operation.

        const editButton = commandBar.querySelector ( "button:last-of-type" );


        // Return the result selected by the current condition.

        return editButton === null
            ? Number.POSITIVE_INFINITY
            : Math.abs ( commandBar.getBoundingClientRect ().right - editButton.getBoundingClientRect ().right );
    } );

    const pageCommandBarAlignment = await page.locator ( ".solver-page-command-bar" ).evaluate ( commandBar =>
    {
        // Initialize the local values needed by this operation.

        const solveButton = commandBar.querySelector ( "button:last-of-type" );


        // Return the result selected by the current condition.

        return solveButton === null
            ? Number.POSITIVE_INFINITY
            : Math.abs ( commandBar.getBoundingClientRect ().right - solveButton.getBoundingClientRect ().right );
    } );

    expect ( sequenceListCommandBarAlignment ).toBeLessThanOrEqual ( 1 );
    // The page command bar's trailing inset matches the page inset so Solve aligns with the
    // Sequence editor.

    expect ( pageCommandBarAlignment ).toBeCloseTo ( 18, 3 );


    // Initialize the local values needed by this operation.

    const sequenceSplitter          = page.getByRole ( "separator", { name: "Resize Sample Sequences" } );
    const originalSequenceListWidth = Number ( await sequenceSplitter.getAttribute ( "aria-valuenow" ) );

    await sequenceSplitter.focus ();
    await page.keyboard.press ( "ArrowRight" );
    await expect ( sequenceSplitter ).toHaveAttribute ( "aria-valuenow", String ( originalSequenceListWidth + 12 ) );
    expect ( await page.locator ( ".solver-sequence-list" ).evaluate ( element => element.getBoundingClientRect ().width ) )
        .toBe ( originalSequenceListWidth + 12 );

    await page.keyboard.press ( "Home" );
    const minimumSequencePaneGeometry = await page.locator ( ".solver-sequence-list" ).evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const commandBar          = element.querySelector ( ".solver-sequence-actions" );
        const paneRectangle       = element.getBoundingClientRect ();
        const commandBarRectangle = commandBar?.getBoundingClientRect ();


        // Return the assembled result.

        return {
            commandBarRight: commandBarRectangle?.right ?? Number.POSITIVE_INFINITY,
            paneRight:       paneRectangle.right,
            paneWidth:       paneRectangle.width,
        };
    } );

    expect ( minimumSequencePaneGeometry.paneWidth )
        .toBe ( Number ( await sequenceSplitter.getAttribute ( "aria-valuemin" ) ) );
    expect ( minimumSequencePaneGeometry.commandBarRight )
        .toBeLessThanOrEqual ( minimumSequencePaneGeometry.paneRight + 1 );

    await page.keyboard.press ( "End" );
    expect ( await page.locator ( ".solver-token-editor" ).evaluate ( element => element.getBoundingClientRect ().width ) )
        .toBeGreaterThanOrEqual ( 360 );
    await page.getByRole ( "button", { name: "Validate Sequences" } ).click ();
    await expect ( page.getByRole ( "gridcell", { name: "Solver sequence syntax and direct constraints are valid." } ).first () ).toBeVisible ();
    await page.getByRole ( "button", { name: "Solve", exact: true } ).click ();
    await expect ( page.getByRole ( "gridcell", { name: /Solver inference started for 1 sequence\(s\) and 10 token\(s\)/u } ).first () ).toBeVisible ();
    await expect ( page.getByRole ( "gridcell", { name: /Building and merging Solver evidence/u } ).first () ).toBeVisible ();
    await expect ( page.getByRole ( "heading", { name: "Candidate Review" } ) ).toBeVisible ();
    await page.getByRole ( "tab", { name: "Inference Report" } ).click ();
    await expect ( page.getByText ( /initial state was inferred/iu ) ).toBeVisible ();

    await page.getByRole ( "button", { name: "Apply Candidate" } ).click ();
    await page.getByRole ( "button", { name: "Replace State Machine" } ).click ();
    await expect ( page.getByText ( /^States: [1-9]\d*$/u ) ).toBeVisible ();
    await expect ( page.getByText ( /^Initial State: state_/u ) ).toBeVisible ();
} );

test ( "Phase 4 imports and exports a typed Solver observation sequence through CSV", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showDirectoryPicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showSaveFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();

    const openChooserPromise = page.waitForEvent ( "filechooser" );

    await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
    await ( await openChooserPromise ).setFiles (
        fileURLToPath ( new URL ( "../fixtures/state-machine-comprehensive.json", import.meta.url ) ),
    );
    await page.getByRole ( "treeitem", { name: "Solver" } ).click ();

    const importChooserPromise = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Import from CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "Solver Observation Sequence" } ).click ();
    await ( await importChooserPromise ).setFiles (
        {
            buffer: Buffer.from ( "name,type\r\nstart,event\r\nstate_ready,state\r\nenter,action\r\n" ),
            mimeType: "text/csv",
            name: "solver.csv",
        },
    );
    await page.getByRole ( "textbox", { name: "Sequence Name" } ).fill ( "csv_sequence" );
    await page.getByRole ( "button", { name: "Confirm" } ).click ();
    await expect ( page.getByRole ( "option", { name: /csv_sequence/iu } ) ).toBeVisible ();

    const downloadPromise = page.waitForEvent ( "download" );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Export to CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "Solver Observation Sequence" } ).click ();
    await page.getByRole ( "combobox", { name: "Sequence Name" } ).selectOption ( "csv_sequence" );
    await page.getByRole ( "button", { name: "Confirm" } ).click ();

    const download = await downloadPromise;

    expect ( download.suggestedFilename () ).toContain ( "csv-sequence-solver-observation.csv" );
} );

test ( "Phase 3 imports and exports Editor CSV data through the nested File menus", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showSaveFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();
    await createNewDocument ( page );

    const fileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Import from CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "States", exact: true } ).click ();
    await ( await fileChooserPromise ).setFiles (
        {
            buffer:   Buffer.from ( "name,description,ignored\r\nstate_one,First state,x\r\nstate_two,Second state,y\r\n" ),
            mimeType: "text/csv",
            name:     "states.csv",
        },
    );

    await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();
    await expect ( page.getByRole ( "option", { name: "state_one" } ) ).toBeVisible ();
    await expect ( page.getByRole ( "option", { name: "state_two" } ) ).toBeVisible ();
    await expect ( page.getByText ( "CSV_IMPORT_COMPLETED", { exact: true } ) ).toBeVisible ();

    const overwriteFileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Import from CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "States", exact: true } ).click ();
    await ( await overwriteFileChooserPromise ).setFiles (
        {
            buffer:   Buffer.from ( "name,description\r\nstate_one,Updated first state\r\n" ),
            mimeType: "text/csv",
            name:     "updated-states.csv",
        },
    );

    const overwriteDialog = page.getByRole ( "dialog", { name: "Confirm CSV overwrite" } );

    await expect ( overwriteDialog ).toContainText ( "state_one" );
    await overwriteDialog.getByRole ( "button", { name: "Overwrite" } ).click ();
    const editStateButton = page.locator ( ".states-list-pane" ).getByRole ( "button", { name: "Edit" } );

    await editStateButton.focus ();
    await editStateButton.press ( "Enter" );
    await expect ( page.getByRole ( "textbox", { name: "Description" } ) ).toHaveValue ( "Updated first state" );
    await page.getByRole ( "button", { name: "Cancel" } ).click ();

    const downloadPromise = page.waitForEvent ( "download" );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Export to CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "States", exact: true } ).click ();

    const download = await downloadPromise;

    expect ( download.suggestedFilename () ).toBe ( "untitled-state-machine-states.csv" );
    await expect ( page.getByText ( "CSV_EXPORT_COMPLETED", { exact: true } ) ).toBeVisible ();
} );

test ( "Phase 3 rejects an invalid CSV import atomically and reports it in the Console and a modal", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();
    await createNewDocument ( page );

    const fileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Import from CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "States", exact: true } ).click ();
    await ( await fileChooserPromise ).setFiles (
        {
            buffer: Buffer.from (
                "name,description\r\nstate_one,First\r\nstate_duplicate,One\r\nstate_duplicate,Two\r\n",
            ),
            mimeType: "text/csv",
            name:     "duplicate-states.csv",
        },
    );

    const errorDialog = page.getByRole ( "dialog", { name: "Error" } );

    await expect ( errorDialog ).toBeVisible ();
    await expect ( errorDialog ).toContainText ( "occurs more than once" );
    await expect ( page.getByText ( "CSV_DUPLICATE_KEY", { exact: true } ) ).toBeVisible ();
    await errorDialog.getByRole ( "button", { name: "OK" } ).click ();
    await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();
    await expect ( page.getByRole ( "option" ) ).toHaveCount ( 0 );
} );

test ( "Phase 8 extension imports one Model Metadata record, warns about extras, and exports it", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showSaveFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();
    await createNewDocument ( page );

    const statesChooserPromise = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Import from CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "States", exact: true } ).click ();
    await ( await statesChooserPromise ).setFiles (
        {
            buffer:   Buffer.from ( "name,description\r\nstate_one,One\r\nstate_two,Two\r\n" ),
            mimeType: "text/csv",
            name:     "states.csv",
        },
    );

    const metadataChooserPromise = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Import from CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "Model Metadata" } ).click ();
    await ( await metadataChooserPromise ).setFiles (
        {
            buffer: Buffer.from (
                "name,description,version,initial_state\r\nImported Model,First row,2.3.4,state_two\r\nIgnored Model,Second row,9.9.9,state_one\r\n",
            ),
            mimeType: "text/csv",
            name:     "metadata.csv",
        },
    );

    const warningDialog = page.getByRole ( "dialog", { name: "Warning" } );

    await expect ( warningDialog ).toContainText ( "Only the first data row was imported" );
    await expect ( page.getByText ( "CSV_MODEL_METADATA_EXTRA_ROWS", { exact: true } ) ).toBeVisible ();
    await warningDialog.getByRole ( "button", { name: "OK" } ).click ();
    await page.getByRole ( "treeitem", { name: "State Machine" } ).click ();
    await expect ( page.getByRole ( "textbox", { name: "Name" } ) ).toHaveValue ( "Imported Model" );
    await expect ( page.getByRole ( "textbox", { name: "Description" } ) ).toHaveValue ( "First row" );
    await expect ( page.getByRole ( "textbox", { name: "Version" } ) ).toHaveValue ( "2.3.4" );
    await expect ( page.getByRole ( "combobox", { name: "Initial State" } ) ).toHaveValue ( "state_two" );

    const downloadPromise = page.waitForEvent ( "download" );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Export to CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "Model Metadata" } ).click ();

    const download = await downloadPromise;

    expect ( download.suggestedFilename () ).toBe ( "imported-model-model-metadata.csv" );
} );

test ( "Phase 8 extension exposes copyable undeclared Transition Table states above events", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();
    await createNewDocument ( page );


    // Process each transfer from the current value collection in order.

    for ( const transfer of [
        { name: "States", fileName: "states.csv", text: "name,description\r\nstate_one,One\r\n" },
        { name: "Events", fileName: "events.csv", text: "name,description\r\nevent_one,One\r\n" },
    ] )
    {
        // Initialize the local values needed by this operation.

        const chooserPromise = page.waitForEvent ( "filechooser" );

        await page.getByRole ( "menuitem", { name: "File" } ).click ();
        await page.getByRole ( "menuitem", { name: "Import from CSV" } ).click ();
        await page.getByRole ( "menuitem", { name: transfer.name, exact: true } ).click ();
        await ( await chooserPromise ).setFiles (
            { buffer: Buffer.from ( transfer.text ), mimeType: "text/csv", name: transfer.fileName },
        );
    }

    const transitionChooserPromise = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Import from CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "Transition Table" } ).click ();
    await ( await transitionChooserPromise ).setFiles (
        {
            buffer: Buffer.from (
                "state,event,next_state\r\nmissing_source,missing_second,missing_target\r\nmissing_target,missing_first,missing_source\r\nmissing_third,missing_second,state_one\r\n",
            ),
            mimeType: "text/csv",
            name:     "transitions.csv",
        },
    );


    // Initialize the local values needed by this operation.

    const dialog    = page.getByRole ( "dialog", { name: "Missing Transition Table references" } );
    const textAreas = dialog.getByRole ( "textbox" );

    await expect ( textAreas ).toHaveCount ( 2 );
    await expect ( textAreas.nth ( 0 ) ).toHaveAccessibleName ( "Missing States" );
    await expect ( textAreas.nth ( 0 ) ).toHaveValue ( "missing_source\nmissing_target\nmissing_third" );
    await expect ( textAreas.nth ( 0 ) ).toHaveAttribute ( "readonly" );
    await textAreas.nth ( 0 ).focus ();
    await textAreas.nth ( 0 ).selectText ();
    expect ( await textAreas.nth ( 0 ).evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const textArea = element as HTMLTextAreaElement;


        // Return the slice result.

        return textArea.value.slice ( textArea.selectionStart, textArea.selectionEnd );
    } ) ).toBe ( "missing_source\nmissing_target\nmissing_third" );
    await expect ( textAreas.nth ( 1 ) ).toHaveAccessibleName ( "Missing Events" );
    await expect ( textAreas.nth ( 1 ) ).toHaveValue ( "missing_second\nmissing_first" );
    await expect ( textAreas.nth ( 1 ) ).toHaveAttribute ( "readonly" );
    await expect ( page.getByText ( "CSV_REFERENCE_INVALID", { exact: true } ).first () ).toBeVisible ();
} );

test ( "Phase 8 extension saves and reopens a metadata-only project with requirement warnings", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showDirectoryPicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showSaveFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();
    await createNewDocument ( page );

    await page.getByRole ( "textbox", { name: "Name" } ).fill ( "Metadata Only Project" );
    await page.getByRole ( "textbox", { name: "Name" } ).press ( "Tab" );
    await page.getByRole ( "textbox", { name: "Description" } ).fill ( "Saved before model definition" );
    await page.getByRole ( "textbox", { name: "Description" } ).press ( "Tab" );
    await page.getByRole ( "textbox", { name: "Version" } ).fill ( "2.3.4" );
    await page.getByRole ( "textbox", { name: "Version" } ).press ( "Tab" );

    await expect ( page.locator ( "[data-toolbar-entry='toolbar-save']" ) ).toBeEnabled ();
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-save-as']" ) ).toBeEnabled ();
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-push']" ) ).toBeDisabled ();
    await page.locator ( "[data-toolbar-entry='toolbar-save-as']" ).click ();

    const saveWarning = page.getByRole ( "dialog", { name: "Save incomplete project?" } );

    await expect ( saveWarning ).toBeVisible ();
    await expect ( saveWarning ).toContainText ( "The state machine does not define any states." );
    await expect ( saveWarning ).toContainText ( "The state machine does not define an initial state." );
    await saveWarning.getByRole ( "button", { name: "Cancel" } ).click ();
    await expect ( saveWarning ).toHaveCount ( 0 );
    await expect ( page.getByText ( "FILE_SAVED_WITHOUT_STATES", { exact: true } ) ).toHaveCount ( 0 );
    await expect ( page.getByText ( "FILE_SAVED_WITHOUT_INITIAL_STATE", { exact: true } ) ).toHaveCount ( 0 );

    await page.locator ( "[data-toolbar-entry='toolbar-save-as']" ).click ();
    await expect ( saveWarning ).toBeVisible ();

    const downloadPromise = page.waitForEvent ( "download" );

    await saveWarning.getByRole ( "button", { name: "Save Anyway" } ).click ();


    // Initialize the local values needed by this operation.

    const download  = await downloadPromise;
    const savedPath = await download.path ();

    expect ( savedPath ).not.toBeNull ();
    await expect ( page.getByText ( "FILE_SAVED_WITHOUT_STATES", { exact: true } ) ).toBeVisible ();
    await expect ( page.getByText ( "FILE_SAVED_WITHOUT_INITIAL_STATE", { exact: true } ) ).toBeVisible ();


    // Handle the case where saved path matches an absent value.

    if ( savedPath === null )
    {
        throw new Error ( "The metadata-only project download did not produce a readable file." );
    }

    const saved = JSON.parse ( readFileSync ( savedPath, "utf8" ) ) as {
        settings: { description: string; name: string; version: string };
        state_machine: { initial_state: string | null; states: readonly unknown[] };
    };

    expect ( saved.settings ).toEqual (
        { name: "Metadata Only Project", description: "Saved before model definition", version: "2.3.4" },
    );
    expect ( saved.state_machine.initial_state ).toBeNull ();
    expect ( saved.state_machine.states ).toEqual ( [] );

    const chooserPromise = page.waitForEvent ( "filechooser" );

    await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
    await ( await chooserPromise ).setFiles ( savedPath );

    const openWarning = page.getByRole ( "dialog", { name: "Incomplete project opened" } );

    await expect ( openWarning ).toContainText ( "The state machine does not define any states." );
    await expect ( openWarning ).toContainText ( "The state machine does not define an initial state." );
    await expect ( page.getByText ( "STATE_DEFINITIONS_MISSING", { exact: true } ) ).toBeVisible ();
    await expect ( page.getByText ( "INITIAL_STATE_UNDEFINED", { exact: true } ) ).toBeVisible ();
    await openWarning.getByRole ( "button", { name: "OK" } ).click ();
    await page.getByRole ( "treeitem", { name: "State Machine" } ).click ();

    await expect ( page.getByRole ( "textbox", { name: "Name" } ) ).toHaveValue ( "Metadata Only Project" );
    await expect ( page.getByRole ( "textbox", { name: "Description" } ) )
        .toHaveValue ( "Saved before model definition" );
    await expect ( page.getByRole ( "textbox", { name: "Version" } ) ).toHaveValue ( "2.3.4" );
} );

test ( "Save As uses a filename picker with JSON and All Files choices", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        // Initialize the local values needed by this operation.

        const pickerTestWindow = window as typeof window & {
            directoryPickerCallCount: number;
            savePickerOptions: {
                readonly excludeAcceptAllOption?: boolean;
                readonly suggestedName?:          string;
                readonly types?: readonly {
                    readonly accept:      Readonly<Record<string, readonly string[]>>;
                    readonly description?: string;
                }[];
            } | null;
        };

        pickerTestWindow.directoryPickerCallCount = 0;
        pickerTestWindow.savePickerOptions        = null;
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty (
            window,
            "showDirectoryPicker",
            {
                configurable: true,
                value: () =>
                {
                    pickerTestWindow.directoryPickerCallCount++;
                    throw new Error ( "Save As must not open the directory picker when a save-file picker is available." );
                },
            },
        );
        Object.defineProperty (
            window,
            "showSaveFilePicker",
            {
                configurable: true,
                value: async ( options: typeof pickerTestWindow.savePickerOptions ) =>
                {
                    pickerTestWindow.savePickerOptions = options;


                    // Return the assembled result.

                    return {
                        createWritable: async () => ( {
                            close: async () => undefined,
                            write: async () => undefined,
                        } ),
                        name: "selected-state-machine.json",
                    };
                },
            },
        );
    } );
    await page.reload ();


    // Initialize the local values needed by this operation.

    const examplePath        = fileURLToPath ( new URL ( "../../../examples/state-machine-light-switch.json", import.meta.url ) );
    const fileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
    await ( await fileChooserPromise ).setFiles ( examplePath );
    await expect ( page ).toHaveTitle ( /state-machine-light-switch\.json/u );
    await page.locator ( "[data-toolbar-entry='toolbar-save-as']" ).click ();
    await expect ( page ).toHaveTitle ( /selected-state-machine\.json/u );

    const pickerUsage = await page.evaluate ( () =>
    {
        // Initialize the local values needed by this operation.

        const pickerTestWindow = window as typeof window & {
            directoryPickerCallCount: number;
            savePickerOptions: {
                readonly excludeAcceptAllOption?: boolean;
                readonly suggestedName?:          string;
                readonly types?: readonly {
                    readonly accept:      Readonly<Record<string, readonly string[]>>;
                    readonly description?: string;
                }[];
            } | null;
        };


        // Return the assembled result.

        return {
            directoryPickerCallCount: pickerTestWindow.directoryPickerCallCount,
            savePickerOptions:        pickerTestWindow.savePickerOptions,
        };
    } );

    expect ( pickerUsage.directoryPickerCallCount ).toBe ( 0 );
    expect ( pickerUsage.savePickerOptions ).toEqual (
        {
            excludeAcceptAllOption: false,
            suggestedName:          "state-machine-light-switch.json",
            types:
            [
                {
                    accept: { "application/json": [ ".json" ] },
                    description: "JSON files",
                },
            ],
        },
    );
} );

test ( "AC-001 and AC-020 round-trip JSON with one download per fallback save", async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showDirectoryPicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showSaveFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();


    // Initialize the local values needed by this operation.

    const examplePath        = fileURLToPath ( new URL ( "../../../examples/state-machine-light-switch.json", import.meta.url ) );
    const fileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
    await ( await fileChooserPromise ).setFiles ( examplePath );
    await expect ( page ).toHaveTitle ( /state-machine-light-switch\.json/u );
    await expect ( page.getByText ( "States: 4" ) ).toBeVisible ();

    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "Transition Table" } ).click ();

    // Initialize the local values needed by this operation.

    const transitionRows       = page.locator ( ".data-grid > [role='row']" );
    const firstTransitionRow   = transitionRows.nth ( 1 );
    const secondTransitionRow  = transitionRows.nth ( 2 );
    const firstNextStateCell   = firstTransitionRow.getByRole ( "gridcell" ).nth ( 2 );
    const firstNextStateButton = page.getByRole (
        "button",
        { name: "Open selection list: Next State 1", exact: true },
    );

    await secondTransitionRow.getByRole ( "gridcell" ).nth ( 2 ).click ();
    await expect ( secondTransitionRow ).toHaveAttribute ( "aria-selected", "true" );
    await firstNextStateButton.click ();
    await expect ( firstTransitionRow ).toHaveAttribute ( "aria-selected", "false" );
    await expect ( secondTransitionRow ).toHaveAttribute ( "aria-selected", "true" );

    const nextStateListBox = page.getByRole ( "listbox", { name: "Next State 1" } );

    await expect ( nextStateListBox ).toBeVisible ();
    await nextStateListBox.getByRole ( "option", { name: "state_on", exact: true } ).click ();
    await expect ( firstNextStateCell.locator ( ".drop-down-list-box-value" ) ).toHaveText ( "state_on" );
    await expect ( secondTransitionRow ).toHaveAttribute ( "aria-selected", "true" );

    await firstNextStateCell.locator ( ".drop-down-list-box-value" ).click ();
    await expect ( firstTransitionRow ).toHaveAttribute ( "aria-selected", "true" );
    await expect ( page.getByRole ( "listbox", { name: "Next State 1" } ) ).not.toBeVisible ();

    await page.getByRole ( "button", { name: "Edit", exact: true } ).click ();
    const transitionDialog = page.getByRole ( "dialog", { name: "Transition" } );

    await expect ( transitionDialog ).toBeVisible ();
    await expect ( transitionDialog.getByRole ( "combobox", { name: "Next State" } ) ).toHaveValue ( "state_on" );
    await transitionDialog.getByRole ( "button", { name: "Cancel" } ).click ();

    const saveAsDownloadPromise = page.waitForEvent ( "download" );

    await page.locator ( "[data-toolbar-entry='toolbar-save-as']" ).click ();


    // Initialize the local values needed by this operation.

    const saveAsDownload = await saveAsDownloadPromise;
    const savedPath      = await saveAsDownload.path ();

    expect ( saveAsDownload.suggestedFilename () ).toBe ( "state-machine-light-switch.json" );
    expect ( savedPath ).not.toBeNull ();

    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "State Machine" } ).click ();
    await page.getByRole ( "textbox", { name: "Name" } ).fill ( "Light Switch Edited" );
    await page.getByRole ( "textbox", { name: "Name" } ).press ( "Tab" );
    await expect ( page ).toHaveTitle ( /Unsaved changes/u );

    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();

    // Initialize the local values needed by this operation.

    const settingsDialog = page.getByRole ( "dialog", { name: "Application Settings" } );
    const saveBackup     = settingsDialog.getByRole ( "checkbox", { name: "Save Backup" } );

    await expect ( saveBackup ).not.toBeChecked ();
    await saveBackup.check ();
    await settingsDialog.getByRole ( "button", { name: "Apply" } ).click ();
    await expect ( settingsDialog ).toBeHidden ();

    const downloads: string[] = [];

    page.on ( "download", download => downloads.push ( download.suggestedFilename () ) );
    await page.locator ( "[data-toolbar-entry='toolbar-save']" ).click ();
    await expect.poll ( () => downloads.length ).toBe ( 1 );
    expect ( downloads ).toEqual ( [ "state-machine-light-switch.json" ] );
    await expect ( page.getByRole ( "dialog", { name: "Warning" } ) ).toHaveCount ( 0 );
    await expect ( page.getByText ( "FILE_BACKUP_SKIPPED", { exact: true } ) ).toBeVisible ();


    // Handle the case where saved path differs from an absent value.

    if ( savedPath !== null )
    {
        // Initialize the local values needed by this operation.

        const reopenChooserPromise = page.waitForEvent ( "filechooser" );

        await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
        await ( await reopenChooserPromise ).setFiles ( savedPath );
        await expect ( page.getByText ( "States: 4" ) ).toBeVisible ();
    }
} );

test ( "AL-UI-012 aligns every standard action panel with the content above it", async ( { page } ) =>
{
    await page.goto ( "./" );
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-pull']" ) ).toBeEnabled ();
    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );


    //----------------------------------------------------------------------------------------------
    // Function: panelGeometry
    //
    // Description:
    //
    //   Derives the panel geometry.
    //
    // Parameters:
    //
    //   - panelSelector:
    //     The panel selector supplied to the operation.
    //
    //   - contentSelector:
    //     The content selector supplied to the operation.
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

    async function panelGeometry ( panelSelector: string, contentSelector: string )
    {
        // Return the evaluate result.

        return page.evaluate ( ( [ panelSel, contentSel ] ) =>
        {
            // Initialize the local values needed by this operation.

            const panel   = document.querySelector ( panelSel as string );
            const content = document.querySelector ( contentSel as string );


            // Handle the case where at least one branch condition is satisfied.

            if ( panel === null || content === null )
            {
                // Return the computed result.

                return null;
            }


            // Initialize the local values needed by this operation.

            const buttons = Array.from ( panel.querySelectorAll ( "button" ) );
            const last    = buttons [ buttons.length - 1 ];


            // Handle the case where last matches undefined.

            if ( last === undefined )
            {
                // Return the computed result.

                return null;
            }


            // Initialize the local values needed by this operation.

            const lastBox               = last.getBoundingClientRect ();
            const panelBox              = panel.getBoundingClientRect ();
            const style                 = window.getComputedStyle ( panel );
            const roundedTrailingOffset = Math.round ( lastBox.right - content.getBoundingClientRect ().right );


            // Return the assembled result.

            return {
                // Offset of the last button's right edge from the content's right edge, and the
                // panel's own insets.

                trailingOffset: Object.is ( roundedTrailingOffset, -0 ) ? 0 : roundedTrailingOffset,
                separatorToButton: Math.round (
                    lastBox.top - panelBox.top - Number.parseFloat ( style.borderTopWidth ),
                ),
                rowCount: new Set ( buttons.map ( button => Math.round ( button.getBoundingClientRect ().top ) ) ).size,
            };
        }, [ panelSelector, contentSelector ] );
    }

    // Every panel whose content carries the page inset lines its last button up with that content's
    // right edge.

    const editorPages =
    [
        { content: ".entity-list", tree: "Events" },
        { content: ".entity-list", tree: "Actions" },
        { content: ".data-grid", tree: "Transition Table" },
    ] as const;

    await openEditorNode ( page );


    // Process each target from the editor pages collection in order.

    for ( const target of editorPages )
    {
        await page.getByRole ( "treeitem", { name: target.tree, exact: true } ).click ();
        await expect.poll ( async () => await panelGeometry ( ".detail-button-panel", target.content ) ).toEqual (
            { trailingOffset: 0, separatorToButton: 8, rowCount: 1 },
        );
    }

    await page.locator ( "[data-toolbar-entry='toolbar-solver']" ).click ();
    await expect.poll (
        async () => await panelGeometry ( ".solver-page-command-bar", ".solver-token-editor textarea" ),
    ).toEqual ( { trailingOffset: 0, separatorToButton: 8, rowCount: 1 } );

    await page.locator ( "[data-toolbar-entry='toolbar-simulator']" ).click ();
    await expect ( page.getByRole ( "heading", { name: "Event Sequences" } ) ).toBeVisible ();
    await expect.poll (
        async () => await panelGeometry ( ".simulator-command-panel", ".simulator-inspector" ),
    ).toEqual ( { trailingOffset: 0, separatorToButton: 8, rowCount: 1 } );

    // Both panels on the States page align with their own pane rather than with the page.

    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();
    await expect.poll ( async () => await panelGeometry (
        ".states-list-pane .detail-button-panel",
        ".states-list-pane .entity-list",
    ) ).toEqual ( { trailingOffset: 0, separatorToButton: 8, rowCount: 1 } );
    await expect.poll ( async () => await panelGeometry (
        ".state-association-pane .detail-button-panel",
        ".state-association-pane .tabs",
    ) ).toEqual ( { trailingOffset: 0, separatorToButton: 8, rowCount: 1 } );

    // The Chart Canvas reaches the page edge, so its panel keeps the standard 8-pixel trailing
    // inset instead.

    await page.locator ( "[data-toolbar-entry='toolbar-chart']" ).click ();
    await expect ( page.locator ( ".chart-canvas" ) ).toBeVisible ();
    await expect.poll ( async () => await panelGeometry ( ".chart-command-panel", ".chart-canvas" ) ).toEqual (
        { trailingOffset: -8, separatorToButton: 8, rowCount: 1 },
    );
} );

test ( "AL-UI-013 lets the Chart Palette and Canvas fill their regions", async ( { page } ) =>
{
    await page.goto ( "./" );
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-pull']" ) ).toBeEnabled ();
    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
    await page.locator ( "[data-toolbar-entry='toolbar-chart']" ).click ();
    await expect ( page.locator ( ".chart-canvas" ) ).toBeVisible ();

    const regions = await page.evaluate ( () =>
    {
        //------------------------------------------------------------------------------------------
        // Function: round
        //
        // Description:
        //
        //   Rounds the requested value.
        //
        // Parameters:
        //
        //   - element:
        //     The element supplied to the operation.
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
        //------------------------------------------------------------------------------------------

        const round = ( element: Element | null ) =>
        {
            // Handle the case where element matches an absent value.

            if ( element === null )
            {
                // Return the computed result.

                return null;
            }

            const box = element.getBoundingClientRect ();


            // Return the assembled result.

            return { left: Math.round ( box.left ), right: Math.round ( box.right ), top: Math.round ( box.top ) };
        };


        // Return the assembled result.

        return {
            chartPage: round ( document.querySelector ( ".chart-page" ) ),
            palette: round ( document.querySelector ( "[aria-label='Palette']" ) ),
            canvas: round ( document.querySelector ( ".chart-canvas" ) ),
            detail: round ( document.querySelector ( ".detail-page" ) ),
        };
    } );


    // Handle the case where at least one branch condition is satisfied.

    if ( regions.chartPage === null || regions.palette === null || regions.canvas === null ||
        regions.detail === null )
    {
        throw new Error ( "The Chart regions were not rendered." );
    }

    // The Palette starts at its pane's leading and top edges; the Canvas continues from it to the
    // page's right edge.

    expect ( regions.palette.left ).toBe ( regions.chartPage.left );
    expect ( regions.palette.top ).toBe ( regions.chartPage.top );
    expect ( regions.canvas.left ).toBe ( regions.palette.right );
    expect ( regions.canvas.right ).toBe ( regions.detail.right );
} );

test ( "AL-UI-011 aligns the Entry and Exit action lists with their tab control border", async ( { page } ) =>
{
    await page.goto ( "./" );
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-pull']" ) ).toBeEnabled ();
    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();


    // Calculate the insets value from the current inputs.

    const insets = await page.evaluate ( () =>
    {
        // Initialize the local values needed by this operation.

        const panel = document.querySelector ( ".state-association-pane [role='tabpanel']" );
        const child = panel?.firstElementChild ?? null;


        // Handle the case where at least one branch condition is satisfied.

        if ( panel === null || child === null )
        {
            // Return the computed result.

            return null;
        }


        // Initialize the local values needed by this operation.

        const panelBox = panel.getBoundingClientRect ();
        const childBox = child.getBoundingClientRect ();
        const style    = window.getComputedStyle ( panel );


        // Return the assembled result.

        return {
            left: Math.round ( childBox.left - panelBox.left ),
            right: Math.round ( panelBox.right - childBox.right ),
            verticalPadding: `${style.paddingTop}/${style.paddingBottom}`,
        };
    } );

    // Horizontal inset is removed so the list meets the border; the vertical inset is deliberately
    // retained.

    expect ( insets ).toEqual ( { left: 0, right: 0, verticalPadding: "10px/10px" } );
} );

test ( "editable values support native clipboard operations", async ( { browserName, page } ) =>
{
    test.skip ( browserName !== "chromium", "Playwright exposes clipboard permissions only in Chromium." );
    await page.context ().grantPermissions ( [ "clipboard-read", "clipboard-write" ] );
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
    await page.getByRole ( "option", { name: "Chart" } ).click ();

    const gridColor = page.getByRole ( "textbox", { name: "Grid Color", exact: true } );

    await page.evaluate ( () => navigator.clipboard.writeText ( "#112233" ) );
    await gridColor.press ( "ControlOrMeta+A" );
    await gridColor.press ( "ControlOrMeta+V" );

    await expect ( gridColor ).toHaveValue ( "#112233" );
    await page.getByRole ( "button", { name: "Choose Grid Color" } ).click ();
    await expect ( page.getByRole ( "spinbutton", { name: "Red" } ) ).toHaveValue ( "17" );
    await expect ( page.getByRole ( "spinbutton", { name: "Green" } ) ).toHaveValue ( "34" );
    await expect ( page.getByRole ( "spinbutton", { name: "Blue" } ) ).toHaveValue ( "51" );

    const red   = page.getByRole ( "spinbutton", { name: "Red" } );
    const green = page.getByRole ( "spinbutton", { name: "Green" } );

    await red.press ( "ControlOrMeta+A" );
    await red.press ( "ControlOrMeta+C" );
    await green.press ( "ControlOrMeta+A" );
    await green.press ( "ControlOrMeta+V" );

    await expect ( green ).toHaveValue ( "17" );


    await page.getByRole ( "option", { name: "Server" } ).click ();

    const serverUrl = page.getByRole ( "textbox", { name: "URL", exact: true } );

    await page.evaluate ( () => navigator.clipboard.writeText ( "builtin://clipboard-test" ) );
    await serverUrl.press ( "ControlOrMeta+A" );
    await serverUrl.press ( "ControlOrMeta+V" );
    await expect ( serverUrl ).toHaveValue ( "builtin://clipboard-test" );
    await page.getByRole ( "button", { name: "Cancel" } ).click ();

} );
test ( "non-editable shell controls keep the arrow cursor while text-capable fields use the text cursor", async ( { page } ) =>
{
    await expect ( page.locator ( ".tree-disclosure" ) ).toBeVisible ();

    const treeCursors = await page.evaluate ( () => ( {
        disclosure: getComputedStyle ( document.querySelector ( ".tree-disclosure" ) as HTMLElement ).cursor,
        label:      getComputedStyle ( document.querySelector ( ".tree-row span:last-child" ) as HTMLElement ).cursor,
    } ) );

    expect ( treeCursors ).toEqual ( { disclosure: "default", label: "default" } );

    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
    await page.getByRole ( "option", { name: "Chart" } ).click ();
    await page.getByRole ( "button", { name: "Choose Grid Color" } ).click ();

    const inputCursors = await page.evaluate ( () => ( {
        colorSwatch: getComputedStyle ( document.querySelector ( ".grid-color-swatch" ) as HTMLElement ).cursor,
        hexadecimal: getComputedStyle ( document.querySelector ( "#settings-grid-color-hex" ) as HTMLElement ).cursor,
        numeric:     getComputedStyle ( document.querySelector ( "#settings-grid-color-red" ) as HTMLElement ).cursor,
    } ) );

    expect ( inputCursors ).toEqual ( { colorSwatch: "default", hexadecimal: "text", numeric: "text" } );
} );
test ( "the tree opens collapsed and only opens to reveal a selected child", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const editorNode  = page.getByRole ( "treeitem", { name: "Editor" } );
    const pullCommand = page.locator ( "[data-toolbar-entry='toolbar-pull']" );

    await expect ( page.getByRole ( "treeitem" ) ).toHaveCount ( 4 );
    await expect ( editorNode ).toHaveAttribute ( "aria-expanded", "false" );

    // Selecting Editor navigates but does not open it: its node is visible either way.

    await editorNode.click ();

    await expect ( editorNode ).toHaveAttribute ( "aria-selected", "true" );
    await expect ( editorNode ).toHaveAttribute ( "aria-expanded", "false" );

    // Pulling the hosted model navigates to Editor on the user's behalf, which is how a tree the
    // user had closed used to reopen itself the moment a document arrived.

    await expect ( pullCommand ).toBeEnabled ();
    await pullCommand.click ();
    await expect ( page.getByRole ( "heading", { name: "State Machine Info" } ) ).toBeVisible ();
    await expect ( editorNode ).toHaveAttribute ( "aria-expanded", "false" );
    await expect ( page.getByRole ( "treeitem" ) ).toHaveCount ( 4 );

    // A selected child, on the other hand, has to be revealed -- a tree cannot show a selection it
    // is hiding.

    await editorNode.focus ();
    await page.keyboard.press ( "ArrowRight" );

    await expect ( editorNode ).toHaveAttribute ( "aria-expanded", "true" );
    await expect ( page.getByRole ( "treeitem" ) ).toHaveCount ( 9 );

    await page.getByRole ( "treeitem", { name: "States" } ).click ();

    await expect ( page.getByRole ( "treeitem", { name: "States" } ) ).toHaveAttribute ( "aria-selected", "true" );
    await expect ( editorNode ).toHaveAttribute ( "aria-expanded", "true" );
} );

test ( "About groups its licences and shipped release notes in accessible tabs", async ( { page } ) =>
{
    await page.getByRole ( "menuitem", { name: "Help", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "About Automata Lab" } ).click ();

    const dialog = page.getByRole ( "dialog", { name: "About Automata Lab" } );

    await expect ( dialog ).toBeVisible ();
    await expect ( dialog.getByText ( "deterministic state transducers", { exact: false } ) ).toBeVisible ();
    await expect ( dialog.getByRole ( "tablist", { name: "About content" } ) ).toBeVisible ();
    await expect ( dialog.getByRole ( "tab", { name: "Licences" } ) )
        .toHaveAttribute ( "aria-selected", "true" );
    await expect ( dialog.getByRole ( "tab", { name: "Release Notes" } ) )
        .toHaveAttribute ( "aria-selected", "false" );

    // Read from the controls themselves because what matters is what the dialog puts in front of
    // the user, then compare each complete value with its shipped notice so the presentation cannot
    // silently truncate or substitute content.

    const expectedLicenseTexts = [
        "automata-lab.txt",
        "fluent-ui-system-icons.txt",
    ].map ( fileName => readFileSync (
        fileURLToPath ( new URL ( `../../public/notices/${ fileName }`, import.meta.url ) ),
        "utf8",
    ).replaceAll ( "\r\n", "\n" ) );
    const expectedReleaseNotesText = readFileSync (
        fileURLToPath ( new URL ( "../../public/release-notes.txt", import.meta.url ) ),
        "utf8",
    ).replaceAll ( "\r\n", "\n" );

    const licenses = await page.evaluate ( () => Array.from (
        document.querySelectorAll<HTMLTextAreaElement> ( "dialog[open] .about-license-text" ),
        box => ( {
            label:      ( box.previousElementSibling?.textContent ?? "" ).trim (),
            readOnly:   box.readOnly,
            scrollable: box.scrollHeight > box.clientHeight,
            text:       box.value,
        } ) ) );

    expect ( licenses.map ( license => license.label ) ).toEqual (
        [ "Automata Lab License", "Microsoft Fluent UI System Icons License" ] );
    expect ( licenses.map ( license => license.text ) ).toEqual ( expectedLicenseTexts );
    expect ( licenses.every ( license => license.readOnly ) ).toBe ( true );
    expect ( licenses.every ( license => license.scrollable ) ).toBe ( true );
    expect ( licenses.every ( license => license.text.includes ( "OTHER DEALINGS IN THE" ) ) ).toBe ( true );
    expect ( licenses [ 0 ]?.text ).toContain ( "Copyright (c) 2026 Rohin Gosling" );
    expect ( licenses [ 1 ]?.text ).toContain ( "Copyright (c) 2020 Microsoft Corporation" );
    expect ( licenses [ 1 ]?.text ).toContain ( "https://github.com/microsoft/fluentui-system-icons" );

    const licencesLayout = await dialog.evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const panel = element.querySelector ( "[role='tabpanel']" ) as HTMLElement;


        // Return the assembled result.

        return {
            dialogHeight:     element.getBoundingClientRect ().height,
            panelClientHeight: panel.clientHeight,
            panelOverflowY:    getComputedStyle ( panel ).overflowY,
            panelScrollHeight: panel.scrollHeight,
        };
    } );

    expect ( licencesLayout.dialogHeight ).toBeGreaterThan ( 620 );
    expect ( licencesLayout.dialogHeight ).toBeLessThanOrEqual ( 660 );
    expect ( licencesLayout.panelOverflowY ).toBe ( "hidden" );
    expect ( licencesLayout.panelScrollHeight ).toBeLessThanOrEqual ( licencesLayout.panelClientHeight );

    const licencesDialogHeight = licencesLayout.dialogHeight;

    await dialog.getByRole ( "tab", { name: "Release Notes" } ).click ();

    const releaseNotes = dialog.getByRole ( "textbox", { name: "Release Notes" } );

    await expect ( releaseNotes ).toHaveAttribute ( "readonly", "" );
    await expect ( releaseNotes ).toHaveValue ( expectedReleaseNotesText );
    expect ( await dialog.evaluate ( element => element.getBoundingClientRect ().height ) )
        .toBe ( licencesDialogHeight );

    const releaseNotesLayout = await dialog.evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const panelBounds = ( element.querySelector ( "[role='tabpanel']" ) as HTMLElement )
            .getBoundingClientRect ();
        const textBounds = ( element.querySelector ( "#about-release-notes" ) as HTMLElement )
            .getBoundingClientRect ();

        // Return the assembled result.

        return {
            bottomInset: panelBounds.bottom - textBounds.bottom,
            textHeight:  textBounds.height,
        };
    } );

    expect ( releaseNotesLayout.bottomInset ).toBeCloseTo ( 10, 0 );
    expect ( releaseNotesLayout.textHeight ).toBeGreaterThan ( 200 );
    await expect ( dialog.getByText ( "Third-Party Runtime Notices" ) ).toHaveCount ( 0 );
    await dialog.getByRole ( "tab", { name: "Licences" } ).click ();

    // Nothing in the dialog sends the user elsewhere to read the terms.

    await expect ( dialog.locator ( "a" ) ).toHaveCount ( 0 );

    // The dialog stays inside the smallest viewport the shell supports, with its Close button still
    // reachable.

    for ( const size of [ { height: 450, width: 720 }, { height: 720, width: 320 } ] )
    {
        await page.setViewportSize ( size );

        const fitted = await page.evaluate ( () =>
        {
            // Initialize the local values needed by this operation.

            const element  = document.querySelector ( "dialog[open]" ) as HTMLElement;
            const bounds   = element.getBoundingClientRect ();
            const closeBox = ( element.querySelector ( ".dialog-footer button" ) as HTMLElement )
                .getBoundingClientRect ();
            const tabPanel = element.querySelector ( "[role='tabpanel']" ) as HTMLElement;


            // Return the assembled result.

            return {
                fits:          bounds.height <= window.innerHeight && bounds.width <= window.innerWidth,
                closeReachable: closeBox.top >= 0 && closeBox.bottom <= window.innerHeight,
                pageScrolls:   document.documentElement.scrollWidth > window.innerWidth,
                tabPageScrolls: tabPanel.scrollHeight > tabPanel.clientHeight,
            };
        } );

        expect ( fitted ).toEqual ( { fits: true, closeReachable: true, pageScrolls: false, tabPageScrolls: false } );
    }
} );

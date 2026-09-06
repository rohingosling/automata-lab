// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Printing Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies Page Setup persistence and the immutable, print-media report handoff in a real
//   browser.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { fileURLToPath } from "node:url";


//--------------------------------------------------------------------------------------------------
// Interface: PrintSnapshot
//
// Description:
//
//   Defines the structure of print snapshot.
//
//--------------------------------------------------------------------------------------------------

interface PrintSnapshot
{
    readonly applicationShellDisplay: string;
    readonly controlCount:            number;
    readonly documentRevision:        string;
    readonly fileVersion:             string;
    readonly imageCount:              number;
    readonly stateChartImageSource:   string;
    readonly maximumTableRowCount:    number;
    readonly modelName:               string;
    readonly modelTitleTextAlign:     string;
    readonly pageStyle:               string;
    readonly reportBackgroundColor:   string;
    readonly reportColor:             string;
    readonly reportConnected:         boolean;
    readonly reportDisplay:           string;
    readonly reportHtml:              string;
    readonly scriptCount:             number;
    readonly sectionHeadings:         readonly string[];
    readonly tableCellFontSizes:      readonly string[];
    readonly tableCellsMonochrome:    boolean;
    readonly tableHeaderBackgrounds:  readonly string[];
    readonly tableHeaderDisplays:     readonly string[];
    readonly tableListItemGroups:     readonly ( readonly string[] )[];
}


//--------------------------------------------------------------------------------------------------
// Interface: PageSetupValues
//
// Description:
//
//   Defines the structure of page setup values.
//
//--------------------------------------------------------------------------------------------------

interface PageSetupValues
{
    readonly bottomMargin: string;
    readonly leftMargin:   string;
    readonly orientation:  "Landscape" | "Portrait";
    readonly paperSize:    "A4" | "Legal" | "Letter";
    readonly rightMargin:  string;
    readonly topMargin:    string;
}


//--------------------------------------------------------------------------------------------------
// Function: createLongCompleteDocument
//
// Description:
//
//   Creates long complete document for the test scenario.
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
//--------------------------------------------------------------------------------------------------

function createLongCompleteDocument (): string
{
    // Calculate the states value from the current inputs.

    const states = Array.from ( { length: 150 }, ( _value, index ) =>
    {
        // Calculate the sequence value from the current inputs.

        const sequence = String ( index + 1 ).padStart ( 3, "0" );


        // Return the assembled result.

        return { description: `Printable state row ${sequence}.`, name: `state_${sequence}` };
    } );


    // Return the stringify result.

    return JSON.stringify ( {
        file_id:      "automata-lab-state-machine",
        file_version: "1.0.0",
        settings:
        {
            description: "A complete long-table browser printing fixture.",
            name:        "Long Printable Machine",
            version:     "3.2.1",
        },
        state_machine:
        {
            actions:
            [
                { description: "First printable entry action.", name: "action_enter" },
                { description: "Second printable entry action.", name: "action_log" },
            ],
            events:          [],
            initial_state:   "state_001",
            state_actions:
            {
                entry:
                [
                    { action: "action_enter", state: "state_001" },
                    { action: "action_log", state: "state_001" },
                ],
                exit: [],
            },
            states,
            transition_table: [],
        },
        chart:
        {
            draft_transitions: [],
            indicators:
            {
                initial_state_indicator:   null,
                terminal_state_indicators: [],
                terminal_state_transitions: [],
            },
            settings: { expand_states: true, state_origin_centered: false },
            states:   [],
        },
        simulator: { sequences: [] },
        solver:    { sequences: [] },
    } );
}


//--------------------------------------------------------------------------------------------------
// Function: openPageSetup
//
// Description:
//
//   Opens the page setup.
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

async function openPageSetup ( page: Page ): Promise<Locator>
{
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Page Setup", exact: true } ).click ();

    const dialog = page.getByRole ( "dialog", { name: "Page Setup" } );

    await expect ( dialog ).toBeVisible ();

    // Return the dialog.

    return dialog;
}


//--------------------------------------------------------------------------------------------------
// Function: setPageSetupValues
//
// Description:
//
//   Updates page setup values.
//
// Parameters:
//
//   - dialog:
//     The dialog supplied to the operation.
//
//   - values:
//     The values supplied to the operation.
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

async function setPageSetupValues ( dialog: Locator, values: PageSetupValues ): Promise<void>
{
    await dialog.getByRole ( "combobox", { name: "Paper Size" } ).selectOption ( values.paperSize );
    await dialog.getByRole ( "combobox", { name: "Orientation" } ).selectOption ( values.orientation );
    await dialog.getByRole ( "spinbutton", { name: "Top Margin (mm)" } ).fill ( values.topMargin );
    await dialog.getByRole ( "spinbutton", { name: "Right Margin (mm)" } ).fill ( values.rightMargin );
    await dialog.getByRole ( "spinbutton", { name: "Bottom Margin (mm)" } ).fill ( values.bottomMargin );
    await dialog.getByRole ( "spinbutton", { name: "Left Margin (mm)" } ).fill ( values.leftMargin );
}


//--------------------------------------------------------------------------------------------------
// Function: openLongCompleteDocument
//
// Description:
//
//   Opens the long complete document.
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

async function openLongCompleteDocument ( page: Page ): Promise<void>
{
    // Initialize the local values needed by this operation.

    const fileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
    await ( await fileChooserPromise ).setFiles ( {
        buffer:   Buffer.from ( createLongCompleteDocument () ),
        mimeType: "application/json",
        name:     "long-printable-machine.json",
    } );
    await expect ( page.locator ( ".console-code", { hasText: "FILE_OPENED" } ) ).toHaveCount ( 1 );
}


//--------------------------------------------------------------------------------------------------
// Function: openMaintainedLightSwitchDocument
//
// Description:
//
//   Opens the maintained light switch document.
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

async function openMaintainedLightSwitchDocument ( page: Page ): Promise<void>
{
    // Initialize the local values needed by this operation.

    const fileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.locator ( "[data-toolbar-entry='toolbar-open']" ).click ();
    await ( await fileChooserPromise ).setFiles ( fileURLToPath ( new URL (
        "../../../examples/state-machine-light-switch.json",
        import.meta.url,
    ) ) );
    await expect ( page.locator ( ".console-code", { hasText: "FILE_OPENED" } ) ).toHaveCount ( 1 );
}


//--------------------------------------------------------------------------------------------------
// Function: installPrintChartRasterTracking
//
// Description:
//
//   Derives the install print chart raster tracking.
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

async function installPrintChartRasterTracking ( page: Page ): Promise<void>
{
    await page.evaluate ( () =>
    {
        // Initialize the local values needed by this operation.

        const rasterizedArcs: { readonly fillStyle: string; readonly radius: number }[] = [];
        const rasterizedTexts: { readonly fillStyle: string; readonly text: string }[] = [];
        const originalArc      = CanvasRenderingContext2D.prototype.arc;
        const originalFillText = CanvasRenderingContext2D.prototype.fillText;

        Object.defineProperty ( window, "__automataLabPrintRasterizedArcs", {
            configurable: true,
            value:        rasterizedArcs,
        } );
        Object.defineProperty ( window, "__automataLabPrintRasterizedTexts", {
            configurable: true,
            value:        rasterizedTexts,
        } );
        CanvasRenderingContext2D.prototype.arc = function (
            x: number,
            y: number,
            radius: number,
            startAngle: number,
            endAngle: number,
            counterclockwise?: boolean,
        ): void
        {
            rasterizedArcs.push ( { fillStyle: String ( this.fillStyle ), radius } );
            originalArc.call ( this, x, y, radius, startAngle, endAngle, counterclockwise );
        };
        CanvasRenderingContext2D.prototype.fillText = function (
            textValue: string,
            x: number,
            y: number,
            maximumWidth?: number,
        ): void
        {
            rasterizedTexts.push ( { fillStyle: String ( this.fillStyle ), text: textValue } );


            // Handle the case where maximum width matches undefined.

            if ( maximumWidth === undefined )
            {
                originalFillText.call ( this, textValue, x, y );
            }
            else
            {
                // Handle the remaining case after the preceding condition is false.

                originalFillText.call ( this, textValue, x, y, maximumWidth );
            }
        };
    } );
}


//--------------------------------------------------------------------------------------------------
// Function: readPrintSnapshots
//
// Description:
//
//   Returns print snapshots.
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

async function readPrintSnapshots ( page: Page ): Promise<readonly PrintSnapshot[]>
{
    // Return the evaluate result.

    return page.evaluate ( () => ( window as typeof window & {
        readonly automataLabPrintSnapshots: readonly PrintSnapshot[];
    } ).automataLabPrintSnapshots );
}


//--------------------------------------------------------------------------------------------------
// Function: printCurrentDocument
//
// Description:
//
//   Derives the print current document.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - activation:
//     The activation supplied to the operation.
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

async function printCurrentDocument (
    page: Page,
    activation: "keyboard" | "menu" = "keyboard",
): Promise<PrintSnapshot>
{
    // Initialize the local values needed by this operation.

    const previousSnapshotCount = ( await readPrintSnapshots ( page ) ).length;


    // Handle the case where activation matches "keyboard".

    if ( activation === "keyboard" )
    {
        await page.emulateMedia ( { media: "print" } );
    }


    // Run the operation that may report a recoverable failure.

    try
    {
        // Handle the case where activation matches "menu".

        if ( activation === "menu" )
        {
            await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
            const printMenuItem = page.getByRole ( "menuitem", { name: "Print", exact: true } );

            await printMenuItem.focus ();
            await printMenuItem.press ( "Enter" );
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            await page.evaluate ( () =>
            {
                document.dispatchEvent ( new KeyboardEvent ( "keydown", {
                    bubbles:    true,
                    cancelable: true,
                    ctrlKey:    true,
                    key:        "p",
                } ) );
            } );
        }
        await expect.poll ( async () => ( await readPrintSnapshots ( page ) ).length )
            .toBe ( previousSnapshotCount + 1 );

        const snapshot = ( await readPrintSnapshots ( page ) ).at ( -1 );


        // Handle the case where snapshot matches undefined.

        if ( snapshot === undefined )
        {
            throw new Error ( "The browser print stub did not capture a report." );
        }


        // Return the snapshot.

        return snapshot;
    }
    finally
    {
        // Complete the cleanup required after the attempted operation.

        if ( activation === "keyboard" )
        {
            await page.emulateMedia ( { media: "screen" } );
        }
    }
}

test.beforeEach ( async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        //------------------------------------------------------------------------------------------
        // Interface: BrowserPrintSnapshot
        //
        // Description:
        //
        //   Defines the structure of browser print snapshot.
        //
        //------------------------------------------------------------------------------------------

        interface BrowserPrintSnapshot
        {
            readonly applicationShellDisplay: string;
            readonly controlCount:            number;
            readonly documentRevision:        string;
            readonly fileVersion:             string;
            readonly imageCount:              number;
            readonly stateChartImageSource:   string;
            readonly maximumTableRowCount:    number;
            readonly modelName:               string;
            readonly modelTitleTextAlign:     string;
            readonly pageStyle:               string;
            readonly reportBackgroundColor:   string;
            readonly reportColor:             string;
            readonly reportConnected:         boolean;
            readonly reportDisplay:           string;
            readonly reportHtml:              string;
            readonly scriptCount:             number;
            readonly sectionHeadings:         readonly string[];
            readonly tableCellFontSizes:      readonly string[];
            readonly tableCellsMonochrome:    boolean;
            readonly tableHeaderBackgrounds:  readonly string[];
            readonly tableHeaderDisplays:     readonly string[];
            readonly tableListItemGroups:     readonly ( readonly string[] )[];
        }

        const printTestWindow = window as typeof window & {
            automataLabPrintSnapshots: BrowserPrintSnapshot[];
        };

        printTestWindow.automataLabPrintSnapshots = [];
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "print", {
            configurable: true,
            value: () =>
            {
                // Initialize the local values needed by this operation.

                const applicationShell = document.querySelector<HTMLElement> ( ".application-shell" );
                const report           = document.querySelector<HTMLElement> ( ".print-report" );
                const reportStyle      = report === null ? null : getComputedStyle ( report );
                const modelTitle       = report?.querySelector<HTMLElement> ( "h1" ) ?? null;
                const tableCells       = Array.from ( report?.querySelectorAll<HTMLElement> ( "th, td" ) ?? [] );
                const tableHeaders     = Array.from (
                    report?.querySelectorAll<HTMLElement> ( "thead th" ) ?? [],
                );
                const tableRowCounts   = Array.from ( report?.querySelectorAll ( "table tbody" ) ?? [],
                    tableBody => tableBody.querySelectorAll ( ":scope > tr" ).length );


                //----------------------------------------------------------------------------------
                // Function: headerDefinitionValue
                //
                // Description:
                //
                //   Derives the header definition value.
                //
                // Parameters:
                //
                //   - label:
                //     The label supplied to the operation.
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
                //----------------------------------------------------------------------------------

                function headerDefinitionValue ( label: string ): string
                {
                    // Initialize the local values needed by this operation.

                    const definition = Array.from ( report?.querySelectorAll ( "header dl > div" ) ?? [] )
                        .find ( item => item.querySelector ( "dt" )?.textContent === label );


                    // Return the computed result.

                    return definition?.querySelector ( "dd" )?.textContent ?? "";
                }

                printTestWindow.automataLabPrintSnapshots.push ( {
                    applicationShellDisplay: applicationShell === null
                        ? "missing"
                        : getComputedStyle ( applicationShell ).display,
                    controlCount: report?.querySelectorAll (
                        "button, input, select, textarea, a[href], [contenteditable='true'], [tabindex]",
                    ).length ?? -1,
                    documentRevision:      headerDefinitionValue ( "Captured Document Revision" ),
                    fileVersion:           headerDefinitionValue ( "File Version" ),
                    imageCount:            report?.querySelectorAll ( "img" ).length ?? -1,
                    stateChartImageSource: report?.querySelector<HTMLImageElement> (
                        ".print-state-chart-image",
                    )?.getAttribute ( "src" ) ?? "",
                    maximumTableRowCount:  Math.max ( 0, ...tableRowCounts ),
                    modelName:             modelTitle?.textContent ?? "",
                    modelTitleTextAlign:   modelTitle === null ? "missing" : getComputedStyle ( modelTitle ).textAlign,
                    pageStyle:             report?.querySelector ( "style[media='print']" )?.textContent ?? "",
                    reportBackgroundColor: reportStyle?.backgroundColor ?? "missing",
                    reportColor:           reportStyle?.color ?? "missing",
                    reportConnected:       report?.isConnected ?? false,
                    reportDisplay:         reportStyle?.display ?? "missing",
                    reportHtml:            report?.innerHTML ?? "",
                    scriptCount:           report?.querySelectorAll ( "script" ).length ?? -1,
                    sectionHeadings: Array.from ( report?.querySelectorAll ( "h2" ) ?? [],
                        heading => heading.textContent ?? "" ),
                    tableCellFontSizes: tableCells.map ( cell => getComputedStyle ( cell ).fontSize ),
                    tableCellsMonochrome: reportStyle !== null && tableCells.length > 0 && tableCells.every ( cell =>
                    {
                        // Initialize the local values needed by this operation.

                        const style = getComputedStyle ( cell );


                        // Return the computed result.

                        return style.backgroundColor === reportStyle.backgroundColor &&
                            style.borderTopColor === reportStyle.color && style.color === reportStyle.color;
                    } ),
                    tableHeaderBackgrounds: tableHeaders.map (
                        tableHeader => getComputedStyle ( tableHeader ).backgroundColor,
                    ),
                    tableHeaderDisplays: Array.from ( report?.querySelectorAll ( "thead" ) ?? [],
                        tableHead => getComputedStyle ( tableHead ).display ),
                    tableListItemGroups: Array.from ( report?.querySelectorAll ( ".print-table-list" ) ?? [],
                        list => Array.from ( list.querySelectorAll ( "li" ), item => item.textContent ?? "" ) ),
                } );
            },
            writable: true,
        } );
    } );
    await page.goto ( "./" );
} );

test ( "AL-PRN-001 keeps Page Setup available without a document and enables Print for an incomplete draft", async (
    { page },
) =>
{
    // Initialize the local values needed by this operation.

    const fileMenu = page.getByRole ( "menuitem", { name: "File", exact: true } );

    await fileMenu.click ();
    const pageSetupCommand = page.getByRole ( "menuitem", { name: "Page Setup", exact: true } );

    await expect ( pageSetupCommand ).toBeEnabled ();
    await expect ( page.getByRole ( "menuitem", { name: "Print", exact: true } ) ).toBeDisabled ();
    await pageSetupCommand.click ();

    const dialog = page.getByRole ( "dialog", { name: "Page Setup" } );

    await expect ( dialog ).toBeVisible ();
    await expect ( dialog.getByRole ( "combobox", { name: "Paper Size" } ) ).toBeFocused ();
    await dialog.getByRole ( "button", { name: "Cancel" } ).click ();
    await page.locator ( "[data-toolbar-entry='toolbar-new']" ).click ();
    await fileMenu.click ();
    await expect ( page.getByRole ( "menuitem", { name: "Print", exact: true } ) ).toBeEnabled ();
} );

test ( "File Print renders and hands off the report without entering the presentation error boundary", async (
    { page },
) =>
{
    await openLongCompleteDocument ( page );

    const snapshot = await printCurrentDocument ( page, "menu" );

    expect ( snapshot.modelName ).toBe ( "Long Printable Machine" );
    await expect ( page.getByText ( "Automata Lab encountered a presentation error", { exact: true } ) )
        .toHaveCount ( 0 );
} );

test ( "print rasterization preserves UML terminal discs and black transition labels", async ( { page } ) =>
{
    await openMaintainedLightSwitchDocument ( page );
    const chartTreeItem = page.getByRole ( "treeitem", { name: "Chart" } );

    await chartTreeItem.focus ();
    await chartTreeItem.press ( "Enter" );
    await expect ( page.locator ( ".chart-terminal-indicator" ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".chart-transition-edge .react-flow__edge-text" ).first () ).toBeVisible ();
    const expectedTransitionLabelLines = await page.locator (
        ".chart-transition-edge .react-flow__edge-text",
    ).evaluateAll ( labels => labels.flatMap ( label => ( label.textContent ?? "" ).split ( "\n" ) ) );

    await installPrintChartRasterTracking ( page );


    // Initialize the local values needed by this operation.

    const snapshot       = await printCurrentDocument ( page, "menu" );
    const rasterEvidence = await page.evaluate ( () =>
    {
        // Initialize the local values needed by this operation.

        const printWindow = window as typeof window & {
            readonly __automataLabPrintRasterizedArcs?: readonly {
                readonly fillStyle: string;
                readonly radius:    number;
            }[];
            readonly __automataLabPrintRasterizedTexts?: readonly {
                readonly fillStyle: string;
                readonly text:      string;
            }[];
        };


        // Return the assembled result.

        return {
            arcs:  printWindow.__automataLabPrintRasterizedArcs ?? [],
            texts: printWindow.__automataLabPrintRasterizedTexts ?? [],
        };
    } );

    expect ( snapshot.stateChartImageSource.slice ( 0, 64 ) ).toMatch ( /^data:image\/png/u );
    expect ( rasterEvidence.arcs ).toContainEqual ( { fillStyle: "#000000", radius: 15 } );


    // Process each expected line from the current value collection in order.

    for ( const expectedLine of new Set ( expectedTransitionLabelLines ) )
    {
        // Initialize the local values needed by this operation.

        const expectedCount = expectedTransitionLabelLines.filter ( line => line === expectedLine ).length;
        const matchingText  = rasterEvidence.texts.filter ( evidence => evidence.text === expectedLine );

        expect ( matchingText ).toHaveLength ( expectedCount );
        expect ( matchingText.every ( evidence => evidence.fillStyle === "#000000" ) ).toBe ( true );
    }
} );

test ( "AL-PRN-002 discards Cancel changes and persists one complete Apply transaction", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    let dialog = await openPageSetup ( page );

    await setPageSetupValues ( dialog, {
        bottomMargin: "50",
        leftMargin:   "6.4",
        orientation:  "Landscape",
        paperSize:    "Letter",
        rightMargin:  "12.7",
        topMargin:    "0",
    } );
    await dialog.getByRole ( "checkbox", { name: "Model Summary" } ).uncheck ();
    await dialog.getByRole ( "button", { name: "Cancel" } ).click ();

    dialog = await openPageSetup ( page );
    await expect ( dialog.getByRole ( "combobox", { name: "Paper Size" } ) ).toHaveValue ( "A4" );
    await expect ( dialog.getByRole ( "combobox", { name: "Orientation" } ) ).toHaveValue ( "Portrait" );
    await expect ( dialog.getByRole ( "spinbutton", { name: "Top Margin (mm)" } ) ).toHaveValue ( "12.7" );
    await expect ( dialog.getByRole ( "checkbox", { name: "Model Summary" } ) ).toBeChecked ();

    await setPageSetupValues ( dialog, {
        bottomMargin: "25.5",
        leftMargin:   "1",
        orientation:  "Landscape",
        paperSize:    "Legal",
        rightMargin:  "0",
        topMargin:    "50",
    } );
    await dialog.getByRole ( "checkbox", { name: "Model Summary" } ).uncheck ();
    await dialog.getByRole ( "button", { name: "Apply" } ).click ();
    await expect ( dialog ).toBeHidden ();

    await page.reload ();
    dialog = await openPageSetup ( page );
    await expect ( dialog.getByRole ( "combobox", { name: "Paper Size" } ) ).toHaveValue ( "Legal" );
    await expect ( dialog.getByRole ( "combobox", { name: "Orientation" } ) ).toHaveValue ( "Landscape" );
    await expect ( dialog.getByRole ( "spinbutton", { name: "Top Margin (mm)" } ) ).toHaveValue ( "50" );
    await expect ( dialog.getByRole ( "spinbutton", { name: "Right Margin (mm)" } ) ).toHaveValue ( "0" );
    await expect ( dialog.getByRole ( "spinbutton", { name: "Bottom Margin (mm)" } ) ).toHaveValue ( "25.5" );
    await expect ( dialog.getByRole ( "spinbutton", { name: "Left Margin (mm)" } ) ).toHaveValue ( "1" );
    await expect ( dialog.getByRole ( "checkbox", { name: "Model Summary" } ) ).not.toBeChecked ();
    await expect ( dialog.getByRole ( "checkbox", { name: "State Chart" } ) ).toBeChecked ();
    await dialog.getByRole ( "button", { name: "Cancel" } ).click ();

    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
    const settingsDialog = page.getByRole ( "dialog", { name: "Application Settings" } );

    await settingsDialog.getByRole ( "option", { name: "Print" } ).click ();
    await expect ( settingsDialog.getByRole ( "checkbox", { name: "Model Summary" } ) ).not.toBeChecked ();
    await expect ( settingsDialog.getByRole ( "checkbox", { name: "State Chart" } ) ).toBeChecked ();
    await expect ( settingsDialog.getByRole ( "combobox", { name: "Style" } ) ).toHaveValue ( "Academic" );
    await settingsDialog.getByRole ( "checkbox", { name: "State Chart" } ).uncheck ();
    await settingsDialog.getByRole ( "combobox", { name: "Style" } ).selectOption ( "Industry" );
    await settingsDialog.getByRole ( "button", { name: "Apply" } ).click ();
    await expect ( settingsDialog ).toBeHidden ();

    dialog = await openPageSetup ( page );
    await expect ( dialog.getByRole ( "checkbox", { name: "State Chart" } ) ).not.toBeChecked ();
} );

test ( "AL-PRN-003 and AL-PRN-004 hand off a committed control-free report under every page-size rule", async (
    { page },
) =>
{
    await openLongCompleteDocument ( page );
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await expect ( page.getByRole ( "menuitem", { name: "Print", exact: true } ) ).toBeEnabled ();
    await page.keyboard.press ( "Escape" );

    const defaultSnapshot = await printCurrentDocument ( page );

    expect ( defaultSnapshot ).toMatchObject ( {
        applicationShellDisplay: "none",
        controlCount:            0,
        documentRevision:        "1",
        fileVersion:             "1.0.0",
        imageCount:              1,
        maximumTableRowCount:    150,
        modelName:               "Long Printable Machine",
        modelTitleTextAlign:     "left",
        reportBackgroundColor:   "rgb(255, 255, 255)",
        reportColor:             "rgb(0, 0, 0)",
        reportConnected:         true,
        reportDisplay:           "block",
        sectionHeadings:
        [
            "Model Summary",
            "States",
            "Events",
            "Actions",
            "Transition Table",
            "State Chart",
            "Chart Projection",
            "Solver Observation Sequences",
            "Simulator Event Sequences",
        ],
        tableCellsMonochrome: true,
    } );
    expect ( defaultSnapshot.stateChartImageSource.startsWith ( "data:image/png" ) ).toBe ( true );
    expect ( defaultSnapshot.stateChartImageSource ).toContain ( ";base64," );
    expect ( defaultSnapshot.pageStyle ).toContain (
        "@page { size: A4 portrait; margin: 12.7mm 12.7mm 12.7mm 12.7mm;",
    );
    expect ( defaultSnapshot.pageStyle ).toContain (
        '@top-left { content: none; } @top-center { content: "Automata Lab — long-printable-machine.json";',
    );
    expect ( defaultSnapshot.pageStyle ).toContain ( "--print-state-chart-height: 253.6mm" );
    expect ( defaultSnapshot.tableCellFontSizes.length ).toBeGreaterThan ( 0 );
    expect ( defaultSnapshot.tableCellFontSizes.every (
        fontSize => Math.abs ( Number.parseFloat ( fontSize ) - ( 7 * 96 / 72 ) ) < 0.01,
    ) ).toBe ( true );
    expect ( defaultSnapshot.tableHeaderBackgrounds.every (
        background => background === "rgb(255, 255, 255)",
    ) ).toBe ( true );
    expect ( defaultSnapshot.tableListItemGroups.some ( group => group.length > 1 ) ).toBe ( true );
    expect ( defaultSnapshot.tableListItemGroups.flat ().every ( item => !item.includes ( "→" ) ) ).toBe ( true );
    expect ( defaultSnapshot.tableHeaderDisplays.length ).toBeGreaterThan ( 0 );
    expect ( defaultSnapshot.tableHeaderDisplays.every ( display => display === "table-header-group" ) ).toBe ( true );

    let dialog = await openPageSetup ( page );

    await setPageSetupValues ( dialog, {
        bottomMargin: "50",
        leftMargin:   "6.4",
        orientation:  "Landscape",
        paperSize:    "Letter",
        rightMargin:  "12.7",
        topMargin:    "0",
    } );
    await dialog.getByRole ( "checkbox", { name: "Actions" } ).uncheck ();
    await dialog.getByRole ( "checkbox", { name: "Chart Projection" } ).uncheck ();
    await dialog.getByRole ( "button", { name: "Apply" } ).click ();

    const letterSnapshot = await printCurrentDocument ( page );

    expect ( letterSnapshot.pageStyle ).toContain (
        "@page { size: letter landscape; margin: 0mm 12.7mm 50mm 6.4mm;",
    );
    expect ( letterSnapshot.pageStyle ).toContain ( "--print-state-chart-height: 147.9mm" );
    expect ( letterSnapshot.sectionHeadings ).toEqual ( [
        "Model Summary",
        "States",
        "Events",
        "Transition Table",
        "State Chart",
        "Solver Observation Sequences",
        "Simulator Event Sequences",
    ] );
    expect ( letterSnapshot.controlCount ).toBe ( 0 );

    dialog = await openPageSetup ( page );
    await setPageSetupValues ( dialog, {
        bottomMargin: "25.5",
        leftMargin:   "1",
        orientation:  "Portrait",
        paperSize:    "Legal",
        rightMargin:  "0",
        topMargin:    "50",
    } );
    await dialog.getByRole ( "checkbox", { name: "Actions" } ).check ();
    await dialog.getByRole ( "checkbox", { name: "Chart Projection" } ).check ();
    await dialog.getByRole ( "button", { name: "Apply" } ).click ();

    const legalSnapshot = await printCurrentDocument ( page );

    expect ( legalSnapshot.pageStyle ).toContain (
        "@page { size: legal portrait; margin: 50mm 0mm 25.5mm 1mm;",
    );
    expect ( legalSnapshot.pageStyle ).toContain ( "--print-state-chart-height: 262.1mm" );
    expect ( legalSnapshot.sectionHeadings ).toEqual ( defaultSnapshot.sectionHeadings );
    expect ( legalSnapshot.tableHeaderDisplays.every ( display => display === "table-header-group" ) ).toBe ( true );
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
    const settingsDialog = page.getByRole ( "dialog", { name: "Application Settings" } );

    await settingsDialog.getByRole ( "option", { name: "Print" } ).click ();
    await settingsDialog.getByRole ( "combobox", { name: "Style" } ).selectOption ( "Industry" );
    await settingsDialog.getByRole ( "button", { name: "Apply" } ).click ();
    await expect ( settingsDialog ).toBeHidden ();

    const industrySnapshot = await printCurrentDocument ( page );

    expect ( industrySnapshot.tableHeaderBackgrounds.length ).toBeGreaterThan ( 0 );
    expect ( industrySnapshot.tableHeaderBackgrounds.every (
        background => background === "rgb(204, 204, 204)",
    ) ).toBe ( true );
    expect ( await readPrintSnapshots ( page ) ).toHaveLength ( 4 );
} );

test ( "AL-PRN-003 treats native print cancellation as a non-mutating handoff and escapes malicious text", async (
    { page },
) =>
{
    // Initialize the local values needed by this operation.

    const maliciousName = "<script>globalThis.compromised=true</script><img src=x onerror=alert(1)>";

    await page.locator ( "[data-toolbar-entry='toolbar-new']" ).click ();
    const nameField = page.getByRole ( "textbox", { name: "Name" } );

    await nameField.fill ( maliciousName );
    await nameField.press ( "Tab" );
    await expect ( page ).toHaveTitle ( /Unsaved changes/u );
    await page.locator ( "[data-toolbar-entry='toolbar-editor']" ).focus ();


    // Initialize the local values needed by this operation.

    const titleBeforePrint = await page.title ();
    const snapshot         = await printCurrentDocument ( page );

    expect ( snapshot.modelName ).toBe ( maliciousName );
    expect ( snapshot.documentRevision ).toBe ( "2" );
    expect ( snapshot.scriptCount ).toBe ( 0 );
    expect ( snapshot.imageCount ).toBe ( 0 );
    expect ( snapshot.reportHtml ).toContain ( "&lt;script&gt;globalThis.compromised=true&lt;/script&gt;" );
    expect ( snapshot.reportHtml ).not.toContain ( "<script>" );
    expect ( snapshot.reportHtml ).not.toContain ( "<img" );
    expect ( await page.title () ).toBe ( titleBeforePrint );
    await expect ( nameField ).toHaveValue ( maliciousName );
    await expect ( page.locator ( ".print-report" ) ).toHaveCount ( 0 );
    await expect ( page.getByText ( "PRINT_FAILED", { exact: true } ) ).toHaveCount ( 0 );

    await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
    await expect ( nameField ).toHaveValue ( "Untitled State Machine" );
} );

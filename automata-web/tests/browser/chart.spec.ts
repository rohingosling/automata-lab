// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    State Chart Browser Tests
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the authoring projection, layout worker, palette transaction, keyboard movement, and
//   responsive UI.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

import { DEFAULT_APPLICATION_PREFERENCES } from "../../src/configuration/compile-time-configuration.js";

// These palette and draft scenarios place items at fixed viewport coordinates and then connect
// them, so what they exercise depends on where the grid puts each drop. Pinning Grid Size keeps
// them testing the interaction rather than whichever value happens to be the current default.

//--------------------------------------------------------------------------------------------------
// Function: pinChartGridSize
//
// Description:
//
//   Derives the pin chart grid size.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - gridSize:
//     The grid size supplied to the operation.
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

async function pinChartGridSize ( page: Page, gridSize: string ): Promise<void>
{
    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();

    const settingsDialog = page.getByRole ( "dialog", { name: "Application Settings" } );

    await settingsDialog.getByRole ( "option", { name: "Chart" } ).click ();
    await settingsDialog.getByRole ( "spinbutton", { name: "Grid Size (CSS pixels)" } ).fill ( gridSize );
    await settingsDialog.getByRole ( "button", { name: "Apply" } ).click ();
}

//--------------------------------------------------------------------------------------------------
// Function: openLightSwitchExample
//
// Description:
//
//   Opens the light switch example.
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

async function openLightSwitchExample ( page: Page ): Promise<void>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();

    const fileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "button", { name: "Open", exact: true } ).click ();
    await ( await fileChooserPromise ).setFiles (
        fileURLToPath ( new URL ( "../../../examples/state-machine-light-switch.json", import.meta.url ) ),
    );
}

//--------------------------------------------------------------------------------------------------
// Function: openMaintainedFnbExample
//
// Description:
//
//   Opens the maintained fnb example.
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

async function openMaintainedFnbExample ( page: Page ): Promise<void>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
    } );
    await page.reload ();

    const fileChooserPromise = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "button", { name: "Open", exact: true } ).click ();
    await ( await fileChooserPromise ).setFiles ( fileURLToPath ( new URL (
        "../fixtures/fnb-etc-delivery-tracking-1.json",
        import.meta.url,
    ) ) );
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingWorkerLifecycleStats
//
// Description:
//
//   Defines the structure of chart routing worker lifecycle stats.
//
//--------------------------------------------------------------------------------------------------

interface ChartRoutingWorkerLifecycleStats
{
    readonly cancelled:                     number;
    readonly cancellationRequests:          number;
    readonly completedRoundTripMilliseconds: readonly number[];
    readonly created:                       number;
    readonly resultCount:                   number;
    readonly routeRequests:                 number;
    readonly terminated:                    number;
}

//--------------------------------------------------------------------------------------------------
// Function: installChartRoutingWorkerLifecycleTracking
//
// Description:
//
//   Derives the install chart routing worker lifecycle tracking.
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

async function installChartRoutingWorkerLifecycleTracking ( page: Page ): Promise<void>
{
    await page.addInitScript ( () =>
    {
        // Initialize the local values needed by this operation.

        const NativeWorker           = window.Worker;
        const routeStartByGeneration = new Map<number, number> ();
        const stats                  = {
            cancelled: 0,
            cancellationRequests: 0,
            completedRoundTripMilliseconds: [] as number[],
            created: 0,
            resultCount: 0,
            routeRequests: 0,
            terminated: 0,
        };

        //------------------------------------------------------------------------------------------
        // Class: TrackingWorker
        //
        // Description:
        //
        //   Implements the tracking worker behavior.
        //
        //------------------------------------------------------------------------------------------

        class TrackingWorker extends NativeWorker
        {
            private readonly tracksChartRouting: boolean;

            //--------------------------------------------------------------------------------------
            // Constructor: TrackingWorker
            //
            // Description:
            //
            //   Initializes a TrackingWorker instance.
            //
            // Parameters:
            //
            //   - scriptURL:
            //     The script URL supplied to the operation.
            //
            //   - options:
            //     Options that control the operation.
            //
            // Returns:
            //
            //   No value is returned.
            //
            // Preconditions:
            //
            //   - The supplied arguments satisfy their declared TypeScript contracts.
            //
            // Postconditions:
            //
            //   - The described side effects are complete when the callable returns.
            //
            //--------------------------------------------------------------------------------------

            public constructor ( scriptURL: string | URL, options?: WorkerOptions )
            {
                super ( scriptURL, options );
                this.tracksChartRouting = String ( scriptURL ).includes ( "chart-routing.worker" );

                // Handle the case where tracks chart routing is enabled.

                if ( this.tracksChartRouting )
                {
                    stats.created += 1;
                    this.addEventListener ( "message", event =>
                    {
                        // Initialize the local values needed by this operation.

                        const response = event.data as { generation?: unknown; kind?: unknown };

                        // Handle the case where response kind matches "cancelled".

                        if ( response.kind === "cancelled" )
                        {
                            stats.cancelled += 1;
                        }
                        else if ( response.kind === "result" && typeof response.generation === "number" )
                        {
                            // Initialize the local values needed by this operation.

                            const routeStart = routeStartByGeneration.get ( response.generation );

                            stats.resultCount += 1;

                            // Handle the case where route start differs from undefined.

                            if ( routeStart !== undefined )
                            {
                                stats.completedRoundTripMilliseconds.push ( performance.now () - routeStart );
                            }
                        }
                    } );
                }
            }

            //--------------------------------------------------------------------------------------
            // Method: postMessage
            //
            // Description:
            //
            //   Posts the message.
            //
            // Parameters:
            //
            //   - message:
            //     The message supplied to the operation.
            //
            //   - transfer:
            //     The transfer supplied to the operation.
            //
            // Returns:
            //
            //   No value is returned.
            //
            // Preconditions:
            //
            //   - The supplied arguments satisfy their declared TypeScript contracts.
            //
            // Postconditions:
            //
            //   - The described side effects are complete when the callable returns.
            //
            //--------------------------------------------------------------------------------------

            public override postMessage ( message: unknown, transfer: Transferable[] ): void;

            //--------------------------------------------------------------------------------------
            // Method: postMessage
            //
            // Description:
            //
            //   Posts the message.
            //
            // Parameters:
            //
            //   - message:
            //     The message supplied to the operation.
            //
            //   - options:
            //     Options that control the operation.
            //
            // Returns:
            //
            //   No value is returned.
            //
            // Preconditions:
            //
            //   - The supplied arguments satisfy their declared TypeScript contracts.
            //
            // Postconditions:
            //
            //   - The described side effects are complete when the callable returns.
            //
            //--------------------------------------------------------------------------------------

            public override postMessage ( message: unknown, options?: StructuredSerializeOptions ): void;

            //--------------------------------------------------------------------------------------
            // Method: postMessage
            //
            // Description:
            //
            //   Posts the message.
            //
            // Parameters:
            //
            //   - message:
            //     The message supplied to the operation.
            //
            //   - transferOrOptions:
            //     The transfer or options supplied to the operation.
            //
            // Returns:
            //
            //   No value is returned.
            //
            // Preconditions:
            //
            //   - The supplied arguments satisfy their declared TypeScript contracts.
            //
            // Postconditions:
            //
            //   - The described side effects are complete when the callable returns.
            //
            //--------------------------------------------------------------------------------------

            public override postMessage (
                message: unknown,
                transferOrOptions?: StructuredSerializeOptions | Transferable[],
            ): void
            {
                // Handle the case where tracks chart routing is enabled.

                if ( this.tracksChartRouting )
                {
                    // Initialize the local values needed by this operation.

                    const request = message as { generation?: unknown; kind?: unknown };

                    // Handle the case where all required conditions are satisfied.

                    if ( request.kind === "route" && typeof request.generation === "number" )
                    {
                        stats.routeRequests += 1;
                        routeStartByGeneration.set ( request.generation, performance.now () );
                    }
                    else if ( request.kind === "cancel" )
                    {
                        stats.cancellationRequests += 1;
                    }
                }

                // Handle the case where is array result is enabled.

                if ( Array.isArray ( transferOrOptions ) )
                {
                    super.postMessage ( message, transferOrOptions );
                }
                else
                {
                    // Handle the remaining case after the preceding condition is false.

                    super.postMessage ( message, transferOrOptions );
                }
            }

            //--------------------------------------------------------------------------------------
            // Method: terminate
            //
            // Description:
            //
            //   Terminates the requested value.
            //
            // Parameters:
            //
            //   None.
            //
            // Returns:
            //
            //   No value is returned.
            //
            // Preconditions:
            //
            //   - None.
            //
            // Postconditions:
            //
            //   - The described side effects are complete when the callable returns.
            //
            //--------------------------------------------------------------------------------------

            public override terminate (): void
            {
                // Handle the case where tracks chart routing is enabled.

                if ( this.tracksChartRouting )
                {
                    stats.terminated += 1;
                }

                super.terminate ();
            }
        }

        Object.defineProperty ( window, "__automataLabChartRoutingWorkerLifecycle", {
            configurable: true,
            value: stats,
        } );
        Object.defineProperty ( window, "Worker", { configurable: true, value: TrackingWorker } );
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: chartRoutingWorkerLifecycleStats
//
// Description:
//
//   Derives the chart routing worker lifecycle stats.
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

async function chartRoutingWorkerLifecycleStats ( page: Page ): Promise<ChartRoutingWorkerLifecycleStats>
{
    // Return the evaluate result.

    return page.evaluate ( () =>
        ( window as unknown as { __automataLabChartRoutingWorkerLifecycle: ChartRoutingWorkerLifecycleStats } )
            .__automataLabChartRoutingWorkerLifecycle );
}

//--------------------------------------------------------------------------------------------------
// Function: refreshWindowsChartProjection
//
// Description:
//
//   Refreshes the Windows Chart projection.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - chartEdge:
//     The Chart edge supplied to the operation.
//
//   - expectedAriaLabel:
//     The expected ARIA label supplied to the operation.
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

async function refreshWindowsChartProjection (
    page: Page,
    chartEdge: Locator,
    expectedAriaLabel: RegExp,
): Promise<void>
{
    // Initialize the local values needed by this operation.

    let lastError: unknown;

    // Repeat the operation across the bounded iteration range.

    for ( let attemptIndex = 0; attemptIndex < 3; attemptIndex += 1 )
    {
        await page.locator ( "[data-toolbar-entry='toolbar-editor']" ).click ();
        await page.locator ( "[data-toolbar-entry='toolbar-chart']" ).click ();

        // Run the operation that may report a recoverable failure.

        try
        {
            await expect ( chartEdge ).toHaveAttribute ( "aria-label", expectedAriaLabel, { timeout: 3_000 } );

            // Return control to the caller.

            return;
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            lastError = error;
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error ( "Windows WebKit did not project the semantic Chart edge after three measurement passes." );
}

// Scoped to the state nodes rather than the page. The status bar carries Entry Actions and Exit
// Actions counts for the whole document, so a page-wide match would find those too -- and an
// assertion that a collapsed state shows no action headings would be reporting on the status bar
// instead.

//--------------------------------------------------------------------------------------------------
// Function: stateNodeText
//
// Description:
//
//   Derives the state node text.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - content:
//     The content supplied to the operation.
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

function stateNodeText ( page: Page, content: string ): Locator
{
    // Return the get by text result.

    return page.locator ( ".chart-state-node" ).getByText ( content );
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
    await page.getByRole ( "button", { name: "New", exact: true } ).click ();
    await expect ( page.getByRole ( "treeitem", { name: "States", exact: true } ) ).toBeVisible ();
}

//--------------------------------------------------------------------------------------------------
// Function: connectChartHandles
//
// Description:
//
//   Connects the chart handles.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - sourceSelector:
//     The source selector supplied to the operation.
//
//   - targetSelector:
//     The target selector supplied to the operation.
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

async function connectChartHandles (
    page: Page,
    sourceSelector: string,
    targetSelector: string,
): Promise<void>
{
    // Initialize the local values needed by this operation.

    const source = page.locator ( sourceSelector ).first ();
    const target = page.locator ( targetSelector ).first ();

    await dragLocatorToLocator ( page, source, target );
}

//--------------------------------------------------------------------------------------------------
// Function: dragLocatorToLocator
//
// Description:
//
//   Derives the drag locator to locator.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
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

async function dragLocatorToLocator ( page: Page, source: Locator, target: Locator ): Promise<void>
{
    await source.scrollIntoViewIfNeeded ();

    // Initialize the local values needed by this operation.

    const sourceBounds = await source.boundingBox ();
    const targetBounds = await target.boundingBox ();

    expect ( sourceBounds ).not.toBeNull ();
    expect ( targetBounds ).not.toBeNull ();

    // Handle the case where at least one branch condition is satisfied.

    if ( sourceBounds === null || targetBounds === null )
    {
        throw new Error ( "The Chart connection handles have no rendered bounds." );
    }

    await page.mouse.move ( sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + sourceBounds.height / 2 );
    await page.mouse.down ();

    // The grabbed control re-renders on pointer down, so the drag begins with a short settling
    // move. Without it the long move can be delivered while React is still replacing the element
    // that captured the pointer.

    await page.mouse.move (
        sourceBounds.x + sourceBounds.width / 2,
        sourceBounds.y + sourceBounds.height / 2 - 4,
    );
    await page.waitForTimeout ( 50 );
    await page.mouse.move (
        targetBounds.x + targetBounds.width / 2,
        targetBounds.y + targetBounds.height / 2,
        { steps: 8 },
    );
    await page.mouse.up ();
}

//--------------------------------------------------------------------------------------------------
// Function: dragPaletteItemToCanvas
//
// Description:
//
//   Derives the drag palette item to canvas.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - source:
//     The source supplied to the operation.
//
//   - targetPosition:
//     The target position supplied to the operation.
//
//   - browserName:
//     The browser name supplied to the operation.
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

async function dragPaletteItemToCanvas (
    page: Page,
    source: Locator,
    targetPosition: { readonly x: number; readonly y: number },
    browserName: string,
): Promise<void>
{
    // Initialize the local values needed by this operation.

    const canvas = page.locator ( ".chart-canvas" );

    // Handle the case where browser name differs from "webkit".

    if ( browserName !== "webkit" )
    {
        await source.dragTo ( canvas, { targetPosition } );

        // Return control to the caller.

        return;
    }

    const canvasBounds = await canvas.boundingBox ();

    // Handle the case where canvas bounds matches an absent value.

    if ( canvasBounds === null )
    {
        throw new Error ( "The Chart canvas has no rendered bounds." );
    }

    await source.evaluate ( ( sourceElement, coordinates ) =>
    {
        // Initialize the local values needed by this operation.

        const canvasElement = document.querySelector<HTMLElement> ( ".chart-canvas" );

        // Handle the case where canvas element matches an absent value.

        if ( canvasElement === null )
        {
            throw new Error ( "The Chart canvas is unavailable for the palette drop." );
        }

        // Initialize the local values needed by this operation.

        const dataTransfer = new DataTransfer ();
        const eventOptions = 
        {
            bubbles:      true,
            cancelable:   true,
            clientX:      coordinates.clientX,
            clientY:      coordinates.clientY,
            dataTransfer,
        };

        sourceElement.dispatchEvent ( new DragEvent ( "dragstart", eventOptions ) );
        canvasElement.dispatchEvent ( new DragEvent ( "dragenter", eventOptions ) );
        canvasElement.dispatchEvent ( new DragEvent ( "dragover", eventOptions ) );
        canvasElement.dispatchEvent ( new DragEvent ( "drop", eventOptions ) );
        sourceElement.dispatchEvent ( new DragEvent ( "dragend", eventOptions ) );
    }, {
        clientX: canvasBounds.x + targetPosition.x,
        clientY: canvasBounds.y + targetPosition.y,
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: performUndo
//
// Description:
//
//   Runs the undo workflow.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - browserName:
//     The browser name supplied to the operation.
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

async function performUndo ( page: Page, browserName: string ): Promise<void>
{
    // Handle the case where browser name matches "webkit".

    if ( browserName === "webkit" )
    {
        await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();

        // Return control to the caller.

        return;
    }

    await page.keyboard.press ( "Control+Z" );
}

//--------------------------------------------------------------------------------------------------
// Function: performRedo
//
// Description:
//
//   Runs the redo workflow.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
//   - browserName:
//     The browser name supplied to the operation.
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

async function performRedo ( page: Page, browserName: string ): Promise<void>
{
    // Handle the case where browser name matches "webkit".

    if ( browserName === "webkit" )
    {
        await page.locator ( "[data-toolbar-entry='toolbar-redo']" ).click ();

        // Return control to the caller.

        return;
    }

    await page.keyboard.press ( "Control+Y" );
}

//--------------------------------------------------------------------------------------------------
// Function: chartNodePosition
//
// Description:
//
//   Derives the chart node position.
//
// Parameters:
//
//   - node:
//     The node supplied to the operation.
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

async function chartNodePosition ( node: Locator ): Promise<{ readonly x: number; readonly y: number }>
{
    // Return the evaluate result.

    return node.evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const match = ( element as HTMLElement ).style.transform.match (
            /translate\((?<x>-?[\d.]+)px,\s*(?<y>-?[\d.]+)px\)/u,
        );
        const x = Number ( match?.groups?.[ "x" ] );
        const y = Number ( match?.groups?.[ "y" ] );

        // Handle the case where at least one branch condition is satisfied.

        if ( !Number.isFinite ( x ) || !Number.isFinite ( y ) )
        {
            throw new Error ( "The Chart node does not expose a finite translated position." );
        }

        // Return the assembled result.

        return { x, y };
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: chartEndpointPosition
//
// Description:
//
//   Derives the chart endpoint position.
//
// Parameters:
//
//   - endpoint:
//     The endpoint supplied to the operation.
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

async function chartEndpointPosition ( endpoint: Locator ): Promise<{ readonly x: number; readonly y: number }>
{
    // Return the evaluate result.

    return endpoint.evaluate ( element => ( {
        x: Number.parseFloat ( ( element as HTMLElement ).style.left ),
        y: Number.parseFloat ( ( element as HTMLElement ).style.top ),
    } ) );
}

test.beforeEach ( async ( { page } ) =>
{
    await page.goto ( "./" );
} );

test ( "Chart zooms out to ten percent", async ( { page } ) =>
{
    await openLightSwitchExample ( page );
    await page.getByRole ( "treeitem", { name: "Chart" } ).click ();
    await page.waitForTimeout ( 300 );

    const zoomOutButton = page.locator ( ".react-flow__controls-zoomout" );

    // Repeat the operation across the bounded iteration range.

    for ( let step = 0; step < 12 && !( await zoomOutButton.isDisabled () ); step++ )
    {
        await zoomOutButton.click ();
        await page.waitForTimeout ( 220 );
    }

    const viewportScale = await page.locator ( ".react-flow__viewport" ).evaluate ( element =>
    {
        // Initialize the local values needed by this operation.

        const match = ( element as HTMLElement ).style.transform.match ( /scale\((?<scale>[\d.]+)\)/u );

        // Return the number result.

        return Number ( match?.groups?.[ "scale" ] );
    } );

    expect ( viewportScale ).toBeGreaterThanOrEqual ( 0.099 );
    expect ( viewportScale ).toBeLessThanOrEqual ( 0.125 );
    await expect ( zoomOutButton ).toBeDisabled ();
} );

test ( "Chart preserves its viewport when a state drag commits", async ( { page } ) =>
{
    await openLightSwitchExample ( page );
    await page.getByRole ( "treeitem", { name: "Chart" } ).click ();
    await page.waitForTimeout ( 300 );

    // Initialize the local values needed by this operation.

    const canvas   = page.getByLabel ( "State Chart canvas" );
    const viewport = page.locator ( ".react-flow__viewport" );

    await page.locator ( ".react-flow__controls-zoomout" ).click ();
    await page.waitForTimeout ( 220 );
    await canvas.focus ();
    await page.keyboard.press ( "ArrowRight" );
    await page.keyboard.press ( "ArrowDown" );

    // Initialize the local values needed by this operation.

    const viewportTransformBeforeDrag = await viewport.evaluate (
        element => ( element as HTMLElement ).style.transform,
    );
    const stateNode               = page.locator ( ".react-flow__node[data-id='state:state_off']" );
    const statePositionBeforeDrag = await chartNodePosition ( stateNode );
    const stateBounds             = await stateNode.boundingBox ();

    expect ( stateBounds ).not.toBeNull ();

    // Handle the case where state bounds matches an absent value.

    if ( stateBounds === null )
    {
        throw new Error ( "The state node has no rendered bounds." );
    }

    await page.mouse.move (
        stateBounds.x + stateBounds.width / 2,
        stateBounds.y + stateBounds.height / 2,
    );
    await page.mouse.down ();
    await page.mouse.move (
        stateBounds.x + stateBounds.width / 2 + 80,
        stateBounds.y + stateBounds.height / 2 + 60,
        { steps: 8 },
    );
    await page.mouse.up ();

    await expect.poll ( async () => chartNodePosition ( stateNode ) ).not.toEqual ( statePositionBeforeDrag );
    await expect.poll ( () => viewport.evaluate (
        element => ( element as HTMLElement ).style.transform,
    ) ).toBe ( viewportTransformBeforeDrag );
} );

test ( "Slice 5 reuses one healthy Chart routing Worker across replacement requests", async (
    { browserName, page },
) =>
{
    await installChartRoutingWorkerLifecycleTracking ( page );
    await openMaintainedFnbExample ( page );
    await page.getByRole ( "treeitem", { name: "Chart" } ).click ();
    await expect.poll ( async () => ( await chartRoutingWorkerLifecycleStats ( page ) ).created ).toBe ( 1 );

    const stateNode = page.locator ( ".react-flow__node-state" ).first ();

    await stateNode.focus ();

    // Repeat the operation across the bounded iteration range.

    for ( let movementIndex = 0; movementIndex < 6; movementIndex += 1 )
    {
        await page.keyboard.press ( movementIndex % 2 === 0 ? "ArrowRight" : "ArrowDown" );
    }

    await expect.poll ( async () => ( await chartRoutingWorkerLifecycleStats ( page ) ).created ).toBe ( 1 );
    await page.waitForTimeout ( 500 );
    const lifecycleStats = await chartRoutingWorkerLifecycleStats ( page );

    expect ( lifecycleStats.created ).toBe ( 1 );
    expect ( lifecycleStats.terminated ).toBe ( 0 );
    expect ( lifecycleStats.routeRequests ).toBeGreaterThan ( 1 );
    expect ( lifecycleStats.cancelled ).toBe ( lifecycleStats.cancellationRequests );
    expect ( lifecycleStats.resultCount ).toBeGreaterThan ( 0 );
    expect ( lifecycleStats.completedRoundTripMilliseconds.every ( duration => duration < 3_000 ) ).toBe ( true );
    await expect ( page.getByRole ( "grid", { name: "Console" } ) ).not.toContainText ( "Chart routing failed" );
    process.stdout.write ( `\nCHART_ROUTING_WORKER_EVIDENCE ${JSON.stringify ( {
        browserName,
        ...lifecycleStats,
    } )}\n` );
} );

test ( "Phase 5 renders the complete authoring projection and runs layered automatic layout", async ( { page } ) =>
{
    await openLightSwitchExample ( page );
    const chartTreeItem = page.getByRole ( "treeitem", { name: "Chart" } );

    await chartTreeItem.focus ();
    await chartTreeItem.press ( "Enter" );
    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();

    const settingsDialog = page.getByRole ( "dialog", { name: "Application Settings" } );

    await settingsDialog.getByRole ( "option", { name: "Chart" } ).click ();
    await expect ( settingsDialog.getByRole ( "spinbutton", { name: "Maximum Megapixels" } ) )
        .toHaveValue ( "1000" );
    await settingsDialog.getByRole ( "spinbutton", { name: "DPI (dots per inch)" } ).fill ( "72" );
    await settingsDialog.getByRole ( "spinbutton", { name: "Maximum Megapixels" } ).fill ( "750" );
    await settingsDialog.getByRole ( "button", { name: "Apply" } ).click ();

    const consoleGrid = page.getByRole ( "grid", { name: "Console" } );
    await page.waitForTimeout ( 500 );
    const preLayoutFallbackRelationLabels = await page.locator (
        ".react-flow__edge[aria-label*='Chart routing used a stable exterior fallback']",
    ).evaluateAll ( relations => relations.map ( relation => relation.getAttribute ( "aria-label" ) ) );

    expect ( preLayoutFallbackRelationLabels ).toEqual ( [] );
    await page.locator ( ".chart-footer" ).getByRole ( "button", { name: "Automatic Layout" } ).click ();

    await expect ( page.getByRole ( "heading", { name: "State Chart" } ) ).toBeVisible ();
    await expect ( page.locator ( ".chart-state-node" ) ).toHaveCount ( 4 );
    await expect ( page.locator ( ".chart-initial-indicator" ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".chart-transition-edge" ) ).toHaveCount ( 16 );
    await expect ( page.locator ( ".chart-initial-edge" ) ).toHaveCount ( 1 );
    await expect ( stateNodeText ( page, "Entry Actions" ).first () ).toBeVisible ();
    await expect ( stateNodeText ( page, "Exit Actions" ).first () ).toBeVisible ();
    await expect ( page.locator ( ".react-flow__edge-path" ).first () ).toHaveAttribute ( "d", / C /u );
    expect ( await page.locator ( ".react-flow__edge-path" ).evaluateAll ( paths => paths.every (
        path => path.getAttribute ( "d" )?.includes ( " L " ) === false,
    ) ) ).toBe ( true );
    await expect.poll ( async () => page.locator ( ".react-flow__edge-path" ).evaluateAll ( paths => paths.every (
        path => window.getComputedStyle ( path ).strokeDasharray === "none",
    ) ) ).toBe ( true );

    // Initialize the local values needed by this operation.

    const transitionArrowMarker = page.locator ( "#chart-transition-arrow" );
    const arrowHeadSize         = DEFAULT_APPLICATION_PREFERENCES.transitionArrowHeadSize;
    const arrowHeadHalfWidth    = arrowHeadSize / 6;

    await expect ( page.locator ( "[data-chart-gravity-point='true']" ) ).toHaveCount ( 0 );
    await expect ( page.locator ( "[data-chart-transition-connector]" ) ).toHaveCount ( 0 );
    await expect ( page.locator ( "[data-chart-transition-hidden-line]" ) ).toHaveCount ( 0 );

    await expect ( transitionArrowMarker ).toHaveAttribute ( "markerWidth", String ( arrowHeadSize ) );
    await expect ( transitionArrowMarker ).toHaveAttribute ( "markerHeight", String ( arrowHeadSize ) );
    await expect ( transitionArrowMarker ).toHaveAttribute ( "overflow", "visible" );
    await expect ( transitionArrowMarker.locator ( "polygon" ) ).toHaveAttribute (
        "points",
        `0,${-arrowHeadHalfWidth} ${arrowHeadSize},0 0,${arrowHeadHalfWidth}`,
    );
    await expect ( page.locator ( ".chart-transition-edge .react-flow__edge-path" ).first () ).toHaveAttribute (
        "marker-end",
        "url('#chart-transition-arrow')",
    );
    await page.waitForTimeout ( 3_500 );
    const fallbackRelationLabels = await page.locator (
        ".react-flow__edge[aria-label*='Chart routing used a stable exterior fallback']",
    ).evaluateAll ( relations => relations.map ( relation => relation.getAttribute ( "aria-label" ) ) );

    expect ( fallbackRelationLabels ).toEqual ( [] );
    await expect ( consoleGrid ).not.toContainText ( "Chart routing failed" );
    await expect ( consoleGrid ).not.toContainText ( "Chart routing used a stable exterior fallback" );

    // Initialize the local values needed by this operation.

    const palette = page.getByRole ( "complementary", { name: "Palette" } );
    const footer  = page.locator ( ".chart-footer" );

    await expect ( palette.getByRole ( "button" ) ).toHaveText ( [
        "State",
        "Initial Indicator",
        "Terminal Indicator",
        "Transition",
    ] );
    await expect ( palette.getByRole ( "button", { name: "Initial Indicator" } ) ).toBeDisabled ();
    await expect ( palette.getByRole ( "button", { name: "Terminal Indicator" } ) ).toBeEnabled ();
    await expect ( palette.locator ( ".chart-selection-summary" ) ).toHaveCount ( 0 );
    await expect ( footer.locator ( ".chart-selection-summary" ) ).toHaveCount ( 0 );
    await expect ( footer.getByRole ( "button" ) ).toHaveText (
        [ "Automatic Layout", "Fit Chart", "Save As Image" ],
    );
    await expect ( page.locator ( ".react-flow__controls-fitview" ) ).toHaveCount ( 0 );

    const initialSymbolStyles = await page.locator ( ".chart-initial-indicator .chart-indicator-symbol" ).evaluate (
        element =>
        {
            // Initialize the local values needed by this operation.

            const styles = window.getComputedStyle ( element );

            // Return the assembled result.

            return {
                backgroundColor: styles.backgroundColor,
                borderStyle:     styles.borderStyle,
                height:          styles.height,
                width:           styles.width,
            };
        },
    );

    expect ( initialSymbolStyles.backgroundColor ).not.toBe ( "rgba(0, 0, 0, 0)" );
    expect ( initialSymbolStyles.borderStyle ).toBe ( "none" );
    expect ( initialSymbolStyles.height ).toBe ( "50px" );
    expect ( initialSymbolStyles.width ).toBe ( "50px" );
    expect ( initialSymbolStyles.backgroundColor ).toBe ( await page.locator (
        ".chart-initial-edge .react-flow__edge-path",
    ).evaluate ( element => window.getComputedStyle ( element ).stroke ) );
    await expect ( page.locator ( ".chart-initial-edge .react-flow__edge-text" ) ).toHaveCount ( 0 );

    await expect.poll ( async () => new Set ( await page.locator ( ".react-flow__node-state" ).evaluateAll (
        stateNodes => stateNodes.map ( stateNode => ( stateNode as HTMLElement ).style.transform ),
    ) ).size ).toBeGreaterThan ( 1 );

    // Initialize the local values needed by this operation.

    const stateLayerCoordinates = await page.locator ( ".react-flow__node-state" ).evaluateAll ( stateNodes =>
        stateNodes.map ( stateNode =>
        {
            // Initialize the local values needed by this operation.

            const transform = ( stateNode as HTMLElement ).style.transform;
            const match     = /translate\(([-\d.]+)px, ([-\d.]+)px\)/u.exec ( transform );

            // Return the assembled result.

            return {
                name: stateNode.querySelector ( ".chart-state-header strong" )?.textContent ?? "",
                x:    Number ( match?.[ 1 ] ?? 0 ),
                y:    Number ( match?.[ 2 ] ?? 0 ),
            };
        } ),
    );
    const initialState = stateLayerCoordinates.find ( state => state.name === "state_start" );

    expect ( initialState ).toBeDefined ();
    expect ( initialState?.y ).toBe ( Math.min ( ...stateLayerCoordinates.map ( state => state.y ) ) );
    expect ( stateLayerCoordinates.every ( state =>
        state.x % DEFAULT_APPLICATION_PREFERENCES.gridSize === 0 &&
        state.y % DEFAULT_APPLICATION_PREFERENCES.gridSize === 0 ) ).toBe ( true );

    // Automatic Layout guarantees a Euclidean minimum between state centres. ELK Layered separates
    // states only within a layer and between layers, so the guarantee comes from the scaling pass
    // that follows it; a regression there shows up here as two states closer than the configured
    // distance.

    const stateCentres = await page.locator ( ".react-flow__node-state" ).evaluateAll ( stateNodes =>
        stateNodes.map ( stateNode =>
        {
            // Initialize the local values needed by this operation.

            const element = stateNode as HTMLElement;
            const match   = /translate\(([-\d.]+)px, ([-\d.]+)px\)/u.exec ( element.style.transform );

            // Return the assembled result.

            return {
                x: Number ( match?.[ 1 ] ?? 0 ) + Number.parseFloat ( element.style.width ) / 2,
                y: Number ( match?.[ 2 ] ?? 0 ) + Number.parseFloat ( element.style.height ) / 2,
            };
        } ),
    );

    // Repeat the operation across the bounded iteration range.

    for ( let left = 0; left < stateCentres.length; left++ )
    {
        // Repeat the operation across the bounded iteration range.

        for ( let right = left + 1; right < stateCentres.length; right++ )
        {
            // Initialize the local values needed by this operation.

            const first      = stateCentres [ left ];
            const second     = stateCentres [ right ];
            const separation = Math.hypot (
                ( first?.x ?? 0 ) - ( second?.x ?? 0 ),
                ( first?.y ?? 0 ) - ( second?.y ?? 0 ),
            );

            expect ( separation ).toBeGreaterThanOrEqual (
                DEFAULT_APPLICATION_PREFERENCES.minimumStateDistance,
            );
        }
    }

    const reciprocalPaths = await Promise.all ( [
        page.locator ( ".chart-transition-edge[aria-label='state_off, event_toggle_on, state_on'] .react-flow__edge-path" )
            .getAttribute ( "d" ),
        page.locator ( ".chart-transition-edge[aria-label='state_on, event_toggle_off, state_off'] .react-flow__edge-path" )
            .getAttribute ( "d" ),
    ] );

    expect ( reciprocalPaths [ 0 ] ).not.toBe ( reciprocalPaths [ 1 ] );

    const fuseSelfLoopPaths = await page.locator (
        ".chart-transition-edge[aria-label^='state_fuse_blown,'][aria-label$=', state_fuse_blown'] .react-flow__edge-path",
    ).evaluateAll ( paths => paths.map ( path => path.getAttribute ( "d" ) ) );

    expect ( fuseSelfLoopPaths ).toHaveLength ( 4 );
    expect ( new Set ( fuseSelfLoopPaths ).size ).toBe ( 4 );

    // Initialize the local values needed by this operation.

    const diagonalEdge = page.locator (
        ".chart-transition-edge[aria-label='state_start, event_blow_fuse, state_fuse_blown']",
    );
    const diagonalPath          = diagonalEdge.locator ( ".react-flow__edge-path" );
    const diagonalPathData      = await diagonalPath.getAttribute ( "d" );
    const targetCoordinateMatch = /,\s*(?<x>-?[\d.]+)\s+(?<y>-?[\d.]+)\s*$/u.exec ( diagonalPathData ?? "" );
    const targetNode            = page.locator ( ".react-flow__node[data-id='state:state_fuse_blown']" );
    const targetPosition        = await chartNodePosition ( targetNode );
    const targetDimensions      = await targetNode.evaluate ( element => ( {
        height: Number.parseFloat ( ( element as HTMLElement ).style.height ),
        width: Number.parseFloat ( ( element as HTMLElement ).style.width ),
    } ) );
    const targetX                  = Number ( targetCoordinateMatch?.groups?.[ "x" ] );
    const targetY                  = Number ( targetCoordinateMatch?.groups?.[ "y" ] );
    const targetCenterX            = targetPosition.x + targetDimensions.width / 2;
    const targetCenterY            = targetPosition.y + targetDimensions.height / 2;
    const targetHorizontalOffset   = Math.abs ( targetX - targetCenterX );
    const targetVerticalOffset     = Math.abs ( targetY - targetCenterY );
    const targetHalfWidth          = targetDimensions.width / 2;
    const targetHalfHeight         = targetDimensions.height / 2;
    const stateCornerRadius        = 10;
    const boundaryTolerance        = 0.05;
    const targetOnVerticalBoundary = Math.abs ( targetHorizontalOffset - targetHalfWidth ) < boundaryTolerance &&
        targetVerticalOffset <= targetHalfHeight - stateCornerRadius + boundaryTolerance;
    const targetOnHorizontalBoundary = Math.abs ( targetVerticalOffset - targetHalfHeight ) < boundaryTolerance &&
        targetHorizontalOffset <= targetHalfWidth - stateCornerRadius + boundaryTolerance;
    const targetCornerOffsetX   = targetHorizontalOffset - ( targetHalfWidth - stateCornerRadius );
    const targetCornerOffsetY   = targetVerticalOffset - ( targetHalfHeight - stateCornerRadius );
    const targetOnRoundedCorner = targetCornerOffsetX >= -boundaryTolerance &&
        targetCornerOffsetY >= -boundaryTolerance &&
        Math.abs ( Math.hypot ( targetCornerOffsetX, targetCornerOffsetY ) - stateCornerRadius ) < boundaryTolerance;

    expect ( Number.isFinite ( targetX ) && Number.isFinite ( targetY ) ).toBe ( true );
    expect ( targetOnVerticalBoundary || targetOnHorizontalBoundary || targetOnRoundedCorner ).toBe ( true );
    expect ( targetX === targetPosition.x + targetDimensions.width / 2 &&
        targetY === targetPosition.y + targetDimensions.height / 2 ).toBe ( false );
    await expect ( diagonalPath ).toHaveAttribute ( "marker-end", /url/u );

    // Initialize the local values needed by this operation.

    const stateLayerZIndex = Number ( await targetNode.evaluate ( element => window.getComputedStyle ( element ).zIndex ) );
    const edgeLayerZIndex  = Number.parseInt (
        await diagonalEdge.evaluate ( element => window.getComputedStyle ( element ).zIndex ),
        10,
    ) || 0;

    expect ( stateLayerZIndex ).toBeGreaterThan ( edgeLayerZIndex );

    const expandChartStatesButton = page.locator ( "[data-toolbar-entry='toolbar-expand-chart-states']" );

    await expandChartStatesButton.click ();
    await expect ( stateNodeText ( page, "Entry Actions" ) ).toHaveCount ( 0 );
    await expandChartStatesButton.click ();
    await expect ( stateNodeText ( page, "Entry Actions" ).first () ).toBeVisible ();
} );

test ( "Phase 6 exports a non-mutating complete Chart image through the download fallback", async ( { page } ) =>
{
    await openLightSwitchExample ( page );
    await page.getByRole ( "treeitem", { name: "Chart" } ).click ();
    await expect ( page.locator ( ".chart-transition-edge .react-flow__edge-text" ).first () ).toBeVisible ();
    const expectedTransitionLabelLines = await page.locator (
        ".chart-transition-edge .react-flow__edge-text",
    ).evaluateAll ( labels => labels.flatMap ( label => ( label.textContent ?? "" ).split ( "\n" ) ) );

    await page.evaluate ( () =>
    {
        // Initialize the local values needed by this operation.

        const rasterizedTexts: string[] = [];
        const originalFillText          = CanvasRenderingContext2D.prototype.fillText;

        Object.defineProperty ( window, "__automataLabRasterizedTexts", {
            configurable: true,
            value:        rasterizedTexts,
        } );
        Object.defineProperty ( window, "showSaveFilePicker", {
            configurable: true,
            value:        undefined,
        } );
        CanvasRenderingContext2D.prototype.fillText = function (
            textValue: string,
            x: number,
            y: number,
            maximumWidth?: number,
        ): void
        {
            rasterizedTexts.push ( textValue );

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

    // Initialize the local values needed by this operation.

    const titleBeforeExport = await page.title ();
    const downloadPromise   = page.waitForEvent ( "download" );

    await page.getByRole ( "button", { name: "Save As Image" } ).click ();

    const download = await downloadPromise;

    expect ( download.suggestedFilename () ).toMatch ( /-chart\.png$/u );
    await expect ( page.getByLabel ( "Application status" )
        .getByText ( `Saved Chart image: ${download.suggestedFilename ()}`, { exact: true } ) ).toBeVisible ();
    expect ( await page.title () ).toBe ( titleBeforeExport );
    await expect ( page.getByRole ( "button", { name: "Save As Image" } ) ).toBeFocused ();

    const rasterizedTexts = await page.evaluate ( () =>
        ( window as unknown as { __automataLabRasterizedTexts?: readonly string[] } )
            .__automataLabRasterizedTexts ?? [] );

    // Process each expected line from the current value collection in order.

    for ( const expectedLine of new Set ( expectedTransitionLabelLines ) )
    {
        // Initialize the local values needed by this operation.

        const expectedCount   = expectedTransitionLabelLines.filter ( line => line === expectedLine ).length;
        const rasterizedCount = rasterizedTexts.filter ( line => line === expectedLine ).length;

        expect ( rasterizedCount ).toBeGreaterThanOrEqual ( expectedCount );
    }
} );

test ( "Chart palette drops are transactional, keyboard movable, accessible, and responsive", async (
    { browserName, page },
) =>
{
    await createNewDocument ( page );
    await page.getByRole ( "treeitem", { name: "Chart" } ).click ();
    await page.getByRole ( "menuitem", { name: "File" } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();

    const settingsDialog = page.getByRole ( "dialog", { name: "Application Settings" } );

    await settingsDialog.getByRole ( "option", { name: "Chart" } ).click ();
    await settingsDialog.getByRole ( "spinbutton", { name: "Grid Size (CSS pixels)" } ).fill ( "20" );
    await settingsDialog.getByRole ( "spinbutton", {
        name: "Route Obstacle Offset (px)",
    } ).fill ( "24" );
    await settingsDialog.getByRole ( "button", { name: "Apply" } ).click ();

    // Initialize the local values needed by this operation.

    const palette                 = page.getByRole ( "complementary", { name: "Palette" } );
    const footer                  = page.locator ( ".chart-footer" );
    const chartPane               = page.locator ( ".react-flow__pane" );
    const stateButton             = palette.getByRole ( "button", { name: "State", exact: true } );
    const transitionButton        = palette.getByRole ( "button", { name: "Transition", exact: true } );
    const initialIndicatorButton  = palette.getByRole ( "button", { name: "Initial Indicator" } );
    const terminalIndicatorButton = palette.getByRole ( "button", { name: "Terminal Indicator" } );

    await expect ( palette.getByRole ( "button" ) ).toHaveText ( [
        "State",
        "Initial Indicator",
        "Terminal Indicator",
        "Transition",
    ] );
    await expect ( initialIndicatorButton ).toBeEnabled ();
    await expect ( terminalIndicatorButton ).toBeEnabled ();
    await expect ( footer.getByRole ( "button" ) ).toHaveText (
        [ "Automatic Layout", "Fit Chart", "Save As Image" ],
    );
    await stateButton.click ();
    await transitionButton.click ();
    await expect ( page.locator ( ".chart-state-node" ) ).toHaveCount ( 0 );
    await expect ( page.getByRole ( "dialog", { name: "Named entity" } ) ).toHaveCount ( 0 );
    await expect ( page.getByRole ( "dialog", { name: "Transition" } ) ).toHaveCount ( 0 );
    await dragPaletteItemToCanvas ( page, stateButton, { x: 300, y: 180 }, browserName );
    await expect ( page.locator ( "[data-chart-state='state_1']" ) ).toBeVisible ();
    await expect ( page.locator ( ".react-flow__node[data-id='state:state_1']" ) ).toBeFocused ();
    await dragPaletteItemToCanvas ( page, stateButton, { x: 520, y: 300 }, browserName );

    const keyboardStateNode = page.locator ( ".react-flow__node[data-id='state:state_2']" );

    await expect ( keyboardStateNode ).toBeVisible ();
    await expect ( keyboardStateNode ).toBeFocused ();
    await keyboardStateNode.click ();
    await expect ( page.getByText ( "Chart Elements Selected: 1", { exact: true } ) ).toBeVisible ();
    await page.keyboard.press ( "Delete" );
    await expect ( keyboardStateNode ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-canvas" ) ).toBeFocused ();

    await dragPaletteItemToCanvas ( page, transitionButton, { x: 360, y: 360 }, browserName );

    const keyboardDraftNode = page.locator ( ".react-flow__node-draftTransition" );

    await expect ( page.getByRole ( "dialog", { name: "Transition" } ) ).toBeHidden ();
    await expect ( keyboardDraftNode ).toHaveCount ( 1 );
    await expect ( keyboardDraftNode ).toBeFocused ();
    await keyboardDraftNode.click ( { force: true } );
    await expect ( page.getByText ( "Chart Elements Selected: 1", { exact: true } ) ).toBeVisible ();
    await keyboardDraftNode.focus ();
    await page.keyboard.press ( "Delete" );
    await expect ( keyboardDraftNode ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-canvas" ) ).toBeFocused ();

    await dragPaletteItemToCanvas ( page, initialIndicatorButton, { x: 80, y: 80 }, browserName );
    await expect ( initialIndicatorButton ).toBeDisabled ();
    await expect ( page.locator ( ".chart-initial-indicator" ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".react-flow__node[data-id='initial-indicator']" ) ).toBeFocused ();

    await dragPaletteItemToCanvas ( page, terminalIndicatorButton, { x: 700, y: 100 }, browserName );

    const terminalDropCanvasBounds = await page.locator ( ".chart-canvas" ).boundingBox ();
    const terminalDropStateBounds  = await page.locator ( "[data-chart-state='state_1']" ).boundingBox ();

    if ( terminalDropCanvasBounds === null || terminalDropStateBounds === null )
    {
        throw new Error ( "The Chart canvas or target state has no rendered bounds for the terminal-indicator drop." );
    }

    await dragPaletteItemToCanvas ( page, terminalIndicatorButton, {
        x: terminalDropStateBounds.x + terminalDropStateBounds.width / 2 - terminalDropCanvasBounds.x,
        y: terminalDropStateBounds.y + terminalDropStateBounds.height / 2 - terminalDropCanvasBounds.y,
    }, browserName );
    await expect ( terminalIndicatorButton ).toBeEnabled ();
    await expect ( page.locator ( ".chart-terminal-indicator" ) ).toHaveCount ( 2 );

    const terminalSymbolStyles = await page.locator ( ".chart-terminal-indicator .chart-indicator-symbol" ).first ().evaluate (
        element =>
        {
            // Initialize the local values needed by this operation.

            const styles      = window.getComputedStyle ( element );
            const innerStyles = window.getComputedStyle ( element, "::after" );

            // Return the assembled result.

            return {
                borderColor:          styles.borderColor,
                borderStyle:          styles.borderStyle,
                borderWidth:          styles.borderWidth,
                height:               styles.height,
                innerBackgroundColor: innerStyles.backgroundColor,
                innerContent:         innerStyles.content,
                width:                styles.width,
            };
        },
    );

    expect ( terminalSymbolStyles.borderStyle ).toBe ( "solid" );
    expect ( terminalSymbolStyles.borderWidth ).toBe ( "6px" );
    expect ( terminalSymbolStyles.height ).toBe ( "60px" );
    expect ( terminalSymbolStyles.innerBackgroundColor ).not.toBe ( "rgba(0, 0, 0, 0)" );
    expect ( terminalSymbolStyles.innerContent ).not.toBe ( "none" );
    expect ( terminalSymbolStyles.width ).toBe ( "60px" );

    await chartPane.click ( { position: { x: 5, y: 5 } } );
    await expect ( page.getByText ( /Chart Elements Selected:/u ) ).toHaveCount ( 0 );

    // Handle the case where browser name matches "chromium".

    if ( browserName === "chromium" )
    {
        await connectChartHandles (
            page,
            ".chart-initial-indicator .react-flow__handle.source",
            "[data-chart-state='state_1'] .react-flow__handle-top",
        );
    }
    else
    {
        // Handle the remaining case after the preceding condition is false.

        await page.locator ( ".chart-initial-indicator" ).click ();
        await page.locator ( "[data-chart-state='state_1']" ).click ( { modifiers: [ "Shift" ] } );
        await refreshWindowsChartProjection (
            page,
            page.locator ( ".chart-initial-edge" ),
            /^Initial-state connection: state_1$/u,
        );
    }
    await expect ( page.getByText ( "Initial State: state_1", { exact: true } ) ).toBeVisible ();
    await expect ( page.locator ( ".chart-initial-edge" ) ).toHaveCount ( 1 );

    // Initialize the local values needed by this operation.

    const terminalFlowNodes = page.locator ( ".react-flow__node-indicator" ).filter ( {
        has: page.locator ( ".chart-terminal-indicator" ),
    } );
    const terminalFlowNode = terminalFlowNodes.filter ( {
        has: page.locator ( ".chart-terminal-indicator[data-indicator-id='1']" ),
    } );
    const unconnectedTerminalFlowNode = terminalFlowNodes.filter ( {
        has: page.locator ( ".chart-terminal-indicator[data-indicator-id='0']" ),
    } );
    const terminalConnectionDialog = page.getByRole ( "dialog", { name: "Connect Terminal Indicator" } );

    await expect ( page.locator ( "#chart-keyboard-instructions" ) ).toContainText (
        "Drag palette items onto the Chart canvas to place them",
    );
    await expect ( terminalFlowNode ).toHaveAttribute ( "tabindex", "0" );
    await expect ( terminalFlowNode ).toHaveAttribute (
        "aria-label",
        "Terminal indicator 1. Press Enter or Space to connect a source state.",
    );
    await unconnectedTerminalFlowNode.focus ();
    await page.keyboard.press ( "Enter" );
    await expect ( terminalConnectionDialog ).toBeVisible ();
    await terminalConnectionDialog.getByRole ( "button", { name: "Cancel" } ).click ();
    await expect ( terminalConnectionDialog ).toBeHidden ();
    await expect ( unconnectedTerminalFlowNode ).toBeFocused ();

    // Handle the case where browser name differs from "chromium".

    if ( browserName !== "chromium" )
    {
        await refreshWindowsChartProjection (
            page,
            page.locator ( ".chart-terminal-edge" ),
            /^Terminal-indicator connection: state_1, Terminal indicator 1$/u,
        );
    }

    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveAttribute (
        "aria-label",
        "Terminal-indicator connection: state_1, Terminal indicator 1",
    );
    await expect ( page.locator ( ".chart-terminal-edge .react-flow__edge-text" ) ).toHaveCount ( 0 );

    const indicatorEdgeStyles = await page.locator (
        ".chart-initial-edge .react-flow__edge-path, .chart-terminal-edge .react-flow__edge-path",
    ).evaluateAll ( edges => edges.map ( edge =>
    {
        // Initialize the local values needed by this operation.

        const styles = window.getComputedStyle ( edge );

        // Return the assembled result.

        return { dashArray: styles.strokeDasharray, stroke: styles.stroke };
    } ) );

    expect ( indicatorEdgeStyles ).toHaveLength ( 2 );
    expect ( indicatorEdgeStyles [ 0 ]?.dashArray ).toBe ( "none" );
    expect ( indicatorEdgeStyles [ 1 ]?.dashArray ).toBe ( "none" );
    expect ( indicatorEdgeStyles [ 0 ]?.stroke ).toBe ( indicatorEdgeStyles [ 1 ]?.stroke );
    expect ( terminalSymbolStyles.borderColor ).toBe ( indicatorEdgeStyles [ 1 ]?.stroke );
    expect ( await page.locator ( "#chart-transition-arrow polygon" ).evaluate (
        marker => window.getComputedStyle ( marker ).fill,
    ) ).toBe ( indicatorEdgeStyles [ 1 ]?.stroke );

    const impactDialog = page.getByRole ( "dialog", { name: "Confirm cascading deletion" } );

    await chartPane.click ( { position: { x: 5, y: 5 } } );
    await expect ( page.getByText ( /Chart Elements Selected:/u ) ).toHaveCount ( 0 );
    await page.locator ( ".chart-terminal-edge" ).focus ();
    await page.keyboard.press ( "Enter" );
    await expect ( page.getByText ( "Chart Elements Selected: 1", { exact: true } ) ).toBeVisible ();
    await page.keyboard.press ( "Delete" );
    await expect ( impactDialog ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 0 );
    await expect ( page.locator ( "[data-chart-state='state_1']" ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".chart-terminal-indicator" ) ).toHaveCount ( 2 );
    await performUndo ( page, browserName );

    // Handle the case where browser name differs from "chromium".

    if ( browserName !== "chromium" )
    {
        await refreshWindowsChartProjection (
            page,
            page.locator ( ".chart-terminal-edge" ),
            /^Terminal-indicator connection: state_1, Terminal indicator 1$/u,
        );
    }

    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 1 );
    await performRedo ( page, browserName );
    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 0 );
    await performUndo ( page, browserName );

    // Handle the case where browser name differs from "chromium".

    if ( browserName !== "chromium" )
    {
        await refreshWindowsChartProjection (
            page,
            page.locator ( ".chart-terminal-edge" ),
            /^Terminal-indicator connection: state_1, Terminal indicator 1$/u,
        );
    }

    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 1 );

    await page.locator ( ".chart-initial-edge" ).focus ();
    await page.keyboard.press ( "Enter" );
    await expect ( page.getByText ( "Chart Elements Selected: 1", { exact: true } ) ).toBeVisible ();
    await page.keyboard.press ( "Delete" );

    await expect ( impactDialog ).toHaveCount ( 0 );
    await expect ( page.getByText ( "Initial State: N/A", { exact: true } ) ).toBeVisible ();
    await expect ( page.locator ( ".chart-initial-edge" ) ).toHaveCount ( 0 );
    await performUndo ( page, browserName );

    // Handle the case where browser name differs from "chromium".

    if ( browserName !== "chromium" )
    {
        await refreshWindowsChartProjection (
            page,
            page.locator ( ".chart-initial-edge" ),
            /^Initial-state connection: state_1$/u,
        );
    }

    await expect ( page.getByText ( "Initial State: state_1", { exact: true } ) ).toBeVisible ();
    await expect ( page.locator ( ".chart-initial-edge" ) ).toHaveCount ( 1 );

    await page.locator ( ".chart-initial-indicator" ).click ();
    await expect ( page.getByText ( "Chart Elements Selected: 1", { exact: true } ) ).toBeVisible ();
    await page.keyboard.press ( "Delete" );
    await expect ( impactDialog ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-initial-indicator" ) ).toHaveCount ( 0 );
    await expect ( initialIndicatorButton ).toBeEnabled ();
    await performUndo ( page, browserName );
    await expect ( page.locator ( ".chart-initial-indicator" ) ).toHaveCount ( 1 );
    await expect ( initialIndicatorButton ).toBeDisabled ();

    const stateNode = page.locator ( ".react-flow__node-state" ).first ();

    await stateNode.focus ();
    const positionBeforeMove = await chartNodePosition ( stateNode );

    await page.keyboard.press ( "ArrowRight" );
    await expect.poll ( () => chartNodePosition ( stateNode ).then ( position => position.x ) )
        .toBeGreaterThan ( positionBeforeMove.x );
    await expect.poll ( () => chartNodePosition ( stateNode ).then ( position => position.x % 20 ) ).toBe ( 0 );
    await expect ( stateNode ).toBeFocused ();
    await page.keyboard.press ( "Shift+ArrowDown" );
    await expect.poll ( () => chartNodePosition ( stateNode ).then ( position => position.y ) )
        .toBeGreaterThanOrEqual ( positionBeforeMove.y + 60 );
    await expect.poll ( () => chartNodePosition ( stateNode ).then ( position => position.y % 20 ) ).toBe ( 0 );
    await expect ( stateNode ).toBeFocused ();
    await expect ( page ).toHaveTitle ( /Unsaved changes/u );

    await stateNode.focus ();
    await page.keyboard.press ( "Delete" );
    await expect ( impactDialog ).toHaveCount ( 0 );
    await expect ( page.locator ( "[data-chart-state='state_1']" ) ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-canvas" ) ).toBeFocused ();
    await performUndo ( page, browserName );
    await expect ( page.locator ( "[data-chart-state='state_1']" ) ).toHaveCount ( 1 );

    expect ( ( await new AxeBuilder ( { page } ).include ( ".chart-page" ).analyze () ).violations ).toEqual ( [] );

    await page.setViewportSize ( { height: 720, width: 320 } );
    const detailButton = page.getByRole ( "button", { name: "Detail", exact: true } );

    // Handle the case where current value is enabled.

    if ( await detailButton.isVisible () )
    {
        await detailButton.click ();
    }

    await expect ( palette.getByRole ( "button", { name: "State", exact: true } ) ).toBeVisible ();

    const dimensions = await page.evaluate ( () => ( {
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth:       window.innerWidth,
    } ) );

    expect ( dimensions.documentScrollWidth ).toBeLessThanOrEqual ( dimensions.viewportWidth );
} );

test ( "Chart drag-drop drafts configure atomically and preserve accessible focus", async ( { browserName, page } ) =>
{
    await createNewDocument ( page );
    await pinChartGridSize ( page, "20" );
    await page.getByRole ( "treeitem", { name: "Events", exact: true } ).click ();

    const eventPage = page.locator ( ".editor-list-page" );

    await eventPage.getByRole ( "button", { name: "Add" } ).click ();
    await page.getByRole ( "textbox", { name: "Name" } ).fill ( "event_go" );
    await page.getByRole ( "button", { name: "Confirm" } ).click ();
    await page.getByRole ( "treeitem", { name: "Chart" } ).click ();

    // Initialize the local values needed by this operation.

    const palette     = page.getByRole ( "complementary", { name: "Palette" } );
    const footer      = page.locator ( ".chart-footer" );
    const stateButton = palette.getByRole ( "button", { name: "State", exact: true } );

    await dragPaletteItemToCanvas ( page, stateButton, { x: 260, y: 220 }, browserName );
    await expect ( page.getByRole ( "dialog", { name: "Named entity" } ) ).toHaveCount ( 0 );
    await expect ( page.locator ( "[data-chart-state='state_1']" ) ).toBeVisible ();

    await dragPaletteItemToCanvas ( page, stateButton, { x: 660, y: 220 }, browserName );
    await expect ( page.getByRole ( "dialog", { name: "Named entity" } ) ).toHaveCount ( 0 );
    await expect ( page.locator ( "[data-chart-state='state_2']" ) ).toBeVisible ();

    // Initialize the local values needed by this operation.

    const firstState  = page.locator ( "[data-chart-state='state_1']" );
    const secondState = page.locator ( "[data-chart-state='state_2']" );

    await footer.getByRole ( "button", { name: "Automatic Layout" } ).click ();
    await expect.poll ( async () =>
    {
        // Initialize the local values needed by this operation.

        const firstBounds  = await firstState.boundingBox ();
        const secondBounds = await secondState.boundingBox ();

        // Return the computed result.

        return firstBounds !== null && secondBounds !== null && (
            firstBounds.x + firstBounds.width < secondBounds.x ||
            secondBounds.x + secondBounds.width < firstBounds.x ||
            firstBounds.y + firstBounds.height < secondBounds.y ||
            secondBounds.y + secondBounds.height < firstBounds.y
        );
    } ).toBe ( true );

    const stateHandleIdentifiers = await page.locator ( ".chart-state-node" ).first ().locator (
        ".react-flow__handle",
    ).evaluateAll ( handles => handles.map ( handle => ( {
        identifier: handle.getAttribute ( "data-handleid" ),
        opacity: window.getComputedStyle ( handle ).opacity,
    } ) ) );

    expect ( stateHandleIdentifiers ).toEqual ( [
        { identifier: "top", opacity: "0" },
        { identifier: "right", opacity: "0" },
        { identifier: "bottom", opacity: "0" },
        { identifier: "left", opacity: "0" },
    ] );

    const transitionButton = palette.getByRole ( "button", { name: "Transition", exact: true } );

    await transitionButton.focus ();
    await expect ( transitionButton ).toBeFocused ();
    await transitionButton.click ();
    await expect ( page.getByRole ( "dialog", { name: "Transition" } ) ).toHaveCount ( 0 );
    await transitionButton.focus ();
    await expect ( transitionButton ).toBeFocused ();

    await dragPaletteItemToCanvas ( page, transitionButton, { x: 120, y: 380 }, browserName );
    await expect ( page.getByRole ( "dialog", { name: "Transition" } ) ).toHaveCount ( 0 );

    // Initialize the local values needed by this operation.

    let draftNode   = page.locator ( ".react-flow__node-draftTransition" );
    const draftPath = draftNode.locator ( ".chart-draft-transition-node > svg > path" );

    await expect ( draftNode ).toHaveCount ( 1 );
    await expect ( draftNode ).toHaveAttribute ( "role", "button" );
    await expect ( draftPath ).toHaveAttribute ( "d", / C /u );
    await expect ( draftPath ).toHaveAttribute ( "marker-end", /chart-draft-transition-arrow/u );

    await draftNode.focus ();
    await page.keyboard.press ( "Delete" );
    await expect ( page.getByRole ( "dialog", { name: "Confirm cascading deletion" } ) ).toHaveCount ( 0 );
    await expect ( draftNode ).toHaveCount ( 0 );
    await performUndo ( page, browserName );
    await expect ( draftNode ).toHaveCount ( 1 );

    // Initialize the local values needed by this operation.

    const transformBeforeMove = await draftNode.evaluate ( element => ( element as HTMLElement ).style.transform );
    const draftBounds         = await draftNode.boundingBox ();

    expect ( draftBounds ).not.toBeNull ();

    // Handle the case where draft bounds differs from an absent value.

    if ( draftBounds !== null )
    {
        await page.mouse.move ( draftBounds.x + draftBounds.width / 2, draftBounds.y + draftBounds.height / 2 );
        await page.mouse.down ();
        await page.mouse.move (
            draftBounds.x + draftBounds.width / 2 + 70,
            draftBounds.y + draftBounds.height / 2 + 35,
            { steps: 8 },
        );
        await page.mouse.up ();
    }

    await expect.poll ( () => draftNode.evaluate ( element => ( element as HTMLElement ).style.transform ) )
        .not.toBe ( transformBeforeMove );
    const transformAfterMove = await draftNode.evaluate ( element => ( element as HTMLElement ).style.transform );

    await performUndo ( page, browserName );
    await expect.poll ( () => draftNode.evaluate ( element => ( element as HTMLElement ).style.transform ) )
        .toBe ( transformBeforeMove );
    await performRedo ( page, browserName );
    await expect.poll ( () => draftNode.evaluate ( element => ( element as HTMLElement ).style.transform ) )
        .toBe ( transformAfterMove );

    // Initialize the local values needed by this operation.

    const sourceEndpoint = page.getByRole ( "button", { name: "Move draft transition source endpoint 0" } );
    const targetEndpoint = page.getByRole ( "button", { name: "Move draft transition target endpoint 0" } );

    await sourceEndpoint.click ();
    await expect ( page.getByRole ( "dialog", { name: "Error" } ) ).toHaveCount ( 0 );
    await expect ( draftNode ).toHaveCount ( 1 );

    await dragLocatorToLocator ( page, sourceEndpoint, firstState );
    await expect ( sourceEndpoint ).toBeFocused ();

    // Initialize the local values needed by this operation.

    const firstSnappedEndpointBounds = await sourceEndpoint.boundingBox ();
    const firstStateBounds           = await firstState.boundingBox ();

    expect ( firstSnappedEndpointBounds ).not.toBeNull ();
    expect ( firstStateBounds ).not.toBeNull ();

    // Handle the case where all required conditions are satisfied.

    if ( firstSnappedEndpointBounds !== null && firstStateBounds !== null )
    {
        expect ( firstSnappedEndpointBounds.x + firstSnappedEndpointBounds.width / 2 )
            .toBeCloseTo ( firstStateBounds.x + firstStateBounds.width / 2, 0 );
        expect ( firstSnappedEndpointBounds.y + firstSnappedEndpointBounds.height / 2 )
            .toBeCloseTo ( firstStateBounds.y + firstStateBounds.height / 2, 0 );
    }

    await dragLocatorToLocator ( page, sourceEndpoint, secondState );
    await expect ( sourceEndpoint ).toBeFocused ();

    // Initialize the local values needed by this operation.

    const secondSnappedEndpointBounds = await sourceEndpoint.boundingBox ();
    const secondStateBounds           = await secondState.boundingBox ();

    expect ( secondSnappedEndpointBounds ).not.toBeNull ();
    expect ( secondStateBounds ).not.toBeNull ();

    // Handle the case where all required conditions are satisfied.

    if ( secondSnappedEndpointBounds !== null && secondStateBounds !== null )
    {
        expect ( secondSnappedEndpointBounds.x + secondSnappedEndpointBounds.width / 2 )
            .toBeCloseTo ( secondStateBounds.x + secondStateBounds.width / 2, 0 );
        expect ( secondSnappedEndpointBounds.y + secondSnappedEndpointBounds.height / 2 )
            .toBeCloseTo ( secondStateBounds.y + secondStateBounds.height / 2, 0 );
    }

    const secondSnappedEndpointPosition = await chartEndpointPosition ( sourceEndpoint );

    await page.keyboard.press ( "ArrowRight" );
    await page.waitForTimeout ( 250 );
    await expect ( sourceEndpoint ).toBeFocused ();

    const detachedSourceEndpointPosition = await chartEndpointPosition ( sourceEndpoint );

    expect ( detachedSourceEndpointPosition.x - secondSnappedEndpointPosition.x ).toBeGreaterThanOrEqual ( 20 );
    expect ( detachedSourceEndpointPosition.x - secondSnappedEndpointPosition.x ).toBeLessThanOrEqual ( 30 );
    expect ( detachedSourceEndpointPosition.y ).toBeCloseTo ( secondSnappedEndpointPosition.y, 0 );

    await targetEndpoint.focus ();
    const targetPositionBeforeKeyboardMove = await chartEndpointPosition ( targetEndpoint );

    await page.keyboard.press ( "ArrowDown" );
    await page.waitForTimeout ( 250 );
    await expect ( targetEndpoint ).toBeFocused ();
    const targetPositionAfterFirstKeyboardMove = await chartEndpointPosition ( targetEndpoint );
    await page.keyboard.press ( "ArrowDown" );
    await page.waitForTimeout ( 250 );
    await expect ( targetEndpoint ).toBeFocused ();
    const targetPositionAfterSecondKeyboardMove = await chartEndpointPosition ( targetEndpoint );

    expect ( targetPositionAfterFirstKeyboardMove.y - targetPositionBeforeKeyboardMove.y ).toBeCloseTo ( 20, 0 );
    expect ( targetPositionAfterSecondKeyboardMove.y - targetPositionAfterFirstKeyboardMove.y ).toBeCloseTo ( 20, 0 );

    await draftNode.focus ();
    await page.keyboard.press ( "Enter" );

    const transitionDialog = page.getByRole ( "dialog", { name: "Transition" } );

    await expect ( transitionDialog ).toBeVisible ();
    await transitionDialog.getByRole ( "button", { name: "Cancel" } ).click ();
    await expect ( transitionDialog ).toBeHidden ();
    await expect ( draftNode ).toBeFocused ();

    await page.keyboard.press ( "Enter" );
    await transitionDialog.getByRole ( "combobox", { name: "State", exact: true } ).selectOption ( "state_1" );
    await transitionDialog.getByRole ( "combobox", { name: "Event", exact: true } ).selectOption ( "event_go" );
    await transitionDialog.getByRole ( "combobox", { name: "Next State", exact: true } ).selectOption ( "state_2" );
    await transitionDialog.getByRole ( "button", { name: "Confirm" } ).click ();

    await expect ( draftNode ).toHaveCount ( 0 );

    const semanticEdge = page.locator ( ".chart-transition-edge" );

    await expect ( semanticEdge ).toHaveCount ( 1 );
    await expect ( semanticEdge ).toHaveClass ( /react-flow__edge-center/u );
    await expect ( semanticEdge ).toHaveAttribute ( "aria-label", /^state_1, event_go, state_2(?:\.|$)/u );
    await expect ( semanticEdge ).toBeFocused ();

    // Initialize the local values needed by this operation.

    const semanticPath = semanticEdge.locator ( ".react-flow__edge-path" );
    const centerPath   = await semanticPath.getAttribute ( "d" );

    await semanticEdge.focus ();
    await page.keyboard.press ( "Enter" );
    await expect ( transitionDialog ).toBeVisible ();
    await expect ( transitionDialog.getByRole ( "combobox", { name: "Connection routing" } ) ).toHaveCount ( 0 );
    await expect ( transitionDialog.getByRole ( "combobox", { name: "Source side" } ) ).toHaveCount ( 0 );
    await expect ( transitionDialog.getByRole ( "combobox", { name: "Target side" } ) ).toHaveCount ( 0 );
    await transitionDialog.getByRole ( "button", { name: "Cancel" } ).click ();
    await expect ( semanticEdge ).toBeFocused ();

    // Handle the case where browser name matches "webkit".

    if ( browserName === "webkit" )
    {
        // Playwright's Windows WebKit port does not reliably deliver the captured pointer-up
        // sequence for a control that is remounted by the resulting revision. Exercise the same
        // semantic command through its required textual workflow here; the captured-pointer
        // endpoint workflow remains covered by Chromium.

        await semanticEdge.focus ();
        await page.keyboard.press ( "Enter" );
        await transitionDialog.getByRole ( "combobox", { name: "State", exact: true } ).selectOption ( "state_2" );
        await transitionDialog.getByRole ( "combobox", { name: "Next State", exact: true } ).selectOption ( "state_1" );
        await transitionDialog.getByRole ( "button", { name: "Confirm" } ).click ();
        await expect ( page.getByText ( "Transitions: 1", { exact: true } ) ).toBeVisible ();

        // Re-entering Chart verifies that the textual edit persisted and gives the Windows WebKit
        // port a fresh node measurement pass after the revision remount before asserting its
        // derived edge projection.

        await refreshWindowsChartProjection (
            page,
            semanticEdge,
            /^state_2, event_go, state_1(?:\.|$)/u,
        );
    }
    else
    {
        // Handle the remaining case after the preceding condition is false.

        const pathBeforeReconnect = await semanticPath.getAttribute ( "d" );

        await semanticEdge.locator ( ".react-flow__edge-interaction" ).dispatchEvent ( "click" );
        await expect ( page.locator ( ".react-flow__edgeupdater" ) ).toHaveCount ( 0 );
        await connectChartHandles (
            page,
            ".chart-transition-endpoint[data-transition-endpoint='source']",
            "[data-chart-state='state_2']",
        );

        // Handle the case where browser name matches "firefox".

        if ( browserName === "firefox" )
        {
            await refreshWindowsChartProjection (
                page,
                semanticEdge,
                /^state_2, event_go, state_2(?:\.|$)/u,
            );
        }

        await expect ( semanticPath ).not.toHaveAttribute ( "d", pathBeforeReconnect ?? "" );
        await expect ( semanticEdge ).toHaveAttribute ( "aria-label", /^state_2, event_go, state_2(?:\.|$)/u );

        await semanticEdge.locator ( ".react-flow__edge-interaction" ).dispatchEvent ( "click" );
        await connectChartHandles (
            page,
            ".chart-transition-endpoint[data-transition-endpoint='target']",
            "[data-chart-state='state_1']",
        );

        // Handle the case where browser name matches "firefox".

        if ( browserName === "firefox" )
        {
            await refreshWindowsChartProjection (
                page,
                semanticEdge,
                /^state_2, event_go, state_1(?:\.|$)/u,
            );
        }

    }

    await expect ( semanticEdge ).toHaveAttribute ( "aria-label", /^state_2, event_go, state_1(?:\.|$)/u );
    expect ( await semanticPath.getAttribute ( "d" ) ).not.toBe ( centerPath );

    await dragPaletteItemToCanvas ( page, transitionButton, { x: 420, y: 420 }, browserName );
    await expect ( draftNode ).toHaveCount ( 1 );
    await expect ( draftNode ).toBeFocused ();
    await page.keyboard.press ( "Enter" );
    await transitionDialog.getByRole ( "combobox", { name: "State", exact: true } ).selectOption ( "state_2" );
    await transitionDialog.getByRole ( "combobox", { name: "Event", exact: true } ).selectOption ( "event_go" );
    await transitionDialog.getByRole ( "combobox", { name: "Next State", exact: true } ).selectOption ( "state_1" );
    const duplicateTransitionConfirmButton = transitionDialog.getByRole ( "button", { name: "Confirm" } );

    await duplicateTransitionConfirmButton.focus ();

    // Handle the case where browser name matches "webkit".

    if ( browserName === "webkit" )
    {
        await page.keyboard.press ( "Enter" );
    }
    else
    {
        // Handle the remaining case after the preceding condition is false.

        await duplicateTransitionConfirmButton.click ();
    }

    const errorDialog = page.getByRole ( "dialog", { name: "Error" } );

    await expect ( errorDialog ).toBeVisible ();
    await expect ( errorDialog.getByRole ( "button", { name: "Close dialog" } ) ).toBeFocused ();
    await expect ( draftNode ).toHaveCount ( 1 );
    await expect ( page.getByText ( "Transitions: 1", { exact: true } ) ).toBeVisible ();

    await errorDialog.getByRole ( "button", { name: "OK" } ).click ();
    await expect ( errorDialog ).toBeHidden ();
    await expect ( transitionDialog ).toBeVisible ();
    await expect ( transitionDialog.getByRole ( "button", { name: "Confirm" } ) ).toBeFocused ();
    await transitionDialog.getByRole ( "button", { name: "Cancel" } ).click ();
    await expect ( draftNode ).toBeFocused ();

    await page.locator ( "[data-chart-state='state_2']" ).dblclick ();

    const stateDialog = page.getByRole ( "dialog", { name: "Named entity" } );

    await stateDialog.getByRole ( "textbox", { name: "Name" } ).fill ( "state_renamed" );
    await stateDialog.getByRole ( "button", { name: "Confirm" } ).click ();

    // Handle the case where browser name differs from "chromium".

    if ( browserName !== "chromium" )
    {
        await refreshWindowsChartProjection (
            page,
            semanticEdge,
            /^state_renamed, event_go, state_1(?:\.|$)/u,
        );
    }

    await expect ( semanticEdge ).toHaveAttribute ( "aria-label", /^state_renamed, event_go, state_1(?:\.|$)/u );
    await expect ( semanticEdge ).not.toBeFocused ();

    await semanticEdge.locator ( ".react-flow__edge-interaction" ).dispatchEvent ( "click" );
    await expect ( page.getByText ( "Chart Elements Selected: 1", { exact: true } ) ).toBeVisible ();
    await semanticEdge.focus ();
    await page.keyboard.press ( "Delete" );
    await expect ( page.getByRole ( "dialog", { name: "Confirm cascading deletion" } ) ).toHaveCount ( 0 );
    await expect ( semanticEdge ).toHaveCount ( 0 );
    await performUndo ( page, browserName );

    // Handle the case where browser name differs from "chromium".

    if ( browserName !== "chromium" )
    {
        await refreshWindowsChartProjection (
            page,
            semanticEdge,
            /^state_renamed, event_go, state_1(?:\.|$)/u,
        );
    }

    await expect ( semanticEdge ).toHaveAttribute ( "aria-label", /^state_renamed, event_go, state_1(?:\.|$)/u );
} );

test ( "Editor semantic deletion focuses its confirmation action", async ( { browserName, page } ) =>
{
    await createNewDocument ( page );
    await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();

    const statePane = page.locator ( ".states-list-pane" );

    await statePane.getByRole ( "button", { name: "Add" } ).click ();
    await page.getByRole ( "textbox", { name: "Name" } ).fill ( "state_editor_delete" );
    await page.getByRole ( "button", { name: "Confirm" } ).click ();
    await expect ( statePane.getByRole ( "option", { name: "state_editor_delete" } ) ).toBeVisible ();

    const pageDeleteButton = statePane.getByRole ( "button", { name: "Delete", exact: true } );

    await pageDeleteButton.click ();

    // Initialize the local values needed by this operation.

    const impactDialog        = page.getByRole ( "dialog", { name: "Confirm cascading deletion" } );
    const confirmDeleteButton = impactDialog.getByRole ( "button", { name: "Delete" } );

    await expect ( impactDialog ).toBeVisible ();
    await expect ( confirmDeleteButton ).toBeFocused ();
    await expect ( statePane.getByRole ( "option", { name: "state_editor_delete" } ) ).toBeVisible ();
    await page.keyboard.press ( "Enter" );
    await expect ( impactDialog ).toBeHidden ();
    await expect ( statePane.getByRole ( "option", { name: "state_editor_delete" } ) ).toHaveCount ( 0 );

    await performUndo ( page, browserName );
    await expect ( statePane.getByRole ( "option", { name: "state_editor_delete" } ) ).toBeVisible ();
    await pageDeleteButton.click ();
    await impactDialog.getByRole ( "button", { name: "Cancel" } ).click ();
    await expect ( impactDialog ).toBeHidden ();
    await expect ( statePane.getByRole ( "option", { name: "state_editor_delete" } ) ).toBeVisible ();
} );

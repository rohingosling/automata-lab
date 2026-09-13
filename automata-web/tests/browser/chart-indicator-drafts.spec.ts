// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Palette Draft Indicator Connection Browser Tests
// Version: 1.0.0
// Date:    2026-09-08
// Author:  Rohin Gosling
//
// Description:
//
//   Exercises native Palette placement, pointer attachment to indicators, canonical arrow direction,
//   and persisted indicator references through Save/Open and atomic Undo/Redo.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

import type { FileDocumentV1 } from "../../src/domain/model/contracts.js";

interface ScreenPoint
{
    readonly x: number;
    readonly y: number;
}

//--------------------------------------------------------------------------------------------------
// Function: indicatorFixture
//
// Description:
//
//   Places two states and orphan indicators without semantic transitions or placement overlap.
//
//--------------------------------------------------------------------------------------------------

function indicatorFixture (): FileDocumentV1
{
    return {
        file_id: "automata-lab-state-machine", file_version: "1.0.0",
        settings: { name: "Palette Indicator Connections", description: "", version: "1.0.0" },
        state_machine: {
            initial_state: "A",
            states: [ "A", "B" ].map ( name => ( { name, description: "" } ) ),
            events: [ { name: "x", description: "" } ], actions: [],
            state_actions: { entry: [], exit: [] }, transition_table: [],
        },
        chart: {
            settings: { expand_states: false, state_origin_centered: false },
            indicators: {
                initial_state_indicator: { state: null, x: 23, y: 23 },
                terminal_state_indicators: [ { id: 0, x: 850, y: 450 } ],
                terminal_state_transitions: [],
            },
            states: [ { state: "A", x: 0, y: 250, height: 100 },
                { state: "B", x: 600, y: 150, height: 100 } ],
            draft_transitions: [],
        },
        solver: { sequences: [] }, simulator: { sequences: [] },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: readViewport
//
// Description:
//
//   Reads the actual pan and zoom transform so attachment cannot silently refit the Canvas.
//
//--------------------------------------------------------------------------------------------------

async function readViewport ( page: Page ): Promise<string>
{
    return page.locator ( ".react-flow__viewport" ).evaluate ( element => ( element as HTMLElement ).style.transform );
}

//--------------------------------------------------------------------------------------------------
// Function: openDocument
//
// Description:
//
//   Uses the browser file chooser and waits for the requested first-view Chart fit.
//
//--------------------------------------------------------------------------------------------------

async function openDocument ( page: Page, document: FileDocumentV1 ): Promise<void>
{
    const choosing = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "button", { name: "Open", exact: true } ).click ();
    await ( await choosing ).setFiles ( {
        name: "palette-indicator-connections.json", mimeType: "application/json",
        buffer: Buffer.from ( JSON.stringify ( document ) ),
    } );
    await page.getByRole ( "treeitem", { name: "Chart", exact: true } ).click ();
    await expect ( page.locator ( "[data-chart-state='B']" ) ).toBeVisible ();
    await expect.poll ( () => readViewport ( page ) ).not.toBe ( "translate(0px, 0px) scale(1)" );
}

//--------------------------------------------------------------------------------------------------
// Function: saveDocument
//
// Description:
//
//   Reads the canonical JSON produced by the real Save As download.
//
//--------------------------------------------------------------------------------------------------

async function saveDocument ( page: Page ): Promise<FileDocumentV1>
{
    const downloading = page.waitForEvent ( "download" );

    await page.locator ( "[data-toolbar-entry='toolbar-save-as']" ).click ();
    const filePath = await ( await downloading ).path ();

    if ( filePath === null )
    {
        throw new Error ( "The saved indicator fixture has no download path." );
    }

    return JSON.parse ( await readFile ( filePath, "utf8" ) ) as FileDocumentV1;
}

//--------------------------------------------------------------------------------------------------
// Function: elementCenter
//
// Description:
//
//   Resolves a state, indicator, or endpoint grip in the current screen coordinates.
//
//--------------------------------------------------------------------------------------------------

async function elementCenter ( element: Locator ): Promise<ScreenPoint>
{
    const bounds = await element.boundingBox ();

    if ( bounds === null )
    {
        throw new Error ( "The Chart gesture target has no rendered bounds." );
    }

    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

//--------------------------------------------------------------------------------------------------
// Function: indicatorDropPoint
//
// Description:
//
//   Targets the outer painted circle, including the area outside the old smaller routing boundary.
//
//--------------------------------------------------------------------------------------------------

async function indicatorDropPoint ( indicator: Locator ): Promise<ScreenPoint>
{
    const bounds = await indicator.locator ( ".chart-indicator-symbol" ).boundingBox ();

    if ( bounds === null )
    {
        throw new Error ( "The indicator circle has no visible drop bounds." );
    }

    return { x: bounds.x + bounds.width * 0.9, y: bounds.y + bounds.height / 2 };
}

//--------------------------------------------------------------------------------------------------
// Function: dragElement
//
// Description:
//
//   Performs the real pointer-capture gesture with the existing Chart settling move.
//
//--------------------------------------------------------------------------------------------------

async function dragElement ( page: Page, element: Locator, target: ScreenPoint ): Promise<void>
{
    await element.scrollIntoViewIfNeeded ();
    const source = await elementCenter ( element );

    await page.mouse.move ( source.x, source.y );
    await page.mouse.down ();
    await page.mouse.move ( source.x, source.y - 4 );
    await page.waitForTimeout ( 50 );
    await page.mouse.move ( target.x, target.y, { steps: 8 } );
    await page.mouse.up ();
}

//--------------------------------------------------------------------------------------------------
// Function: draftGrip
//
// Description:
//
//   Selects the stable accessible endpoint name of the sole Palette-created draft.
//
//--------------------------------------------------------------------------------------------------

function draftGrip ( page: Page, endpoint: "source" | "target" ): Locator
{
    return page.getByRole ( "button", { name: "Move draft transition " + endpoint + " endpoint 0", exact: true } );
}

//--------------------------------------------------------------------------------------------------
// Function: expectIndicatorGripBoundary
//
// Description:
//
//   Compares the attached grip with the painted circle instead of assuming a routing radius.
//
//--------------------------------------------------------------------------------------------------

async function expectIndicatorGripBoundary (
    page: Page, indicatorKind: "initial" | "terminal", endpoint: "source" | "target",
): Promise<void>
{
    await expect.poll ( async () => page.locator ( ".chart-" + indicatorKind + "-indicator" ).evaluate (
        ( indicator, endpoint ) =>
        {
            const circle = indicator.querySelector ( ".chart-indicator-symbol" )!.getBoundingClientRect ();
            const grip = document.querySelector ( "[data-draft-endpoint='" + endpoint + "']" )!.getBoundingClientRect ();
            const horizontalDistance = grip.x + grip.width / 2 - circle.x - circle.width / 2;
            const verticalDistance = grip.y + grip.height / 2 - circle.y - circle.height / 2;

            return Math.abs ( Math.hypot ( horizontalDistance, verticalDistance ) - circle.width / 2 );
        }, endpoint,
    ) ).toBeLessThan ( 1 );
    const curve = page.locator ( ".chart-draft-transition-path" );

    await expect ( curve ).toHaveAttribute ( "marker-end", /url\(#/u );
    await expect.poll ( async () =>
    {
        const curvePoint = await curve.evaluate ( ( element, endpoint ) =>
        {
            const path = element as SVGPathElement;
            const transform = path.getScreenCTM ();

            if ( transform === null )
            {
                throw new Error ( "The draft arrow has no screen transform." );
            }

            const point = path.getPointAtLength ( endpoint === "source" ? 0 : path.getTotalLength () )
                .matrixTransform ( transform );

            return { x: point.x, y: point.y };
        }, endpoint );
        const gripPoint = await elementCenter ( draftGrip ( page, endpoint ) );

        return Math.hypot ( curvePoint.x - gripPoint.x, curvePoint.y - gripPoint.y );
    } ).toBeLessThan ( 1 );
}

//--------------------------------------------------------------------------------------------------
// Function: placeDraft
//
// Description:
//
//   Drags a decoded Palette glyph to free Canvas space with the native desktop drag API.
//
//--------------------------------------------------------------------------------------------------

async function placeDraft ( page: Page ): Promise<void>
{
    await page.waitForFunction ( () =>
        ( window as typeof window & { preparedPaletteImages: number } ).preparedPaletteImages >= 4 );
    const canvas = page.locator ( ".chart-canvas" );
    const bounds = await canvas.boundingBox ();

    if ( bounds === null )
    {
        throw new Error ( "The Chart Canvas has no native drop bounds." );
    }

    await page.getByRole ( "complementary", { name: "Palette" } )
        .getByRole ( "button", { name: "Transition", exact: true } )
        .dragTo ( canvas, { targetPosition: { x: bounds.width / 2, y: bounds.height - 100 } } );
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 1 );
    await expect ( draftGrip ( page, "source" ) ).toBeVisible ();
    await expect ( draftGrip ( page, "target" ) ).toBeVisible ();
}

test.beforeEach ( async ( { browserName, page } ) =>
{
    test.skip ( browserName === "webkit", "Native Palette dragging is covered in Windows Chromium and Firefox." );
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showSaveFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showDirectoryPicker", { configurable: true, value: undefined } );
        const testWindow = window as typeof window & { preparedPaletteImages: number };
        const decode = HTMLImageElement.prototype.decode;

        testWindow.preparedPaletteImages = 0;
        HTMLImageElement.prototype.decode = async function ()
        {
            await decode.call ( this );

            if ( this.src.startsWith ( "data:image/png" ) )
            {
                testWindow.preparedPaletteImages += 1;
            }
        };
    } );
    await page.goto ( "./" );
} );

for ( const indicatorKind of [ "initial", "terminal" ] as const )
{
    for ( const firstAttachment of [ "indicator", "state" ] as const )
    {
        test ( "Palette draft immediately reverses a wrong-end " + indicatorKind + " connection with " + firstAttachment + " first",
            async ( { page } ) =>
        {
            const fixture = indicatorFixture ();

            await openDocument ( page, fixture );
            const initialViewport = await readViewport ( page );
            await placeDraft ( page );
            await expect.poll ( () => readViewport ( page ) ).toBe ( initialViewport );
            const placed = await saveDocument ( page );

            const indicator = page.locator ( ".chart-" + indicatorKind + "-indicator" );
            const state = page.locator ( "[data-chart-state='B']" );
            const indicatorEndpoint = indicatorKind === "initial" ? "target" : "source";
            const stateEndpoint = indicatorKind === "initial" ? "source" : "target";
            const normalizedIndicatorEndpoint = stateEndpoint;
            const freePointBeforeAttachment = await elementCenter ( draftGrip ( page, stateEndpoint ) );
            const firstEndpoint = firstAttachment === "indicator" ? indicatorEndpoint : stateEndpoint;
            const firstPoint = firstAttachment === "indicator"
                ? await indicatorDropPoint ( indicator ) : await elementCenter ( state );

            await dragElement ( page, draftGrip ( page, firstEndpoint ), firstPoint );
            await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 1 );
            await expect ( page.getByRole ( "dialog", { name: "Transition", exact: true } ) ).toHaveCount ( 0 );
            await expect.poll ( () => readViewport ( page ) ).toBe ( initialViewport );
            const halfAttached = await saveDocument ( page );

            expect ( halfAttached.state_machine ).toEqual ( fixture.state_machine );
            expect ( halfAttached.chart.indicators ).toEqual ( fixture.chart.indicators );
            expect ( halfAttached.chart.draft_transitions?.[ 0 ] ).toMatchObject ( firstAttachment === "indicator"
                ? { [ normalizedIndicatorEndpoint + "_indicator" ]: indicatorKind === "initial" ? { kind: "initial" }
                    : { kind: "terminal", id: 0 } }
                : { [ stateEndpoint + "_state" ]: "B" } );
            expect ( halfAttached.chart.draft_transitions?.[ 0 ] ).not.toHaveProperty (
                firstAttachment === "indicator" ? indicatorEndpoint + "_indicator" : indicatorEndpoint + "_state",
            );

            if ( firstAttachment === "indicator" )
            {
                expect ( halfAttached.chart.draft_transitions?.[ 0 ]?.[ indicatorEndpoint ] )
                    .toEqual ( placed.chart.draft_transitions?.[ 0 ]?.[ stateEndpoint ] );
                await expect.poll ( async () => elementCenter ( draftGrip ( page, indicatorEndpoint ) ) )
                    .toEqual ( freePointBeforeAttachment );
                await expectIndicatorGripBoundary ( page, indicatorKind, normalizedIndicatorEndpoint );
                await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
                expect ( ( await saveDocument ( page ) ).chart ).toEqual ( placed.chart );
                await page.locator ( "[data-toolbar-entry='toolbar-redo']" ).click ();
                expect ( ( await saveDocument ( page ) ).chart ).toEqual ( halfAttached.chart );
                await expectIndicatorGripBoundary ( page, indicatorKind, normalizedIndicatorEndpoint );
            }

            if ( indicatorKind === "initial" && firstAttachment === "indicator" )
            {
                const initialCenter = await elementCenter ( indicator );
                const initialGrip = await elementCenter ( draftGrip ( page, "source" ) );
                await expect.poll ( async () => indicator.evaluate ( element =>
                {
                    const bounds = element.getBoundingClientRect ();
                    const centerX = bounds.x + bounds.width / 2;
                    const centerY = bounds.y + bounds.height / 2;

                    return element.contains ( document.elementFromPoint ( centerX, centerY ) );
                } ) ).toBe ( true );

                await dragElement ( page, indicator, { x: initialCenter.x + 100, y: initialCenter.y + 70 } );
                await expect.poll ( async () =>
                {
                    const center = await elementCenter ( indicator );

                    return Math.hypot ( center.x - initialCenter.x, center.y - initialCenter.y );
                } ).toBeGreaterThan ( 50 );
                await expect.poll ( async () =>
                {
                    const center = await elementCenter ( draftGrip ( page, "source" ) );

                    return Math.hypot ( center.x - initialGrip.x, center.y - initialGrip.y );
                } ).toBeGreaterThan ( 25 );
                await expect.poll ( () => readViewport ( page ) ).toBe ( initialViewport );
                const moved = await saveDocument ( page );

                expect ( moved.file_version ).toBe ( "1.3.0" );
                expect ( moved.chart.draft_transitions?.[ 0 ] ).toMatchObject ( { source_indicator: { kind: "initial" } } );
                expect ( moved.state_machine ).toEqual ( fixture.state_machine );
                await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
                await expect.poll ( async () => elementCenter ( indicator ) ).toEqual ( initialCenter );
                await page.locator ( "[data-toolbar-entry='toolbar-redo']" ).click ();
                await expect.poll ( async () => elementCenter ( indicator ) ).not.toEqual ( initialCenter );
                await page.reload ();
                await openDocument ( page, moved );
                expect ( ( await saveDocument ( page ) ).chart ).toEqual ( moved.chart );
            }
            else if ( firstAttachment === "indicator" )
            {
                await page.reload ();
                await openDocument ( page, halfAttached );
                expect ( ( await saveDocument ( page ) ).chart ).toEqual ( halfAttached.chart );
                await expectIndicatorGripBoundary ( page, indicatorKind, normalizedIndicatorEndpoint );
            }

            const viewportBeforeCompletion = await readViewport ( page );
            const remainingEndpoint = indicatorEndpoint;
            const remainingPoint = firstAttachment === "indicator"
                ? await elementCenter ( state ) : await indicatorDropPoint ( indicator );

            await dragElement ( page, draftGrip ( page, remainingEndpoint ), remainingPoint );
            await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
            await expect ( page.locator ( ".chart-" + indicatorKind + "-edge" ) ).toHaveCount ( 1 );
            await expect ( page.getByRole ( "dialog", { name: "Transition", exact: true } ) ).toHaveCount ( 0 );
            await expect.poll ( () => readViewport ( page ) ).toBe ( viewportBeforeCompletion );
            const completed = await saveDocument ( page );

            expect ( completed.file_version ).toBe ( "1.0.0" );
            expect ( completed.chart.draft_transitions ).toEqual ( [] );
            expect ( completed.state_machine ).toEqual ( { ...fixture.state_machine,
                initial_state: indicatorKind === "initial" ? "B" : "A" } );

            if ( indicatorKind === "initial" )
            {
                expect ( completed.chart.indicators.initial_state_indicator?.state ).toBe ( "B" );
            }
            else
            {
                expect ( completed.chart.indicators.terminal_state_transitions )
                    .toEqual ( [ { state: "B", terminal_state_indicator_id: 0 } ] );
            }

            await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
            await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 1 );
            await expect ( page.locator ( ".chart-" + indicatorKind + "-edge" ) ).toHaveCount ( 0 );
            await expect ( page.getByRole ( "dialog", { name: "Transition", exact: true } ) ).toHaveCount ( 0 );
            await page.locator ( "[data-toolbar-entry='toolbar-redo']" ).click ();
            await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
            expect ( ( await saveDocument ( page ) ).chart ).toEqual ( completed.chart );
            await expect.poll ( () => readViewport ( page ) ).toBe ( viewportBeforeCompletion );
        } );
    }
}

test ( "A reversed Palette draft creates a persistent visual-only initial-to-terminal connection", async ( { page } ) =>
{
    const fixture = indicatorFixture ();

    await openDocument ( page, fixture );
    const viewportBeforePlacement = await readViewport ( page );
    await placeDraft ( page );
    await dragElement ( page, draftGrip ( page, "target" ),
        await indicatorDropPoint ( page.locator ( ".chart-initial-indicator" ) ) );
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 1 );
    await expectIndicatorGripBoundary ( page, "initial", "source" );
    await dragElement ( page, draftGrip ( page, "target" ),
        await indicatorDropPoint ( page.locator ( ".chart-terminal-indicator" ) ) );
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-indicator-connection-edge" ) ).toHaveCount ( 1 );
    await expect ( page.getByRole ( "dialog", { name: "Transition", exact: true } ) ).toHaveCount ( 0 );
    await expect.poll ( () => readViewport ( page ) ).toBe ( viewportBeforePlacement );
    const completed = await saveDocument ( page );

    expect ( completed.file_version ).toBe ( "1.3.0" );
    expect ( completed.state_machine ).toEqual ( fixture.state_machine );
    expect ( completed.chart.draft_transitions ).toEqual ( [] );
    expect ( completed.chart.indicators ).toEqual ( { ...fixture.chart.indicators,
        indicator_transitions: [ { id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 0 } } ] } );
    await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".chart-indicator-connection-edge" ) ).toHaveCount ( 0 );
    await page.locator ( "[data-toolbar-entry='toolbar-redo']" ).click ();
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-indicator-connection-edge" ) ).toHaveCount ( 1 );
    await page.reload ();
    await openDocument ( page, completed );
    await expect ( page.locator ( ".chart-indicator-connection-edge" ) ).toHaveCount ( 1 );
    expect ( ( await saveDocument ( page ) ).chart ).toEqual ( completed.chart );

    const relation = page.locator ( ".chart-indicator-connection-edge" );

    await relation.focus ();
    await page.keyboard.press ( "Enter" );
    await page.keyboard.press ( "Delete" );
    await expect ( relation ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-indicator-node" ) ).toHaveCount ( 2 );
    expect ( ( await saveDocument ( page ) ).state_machine ).toEqual ( fixture.state_machine );
    await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
    await expect ( relation ).toHaveCount ( 1 );
    expect ( ( await saveDocument ( page ) ).chart ).toEqual ( completed.chart );
} );

for ( const indicatorKind of [ "initial", "terminal" ] as const )
{
    test ( "Completing a Palette draft to an existing " + indicatorKind + " connection consumes it without duplication",
        async ( { page } ) =>
    {
        const baseFixture = indicatorFixture ();
        const fixture: FileDocumentV1 = { ...baseFixture, chart: { ...baseFixture.chart, indicators: {
            ...baseFixture.chart.indicators,
            initial_state_indicator: { state: indicatorKind === "initial" ? "A" : null, x: 23, y: 23 },
            terminal_state_transitions: indicatorKind === "terminal"
                ? [ { state: "B", terminal_state_indicator_id: 0 } ] : [],
        } } };

        await openDocument ( page, fixture );
        const viewportBeforePlacement = await readViewport ( page );
        const existingRelation = page.locator ( ".chart-" + indicatorKind + "-edge" );
        const indicatorEndpoint = indicatorKind === "initial" ? "target" : "source";
        const normalizedIndicatorEndpoint = indicatorKind === "initial" ? "source" : "target";
        const stateName = indicatorKind === "initial" ? "A" : "B";

        await expect ( existingRelation ).toHaveCount ( 1 );
        await placeDraft ( page );
        await dragElement ( page, draftGrip ( page, indicatorEndpoint ),
            await indicatorDropPoint ( page.locator ( ".chart-" + indicatorKind + "-indicator" ) ) );
        await expectIndicatorGripBoundary ( page, indicatorKind, normalizedIndicatorEndpoint );
        const halfAttached = await saveDocument ( page );

        await dragElement ( page, draftGrip ( page, indicatorEndpoint ),
            await elementCenter ( page.locator ( "[data-chart-state='" + stateName + "']" ) ) );
        await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
        await expect ( existingRelation ).toHaveCount ( 1 );
        await expect ( page.getByRole ( "dialog", { name: "Error", exact: true } ) ).toHaveCount ( 0 );
        await expect ( page.getByRole ( "dialog", { name: "Transition", exact: true } ) ).toHaveCount ( 0 );
        const completed = await saveDocument ( page );

        expect ( completed.state_machine ).toEqual ( fixture.state_machine );
        expect ( completed.chart ).toEqual ( fixture.chart );
        await expect.poll ( () => readViewport ( page ) ).toBe ( viewportBeforePlacement );
        await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
        await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 1 );
        await expect ( existingRelation ).toHaveCount ( 1 );
        expect ( ( await saveDocument ( page ) ).chart ).toEqual ( halfAttached.chart );
        await page.locator ( "[data-toolbar-entry='toolbar-redo']" ).click ();
        await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
        await expect ( existingRelation ).toHaveCount ( 1 );
        await expect ( page.getByRole ( "dialog", { name: "Error", exact: true } ) ).toHaveCount ( 0 );
        expect ( ( await saveDocument ( page ) ).chart ).toEqual ( completed.chart );
    } );
}

for ( const indicatorAttached of [ false, true ] )
{
    for ( const stateName of [ "A", "B" ] )
    {
        test ( "Uninterrupted target-to-initial then free-end-to-state: attached=" + indicatorAttached + ", state=" + stateName,
            async ( { page } ) =>
        {
            const baseFixture = indicatorFixture ();
            const fixture: FileDocumentV1 = { ...baseFixture, chart: { ...baseFixture.chart, indicators: {
                ...baseFixture.chart.indicators,
                initial_state_indicator: { state: indicatorAttached ? "A" : null, x: 23, y: 23 },
            } } };

            await openDocument ( page, fixture );
            await placeDraft ( page );
            const originalFreePoint = await elementCenter ( draftGrip ( page, "source" ) );
            const originalArrowPoint = await elementCenter ( draftGrip ( page, "target" ) );
            const indicatorPoint = await elementCenter ( page.locator ( ".chart-initial-indicator" ) );
            const statePoint = await elementCenter ( page.locator ( "[data-chart-state='" + stateName + "']" ) );

            // Keep the two gestures uninterrupted: no Save, reload, history edit,
            // or intervening focus change.

            await page.mouse.move ( originalArrowPoint.x, originalArrowPoint.y );
            await page.mouse.down ();
            await page.mouse.move ( indicatorPoint.x, indicatorPoint.y, { steps: 8 } );
            await page.mouse.up ();
            await page.mouse.move ( originalFreePoint.x, originalFreePoint.y );
            await page.mouse.down ();
            await page.mouse.move ( statePoint.x, statePoint.y, { steps: 8 } );
            await page.mouse.up ();

            await expect ( page.getByRole ( "dialog", { name: "Error", exact: true } ) ).toHaveCount ( 0 );
            await expect ( page.getByRole ( "dialog", { name: "Transition", exact: true } ) ).toHaveCount ( 0 );
            await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
            await expect ( page.locator ( ".chart-initial-edge" ) ).toHaveCount ( 1 );
            const completed = await saveDocument ( page );

            expect ( completed.state_machine ).toEqual ( { ...fixture.state_machine, initial_state: stateName } );
            expect ( completed.chart.indicators.initial_state_indicator?.state ).toBe ( stateName );
            expect ( completed.chart.draft_transitions ).toEqual ( [] );
        } );
    }
}

test ( "Uninterrupted New and Palette placement connects an orphan initial indicator without an error", async ( { page } ) =>
{
    await page.getByRole ( "button", { name: "New", exact: true } ).click ();
    await page.getByRole ( "treeitem", { name: "Chart", exact: true } ).click ();
    await page.waitForFunction ( () =>
        ( window as typeof window & { preparedPaletteImages: number } ).preparedPaletteImages >= 4 );
    const palette = page.getByRole ( "complementary", { name: "Palette" } );
    const canvas = page.locator ( ".chart-canvas" );

    await palette.getByRole ( "button", { name: "State", exact: true } )
        .dragTo ( canvas, { targetPosition: { x: 250, y: 250 } } );
    await expect ( page.locator ( "[data-chart-state='state_1']" ) ).toBeVisible ();
    await palette.getByRole ( "button", { name: "State", exact: true } )
        .dragTo ( canvas, { targetPosition: { x: 650, y: 250 } } );
    await expect ( page.locator ( "[data-chart-state='state_2']" ) ).toBeVisible ();
    await palette.getByRole ( "button", { name: "Initial Indicator", exact: true } )
        .dragTo ( canvas, { targetPosition: { x: 100, y: 80 } } );
    await expect ( page.locator ( ".chart-initial-indicator" ) ).toBeVisible ();
    await expect ( page.locator ( ".chart-initial-edge" ) ).toHaveCount ( 0 );
    await placeDraft ( page );
    const originalFreePoint = await elementCenter ( draftGrip ( page, "source" ) );
    const originalArrowPoint = await elementCenter ( draftGrip ( page, "target" ) );
    const indicatorPoint = await elementCenter ( page.locator ( ".chart-initial-indicator" ) );
    const statePoint = await elementCenter ( page.locator ( "[data-chart-state='state_1']" ) );

    await page.mouse.move ( originalArrowPoint.x, originalArrowPoint.y );
    await page.mouse.down ();
    await page.mouse.move ( indicatorPoint.x, indicatorPoint.y, { steps: 8 } );
    await page.mouse.up ();
    await page.mouse.move ( originalFreePoint.x, originalFreePoint.y );
    await page.mouse.down ();
    await page.mouse.move ( statePoint.x, statePoint.y, { steps: 8 } );
    await page.mouse.up ();

    await expect ( page.getByRole ( "dialog", { name: "Error", exact: true } ) ).toHaveCount ( 0 );
    await expect ( page.getByRole ( "dialog", { name: "Transition", exact: true } ) ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-initial-edge" ) ).toHaveCount ( 1 );
    const completed = await saveDocument ( page );

    expect ( completed.state_machine.initial_state ).toBe ( "state_1" );
    expect ( completed.state_machine.transition_table ).toEqual ( [] );
    expect ( completed.chart.indicators.initial_state_indicator?.state ).toBe ( "state_1" );
    expect ( completed.chart.draft_transitions ).toEqual ( [] );
} );

test ( "Deleting the initial edge permits uninterrupted Palette reconnection to the same state", async ( { page } ) =>
{
    const baseFixture = indicatorFixture ();
    const fixture: FileDocumentV1 = { ...baseFixture, chart: { ...baseFixture.chart, indicators: {
        ...baseFixture.chart.indicators,
        initial_state_indicator: { state: "A", x: 23, y: 23 },
    } } };

    await openDocument ( page, fixture );
    const initialRelation = page.locator ( ".chart-initial-edge" );

    await initialRelation.focus ();
    await page.keyboard.press ( "Enter" );
    await page.keyboard.press ( "Delete" );
    await expect ( initialRelation ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-initial-indicator" ) ).toHaveCount ( 1 );
    await placeDraft ( page );
    const originalFreePoint = await elementCenter ( draftGrip ( page, "source" ) );
    const originalArrowPoint = await elementCenter ( draftGrip ( page, "target" ) );
    const indicatorPoint = await elementCenter ( page.locator ( ".chart-initial-indicator" ) );
    const statePoint = await elementCenter ( page.locator ( "[data-chart-state='A']" ) );

    await page.mouse.move ( originalArrowPoint.x, originalArrowPoint.y );
    await page.mouse.down ();
    await page.mouse.move ( indicatorPoint.x, indicatorPoint.y, { steps: 8 } );
    await page.mouse.up ();
    await page.mouse.move ( originalFreePoint.x, originalFreePoint.y );
    await page.mouse.down ();
    await page.mouse.move ( statePoint.x, statePoint.y, { steps: 8 } );
    await page.mouse.up ();

    await expect ( page.getByRole ( "dialog", { name: "Error", exact: true } ) ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
    await expect ( initialRelation ).toHaveCount ( 1 );
    const completed = await saveDocument ( page );

    expect ( completed.state_machine.initial_state ).toBe ( "A" );
    expect ( completed.chart.indicators.initial_state_indicator?.state ).toBe ( "A" );
    expect ( completed.chart.draft_transitions ).toEqual ( [] );
    await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
    await expect ( initialRelation ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 1 );
    await page.locator ( "[data-toolbar-entry='toolbar-redo']" ).click ();
    await expect ( initialRelation ).toHaveCount ( 1 );
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
    expect ( ( await saveDocument ( page ) ).chart ).toEqual ( completed.chart );
} );

test ( "Deleting the initial edge preserves Save access and an incomplete orphan through history", async ( { page } ) =>
{
    const baseFixture = indicatorFixture ();
    const fixture: FileDocumentV1 = { ...baseFixture, chart: { ...baseFixture.chart, indicators: {
        ...baseFixture.chart.indicators,
        initial_state_indicator: { state: "A", x: 23, y: 23 },
    } } };

    await openDocument ( page, fixture );
    const initialRelation = page.locator ( ".chart-initial-edge" );
    const saveButton = page.locator ( "[data-toolbar-entry='toolbar-save']" );
    const saveAsButton = page.locator ( "[data-toolbar-entry='toolbar-save-as']" );

    await initialRelation.focus ();
    await page.keyboard.press ( "Enter" );
    await page.keyboard.press ( "Delete" );
    await expect ( initialRelation ).toHaveCount ( 0 );
    await expect ( saveButton ).toBeEnabled ();
    await expect ( saveAsButton ).toBeEnabled ();
    const downloading = page.waitForEvent ( "download" );

    await saveAsButton.click ();
    const confirmation = page.getByRole ( "dialog", { name: "Save incomplete project?", exact: true } );

    await expect ( confirmation ).toBeVisible ();
    await confirmation.getByRole ( "button", { name: "Save Anyway", exact: true } ).click ();
    const filePath = await ( await downloading ).path ();

    if ( filePath === null )
    {
        throw new Error ( "The saved incomplete Chart has no download path." );
    }

    const incomplete = JSON.parse ( await readFile ( filePath, "utf8" ) ) as FileDocumentV1;

    expect ( incomplete.state_machine.initial_state ).toBeNull ();
    expect ( incomplete.chart.indicators.initial_state_indicator ).toEqual ( { state: null, x: 23, y: 23 } );
    expect ( incomplete.state_machine.transition_table ).toEqual ( [] );
    await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
    await expect ( initialRelation ).toHaveCount ( 1 );
    expect ( ( await saveDocument ( page ) ).chart ).toEqual ( fixture.chart );
    await page.locator ( "[data-toolbar-entry='toolbar-redo']" ).click ();
    await expect ( initialRelation ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-initial-indicator" ) ).toHaveCount ( 1 );
    await expect ( saveButton ).toBeEnabled ();
    await expect ( saveAsButton ).toBeEnabled ();
    await expect ( page.getByRole ( "dialog", { name: "Error", exact: true } ) ).toHaveCount ( 0 );
} );

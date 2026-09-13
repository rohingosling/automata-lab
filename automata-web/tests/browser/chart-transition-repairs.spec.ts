// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Transition Repair Browser Tests
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Exercises native glyph bitmaps, curve-only selection, one-sided clipping, and remembered events
//   through real pointer gestures and Save/Open. Native desktop-compositor visibility is not
//   inferred
//   from successful DOM drops or captured bitmap pixels.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

import type { FileDocumentV1 } from "../../src/domain/model/contracts.js";

interface DragImageEvidence
{
    readonly complete:          boolean;
    readonly height:            number;
    readonly horizontalOffset:  number;
    readonly item:              string;
    readonly opaquePixels:      number;
    readonly source:            string;
    readonly transparentPixels: number;
    readonly verticalOffset:    number;
    readonly width:             number;
}

//--------------------------------------------------------------------------------------------------
// Function: fixtureDocument
//
// Description:
//
//   Supplies a valid, bounded model with fixed state positions and no indicator placement
//   conflicts.
//
//--------------------------------------------------------------------------------------------------

function fixtureDocument ( semanticTransition: boolean, freeDraft: boolean = false ): FileDocumentV1
{
    return {
        file_id: "automata-lab-state-machine", file_version: "1.0.0",
        settings: { name: "Transition Repair Fixture", description: "", version: "1.0.0" },
        state_machine: {
            initial_state: "A",
            states: [ "A", "B", "C" ].map ( name => ( { name, description: "" } ) ),
            events: [ { name: "x", description: "" } ], actions: [],
            state_actions: { entry: [], exit: [] },
            transition_table: semanticTransition ? [ { state: "A", event: "x", state_next: "B" } ] : [],
        },
        chart: {
            settings: { expand_states: false, state_origin_centered: false },
            indicators: { initial_state_indicator: null, terminal_state_indicators: [], terminal_state_transitions: [] },
            states: [ { state: "A", x: 0, y: 0, height: 100 }, { state: "B", x: 600, y: 0, height: 100 },
                { state: "C", x: 600, y: 350, height: 100 } ],
            draft_transitions: freeDraft ? [ { id: 0, source: { x: 100, y: 400 }, target: { x: 400, y: 400 } } ] : [],
        },
        solver: { sequences: [] }, simulator: { sequences: [] },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: openDocument
//
// Description:
//
//   Opens a supplied JSON document through the same browser file picker used by ordinary users.
//
//--------------------------------------------------------------------------------------------------

async function openDocument ( page: Page, document: FileDocumentV1 ): Promise<void>
{
    const chooser = page.waitForEvent ( "filechooser" );

    await page.getByRole ( "button", { name: "Open", exact: true } ).click ();
    await ( await chooser ).setFiles ( {
        name: "transition-repairs.json", mimeType: "application/json", buffer: Buffer.from ( JSON.stringify ( document ) ),
    } );
    await page.getByRole ( "treeitem", { name: "Chart", exact: true } ).click ();
    await expect ( page.locator ( "[data-chart-state='A']" ) ).toBeVisible ();
}

//--------------------------------------------------------------------------------------------------
// Function: saveDocument
//
// Description:
//
//   Reads the actual JSON download produced by Save As without injecting application state.
//
//--------------------------------------------------------------------------------------------------

async function saveDocument ( page: Page ): Promise<FileDocumentV1>
{
    const downloading = page.waitForEvent ( "download" );

    await page.locator ( "[data-toolbar-entry='toolbar-save-as']" ).click ();
    const filePath = await ( await downloading ).path ();

    if ( filePath === null )
    {
        throw new Error ( "The saved transition fixture has no download path." );
    }

    return JSON.parse ( await readFile ( filePath, "utf8" ) ) as FileDocumentV1;
}

//--------------------------------------------------------------------------------------------------
// Function: dragGrip
//
// Description:
//
//   Uses real pointer capture and movement, including the existing Chart settling move.
//
//--------------------------------------------------------------------------------------------------

async function dragGrip ( page: Page, grip: Locator, target: { readonly x: number; readonly y: number } ): Promise<void>
{
    await grip.scrollIntoViewIfNeeded ();
    const bounds = await grip.boundingBox ();

    if ( bounds === null )
    {
        throw new Error ( "The transition endpoint grip has no rendered bounds." );
    }

    await page.mouse.move ( bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 );
    await page.mouse.down ();
    await page.mouse.move ( bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 - 4 );
    await page.waitForTimeout ( 50 );
    await page.mouse.move ( target.x, target.y, { steps: 8 } );
    await page.mouse.up ();
}

//--------------------------------------------------------------------------------------------------
// Function: stateCenter
//
// Description:
//
//   Converts a rendered state body to the current screen coordinates for a pointer drop.
//
//--------------------------------------------------------------------------------------------------

async function stateCenter ( state: Locator ): Promise<{ readonly x: number; readonly y: number }>
{
    const bounds = await state.boundingBox ();

    if ( bounds === null )
    {
        throw new Error ( "The transition target state has no rendered bounds." );
    }

    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

//--------------------------------------------------------------------------------------------------
// Function: selectCurve
//
// Description:
//
//   Clicks the actual visible curve through its SVG transform and the independent pointer hit path.
//
//--------------------------------------------------------------------------------------------------

async function selectCurve ( page: Page, path: Locator ): Promise<void>
{
    const point = await path.evaluate ( element =>
    {
        const curve = element as SVGPathElement;
        const matrix = curve.getScreenCTM ();

        if ( matrix === null )
        {
            throw new Error ( "The transition curve has no screen transform." );
        }

        const point = curve.getPointAtLength ( curve.getTotalLength () / 2 ).matrixTransform ( matrix );

        return { x: point.x, y: point.y };
    } );

    await page.mouse.click ( point.x, point.y );
}

test.beforeEach ( async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showSaveFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showDirectoryPicker", { configurable: true, value: undefined } );
    } );
    await page.goto ( "./" );
} );

for ( const theme of [ "Light", "Dark" ] as const )
{
    test ( `Palette supplies decoded, nonempty icon-only drag bitmaps in ${theme} theme`, async ( { browserName, page } ) =>
    {
        test.skip ( browserName === "webkit", "Native palette dragging is covered in Windows Chromium and Firefox." );
        await page.addInitScript ( () =>
        {
            const testWindow = window as typeof window & {
                chartDragImages: DragImageEvidence[]; chartPreparedImages: number;
            };
            const setDragImage = DataTransfer.prototype.setDragImage;
            const decode = HTMLImageElement.prototype.decode;

            testWindow.chartDragImages = [];
            testWindow.chartPreparedImages = 0;
            HTMLImageElement.prototype.decode = async function ()
            {
                await decode.call ( this );

                if ( this.src.startsWith ( "data:image/png" ) )
                {
                    testWindow.chartPreparedImages += 1;
                }
            };
            DataTransfer.prototype.setDragImage = function ( element, horizontalOffset, verticalOffset )
            {
                const image = element as HTMLImageElement;
                const canvas = document.createElement ( "canvas" );

                canvas.width = image.naturalWidth || 1;
                canvas.height = image.naturalHeight || 1;
                const context = canvas.getContext ( "2d" );
                let opaquePixels = 0;
                let transparentPixels = 0;

                if ( context !== null && image.complete && image.naturalWidth > 0 )
                {
                    context.drawImage ( image, 0, 0 );
                    const pixels = context.getImageData ( 0, 0, canvas.width, canvas.height ).data;

                    for ( let index = 3; index < pixels.length; index += 4 )
                    {
                        if ( pixels [ index ] === 0 )
                        {
                            transparentPixels += 1;
                        }
                        else
                        {
                            opaquePixels += 1;
                        }
                    }
                }

                testWindow.chartDragImages.push ( {
                    complete: image.complete, height: image.naturalHeight, horizontalOffset,
                    item: this.getData ( "application/x-automata-chart-item" ), opaquePixels,
                    source: image.src, transparentPixels, verticalOffset, width: image.naturalWidth,
                } );
                setDragImage.call ( this, element, horizontalOffset, verticalOffset );
            };
        } );
        await page.reload ();
        await page.locator ( "[data-toolbar-entry='toolbar-theme']" ).click ();
        await page.getByRole ( "menuitemradio", { name: theme, exact: true } ).click ();
        await openDocument ( page, fixtureDocument ( false ) );
        await page.waitForFunction ( () =>
            ( window as typeof window & { chartPreparedImages: number } ).chartPreparedImages >= 4 );

        const palette = page.getByRole ( "complementary", { name: "Palette" } );
        const canvas = page.locator ( ".chart-canvas" );

        for ( const [ index, label ] of [ "State", "Initial Indicator", "Terminal Indicator", "Transition" ].entries () )
        {
            await palette.getByRole ( "button", { name: label, exact: true } )
                .dragTo ( canvas, { targetPosition: { x: 140 + index * 130, y: 300 } } );
        }

        const evidence = await page.evaluate ( () =>
            ( window as typeof window & { chartDragImages: DragImageEvidence[] } ).chartDragImages );

        expect ( evidence.map ( item => item.item ) ).toEqual ( [ "state", "initial", "terminal", "transition" ] );

        for ( const item of evidence )
        {
            expect ( item.source ).toMatch ( /^data:image\/png;base64,/u );
            expect ( item.complete ).toBe ( true );
            expect ( item.opaquePixels ).toBeGreaterThan ( 0 );
            expect ( item.transparentPixels ).toBeGreaterThan ( 0 );
            expect ( item.horizontalOffset ).toBe ( item.width / 2 );
            expect ( item.verticalOffset ).toBe ( item.height / 2 );
        }
    } );
}

test ( "Selected drafts emphasize only their curve and a half-attached endpoint grip follows the state boundary", async ( { page } ) =>
{
    await openDocument ( page, fixtureDocument ( false, true ) );
    const path = page.locator ( ".chart-draft-transition-path" );
    const draft = page.locator ( ".chart-draft-transition-node" );
    const wrapper = page.locator ( ".react-flow__node-draftTransition" );

    await selectCurve ( page, path );
    await expect ( draft ).toHaveClass ( /chart-transition-selected/u );
    await expect ( path ).toHaveCSS ( "stroke-width", "6px" );
    await expect ( draft ).toHaveCSS ( "border-top-width", "0px" );
    await expect ( draft ).toHaveCSS ( "box-shadow", "none" );
    await wrapper.focus ();
    await expect ( wrapper ).toHaveCSS ( "outline-style", "none" );
    await expect ( path ).toHaveCSS ( "stroke-width", "6px" );

    const state = page.locator ( "[data-chart-state='A']" );
    const sourceGrip = page.getByRole ( "button", { name: "Move draft transition source endpoint 0", exact: true } );

    await dragGrip ( page, sourceGrip, await stateCenter ( state ) );
    await expect ( page.getByRole ( "dialog", { name: "Transition", exact: true } ) ).toHaveCount ( 0 );
    await expect.poll ( async () =>
    {
        const grip = await stateCenter ( sourceGrip );
        const body = await state.boundingBox ();

        if ( body === null )
        {
            return Number.POSITIVE_INFINITY;
        }

        return Math.min ( Math.abs ( grip.x - body.x ), Math.abs ( grip.x - body.x - body.width ),
            Math.abs ( grip.y - body.y ), Math.abs ( grip.y - body.y - body.height ) );
    } ).toBeLessThan ( 3 );
    const saved = await saveDocument ( page );

    expect ( saved.chart.draft_transitions?.[ 0 ]?.source_state ).toBe ( "A" );
    expect ( saved.chart.draft_transitions?.[ 0 ]?.target_state ?? null ).toBeNull ();
} );

test ( "Detaching a semantic endpoint remembers its event through Save/Open and restores automatically with Undo/Redo", async ( { page } ) =>
{
    await openDocument ( page, fixtureDocument ( true ) );
    await selectCurve ( page, page.locator ( ".chart-transition-edge .react-flow__edge-path" ) );
    const canvas = await page.locator ( ".chart-canvas" ).boundingBox ();

    if ( canvas === null )
    {
        throw new Error ( "The Chart canvas has no pointer drop bounds." );
    }

    await dragGrip ( page, page.locator ( ".chart-transition-endpoint[data-transition-endpoint='target']" ),
        { x: canvas.x + 180, y: canvas.y + canvas.height - 90 } );
    await expect ( page.locator ( ".chart-transition-edge" ) ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".chart-draft-transition-node .react-flow__edge-text" ) ).toHaveText ( "x" );
    await expect ( page.getByRole ( "dialog", { name: "Transition", exact: true } ) ).toHaveCount ( 0 );

    const saved = await saveDocument ( page );

    expect ( saved.file_version ).toBe ( "1.2.0" );
    expect ( saved.state_machine.transition_table ).toEqual ( [] );
    expect ( saved.chart.draft_transitions ).toHaveLength ( 1 );
    expect ( saved.chart.draft_transitions?.[ 0 ] ).toMatchObject ( { source_state: "A", remembered_event: "x" } );
    expect ( saved.chart.draft_transitions?.[ 0 ]?.target_state ?? null ).toBeNull ();
    await page.reload ();
    await openDocument ( page, saved );
    await expect ( page.locator ( ".chart-draft-transition-node .react-flow__edge-text" ) ).toHaveText ( "x" );
    await dragGrip ( page, page.getByRole ( "button", { name: "Move draft transition target endpoint 0", exact: true } ),
        await stateCenter ( page.locator ( "[data-chart-state='C']" ) ) );
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-transition-edge" ) ).toHaveAttribute ( "aria-label", /^A, x, C(?:\.|$)/u );
    await expect ( page.getByRole ( "dialog", { name: "Transition", exact: true } ) ).toHaveCount ( 0 );
    await page.locator ( "[data-toolbar-entry='toolbar-undo']" ).click ();
    await expect ( page.locator ( ".chart-draft-transition-node .react-flow__edge-text" ) ).toHaveText ( "x" );
    await expect ( page.locator ( ".chart-transition-edge" ) ).toHaveCount ( 0 );
    await page.locator ( "[data-toolbar-entry='toolbar-redo']" ).click ();
    await expect ( page.locator ( ".chart-draft-transition-node" ) ).toHaveCount ( 0 );
    await expect ( page.locator ( ".chart-transition-edge" ) ).toHaveAttribute ( "aria-label", /^A, x, C(?:\.|$)/u );
} );

for ( const theme of [ "Light", "Dark" ] as const )
{
    test ( "Chart selection geometry and Palette title retain theme colors in " + theme, async ( { page } ) =>
    {
        await page.locator ( "[data-toolbar-entry='toolbar-theme']" ).click ();
        await page.getByRole ( "menuitemradio", { name: theme } ).click ();
        const fixture = fixtureDocument ( true, true );
        await openDocument ( page, { ...fixture, chart: { ...fixture.chart,
            settings: { ...fixture.chart.settings, expand_states: true },
            indicators: {
                initial_state_indicator: { state: "A", x: -150, y: 0 },
                terminal_state_indicators: [ { id: 0, x: 600, y: 650 } ],
                terminal_state_transitions: [ { state: "C", terminal_state_indicator_id: 0 } ],
            } } } );
        await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
        await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
        const settings = page.getByRole ( "dialog", { name: "Application Settings" } );
        await settings.getByRole ( "option", { name: "Appearance", exact: true } ).click ();
        await settings.getByRole ( "combobox", { name: "Application Buttons" } ).selectOption ( "Purple" );
        await settings.getByRole ( "checkbox", { name: "Match Console Message Color" } ).uncheck ();
        await settings.getByRole ( "combobox", { name: "Console Message Buttons" } ).selectOption ( "Yellow" );
        await settings.getByRole ( "button", { name: "Apply", exact: true } ).click ();

        const state = page.locator ( "[data-chart-state='A']" );
        const readStateAppearance = () => state.evaluate ( element =>
        {
            const style = getComputedStyle ( element );
            return {
                border: style.border, fill: style.backgroundColor,
                bounds: element.getBoundingClientRect ().toJSON (),
                content: element.querySelector ( ".chart-state-header" )?.getBoundingClientRect ().toJSON (),
            };
        } );
        const unselectedAppearance = await readStateAppearance ();
        if ( theme === "Light" )
        {
            await expect ( state ).toHaveCSS ( "background-color", "rgb(255, 255, 255)" );
            await expect ( state ).toHaveCSS ( "color", "rgb(0, 0, 0)" );
            await expect ( state ).toHaveCSS ( "border-color", "rgb(0, 0, 0)" );
            for ( const selector of [ ".chart-state-compartments", ".chart-state-compartments section + section" ] )
            {
                await expect ( state.locator ( selector ) ).toHaveCSS ( "border-top-color", "rgb(0, 0, 0)" );
            }
            await expect ( page.locator ( ".chart-initial-indicator .chart-indicator-symbol" ) )
                .toHaveCSS ( "background-color", "rgb(0, 0, 0)" );
            const terminal = page.locator ( ".chart-terminal-indicator .chart-indicator-symbol" );
            await expect ( terminal ).toHaveCSS ( "border-color", "rgb(0, 0, 0)" );
            expect ( await terminal.evaluate ( element => getComputedStyle ( element, "::after" ).backgroundColor ) )
                .toBe ( "rgb(0, 0, 0)" );
            for ( const line of await page.locator ( ".react-flow__edge-path, .chart-draft-transition-path" ).all () )
            {
                await expect ( line ).toHaveCSS ( "stroke", "rgb(0, 0, 0)" );
            }
            for ( const arrow of await page.locator ( ".chart-canvas marker path" ).all () )
            {
                await expect ( arrow ).toHaveCSS ( "fill", "rgb(0, 0, 0)" );
            }
            for ( const label of await page.locator ( ".chart-canvas .react-flow__edge-text" ).all () )
            {
                await expect ( label ).toHaveCSS ( "fill", "rgb(0, 0, 0)" );
            }
        }
        await state.click ();
        await expect ( state ).toHaveCSS ( "border-top-width", "2px" );
        expect ( await readStateAppearance () ).toEqual ( unselectedAppearance );
        const haloColor = theme === "Light" ? "rgb(153, 153, 153)" : "rgb(102, 102, 102)";
        await expect ( state ).toHaveCSS ( "box-shadow", haloColor + " 0px 0px 0px 4px" );
        await page.screenshot ( { path: test.info ().outputPath ( "state-selection-halo.png" ) } );
        const gripGeometry = await state.evaluate ( element =>
        {
            const stateBounds = element.getBoundingClientRect ();
            const zoom = stateBounds.width / ( element as HTMLElement ).offsetWidth;
            return Array.from ( element.querySelectorAll ( ".chart-state-height-resizer" ) ).map ( grip =>
            {
                const bounds = grip.getBoundingClientRect ();
                const style = getComputedStyle ( grip );
                const marker = getComputedStyle ( grip, "::after" );
                const top = grip.classList.contains ( "chart-state-height-resizer-top" );
                return {
                    width: bounds.width / zoom, height: bounds.height / zoom,
                    horizontalOffset: ( bounds.x + bounds.width / 2 - stateBounds.x - stateBounds.width / 2 ) / zoom,
                    verticalOffset: ( top ? stateBounds.y - bounds.y - bounds.height / 2
                        : bounds.y + bounds.height / 2 - stateBounds.bottom ) / zoom,
                    borderTop: style.borderTopWidth, borderBottom: style.borderBottomWidth,
                    markerWidth: marker.width, markerHeight: marker.height,
                    markerBorderWidth: marker.borderTopWidth, markerBorderColor: marker.borderTopColor,
                };
            } );
        } );
        expect ( gripGeometry ).toHaveLength ( 2 );
        for ( const grip of gripGeometry )
        {
            expect ( grip.width ).toBeCloseTo ( 28, 1 );
            expect ( grip.height ).toBeCloseTo ( 28, 1 );
            expect ( grip.horizontalOffset ).toBeCloseTo ( 0, 1 );
            expect ( grip.verticalOffset ).toBeCloseTo ( 10.5, 1 );
            expect ( grip.borderTop ).toBe ( "0px" );
            expect ( grip.borderBottom ).toBe ( "0px" );
            expect ( grip.markerWidth ).toBe ( "10px" );
            expect ( grip.markerHeight ).toBe ( "10px" );
            expect ( grip.markerBorderWidth ).toBe ( "2px" );
            if ( theme === "Light" )
            {
                expect ( grip.markerBorderColor ).toBe ( "rgb(0, 0, 0)" );
            }
        }

        const paletteTitle = page.locator ( ".chart-palette .panel-title-bar" );
        const chartTitle = page.locator ( ".detail-page-header" );
        await expect ( paletteTitle ).toHaveText ( "Palette" );
        await expect ( paletteTitle ).toHaveCSS ( "height", "30px" );
        await expect ( paletteTitle ).toHaveCSS ( "background-color", await chartTitle.evaluate (
            element => getComputedStyle ( element ).backgroundColor,
        ) );

        for ( const [ curveSelector, endpointSelector, diameter ] of [
            [ ".chart-transition-edge .react-flow__edge-path", ".chart-transition-endpoint", 16 ],
            [ ".chart-draft-transition-path", ".chart-draft-transition-endpoint", 24 ],
        ] as const )
        {
            const originalStroke = await page.locator ( curveSelector ).evaluate (
                element => getComputedStyle ( element ).stroke,
            );
            await selectCurve ( page, page.locator ( curveSelector ) );
            if ( theme === "Light" )
            {
                await expect ( page.locator ( curveSelector ) ).toHaveCSS ( "stroke", originalStroke );
            }
            await expect ( page.locator ( curveSelector ) ).toHaveCSS ( "stroke-width", "6px" );
            const endpoints = page.locator ( endpointSelector );
            await expect ( endpoints ).toHaveCount ( 2 );
            const stateFill = await state.evaluate ( element => getComputedStyle ( element ).backgroundColor );
            for ( const endpoint of await endpoints.all () )
            {
                await expect ( endpoint ).toHaveCSS ( "width", diameter + "px" );
                await expect ( endpoint ).toHaveCSS ( "height", diameter + "px" );
                await expect ( endpoint ).toHaveCSS ( "border-radius", "50%" );
                await expect ( endpoint ).toHaveCSS ( "background-color", stateFill );
                if ( theme === "Light" )
                {
                    await expect ( endpoint ).toHaveCSS ( "border-color", "rgb(0, 0, 0)" );
                }
                await endpoint.hover ();
                await expect ( endpoint ).toHaveCSS ( "background-color", stateFill );
                await page.mouse.down ();
                await expect ( endpoint ).toHaveCSS ( "background-color", stateFill );
                await page.mouse.up ();
                await endpoint.focus ();
                if ( theme === "Light" )
                {
                    await expect ( endpoint ).toHaveCSS ( "border-color", "rgb(0, 0, 0)" );
                    await expect ( endpoint ).toHaveCSS ( "outline-color", "rgb(0, 0, 0)" );
                }
                await expect ( endpoint ).toHaveCSS ( "background-color", stateFill );
            }
        }
        await page.emulateMedia ( { forcedColors: "active" } );
        await expect ( page.locator ( ".chart-draft-transition-endpoint" ).first () ).toHaveCSS (
            "background-color", await state.evaluate ( element => getComputedStyle ( element ).backgroundColor ),
        );
        await state.click ();
        await expect ( state ).toHaveCSS ( "border-top-width", "2px" );
        await expect ( state ).toHaveCSS ( "outline-width", "4px" );
        await expect ( state ).toHaveCSS ( "outline-offset", "0px" );
    } );
}

test ( "Enlarged state grips resize each edge while the opposite edge and viewport remain fixed", async ( { page } ) =>
{
    const fixture = fixtureDocument ( true );
    await openDocument ( page, { ...fixture, chart: { ...fixture.chart,
        settings: { ...fixture.chart.settings, expand_states: true } } } );
    const state = page.locator ( "[data-chart-state='A']" );
    const readViewport = () => page.locator ( ".react-flow__viewport" ).evaluate (
        element => ( element as HTMLElement ).style.transform,
    );
    for ( const position of [ "top", "bottom" ] )
    {
        await state.click ();
        const initialHeight = await state.evaluate ( element => ( element as HTMLElement ).offsetHeight );
        const initialBounds = await state.boundingBox ();
        const grip = state.locator ( ".chart-state-height-resizer-" + position );
        const gripCenter = await stateCenter ( grip );
        const initialViewport = await readViewport ();
        if ( initialBounds === null )
        {
            throw new Error ( "The state has no bounds for the resize gesture." );
        }
        await page.mouse.move ( gripCenter.x, gripCenter.y );
        await page.mouse.down ();
        await page.mouse.move ( gripCenter.x, gripCenter.y + ( position === "top" ? -55 : 55 ), { steps: 8 } );
        await page.mouse.up ();
        await expect.poll ( () => state.evaluate ( element => ( element as HTMLElement ).offsetHeight ) )
            .toBeGreaterThan ( initialHeight );
        const resizedBounds = await state.boundingBox ();
        if ( resizedBounds === null )
        {
            throw new Error ( "The resized state has no bounds." );
        }
        expect ( position === "top" ? resizedBounds.y + resizedBounds.height : resizedBounds.y )
            .toBeCloseTo ( position === "top" ? initialBounds.y + initialBounds.height : initialBounds.y, 1 );
        await expect.poll ( readViewport ).toBe ( initialViewport );
        await page.getByRole ( "button", { name: "Undo", exact: true } ).click ();
        await expect.poll ( () => state.evaluate ( element => ( element as HTMLElement ).offsetHeight ) )
            .toBe ( initialHeight );
    }
    await state.click ();
    await page.screenshot ( { path: test.info ().outputPath ( "chart-selection.png" ) } );
} );

test ( "SVG export removes the outer state halo while preserving the normal border and live selection", async ( { page } ) =>
{
    await openDocument ( page, fixtureDocument ( true ) );
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
    const settings = page.getByRole ( "dialog", { name: "Application Settings" } );
    await settings.getByRole ( "option", { name: "Chart", exact: true } ).click ();
    await settings.getByRole ( "combobox", { name: "File Format", exact: true } ).selectOption ( "SVG" );
    await settings.getByRole ( "button", { name: "Apply", exact: true } ).click ();
    const state = page.locator ( "[data-chart-state='A']" );
    await state.click ();
    const originalBorder = await state.evaluate ( element => getComputedStyle ( element ).border );
    const originalHalo = await state.evaluate ( element => getComputedStyle ( element ).boxShadow );
    const downloading = page.waitForEvent ( "download" );
    await page.getByRole ( "button", { name: "Save As Image", exact: true } ).click ();
    const download = await downloading;
    expect ( download.suggestedFilename () ).toMatch ( /\.svg$/u );
    const path = await download.path ();
    if ( path === null )
    {
        throw new Error ( "The SVG export has no download path." );
    }
    const svg = await readFile ( path, "utf8" );
    const exportedStates = await page.evaluate ( markup =>
    {
        const document = new DOMParser ().parseFromString ( markup, "image/svg+xml" );
        return Array.from ( document.querySelectorAll<HTMLElement> ( ".chart-state-node" ) ).map ( element => ( {
            border: element.style.border, shadow: element.style.boxShadow, outline: element.style.outlineStyle,
            selected: element.classList.contains ( "chart-node-selected" ),
        } ) );
    }, svg );
    expect ( exportedStates ).toHaveLength ( 3 );
    expect ( exportedStates [ 0 ] ).toMatchObject ( {
        border: originalBorder, shadow: "none", outline: "none", selected: false,
    } );
    await expect ( state ).toHaveClass ( /chart-node-selected/u );
    await expect ( state ).toHaveCSS ( "box-shadow", originalHalo );
} );

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Scroll Content Spacing Tests
// Version: 1.0.0
// Date:    2026-09-13
// Author:  Rohin Gosling
//
// Description:
//
//   Checks independent scroll edges, native controls, and virtualized trace reachability.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { openEditorNode } from "./tree-helpers.js";

// Keep native scrollbar geometry visible in headless Chromium.

test.use ( { launchOptions: { ignoreDefaultArgs: [ "--hide-scrollbars" ] } } );

async function setSpacing ( page: Page, inset: number ): Promise<void>
{
    await page.locator ( ".application-shell" ).evaluate ( ( element, value ) =>
    {
        if ( !( element instanceof HTMLElement ) )
        {
            throw new Error ( "The application shell must be an HTML element." );
        }
        element.style.setProperty ( "--scroll-content-edge-inset", `${value}px` );
        element.style.setProperty ( "--detail-page-content-inset", "12px" );
        element.style.setProperty ( "--modal-content-inset", "16px" );
    }, inset );
}

async function expectScrollPadding ( owner: Locator, inset: number, rightInset = inset ): Promise<void>
{
    await expect ( owner ).toHaveCSS ( "padding-right", `${rightInset}px` );
    await expect ( owner ).toHaveCSS ( "padding-bottom", `${inset}px` );
    await expect ( owner ).toHaveCSS ( "scroll-padding-right", `${rightInset}px` );
}

async function contentEndGeometry ( owner: Locator, contentSelector: string )
{
    return owner.evaluate ( ( element, selector ) =>
    {
        const content = element.querySelector ( selector );
        if ( content === null )
        {
            throw new Error ( `Missing scroll content: ${selector}` );
        }
        const bounds        = element.getBoundingClientRect ();
        const contentBounds = content.getBoundingClientRect ();
        return {
            right: bounds.left + element.clientLeft + element.clientWidth - contentBounds.right,
            bottom: bounds.top + element.clientTop + element.clientHeight - contentBounds.bottom,
            horizontalOverflow: element.scrollWidth > element.clientWidth + 1,
            verticalOverflow: element.scrollHeight > element.clientHeight + 1,
        };
    }, contentSelector );
}

async function pullExample ( page: Page ): Promise<void>
{
    await page.goto ( "./" );
    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
}

test ( "catalog tables stay flush right and keep their bottom inset with neither, either, or both scrollbars", async ( { page } ) =>
{
    await pullExample ( page );
    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "Events", exact: true } ).click ();
    const grid = page.locator ( ".detail-page-content .data-grid" );

    // Clone real rows to change layout pressure without altering the document or command surface.

    await grid.evaluate ( element =>
    {
        if ( !( element instanceof HTMLElement ) )
        {
            throw new Error ( "The catalog must be an HTML element." );
        }
        element.style.inlineSize = "280px";
        element.style.blockSize  = "150px";
        const row = element.querySelector ( "[role='row']:last-child" );
        if ( row === null )
        {
            throw new Error ( "The example must contain an event row." );
        }
        for ( let i = 0; i < 30; i++ )
        {
            element.appendChild ( row.cloneNode ( true ) );
        }
    } );

    for ( const inset of [ 4, 8 ] )
    {
        await setSpacing ( page, inset );
        await expect ( page.locator ( ".detail-page-content" ) ).toHaveCSS ( "padding", "12px" );
        await expectScrollPadding ( grid, inset, 0 );
        for ( const horizontal of [ false, true ] )
        {
            for ( const vertical of [ false, true ] )
            {
                await grid.evaluate ( ( element, overflow ) =>
                {
                    const rows = Array.from ( element.querySelectorAll ( ":scope > [role='row']" ) );
                    rows.forEach ( ( row, index ) =>
                    {
                        if ( row instanceof HTMLElement )
                        {
                            row.style.display    = overflow.vertical || index < 2 ? "grid" : "none";
                            row.style.inlineSize = overflow.horizontal ? "600px" : "";
                        }
                    } );
                    element.scrollLeft = element.scrollWidth;
                    element.scrollTop  = element.scrollHeight;
                }, { horizontal, vertical } );
                const geometry = await contentEndGeometry ( grid,
                    vertical ? "[role='row']:last-child" : "[role='row']:nth-child(2)" );
                const context = JSON.stringify ( { inset, horizontal, vertical } );
                expect ( geometry.horizontalOverflow, context ).toBe ( horizontal );
                expect ( geometry.verticalOverflow, context ).toBe ( vertical );
                expect ( geometry.right, context ).toBeCloseTo ( 0, 0 );
                if ( vertical )
                {
                    expect ( geometry.bottom, context ).toBeCloseTo ( inset, 0 );
                }
                else
                {
                    expect ( geometry.bottom, context ).toBeGreaterThanOrEqual ( inset - 1 );
                }
            }
        }
    }
} );

test ( "intrinsic Transition Table and Console tables stay flush with their scrollport", async ( { page } ) =>
{
    await pullExample ( page );
    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "Transition Table", exact: true } ).click ();
    await page.setViewportSize ( { width: 320, height: 900 } );
    await page.getByRole ( "button", { name: "Detail", exact: true } ).click ();
    const grid = page.locator ( ".detail-page-content .data-grid" );
    await expect ( grid ).toBeVisible ();

    // The real three-column minimum must size the row itself through the scrollport right edge.

    for ( const inset of [ 4, 8 ] )
    {
        await setSpacing ( page, inset );
        await grid.evaluate ( element => { element.scrollLeft = element.scrollWidth; } );
        const rowGeometry  = await contentEndGeometry ( grid, "[role='row']:last-child" );
        const cellGeometry = await contentEndGeometry ( grid,
            "[role='row']:last-child > [role='gridcell']:last-child" );
        expect ( rowGeometry.horizontalOverflow ).toBe ( true );
        expect ( rowGeometry.right ).toBeCloseTo ( 0, 0 );
        expect ( cellGeometry.right ).toBeCloseTo ( 0, 0 );
        const cellWidths = await grid.locator ( "[role='row']:last-child > [role='gridcell']" )
            .evaluateAll ( cells => cells.map ( cell => cell.getBoundingClientRect ().width ) );
        expect ( cellWidths ).toHaveLength ( 3 );
        expect ( Math.min ( ...cellWidths ) ).toBeGreaterThanOrEqual ( 120 );
    }

    await page.getByRole ( "button", { name: "Console", exact: true } ).click ();
    await page.setViewportSize ( { width: 1440, height: 900 } );
    const consoleTable = page.locator ( ".console-table" );
    await expect ( consoleTable ).toBeVisible ();
    await consoleTable.evaluate ( element =>
    {
        if ( !( element instanceof HTMLElement ) )
        {
            throw new Error ( "The Console must be an HTML element." );
        }
        element.style.inlineSize = "280px";
        const sourceRow = element.querySelector ( ".console-row:last-child" );
        if ( sourceRow === null )
        {
            throw new Error ( "Pulling the example must produce a Console row." );
        }
        const row = sourceRow.cloneNode ( true );
        if ( !( row instanceof HTMLElement ) )
        {
            throw new Error ( "The copied Console row must be an HTML element." );
        }
        const context = row.querySelector ( ".console-context" );
        if ( context === null )
        {
            throw new Error ( "The Console row must contain its context column." );
        }
        context.textContent = "IntrinsicallyWideConsoleContext".repeat ( 10 );
        element.appendChild ( row );
    } );
    for ( const inset of [ 4, 8 ] )
    {
        await setSpacing ( page, inset );
        await expectScrollPadding ( consoleTable, inset, 0 );
        await consoleTable.evaluate ( element => { element.scrollLeft = element.scrollWidth; } );
        const rowGeometry     = await contentEndGeometry ( consoleTable, ".console-row:last-child" );
        const contextGeometry = await contentEndGeometry ( consoleTable,
            ".console-row:last-child > .console-context" );
        expect ( rowGeometry.horizontalOverflow ).toBe ( true );
        expect ( rowGeometry.right ).toBeCloseTo ( 0, 0 );
        expect ( contextGeometry.right ).toBeCloseTo ( 8, 0 );
        await expect ( consoleTable.locator ( ".console-row:last-child" ) ).toHaveCSS ( "padding", "3px 8px" );
    }
} );
test ( "shell and settings scroll boundaries remain independent of page and modal insets", async ( { page } ) =>
{
    await pullExample ( page );
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
    const dialog = page.getByRole ( "dialog", { name: "Application Settings" } );
    await expect ( dialog ).toBeVisible ();

    for ( const inset of [ 4, 8 ] )
    {
        await setSpacing ( page, inset );
        for ( const selector of [ ".navigation-tree", ".console-table", ".settings-groups", ".settings-detail" ] )
        {
            const owner      = page.locator ( selector );
            const rightInset = selector === ".console-table" ? 0 : inset;
            await expectScrollPadding ( owner, inset, rightInset );
            const geometry = await contentEndGeometry ( owner, ":scope > :last-child" );
            expect ( geometry.right, selector ).toBeGreaterThanOrEqual ( rightInset - 1 );
        }
        await expect ( dialog.locator ( ".dialog-content" ) ).toHaveCSS ( "padding", "16px" );
        await expect ( dialog.locator ( ".dialog-footer" ) ).toHaveCSS ( "padding", "16px" );
        await expect ( page.locator ( ".detail-page-content" ) ).toHaveCSS ( "padding", "12px" );
    }
} );

test ( "custom dropdown content keeps its inset at the end of a scrolling popup", async ( { page } ) =>
{
    await pullExample ( page );
    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "Transition Table", exact: true } ).click ();
    await page.locator ( ".drop-down-list-box-button" ).first ().click ();
    const popup = page.locator ( ".drop-down-list-box-popup" );
    await expect ( popup ).toBeVisible ();
    await popup.evaluate ( element =>
    {
        if ( !( element instanceof HTMLElement ) || element.lastElementChild === null )
        {
            throw new Error ( "The transition dropdown must contain an option." );
        }
        element.style.maxHeight = "120px";
        const option = element.lastElementChild;
        for ( let i = 0; i < 30; i++ )
        {
            element.appendChild ( option.cloneNode ( true ) );
        }
    } );
    for ( const inset of [ 4, 8 ] )
    {
        await setSpacing ( page, inset );
        await expectScrollPadding ( popup, inset );
        await popup.evaluate ( element => { element.scrollTop = element.scrollHeight; } );
        const geometry = await contentEndGeometry ( popup, ":scope > :last-child" );
        expect ( geometry.verticalOverflow ).toBe ( true );
        expect ( geometry.right ).toBeCloseTo ( inset, 0 );
        expect ( geometry.bottom ).toBeCloseTo ( inset, 0 );
    }
    await page.keyboard.press ( "Escape" );
    await expect ( popup ).toHaveCount ( 0 );
} );
test ( "native sequence controls expose their final content and preserve the scroll inset", async ( { page }, testInfo ) =>
{
    await pullExample ( page );
    await page.getByRole ( "treeitem", { name: "Solver", exact: true } ).click ();
    const editor = page.getByRole ( "textbox", { name: "Sequence", exact: true } );
    const list   = page.locator ( ".solver-sequence-list select" );
    await editor.fill ( Array ( 80 ).fill ( `event_${"a".repeat ( 100 )}` ).join ( "\n" ) );
    await editor.evaluate ( element =>
    {
        if ( element instanceof HTMLTextAreaElement )
        {
            element.style.inlineSize = "280px";
        }
    } );
    await list.evaluate ( element =>
    {
        if ( !( element instanceof HTMLSelectElement ) )
        {
            throw new Error ( "The sequence list must be a native select." );
        }
        for ( let i = 0; i < 80; i++ )
        {
            const option       = document.createElement ( "option" );
            option.value       = `spacing-sequence-${i}`;
            option.textContent = `Spacing sequence ${i}`;
            element.appendChild ( option );
        }
    } );

    const textareaHeights: number[] = [];
    for ( const inset of [ 4, 8 ] )
    {
        await setSpacing ( page, inset );
        for ( const owner of [ editor, list ] )
        {
            await expectScrollPadding ( owner, inset );
            await owner.evaluate ( element =>
            {
                element.scrollTop  = element.scrollHeight;
                element.scrollLeft = element.scrollWidth;
            } );
            const range = await owner.evaluate ( element => ( {
                height: element.scrollHeight,
                width: element.scrollWidth,
                remaining: element.scrollHeight - element.scrollTop - element.clientHeight,
                overflowing: element.scrollHeight > element.clientHeight,
                horizontalOverflow: element.scrollWidth > element.clientWidth,
            } ) );
            expect ( range.overflowing ).toBe ( true );
            expect ( range.remaining ).toBeLessThanOrEqual ( 1 );
            if ( owner === editor )
            {
                expect ( range.horizontalOverflow ).toBe ( false );
                textareaHeights.push ( range.height );
            }
        }
        const optionGeometry = await list.locator ( "option:last-child" ).boundingBox ();
        if ( optionGeometry !== null && optionGeometry.height > 0 )
        {
            const geometry = await contentEndGeometry ( list, "option:last-child" );
            expect ( geometry.bottom ).toBeGreaterThanOrEqual ( inset - 1 );
            expect ( geometry.right ).toBeGreaterThanOrEqual ( inset - 1 );
        }
        else
        {
            testInfo.annotations.push ( { type: "native-control", description:
                "This browser does not expose native option rectangles; CSS and scroll range are checked." } );
        }
    }
    expect ( textareaHeights [ 1 ] ).toBe ( ( textareaHeights [ 0 ] ?? 0 ) + 4 );
} );

test ( "Solver review content and nested Simulator panes keep independent scroll edges", async ( { page } ) =>
{
    await pullExample ( page );
    await page.getByRole ( "treeitem", { name: "Solver", exact: true } ).click ();
    await page.getByRole ( "textbox", { name: "Sequence", exact: true } )
        .fill ( "event-start\naction-ready\nevent-stop\naction-finished" );
    await page.getByRole ( "button", { name: "Solve", exact: true } ).click ();
    await expect ( page.getByRole ( "heading", { name: "Candidate Review" } ) ).toBeVisible ();
    for ( const inset of [ 4, 8 ] )
    {
        await setSpacing ( page, inset );
        for ( const tab of await page.locator ( ".solver-candidate-review [role='tab']" ).all () )
        {
            await tab.click ();
            for ( const owner of await page.locator (
                ".solver-review-scroll:visible, .solver-candidate-review .tab-panel:visible:has(> table)",
            ).all () )
            {
                const containsTable = await owner.locator ( ":scope > table" ).count () > 0;
                await expectScrollPadding ( owner, 12, containsTable ? 0 : 12 );
            }
        }
    }
    await page.getByRole ( "treeitem", { name: "Simulator", exact: true } ).click ();
    for ( const inset of [ 4, 8 ] )
    {
        await setSpacing ( page, inset );
        for ( const selector of [ ".simulator-event-panes", ".simulator-inspector" ] )
        {
            await expectScrollPadding ( page.locator ( selector ), inset );
        }
        await expect ( page.locator ( ".detail-page-content" ) ).toHaveCSS ( "padding", "12px" );
    }
} );

test ( "virtualized traces preserve final-row clearance and follow-tail after inset changes", async ( { page } ) =>
{
    await pullExample ( page );
    await page.getByRole ( "treeitem", { name: "Simulator", exact: true } ).click ();
    await page.getByRole ( "textbox", { name: "Editor", exact: true } )
        .fill ( Array ( 220 ).fill ( "event_toggle_main_supply_on" ).join ( "\n" ) );
    await page.getByRole ( "textbox", { name: "Editor", exact: true } ).blur ();
    await page.getByRole ( "button", { name: "Start Session", exact: true } ).click ();
    await expect ( page.getByRole ( "button", { name: "Run", exact: true } ) ).toBeEnabled ();

    const scroll = page.locator ( ".simulator-transition-trace .simulator-trace-scroll" );
    const table  = page.locator ( ".simulator-transition-trace table" );
    for ( const inset of [ 4, 8 ] )
    {
        await setSpacing ( page, inset );
        const previousCount = await table.count () === 0 ? 0 : Number ( await table.getAttribute ( "aria-rowcount" ) );
        await page.getByRole ( "button", { name: "Run", exact: true } ).click ();
        await expect.poll ( async () => Number ( await table.getAttribute ( "aria-rowcount" ) ) )
            .toBeGreaterThan ( previousCount + 200 );
        await expectScrollPadding ( scroll, inset, 0 );
        await expect.poll ( async () => scroll.evaluate (
            element => element.scrollHeight - element.scrollTop - element.clientHeight,
        ) ).toBeLessThanOrEqual ( 1 );
        const finalIndex = Number ( await table.getAttribute ( "aria-rowcount" ) );
        await expect ( table.locator ( `tr[aria-rowindex='${finalIndex}']` ) ).toBeVisible ();
        // The table bounds include the outside half of its collapsed border.

        const geometry = await contentEndGeometry ( scroll, ":scope > table" );
        expect ( geometry.bottom ).toBeCloseTo ( inset, 0 );
        expect ( geometry.right ).toBeCloseTo ( 0, 0 );
        const rowHeights = await table.locator ( "tbody tr:not(.simulator-trace-spacer)" )
            .evaluateAll ( rows => rows.map ( row => Math.round ( row.getBoundingClientRect ().height ) ) );
        expect ( rowHeights.length ).toBeLessThan ( 220 );
        expect ( new Set ( rowHeights ) ).toEqual ( new Set ( [ 26 ] ) );
    }
    await scroll.evaluate ( element => { element.scrollTop = 0; } );
    await expect.poll ( () => scroll.evaluate ( element => element.scrollTop ) ).toBe ( 0 );
    const previousCount = await table.getAttribute ( "aria-rowcount" );
    await page.getByRole ( "button", { name: "Run", exact: true } ).click ();
    await expect ( table ).not.toHaveAttribute ( "aria-rowcount", String ( previousCount ) );
    expect ( await scroll.evaluate ( element => element.scrollTop ) ).toBe ( 0 );
} );

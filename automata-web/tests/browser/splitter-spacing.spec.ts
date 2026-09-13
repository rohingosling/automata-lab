// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Splitter Spacing Tests
// Version: 1.0.0
// Date:    2026-09-13
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies physical splitter gaps, bounded resizing, and layouts with hidden separators.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { openEditorNode } from "./tree-helpers.js";

async function loadDocument ( page: Page ): Promise<void>
{
    await page.goto ( "./" );
    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
}

async function openPage ( page: Page, routeName: string ): Promise<void>
{
    if ( page.viewportSize ()!.width < 1280 )
    {
        await page.getByRole ( "button", { name: "Model", exact: true } ).click ();
    }
    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: routeName, exact: true } ).click ();
}

async function expectSplitterSpacing ( splitter: Locator, expectedGap: number ): Promise<void>
{
    await expect ( splitter ).toBeVisible ();
    const geometry = await splitter.evaluate ( element =>
    {
        const bounds          = element.getBoundingClientRect ();
        const leadingBounds   = element.previousElementSibling!.getBoundingClientRect ();
        const trailingBounds  = element.nextElementSibling!.getBoundingClientRect ();
        const vertical        = element.getAttribute ( "aria-orientation" ) === "vertical";
        const shellDivider    = element.parentElement!.matches ( ".workspace, .upper-workspace" );
        const adjacentPadding = [ element.previousElementSibling!, element.nextElementSibling! ].map (
            pane => [ getComputedStyle ( pane ).paddingLeft, getComputedStyle ( pane ).paddingRight ],
        );
        return {
            label: element.getAttribute ( "aria-label" ),
            thickness: vertical ? bounds.width : bounds.height,
            leadingGap: vertical ? bounds.left - leadingBounds.right : bounds.top - leadingBounds.bottom,
            trailingGap: vertical ? trailingBounds.left - bounds.right : trailingBounds.top - bounds.bottom,
            shellDivider,
            vertical,
            adjacentPadding,
        };
    } );
    expect ( geometry.thickness, geometry.label! ).toBeCloseTo ( geometry.shellDivider ? 6 : 8, 1 );
    expect ( geometry.leadingGap, geometry.label! ).toBeCloseTo ( expectedGap, 1 );
    expect ( geometry.trailingGap, geometry.label! ).toBeCloseTo ( expectedGap, 1 );
    if ( geometry.vertical && !geometry.shellDivider )
    {
        expect ( geometry.adjacentPadding [ 0 ]?.[ 1 ], geometry.label! ).toBe ( "0px" );
        expect ( geometry.adjacentPadding [ 1 ]?.[ 0 ], geometry.label! ).toBe ( "0px" );
    }
}

async function expectSimulatorPanesFit ( page: Page ): Promise<void>
{
    const geometry = await page.locator ( ".simulator-panes" ).evaluate ( element =>
    {
        const bounds = element.getBoundingClientRect ();
        const panes  = Array.from ( element.children ).filter ( child => !child.matches ( ".splitter" ) );
        return {
            overflow: element.scrollWidth - element.clientWidth,
            panes: panes.map ( pane =>
            {
                const rectangle = pane.getBoundingClientRect ();
                return { left: rectangle.left - bounds.left, right: bounds.right - rectangle.right };
            } ),
            inspectorWidth: element.querySelector ( ".simulator-inspector" )!.getBoundingClientRect ().width,
        };
    } );
    expect ( geometry.overflow ).toBeLessThanOrEqual ( 1 );
    expect ( geometry.inspectorWidth ).toBeGreaterThanOrEqual ( 360 );
    for ( const pane of geometry.panes )
    {
        expect ( pane.left ).toBeGreaterThanOrEqual ( -1 );
        expect ( pane.right ).toBeGreaterThanOrEqual ( -1 );
    }
}

test ( "all eight splitters preserve their thickness and use the independent side gap", async ( { page } ) =>
{
    await loadDocument ( page );
    for ( const expectedGap of [ 4, 8 ] )
    {
        if ( expectedGap === 8 )
        {
            await page.locator ( ".application-shell" ).evaluate ( element =>
            {
                ( element as HTMLElement ).style.setProperty ( "--splitter-side-gap", "8px" );
                ( element as HTMLElement ).style.setProperty ( "--detail-page-content-inset", "12px" );
                ( element as HTMLElement ).style.setProperty ( "--scroll-content-edge-inset", "16px" );
            } );
        }
        for ( const label of [ "Resize model tree", "Resize Console" ] )
        {
            await expectSplitterSpacing ( page.getByRole ( "separator", { name: label, exact: true } ), expectedGap );
        }
        let internalDividerCount = 0;
        for ( const routeName of [ "States", "Solver", "Simulator" ] )
        {
            await openPage ( page, routeName );
            const dividers = await page.locator ( ".detail-page-content .splitter" ).all ();
            internalDividerCount += dividers.length;
            for ( const divider of dividers )
            {
                await expectSplitterSpacing ( divider, expectedGap );
            }
        }
        expect ( internalDividerCount ).toBe ( 6 );
    }
} );

test ( "Simulator splitters follow pointer and keyboard motion while reserving every pane", async ( { page } ) =>
{
    await page.setViewportSize ( { width: 1920, height: 1100 } );
    await loadDocument ( page );
    await openPage ( page, "Simulator" );
    for ( const label of [ "Resize Event Sequences", "Resize Events", "Resize Buffer Position", "Resize traces" ] )
    {
        const splitter = page.getByRole ( "separator", { name: label, exact: true } );
        const vertical = await splitter.getAttribute ( "aria-orientation" ) === "vertical";
        await splitter.focus ();
        await page.keyboard.press ( "Home" );
        const minimum = Number ( await splitter.getAttribute ( "aria-valuemin" ) );
        await expect ( splitter ).toHaveAttribute ( "aria-valuenow", String ( minimum ) );
        const initialBounds = ( await splitter.boundingBox () )!;
        await page.keyboard.press ( vertical ? "ArrowRight" : "ArrowDown" );
        await expect ( splitter ).toHaveAttribute ( "aria-valuenow", String ( minimum + 12 ) );
        const keyboardBounds = ( await splitter.boundingBox () )!;
        expect ( vertical ? keyboardBounds.x - initialBounds.x : keyboardBounds.y - initialBounds.y )
            .toBeCloseTo ( 12, 0 );

        const pointerX = keyboardBounds.x + keyboardBounds.width / 2;
        const pointerY = keyboardBounds.y + keyboardBounds.height / 2;
        await page.mouse.move ( pointerX, pointerY );
        await page.mouse.down ();
        await page.mouse.move ( pointerX + ( vertical ? 24 : 0 ), pointerY + ( vertical ? 0 : 24 ), { steps: 4 } );
        await page.mouse.up ();
        await expect ( splitter ).toHaveAttribute ( "aria-valuenow", String ( minimum + 36 ) );
        const pointerBounds = ( await splitter.boundingBox () )!;
        expect ( vertical ? pointerBounds.x - keyboardBounds.x : pointerBounds.y - keyboardBounds.y )
            .toBeCloseTo ( 24, 0 );

        await splitter.focus ();
        await page.keyboard.press ( "End" );
        const maximum = Number ( await splitter.getAttribute ( "aria-valuemax" ) );
        await expect ( splitter ).toHaveAttribute ( "aria-valuenow", String ( maximum ) );
        const parentRange = await splitter.evaluate ( element => element.getAttribute ( "aria-orientation" ) === "vertical"
            ? element.parentElement!.clientWidth : element.parentElement!.clientHeight );
        expect ( maximum ).toBeLessThanOrEqual ( Math.floor ( parentRange * 2 / 3 ) );
        await expectSimulatorPanesFit ( page );
        await expectSplitterSpacing ( splitter, 4 );
        await page.keyboard.press ( "Home" );
    }
} );

test ( "hiding Console preserves the Simulator horizontal dividers", async ( { page } ) =>
{
    await loadDocument ( page );
    await openPage ( page, "Simulator" );
    await page.getByRole ( "menuitem", { name: "View", exact: true } ).click ();
    await page.locator ( "[data-menu-entry='view-console']" ).click ();
    await expect ( page.getByRole ( "separator", { name: "Resize Console", exact: true } ) ).toBeHidden ();
    for ( const label of [ "Resize Buffer Position", "Resize traces" ] )
    {
        await expectSplitterSpacing ( page.getByRole ( "separator", { name: label, exact: true } ), 4 );
    }
} );

test ( "shell splitters clamp stored dimensions after a smaller viewport and reload", async ( { page } ) =>
{
    await page.setViewportSize ( { width: 1920, height: 1100 } );
    await page.goto ( "./" );
    for ( const label of [ "Resize model tree", "Resize Console" ] )
    {
        await page.getByRole ( "separator", { name: label, exact: true } ).focus ();
        await page.keyboard.press ( "End" );
    }
    await page.setViewportSize ( { width: 1440, height: 500 } );
    const storedSizes: number[] = [];
    for ( const label of [ "Resize model tree", "Resize Console" ] )
    {
        const splitter = page.getByRole ( "separator", { name: label, exact: true } );
        const expectedMaximum = await splitter.evaluate ( element =>
        {
            const vertical = element.getAttribute ( "aria-orientation" ) === "vertical";
            const range    = vertical ? element.parentElement!.clientWidth : element.parentElement!.clientHeight;
            const minimum  = Number ( element.getAttribute ( "aria-valuemin" ) );
            return Math.max ( minimum, Math.min ( Math.floor ( range * 2 / 3 ), range - 14 - ( vertical ? 784 : 160 ) ) );
        } );
        await expect ( splitter ).toHaveAttribute ( "aria-valuemax", String ( expectedMaximum ) );
        await expect ( splitter ).toHaveAttribute ( "aria-valuenow", String ( expectedMaximum ) );
        storedSizes.push ( Number ( await splitter.getAttribute ( "aria-valuenow" ) ) );
        await expectSplitterSpacing ( splitter, 4 );
    }
    expect ( await page.locator ( ".detail-region" ).evaluate ( element => element.clientWidth ) )
        .toBeGreaterThanOrEqual ( 784 );
    expect ( await page.locator ( ".upper-workspace" ).evaluate ( element => element.clientHeight ) )
        .toBeGreaterThanOrEqual ( 160 );
    await page.reload ();
    for ( const [ index, label ] of [ "Resize model tree", "Resize Console" ].entries () )
    {
        await expect ( page.getByRole ( "separator", { name: label, exact: true } ) )
            .toHaveAttribute ( "aria-valuenow", String ( storedSizes [ index ] ) );
    }
} );

for ( const width of [ 1279, 1100, 767, 320 ] )
{
    test ( `hidden splitter tracks leave every pane available at ${width}px`, async ( { page } ) =>
    {
        await loadDocument ( page );
        await page.setViewportSize ( { width, height: 900 } );
        for ( const [ routeName, selector, paneCount, stacked ] of [
            [ "States", ".states-editor", 2, width < 768 ],
            [ "Solver", ".solver-panes", 2, width < 768 ],
            [ "Simulator", ".simulator-panes", 3, width <= 1100 ],
        ] as const )
        {
            await openPage ( page, routeName );
            await expect ( page.locator ( ".splitter:visible" ) ).toHaveCount ( 0 );
            const geometry = await page.locator ( selector ).evaluate ( element =>
            {
                const style    = getComputedStyle ( element );
                const bounds   = element.getBoundingClientRect ();
                const children = Array.from ( element.children ).filter ( child => !child.matches ( ".splitter" ) );
                return {
                    columnCount: style.gridTemplateColumns.split ( /\s+/ ).length,
                    rowCount: style.gridTemplateRows.split ( /\s+/ ).length,
                    panes: children.map ( child =>
                    {
                        const rectangle = child.getBoundingClientRect ();
                        return { width: rectangle.width, height: rectangle.height,
                            top: rectangle.top - bounds.top, bottom: bounds.bottom - rectangle.bottom };
                    } ),
                };
            } );
            expect ( geometry.columnCount, routeName ).toBe ( stacked ? 1 : paneCount );
            expect ( geometry.rowCount, routeName ).toBe ( stacked ? paneCount : 1 );
            expect ( geometry.panes, routeName ).toHaveLength ( paneCount );
            for ( const pane of geometry.panes )
            {
                expect ( pane.width, routeName ).toBeGreaterThan ( 0 );
                expect ( pane.height, routeName ).toBeGreaterThan ( 0 );
                expect ( pane.top, routeName ).toBeGreaterThanOrEqual ( -1 );
                expect ( pane.bottom, routeName ).toBeGreaterThanOrEqual ( -1 );
            }
            if ( routeName === "Simulator" )
            {
                for ( const selector of [ ".simulator-event-panes", ".simulator-inspector" ] )
                {
                    const rowCount = await page.locator ( selector ).evaluate (
                        element => getComputedStyle ( element ).gridTemplateRows.split ( /\s+/ ).length,
                    );
                    expect ( rowCount, selector ).toBe ( 2 );
                }
            }
        }
    } );
}

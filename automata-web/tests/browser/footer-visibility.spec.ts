// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Pane Footer Visibility Tests
// Version: 1.0.0
// Date:    2026-09-13
// Author:  Rohin Gosling
//
// Description:
//
//   Keeps pane actions outside vertical scrolling regions as available height changes.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import { openEditorNode } from "./tree-helpers.js";

for ( const viewport of [ { width: 1440, height: 420 }, { width: 1440, height: 480 }, { width: 1440, height: 650 },
    { width: 900, height: 450 }, { width: 320, height: 600 } ] )
{
    test ( `pane footers remain visible at ${viewport.width} by ${viewport.height}`, async ( { page }, testInfo ) =>
    {
        await page.goto ( "./" );
        await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
        await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
        await page.setViewportSize ( viewport );
        if ( viewport.width === 1440 )
        {
            await page.getByRole ( "separator", { name: "Resize Console", exact: true } ).focus ();
            await page.keyboard.press ( "End" );
        }

        for ( const routeName of [ "Editor", "Events", "Actions", "Transition Table", "States",
            "Chart", "Solver", "Simulator" ] )
        {
            if ( viewport.width < 1280 )
            {
                await page.getByRole ( "button", { name: "Model", exact: true } ).click ();
            }
            await openEditorNode ( page );
            await page.getByRole ( "treeitem", { name: routeName, exact: true } ).click ();

            for ( const longContent of [ false, true ] )
            {
                if ( longContent )
                {
                    // Add layout pressure to rendered content without changing model semantics.
                    await page.locator ( ".detail-page-content .data-grid, .detail-page-content select[size]" )
                        .evaluateAll ( elements =>
                        {
                            for ( const element of elements )
                            {
                                const row = element.lastElementChild;
                                if ( row !== null )
                                {
                                    for ( let i = 0; i < 80; i++ )
                                    {
                                        element.appendChild ( row.cloneNode ( true ) );
                                    }
                                }
                            }
                        } );
                }
                if ( !longContent && viewport.width === 1440 && viewport.height === 480 &&
                    ( routeName === "Solver" || routeName === "Simulator" ) )
                {
                    await page.screenshot ( { path: testInfo.outputPath ( `${routeName.toLowerCase ()}-short.png` ) } );
                }
                const geometry = await page.locator ( ".detail-page-content" ).evaluate ( element =>
                {
                    const bounds = element.getBoundingClientRect ();
                    const footers = Array.from ( element.querySelectorAll (
                        ".detail-button-panel, .solver-page-command-bar, .list-command-bar",
                    ) ).filter ( footer => footer.getClientRects ().length > 0 );
                    return {
                        overflow: element.scrollHeight - element.clientHeight,
                        footers: footers.map ( footer =>
                        {
                            const rectangle = footer.getBoundingClientRect ();
                            const scrollingAncestors = [];
                            let ancestor = footer.parentElement;
                            while ( ancestor !== null && element.contains ( ancestor ) )
                            {
                                if ( /auto|scroll/.test ( getComputedStyle ( ancestor ).overflowY ) &&
                                    ancestor.scrollHeight > ancestor.clientHeight + 1 )
                                {
                                    scrollingAncestors.push ( ancestor.className );
                                }
                                ancestor = ancestor.parentElement;
                            }
                            return {
                                selector: footer.className,
                                top: rectangle.top - bounds.top,
                                bottom: bounds.top + element.clientHeight - rectangle.bottom,
                                scrollingAncestors,
                            };
                        } ),
                    };
                } );
                expect ( geometry.overflow, routeName ).toBeLessThanOrEqual ( 1 );
                expect ( geometry.footers.length, routeName ).toBeGreaterThan ( 0 );
                for ( const footer of geometry.footers )
                {
                    expect ( footer.top, `${routeName}: ${footer.selector}` ).toBeGreaterThanOrEqual ( 0 );
                    expect ( footer.bottom, `${routeName}: ${footer.selector}` ).toBeGreaterThanOrEqual ( 0 );
                    expect ( footer.scrollingAncestors, routeName ).toEqual ( [] );
                }
            }
        }
    } );
}
test ( "Solver diagnostics and candidate tabs stay above visible actions in a short window", async ( { page } ) =>
{
    await page.goto ( "./" );
    await page.locator ( "[data-toolbar-entry='toolbar-new']" ).click ();
    await page.getByRole ( "treeitem", { name: "Solver", exact: true } ).click ();
    await page.setViewportSize ( { width: 1440, height: 480 } );
    const editor = page.getByRole ( "textbox", { name: "Sequence", exact: true } );
    await editor.fill ( Array ( 100 ).fill ( "? invalid token" ).join ( "\n" ) );
    await expect ( page.locator ( ".solver-token-errors" ) ).toBeVisible ();
    const overflow = () => page.locator ( ".detail-page-content" ).evaluate (
        element => element.scrollHeight - element.clientHeight,
    );
    await expect.poll ( overflow ).toBeLessThanOrEqual ( 1 );
    await editor.fill ( "event-start\naction-ready\nevent-stop\naction-finished" );
    await page.getByRole ( "button", { name: "Solve", exact: true } ).click ();
    await expect ( page.getByRole ( "heading", { name: "Candidate Review" } ) ).toBeVisible ();
    for ( const tab of await page.locator ( ".solver-candidate-review [role='tab']" ).all () )
    {
        await tab.click ();
        await expect.poll ( overflow ).toBeLessThanOrEqual ( 1 );
    }
    await page.getByRole ( "button", { name: "Back to Sequences", exact: true } ).click ();
    await expect ( editor ).toBeVisible ();
} );
test ( "blocked Simulator reserves the footer below its message and content", async ( { page }, testInfo ) =>
{
    await page.goto ( "./" );
    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
    await page.getByRole ( "treeitem", { name: "Simulator", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Disconnect from Server" } ).click ();
    await expect ( page.locator ( ".simulator-blocked" ) ).toBeVisible ();
    await page.setViewportSize ( { width: 1440, height: 480 } );
    const footerViolations = () => page.locator ( ".detail-page-content" ).evaluate ( element =>
    {
        const bounds       = element.getBoundingClientRect ();
        const commandPanel = element.querySelector ( ".simulator-command-panel" )!;
        const commandTop   = commandPanel.getBoundingClientRect ().top;
        const footers      = Array.from ( element.querySelectorAll ( ".detail-button-panel, .list-command-bar" ) );
        const violations: string[] = [];
        if ( footers.length !== 3 || element.scrollHeight > element.clientHeight + 1 )
        {
            violations.push ( "Missing footer or detail page overflow" );
        }
        for ( const footer of footers )
        {
            const rectangle = footer.getBoundingClientRect ();
            if ( rectangle.height <= 0 || rectangle.top < bounds.top - 1 ||
                rectangle.bottom > bounds.top + element.clientHeight + 1 )
            {
                violations.push ( `Footer outside the visible page: ${footer.className}` );
            }
            if ( footer !== commandPanel && rectangle.bottom > commandTop + 1 )
            {
                violations.push ( `Nested footer overlaps the page commands: ${footer.className}` );
            }
            let ancestor = footer.parentElement;
            while ( ancestor !== null && element.contains ( ancestor ) )
            {
                if ( ancestor.scrollHeight > ancestor.clientHeight + 1 )
                {
                    violations.push ( `Footer has a scrolling ancestor: ${ancestor.className}` );
                }
                ancestor = ancestor.parentElement;
            }
        }
        return violations;
    } );
    await expect.poll ( footerViolations ).toEqual ( [] );
    const consoleSplitter = page.getByRole ( "separator", { name: "Resize Console", exact: true } );
    await consoleSplitter.focus ();
    await page.keyboard.press ( "End" );
    await expect.poll ( footerViolations ).toEqual ( [] );
    await page.screenshot ( { path: testInfo.outputPath ( "simulator-blocked-short.png" ) } );

    await page.getByRole ( "treeitem", { name: "Solver", exact: true } ).click ();
    const solverMaximum = await consoleSplitter.evaluate ( element =>
    {
        const range   = element.parentElement!.clientHeight;
        const minimum = Number ( element.getAttribute ( "aria-valuemin" ) );
        return Math.max ( minimum, Math.min ( Math.floor ( range * 2 / 3 ), range - 14 - 160 ) );
    } );
    await expect ( consoleSplitter ).toHaveAttribute ( "aria-valuemax", String ( solverMaximum ) );
    await consoleSplitter.focus ();
    await page.keyboard.press ( "End" );
    await expect ( consoleSplitter ).toHaveAttribute ( "aria-valuenow", String ( solverMaximum ) );
} );
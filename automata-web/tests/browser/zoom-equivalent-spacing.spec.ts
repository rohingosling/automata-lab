// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Zoom-Equivalent Viewport Spacing Tests
// Version: 1.0.0
// Date:    2026-09-13
// Author:  Rohin Gosling
//
// Description:
//
//   Exercises complex panes in the CSS viewport of a 1440-by-900 window at 200 percent zoom.
//   Actual browser zoom remains a separate manual check; changing viewport size does not set it.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";
import { openEditorNode } from "./tree-helpers.js";

// Retain native scrollbar geometry in headless Chromium.

test.use ( { launchOptions: { ignoreDefaultArgs: [ "--hide-scrollbars" ] } } );

async function expectVisibleFooters ( root: Locator ): Promise<void>
{
    await expect.poll ( () => root.evaluate ( element =>
    {
        const bounds   = element.getBoundingClientRect ();
        const failures: string[] = [];
        const footers  = Array.from ( element.querySelectorAll (
            ".detail-button-panel, .solver-page-command-bar, .list-command-bar, .dialog-footer",
        ) ).filter ( footer => footer.getClientRects ().length > 0 );

        if ( footers.length === 0 || element.scrollHeight > element.clientHeight + 1 )
        {
            failures.push ( "Missing footer or scrolling outer pane" );
        }
        for ( const footer of footers )
        {
            const rectangle = footer.getBoundingClientRect ();
            if ( rectangle.top < bounds.top - 1 || rectangle.bottom > bounds.bottom + 1 ||
                rectangle.bottom > window.innerHeight + 1 )
            {
                failures.push ( `Footer outside the visible pane: ${footer.className}` );
            }
            let ancestor = footer.parentElement;
            while ( ancestor !== null && element.contains ( ancestor ) )
            {
                if ( /auto|scroll/.test ( getComputedStyle ( ancestor ).overflowY ) &&
                    ancestor.scrollHeight > ancestor.clientHeight + 1 )
                {
                    failures.push ( `Footer has a scrolling ancestor: ${ancestor.className}` );
                }
                ancestor = ancestor.parentElement;
            }
        }
        if ( document.documentElement.scrollWidth > window.innerWidth )
        {
            failures.push ( "The document scrolls horizontally" );
        }
        return failures;
    } ) ).toEqual ( [] );
}

for ( const appearance of [ "Light", "Dark", "Forced colors" ] )
{
    test ( `complex panes retain their spacing in a 200-percent-equivalent viewport with ${appearance}`,
        async ( { page }, testInfo ) =>
    {
        await page.goto ( "./" );
        await page.locator ( "[data-toolbar-entry='toolbar-theme']" ).click ();
        await page.getByRole ( "menuitemradio", { name: appearance === "Dark" ? "Dark" : "Light" } ).click ();
        if ( appearance === "Forced colors" )
        {
            await page.emulateMedia ( { forcedColors: "active" } );
            const supported = await page.evaluate ( () => matchMedia ( "(forced-colors: active)" ).matches );
            testInfo.annotations.push (
            {
                type: "forced colors",
                description: supported ? "The browser activated forced colors."
                    : "This browser does not expose forced colors; the geometry still runs in Light theme.",
            } );
        }
        await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
        await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
        const shell = page.locator ( ".application-shell" );

        for ( const [ property, value ] of [
            [ "--detail-page-content-inset", "8px" ],
            [ "--modal-content-inset", "8px" ],
            [ "--scroll-content-edge-inset", "4px" ],
            [ "--splitter-side-gap", "4px" ],
        ] as const )
        {
            await expect ( shell ).toHaveCSS ( property, value );
        }
        await shell.evaluate ( element =>
        {
            if ( !( element instanceof HTMLElement ) )
            {
                throw new Error ( "The application shell must be an HTML element." );
            }
            element.style.setProperty ( "--detail-page-content-inset", "4px" );
            element.style.setProperty ( "--modal-content-inset", "8px" );
            element.style.setProperty ( "--scroll-content-edge-inset", "12px" );
            element.style.setProperty ( "--splitter-side-gap", "16px" );
        } );
        await page.setViewportSize ( { width: 720, height: 450 } );

        for ( const routeName of [ "States", "Solver", "Simulator" ] )
        {
            await page.getByRole ( "button", { name: "Model", exact: true } ).click ();
            await openEditorNode ( page );
            await page.getByRole ( "treeitem", { name: routeName, exact: true } ).click ();
            const detail = page.locator ( ".detail-page-content" );
            await expect ( detail ).toBeVisible ();
            await expect ( detail ).toHaveCSS ( "padding", "4px" );
            await expect ( detail.locator ( ".splitter:visible" ) ).toHaveCount ( 0 );

            if ( routeName === "Simulator" )
            {
                const editor = page.getByRole ( "textbox", { name: "Editor", exact: true } );
                await editor.fill ( Array ( 60 ).fill ( "event_toggle_main_supply_on" ).join ( "\n" ) );
                await editor.blur ();
                await page.getByRole ( "button", { name: "Start Session", exact: true } ).click ();
                await expect ( page.getByRole ( "button", { name: "Run", exact: true } ) ).toBeEnabled ();
                await page.getByRole ( "button", { name: "Run", exact: true } ).click ();
                await expect.poll ( async () => Number ( await page.locator ( ".simulator-transition-trace table" )
                    .getAttribute ( "aria-rowcount" ) ) ).toBeGreaterThan ( 50 );
            }

            // Pressure the existing content while leaving pane and footer sizing untouched.

            await detail.locator ( ".data-grid, .entity-list, select[size]" ).evaluateAll ( owners =>
            {
                for ( const owner of owners )
                {
                    const row = owner.lastElementChild;
                    if ( row !== null )
                    {
                        for ( let i = 0; i < 60; i++ )
                        {
                            owner.appendChild ( row.cloneNode ( true ) );
                        }
                    }
                }
            } );
            await expectVisibleFooters ( detail );
            for ( const owner of await detail.locator ( ".data-grid, .simulator-trace-scroll" ).all () )
            {
                await expect ( owner ).toHaveCSS ( "padding-right", "0px" );
                await expect ( owner ).toHaveCSS ( "scroll-padding-right", "0px" );
                await expect ( owner ).toHaveCSS ( "padding-bottom", "12px" );
                await expect.poll ( () => owner.evaluate (
                    element => element.scrollHeight - element.clientHeight,
                ) ).toBeGreaterThan ( 1 );
                await expect.poll ( () => owner.evaluate ( element =>
                {
                    element.scrollLeft = element.scrollWidth;
                    const content = element.querySelector ( ":scope > table" ) ?? element.lastElementChild;
                    if ( content === null )
                    {
                        throw new Error ( "The table scrollport must contain rows." );
                    }
                    const bounds = element.getBoundingClientRect ();
                    return Math.abs ( bounds.left + element.clientLeft + element.clientWidth -
                        content.getBoundingClientRect ().right );
                } ) ).toBeLessThanOrEqual ( 1 );
            }
            for ( const owner of await detail.locator ( ".entity-list, select[size], textarea" ).all () )
            {
                await expect ( owner ).toHaveCSS ( "padding-right", "12px" );
                await expect ( owner ).toHaveCSS ( "padding-bottom", "12px" );
            }
        }

        const fileMenu = page.getByRole ( "menuitem", { name: "File", exact: true } );
        await fileMenu.click ();
        await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
        const dialog = page.getByRole ( "dialog", { name: "Application Settings" } );
        await expect ( dialog ).toBeVisible ();
        for ( const selector of [ ".dialog-content", ".dialog-footer" ] )
        {
            await expect ( dialog.locator ( selector ) ).toHaveCSS ( "padding", "8px" );
        }
        for ( const owner of await dialog.locator ( ".settings-groups, .settings-detail" ).all () )
        {
            await expect ( owner ).toHaveCSS ( "padding-right", "12px" );
            await expect ( owner ).toHaveCSS ( "padding-bottom", "12px" );
        }
        await expectVisibleFooters ( dialog );
        const footerClearance = await dialog.locator ( ".dialog-footer" ).evaluate ( element =>
        {
            const button = element.querySelector ( "button:last-child" );
            if ( button === null )
            {
                throw new Error ( "The Settings footer must contain an action." );
            }
            const bounds       = element.getBoundingClientRect ();
            const buttonBounds = button.getBoundingClientRect ();
            return { right: bounds.right - buttonBounds.right, bottom: bounds.bottom - buttonBounds.bottom };
        } );
        expect ( footerClearance.right ).toBeCloseTo ( 8, 0 );
        expect ( footerClearance.bottom ).toBeCloseTo ( 8, 0 );
        await page.keyboard.press ( "Escape" );
        await expect ( dialog ).toHaveCount ( 0 );
        await expect ( fileMenu ).toBeFocused ();
        await expectVisibleFooters ( page.locator ( ".detail-page-content" ) );
    } );
}

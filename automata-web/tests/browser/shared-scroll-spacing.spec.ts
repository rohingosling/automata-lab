// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Shared Scroll Edge Spacing Tests
// Version: 1.0.0
// Date:    2026-09-13
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies physical content clearance where page edges meet actual scroll owners, and keeps
//   compact shell text, Chart Palette tiles, and pane actions accessible with native scrollbars.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

// Playwright hides Chromium scrollbars in headless mode unless that default argument is removed.

test.use ( { launchOptions: { ignoreDefaultArgs: [ "--hide-scrollbars" ] } } );

async function setInsets ( page: Page, pageInset: number, scrollInset: number ): Promise<void>
{
    await page.locator ( ".application-shell" ).evaluate ( ( element, values ) =>
    {
        const shell = element as HTMLElement;

        shell.style.setProperty ( "--detail-page-content-inset", `${values.pageInset}px` );
        shell.style.setProperty ( "--scroll-content-edge-inset", `${values.scrollInset}px` );
    }, { pageInset, scrollInset } );
}

async function readTrailingClearance ( owner: Locator, childSelector: string )
{
    return owner.evaluate ( async ( element, selector ) =>
    {
        element.scrollLeft = element.scrollWidth;
        element.scrollTop  = element.scrollHeight;
        await new Promise<void> ( resolve => requestAnimationFrame ( () => requestAnimationFrame ( () => resolve () ) ) );

        const bounds        = element.getBoundingClientRect ();
        const childBounds   = Array.from ( element.querySelectorAll ( selector ) )
            .map ( child => child.getBoundingClientRect () );
        const rightmostEdge = Math.max ( ...childBounds.map ( child => child.right ) );
        const lastEdge      = Math.max ( ...childBounds.map ( child => child.bottom ) );
        const pageElement   = element.closest ( ".detail-page-content" );
        const pageBounds    = pageElement?.getBoundingClientRect ();

        return {
            right: bounds.left + element.clientLeft + element.clientWidth - rightmostEdge,
            bottom: bounds.top + element.clientTop + element.clientHeight - lastEdge,
            horizontalOverflow: element.scrollWidth - element.clientWidth,
            verticalOverflow: element.scrollHeight - element.clientHeight,
            pageRight: pageBounds === undefined || pageElement === null
                ? null
                : pageBounds.left + pageElement.clientLeft + pageElement.clientWidth - rightmostEdge,
        };
    }, childSelector );
}

async function expectVisibleActions ( page: Page ): Promise<void>
{
    await expect.poll ( () => page.locator ( ".detail-page-content" ).evaluate ( element =>
    {
        const bounds = element.getBoundingClientRect ();
        const failures: string[] = [];
        const actions = Array.from ( element.querySelectorAll (
            ".detail-button-panel, .solver-page-command-bar, .list-command-bar",
        ) ).filter ( action => action.getClientRects ().length > 0 );

        if ( actions.length === 0 )
        {
            failures.push ( "No visible action panel" );
        }
        for ( const action of actions )
        {
            const rectangle = action.getBoundingClientRect ();

            if ( rectangle.top < bounds.top - 1 || rectangle.bottom > bounds.bottom + 1 ||
                rectangle.bottom > window.innerHeight + 1 )
            {
                failures.push ( `Action panel outside the page: ${action.className}` );
            }
            let ancestor = action.parentElement;

            while ( ancestor !== null && element.contains ( ancestor ) )
            {
                if ( /auto|scroll/.test ( getComputedStyle ( ancestor ).overflowY ) &&
                    ancestor.scrollHeight > ancestor.clientHeight + 1 )
                {
                    failures.push ( `Action panel has a vertically scrolling ancestor: ${ancestor.className} (${ancestor.scrollHeight - ancestor.clientHeight}px)` );
                }
                ancestor = ancestor.parentElement;
            }
        }
        return failures;
    } ) ).toEqual ( [] );
}

async function pullExample ( page: Page ): Promise<void>
{
    await page.goto ( "./" );
    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
}

for ( const values of [
    { pageInset: 8, scrollInset: 4, groupRight: 4, groupBottom: 0 },
    { pageInset: 4, scrollInset: 8, groupRight: 7, groupBottom: 5 },
] )
{
    const label = `page ${values.pageInset}px and scroll ${values.scrollInset}px`;

    test ( `Editor dashboard keeps one shared right inset with ${label}`, async ( { page } ) =>
    {
        await page.setViewportSize ( { width: 1440, height: 1600 } );
        await pullExample ( page );
        await page.getByRole ( "treeitem", { name: "Editor", exact: true } ).click ();
        await setInsets ( page, values.pageInset, values.scrollInset );

        // Group borders have an explicitly additional margin outside the shared edge inset.

        await page.locator ( ".application-shell" ).evaluate ( ( element, spacing ) =>
        {
            const style = ( element as HTMLElement ).style;
            style.setProperty ( "--group-box-outer-spacing-right", `${spacing.groupRight}px` );
            style.setProperty ( "--group-box-outer-spacing-bottom", `${spacing.groupBottom}px` );
        }, values );

        const dashboard = page.locator ( ".editor-dashboard" );
        const shortContent = await readTrailingClearance ( dashboard, ":scope > fieldset" );

        expect ( shortContent.horizontalOverflow ).toBeLessThanOrEqual ( 1 );
        expect ( shortContent.verticalOverflow ).toBeLessThanOrEqual ( 1 );
        expect ( shortContent.right ).toBeCloseTo ( values.pageInset + values.groupRight, 0 );
        expect ( shortContent.pageRight ).toBeCloseTo ( values.pageInset + values.groupRight, 0 );
        expect ( shortContent.bottom ).toBeGreaterThanOrEqual ( values.scrollInset + values.groupBottom - 1 );

        await page.setViewportSize ( { width: 1440, height: 480 } );
        await dashboard.evaluate ( element =>
        {
            const fieldset = element.lastElementChild;

            if ( fieldset === null )
            {
                throw new Error ( "The Editor dashboard has no fieldset to extend." );
            }
            const contentWidth = element.clientWidth + 240;

            for ( let index = 0; index < 12; index++ )
            {
                element.appendChild ( fieldset.cloneNode ( true ) );
            }
            for ( const child of element.children )
            {
                ( child as HTMLElement ).style.minWidth = `${contentWidth}px`;
            }
        } );

        const longContent = await readTrailingClearance ( dashboard, ":scope > fieldset" );

        expect ( longContent.horizontalOverflow ).toBeGreaterThan ( 100 );
        expect ( longContent.verticalOverflow ).toBeGreaterThan ( 100 );
        expect ( longContent.right ).toBeCloseTo ( values.pageInset + values.groupRight, 0 );
        expect ( longContent.bottom ).toBeCloseTo ( values.scrollInset + values.groupBottom, 0 );
        await expectVisibleActions ( page );
    } );

    test ( `Solver transfers shared edges to its actual candidate scroll owner with ${label}`, async ( { page } ) =>
    {
        await page.setViewportSize ( { width: 1440, height: 1100 } );
        await page.goto ( "./" );
        await page.locator ( "[data-toolbar-entry='toolbar-new']" ).click ();
        await page.getByRole ( "treeitem", { name: "Solver", exact: true } ).click ();
        await page.getByRole ( "textbox", { name: "Sequence", exact: true } )
            .fill ( "event-start\naction-ready\nevent-stop\naction-finished" );
        await page.getByRole ( "button", { name: "Solve", exact: true } ).click ();
        await expect ( page.getByRole ( "heading", { name: "Candidate Review" } ) ).toBeVisible ();
        await setInsets ( page, values.pageInset, values.scrollInset );

        for ( const candidateView of [
            { tab: "Summary", nested: false, table: false },
            { tab: "States and Actions", nested: true, table: true },
            { tab: "Transition Table", nested: true, table: true },
            { tab: "Comparison", nested: false, table: true },
        ] )
        {
            await page.setViewportSize ( { width: 1440, height: 1100 } );
            await page.locator ( ".solver-candidate-review" )
                .getByRole ( "tab", { name: candidateView.tab, exact: true } ).click ();
            const owner = page.locator ( candidateView.nested
                ? ".solver-review-scroll"
                : ".solver-candidate-review .tab-panel" );
            const childSelector = candidateView.table ? ":scope > table" : ":scope > .solver-summary-grid";
            const rightInset    = candidateView.table ? 0 : values.pageInset;
            const shortContent  = await readTrailingClearance ( owner, childSelector );

            await expect ( owner ).toHaveCSS ( "padding-right", `${rightInset}px` );
            await expect ( owner ).toHaveCSS ( "scroll-padding-right", `${rightInset}px` );
            await expect ( owner ).toHaveCSS ( "padding-bottom", `${values.pageInset}px` );
            expect ( shortContent.horizontalOverflow, candidateView.tab ).toBeLessThanOrEqual ( 1 );
            expect ( shortContent.verticalOverflow, candidateView.tab ).toBeLessThanOrEqual ( 1 );
            expect ( shortContent.right, candidateView.tab ).toBeCloseTo ( rightInset, 0 );
            expect ( shortContent.pageRight, candidateView.tab ).toBeCloseTo ( rightInset, 0 );
            expect ( shortContent.bottom, candidateView.tab ).toBeGreaterThanOrEqual ( values.pageInset - 1 );

            await page.setViewportSize ( { width: 1440, height: 480 } );
            await owner.evaluate ( ( element, isTable ) =>
            {
                const content = element.firstElementChild;

                if ( !( content instanceof HTMLElement ) )
                {
                    throw new Error ( "The candidate scroll owner has no content." );
                }
                const parent = content.querySelector ( isTable ? "tbody" : "dl" );
                const row    = parent?.lastElementChild;

                if ( parent === null || row === null || row === undefined )
                {
                    throw new Error ( "The candidate content has no row to extend." );
                }

                content.style.minWidth = `${element.clientWidth + 240}px`;
                for ( let index = 0; index < 60; index++ )
                {
                    parent.appendChild ( row.cloneNode ( true ) );
                }
            }, candidateView.table );

            const longContent = await readTrailingClearance ( owner, childSelector );

            expect ( longContent.horizontalOverflow, candidateView.tab ).toBeGreaterThan ( 100 );
            expect ( longContent.verticalOverflow, candidateView.tab ).toBeGreaterThan ( 100 );
            expect ( longContent.right, candidateView.tab ).toBeCloseTo ( rightInset, 0 );
            expect ( longContent.bottom, candidateView.tab ).toBeCloseTo ( values.pageInset, 0 );
            await expectVisibleActions ( page );
        }
    } );
    test ( `Chart footer and Palette keep their separate edge owners with ${label}`, async ( { page } ) =>
    {
        await page.setViewportSize ( { width: 1440, height: 1100 } );
        await pullExample ( page );
        await page.getByRole ( "treeitem", { name: "Chart", exact: true } ).click ();
        await setInsets ( page, values.pageInset, values.scrollInset );

        const footer  = page.locator ( ".chart-footer" );
        const palette = page.locator ( ".chart-palette" );
        const shortFooter = await readTrailingClearance ( footer, ":scope > .chart-command-panel" );
        const shortPalette = await readTrailingClearance ( palette, ":scope > button" );

        expect ( shortFooter.horizontalOverflow ).toBeLessThanOrEqual ( 1 );
        expect ( shortFooter.right ).toBeCloseTo ( values.pageInset, 0 );
        expect ( shortFooter.bottom ).toBeCloseTo ( values.pageInset, 0 );
        expect ( shortFooter.pageRight ).toBeCloseTo ( values.pageInset, 0 );
        expect ( shortPalette.verticalOverflow ).toBeLessThanOrEqual ( 1 );
        expect ( shortPalette.right ).toBeCloseTo ( values.scrollInset, 0 );
        expect ( shortPalette.bottom ).toBeGreaterThanOrEqual ( values.scrollInset - 1 );

        const commandPanel = page.locator ( ".chart-command-panel" );
        const originalMinimumWidth = await commandPanel.evaluate ( element =>
        {
            const panel = element as HTMLElement;
            const previousValue = panel.style.minWidth;

            panel.style.minWidth = "600px";
            return previousValue;
        } );
        await page.setViewportSize ( { width: 320, height: 600 } );
        const narrowFooter = await readTrailingClearance ( footer, ":scope > .chart-command-panel" );

        expect ( narrowFooter.horizontalOverflow ).toBeGreaterThan ( 1 );
        expect ( narrowFooter.right ).toBeCloseTo ( values.pageInset, 0 );
        expect ( narrowFooter.bottom ).toBeCloseTo ( values.pageInset, 0 );
        await expectVisibleActions ( page );
        await commandPanel.evaluate ( ( element, previousValue ) =>
        {
            ( element as HTMLElement ).style.minWidth = previousValue;
        }, originalMinimumWidth );

        await page.setViewportSize ( { width: 1440, height: 480 } );
        const shortHeightPalette = await readTrailingClearance ( palette, ":scope > button" );

        expect ( shortHeightPalette.verticalOverflow ).toBeGreaterThan ( 20 );
        expect ( shortHeightPalette.right ).toBeCloseTo ( values.scrollInset, 0 );
        expect ( shortHeightPalette.bottom ).toBeCloseTo ( values.scrollInset, 0 );
        await expectVisibleActions ( page );
    } );
}

for ( const viewportWidth of [ 1440, 320 ] )
{
    test ( `status text and trailing clearance remain visible at ${viewportWidth}px`, async ( { page }, testInfo ) =>
    {
        await pullExample ( page );
        await page.setViewportSize ( { width: viewportWidth, height: 600 } );
        await page.addStyleTag ( { content:
            ".status-bar { overflow-x: scroll; scrollbar-width: auto; } " +
            ".status-bar::-webkit-scrollbar { width: 16px; height: 16px; }",
        } );

        await page.locator ( ".status-bar" ).evaluate ( element =>
        {
            const segment = document.createElement ( "span" );

            segment.textContent = "Extended connection status ".repeat ( 30 );
            element.appendChild ( segment );
        } );

        for ( const inset of [ 4, 8 ] )
        {
            await setInsets ( page, 12, inset );
            const geometry = await page.locator ( ".status-bar" ).evaluate ( element =>
            {
                element.scrollLeft = element.scrollWidth;
                const bounds = element.getBoundingClientRect ();
                const innerTop = bounds.top + element.clientTop;
                const innerBottom = innerTop + element.clientHeight;
                const textBounds = Array.from ( element.children ).map ( child =>
                {
                    const range = document.createRange ();

                    range.selectNodeContents ( child );
                    const rectangle = range.getBoundingClientRect ();

                    return { top: rectangle.top - innerTop, bottom: innerBottom - rectangle.bottom };
                } );
                const lastChild = element.lastElementChild;

                if ( lastChild === null )
                {
                    throw new Error ( "The status bar has no status segments." );
                }
                const lastBounds = lastChild.getBoundingClientRect ();

                return {
                    textBounds,
                    horizontalScrollbar: element.getBoundingClientRect ().height - element.clientHeight - element.clientTop,
                    right: bounds.left + element.clientLeft + element.clientWidth - lastBounds.right,
                    bottom: innerBottom - lastBounds.bottom,
                    viewportBottom: window.innerHeight - bounds.bottom,
                    horizontalOverflow: element.scrollWidth - element.clientWidth,
                    verticalOverflow: element.scrollHeight - element.clientHeight,
                };
            } );

            if ( inset === 4 )
            {
                testInfo.annotations.push (
                {
                    type: "scrollbar geometry",
                    description: geometry.horizontalScrollbar > 0
                        ? `Classic horizontal scrollbar occupies ${geometry.horizontalScrollbar}px.`
                        : "The browser uses an overlay or hidden scrollbar with no measured layout gutter.",
                } );
            }
            expect ( geometry.horizontalOverflow ).toBeGreaterThan ( 100 );
            expect ( geometry.verticalOverflow ).toBeLessThanOrEqual ( 1 );
            expect ( geometry.viewportBottom ).toBeGreaterThanOrEqual ( -1 );
            expect ( geometry.right ).toBeCloseTo ( inset, 0 );
            expect ( geometry.bottom ).toBeGreaterThanOrEqual ( inset - 1 );
            for ( const textBounds of geometry.textBounds )
            {
                expect ( textBounds.top ).toBeGreaterThanOrEqual ( -1 );
                expect ( textBounds.bottom ).toBeGreaterThanOrEqual ( inset - 1 );
            }
        }
    } );
}
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Detail Page Spacing Tests
// Version: 1.0.0
// Date:    2026-09-12
// Author:  Rohin Gosling
//
// Description:
//
//   Checks shared outer insets across routes, empty states, and responsive layouts.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import { openEditorNode } from "./tree-helpers.js";

for ( const viewportWidth of [ 1440, 900, 320 ] )
{
    test ( `detail content owns its outer inset at ${viewportWidth} CSS pixels`, async ( { page } ) =>
    {
        await page.setViewportSize ( { width: viewportWidth, height: 900 } );
        await page.goto ( "./" );

        if ( viewportWidth === 900 )
        {
            await page.emulateMedia ( { forcedColors: "active" } );
        }

        for ( const hasDocument of [ false, true ] )
        {
            if ( hasDocument )
            {
                await page.setViewportSize ( { width: 1440, height: 900 } );
                await page.locator ( "[data-toolbar-entry='toolbar-new']" ).click ();
                await expect ( page.locator ( ".initialization-form" ) ).toBeVisible ();
                await page.setViewportSize ( { width: viewportWidth, height: 900 } );
            }

            for ( const routeName of [ "Editor", "State Machine", "States", "Events", "Actions",
                "Transition Table", "Chart", "Solver", "Simulator" ] )
            {
                if ( viewportWidth < 1280 )
                {
                    await page.getByRole ( "button", { name: "Model", exact: true } ).click ();
                }

                await openEditorNode ( page );
                await page.getByRole ( "treeitem", { name: routeName, exact: true } ).click ();
                await expect ( page.locator ( ".detail-page-content" ) ).toBeVisible ();

                // Unequal scroll and page tokens catch accidental addition or precedence changes.

                for ( const inset of [ 4, 8 ] )
                {
                    await page.locator ( ".application-shell" ).evaluate ( ( element, value ) =>
                    {
                        ( element as HTMLElement ).style.setProperty ( "--detail-page-content-inset", `${value}px` );
                        ( element as HTMLElement ).style.setProperty ( "--scroll-content-edge-inset", "12px" );
                    }, inset );

                    const geometry = await page.locator ( ".detail-page-content" ).evaluate ( element =>
                    {
                        const style = getComputedStyle ( element );
                        const bounds = element.getBoundingClientRect ();
                        const child = element.querySelector ( ":scope > :not(.visually-hidden):not(.modal-dialog)" )!;
                        const childBounds = child.getBoundingClientRect ();
                        const childStyle = getComputedStyle ( child );

                        return {
                            padding: [ style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft ],
                            left: childBounds.left - bounds.left,
                            top: childBounds.top - bounds.top,
                            right: bounds.left + element.clientWidth - childBounds.right,
                            margin: [ childStyle.marginTop, childStyle.marginRight,
                                childStyle.marginBottom, childStyle.marginLeft ],
                            documentWidth: document.documentElement.scrollWidth,
                            viewportWidth: window.innerWidth,
                        };
                    } );

                    expect ( geometry.padding, routeName ).toEqual ( Array ( 4 ).fill ( `${inset}px` ) );
                    expect ( geometry.left, routeName ).toBeCloseTo ( inset, 1 );
                    expect ( geometry.top, routeName ).toBeCloseTo ( inset, 1 );
                    expect ( geometry.right, routeName ).toBeCloseTo ( inset, 1 );
                    expect ( geometry.margin, routeName ).toEqual ( [ "0px", "0px", "0px", "0px" ] );
                    expect ( geometry.documentWidth, routeName ).toBeLessThanOrEqual ( geometry.viewportWidth );
                }
            }
        }
    } );
}

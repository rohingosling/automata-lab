// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Palette Icon Sizing Browser Tests
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies enlarged palette glyphs fit their controls, leave unrelated icons unchanged, and supply
//   native drag bitmaps at the rendered size with matching cursor hotspots.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

//--------------------------------------------------------------------------------------------------
// Function: openEmptyChart
//
// Description:
//
//   Creates an empty authoring chart so all four palette placement controls are available.
//
//--------------------------------------------------------------------------------------------------

async function openEmptyChart ( page: Page ): Promise<void>
{
    await page.getByRole ( "button", { name: "New", exact: true } ).click ();
    await page.getByRole ( "treeitem", { name: "Chart", exact: true } ).click ();
    await expect ( page.getByRole ( "complementary", { name: "Palette" } ) ).toBeVisible ();
}

test.beforeEach ( async ( { page } ) =>
{
    await page.goto ( "./" );
} );

test ( "Enlarged palette glyphs fit desktop and narrow controls without resizing toolbar or menu icons", async ( { page } ) =>
{
    await openEmptyChart ( page );
    const palette = page.getByRole ( "complementary", { name: "Palette" } );
    const toolbarIcon = page.locator ( "[data-toolbar-entry='toolbar-new'] .command-icon" );

    for ( const viewportWidth of [ 1440, 720 ] )
    {
        await page.setViewportSize ( { width: viewportWidth, height: 900 } );

        for ( const label of [ "State", "Initial Indicator", "Terminal Indicator", "Transition" ] )
        {
            const button = palette.getByRole ( "button", { name: label, exact: true } );
            const icon = button.locator ( ".command-icon" );

            await expect ( icon ).toHaveCSS ( "width", "32px" );
            await expect ( icon ).toHaveCSS ( "height", "32px" );
            await expect ( icon ).toBeVisible ();
            const bounds = await button.evaluate ( element =>
            {
                const buttonBounds = element.getBoundingClientRect ();
                const iconBounds = element.querySelector ( "img" )!.getBoundingClientRect ();

                return {
                    left: iconBounds.left - buttonBounds.left,
                    top: iconBounds.top - buttonBounds.top,
                    right: buttonBounds.right - iconBounds.right,
                    bottom: buttonBounds.bottom - iconBounds.bottom,
                };
            } );

            expect ( Math.min ( bounds.left, bounds.top, bounds.right, bounds.bottom ) ).toBeGreaterThanOrEqual ( 0 );
        }

        await expect ( toolbarIcon ).toHaveCSS ( "width", "20px" );
        await expect ( toolbarIcon ).toHaveCSS ( "height", "20px" );
    }

    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    const menuIcon = page.getByRole ( "menuitem", { name: "New", exact: true } ).locator ( ".command-icon" );

    await expect ( menuIcon ).toHaveCSS ( "width", "16px" );
    await expect ( menuIcon ).toHaveCSS ( "height", "16px" );
} );

test ( "Native palette drag bitmaps follow the enlarged glyph size and centered hotspot", async ( { browserName, page } ) =>
{
    test.skip ( browserName === "webkit", "Native palette drag feedback is covered in Windows Chromium and Firefox." );
    await page.evaluate ( () =>
    {
        const testWindow = window as typeof window & {
            palettePreparedImageCount: number;
            paletteDragDimensions: readonly number[] | null;
        };
        const decode = HTMLImageElement.prototype.decode;
        const setDragImage = DataTransfer.prototype.setDragImage;

        testWindow.palettePreparedImageCount = 0;
        testWindow.paletteDragDimensions = null;
        HTMLImageElement.prototype.decode = async function ()
        {
            await decode.call ( this );

            if ( this.src.startsWith ( "data:image/png" ) )
            {
                testWindow.palettePreparedImageCount += 1;
            }
        };
        DataTransfer.prototype.setDragImage = function ( element, horizontalOffset, verticalOffset )
        {
            const image = element as HTMLImageElement;

            testWindow.paletteDragDimensions = [ image.naturalWidth, image.naturalHeight,
                horizontalOffset, verticalOffset ];
            setDragImage.call ( this, element, horizontalOffset, verticalOffset );
        };
    } );
    await openEmptyChart ( page );
    await page.waitForFunction ( () =>
        ( window as typeof window & { palettePreparedImageCount: number } ).palettePreparedImageCount >= 4 );
    await page.getByRole ( "complementary", { name: "Palette" } )
        .getByRole ( "button", { name: "State", exact: true } )
        .dragTo ( page.locator ( ".chart-canvas" ), { targetPosition: { x: 200, y: 200 } } );

    const dimensions = await page.evaluate ( () =>
        ( window as typeof window & { paletteDragDimensions: readonly number[] | null } ).paletteDragDimensions );

    expect ( dimensions ).toEqual ( [ 32, 32, 16, 16 ] );
    await expect ( page.locator ( "[data-chart-state='state_1']" ) ).toBeVisible ();
} );

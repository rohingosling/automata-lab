// Checks modal edge ownership independently of page and scrolling settings.

import { expect, test } from "@playwright/test";

for ( const viewportWidth of [ 1440, 320 ] )
{
    test ( `modal boundaries use their own inset at ${viewportWidth} CSS pixels`, async ( { page } ) =>
    {
        await page.setViewportSize ( { width: viewportWidth, height: 900 } );
        await page.goto ( "./" );

        for ( const menuEntry of [ "Settings", "Page Setup", "About Automata Lab" ] )
        {
            const menuName = menuEntry === "About Automata Lab" ? "Help" : "File";
            await page.getByRole ( "menuitem", { name: menuName, exact: true } ).click ();
            await page.getByRole ( "menuitem", { name: menuEntry, exact: true } ).click ();
            const dialog = page.locator ( "dialog[open]" );
            await expect ( dialog ).toBeVisible ();

            for ( const inset of [ 4, 8 ] )
            {
                await dialog.evaluate ( ( element, value ) =>
                {
                    ( element as HTMLElement ).style.setProperty ( "--modal-content-inset", `${value}px` );
                    ( element as HTMLElement ).style.setProperty ( "--detail-page-content-inset", "16px" );
                    ( element as HTMLElement ).style.setProperty ( "--scroll-content-edge-inset", "12px" );
                }, inset );

                for ( const selector of [ ".dialog-content", ".dialog-footer" ] )
                {
                    const padding = await dialog.locator ( selector ).evaluate ( element =>
                    {
                        const style = getComputedStyle ( element );
                        return [ style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft ];
                    } );
                    expect ( padding ).toEqual ( Array ( 4 ).fill ( `${inset}px` ) );
                }

                const footerGeometry = await dialog.locator ( ".dialog-footer" ).evaluate ( element =>
                {
                    const bounds = element.getBoundingClientRect ();
                    const button = element.querySelector ( "button:last-child" )!.getBoundingClientRect ();
                    return { right: bounds.right - button.right, bottom: bounds.bottom - button.bottom };
                } );
                expect ( footerGeometry.right ).toBeCloseTo ( inset, 1 );
                expect ( footerGeometry.bottom ).toBeCloseTo ( inset, 1 );

                await expect ( dialog.locator ( ".dialog-content > :first-child" ) )
                    .toHaveCSS ( "margin-top", "0px" );
                await expect ( dialog.locator ( ".dialog-content > :last-child" ) )
                    .toHaveCSS ( "margin-bottom", "0px" );
                await expect ( dialog.locator ( ".dialog-footer" ) ).toHaveCSS ( "gap", "6px" );
            }

            await page.keyboard.press ( "Escape" );
            await expect ( dialog ).toHaveCount ( 0 );
        }
    } );
}
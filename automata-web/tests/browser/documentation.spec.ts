// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Documentation Browser Tests
// Version: 1.0.0
// Date:    2026-08-26
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies final-subpath documentation navigation, local search, accessibility, responsive
//   behavior, strict CSP operation, and the same-origin runtime boundary.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";


test ( "Help opens the final User Guide from the combined production artifact", async ( { page } ) =>
{
    await page.goto ( "./" );

    const documentationPagePromise = page.waitForEvent ( "popup" );

    await page.getByRole ( "menuitem", { name: "Help", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Documentation", exact: true } ).click ();

    const documentationPage = await documentationPagePromise;

    await documentationPage.waitForLoadState ( "domcontentloaded" );
    await expect ( documentationPage ).toHaveURL (
        "http://127.0.0.1:4187/automata-lab/docs/user-guide/",
    );
    await expect ( documentationPage.getByRole ( "heading", { level: 1, name: /^Introduction/ } ) )
        .toBeVisible ();
    expect ( await documentationPage.evaluate ( () => window.opener ) ).toBeNull ();

    await documentationPage.close ();
} );

test ( "Phase 10 serves direct and reloaded guide routes with local runtime assets", async ( { page } ) =>
{
    const failedRequests: string[] = [];
    const pageErrors:     string[] = [];
    const runtimeUrls:    string[] = [];

    page.on ( "pageerror", error => pageErrors.push ( error.message ) );
    page.on ( "request", request => runtimeUrls.push ( request.url () ) );
    page.on ( "requestfailed", request =>
    {
        const errorText = request.failure ()?.errorText ?? "unknown failure";
        const expectedCancellation = [
            "Load request cancelled",
            "NS_BINDING_ABORTED",
            "net::ERR_ABORTED",
        ].includes ( errorText );

        if ( !expectedCancellation )
        {
            failedRequests.push ( `${ request.method () } ${ request.url () }: ${ errorText }` );
        }
    } );

    await page.goto ( "./docs/" );

    await expect ( page.getByRole ( "heading", { name: "Automata Lab Overview" } ) ).toBeVisible ();
    await expect ( page.getByRole ( "link", { name: "Application", exact: true } ) )
        .toHaveAttribute ( "href", "/automata-lab/" );

    await page.getByRole ( "link", { name: "Read the User Guide" } ).click ();
    await expect ( page.getByRole ( "heading", { name: "User Guide" } ) ).toBeVisible ();

    await page.goto ( "./docs/developer-guide/testing" );
    await expect ( page.getByRole ( "heading", { name: "Testing" } ) ).toBeVisible ();
    await page.reload ();
    await expect ( page.getByRole ( "heading", { name: "Testing" } ) ).toBeVisible ();

    const runtimeOrigin = new URL ( page.url () ).origin;

    expect ( runtimeUrls.length ).toBeGreaterThan ( 0 );
    expect ( runtimeUrls.every ( runtimeUrl => new URL ( runtimeUrl ).origin === runtimeOrigin ) ).toBe ( true );
    expect ( failedRequests ).toEqual ( [] );
    expect ( pageErrors ).toEqual ( [] );
} );

test ( "Phase 10 local search, keyboard access, CSP, reflow, and automated accessibility pass", async ( { page } ) =>
{
    await page.goto ( "./docs/" );

    await page.getByRole ( "button", { name: "Search" } ).click ();

    const searchInput = page.locator ( "#localsearch-input" );

    await expect ( searchInput ).toBeFocused ();
    await searchInput.fill ( "pinned session" );
    await expect ( page.locator ( ".VPLocalSearchBox" ) ).toContainText ( "Pinned Sessions" );
    await page.keyboard.press ( "Escape" );
    await expect ( searchInput ).not.toBeVisible ();

    const securityPolicy = await page.locator ( "meta[http-equiv='Content-Security-Policy']" )
        .getAttribute ( "content" );
    const scriptDirective = securityPolicy?.split ( ";" )
        .map ( directive => directive.trim () )
        .find ( directive => directive.startsWith ( "script-src " ) );

    expect ( scriptDirective ).toContain ( "script-src 'self' 'sha256-" );
    expect ( scriptDirective ).not.toContain ( "'unsafe-inline'" );
    expect ( scriptDirective ).not.toContain ( "'unsafe-eval'" );

    const accessibilityResult = await new AxeBuilder ( { page } ).analyze ();

    expect ( accessibilityResult.violations ).toEqual ( [] );
    await page.setViewportSize ( { height: 800, width: 640 } );
    await page.emulateMedia ( { forcedColors: "active", reducedMotion: "reduce" } );
    await page.evaluate ( () =>
    {
        document.documentElement.style.zoom = "2";
    } );

    await expect ( page.getByRole ( "button", { name: "mobile navigation" } ) ).toBeVisible ();
    await expect ( page.getByRole ( "heading", { name: "Automata Lab Overview" } ) ).toBeVisible ();

    await page.evaluate ( () =>
    {
        document.documentElement.style.zoom = "1";
    } );

} );

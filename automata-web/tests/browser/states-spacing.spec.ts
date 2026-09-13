import { expect, test } from "@playwright/test";
import { openEditorNode } from "./tree-helpers.js";

for ( const viewport of [ { width: 1440, height: 900 }, { width: 1440, height: 600 },
    { width: 320, height: 900 } ] )
{
    test ( `States keeps footers visible at ${viewport.width} by ${viewport.height}`, async ( { page } ) =>
    {
        await page.setViewportSize ( { width: 1440, height: viewport.height } );
        await page.goto ( "./" );
        await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
        await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
        await page.setViewportSize ( viewport );
        if ( viewport.width < 1280 )
        {
            await page.getByRole ( "button", { name: "Model", exact: true } ).click ();
        }
        await openEditorNode ( page );
        await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();

        for ( const tabName of [ "Entry Actions", "Exit Actions" ] )
        {
            await page.getByRole ( "tab", { name: tabName, exact: true } ).click ();
            for ( const longContent of [ false, true ] )
            {
                if ( longContent )
                {
                    // Stress the rendered lists without adding model or worker dependencies.
                    await page.locator ( ".states-editor .entity-list, .states-editor .data-grid" )
                        .evaluateAll ( elements =>
                        {
                            for ( const element of elements )
                            {
                                const row = element.lastElementChild!;
                                for ( let i = 0; i < 100; i++ )
                                {
                                    element.appendChild ( row.cloneNode ( true ) );
                                }
                            }
                        } );
                }
                const geometry = await page.locator ( ".states-editor" ).evaluate ( element =>
                {
                    const page = element.parentElement!;
                    const footerBounds = Array.from ( element.querySelectorAll ( ".detail-button-panel" ) )
                        .map ( footer => footer.getBoundingClientRect () );
                    const regions = [ page, element, ...element.querySelectorAll (
                        ".state-association-pane, .tabs, .tab-panel, .state-actions-pane",
                    ) ];
                    return {
                        overflow: regions.map ( region => region.scrollHeight - region.clientHeight ),
                        footerBottoms: footerBounds.map ( bounds => bounds.bottom ),
                        footerTops: footerBounds.map ( bounds => bounds.top ),
                        pageBottom: page.getBoundingClientRect ().bottom,
                    };
                } );
                expect ( Math.max ( ...geometry.overflow ) ).toBeLessThanOrEqual ( 1 );
                expect ( Math.max ( ...geometry.footerBottoms ) ).toBeLessThanOrEqual ( geometry.pageBottom );
                if ( viewport.width >= 768 )
                {
                    expect ( geometry.footerTops [ 0 ] ).toBeCloseTo ( geometry.footerTops [ 1 ]!, 1 );
                    expect ( geometry.footerBottoms [ 0 ] ).toBeCloseTo ( geometry.footerBottoms [ 1 ]!, 1 );
                }
            }
        }
    } );
}
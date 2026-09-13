// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Modal Variant Spacing Tests
// Version: 1.0.0
// Date:    2026-09-13
// Author:  Rohin Gosling
//
// Description:
//
//   Exercises editor and confirmation modal spacing under short-window content pressure.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

import { openEditorNode } from "./tree-helpers.js";

// Keep footer actions inside the viewport and outside all vertical content scroll regions.

async function expectVisibleModalFooter ( dialog: Locator, inset: number ): Promise<void>
{
    await expect.poll ( () => dialog.evaluate ( element =>
    {
        const footer         = element.querySelector ( ".dialog-footer" )!;
        const footerBounds   = footer.getBoundingClientRect ();
        const dialogBounds   = element.getBoundingClientRect ();
        const content        = element.querySelector ( ".dialog-content" )!;
        const violations: string[] = [];

        if ( footerBounds.top < 0 || footerBounds.bottom > window.innerHeight + 1 ||
            footerBounds.left < 0 || footerBounds.right > window.innerWidth + 1 )
        {
            violations.push ( "Footer extends outside the viewport" );
        }
        if ( footerBounds.bottom > dialogBounds.bottom + 1 )
        {
            violations.push ( "Footer extends outside its dialog" );
        }
        if ( element.scrollWidth > element.clientWidth + 1 ||
            content.scrollWidth > content.clientWidth + 1 )
        {
            violations.push ( "Dialog or body has unintended horizontal overflow" );
        }
        for ( const button of footer.querySelectorAll ( "button" ) )
        {
            const buttonBounds = button.getBoundingClientRect ();
            if ( buttonBounds.left < footerBounds.left || buttonBounds.right > footerBounds.right ||
                buttonBounds.top < footerBounds.top || buttonBounds.bottom > footerBounds.bottom )
            {
                violations.push ( "Footer button extends outside its action bar" );
            }
        }
        let ancestor = footer.parentElement;
        while ( ancestor !== null && element.contains ( ancestor ) )
        {
            if ( /auto|scroll/.test ( getComputedStyle ( ancestor ).overflowY ) &&
                ancestor.scrollHeight > ancestor.clientHeight + 1 )
            {
                violations.push ( `Footer is inside a vertical scroller: ${ancestor.className}` );
            }
            ancestor = ancestor.parentElement;
        }
        return violations;
    } ) ).toEqual ( [] );

    for ( const selector of [ ".dialog-content", ".dialog-footer" ] )
    {
        const padding = await dialog.locator ( selector ).evaluate ( element =>
        {
            const style = getComputedStyle ( element );
            return [ style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft ];
        } );
        expect ( padding ).toEqual ( Array ( 4 ).fill ( `${inset}px` ) );
    }

    const footerInsets = await dialog.locator ( ".dialog-footer" ).evaluate ( element =>
    {
        const footerBounds = element.getBoundingClientRect ();
        const buttonBounds = element.querySelector ( "button:last-child" )!.getBoundingClientRect ();
        return { right: footerBounds.right - buttonBounds.right, bottom: footerBounds.bottom - buttonBounds.bottom };
    } );
    expect ( footerInsets.right ).toBeCloseTo ( inset, 1 );
    expect ( footerInsets.bottom ).toBeCloseTo ( inset, 1 );
}

for ( const viewportWidth of [ 1440, 320 ] )
{
    test ( `editor and long confirmation preserve modal spacing at ${viewportWidth} by 360`, async ( { page } ) =>
    {
        await page.goto ( "./" );
        await page.locator ( "[data-toolbar-entry='toolbar-new']" ).click ();
        await openEditorNode ( page );
        await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();
        const statePane = page.locator ( ".states-list-pane" );
        await statePane.getByRole ( "button", { name: "Add", exact: true } ).click ();

        const editorDialog = page.getByRole ( "dialog", { name: "Named entity" } );
        await expect ( editorDialog ).toBeVisible ();
        await editorDialog.locator ( "#entity-name" ).fill ( "state_modal_spacing" );
        const description = editorDialog.locator ( "#entity-description" );
        await description.fill ( Array ( 60 ).fill ( "A description line for native scrolling." ).join ( "\n" ) );
        await page.setViewportSize ( { width: viewportWidth, height: 360 } );

        for ( const modalInset of [ 4, 8 ] )
        {
            const scrollInset = modalInset === 4 ? 4 : 12;
            await editorDialog.evaluate ( ( element, spacing ) =>
            {
                const dialog = element as HTMLElement;
                dialog.style.setProperty ( "--modal-content-inset", `${spacing.modalInset}px` );
                dialog.style.setProperty ( "--scroll-content-edge-inset", `${spacing.scrollInset}px` );
                dialog.style.setProperty ( "--detail-page-content-inset", "16px" );
            }, { modalInset, scrollInset } );
            await expectVisibleModalFooter ( editorDialog, modalInset );
            await expect ( description ).toHaveCSS ( "padding-right", `${scrollInset}px` );
            await expect ( description ).toHaveCSS ( "padding-bottom", `${scrollInset}px` );
            expect ( await description.evaluate ( element => element.scrollHeight - element.clientHeight ) )
                .toBeGreaterThan ( 1 );
        }

        await editorDialog.getByRole ( "button", { name: "Confirm", exact: true } ).click ();
        await expect ( editorDialog ).toBeHidden ();
        await page.setViewportSize ( { width: 1440, height: 900 } );
        await statePane.getByRole ( "button", { name: "Delete", exact: true } ).click ();
        const confirmationDialog = page.locator ( "dialog[open]:has(#impact-dialog-title)" );
        await expect ( confirmationDialog ).toBeVisible ();
        await expect ( confirmationDialog.getByRole ( "button", { name: "Delete", exact: true } ) )
            .toBeFocused ();

        // Add layout pressure to rendered impact details without changing the draft or action.

        await confirmationDialog.locator ( ".impact-summary" ).evaluate ( element =>
        {
            const row = element.lastElementChild!;
            for ( let index = 0; index < 40; index++ )
            {
                element.appendChild ( row.cloneNode ( true ) );
            }
        } );
        await page.setViewportSize ( { width: viewportWidth, height: 360 } );
        const confirmationContent = confirmationDialog.locator ( ".dialog-content" );

        for ( const modalInset of [ 4, 8 ] )
        {
            await confirmationDialog.evaluate ( ( element, inset ) =>
            {
                const dialog = element as HTMLElement;
                dialog.style.setProperty ( "--modal-content-inset", `${inset}px` );
                dialog.style.setProperty ( "--scroll-content-edge-inset", "12px" );
                dialog.style.setProperty ( "--detail-page-content-inset", "16px" );
            }, modalInset );
            expect ( await confirmationContent.evaluate ( element => element.scrollHeight - element.clientHeight ) )
                .toBeGreaterThan ( 1 );
            await confirmationContent.evaluate ( element =>
            {
                element.scrollTop = 0;
            } );
            await expectVisibleModalFooter ( confirmationDialog, modalInset );
            const footerTop = await confirmationDialog.locator ( ".dialog-footer" ).evaluate (
                element => element.getBoundingClientRect ().top,
            );
            await confirmationContent.evaluate ( element =>
            {
                element.scrollTop = element.scrollHeight;
            } );
            await expectVisibleModalFooter ( confirmationDialog, modalInset );
            expect ( await confirmationDialog.locator ( ".dialog-footer" ).evaluate (
                element => element.getBoundingClientRect ().top,
            ) ).toBeCloseTo ( footerTop, 1 );

            const contentBottomInset = await confirmationContent.evaluate ( element =>
            {
                const scrollportBottom = element.getBoundingClientRect ().top + element.clientHeight;
                return scrollportBottom - element.lastElementChild!.getBoundingClientRect ().bottom;
            } );
            expect ( contentBottomInset ).toBeCloseTo ( modalInset, 1 );
        }

        await confirmationDialog.getByRole ( "button", { name: "Cancel", exact: true } ).click ();
        await expect ( confirmationDialog ).toBeHidden ();
    } );
}

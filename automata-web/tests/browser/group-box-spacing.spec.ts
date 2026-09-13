// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Group Box Spacing Tests
// Version: 1.0.0
// Date:    2026-09-13
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies shared legend typography and independent, additive spacing outside group borders.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";
import { openEditorNode } from "./tree-helpers.js";

// Include native Chromium scrollbar gutters in the narrow group-box fit checks.

test.use ( { launchOptions: { ignoreDefaultArgs: [ "--hide-scrollbars" ] } } );

interface GroupBoxSpacing
{
    readonly top:    number;
    readonly right:  number;
    readonly bottom: number;
    readonly left:   number;
}

interface LegendFont
{
    readonly family: string;
    readonly size:   string;
    readonly weight: string;
}

const DEFAULT_GROUP_SPACING: GroupBoxSpacing = { top: 0, right: 4, bottom: 0, left: 4 };
const UNEQUAL_GROUP_SPACING: GroupBoxSpacing = { top: 3, right: 7, bottom: 5, left: 11 };

async function setGroupSpacing ( shell: Locator, spacing: GroupBoxSpacing ): Promise<void>
{
    await shell.evaluate ( ( element, value ) =>
    {
        for ( const side of [ "top", "right", "bottom", "left" ] as const )
        {
            ( element as HTMLElement ).style.setProperty (
                `--group-box-outer-spacing-${side}`, `${value [ side ]}px`,
            );
        }
    }, spacing );
}

async function readGroupGeometry ( container: Locator )
{
    return container.evaluate ( element =>
    {
        const containerStyle  = getComputedStyle ( element );
        const containerBounds = element.getBoundingClientRect ();
        const contentLeft     = containerBounds.left + element.clientLeft - element.scrollLeft +
            Number.parseFloat ( containerStyle.paddingLeft );
        const contentRight    = containerBounds.left + element.clientLeft - element.scrollLeft +
            element.clientWidth - Number.parseFloat ( containerStyle.paddingRight );
        const contentTop      = containerBounds.top + element.clientTop - element.scrollTop +
            Number.parseFloat ( containerStyle.paddingTop );
        const fieldsets       = Array.from ( element.querySelectorAll ( ":scope > fieldset" ) );

        return {
            gap: containerStyle.rowGap,
            padding: [ containerStyle.paddingTop, containerStyle.paddingRight,
                containerStyle.paddingBottom, containerStyle.paddingLeft ],
            groups: fieldsets.map ( ( fieldset, index ) =>
            {
                const style          = getComputedStyle ( fieldset );
                const bounds         = fieldset.getBoundingClientRect ();
                const legend         = fieldset.querySelector ( ":scope > legend" )!;
                const legendStyle    = getComputedStyle ( legend );
                const previousBounds = fieldsets [ index - 1 ]?.getBoundingClientRect ();
                const contentFonts   = Array.from ( fieldset.querySelectorAll ( "input, select, textarea, dd" ),
                    content =>
                    {
                        const contentStyle = getComputedStyle ( content );
                        return [ contentStyle.fontFamily, contentStyle.fontSize, contentStyle.fontWeight ];
                    } );

                return {
                    title: legend.textContent,
                    horizontalOverflow: fieldset.scrollWidth - fieldset.clientWidth,
                    font: { family: legendStyle.fontFamily, size: legendStyle.fontSize,
                        weight: legendStyle.fontWeight },
                    contentFonts,
                    contentWeight: style.fontWeight,
                    padding: [ style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft ],
                    margin: [ style.marginTop, style.marginRight, style.marginBottom, style.marginLeft ],
                    gap: style.gap,
                    left: bounds.left - contentLeft,
                    right: contentRight - bounds.right,
                    top: bounds.top - contentTop,
                    precedingGap: previousBounds === undefined ? null : bounds.top - previousBounds.bottom,
                };
            } ),
        };
    } );
}

async function expectGroupSpacing (
    shell: Locator,
    container: Locator,
    groupCount: number,
    existingGap: number,
    referenceFont: LegendFont,
): Promise<void>
{
    await expect ( container ).toBeVisible ();
    await expect ( container.locator ( ":scope > fieldset" ) ).toHaveCount ( groupCount );
    await setGroupSpacing ( shell, { top: 0, right: 0, bottom: 0, left: 0 } );
    const baseline = await readGroupGeometry ( container );
    expect ( baseline.gap ).toBe ( `${existingGap}px` );

    for ( const spacing of [ DEFAULT_GROUP_SPACING, UNEQUAL_GROUP_SPACING ] )
    {
        await setGroupSpacing ( shell, spacing );
        const current = await readGroupGeometry ( container );
        expect ( current.gap ).toBe ( baseline.gap );
        expect ( current.padding ).toEqual ( baseline.padding );

        for ( const [ index, group ] of current.groups.entries () )
        {
            const original = baseline.groups [ index ]!;
            const context  = `${group.title}: ${JSON.stringify ( spacing )}`;
            expect ( group.font, context ).toEqual ( referenceFont );
            expect ( group.horizontalOverflow, context ).toBeLessThanOrEqual ( 1 );
            expect ( group.contentWeight, context ).toBe ( "400" );
            expect ( group.contentFonts, context ).toEqual ( original.contentFonts );
            expect ( group.padding, context ).toEqual ( original.padding );
            expect ( group.gap, context ).toBe ( original.gap );
            expect ( group.margin, context ).toEqual (
                [ spacing.top, spacing.right, spacing.bottom, spacing.left ].map ( value => `${value}px` ),
            );
            expect ( group.left - original.left, context ).toBeCloseTo ( spacing.left, 1 );
            expect ( group.right - original.right, context ).toBeCloseTo ( spacing.right, 1 );

            // Compare border-box deltas, avoiding browser differences in legend border placement.

            if ( index === 0 )
            {
                expect ( group.top - original.top, context ).toBeCloseTo ( spacing.top, 1 );
            }
            else
            {
                expect ( group.precedingGap! - original.precedingGap!, context )
                    .toBeCloseTo ( spacing.top + spacing.bottom, 1 );
            }
        }
    }
}

for ( const viewportWidth of [ 1440, 320 ] )
{
    test ( `group boxes share legend fonts and additive outer spacing at ${viewportWidth} CSS pixels`,
        async ( { page } ) =>
    {
        await page.setViewportSize ( { width: 1440, height: 900 } );
        await page.goto ( "./" );
        await page.locator ( "[data-toolbar-entry='toolbar-new']" ).click ();
        const initialization = page.locator ( ".initialization-form" );
        await expect ( initialization ).toBeVisible ();
        await page.setViewportSize ( { width: viewportWidth, height: 900 } );
        const shell = page.locator ( ".application-shell" );

        for ( const side of [ "top", "right", "bottom", "left" ] as const )
        {
            await expect ( shell ).toHaveCSS (
                `--group-box-outer-spacing-${side}`, `${DEFAULT_GROUP_SPACING [ side ]}px`,
            );
        }
        const referenceFont = await initialization.locator ( "legend" ).first ().evaluate ( element =>
        {
            const style = getComputedStyle ( element );
            return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight };
        } );
        expect ( referenceFont.family ).toContain ( "Segoe UI" );
        expect ( referenceFont.size ).toBe ( "13px" );
        expect ( referenceFont.weight ).toBe ( "600" );
        await expect ( initialization.locator ( "input" ).first () ).toHaveCSS ( "font-weight", "400" );

        // Unequal independent tokens expose accidental replacement or addition to existing owners.

        await shell.evaluate ( element =>
        {
            const style = ( element as HTMLElement ).style;
            style.setProperty ( "--detail-page-content-inset", "4px" );
            style.setProperty ( "--modal-content-inset", "8px" );
            style.setProperty ( "--scroll-content-edge-inset", "12px" );
            style.setProperty ( "--splitter-side-gap", "16px" );
        } );
        await expectGroupSpacing ( shell, initialization, 2, 12, referenceFont );
        await expect ( page.locator ( ".detail-page-content" ) ).toHaveCSS ( "padding", "4px" );

        if ( viewportWidth < 1280 )
        {
            await page.getByRole ( "button", { name: "Model", exact: true } ).click ();
        }
        await openEditorNode ( page );
        await page.getByRole ( "treeitem", { name: "Editor", exact: true } ).click ();
        await expectGroupSpacing ( shell, page.locator ( ".editor-dashboard" ), 5, 12, referenceFont );
        await expect ( page.locator ( ".editor-dashboard" ) ).toHaveCSS ( "padding-right", "4px" );
        await expect ( page.locator ( ".editor-dashboard" ) ).toHaveCSS ( "padding-bottom", "12px" );

        await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
        await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
        const settings = page.getByRole ( "dialog", { name: "Application Settings" } );
        for ( const [ groupName, selector, count ] of [
            [ "Appearance", ".settings-appearance-groups", 2 ],
            [ "Chart", ".settings-chart-groups", 5 ],
            [ "Print", ".settings-print-groups", 2 ],
        ] as const )
        {
            await settings.getByRole ( "option", { name: groupName, exact: true } ).click ();
            await expectGroupSpacing ( shell, settings.locator ( selector ), count, 10, referenceFont );
            await expect ( settings.locator ( ".settings-detail" ) ).toHaveCSS ( "padding-right", "12px" );
            await expect ( settings.locator ( ".settings-detail" ) ).toHaveCSS ( "padding-bottom", "12px" );
            await expect ( settings.locator ( ".dialog-content" ) ).toHaveCSS ( "padding", "8px" );
            await expect ( settings.locator ( ".dialog-footer" ) ).toHaveCSS ( "padding", "8px" );
        }
        await page.keyboard.press ( "Escape" );
        await expect ( settings ).toHaveCount ( 0 );

        await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
        await page.getByRole ( "menuitem", { name: "Page Setup", exact: true } ).click ();
        const pageSetup = page.getByRole ( "dialog", { name: "Page Setup" } );
        await expectGroupSpacing ( shell, pageSetup.locator ( ".dialog-content" ), 3, 12, referenceFont );
        await expect ( pageSetup.locator ( ".dialog-content" ) ).toHaveCSS ( "padding", "8px" );
        await expect ( pageSetup.locator ( ".dialog-footer" ) ).toHaveCSS ( "padding", "8px" );
        await expect ( pageSetup.locator ( "fieldset" ).first () ).toHaveCSS ( "margin-top", "3px" );
        await expect ( pageSetup.locator ( "fieldset" ).last () ).toHaveCSS ( "margin-bottom", "5px" );
        await page.keyboard.press ( "Escape" );
        await expect ( pageSetup ).toHaveCount ( 0 );

        for ( const [ property, value ] of [
            [ "--detail-page-content-inset", "4px" ],
            [ "--modal-content-inset", "8px" ],
            [ "--scroll-content-edge-inset", "12px" ],
            [ "--splitter-side-gap", "16px" ],
        ] )
        {
            await expect ( shell ).toHaveCSS ( property!, value! );
        }
    } );
}

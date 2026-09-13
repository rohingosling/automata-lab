// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Button Color Browser Tests
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies independent button palettes, modal and Console scope, persistence, contrast, and
//   accessible Appearance controls in both themes.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const COLOR_CHOICES = [ "Blue", "Gray", "Green", "Teal", "Purple", "Red", "Orange", "Yellow", "Black", "White" ];

//--------------------------------------------------------------------------------------------------
// Function: openAppearance
//
// Description:
//
//   Opens the transactional Appearance settings through the application menu.
//
//--------------------------------------------------------------------------------------------------

async function openAppearance ( page: Page )
{
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
    const dialog = page.getByRole ( "dialog", { name: "Application Settings" } );
    await dialog.getByRole ( "option", { name: "Appearance", exact: true } ).click ();
    return dialog;
}

for ( const theme of [ "Light", "Dark" ] as const )
{
    test ( `button colors preserve Console defaults and commit independently in ${theme}`, async ( { page } ) =>
    {
        await page.goto ( "./" );
        await page.locator ( "[data-toolbar-entry='toolbar-theme']" ).click ();
        await page.getByRole ( "menuitemradio", { name: theme } ).click ();
        const newButton = page.locator ( "[data-toolbar-entry='toolbar-new']" );
        await newButton.click ();
        await page.mouse.move ( 0, 0 );

        const consoleButton = page.locator ( ".console-row button" ).first ();
        const clearButton   = page.locator ( ".console-controls" ).getByRole ( "button", { name: "Clear", exact: true } );
        const matchingSurface = "rgb(62, 98, 72)";

        await expect ( newButton ).toHaveCSS ( "background-color", "rgb(53, 92, 133)" );
        await expect ( clearButton ).toHaveCSS ( "background-color", "rgb(53, 92, 133)" );
        await expect ( consoleButton ).toHaveCSS ( "background-color", matchingSurface );

        let dialog = await openAppearance ( page );
        const applicationButtons = dialog.getByRole ( "combobox", { name: "Application Buttons" } );
        const consoleButtons     = dialog.getByRole ( "combobox", { name: "Console Message Buttons" } );
        const matching = dialog.getByRole ( "checkbox", { name: "Match Console Message Color" } );
        await expect ( matching ).toBeChecked ();
        await expect ( consoleButtons ).toBeDisabled ();
        const titleColor = theme === "Dark" ? "rgb(36, 63, 92)" : "rgb(53, 92, 133)";
        const titleBarColor = dialog.getByRole ( "combobox", { name: "Title Bar Color" } );
        await expect ( dialog.getByRole ( "group", { name: "Application Colors" } ) ).toBeVisible ();
        await expect ( titleBarColor ).toHaveValue ( "Blue" );
        await expect ( titleBarColor.locator ( "option" ) ).toHaveText ( COLOR_CHOICES );
        await expect ( dialog.locator ( ".dialog-title-bar" ) ).toHaveCSS ( "background-color", titleColor );
        expect ( await page.locator ( ".application-title-bar" ).evaluate (
            element => getComputedStyle ( element ).backgroundImage,
        ) ).toContain ( titleColor );
        await expect ( applicationButtons.locator ( "option" ) ).toHaveText ( COLOR_CHOICES );
        await expect ( consoleButtons.locator ( "option" ) ).toHaveText ( COLOR_CHOICES );
        await titleBarColor.selectOption ( "Green" );
        await expect ( dialog.locator ( ".dialog-title-bar" ) ).toHaveCSS ( "background-color", titleColor );
        await applicationButtons.selectOption ( "Purple" );
        await matching.uncheck ();
        await consoleButtons.selectOption ( "Yellow" );
        await expect ( consoleButton ).toHaveCSS ( "background-color", matchingSurface );
        await dialog.getByRole ( "button", { name: "Cancel", exact: true } ).click ();

        dialog = await openAppearance ( page );
        await expect ( titleBarColor ).toHaveValue ( "Blue" );
        await expect ( applicationButtons ).toHaveValue ( "Blue" );
        await expect ( consoleButtons ).toHaveValue ( "Gray" );
        await titleBarColor.selectOption ( "Green" );
        await expect ( dialog.locator ( ".dialog-title-bar" ) ).toHaveCSS ( "background-color", titleColor );
        await applicationButtons.selectOption ( "Purple" );
        await matching.uncheck ();
        await consoleButtons.selectOption ( "Yellow" );
        await dialog.getByRole ( "button", { name: "Apply", exact: true } ).click ();
        await expect ( dialog ).toBeHidden ();
        await page.mouse.move ( 0, 0 );
        await expect ( newButton ).toHaveCSS ( "background-color", "rgb(98, 71, 117)" );
        await expect ( clearButton ).toHaveCSS ( "background-color", "rgb(98, 71, 117)" );
        await expect ( consoleButton ).toHaveCSS ( "background-color", "rgb(196, 174, 101)" );
        await expect ( consoleButton ).toHaveCSS ( "color",
            theme === "Dark" ? "rgb(255, 255, 255)" : "rgb(23, 33, 43)" );

        await page.reload ();
        await expect ( newButton ).toHaveCSS ( "background-color", "rgb(98, 71, 117)" );
        dialog = await openAppearance ( page );
        await expect ( titleBarColor ).toHaveValue ( "Green" );
        await expect ( dialog.locator ( ".dialog-title-bar" ) ).toHaveCSS ( "background-color",
            theme === "Dark" ? "rgb(41, 65, 48)" : "rgb(62, 98, 72)" );
        await expect ( applicationButtons ).toHaveValue ( "Purple" );
        await expect ( consoleButtons ).toHaveValue ( "Yellow" );
        await page.mouse.move ( 0, 0 );
        await expect ( dialog.getByRole ( "button", { name: "Apply", exact: true } ) )
            .toHaveCSS ( "background-color", "rgb(98, 71, 117)" );
        await expect ( dialog.getByRole ( "button", { name: "Close dialog" } ) )
            .toHaveCSS ( "background-color", "rgb(98, 71, 117)" );
        expect ( ( await new AxeBuilder ( { page } ).analyze () ).violations ).toEqual ( [] );

        await page.screenshot ( { path: `test-results/button-colors-${theme.toLowerCase ()}.png` } );
        await page.setViewportSize ( { width: 375, height: 812 } );
        await expect ( consoleButtons ).toBeVisible ();
        expect ( await dialog.evaluate ( element => element.scrollWidth <= element.clientWidth ) ).toBe ( true );
        await page.keyboard.press ( "Escape" );
        await page.mouse.move ( 0, 0 );
        await expect ( page.getByLabel ( "More toolbar commands" ) )
            .toHaveCSS ( "background-color", "rgb(98, 71, 117)" );
    } );

    test ( `button palette text remains readable in ${theme}`, async ( { page } ) =>
    {
        test.setTimeout ( 120_000 );
        await page.goto ( "./" );
        await page.locator ( "[data-toolbar-entry='toolbar-theme']" ).click ();
        await page.getByRole ( "menuitemradio", { name: theme } ).click ();

        for ( const color of COLOR_CHOICES )
        {
            const dialog = await openAppearance ( page );
            await dialog.getByRole ( "combobox", { name: "Title Bar Color" } ).selectOption ( color );
            await dialog.getByRole ( "combobox", { name: "Application Buttons" } ).selectOption ( color );
            await dialog.getByRole ( "checkbox", { name: "Match Console Message Color" } ).uncheck ();
            await dialog.getByRole ( "combobox", { name: "Console Message Buttons" } ).selectOption ( color );
            await dialog.getByRole ( "button", { name: "Apply", exact: true } ).click ();
            await page.mouse.move ( 0, 0 );
            const button = page.locator ( "[data-toolbar-entry='toolbar-new']" );

            for ( const interaction of [ "rest", "hover", "pressed" ] )
            {
                if ( interaction === "hover" )
                {
                    await button.hover ();
                }
                if ( interaction === "pressed" )
                {
                    await page.mouse.down ();
                }
                const contrast = await button.evaluate ( element =>
                {
                    const style = getComputedStyle ( element );
                    const luminance = ( value: string ): number =>
                    {
                        const channels = ( value.match ( /[\d.]+/g ) ?? [] ).slice ( 0, 3 )
                            .map ( channel => Number ( channel ) / 255 )
                            .map ( channel => channel <= 0.04045 ? channel / 12.92 : ( ( channel + 0.055 ) / 1.055 ) ** 2.4 );
                        return ( channels [ 0 ] ?? 0 ) * 0.2126 + ( channels [ 1 ] ?? 0 ) * 0.7152 +
                            ( channels [ 2 ] ?? 0 ) * 0.0722;
                    };
                    const foreground = luminance ( style.color );
                    const background = luminance ( style.backgroundColor );
                    return ( Math.max ( foreground, background ) + 0.05 ) /
                        ( Math.min ( foreground, background ) + 0.05 );
                } );
                expect ( contrast, `${theme} ${color} ${interaction} contrast` ).toBeGreaterThanOrEqual ( 4.5 );
            }
            await page.mouse.move ( 0, 0 );
            await page.mouse.up ();
            expect ( ( await new AxeBuilder ( { page } ).include ( ".application-title-bar" ).analyze () ).violations ).toEqual ( [] );
        }
    } );
}

test ( "system colors override both palettes in forced-colors mode", async ( { page } ) =>
{
    await page.goto ( "./" );
    const dialog = await openAppearance ( page );
    await dialog.getByRole ( "combobox", { name: "Application Buttons" } ).selectOption ( "White" );
    await dialog.getByRole ( "checkbox", { name: "Match Console Message Color" } ).uncheck ();
    await dialog.getByRole ( "combobox", { name: "Console Message Buttons" } ).selectOption ( "Yellow" );
    await dialog.getByRole ( "button", { name: "Apply", exact: true } ).click ();
    await page.locator ( "[data-toolbar-entry='toolbar-new']" ).click ();
    await page.emulateMedia ( { forcedColors: "active" } );
    await page.mouse.move ( 0, 0 );
    const applicationButton = page.locator ( "[data-toolbar-entry='toolbar-new']" );
    const consoleButton     = page.locator ( ".console-row button" ).first ();
    await expect ( applicationButton ).toHaveCSS (
        "background-color", await consoleButton.evaluate ( element => getComputedStyle ( element ).backgroundColor ),
    );
    await applicationButton.focus ();
    await expect ( applicationButton ).toHaveCSS ( "outline-style", "solid" );
} );

for ( const theme of [ "Light", "Dark" ] as const )
{
    test ( "Console severity matching is transactional, persistent, and scoped to inline actions in " + theme, async ( { page } ) =>
    {
        await page.addInitScript ( () =>
        {
            Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        } );
        await page.goto ( "./" );
        await page.locator ( "[data-toolbar-entry='toolbar-theme']" ).click ();
        await page.getByRole ( "menuitemradio", { name: theme } ).click ();
        const invalidChooser = page.waitForEvent ( "filechooser" );
        await page.getByRole ( "button", { name: "Open", exact: true } ).click ();
        await ( await invalidChooser ).setFiles ( { name: "invalid.json", mimeType: "application/json", buffer: Buffer.from ( "{" ) } );
        await page.getByRole ( "dialog", { name: "Error", exact: true } ).getByRole ( "button", { name: "OK" } ).click ();
        const chooser = page.waitForEvent ( "filechooser" );
        await page.getByRole ( "button", { name: "Open", exact: true } ).click ();
        await ( await chooser ).setFiles ( { name: "console-colors.json", mimeType: "application/json", buffer: Buffer.from ( JSON.stringify ( {
            file_id: "automata-lab-state-machine", file_version: "1.0.0",
            settings: { name: "Console Colors", description: "", version: "1.0.0" },
            state_machine: {
                initial_state: "A", states: [ { name: "A", description: "" }, { name: "B", description: "" } ],
                events: [], actions: [], state_actions: { entry: [], exit: [] }, transition_table: [],
            },
            chart: {
                settings: { expand_states: false, state_origin_centered: false }, states: [], draft_transitions: [],
                indicators: { initial_state_indicator: null, terminal_state_indicators: [], terminal_state_transitions: [] },
            },
            solver: { sequences: [] }, simulator: { sequences: [] },
        } ) ) } );
        const inlineButtons = page.locator ( ".console-row button" );
        await expect ( page.locator ( ".console-row-warning button" ).first () ).toBeVisible ();
        await expect ( page.locator ( ".console-row-error button" ).first () ).toBeVisible ();
        const originalColor = await inlineButtons.first ().evaluate ( element => getComputedStyle ( element ).backgroundColor );
        let dialog = await openAppearance ( page );
        let checkbox = dialog.getByRole ( "checkbox", { name: "Match Console Message Color" } );
        let dropdown = dialog.getByRole ( "combobox", { name: "Console Message Buttons" } );
        await expect ( checkbox ).toBeChecked ();
        await expect ( dropdown ).toBeDisabled ();
        await checkbox.uncheck ();
        await dropdown.selectOption ( "Purple" );
        await checkbox.check ();
        await expect ( dropdown ).toBeDisabled ();
        await expect ( inlineButtons.first () ).toHaveCSS ( "background-color", originalColor );
        await dialog.getByRole ( "button", { name: "Cancel", exact: true } ).click ();
        dialog = await openAppearance ( page );
        checkbox = dialog.getByRole ( "checkbox", { name: "Match Console Message Color" } );
        dropdown = dialog.getByRole ( "combobox", { name: "Console Message Buttons" } );
        await expect ( checkbox ).toBeChecked ();
        await expect ( dropdown ).toBeDisabled ();
        await checkbox.uncheck ();
        await expect ( dropdown ).toBeEnabled ();
        await expect ( dropdown ).toHaveValue ( "Gray" );
        await dropdown.selectOption ( "Purple" );
        await checkbox.check ();
        await dialog.getByRole ( "button", { name: "Apply", exact: true } ).click ();
        await page.mouse.move ( 0, 0 );
        const clear = page.locator ( ".console-controls" ).getByRole ( "button", { name: "Clear", exact: true } );
        await expect ( clear ).toHaveCSS ( "background-color", "rgb(53, 92, 133)" );
        await page.getByRole ( "checkbox", { name: "Follow Tail", exact: true } ).uncheck ();
        for ( const severity of [ "message", "warning", "error" ] as const )
        {
            const row = page.locator ( ".console-row-" + severity ).filter ( { has: page.getByRole ( "button" ) } ).first ();
            const button = row.getByRole ( "button" );

            // Keep the target fully clear of the sticky Console title bar during pointer checks.

            await button.evaluate ( element => element.scrollIntoView ( { block: "center" } ) );
            await page.mouse.move ( 0, 0 );
            const severityColor = await row.locator ( ".console-severity" ).evaluate ( element => getComputedStyle ( element ).color );
            for ( const interaction of [ "rest", "hover", "pressed" ] )
            {
                if ( interaction === "hover" )
                {
                    await button.hover ();
                }
                if ( interaction === "pressed" )
                {
                    await page.mouse.down ();
                }
                const palette = {
                    message: { rest: [ 62, 98, 72 ], hover: [ 52, 82, 60 ], pressed: [ 41, 65, 48 ] },
                    warning: { rest: [ 53, 92, 133 ], hover: [ 44, 77, 112 ], pressed: [ 36, 63, 92 ] },
                    error: { rest: [ 145, 73, 65 ], hover: [ 123, 62, 55 ], pressed: [ 101, 51, 46 ] },
                };

                // Wait for the browser to apply the current pointer interaction style.

                await expect.poll ( () => button.evaluate ( element =>
                {
                    const canvas = document.createElement ( "canvas" );
                    canvas.width = canvas.height = 1;
                    const context = canvas.getContext ( "2d" );
                    if ( context === null )
                    {
                        throw new Error ( "A Canvas context is required to normalize the rendered color." );
                    }
                    context.fillStyle = getComputedStyle ( element ).backgroundColor;
                    context.fillRect ( 0, 0, 1, 1 );
                    return Array.from ( context.getImageData ( 0, 0, 1, 1 ).data ).slice ( 0, 3 );
                } ) ).toEqual ( palette [ severity ] [ interaction as "rest" | "hover" | "pressed" ] );
                await expect ( button ).toHaveCSS ( "text-shadow", "none" );
                await expect ( button ).toHaveCSS ( "color", "rgb(255, 255, 255)" );
                await expect ( row.locator ( ".console-severity" ) ).toHaveCSS ( "color", severityColor );
            }
            await page.mouse.move ( 0, 0 );
            await page.mouse.up ();
        }
        await page.locator ( ".console-row-error" ).first ().hover ();
        expect ( ( await new AxeBuilder ( { page } ).include ( ".console-panel" ).analyze () ).violations ).toEqual ( [] );
        await page.screenshot ( { path: test.info ().outputPath ( "console-matching.png" ) } );
        await page.emulateMedia ( { forcedColors: "active" } );
        await expect ( inlineButtons.first () ).toHaveCSS ( "background-color", await clear.evaluate (
            element => getComputedStyle ( element ).backgroundColor,
        ) );
        await page.emulateMedia ( { forcedColors: "none" } );
        await page.reload ();
        dialog = await openAppearance ( page );
        checkbox = dialog.getByRole ( "checkbox", { name: "Match Console Message Color" } );
        dropdown = dialog.getByRole ( "combobox", { name: "Console Message Buttons" } );
        await expect ( checkbox ).toBeChecked ();
        await expect ( dropdown ).toBeDisabled ();
        await expect ( dropdown ).toHaveValue ( "Purple" );
        await checkbox.uncheck ();
        await expect ( dropdown ).toBeEnabled ();
        await expect ( dropdown ).toHaveValue ( "Purple" );
        await dialog.getByRole ( "button", { name: "Apply", exact: true } ).click ();
        await page.getByRole ( "button", { name: "New", exact: true } ).click ();
        await expect ( inlineButtons.first () ).toHaveCSS ( "background-color", "rgb(98, 71, 117)" );
        await page.reload ();
        dialog = await openAppearance ( page );
        await expect ( dialog.getByRole ( "checkbox", { name: "Match Console Message Color" } ) ).not.toBeChecked ();
        await expect ( dialog.getByRole ( "combobox", { name: "Console Message Buttons" } ) ).toHaveValue ( "Purple" );
    } );
}

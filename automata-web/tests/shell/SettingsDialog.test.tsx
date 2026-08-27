// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Application Settings Dialog Tests
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the Chart preference transaction, ranges, groups, and Apply behavior.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationPreferences } from "../../src/application/ports/contracts.js";
import { DEFAULT_APPLICATION_PREFERENCES } from "../../src/infrastructure/preferences/index.js";
import { SettingsDialog } from "../../src/presentation/dialogs/SettingsDialog.js";


//--------------------------------------------------------------------------------------------------
// Function: SettingsHarness
//
// Description:
//
//   Renders the settings harness interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered settings harness interface.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

function SettingsHarness ( properties: { readonly onApply: ( preferences: ApplicationPreferences ) => void } )
{
    // Initialize the local values needed by this operation.

    const [ preferences, setPreferences ] = useState ( DEFAULT_APPLICATION_PREFERENCES );


    // Return the rendered interface.

    return (
        <SettingsDialog
            onApply             = { properties.onApply }
            onClose             = { vi.fn () }
            onPreferencesChange = { setPreferences }
            open                = { true }
            preferences         = { preferences }
        />
    );
}

describe ( "Phase 6 application settings", () =>
{
    afterEach ( () =>
    {
        cleanup ();
        vi.restoreAllMocks ();
    } );

    it ( "exposes the complete Chart groups and retains raster settings while SVG disables them", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <SettingsHarness onApply={ vi.fn () } /> );
        await user.click ( screen.getByRole ( "option", { name: "Chart" } ) );

        expect ( screen.getByRole ( "group", { name: "Grid" } ) ).toBeVisible ();
        expect ( screen.getByRole ( "group", { name: "State Size" } ) ).toBeVisible ();
        expect ( screen.getByRole ( "group", { name: "Image Export" } ) ).toBeVisible ();
        expect ( screen.getByRole ( "group", { name: "Format" } ) ).toBeVisible ();
        expect ( screen.getByRole ( "group", { name: "Automatic Layout and Routing" } ) ).toBeVisible ();
        expect ( screen.queryByRole ( "checkbox", { name: "State Origin Centered" } ) ).not.toBeInTheDocument ();
        expect ( screen.getByRole ( "checkbox", {
            name: "Delete Orphaned Chart Items During Automatic Layout",
        } ) ).not.toBeChecked ();
        expect ( screen.getByRole ( "spinbutton", {
            name: "Minimum State Distance (px)",
        } ) ).toHaveValue ( 500 );
        expect ( screen.getByRole ( "spinbutton", {
            name: "Route Obstacle Offset (px)",
        } ) ).toHaveValue ( 100 );
        expect ( screen.getByRole ( "spinbutton", {
            name: "Transition Arrowhead Size (px)",
        } ) ).toHaveValue ( 40 );


        // Initialize the local values needed by this operation.

        const dpi               = screen.getByRole ( "spinbutton", { name: "DPI (dots per inch)" } );
        const maximumMegapixels = screen.getByRole ( "spinbutton", { name: "Maximum Megapixels" } );

        expect ( dpi ).toHaveValue ( 300 );
        expect ( maximumMegapixels ).toHaveValue ( 1_000 );
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "File Format" } ), "SVG" );
        expect ( dpi ).toBeDisabled ();
        expect ( dpi ).toHaveValue ( 300 );
        expect ( maximumMegapixels ).toBeDisabled ();
        expect ( maximumMegapixels ).toHaveValue ( 1_000 );
    } );

    it ( "supports clipboard entry for hexadecimal and individual RGB Grid Color values", async () =>
    {
        const user  = userEvent.setup ();
        const apply = vi.fn ();

        render ( <SettingsHarness onApply={ apply } /> );
        await user.click ( screen.getByRole ( "option", { name: "Chart" } ) );

        const gridColor = screen.getByRole ( "textbox", { name: "Grid Color" } );

        await user.click ( gridColor );
        await user.keyboard ( "{Control>}a{/Control}" );
        await user.paste ( "#112233" );

        expect ( gridColor ).toHaveValue ( "#112233" );
        await user.click ( screen.getByRole ( "button", { name: "Choose Grid Color" } ) );
        expect ( screen.getByRole ( "spinbutton", { name: "Red" } ) ).toHaveValue ( 17 );
        expect ( screen.getByRole ( "spinbutton", { name: "Green" } ) ).toHaveValue ( 34 );
        expect ( screen.getByRole ( "spinbutton", { name: "Blue" } ) ).toHaveValue ( 51 );

        await navigator.clipboard.writeText ( "17" );

        const green = screen.getByRole ( "spinbutton", { name: "Green" } );

        await user.clear ( green );
        await user.click ( green );
        await user.paste ();
        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );

        expect ( green ).toHaveValue ( 17 );
        expect ( apply ).toHaveBeenCalledWith ( expect.objectContaining ( {
            gridColor: "#111133",
        } ) );
    } );
    it ( "applies the maximum image-export megapixels within its configured bounds", async () =>
    {
        // Initialize the local values needed by this operation.

        const user  = userEvent.setup ();
        const apply = vi.fn ();

        render ( <SettingsHarness onApply={ apply } /> );
        await user.click ( screen.getByRole ( "option", { name: "Chart" } ) );
        fireEvent.change ( screen.getByRole ( "spinbutton", { name: "Maximum Megapixels" } ),
            { target: { value: "750" } } );
        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );

        expect ( apply ).toHaveBeenCalledWith ( expect.objectContaining ( {
            maximumImageExportMegapixels: 750,
        } ) );
    } );

    it ( "applies Route Obstacle Offset and Transition Arrowhead Size within their configured bounds", async () =>
    {
        // Initialize the local values needed by this operation.

        const user  = userEvent.setup ();
        const apply = vi.fn ();

        render ( <SettingsHarness onApply={ apply } /> );
        await user.click ( screen.getByRole ( "option", { name: "Chart" } ) );
        fireEvent.change ( screen.getByRole ( "spinbutton", {
            name: "Route Obstacle Offset (px)",
        } ), { target: { value: "200" } } );
        fireEvent.change ( screen.getByRole ( "spinbutton", {
            name: "Transition Arrowhead Size (px)",
        } ), { target: { value: "80" } } );
        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );

        expect ( apply ).toHaveBeenCalledWith ( expect.objectContaining ( {
            transitionArrowHeadSize: 80,
            transitionGravityPointDistance: 200,
        } ) );
    } );

    it ( "places Print last with synchronized section choices and Academic or Industry style", async () =>
    {
        // Initialize the local values needed by this operation.

        const user  = userEvent.setup ();
        const apply = vi.fn ();

        render ( <SettingsHarness onApply={ apply } /> );
        const settingsGroups = screen.getAllByRole ( "option" );

        expect ( settingsGroups.at ( -1 ) ).toHaveTextContent ( "Print" );
        await user.click ( screen.getByRole ( "option", { name: "Print" } ) );
        expect ( screen.getByRole ( "group", { name: "Sections" } ) ).toBeVisible ();
        expect ( screen.getByRole ( "group", { name: "Style and Format" } ) ).toBeVisible ();
        expect ( screen.getByRole ( "checkbox", { name: "State Chart" } ) ).toBeChecked ();
        expect ( screen.getByRole ( "combobox", { name: "Style" } ) ).toHaveValue ( "Academic" );

        await user.click ( screen.getByRole ( "checkbox", { name: "State Chart" } ) );
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Style" } ), "Industry" );
        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );

        expect ( apply ).toHaveBeenCalledWith ( expect.objectContaining ( {
            printIncludeStateChart: false,
            printStyle:             "Industry",
        } ) );
    } );
    it ( "sets one page-wide value origin to the longest field label plus ten percent", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        vi.spyOn ( HTMLElement.prototype, "getBoundingClientRect" ).mockImplementation ( function (
            this: HTMLElement,
        )
        {
            // Calculate the width value from the current inputs.

            const width = this.classList.contains ( "form-field-label-text" )
                ? ( this.textContent?.length ?? 0 ) * 10
                : 0;


            // Return the assembled result.

            return {
                bottom: 0,
                height: 0,
                left: 0,
                right: width,
                toJSON: () => ( {} ),
                top: 0,
                width,
                x: 0,
                y: 0,
            };
        } );
        const rendered = render ( <SettingsHarness onApply={ vi.fn () } /> );

        await user.click ( screen.getByRole ( "option", { name: "Chart" } ) );

        // Initialize the local values needed by this operation.

        const detail      = rendered.container.querySelector<HTMLElement> ( ".settings-detail" );
        const dialog      = screen.getByRole ( "dialog", { name: "Application Settings" } );
        const labelWidths = Array.from (
            detail?.querySelectorAll<HTMLElement> ( ".form-field-label-text" ) ?? [],
            label => ( label.textContent?.length ?? 0 ) * 10,
        );

        expect ( detail ).not.toBeNull ();
        expect ( labelWidths.length ).toBeGreaterThan ( 0 );
        expect ( dialog.style.getPropertyValue ( "--form-label-column-width" ) ).toBe (
            `${Math.ceil ( Math.max ( ...labelWidths ) * 1.1 )}px`,
        );
    } );

    it ( "emits the complete draft for the application to commit", async () =>
    {
        // Initialize the local values needed by this operation.

        const user  = userEvent.setup ();
        const apply = vi.fn ();

        render ( <SettingsHarness onApply={ apply } /> );
        await user.click ( screen.getByRole ( "option", { name: "Chart" } ) );
        fireEvent.change ( screen.getByRole ( "spinbutton", { name: "Grid Size (CSS pixels)" } ),
            { target: { value: "32" } } );
        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );

        expect ( apply ).toHaveBeenCalledWith ( expect.objectContaining ( { gridSize: 32 } ) );
    } );

    it ( "lets a numeric setting be retyped to a shorter value than the one it holds", async () =>
    {
        // Initialize the local values needed by this operation.

        const user  = userEvent.setup ();
        const apply = vi.fn ();

        render ( <SettingsHarness onApply={ apply } /> );
        await user.click ( screen.getByRole ( "option", { name: "Chart" } ) );

        // Clamping every keystroke and writing the result back made this impossible: clearing the
        // field produced NaN, the change was discarded, and the previous value reappeared before a
        // shorter number could be typed.

        const gridSize = screen.getByRole ( "spinbutton", { name: "Grid Size (CSS pixels)" } );

        expect ( gridSize ).toHaveValue ( 100 );

        await user.clear ( gridSize );
        await user.type ( gridSize, "20" );

        expect ( gridSize ).toHaveValue ( 20 );

        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );

        expect ( apply ).toHaveBeenCalledWith ( expect.objectContaining ( { gridSize: 20 } ) );
    } );

    it ( "accepts Minimum State Distance as editable text and clamps an out-of-range entry", async () =>
    {
        // Initialize the local values needed by this operation.

        const user  = userEvent.setup ();
        const apply = vi.fn ();

        render ( <SettingsHarness onApply={ apply } /> );
        await user.click ( screen.getByRole ( "option", { name: "Chart" } ) );

        const minimumStateDistance = screen.getByRole ( "spinbutton", { name: "Minimum State Distance (px)" } );

        await user.clear ( minimumStateDistance );
        await user.type ( minimumStateDistance, "1200" );
        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );

        expect ( apply ).toHaveBeenCalledWith ( expect.objectContaining ( { minimumStateDistance: 1_200 } ) );
    } );

    it ( "snaps a value beyond either limit to that limit instead of blocking Apply", async () =>
    {
        // Initialize the local values needed by this operation.

        const user  = userEvent.setup ();
        const apply = vi.fn ();

        render ( <SettingsHarness onApply={ apply } /> );
        await user.click ( screen.getByRole ( "option", { name: "Chart" } ) );

        const minimumStateDistance = screen.getByRole ( "spinbutton", { name: "Minimum State Distance (px)" } );

        await user.clear ( minimumStateDistance );
        await user.type ( minimumStateDistance, "99{Enter}" );

        expect ( minimumStateDistance ).toHaveValue ( 100 );
        expect ( screen.getByRole ( "button", { name: "Apply" } ) ).toBeEnabled ();

        await user.clear ( minimumStateDistance );
        await user.type ( minimumStateDistance, "5000{Enter}" );

        expect ( minimumStateDistance ).toHaveValue ( 2_000 );

        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );

        expect ( apply ).toHaveBeenCalledWith ( expect.objectContaining ( { minimumStateDistance: 2_000 } ) );
    } );
} );

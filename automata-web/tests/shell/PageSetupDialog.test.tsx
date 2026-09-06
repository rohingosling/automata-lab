// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Page Setup Dialog Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the complete Page Setup transaction, dismissal behavior, defaults, and focus
//   lifecycle.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrintPageSetup } from "../../src/application/printing.js";
import { extractPrintPageSetup } from "../../src/application/printing.js";
import { DEFAULT_APPLICATION_PREFERENCES } from "../../src/configuration/compile-time-configuration.js";
import { PageSetupDialog } from "../../src/presentation/dialogs/PageSetupDialog.js";

//--------------------------------------------------------------------------------------------------
// Interface: PageSetupHarnessProperties
//
// Description:
//
//   Defines the properties accepted by the page setup harness interface.
//
//--------------------------------------------------------------------------------------------------

interface PageSetupHarnessProperties
{
    readonly onApply: ( pageSetup: PrintPageSetup ) => void;
}

//--------------------------------------------------------------------------------------------------
// Function: PageSetupHarness
//
// Description:
//
//   Renders the page setup harness interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered page setup harness interface.
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

function PageSetupHarness ( properties: PageSetupHarnessProperties )
{
    // Initialize the local values needed by this operation.

    const [ committedPageSetup, setCommittedPageSetup ] = useState (
        () => extractPrintPageSetup ( DEFAULT_APPLICATION_PREFERENCES ),
    );
    const [ pageSetupDraft, setPageSetupDraft ] = useState ( committedPageSetup );
    const [ open, setOpen ]                     = useState ( false );

    //----------------------------------------------------------------------------------------------
    // Function: openPageSetup
    //
    // Description:
    //
    //   Opens the page setup.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function openPageSetup (): void
    {
        setPageSetupDraft ( committedPageSetup );
        setOpen ( true );
    }

    //----------------------------------------------------------------------------------------------
    // Function: applyPageSetup
    //
    // Description:
    //
    //   Applies the page setup.
    //
    // Parameters:
    //
    //   - pageSetup:
    //     The page setup supplied to the operation.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function applyPageSetup ( pageSetup: PrintPageSetup ): void
    {
        setCommittedPageSetup ( pageSetup );
        properties.onApply ( pageSetup );
        setOpen ( false );
    }

    // Return the rendered interface.

    return (
        <>
            <button onClick={ openPageSetup } type="button">Page Setup command</button>
            <PageSetupDialog
                onApply           = { applyPageSetup }
                onClose           = { () => setOpen ( false ) }
                onPageSetupChange = { setPageSetupDraft }
                open              = { open }
                pageSetup         = { pageSetupDraft }
            />
        </>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: openPageSetupDialog
//
// Description:
//
//   Opens the page setup dialog.
//
// Parameters:
//
//   None.
//
// Returns:
//
//   The value produced by the operation.
//
// Preconditions:
//
//   - None.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

async function openPageSetupDialog (): Promise<ReturnType<typeof userEvent.setup>>
{
    // Initialize the local values needed by this operation.

    const user = userEvent.setup ();

    await user.click ( screen.getByRole ( "button", { name: "Page Setup command" } ) );

    // Return the user.

    return user;
}

//--------------------------------------------------------------------------------------------------
// Function: expectDefaultDraftAfterReopening
//
// Description:
//
//   Verifies default draft after reopening and reports a failure when it is invalid.
//
// Parameters:
//
//   - user:
//     The user supplied to the operation.
//
// Returns:
//
//   A promise that resolves when the operation is complete.
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

async function expectDefaultDraftAfterReopening ( user: ReturnType<typeof userEvent.setup> ): Promise<void>
{
    await waitFor ( () => expect ( screen.getByRole ( "button", { name: "Page Setup command" } ) ).toHaveFocus () );
    await user.click ( screen.getByRole ( "button", { name: "Page Setup command" } ) );

    expect ( screen.getByRole ( "combobox", { name: "Paper Size" } ) ).toHaveValue ( "A4" );
}

describe ( "AL-PRN-002 Page Setup dialog", () =>
{
    afterEach ( () =>
    {
        cleanup ();
        vi.restoreAllMocks ();
    } );

    it ( "exposes every control with the complete all-enabled default transaction", async () =>
    {
        render ( <PageSetupHarness onApply={ vi.fn () } /> );
        await openPageSetupDialog ();

        // Initialize the local values needed by this operation.

        const paperSize   = screen.getByRole ( "combobox", { name: "Paper Size" } );
        const orientation = screen.getByRole ( "combobox", { name: "Orientation" } );

        expect ( screen.getByRole ( "group", { name: "Paper" } ) ).toBeVisible ();
        expect ( paperSize ).toHaveValue ( "A4" );
        expect ( within ( paperSize ).getAllByRole ( "option" ).map ( option => option.textContent ) )
            .toEqual ( [ "A4", "Letter", "Legal" ] );
        expect ( orientation ).toHaveValue ( "Portrait" );
        expect ( within ( orientation ).getAllByRole ( "option" ).map ( option => option.textContent ) )
            .toEqual ( [ "Portrait", "Landscape" ] );
        expect ( paperSize ).toHaveFocus ();

        expect ( screen.getByRole ( "group", { name: "Margins" } ) ).toBeVisible ();

        // Process each name from the current value collection in order.

        for ( const name of [
            "Top Margin (mm)",
            "Right Margin (mm)",
            "Bottom Margin (mm)",
            "Left Margin (mm)",
        ] )
        {
            // Initialize the local values needed by this operation.

            const margin = screen.getByRole ( "spinbutton", { name } );

            expect ( margin ).toHaveValue ( 12.7 );
            expect ( margin ).toHaveAttribute ( "min", "0" );
            expect ( margin ).toHaveAttribute ( "max", "50" );
            expect ( margin ).toHaveAttribute ( "step", "0.1" );
        }

        expect ( screen.getByRole ( "group", { name: "Included Report Sections" } ) ).toBeVisible ();

        // Process each name from the current value collection in order.

        for ( const name of [
            "Model Summary",
            "States",
            "Events",
            "Actions",
            "Transition Table",
            "State Chart",
            "Chart Projection",
            "Solver Observation Sequences",
            "Simulator Event Sequences",
        ] )
        {
            expect ( screen.getByRole ( "checkbox", { name } ) ).toBeChecked ();
        }
    } );

    it ( "applies the complete edited draft as one transaction", async () =>
    {
        // Initialize the local values needed by this operation.

        const apply = vi.fn ();

        render ( <PageSetupHarness onApply={ apply } /> );
        const user = await openPageSetupDialog ();

        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Paper Size" } ), "Letter" );
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Orientation" } ), "Landscape" );
        fireEvent.change ( screen.getByRole ( "spinbutton", { name: "Top Margin (mm)" } ),
            { target: { value: "0" } } );
        fireEvent.change ( screen.getByRole ( "spinbutton", { name: "Right Margin (mm)" } ),
            { target: { value: "50" } } );
        fireEvent.change ( screen.getByRole ( "spinbutton", { name: "Bottom Margin (mm)" } ),
            { target: { value: "25.5" } } );
        fireEvent.change ( screen.getByRole ( "spinbutton", { name: "Left Margin (mm)" } ),
            { target: { value: "6.4" } } );
        await user.click ( screen.getByRole ( "checkbox", { name: "Chart Projection" } ) );
        await user.click ( screen.getByRole ( "checkbox", { name: "Simulator Event Sequences" } ) );
        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );

        expect ( apply ).toHaveBeenCalledTimes ( 1 );
        expect ( apply ).toHaveBeenCalledWith ( {
            ...extractPrintPageSetup ( DEFAULT_APPLICATION_PREFERENCES ),
            printIncludeChart:            false,
            printIncludeSimulator:        false,
            printMarginBottomMillimetres: 25.5,
            printMarginLeftMillimetres:   6.4,
            printMarginRightMillimetres:  50,
            printMarginTopMillimetres:    0,
            printOrientation:             "Landscape",
            printPaperSize:               "Letter",
        } );
        await waitFor ( () => expect ( screen.getByRole ( "button", { name: "Page Setup command" } ) ).toHaveFocus () );
    } );

    it ( "discards pending changes on Cancel and restores focus to the invoker", async () =>
    {
        // Initialize the local values needed by this operation.

        const apply = vi.fn ();

        render ( <PageSetupHarness onApply={ apply } /> );
        const user = await openPageSetupDialog ();

        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Paper Size" } ), "Legal" );
        await user.click ( screen.getByRole ( "button", { name: "Cancel" } ) );
        expect ( apply ).not.toHaveBeenCalled ();
        await expectDefaultDraftAfterReopening ( user );
    } );

    it ( "discards pending changes on Close and restores focus to the invoker", async () =>
    {
        // Initialize the local values needed by this operation.

        const apply = vi.fn ();

        render ( <PageSetupHarness onApply={ apply } /> );
        const user = await openPageSetupDialog ();

        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Paper Size" } ), "Legal" );
        await user.click ( screen.getByRole ( "button", { name: "Close dialog" } ) );
        expect ( apply ).not.toHaveBeenCalled ();
        await expectDefaultDraftAfterReopening ( user );
    } );

    it ( "discards pending changes on the native Escape cancellation event and restores focus", async () =>
    {
        // Initialize the local values needed by this operation.

        const apply = vi.fn ();

        render ( <PageSetupHarness onApply={ apply } /> );
        const user = await openPageSetupDialog ();

        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Paper Size" } ), "Legal" );
        fireEvent ( screen.getByRole ( "dialog", { name: "Page Setup" } ),
            new Event ( "cancel", { bubbles: false, cancelable: true } ) );
        expect ( apply ).not.toHaveBeenCalled ();
        await expectDefaultDraftAfterReopening ( user );
    } );
} );

// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Shared Presentation Control Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies keyboard behavior shared by subordinate tabs, entity lists, and data grids.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMPILE_TIME_CONFIGURATION } from "../../src/configuration/compile-time-configuration";
import { MAXIMUM_STATE_COUNT } from "../../src/domain/model/limits";
import { DropDownListBox } from "../../src/presentation/shared/DropDownListBox";
import { DataGrid, EntityList } from "../../src/presentation/shared/SharedControls";
import { Tabs } from "../../src/presentation/shared/Tabs";

//--------------------------------------------------------------------------------------------------
// Function: EntityListHarness
//
// Description:
//
//   Renders the entity list harness interface.
//
// Parameters:
//
//   None.
//
// Returns:
//
//   The rendered entity list harness interface.
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

function EntityListHarness ()
{
    // Initialize the local values needed by this operation.

    const [ selectedIdentifier, setSelectedIdentifier ] = useState <string | null> ( null );

    // Return the rendered interface.

    return (
        <EntityList
            items              = { [ { identifier: "one", label: "One" }, { identifier: "two", label: "Two" } ] }
            label              = "Entities"
            onSelectionChange  = { setSelectedIdentifier }
            selectedIdentifier = { selectedIdentifier }
        />
    );
}

//--------------------------------------------------------------------------------------------------
// Function: TabsHarness
//
// Description:
//
//   Renders the tabs harness interface.
//
// Parameters:
//
//   None.
//
// Returns:
//
//   The rendered tabs harness interface.
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

function TabsHarness ()
{
    // Initialize the local values needed by this operation.

    const [ activeTab, setActiveTab ] = useState <"entry" | "exit"> ( "entry" );

    // Return the rendered interface.

    return (
        <Tabs
            activeTab = { activeTab }
            label     = "Actions"
            onSelect  = { setActiveTab }
            tabs      = { [ { identifier: "entry", label: "Entry Actions" }, { identifier: "exit", label: "Exit Actions" } ] }
        >
            { activeTab }
        </Tabs>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: DropDownGridHarness
//
// Description:
//
//   Renders the drop down grid harness interface.
//
// Parameters:
//
//   None.
//
// Returns:
//
//   The rendered drop down grid harness interface.
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

function DropDownGridHarness ()
{
    // Initialize the local values needed by this operation.

    const [ selectedIdentifier, setSelectedIdentifier ] = useState <string | null> ( null );
    const [ firstValue, setFirstValue ]                 = useState ( "one" );

    // Return the rendered interface.

    return (
        <DataGrid
            columns={ [
                {
                    cellClassName: "editable-grid-cell",
                    heading:       "Value",
                    render:        row => row.identifier === "first"
                        ? (
                            <DropDownListBox
                                accessibleLabel = "First value"
                                emptyMessage    = "No values"
                                onChange        = { setFirstValue }
                                openButtonLabel = "Open first value"
                                options         = { [ { label: "One", value: "one" }, { label: "Two", value: "two" } ] }
                                value           = { firstValue }
                            />
                        )
                        : row.value,
                },
            ] }
            getKey               = { row => row.identifier }
            label                = "Editable values"
            onRowSelectionChange = { setSelectedIdentifier }
            rows                 = { [ { identifier: "first", value: firstValue }, { identifier: "second", value: "two" } ] }
            selectedKey          = { selectedIdentifier }
        />
    );
}

//--------------------------------------------------------------------------------------------------
// Function: LargeDropDownHarness
//
// Description:
//
//   Renders the large drop down harness interface.
//
// Parameters:
//
//   None.
//
// Returns:
//
//   The rendered large drop down harness interface.
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

function LargeDropDownHarness ()
{
    // Initialize the local values needed by this operation.

    const [ value, setValue ] = useState ( "option-0" );

    // Return the rendered interface.

    return (
        <DropDownListBox
            accessibleLabel = "Large values"
            emptyMessage    = "No values"
            onChange        = { setValue }
            openButtonLabel = "Open large values"
            options         = { Array.from ( { length: MAXIMUM_STATE_COUNT }, ( _, index ) => ( {
                label: `Option ${index}`,
                value: `option-${index}`,
            } ) ) }
            value={ value }
        />
    );
}

describe ( "AL-UI-007 shared keyboard controls", () =>
{
    afterEach ( cleanup );

    it ( "gives an unselected entity list a valid tab stop and moves selection", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <EntityListHarness /> );
        const options = screen.getAllByRole ( "option" );

        expect ( options [ 0 ] ).toHaveAttribute ( "tabindex", "0" );
        options [ 0 ]?.focus ();
        await user.keyboard ( "{ArrowDown}" );
        expect ( options [ 1 ] ).toHaveFocus ();
        expect ( options [ 1 ] ).toHaveAttribute ( "aria-selected", "true" );
    } );

    it ( "moves data-grid focus across columns and rows", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render (
            <DataGrid
                columns={ [
                    { heading: "Name", render: row => row.name },
                    { heading: "Value", render: row => row.value },
                ] }
                getKey = { row => row.name }
                label  = "Values"
                rows   = { [ { name: "First", value: "1" }, { name: "Second", value: "2" } ] }
            />
        );
        const cells = screen.getAllByRole ( "gridcell" );

        cells [ 0 ]?.focus ();
        await user.keyboard ( "{ArrowRight}" );
        expect ( cells [ 1 ] ).toHaveFocus ();
        await user.keyboard ( "{ArrowDown}" );
        expect ( cells [ 3 ] ).toHaveFocus ();
    } );

    it ( "opens a reusable list box only from its button and leaves mouse cell selection independent", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <DropDownGridHarness /> );

        // Initialize the local values needed by this operation.

        const cells      = screen.getAllByRole ( "gridcell" );
        const firstCell  = cells [ 0 ];
        const secondCell = cells [ 1 ];

        // Handle the case where at least one branch condition is satisfied.

        if ( firstCell === undefined || secondCell === undefined )
        {
            throw new Error ( "The editable grid cells were not rendered." );
        }

        await user.click ( secondCell );
        expect ( secondCell.parentElement ).toHaveAttribute ( "aria-selected", "true" );
        expect ( firstCell ).toHaveAttribute ( "data-active", "false" );
        expect ( secondCell ).toHaveAttribute ( "data-active", "true" );

        await user.click ( screen.getByRole ( "button", { name: "Open first value" } ) );
        expect ( firstCell.parentElement ).toHaveAttribute ( "aria-selected", "false" );
        expect ( secondCell.parentElement ).toHaveAttribute ( "aria-selected", "true" );
        expect ( firstCell ).toHaveAttribute ( "data-active", "false" );
        expect ( secondCell ).toHaveAttribute ( "data-active", "true" );
        expect ( screen.getByRole ( "listbox", { name: "First value" } ) ).toBeVisible ();

        await user.click ( screen.getByRole ( "option", { name: "Two" } ) );
        expect ( firstCell ).toHaveTextContent ( "Two" );
        expect ( screen.queryByRole ( "listbox", { name: "First value" } ) ).not.toBeInTheDocument ();
        expect ( secondCell.parentElement ).toHaveAttribute ( "aria-selected", "true" );

        await user.click ( firstCell );
        expect ( firstCell.parentElement ).toHaveAttribute ( "aria-selected", "true" );
        expect ( firstCell ).toHaveAttribute ( "data-active", "true" );
        expect ( secondCell ).toHaveAttribute ( "data-active", "false" );
        expect ( screen.queryByRole ( "listbox", { name: "First value" } ) ).not.toBeInTheDocument ();

        const openButton = screen.getByRole ( "button", { name: "Open first value" } );

        openButton.focus ();
        await user.keyboard ( "{Enter}" );
        await user.keyboard ( "{ArrowUp}{Enter}" );
        expect ( firstCell ).toHaveTextContent ( "One" );
        expect ( openButton ).toHaveFocus ();
    } );

    it ( "bounds a large drop-down list and keeps the final option keyboard-selectable", async () =>
    {
        // Initialize the local values needed by this operation.

        const user             = userEvent.setup ();
        const initialItemCount = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;

        render ( <LargeDropDownHarness /> );
        await user.click ( screen.getByRole ( "button", { name: "Open large values" } ) );

        const listBox = screen.getByRole ( "listbox", { name: "Large values" } );

        expect ( within ( listBox ).getAllByRole ( "option" ) ).toHaveLength ( initialItemCount );
        expect ( listBox ).toHaveFocus ();

        await user.keyboard ( "{End}" );

        // Calculate the final option value from the current inputs.

        const finalOption = within ( listBox ).getByRole ( "option", { name: `Option ${MAXIMUM_STATE_COUNT - 1}` } );

        expect ( finalOption ).toHaveAttribute ( "data-active", "true" );
        expect ( finalOption ).toHaveAttribute ( "aria-posinset", String ( MAXIMUM_STATE_COUNT ) );
        expect ( finalOption ).toHaveAttribute ( "aria-setsize", String ( MAXIMUM_STATE_COUNT ) );
        expect ( within ( listBox ).getAllByRole ( "option" ) ).toHaveLength ( initialItemCount + 1 );

        await user.keyboard ( "{Enter}" );

        expect ( screen.queryByRole ( "listbox", { name: "Large values" } ) ).not.toBeInTheDocument ();
        expect ( screen.getByText ( `Option ${MAXIMUM_STATE_COUNT - 1}` ) ).toBeVisible ();
    } );

    it ( "automatically activates subordinate tabs with arrow keys", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <TabsHarness /> );

        // Initialize the local values needed by this operation.

        const entryTab = screen.getByRole ( "tab", { name: "Entry Actions" } );
        const exitTab  = screen.getByRole ( "tab", { name: "Exit Actions" } );

        entryTab.focus ();
        await user.keyboard ( "{ArrowRight}" );
        expect ( exitTab ).toHaveFocus ();
        expect ( exitTab ).toHaveAttribute ( "aria-selected", "true" );
    } );

    it ( "progressively renders large entity lists and preserves keyboard access to the final item", async () =>
    {
        // Initialize the local values needed by this operation.

        const user      = userEvent.setup ();
        const itemCount = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount + 150;

        render (
            <EntityList
                items={ Array.from ( { length: itemCount }, ( _, index ) => ( {
                    identifier: `entity-${index}`,
                    label:      `Entity ${index}`,
                } ) ) }
                label              = "Large entities"
                onSelectionChange  = { vi.fn () }
                selectedIdentifier = { null }
            />
        );

        expect ( screen.getAllByRole ( "option" ) ).toHaveLength (
            COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount,
        );
        expect ( screen.getByRole ( "listbox" ) ).toContainElement ( screen.getByRole ( "option", { name: "Entity 0" } ) );

        screen.getByRole ( "option", { name: "Entity 0" } ).focus ();
        await user.keyboard ( "{End}" );

        expect ( screen.getByRole ( "option", { name: `Entity ${itemCount - 1}` } ) ).toHaveFocus ();
        expect ( screen.getAllByRole ( "option" ) ).toHaveLength ( itemCount );
    } );

    it ( "progressively renders large grids and reveals the next batch at the scroll boundary", () =>
    {
        // Initialize the local values needed by this operation.

        const initialItemCount = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const rows             = Array.from ( { length: initialItemCount + 50 }, ( _, index ) => ( {
            name: `Row ${index}`,
        } ) );

        render (
            <DataGrid
                columns = { [ { heading: "Name", render: row => row.name } ] }
                getKey  = { row => row.name }
                label   = "Large grid"
                rows    = { rows }
            />
        );

        const grid = screen.getByRole ( "grid", { name: "Large grid" } );

        expect ( screen.getAllByRole ( "gridcell" ) ).toHaveLength ( initialItemCount );
        expect ( grid ).toHaveAttribute ( "aria-rowcount", String ( rows.length + 1 ) );

        Object.defineProperties ( grid,
            {
                clientHeight: { configurable: true, value: 200 },
                scrollHeight: { configurable: true, value: 2_000 },
                scrollTop:    { configurable: true, value: 1_850 },
            }
        );
        fireEvent.scroll ( grid );

        expect ( screen.getAllByRole ( "gridcell" ) ).toHaveLength ( rows.length );
    } );
} );

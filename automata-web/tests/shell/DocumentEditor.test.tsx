// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Document Lifecycle and Editor Component Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies New, dirty-decision, Editor, ordered-assignment, validation, and undo presentation
//   paths.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Application } from "../../src/Application";

//--------------------------------------------------------------------------------------------------
// Function: toolbarButton
//
// Description:
//
//   Derives the toolbar button.
//
// Parameters:
//
//   - identifier:
//     The identifier supplied to the operation.
//
// Returns:
//
//   The value produced by the operation.
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

function toolbarButton ( identifier: string ): HTMLButtonElement
{
    // Initialize the local values needed by this operation.

    const button = document.querySelector <HTMLButtonElement> ( `[data-toolbar-entry='${identifier}']` );

    // Handle the case where button matches an absent value.

    if ( button === null )
    {
        throw new Error ( `Toolbar button '${identifier}' was not rendered.` );
    }

    // Return the button.

    return button;
}

//--------------------------------------------------------------------------------------------------
// Function: addNamedEntity
//
// Description:
//
//   Adds the named entity.
//
// Parameters:
//
//   - user:
//     The user supplied to the operation.
//
//   - name:
//     The name supplied to the operation.
//
//   - description:
//     The description supplied to the operation.
//
//   - container:
//     The container supplied to the operation.
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

async function addNamedEntity (
    user: ReturnType <typeof userEvent.setup>,
    name: string,
    description = "",
    container: HTMLElement = document.body,
): Promise<void>
{
    await user.click ( within ( container ).getByRole ( "button", { name: "Add" } ) );
    await user.type ( screen.getByRole ( "textbox", { name: "Name" } ), name );

    // Handle the case where description length exceeds 0.

    if ( description.length > 0 )
    {
        await user.type ( screen.getByRole ( "textbox", { name: "Description" } ), description );
    }

    await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );
}

describe ( "Phase 3 document lifecycle and Editor", () =>
{
    beforeEach ( () => window.localStorage.clear () );
    afterEach ( cleanup );

    it ( "creates a valid model and preserves duplicate ordered action assignments", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        await user.click ( toolbarButton ( "toolbar-new" ) );

        expect ( screen.getByRole ( "heading", { name: /State Machine.*Initialization/u } ) ).toBeVisible ();
        expect ( toolbarButton ( "toolbar-save" ) ).toBeEnabled ();
        expect ( toolbarButton ( "toolbar-push" ) ).toBeDisabled ();

        await user.click ( screen.getByRole ( "treeitem", { name: "States" } ) );
        const statesListPane = document.querySelector <HTMLElement> ( ".states-list-pane" );

        // Handle the case where states list pane matches an absent value.

        if ( statesListPane === null )
        {
            throw new Error ( "The States list pane was not rendered." );
        }

        await addNamedEntity ( user, "state_idle", "Idle state", statesListPane );

        await user.click ( screen.getByRole ( "treeitem", { name: "State Machine" } ) );
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Initial State" } ), "state_idle" );

        await waitFor ( () => expect ( toolbarButton ( "toolbar-save" ) ).toBeEnabled () );
        expect ( screen.getByText ( "States: 1" ) ).toBeVisible ();

        await user.click ( screen.getByRole ( "treeitem", { name: "Actions" } ) );
        await addNamedEntity ( user, "action_log", "Record activity" );
        await user.click ( screen.getByRole ( "treeitem", { name: "States" } ) );

        const stateList = screen.getByRole ( "grid", { name: "States" } );

        await user.click ( within ( stateList ).getByRole ( "gridcell", { name: "state_idle" } ) );

        // Repeat the operation across the bounded iteration range.

        for ( let i = 0; i < 2; i++ )
        {
            // Initialize the local values needed by this operation.

            const assignmentPane = document.querySelector <HTMLElement> ( ".state-actions-pane" );

            // Handle the case where assignment pane matches an absent value.

            if ( assignmentPane === null )
            {
                throw new Error ( "The state-action assignment pane was not rendered." );
            }

            await user.click ( within ( assignmentPane ).getByRole ( "button", { name: "Add" } ) );
            await user.selectOptions ( screen.getByRole ( "combobox", { name: "Existing entity" } ), "action_log" );
            await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );
        }

        const assignmentList = screen.getByRole ( "listbox", { name: "State action assignments" } );

        expect ( within ( assignmentList ).getAllByRole ( "option" ).map ( row => row.textContent ) ).toEqual (
            [ "1. action_log", "2. action_log" ],
        );
        expect ( screen.getByText ( "Entry Actions: 2" ) ).toBeVisible ();
        expect ( document.title ).toContain ( "Unsaved changes" );
    } );

    it.each (
        [
            [ "States", "States", "state_described", "State description", ".states-list-pane" ],
            [ "Events", "Events", "event_described", "Event description", ".editor-list-page" ],
            [ "Actions", "Reusable actions", "action_described", "Action description", ".editor-list-page" ],
        ] as const,
    ) ( "shows Name and Description columns in the %s catalog", async (
        pageName,
        accessibleGridName,
        entityName,
        description,
        pageSelector,
    ) =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        await user.click ( toolbarButton ( "toolbar-new" ) );
        await user.click ( screen.getByRole ( "treeitem", { name: pageName } ) );

        const grid = screen.getByRole ( "grid", { name: accessibleGridName } );
        const page = document.querySelector<HTMLElement> ( pageSelector );

        // Handle the case where page matches an absent value.

        if ( page === null )
        {
            throw new Error ( `The ${pageName} catalog page was not rendered.` );
        }

        expect ( within ( grid ).getAllByRole ( "columnheader" ).map ( heading => heading.textContent ) )
            .toEqual ( [ "Name", "Description" ] );

        await addNamedEntity ( user, entityName, description, page );

        expect ( within ( grid ).getByRole ( "gridcell", { name: entityName } ) ).toBeVisible ();
        expect ( within ( grid ).getByRole ( "gridcell", { name: description } ) ).toBeVisible ();
    } );

    it ( "protects dirty New and restores a deleted entity through document Undo", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        await user.click ( toolbarButton ( "toolbar-new" ) );
        await user.click ( screen.getByRole ( "treeitem", { name: "States" } ) );
        const statesListPane = document.querySelector <HTMLElement> ( ".states-list-pane" );

        // Handle the case where states list pane matches an absent value.

        if ( statesListPane === null )
        {
            throw new Error ( "The States list pane was not rendered." );
        }

        await addNamedEntity ( user, "state_one", "", statesListPane );

        await user.click ( toolbarButton ( "toolbar-new" ) );
        expect ( screen.getByRole ( "dialog", { name: "Unsaved changes" } ) ).toBeVisible ();
        await user.click ( screen.getByRole ( "button", { name: "Cancel" } ) );
        expect ( screen.getByRole ( "gridcell", { name: "state_one" } ) ).toBeVisible ();

        await user.click ( within ( statesListPane ).getByRole ( "button", { name: "Delete" } ) );

        // Initialize the local values needed by this operation.

        const impactDialog        = screen.getByRole ( "dialog", { name: "Confirm cascading deletion" } );
        const confirmDeleteButton = within ( impactDialog ).getByRole ( "button", { name: "Delete" } );

        expect ( impactDialog ).toBeVisible ();
        expect ( confirmDeleteButton ).toHaveFocus ();
        await user.keyboard ( "{Enter}" );

        expect ( screen.queryByRole ( "gridcell", { name: "state_one" } ) ).not.toBeInTheDocument ();
        expect ( toolbarButton ( "toolbar-undo" ) ).toBeEnabled ();
        await user.click ( toolbarButton ( "toolbar-undo" ) );
        expect ( screen.getByRole ( "gridcell", { name: "state_one" } ) ).toBeVisible ();

        await user.click ( toolbarButton ( "toolbar-new" ) );
        await user.click ( screen.getByRole ( "button", { name: "Discard and Continue" } ) );

        expect ( screen.getByRole ( "heading", { name: /State Machine.*Initialization/u } ) ).toBeVisible ();
        expect ( screen.getByText ( "States: 0" ) ).toBeVisible ();
        expect ( document.title ).not.toContain ( "Unsaved changes" );
    } );

    it.each (
        [
            [ "Events", "event_delete" ],
            [ "Actions", "action_delete" ],
        ] as const,
    ) ( "focuses and confirms deletion from the %s catalog", async ( pageName, entityName ) =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        await user.click ( toolbarButton ( "toolbar-new" ) );
        await user.click ( screen.getByRole ( "treeitem", { name: pageName } ) );

        const listPage = document.querySelector <HTMLElement> ( ".editor-list-page" );

        // Handle the case where list page matches an absent value.

        if ( listPage === null )
        {
            throw new Error ( `The ${pageName} list page was not rendered.` );
        }

        await addNamedEntity ( user, entityName, "", listPage );
        await user.click ( within ( listPage ).getByRole ( "button", { name: "Delete" } ) );

        // Initialize the local values needed by this operation.

        const impactDialog        = screen.getByRole ( "dialog", { name: "Confirm cascading deletion" } );
        const confirmDeleteButton = within ( impactDialog ).getByRole ( "button", { name: "Delete" } );

        expect ( confirmDeleteButton ).toHaveFocus ();
        await user.keyboard ( "{Enter}" );
        expect ( screen.queryByRole ( "gridcell", { name: entityName } ) ).not.toBeInTheDocument ();
    } );

    it ( "edits transition cells in place with constrained drop-down lists", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        await user.click ( toolbarButton ( "toolbar-new" ) );
        await user.click ( screen.getByRole ( "treeitem", { name: "States" } ) );

        const statesListPane = document.querySelector <HTMLElement> ( ".states-list-pane" );

        // Handle the case where states list pane matches an absent value.

        if ( statesListPane === null )
        {
            throw new Error ( "The States list pane was not rendered." );
        }

        await addNamedEntity ( user, "state_one", "", statesListPane );
        await addNamedEntity ( user, "state_two", "", statesListPane );
        await user.click ( screen.getByRole ( "treeitem", { name: "Events" } ) );
        await addNamedEntity ( user, "event_go" );
        await user.click ( screen.getByRole ( "treeitem", { name: "Transition Table" } ) );
        await user.click ( screen.getByRole ( "button", { name: "Add" } ) );
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "State" } ), "state_one" );
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Event" } ), "event_go" );
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Next State" } ), "state_two" );
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );

        // Initialize the local values needed by this operation.

        const stateDropDownButton     = screen.getByRole ( "button", { name: "Open selection list: State 1" } );
        const eventDropDownButton     = screen.getByRole ( "button", { name: "Open selection list: Event 1" } );
        const nextStateDropDownButton = screen.getByRole ( "button", { name: "Open selection list: Next State 1" } );

        expect ( stateDropDownButton ).toHaveAttribute ( "aria-haspopup", "listbox" );
        expect ( eventDropDownButton ).toHaveAttribute ( "aria-haspopup", "listbox" );
        expect ( nextStateDropDownButton.parentElement ).toHaveTextContent ( "state_two" );

        await user.click ( nextStateDropDownButton );
        const nextStateListBox = screen.getByRole ( "listbox", { name: "Next State 1" } );

        await user.click ( within ( nextStateListBox ).getByRole ( "option", { name: "state_one" } ) );

        expect ( nextStateDropDownButton.parentElement ).toHaveTextContent ( "state_one" );
        expect ( toolbarButton ( "toolbar-undo" ) ).toBeEnabled ();

        await user.click ( screen.getByRole ( "button", { name: "Edit" } ) );
        expect ( screen.getByRole ( "dialog", { name: "Transition" } ) ).toBeVisible ();
        expect ( screen.getByRole ( "combobox", { name: "Next State" } ) ).toHaveValue ( "state_one" );
        await user.click ( screen.getByRole ( "button", { name: "Cancel" } ) );

        await user.click ( screen.getByRole ( "button", { name: "Delete" } ) );

        // Initialize the local values needed by this operation.

        const impactDialog        = screen.getByRole ( "dialog", { name: "Confirm cascading deletion" } );
        const confirmDeleteButton = within ( impactDialog ).getByRole ( "button", { name: "Delete" } );

        expect ( confirmDeleteButton ).toHaveFocus ();
        await user.keyboard ( "{Enter}" );
        expect ( screen.getByText ( "Transitions: 0" ) ).toBeVisible ();
    } );
} );

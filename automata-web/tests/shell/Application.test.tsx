// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Application Shell Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the exact tree-driven shell, command surfaces, routing, settings transaction, and
//   focus return.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Application } from "../../src/Application";
import
{
    DiagnosticChannel,
    MAXIMUM_CONSOLE_DIAGNOSTIC_BATCH_COUNT,
} from "../../src/application/diagnostic-channel";
import type { SolverJobPort } from "../../src/application/ports/contracts";
import { PREFERENCE_STORAGE_KEY } from "../../src/infrastructure/preferences";

describe ( "AL-UI-001 Phase 2 application shell", () =>
{
    beforeEach ( () => window.localStorage.clear () );
    afterEach ( cleanup );

    it ( "renders the exact desktop regions and initially collapsed route tree", () =>
    {
        render ( <Application /> );

        expect ( screen.getAllByText ( "Version 1.1.0" ).some ( element => element.className === "title-version" ) )
            .toBe ( true );
        expect ( screen.getByRole ( "menubar", { name: "Application menu" } ) ).toBeInTheDocument ();
        expect ( screen.getByRole ( "toolbar", { name: "Application commands" } ) ).toBeInTheDocument ();
        expect ( screen.getByRole ( "tree", { name: "Model" } ) ).toBeInTheDocument ();
        expect ( screen.getByRole ( "region", { name: "Detail" } ) ).toBeInTheDocument ();
        expect ( screen.getByRole ( "region", { name: "Console" } ) ).toBeInTheDocument ();
        expect ( screen.getByRole ( "contentinfo" ) ).toBeInTheDocument ();
        expect ( screen.queryByRole ( "tablist" ) ).not.toBeInTheDocument ();

        const treeItems = within ( screen.getByRole ( "tree", { name: "Model" } ) ).getAllByRole ( "treeitem" );

        expect ( treeItems.map ( item => item.lastElementChild?.textContent ) ).toEqual (
            [ "Editor", "Chart", "Solver", "Simulator" ]
        );
        expect ( screen.getByRole ( "treeitem", { name: "Solver" } ) ).toHaveAttribute ( "aria-selected", "true" );
        expect ( screen.getByRole ( "heading", { name: "State Machine Solution Solver" } ) ).toBeVisible ();
    } );

    it ( "expands the exact Editor hierarchy and routes with the tree keyboard model", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        const editor = screen.getByRole ( "treeitem", { name: "Editor" } );

        await user.click ( editor );
        await user.keyboard ( "{ArrowRight}" );

        const treeItems = within ( screen.getByRole ( "tree", { name: "Model" } ) ).getAllByRole ( "treeitem" );

        expect ( treeItems.map ( item => item.lastElementChild?.textContent ) ).toEqual (
            [
                "Editor",
                "State Machine",
                "States",
                "Events",
                "Actions",
                "Transition Table",
                "Chart",
                "Solver",
                "Simulator",
            ]
        );

        await user.keyboard ( "{ArrowRight}" );
        expect ( screen.getByRole ( "treeitem", { name: "State Machine" } ) ).toHaveFocus ();
        expect ( screen.getByRole ( "heading", { name: "State Machine — Initialization" } ) ).toBeVisible ();

        await user.keyboard ( "{End}" );
        expect ( screen.getByRole ( "treeitem", { name: "Simulator" } ) ).toHaveFocus ();
        expect ( screen.getByRole ( "heading", { name: "State Transducer Simulator" } ) ).toBeVisible ();
    } );

    it ( "expands the tree only to reveal a selected child page", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );

        //------------------------------------------------------------------------------------------
        // Function: editorNode
        //
        // Description:
        //
        //   Derives the editor node.
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
        //------------------------------------------------------------------------------------------

        const editorNode    = () => screen.getByRole ( "treeitem", { name: "Editor" } );

        //------------------------------------------------------------------------------------------
        // Function: visibleRoutes
        //
        // Description:
        //
        //   Derives the visible routes.
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
        //------------------------------------------------------------------------------------------

        const visibleRoutes = () => within ( screen.getByRole ( "tree", { name: "Model" } ) )
            .getAllByRole ( "treeitem" )
            .map ( item => item.lastElementChild?.textContent );

        // Selecting Editor navigates but does not open it. Its node is visible either way, so
        // opening it there would discard a state the user set for no navigational gain -- and Open,
        // New, and Pull all navigate on the user's behalf, which is how a tree the user closed used
        // to reopen itself every time a document appeared.

        expect ( visibleRoutes () ).toEqual ( [ "Editor", "Chart", "Solver", "Simulator" ] );
        expect ( editorNode () ).toHaveAttribute ( "aria-expanded", "false" );

        await user.click ( editorNode () );

        expect ( editorNode () ).toHaveAttribute ( "aria-expanded", "false" );
        expect ( editorNode () ).toHaveAttribute ( "aria-selected", "true" );

        await user.click (
            document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-editor']" ) ?? document.body );

        expect ( editorNode () ).toHaveAttribute ( "aria-expanded", "false" );

        // A command that lands on one of Editor's children must open it, because a tree cannot show
        // a selection it is hiding. New lands on State Machine.

        await user.click (
            document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-new']" ) ?? document.body );

        expect ( editorNode () ).toHaveAttribute ( "aria-expanded", "true" );
        expect ( screen.getByRole ( "treeitem", { name: "State Machine" } ) )
            .toHaveAttribute ( "aria-selected", "true" );
    } );

    it ( "opens the final User Guide URL in an isolated browser context", async () =>
    {
        // Initialize the local values needed by this operation.

        const user           = userEvent.setup ();
        const windowOpenMock = vi.spyOn ( window, "open" ).mockImplementation ( () => null );

        render ( <Application /> );
        await user.click ( screen.getByRole ( "menuitem", { name: "Help" } ) );
        await user.click ( screen.getByRole ( "menuitem", { name: "Documentation" } ) );

        expect ( windowOpenMock ).toHaveBeenCalledWith (
            new URL ( `${ import.meta.env.BASE_URL }docs/user-guide/`, window.location.origin ).href,
            "_blank",
            "noopener",
        );

        windowOpenMock.mockRestore ();
    } );
    it ( "places Phase 7 server commands in File and exposes no Server root menu", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        await waitFor ( () => expect (
            within ( screen.getByRole ( "contentinfo" ) ).getByText ( "Disconnected" ),
        ).toBeVisible () );
        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );

        expect ( screen.getByRole ( "menuitem", { name: "Pull Model from Server" } ) ).toBeDisabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Push Model to Server" } ) ).toBeDisabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Connect to Server" } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Disconnect from Server" } ) ).toBeDisabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Test Server" } ) ).toBeDisabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Import from CSV" } ) ).toBeDisabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Export to CSV" } ) ).toBeDisabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Page Setup" } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Print" } ) ).toBeDisabled ();
        expect ( screen.queryByRole ( "menuitem", { name: "Server" } ) ).not.toBeInTheDocument ();

        const fileMenuItems = within ( screen.getByRole ( "menu", { name: "File" } ) )
            .getAllByRole ( "menuitem" )
            .map ( item => item.textContent?.trim () );

        expect ( fileMenuItems.indexOf ( "Test Server" ) )
            .toBe ( fileMenuItems.indexOf ( "Disconnect from Server" ) + 1 );

        await user.keyboard ( "{Escape}" );
        await user.click (
            document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-new']" ) ?? document.body,
        );
        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );

        expect ( screen.getByRole ( "menuitem", { name: "Page Setup" } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Print" } ) ).toBeEnabled ();
    } );

    it ( "exposes Model Metadata in both CSV transfer submenus", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        await user.click (
            document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-new']" ) ?? document.body,
        );
        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );
        await user.click ( screen.getByRole ( "menuitem", { name: "Import from CSV" } ) );

        expect ( screen.getByRole ( "menuitem", { name: "Model Metadata" } ) ).toBeEnabled ();

        await user.keyboard ( "{Escape}{Escape}" );
        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );
        await user.click ( screen.getByRole ( "menuitem", { name: "Export to CSV" } ) );

        expect ( screen.getByRole ( "menuitem", { name: "Model Metadata" } ) ).toBeEnabled ();
    } );

    it ( "enables Save and Save As for a new metadata-only project while keeping Push disabled", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        await user.click (
            document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-new']" ) ?? document.body,
        );

        expect ( document.querySelector ( "[data-toolbar-entry='toolbar-save']" ) ).toBeEnabled ();
        expect ( document.querySelector ( "[data-toolbar-entry='toolbar-save-as']" ) ).toBeEnabled ();
        expect ( document.querySelector ( "[data-toolbar-entry='toolbar-push']" ) ).toBeDisabled ();
    } );

    it ( "uses the curated application, command, and theme icons", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );

        expect ( document.querySelector ( ".application-icon" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "custom/20/state-machine-application.png" ) );
        expect ( document.querySelector ( "[data-toolbar-entry='toolbar-chart'] img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "custom/20/state-machine-state-chart.svg" ) );
        expect ( document.querySelector ( "[data-toolbar-entry='toolbar-expand-chart-states'] img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "custom/20/state-machine-state-chart-palette-state.svg" ) );
        expect ( document.querySelector ( "[data-toolbar-entry='toolbar-theme'] img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "fluent/ic_fluent_dark_theme_20_regular.svg" ) );

        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );
        expect ( screen.getByRole ( "menuitem", { name: "Save As" } ).querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "custom/16/document-save-as.svg" ) );
        expect ( screen.getByRole ( "menuitem", { name: /^Close$/u } ).querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "fluent/ic_fluent_document_dismiss_16_regular.svg" ) );
        expect ( screen.getByRole ( "menuitem", { name: "Validate State Machine" } ).querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "fluent/ic_fluent_clipboard_task_list_16_regular.svg" ) );
        expect ( screen.getByRole ( "menuitem", { name: "Test Server" } ).querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "custom/16/server-test.svg" ) );
        expect ( screen.getByRole ( "menuitem", { name: "Connect to Server" } ).querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "custom/16/server-connect.svg" ) );
        expect ( screen.getByRole ( "menuitem", { name: "Disconnect from Server" } ).querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "custom/16/server-disconnect.svg" ) );
        expect ( screen.getByRole ( "menuitem", { name: "Page Setup" } ).querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "fluent/ic_fluent_document_settings_16_regular.svg" ) );
        expect ( screen.getByRole ( "menuitem", { name: "Print" } ).querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "fluent/ic_fluent_print_16_regular.svg" ) );

        await user.keyboard ( "{Escape}" );
        await user.click ( screen.getByRole ( "menuitem", { name: "View" } ) );
        const themeItem = screen.getByRole ( "menuitem", { name: "Theme" } );

        expect ( themeItem.querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "custom/16/theme-light-dark.svg" ) );
        await user.click ( themeItem );
        expect ( screen.getByRole ( "menuitemradio", { name: "Light" } ).querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "fluent/ic_fluent_weather_sunny_16_regular.svg" ) );
        expect ( screen.getByRole ( "menuitemradio", { name: "Dark" } ).querySelector ( "img" ) )
            .toHaveAttribute ( "src", expect.stringContaining ( "fluent/ic_fluent_weather_moon_16_regular.svg" ) );
    } );

    it ( "renders State Machine Info summaries as named group boxes", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        await user.click ( document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-new']" ) ?? document.body );
        await user.click ( document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-editor']" ) ?? document.body );

        // Initialize the local values needed by this operation.

        const dashboard       = document.querySelector <HTMLElement> ( ".editor-dashboard" );
        const informationPage = document.querySelector <HTMLElement> ( ".editor-info-page" );

        expect ( dashboard ).not.toBeNull ();
        expect ( Array.from ( dashboard?.querySelectorAll ( "legend" ) ?? [], legend => legend.textContent ) ).toEqual (
            [ "Model Metadata", "Initialization", "Validation", "Hosted Model", "Simulation" ],
        );
        expect ( Array.from ( informationPage?.children ?? [], child => child.className ) ).toEqual (
            [ "editor-dashboard", "detail-button-panel editor-info-actions" ],
        );
        expect ( screen.getByRole ( "button", { name: "Validate State Machine" } ).parentElement )
            .toHaveClass ( "detail-button-panel", "editor-info-actions" );
    } );

    it ( "mirrors direct navigation and Chart command availability in the toolbar", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );

        // Initialize the local values needed by this operation.

        const chartButton  = document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-chart']" );
        const expandButton = document.querySelector <HTMLButtonElement> (
            "[data-toolbar-entry='toolbar-expand-chart-states']"
        );

        expect ( chartButton ).not.toBeNull ();
        expect ( expandButton ).toBeDisabled ();
        await user.click ( chartButton ?? document.body );

        expect ( screen.getByRole ( "heading", { name: "State Chart" } ) ).toBeVisible ();
        expect ( expandButton ).toBeDisabled ();

        await user.click ( document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-new']" ) ?? document.body );
        await user.click ( chartButton ?? document.body );

        expect ( expandButton ).toBeEnabled ();
    } );

    it ( "uses a keyboard-accessible two-choice toolbar Theme menu", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        const themeButton = document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-theme']" );

        expect ( themeButton ).not.toBeNull ();
        themeButton?.focus ();
        await user.keyboard ( "{ArrowDown}" );
        expect ( themeButton ).toHaveAttribute ( "aria-expanded", "true" );
        expect ( screen.getByRole ( "menuitemradio", { name: "Dark" } ) ).toHaveFocus ();
        await user.keyboard ( "{ArrowUp}{Enter}" );

        await waitFor ( () =>
            expect ( document.querySelector ( ".application-shell" ) ).toHaveAttribute ( "data-theme", "light" ) );
        expect ( themeButton ).toHaveFocus ();
    } );

    it ( "applies settings atomically and discards a cancelled draft", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        const fileMenu = screen.getByRole ( "menuitem", { name: "File" } );

        await user.click ( fileMenu );
        await user.click ( screen.getByRole ( "menuitem", { name: "Settings" } ) );
        const saveBackup = screen.getByRole ( "checkbox", { name: "Save Backup" } );

        expect ( saveBackup ).not.toBeChecked ();
        await user.click ( saveBackup );
        await user.click ( screen.getByRole ( "button", { name: "Cancel" } ) );
        await waitFor ( () => expect ( fileMenu ).toHaveFocus () );

        await user.click ( fileMenu );
        await user.click ( screen.getByRole ( "menuitem", { name: "Settings" } ) );
        expect ( screen.getByRole ( "checkbox", { name: "Save Backup" } ) ).not.toBeChecked ();
        await user.click ( screen.getByRole ( "checkbox", { name: "Save Backup" } ) );
        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );
        await waitFor ( () =>
            expect ( screen.queryByRole ( "dialog", { name: "Application Settings" } ) ).not.toBeInTheDocument () );
        expect ( fileMenu ).toHaveFocus ();

        await waitFor ( () =>
        {
            // Initialize the local values needed by this operation.

            const stored = JSON.parse ( window.localStorage.getItem ( PREFERENCE_STORAGE_KEY ) ?? "{}" ) as {
                preferences?: { saveBackup?: boolean };
            };
            expect ( stored.preferences?.saveBackup ).toBe ( true );
        } );
    } );

    it ( "changes themes through View and persists only the preference envelope", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Application /> );
        await user.click ( screen.getByRole ( "menuitem", { name: "View" } ) );
        await user.click ( screen.getByRole ( "menuitem", { name: "Theme" } ) );
        await user.click ( screen.getByRole ( "menuitemradio", { name: "Dark" } ) );

        await waitFor ( () =>
            expect ( document.querySelector ( ".application-shell" ) ).toHaveAttribute ( "data-theme", "dark" ) );

        const stored = JSON.parse ( window.localStorage.getItem ( PREFERENCE_STORAGE_KEY ) ?? "{}" ) as {
            preferences?: { theme?: string };
            version?: number;
        };

        expect ( stored.version ).toBe ( 1 );
        expect ( stored.preferences?.theme ).toBe ( "Dark" );
        expect ( stored ).not.toHaveProperty ( "model" );
    } );

    it ( "keeps preferences active for the session when durable storage is denied", async () =>
    {
        // Initialize the local values needed by this operation.

        const storageWrite = vi.spyOn ( Storage.prototype, "setItem" ).mockImplementation ( () =>
        {
            throw new DOMException ( "Storage is unavailable.", "SecurityError" );
        } );


        // Run the operation that may report a recoverable failure.

        try
        {
            render ( <Application /> );

            await waitFor ( () =>
                expect ( screen.getByText ( /preferences could not be saved/u ) ).toBeInTheDocument () );
            expect ( document.querySelector ( ".application-shell" ) ).toHaveAttribute ( "data-theme", "dark" );
            expect ( screen.getByRole ( "heading", { name: "State Machine Solution Solver" } ) ).toBeVisible ();
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            storageWrite.mockRestore ();
        }
    } );

    it ( "starts with safe defaults when acquiring browser storage is denied", async () =>
    {
        // Initialize the local values needed by this operation.

        const storageGetter = vi.spyOn ( window, "localStorage", "get" ).mockImplementation ( () =>
        {
            throw new DOMException ( "Storage is unavailable.", "SecurityError" );
        } );


        // Run the operation that may report a recoverable failure.

        try
        {
            render ( <Application /> );

            await waitFor ( () => expect ( storageGetter ).toHaveBeenCalled () );
            expect ( document.querySelector ( ".application-shell" ) ).toHaveAttribute ( "data-theme", "dark" );
            expect ( screen.getByRole ( "heading", { name: "State Machine Solution Solver" } ) ).toBeVisible ();
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            storageGetter.mockRestore ();
        }
    } );

    it ( "leaves Solver running state after an unavailable Worker failure and permits retry", async () =>
    {
        // Initialize the local values needed by this operation.

        const user                         = userEvent.setup ();
        let solveAttemptCount              = 0;
        const solverJobPort: SolverJobPort = {
            cancel: () => Promise.resolve (),
            solve: () =>
            {
                solveAttemptCount++;

                // Return the reject result.

                return Promise.reject ( new Error ( "Hostile browser failure must not escape." ) );
            },
        };

        render ( <Application solverJobPort={ solverJobPort } /> );
        await user.click (
            document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-new']" ) ?? document.body,
        );
        await user.click ( screen.getByRole ( "treeitem", { name: "Solver" } ) );
        await user.click ( screen.getByRole ( "button", { name: "Solve" } ) );

        await waitFor ( () => expect ( solveAttemptCount ).toBe ( 1 ) );
        expect ( await screen.findByText ( "Solver inference failed. Review the Console diagnostics." ) )
            .toBeVisible ();
        expect ( screen.getByText ( "SOLVER_FAILURE" ) ).toBeVisible ();
        expect ( screen.getAllByText ( /The Solver Worker is unavailable\./u ).some ( element =>
            element.classList.contains ( "console-text" ) ) ).toBe ( true );
        expect ( screen.queryByRole ( "button", { name: "Cancel Solve" } ) ).not.toBeInTheDocument ();
        expect ( screen.getByRole ( "button", { name: "Solve" } ) ).toBeEnabled ();

        await user.click ( screen.getByRole ( "button", { name: "OK" } ) );
        await user.click ( screen.getByRole ( "button", { name: "Solve" } ) );

        await waitFor ( () => expect ( solveAttemptCount ).toBe ( 2 ) );
        expect ( screen.queryByRole ( "button", { name: "Cancel Solve" } ) ).not.toBeInTheDocument ();
        expect ( screen.getByRole ( "button", { name: "Solve" } ) ).toBeEnabled ();
    } );

    it ( "publishes at most 100 ordered Solver diagnostics plus one omission summary", async () =>
    {
        // Initialize the local values needed by this operation.

        const user                         = userEvent.setup ();
        const diagnosticChannel            = new DiagnosticChannel ();
        const diagnosticCount              = MAXIMUM_CONSOLE_DIAGNOSTIC_BATCH_COUNT + 25;
        const solverJobPort: SolverJobPort = 
        {
            cancel: () => Promise.resolve (),
            solve: () => Promise.resolve ( {
                diagnostics: Array.from ( { length: diagnosticCount }, ( _, index ) => ( {
                    code: "SOLVER_FAILURE" as const,
                    message: `Ordered diagnostic ${index}`,
                    relatedLocations: [],
                    remediation: "Retry after reviewing this diagnostic.",
                    severity: "error" as const,
                } ) ),
                status: "failure" as const,
            } ),
        };

        render ( <Application diagnosticChannel={ diagnosticChannel } solverJobPort={ solverJobPort } /> );
        await user.click (
            document.querySelector <HTMLButtonElement> ( "[data-toolbar-entry='toolbar-new']" ) ?? document.body,
        );
        await user.click ( screen.getByRole ( "treeitem", { name: "Solver" } ) );
        await user.click ( screen.getByRole ( "button", { name: "Solve" } ) );
        await screen.findByText ( "Solver inference failed. Review the Console diagnostics." );


        // Initialize the local values needed by this operation.

        const entries           = diagnosticChannel.getEntries ();
        const diagnosticEntries = entries.filter ( entry => entry.code === "SOLVER_FAILURE" );
        const omissionEntries   = entries.filter ( entry => entry.code === "DIAGNOSTICS_TRUNCATED" );

        expect ( diagnosticEntries ).toHaveLength ( MAXIMUM_CONSOLE_DIAGNOSTIC_BATCH_COUNT );
        expect ( diagnosticEntries [ 0 ]?.text ).toContain ( "Ordered diagnostic 0" );
        expect ( diagnosticEntries.at ( -1 )?.text ).toContain (
            `Ordered diagnostic ${MAXIMUM_CONSOLE_DIAGNOSTIC_BATCH_COUNT - 1}`,
        );
        expect ( entries.some ( entry => entry.text.includes ( "Ordered diagnostic 100" ) ) ).toBe ( false );
        expect ( omissionEntries ).toHaveLength ( 1 );
        expect ( omissionEntries [ 0 ]?.text ).toContain ( "25 additional diagnostic(s)" );
    } );
} );

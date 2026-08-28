// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Console Panel Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies structured Console filtering, duplicate-code identity, keyboard navigation, context
//   routing, and clearing.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConsoleEntry } from "../../src/application/contracts";
import { COMPILE_TIME_CONFIGURATION } from "../../src/configuration/compile-time-configuration";
import { ConsolePanel } from "../../src/presentation/console/ConsolePanel";

const ENTRIES: readonly ConsoleEntry[] = [
    {
        code: "MODEL_NOTE",
        identifier: "first-note",
        severity: "message",
        source: "Editor",
        text: "First message",
        timestamp: "2026-08-10T08:00:00.000Z",
    },
    {
        code: "MODEL_NOTE",
        context: { label: "States", route: "states" },
        identifier: "second-note",
        severity: "warning",
        source: "Validator",
        text: "Second message",
        timestamp: "2026-08-10T08:00:01.000Z",
    },
];

describe ( "AL-CON-001 structured Console panel", () =>
{
    afterEach ( cleanup );

    it ( "keeps duplicate codes independently selectable and routes contextual entries", async () =>
    {
        // Initialize the local values needed by this operation.

        const user     = userEvent.setup ();
        const navigate = vi.fn ();

        render (
            <ConsolePanel
                entries             = { ENTRIES }
                filters             = { { error: true, message: true, warning: true } }
                followTail          = { true }
                onClear             = { vi.fn () }
                onFiltersChange     = { vi.fn () }
                onFollowTailChange  = { vi.fn () }
                onNavigateToContext = { navigate }
            />
        );

        const rows = screen.getAllByRole ( "row" );

        expect ( rows ).toHaveLength ( 2 );
        rows [ 0 ]?.focus ();
        await user.keyboard ( "{ArrowDown}" );
        expect ( rows [ 1 ] ).toHaveFocus ();
        await user.keyboard ( "{Enter}" );
        expect ( navigate ).toHaveBeenCalledWith ( "states" );
    } );

    it ( "dispatches filters, follow-tail changes, and clear without mutating entries", async () =>
    {
        // Initialize the local values needed by this operation.

        const user             = userEvent.setup ();
        const clear            = vi.fn ();
        const changeFilters    = vi.fn ();
        const changeFollowTail = vi.fn ();

        render (
            <ConsolePanel
                entries             = { ENTRIES }
                filters             = { { error: true, message: true, warning: true } }
                followTail          = { true }
                onClear             = { clear }
                onFiltersChange     = { changeFilters }
                onFollowTailChange  = { changeFollowTail }
                onNavigateToContext = { vi.fn () }
            />
        );

        await user.click ( screen.getByRole ( "checkbox", { name: "Warnings" } ) );
        expect ( changeFilters ).toHaveBeenCalledWith ( { error: true, message: true, warning: false } );
        await user.click ( screen.getByRole ( "checkbox", { name: "Follow Tail" } ) );
        expect ( changeFollowTail ).toHaveBeenCalledWith ( false );
        await user.click ( screen.getByRole ( "button", { name: "Clear" } ) );
        expect ( clear ).toHaveBeenCalledOnce ();
        expect ( ENTRIES ).toHaveLength ( 2 );
    } );

    it ( "progressively renders bounded Console rows while retaining the full accessible row count", () =>
    {
        // Initialize the local values needed by this operation.

        const initialItemCount = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const entries          = Array.from ( { length: initialItemCount + 50 }, ( _, index ): ConsoleEntry => ( {
            code:       "MODEL_NOTE",
            identifier: `note-${index}`,
            severity:   "message",
            source:     "Editor",
            text:       `Message ${index}`,
            timestamp:  new Date ( Date.UTC ( 2026, 7, 10, 8, 0, index ) ).toISOString (),
        } ) );

        render (
            <ConsolePanel
                entries             = { entries }
                filters             = { { error: true, message: true, warning: true } }
                followTail          = { false }
                onClear             = { vi.fn () }
                onFiltersChange     = { vi.fn () }
                onFollowTailChange  = { vi.fn () }
                onNavigateToContext = { vi.fn () }
            />
        );

        const grid = screen.getByRole ( "grid", { name: "Console" } );

        expect ( screen.getAllByRole ( "row" ) ).toHaveLength ( initialItemCount );
        expect ( grid ).toHaveAttribute ( "aria-rowcount", String ( entries.length ) );
        expect ( screen.getByText ( "Message 0" ) ).toBeInTheDocument ();
        expect ( screen.queryByText ( `Message ${entries.length - 1}` ) ).not.toBeInTheDocument ();

        Object.defineProperties ( grid,
            {
                clientHeight: { configurable: true, value: 200 },
                scrollHeight: { configurable: true, value: 2_000 },
                scrollTop:    { configurable: true, value: 1_850 },
            }
        );
        fireEvent.scroll ( grid );

        expect ( screen.getAllByRole ( "row" ) ).toHaveLength ( entries.length );
        expect ( screen.getByText ( `Message ${entries.length - 1}` ) ).toBeInTheDocument ();
    } );

    it ( "starts a follow-tail Console at the newest bounded batch", () =>
    {
        // Initialize the local values needed by this operation.

        const initialItemCount = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const entries          = Array.from ( { length: initialItemCount + 2 }, ( _, index ): ConsoleEntry => ( {
            code:       "MODEL_NOTE",
            identifier: `tail-note-${index}`,
            severity:   "message",
            source:     "Editor",
            text:       `Tail message ${index}`,
            timestamp:  new Date ( Date.UTC ( 2026, 7, 10, 8, 0, index ) ).toISOString (),
        } ) );

        render (
            <ConsolePanel
                entries             = { entries }
                filters             = { { error: true, message: true, warning: true } }
                followTail          = { true }
                onClear             = { vi.fn () }
                onFiltersChange     = { vi.fn () }
                onFollowTailChange  = { vi.fn () }
                onNavigateToContext = { vi.fn () }
            />
        );

        expect ( screen.getAllByRole ( "row" ) ).toHaveLength ( initialItemCount );
        expect ( screen.queryByText ( "Tail message 0" ) ).not.toBeInTheDocument ();
        expect ( screen.getByText ( `Tail message ${entries.length - 1}` ) ).toBeInTheDocument ();
    } );

    it ( "reveals and focuses a row beyond the initial progressive batch with End", () =>
    {
        // Initialize the local values needed by this operation.

        const initialItemCount = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const entries          = Array.from ( { length: initialItemCount + 50 }, ( _, index ): ConsoleEntry => ( {
            code:       "MODEL_NOTE",
            identifier: `keyboard-note-${index}`,
            severity:   "message",
            source:     "Editor",
            text:       `Keyboard message ${index}`,
            timestamp:  new Date ( Date.UTC ( 2026, 7, 10, 8, 0, index ) ).toISOString (),
        } ) );

        render (
            <ConsolePanel
                entries             = { entries }
                filters             = { { error: true, message: true, warning: true } }
                followTail          = { false }
                onClear             = { vi.fn () }
                onFiltersChange     = { vi.fn () }
                onFollowTailChange  = { vi.fn () }
                onNavigateToContext = { vi.fn () }
            />
        );

        const firstRow = screen.getAllByRole ( "row" ) [ 0 ];

        firstRow?.focus ();
        fireEvent.keyDown ( firstRow ?? document.body, { key: "End" } );

        // Calculate the final row value from the current inputs.

        const finalRow = screen.getByText ( `Keyboard message ${entries.length - 1}` ).closest ( "[role='row']" );

        expect ( screen.getAllByRole ( "row" ) ).toHaveLength ( entries.length );
        expect ( finalRow ).toHaveFocus ();
    } );
} );

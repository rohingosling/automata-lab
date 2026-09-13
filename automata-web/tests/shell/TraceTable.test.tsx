// @vitest-environment jsdom

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Trace Table Tests
// Version: 1.0.0
// Date:    2026-09-13
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies bounded trace rendering after an empty state and preserves follow-tail behavior when
//   the content viewport changes through resizing or configurable trailing clearance.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRACE_ROW_HEIGHT, TraceTable } from "../../src/presentation/simulator/TraceTable.js";
import type { TraceTableColumn } from "../../src/presentation/simulator/TraceTable.js";

const COLUMNS: readonly TraceTableColumn<number>[] =
[
    { headingKey: "simulator.column.event", value: entry => `row_${entry}` },
];

const ENTRIES = Array.from ( { length: 1000 }, ( _, index ) => index );

const observedElements = new Map<Element, () => void> ();
let viewportHeight     = 264;
let bottomPadding      = 4;
let stylesheet: HTMLStyleElement;

beforeEach ( () =>
{
    viewportHeight = 264;
    bottomPadding  = 4;
    stylesheet     = document.createElement ( "style" );
    stylesheet.textContent = ".simulator-trace-scroll { padding-bottom: 4px; }";
    document.head.append ( stylesheet );

    vi.spyOn ( HTMLElement.prototype, "clientHeight", "get" ).mockImplementation (
        function ( this: HTMLElement )
        {
            return this.classList.contains ( "simulator-trace-scroll" ) ? viewportHeight : 0;
        },
    );
    vi.spyOn ( HTMLElement.prototype, "scrollHeight", "get" ).mockImplementation (
        function ( this: HTMLElement )
        {
            const rowCount = Number ( this.querySelector ( "table" )?.getAttribute ( "aria-rowcount" ) ?? 0 );

            return Math.max ( viewportHeight, rowCount * TRACE_ROW_HEIGHT + bottomPadding );
        },
    );

    vi.stubGlobal ( "ResizeObserver", class implements ResizeObserver
    {
        readonly callback: ResizeObserverCallback;

        constructor ( callback: ResizeObserverCallback )
        {
            this.callback = callback;
        }

        observe ( element: Element ): void
        {
            observedElements.set ( element, () => this.callback ( [], this ) );
        }

        unobserve ( element: Element ): void
        {
            observedElements.delete ( element );
        }

        disconnect (): void
        {
            observedElements.clear ();
        }
    } );
} );

afterEach ( () =>
{
    cleanup ();
    stylesheet.remove ();
    observedElements.clear ();
    vi.restoreAllMocks ();
    vi.unstubAllGlobals ();
} );

function renderTrace ( entries: readonly number[] )
{
    return <TraceTable columns={ COLUMNS } emptyMessage="No entries" entries={ entries } labelledBy="trace-heading" />;
}

function findScrollElement ( container: HTMLElement ): HTMLDivElement
{
    const scrollElement = container.querySelector<HTMLDivElement> ( ".simulator-trace-scroll" );

    if ( scrollElement === null )
    {
        throw new Error ( "The populated trace has no scroll element." );
    }
    return scrollElement;
}

function resizeTrace ( height: number, padding: number = bottomPadding ): void
{
    act ( () =>
    {
        viewportHeight = height;
        bottomPadding  = padding;
        stylesheet.textContent = `.simulator-trace-scroll { padding-bottom: ${padding}px; }`;

        for ( const notifyResize of observedElements.values () )
        {
            notifyResize ();
        }
    } );
}

describe ( "trace scroll clearance", () =>
{
    it ( "observes a trace populated after its empty state and renders enough rows after expansion", () =>
    {
        const rendered = render ( renderTrace ( [] ) );

        expect ( screen.getByText ( "No entries" ) ).toBeInTheDocument ();
        expect ( observedElements.size ).toBe ( 0 );

        rendered.rerender ( renderTrace ( ENTRIES ) );

        const scrollElement = findScrollElement ( rendered.container );

        expect ( observedElements.has ( scrollElement ) ).toBe ( true );
        scrollElement.scrollTop = 0;
        fireEvent.scroll ( scrollElement );
        expect ( screen.queryByRole ( "cell", { name: "row_19" } ) ).not.toBeInTheDocument ();

        resizeTrace ( 524 );

        expect ( screen.getByRole ( "cell", { name: "row_19" } ) ).toBeInTheDocument ();
        expect ( screen.getAllByRole ( "row" ).length ).toBeLessThan ( 50 );
        expect ( scrollElement.scrollTop ).toBe ( 0 );

        rendered.rerender ( renderTrace ( [] ) );
        expect ( observedElements.size ).toBe ( 0 );
    } );

    it ( "keeps the padded end visible on resize and preserves a reader's released scroll position", () =>
    {
        const rendered = render ( renderTrace ( ENTRIES ) );
        const scrollElement = findScrollElement ( rendered.container );

        expect ( scrollElement.scrollTop ).toBe ( scrollElement.scrollHeight - viewportHeight );
        expect ( screen.getByRole ( "cell", { name: "row_999" } ) ).toBeInTheDocument ();

        resizeTrace ( 134 );
        expect ( scrollElement.scrollTop ).toBe ( scrollElement.scrollHeight - viewportHeight );

        const previousEnd = scrollElement.scrollTop;

        resizeTrace ( 134, 8 );
        expect ( scrollElement.scrollTop ).toBe ( previousEnd + 4 );
        expect ( screen.getByRole ( "cell", { name: "row_999" } ) ).toBeInTheDocument ();

        scrollElement.scrollTop = 100;
        fireEvent.scroll ( scrollElement );
        resizeTrace ( 108, 12 );
        rendered.rerender ( renderTrace ( [ ...ENTRIES, 1000 ] ) );

        expect ( scrollElement.scrollTop ).toBe ( 100 );
        expect ( screen.queryByRole ( "cell", { name: "row_1000" } ) ).not.toBeInTheDocument ();
    } );
} );
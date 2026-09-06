// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Trace Table
// Version: 1.0.0
// Date:    2026-08-20
// Author:  Rohin Gosling
//
// Description:
//
//   Renders one Simulator trace as a scrolling table of uniform-height rows.
//
//   A trace retains up to 50,000 entries and two of them are on screen at once, so the rows are
//   windowed: only the interval the scroll position selects is placed in the DOM, and two spacer
//   rows carry the height of everything above and below it. The scroll range therefore covers every
//   retained entry while the row count stays bounded. Uniform row height is what makes that
//   windowing exact rather than approximate, which is why the height is owned here as a number and
//   published to CSS as a custom property rather than being declared in both places.
//
//   A table scrolled to its end follows each newly appended row. Scrolling away releases the
//   follow, so a user reading earlier rows is not dragged to the bottom by traffic still arriving,
//   and returning to the end resumes it.
//
//   The table remains bounded while preserving access to every retained trace entry.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, UIEvent } from "react";

import { text } from "../../localization/messages.js";
import type { MessageKey } from "../../localization/messages.js";

// The row height in CSS pixels, and the number of rows rendered beyond each edge of the viewport so
// that a fast drag does not expose an unpainted band before the scroll handler runs.

export const TRACE_ROW_HEIGHT     = 26;
const        TRACE_ROW_OVERSCAN   = 8;

// A scroll position is treated as being at the end while it is within this many pixels of it.
// Sub-pixel layout and fractional device pixel ratios mean an exact equality test would release the
// follow on displays where it should hold.

const END_PROXIMITY_THRESHOLD = 2;

//--------------------------------------------------------------------------------------------------
// Interface: TraceTableColumn
//
// Description:
//
//   Defines the structure of trace table column.
//
//--------------------------------------------------------------------------------------------------

export interface TraceTableColumn<TEntry>
{
    readonly headingKey: MessageKey;
    readonly value:      ( entry: TEntry ) => string;
}

//--------------------------------------------------------------------------------------------------
// Interface: TraceTableProperties
//
// Description:
//
//   Defines the properties accepted by the trace table interface.
//
//--------------------------------------------------------------------------------------------------

export interface TraceTableProperties<TEntry>
{
    readonly columns:      readonly TraceTableColumn<TEntry>[];
    readonly emptyMessage: string;
    readonly entries:      readonly TEntry[];
    readonly labelledBy:   string;
    readonly rowOutcome?:  ( ( entry: TEntry ) => string | undefined ) | undefined;
}

//--------------------------------------------------------------------------------------------------
// Function: TraceTable
//
// Description:
//
//   Renders the trace table interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered trace table interface.
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

export function TraceTable<TEntry> ( properties: TraceTableProperties<TEntry> )
{
    // Initialize the local values needed by this operation.

    const scrollReference = useRef<HTMLDivElement> ( null );
    const [ scrollTop, setScrollTop ]           = useState ( 0 );
    const [ viewportHeight, setViewportHeight ] = useState ( 0 );
    const [ isPinnedToEnd, setIsPinnedToEnd ]   = useState ( true );

    const entryCount = properties.entries.length;

    // The pane is resized by a splitter and by the window, so the viewport height is observed
    // rather than measured once. Without it the rendered window would keep the height it had when
    // the table first mounted.

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const scrollElement = scrollReference.current;

        // Handle the case where scroll element matches an absent value.

        if ( scrollElement === null )
        {
            // Return control to the caller.

            return;
        }

        //------------------------------------------------------------------------------------------
        // Function: measureViewport
        //
        // Description:
        //
        //   Calculates viewport.
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
        //------------------------------------------------------------------------------------------

        function measureViewport (): void
        {
            setViewportHeight ( scrollElement?.clientHeight ?? 0 );
        }

        measureViewport ();

        // Handle the case where current value matches "undefined".

        if ( typeof ResizeObserver === "undefined" )
        {
            window.addEventListener ( "resize", measureViewport );

            // Return the computed result.

            return () => window.removeEventListener ( "resize", measureViewport );
        }

        const observer = new ResizeObserver ( measureViewport );

        observer.observe ( scrollElement );

        // Return the computed result.

        return () => observer.disconnect ();
    }, [] );

    // Following the tail is a layout effect so the scroll position is corrected in the same frame
    // the new rows are painted. As a passive effect it would show the old position for one frame
    // and visibly jump.
    //
    // Appending rows takes more than one render to settle: the first adds the rows, and each later
    // one re-selects the window now that the scroll position has moved, which shifts the content
    // height slightly as real rows swap places with spacer height. Correcting only on the row count
    // therefore left the view a few pixels short of the end. Depending on the scroll position as
    // well makes the effect re-run until the two agree, and both writes are guarded against being
    // no-ops so the sequence terminates rather than cycling.

    useLayoutEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const scrollElement = scrollReference.current;

        // Handle the case where at least one branch condition is satisfied.

        if ( scrollElement === null || !isPinnedToEnd )
        {
            // Return control to the caller.

            return;
        }

        // Calculate the end position value from the current inputs.

        const endPosition = scrollElement.scrollHeight - scrollElement.clientHeight;

        // Handle the case where abs result exceeds 0.5.

        if ( Math.abs ( scrollElement.scrollTop - endPosition ) > 0.5 )
        {
            scrollElement.scrollTop = endPosition;
        }

        // Handle the case where scroll element scroll top differs from scroll top.

        if ( scrollElement.scrollTop !== scrollTop )
        {
            setScrollTop ( scrollElement.scrollTop );
        }
    }, [ entryCount, isPinnedToEnd, scrollTop ] );

    //----------------------------------------------------------------------------------------------
    // Function: handleScroll
    //
    // Description:
    //
    //   Handles scroll.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
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

    function handleScroll ( event: UIEvent<HTMLDivElement> ): void
    {
        // Initialize the local values needed by this operation.

        const scrollElement = event.currentTarget;
        const distanceToEnd = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;

        setScrollTop ( scrollElement.scrollTop );
        setIsPinnedToEnd ( distanceToEnd <= END_PROXIMITY_THRESHOLD );
    }

    // Handle the case where entry count matches 0.

    if ( entryCount === 0 )
    {
        // Return the rendered interface.

        return <p className="simulator-trace-empty">{ properties.emptyMessage }</p>;
    }

    // The window is the interval the scroll position selects, widened by the overscan and clamped
    // to the trace.

    const firstVisibleRow = Math.floor ( scrollTop / TRACE_ROW_HEIGHT );
    const visibleRowCount = Math.ceil ( ( viewportHeight || TRACE_ROW_HEIGHT ) / TRACE_ROW_HEIGHT );
    const startIndex      = Math.max ( 0, firstVisibleRow - TRACE_ROW_OVERSCAN );
    const endIndex        = Math.min ( entryCount, firstVisibleRow + visibleRowCount + TRACE_ROW_OVERSCAN );
    const leadingSpace    = startIndex * TRACE_ROW_HEIGHT;
    const trailingSpace   = ( entryCount - endIndex ) * TRACE_ROW_HEIGHT;
    const windowedEntries = properties.entries.slice ( startIndex, endIndex );

    // Return the rendered interface.

    return (
        <div
            className = "simulator-trace-scroll"
            onScroll  = { handleScroll }
            ref       = { scrollReference }
            style     = { { "--simulator-trace-row-height": `${TRACE_ROW_HEIGHT}px` } as CSSProperties }
            tabIndex  = { 0 }
        >
            <table
                aria-labelledby={ properties.labelledBy }
                aria-rowcount={ entryCount + 1 }
                className="data-table simulator-trace-table"
            >
                <thead>
                    <tr aria-rowindex={ 1 }>
                        { properties.columns.map ( column => (
                            <th key={ column.headingKey } scope="col">{ text ( column.headingKey ) }</th>
                        ) ) }
                    </tr>
                </thead>
                <tbody>
                    { leadingSpace > 0 && (
                        <tr aria-hidden="true" className="simulator-trace-spacer">
                            <td colSpan={ properties.columns.length } style={ { height: `${leadingSpace}px` } } />
                        </tr>
                    ) }
                    { windowedEntries.map ( ( entry, windowIndex ) =>
                    {
                        // Initialize the local values needed by this operation.

                        const entryIndex = startIndex + windowIndex;
                        const outcome    = properties.rowOutcome?.( entry );

                        // Return the rendered interface.

                        return (
                            <tr
                                aria-rowindex={ entryIndex + 2 }
                                key={ entryIndex }
                                { ...( outcome === undefined ? {} : { "data-outcome": outcome } ) }
                            >
                                { properties.columns.map ( column =>
                                {
                                    // Initialize the local values needed by this operation.

                                    const value = column.value ( entry );

                                    // Return the rendered interface.

                                    return <td key={ column.headingKey } title={ value }>{ value }</td>;
                                } ) }
                            </tr>
                        );
                    } ) }
                    { trailingSpace > 0 && (
                        <tr aria-hidden="true" className="simulator-trace-spacer">
                            <td colSpan={ properties.columns.length } style={ { height: `${trailingSpace}px` } } />
                        </tr>
                    ) }
                </tbody>
            </table>
        </div>
    );
}

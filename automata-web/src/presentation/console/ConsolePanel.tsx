// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Console Panel
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Presents bounded structured Console entries with filtering, follow-tail, clearing, navigation,
//   and copy support.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

import type { ConsoleEntry, ConsoleFilterState, ConsoleContext } from "../../application/contracts";
import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration";
import { text } from "../../localization/messages";
import { consoleSeverityButtonStyle } from "../shared/button-colors";
import { isNearScrollableEnd, useProgressiveRendering } from "../shared/progressive-rendering";

const COLUMN_CONFIGURATION = COMPILE_TIME_CONFIGURATION.shell.consoleColumns;
const RESIZABLE_COLUMNS = [ "time", "severity", "code", "source", "message" ] as const;
type ConsoleColumn = typeof RESIZABLE_COLUMNS[number];

//--------------------------------------------------------------------------------------------------
// Interface: ConsolePanelProperties
//
// Description:
//
//   Defines the properties accepted by the console panel interface.
//
//--------------------------------------------------------------------------------------------------

interface ConsolePanelProperties
{
    readonly entries:             readonly ConsoleEntry[];
    readonly filters:             ConsoleFilterState;
    readonly followTail:          boolean;
    readonly onClear:             () => void;
    readonly onFiltersChange:     ( filters: ConsoleFilterState ) => void;
    readonly onFollowTailChange:  ( followTail: boolean ) => void;
    readonly onNavigateToContext: ( context: ConsoleContext ) => void;
}

//--------------------------------------------------------------------------------------------------
// Function: formatTime
//
// Description:
//
//   Formats the time.
//
// Parameters:
//
//   - timestamp:
//     The timestamp supplied to the operation.
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

function formatTime ( timestamp: string ): string
{
    // Return the to locale time string result.

    return new Date ( timestamp ).toLocaleTimeString ( [],
        {
            hour:   "2-digit",
            hour12: false,
            minute: "2-digit",
            second: "2-digit",
        }
    );
}

//--------------------------------------------------------------------------------------------------
// Function: formatEntryForCopy
//
// Description:
//
//   Formats the entry for copy.
//
// Parameters:
//
//   - entry:
//     The entry supplied to the operation.
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

function formatEntryForCopy ( entry: ConsoleEntry ): string
{
    // Return the computed result.

    return `${formatTime ( entry.timestamp )}\t${entry.severity}\t${entry.code}\t${entry.source}\t${entry.text}`;
}

//--------------------------------------------------------------------------------------------------
// Function: severitySymbol
//
// Description:
//
//   Derives the severity symbol.
//
// Parameters:
//
//   - entry:
//     The entry supplied to the operation.
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

function severitySymbol ( entry: ConsoleEntry ): string
{
    // Handle the case where entry severity matches the error value.

    if ( entry.severity === "error" )
    {
        // Return the computed result.

        return "E";
    }

    // Handle the case where entry severity matches the warning value.

    if ( entry.severity === "warning" )
    {
        // Return the computed result.

        return "W";
    }

    // Return the computed result.

    return "M";
}

//--------------------------------------------------------------------------------------------------
// Function: ConsolePanel
//
// Description:
//
//   Renders the console panel interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered console panel interface.
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

export function ConsolePanel ( properties: ConsolePanelProperties )
{
    // Initialize the local values needed by this operation.

    const [ selectedIdentifier, setSelectedIdentifier ] = useState <string | null> ( null );
    const [ columnWidths, setColumnWidths ] = useState <Record <ConsoleColumn, number>> ( COLUMN_CONFIGURATION.widths );
    const [ messageWidthIsFixed, setMessageWidthIsFixed ] = useState ( false );
    const columnDragReference = useRef <{ column: ConsoleColumn; pointerIdentifier: number; startX: number; startWidth: number } | null> ( null );
    const columnStyle =
    {
        "--console-columns": RESIZABLE_COLUMNS.map ( column => column === "message" && !messageWidthIsFixed
            ? `minmax(${columnWidths [ column ]}px, 1fr)` : `${columnWidths [ column ]}px` ).join ( " " )
            + ` ${COLUMN_CONFIGURATION.destinationWidth}px`,
        "--console-minimum-width": `${Object.values ( columnWidths ).reduce ( ( total, width ) => total + width, 0 )
            + COLUMN_CONFIGURATION.destinationWidth + 60}px`,
    } as CSSProperties;

    // Resize state belongs to this Console session and never enters model or Undo history.

    function resizeColumn ( column: ConsoleColumn, width: number ): void
    {
        setColumnWidths ( current => ( { ...current, [ column ]: Math.round ( Math.min (
            COLUMN_CONFIGURATION.maximumWidth, Math.max ( COLUMN_CONFIGURATION.minimumWidths [ column ], width ) ) ) } ) );
        if ( column === "message" )
        {
            setMessageWidthIsFixed ( true );
        }
    }

    const bodyReference          = useRef <HTMLDivElement> ( null );
    const rowReferences          = useRef <Map <string, HTMLDivElement>> ( new Map () );
    const pendingFocusIdentifier = useRef <string | null> ( null );
    const visibleEntries         = useMemo (
        () => properties.entries.filter ( entry => properties.filters [ entry.severity ] ),
        [ properties.entries, properties.filters ]
    );
    const progressiveRendering = useProgressiveRendering ( visibleEntries.length );
    const renderedStartIndex   = properties.followTail
        ? Math.max ( 0, visibleEntries.length - progressiveRendering.visibleItemCount )
        : 0;
    const renderedEntries = visibleEntries.slice (
        renderedStartIndex,
        renderedStartIndex + progressiveRendering.visibleItemCount,
    );

    useEffect ( () =>
    {
        // Handle the case where all required conditions are satisfied.

        if ( properties.followTail && bodyReference.current !== null )
        {
            bodyReference.current.scrollTop = bodyReference.current.scrollHeight;
        }
    }, [ properties.followTail, renderedEntries ] );

    const effectiveSelectedIdentifier = selectedIdentifier !== null
        && renderedEntries.some ( entry => entry.identifier === selectedIdentifier )
        ? selectedIdentifier
        : properties.followTail
            ? renderedEntries.at ( -1 )?.identifier ?? null
            : renderedEntries [ 0 ]?.identifier ?? null;

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const identifier = pendingFocusIdentifier.current;

        // Handle the case where identifier differs from an absent value.

        if ( identifier !== null )
        {
            // Initialize the local values needed by this operation.

            const element = rowReferences.current.get ( identifier );

            // Handle the case where element differs from undefined.

            if ( element !== undefined )
            {
                pendingFocusIdentifier.current = null;
                element.focus ();
            }
        }
    }, [ effectiveSelectedIdentifier, progressiveRendering.visibleItemCount ] );

    //----------------------------------------------------------------------------------------------
    // Function: toggleFilter
    //
    // Description:
    //
    //   Handles the toggle filter behavior.
    //
    // Parameters:
    //
    //   - severity:
    //     The severity supplied to the operation.
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

    function toggleFilter ( severity: keyof ConsoleFilterState ): void
    {
        properties.onFiltersChange ( { ...properties.filters, [ severity ]: !properties.filters [ severity ] } );
    }

    //----------------------------------------------------------------------------------------------
    // Function: selectRelativeEntry
    //
    // Description:
    //
    //   Selects relative entry.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - offset:
    //     The offset supplied to the operation.
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

    function selectRelativeEntry ( event: KeyboardEvent <HTMLDivElement>, offset: number ): void
    {
        // Initialize the local values needed by this operation.

        const currentIndex = visibleEntries.findIndex ( entry => entry.identifier === effectiveSelectedIdentifier );
        const nextIndex    = Math.min ( visibleEntries.length - 1, Math.max ( 0, currentIndex + offset ) );
        const nextEntry    = visibleEntries [ nextIndex ];

        // Handle the case where next entry differs from undefined.

        if ( nextEntry !== undefined )
        {
            event.preventDefault ();
            setSelectedIdentifier ( nextEntry.identifier );
            focusEntry ( nextEntry.identifier, nextIndex );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: focusEntry
    //
    // Description:
    //
    //   Focuses the entry.
    //
    // Parameters:
    //
    //   - identifier:
    //     The identifier supplied to the operation.
    //
    //   - entryIndex:
    //     The entry index supplied to the operation.
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

    function focusEntry ( identifier: string, entryIndex: number ): void
    {
        // Initialize the local values needed by this operation.

        const element = rowReferences.current.get ( identifier );

        // Handle the case where element differs from undefined.

        if ( element !== undefined )
        {
            element.focus ();

            // Return control to the caller.

            return;
        }

        pendingFocusIdentifier.current = identifier;

        // Calculate the required item count value from the current inputs.

        const requiredItemCount = properties.followTail
            ? visibleEntries.length - entryIndex
            : entryIndex + 1;

        progressiveRendering.revealThrough ( requiredItemCount - 1 );
    }

    //----------------------------------------------------------------------------------------------
    // Function: copyEntry
    //
    // Description:
    //
    //   Copies the entry.
    //
    // Parameters:
    //
    //   - entry:
    //     The entry supplied to the operation.
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

    function copyEntry ( entry: ConsoleEntry ): void
    {
        void navigator.clipboard?.writeText ( formatEntryForCopy ( entry ) );
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleRowKeyDown
    //
    // Description:
    //
    //   Handles row key down.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - entry:
    //     The entry supplied to the operation.
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

    function handleRowKeyDown ( event: KeyboardEvent <HTMLDivElement>, entry: ConsoleEntry ): void
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === "ArrowDown" || event.key === "ArrowUp" )
        {
            selectRelativeEntry ( event, event.key === "ArrowDown" ? 1 : -1 );
        }
        else if ( event.key === "Home" || event.key === "End" )
        {
            // Initialize the local values needed by this operation.

            const targetEntry = event.key === "Home" ? visibleEntries [ 0 ] : visibleEntries.at ( -1 );

            // Handle the case where target entry differs from undefined.

            if ( targetEntry !== undefined )
            {
                event.preventDefault ();
                setSelectedIdentifier ( targetEntry.identifier );

                // Calculate the target index value from the current inputs.

                const targetIndex = event.key === "Home" ? 0 : visibleEntries.length - 1;
                focusEntry ( targetEntry.identifier, targetIndex );
            }
        }
        else if ( event.key.toLocaleLowerCase () === "c" && ( event.ctrlKey || event.metaKey ) )
        {
            event.preventDefault ();
            copyEntry ( entry );
        }
        else if ( ( event.key === "Enter" || event.key === " " ) && entry.context !== undefined )
        {
            event.preventDefault ();
            properties.onNavigateToContext ( entry.context );
        }
    }

    // Return the rendered interface.

    return (
        <section aria-labelledby="console-title" className="console-panel">
            <header className="console-title-bar">
                <h2 id="console-title">{ text ( "console.title" ) }</h2>
                <div className="console-controls">
                    <label>
                        <input
                            checked  = { properties.filters.message }
                            onChange = { () => toggleFilter ( "message" ) }
                            type     = "checkbox"
                        />
                        <span>{ text ( "console.filter.messages" ) }</span>
                    </label>
                    <label>
                        <input
                            checked  = { properties.filters.warning }
                            onChange = { () => toggleFilter ( "warning" ) }
                            type     = "checkbox"
                        />
                        <span>{ text ( "console.filter.warnings" ) }</span>
                    </label>
                    <label>
                        <input
                            checked  = { properties.filters.error }
                            onChange = { () => toggleFilter ( "error" ) }
                            type     = "checkbox"
                        />
                        <span>{ text ( "console.filter.errors" ) }</span>
                    </label>
                    <label>
                        <input
                            checked  = { properties.followTail }
                            onChange = { event => properties.onFollowTailChange ( event.currentTarget.checked ) }
                            type     = "checkbox"
                        />
                        <span>{ text ( "console.followTail" ) }</span>
                    </label>
                    <button onClick={ properties.onClear } type="button">{ text ( "console.clear" ) }</button>
                </div>
            </header>
            <p className="visually-hidden" id="console-copy-hint">{ text ( "console.copyHint" ) }</p>
            <div
                aria-describedby="console-copy-hint"
                aria-label={ text ( "console.title" ) }
                aria-rowcount={ visibleEntries.length + 1 }
                className = "console-table"
                style     = { columnStyle }
                onScroll  = { event =>
                {
                    // Calculate the should reveal value from the current inputs.

                    const shouldReveal = properties.followTail
                        ? event.currentTarget.scrollTop <= Math.max ( 54, event.currentTarget.clientHeight / 2 )
                        : isNearScrollableEnd ( event.currentTarget );

                    // Handle the case where should reveal is enabled.

                    if ( shouldReveal )
                    {
                        progressiveRendering.revealNextBatch ();
                    }
                } }
                ref  = { bodyReference }
                role = "grid"
            >
                <div aria-rowindex={ 1 } className="console-column-header" role="row">
                    { RESIZABLE_COLUMNS.map ( column => (
                        <span key={ column } role="columnheader">
                            { text ( `console.column.${column}` ) }
                            <span
                                aria-label={ text ( "console.resizeColumn" ).replace ( "{column}", text ( `console.column.${column}` ) ) }
                                aria-orientation="vertical"
                                aria-valuemin={ COLUMN_CONFIGURATION.minimumWidths [ column ] }
                                aria-valuemax={ COLUMN_CONFIGURATION.maximumWidth }
                                aria-valuenow={ columnWidths [ column ] }
                                className="console-column-grip"
                                role="separator"
                                tabIndex={ 0 }
                                onPointerDown={ event =>
                                {
                                    if ( event.button !== 0 )
                                    {
                                        return;
                                    }
                                    event.preventDefault ();
                                    event.currentTarget.focus ();
                                    event.currentTarget.setPointerCapture ( event.pointerId );
                                    columnDragReference.current = {
                                        column, pointerIdentifier: event.pointerId, startX: event.clientX,
                                        startWidth: event.currentTarget.parentElement?.getBoundingClientRect ().width ?? columnWidths [ column ],
                                    };
                                } }
                                onPointerMove={ event =>
                                {
                                    const drag = columnDragReference.current;
                                    if ( drag !== null && drag.pointerIdentifier === event.pointerId )
                                    {
                                        resizeColumn ( drag.column, drag.startWidth + event.clientX - drag.startX );
                                    }
                                } }
                                onPointerUp={ event =>
                                {
                                    if ( event.currentTarget.hasPointerCapture ( event.pointerId ) )
                                    {
                                        event.currentTarget.releasePointerCapture ( event.pointerId );
                                    }
                                    columnDragReference.current = null;
                                } }
                                onPointerCancel={ () => { columnDragReference.current = null; } }
                                onLostPointerCapture={ () => { columnDragReference.current = null; } }
                                onDoubleClick={ () =>
                                {
                                    resizeColumn ( column, COLUMN_CONFIGURATION.widths [ column ] );
                                    if ( column === "message" )
                                    {
                                        setMessageWidthIsFixed ( false );
                                    }
                                } }
                                onKeyDown={ event =>
                                {
                                    if ( ![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes ( event.key ) )
                                    {
                                        return;
                                    }
                                    event.preventDefault ();
                                    const width = event.currentTarget.parentElement?.getBoundingClientRect ().width ?? columnWidths [ column ];
                                    const step = COLUMN_CONFIGURATION.keyboardStep * ( event.shiftKey ? 4 : 1 );
                                    resizeColumn ( column, event.key === "Home" ? COLUMN_CONFIGURATION.minimumWidths [ column ]
                                        : event.key === "End" ? COLUMN_CONFIGURATION.maximumWidth
                                        : width + ( event.key === "ArrowLeft" ? -step : step ) );
                                } }
                            />
                        </span>
                    ) ) }
                    <span role="columnheader">{ text ( "console.column.goto" ) }</span>
                </div>
                { visibleEntries.length === 0
                    ? <p className="console-empty">{ text ( "console.empty" ) }</p>
                    : renderedEntries.map ( ( entry, renderedEntryIndex ) =>
                    {
                        // Initialize the local values needed by this operation.

                        const entryIndex = renderedStartIndex + renderedEntryIndex;
                        const selected   = entry.identifier === effectiveSelectedIdentifier
                            || ( effectiveSelectedIdentifier === null && renderedEntryIndex === 0 );

                        // Return the rendered interface.

                        return (
                            <div
                                aria-rowindex={ entryIndex + 2 }
                                aria-selected={ selected }
                                className     = { `console-row console-row-${entry.severity}` }
                                style         = { consoleSeverityButtonStyle ( entry.severity ) }
                                key           = { entry.identifier }
                                onClick       = { () => setSelectedIdentifier ( entry.identifier ) }
                                onDoubleClick = { () =>
                                {
                                    // Handle the case where entry context differs from undefined.

                                    if ( entry.context !== undefined )
                                    {
                                        properties.onNavigateToContext ( entry.context );
                                    }
                                } }
                                onKeyDown = { event => handleRowKeyDown ( event, entry ) }
                                ref       = { element =>
                                {
                                    // Handle the case where element matches an absent value.

                                    if ( element === null )
                                    {
                                        rowReferences.current.delete ( entry.identifier );
                                    }
                                    else
                                    {
                                        // Handle the remaining case after the preceding condition
                                        // is false.

                                        rowReferences.current.set ( entry.identifier, element );
                                    }
                                } }
                                role     = "row"
                                tabIndex = { selected ? 0 : -1 }
                            >
                                <span className="console-time" role="gridcell">{ formatTime ( entry.timestamp ) }</span>
                                <span className="console-severity" role="gridcell">
                                    <span aria-hidden="true" className="severity-symbol">{ severitySymbol ( entry ) }</span>
                                    <span>{ text ( `console.severity.${entry.severity}` ) }</span>
                                </span>
                                <code className="console-code" role="gridcell">{ entry.code }</code>
                                <span className="console-source" role="gridcell">{ entry.source }</span>
                                <span className="console-text" role="gridcell">{ entry.text }</span>
                                <span className="console-context" role="gridcell">
                                    { entry.context !== undefined && (
                                        <button onClick={ () => entry.context !== undefined && properties.onNavigateToContext ( entry.context ) } type="button">
                                            { text ( `console.destination.${entry.context.route}` ) }
                                        </button>
                                    ) }
                                </span>
                            </div>
                        );
                    } ) }
            </div>
        </section>
    );
}

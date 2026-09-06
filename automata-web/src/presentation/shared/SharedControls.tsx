// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Shared Presentation Controls
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Supplies reusable list, form, grid, disclosure, icon-button, and empty-state primitives.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { Icon } from "./Icon";
import { isNearScrollableEnd, useProgressiveRendering } from "./progressive-rendering";

//--------------------------------------------------------------------------------------------------
// Interface: EmptyStateProperties
//
// Description:
//
//   Defines the properties accepted by the empty state interface.
//
//--------------------------------------------------------------------------------------------------

interface EmptyStateProperties
{
    readonly description: string;
    readonly title:       string;
}

//--------------------------------------------------------------------------------------------------
// Function: EmptyState
//
// Description:
//
//   Renders the empty state interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered empty state interface.
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

export function EmptyState ( properties: EmptyStateProperties )
{
    // Return the rendered interface.

    return (
        <div className="empty-state">
            <span aria-hidden="true" className="empty-state-mark">◇</span>
            <strong>{ properties.title }</strong>
            <p>{ properties.description }</p>
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: DisclosureProperties
//
// Description:
//
//   Defines the properties accepted by the disclosure interface.
//
//--------------------------------------------------------------------------------------------------

interface DisclosureProperties
{
    readonly children: ReactNode;
    readonly label:    string;
}

//--------------------------------------------------------------------------------------------------
// Function: Disclosure
//
// Description:
//
//   Renders the disclosure interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered disclosure interface.
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

export function Disclosure ( properties: DisclosureProperties )
{
    // Return the rendered interface.

    return (
        <details className="disclosure">
            <summary>{ properties.label }</summary>
            <div>{ properties.children }</div>
        </details>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: FormFieldProperties
//
// Description:
//
//   Defines the properties accepted by the form field interface.
//
//--------------------------------------------------------------------------------------------------

interface FormFieldProperties
{
    readonly children: ReactNode;
    readonly hint?:    string | undefined;
    readonly label:    string;
    readonly name:     string;
}

//--------------------------------------------------------------------------------------------------
// Function: FormField
//
// Description:
//
//   Renders the form field interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered form field interface.
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

export function FormField ( properties: FormFieldProperties )
{
    // Initialize the local values needed by this operation.

    const hintIdentifier = properties.hint === undefined ? undefined : `${properties.name}-hint`;

    // Return the rendered interface.

    return (
        <div className="form-field">
            <label htmlFor={ properties.name }>
                <span className="form-field-label-text">{ properties.label }</span>
            </label>
            <div>
                { properties.children }
                { properties.hint !== undefined && <small id={ hintIdentifier }>{ properties.hint }</small> }
            </div>
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: NumericFieldProperties
//
// Description:
//
//   Defines the properties accepted by the numeric field interface.
//
//--------------------------------------------------------------------------------------------------

interface NumericFieldProperties
{
    readonly decimalPlaces?: number;
    readonly disabled?:      boolean;
    readonly label:          string;
    readonly maximum:        number;
    readonly minimum:        number;
    readonly name:           string;
    readonly onChange:       ( value: number ) => void;
    readonly value:          number;
}

//--------------------------------------------------------------------------------------------------
// Function: roundToPlaces
//
// Description:
//
//   Rounds the to places.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - decimalPlaces:
//     The decimal places supplied to the operation.
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

function roundToPlaces ( value: number, decimalPlaces: number ): number
{
    // Calculate the factor value from the current inputs.

    const factor = 10 ** decimalPlaces;

    // Return the computed result.

    return Math.round ( value * factor ) / factor;
}

// A numeric settings field that can actually be typed into.
//
// A controlled number input that clamps on every keystroke cannot be edited: clearing it yields
// NaN, so the change is discarded and the previous value re-renders immediately, and no shorter
// number can ever be entered. This field keeps the typed text as its own draft instead. Every
// keystroke is accepted; the value reaches the caller only once the draft parses cleanly and sits
// inside the permitted range, so a spinner press still applies at once while a half-typed or
// out-of-range number is simply held. Committing the field — Enter, or moving focus away — snaps
// the draft to the nearest limit, so an out-of-range entry resolves rather than blocking the
// dialog.

//--------------------------------------------------------------------------------------------------
// Function: NumericField
//
// Description:
//
//   Renders the numeric field interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered numeric field interface.
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

export function NumericField ( properties: NumericFieldProperties )
{
    // Initialize the local values needed by this operation.

    const decimalPlaces = properties.decimalPlaces ?? 0;
    const [ committedValue, setCommittedValue ] = useState ( properties.value );
    const [ draftValue, setDraftValue ]         = useState ( String ( properties.value ) );

    // Adopt a value changed by anything other than this field, such as Cancel discarding the dialog
    // draft.

    if ( properties.value !== committedValue )
    {
        setCommittedValue ( properties.value );
        setDraftValue ( String ( properties.value ) );
    }

    //----------------------------------------------------------------------------------------------
    // Function: publish
    //
    // Description:
    //
    //   Publishes the requested value.
    //
    // Parameters:
    //
    //   - value:
    //     The value supplied to the operation.
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

    function publish ( value: number ): void
    {
        setCommittedValue ( value );
        properties.onChange ( value );
    }

    //----------------------------------------------------------------------------------------------
    // Function: commitDraft
    //
    // Description:
    //
    //   Commits the draft.
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

    function commitDraft (): void
    {
        // Initialize the local values needed by this operation.

        const parsedValue   = Number ( draftValue );
        const usable        = draftValue.trim ().length > 0 && Number.isFinite ( parsedValue );
        const resolvedValue = usable
            ? Math.min (
                properties.maximum,
                Math.max ( properties.minimum, roundToPlaces ( parsedValue, decimalPlaces ) ),
            )
            : properties.value;

        setDraftValue ( String ( resolvedValue ) );
        publish ( resolvedValue );
    }

    // Return the rendered interface.

    return (
        <FormField label={ properties.label } name={ properties.name }>
            <input
                id       = { properties.name }
                disabled = { properties.disabled }
                max      = { properties.maximum }
                min      = { properties.minimum }
                onBlur   = { commitDraft }
                onChange = { event =>
                {
                    // Initialize the local values needed by this operation.

                    const nextDraftValue = event.currentTarget.value;
                    const parsedValue    = Number ( nextDraftValue );

                    setDraftValue ( nextDraftValue );

                    // Handle the case where at least one branch condition is satisfied.

                    if ( nextDraftValue.trim ().length === 0 || !Number.isFinite ( parsedValue ) ||
                        parsedValue < properties.minimum || parsedValue > properties.maximum ||
                        roundToPlaces ( parsedValue, decimalPlaces ) !== parsedValue )
                    {
                        // Return control to the caller.

                        return;
                    }

                    publish ( parsedValue );
                } }
                onKeyDown={ event =>
                {
                    // Handle the case where event key matches the Enter value.

                    if ( event.key === "Enter" )
                    {
                        event.preventDefault ();
                        commitDraft ();
                    }
                } }
                step  = { decimalPlaces === 0 ? "1" : String ( 10 ** -decimalPlaces ) }
                type  = "number"
                value = { draftValue }
            />
        </FormField>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: IconButtonProperties
//
// Description:
//
//   Defines the properties accepted by the icon button interface.
//
//--------------------------------------------------------------------------------------------------

interface IconButtonProperties
{
    readonly disabled?: boolean;
    readonly iconName:   string;
    readonly iconSource: "custom" | "fluent";
    readonly label:      string;
    readonly onClick:    () => void;
    readonly pressed?:   boolean;
}

//--------------------------------------------------------------------------------------------------
// Function: IconButton
//
// Description:
//
//   Renders the icon button interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered icon button interface.
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

export function IconButton ( properties: IconButtonProperties )
{
    // Return the rendered interface.

    return (
        <button
            aria-label={ properties.label }
            aria-pressed={ properties.pressed }
            className = "icon-button"
            disabled  = { properties.disabled }
            onClick   = { properties.onClick }
            title     = { properties.label }
            type      = "button"
        >
            <Icon name={ properties.iconName } source={ properties.iconSource } />
        </button>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: EntityListItem
//
// Description:
//
//   Defines the structure of entity list item.
//
//--------------------------------------------------------------------------------------------------

export interface EntityListItem
{
    readonly identifier: string;
    readonly label:      string;
}

//--------------------------------------------------------------------------------------------------
// Interface: EntityListProperties
//
// Description:
//
//   Defines the properties accepted by the entity list interface.
//
//--------------------------------------------------------------------------------------------------

interface EntityListProperties
{
    readonly items:              readonly EntityListItem[];
    readonly label:              string;
    readonly onSelectionChange:  ( identifier: string ) => void;
    readonly selectedIdentifier: string | null;
}

//--------------------------------------------------------------------------------------------------
// Function: EntityList
//
// Description:
//
//   Renders the entity list interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered entity list interface.
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

export function EntityList ( properties: EntityListProperties )
{
    // Initialize the local values needed by this operation.

    const itemReferences              = useRef <Map <string, HTMLDivElement>> ( new Map () );
    const pendingFocusIdentifier      = useRef <string | null> ( null );
    const effectiveSelectedIdentifier = properties.items.some (
        item => item.identifier === properties.selectedIdentifier
    )
        ? properties.selectedIdentifier
        : properties.items [ 0 ]?.identifier ?? null;
    const effectiveSelectedIndex = properties.items.findIndex (
        item => item.identifier === effectiveSelectedIdentifier
    );
    const progressiveRendering = useProgressiveRendering ( properties.items.length, effectiveSelectedIndex );
    const visibleItems         = properties.items.slice ( 0, progressiveRendering.visibleItemCount );

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const identifier = pendingFocusIdentifier.current;

        // Handle the case where identifier differs from an absent value.

        if ( identifier !== null )
        {
            // Initialize the local values needed by this operation.

            const element = itemReferences.current.get ( identifier );

            // Handle the case where element differs from undefined.

            if ( element !== undefined )
            {
                pendingFocusIdentifier.current = null;
                element.focus ();
            }
        }
    }, [ progressiveRendering.visibleItemCount, effectiveSelectedIdentifier ] );

    //----------------------------------------------------------------------------------------------
    // Function: focusItem
    //
    // Description:
    //
    //   Focuses the item.
    //
    // Parameters:
    //
    //   - identifier:
    //     The identifier supplied to the operation.
    //
    //   - itemIndex:
    //     The item index supplied to the operation.
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

    function focusItem ( identifier: string, itemIndex: number ): void
    {
        // Initialize the local values needed by this operation.

        const element = itemReferences.current.get ( identifier );

        // Handle the case where element differs from undefined.

        if ( element !== undefined )
        {
            element.focus ();

            // Return control to the caller.

            return;
        }

        pendingFocusIdentifier.current = identifier;
        progressiveRendering.revealThrough ( itemIndex );
    }

    //----------------------------------------------------------------------------------------------
    // Function: selectRelativeItem
    //
    // Description:
    //
    //   Selects relative item.
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

    function selectRelativeItem ( event: KeyboardEvent <HTMLDivElement>, offset: number ): void
    {
        // Initialize the local values needed by this operation.

        const currentIndex = properties.items.findIndex (
            item => item.identifier === effectiveSelectedIdentifier
        );
        const nextIndex = Math.min ( properties.items.length - 1, Math.max ( 0, currentIndex + offset ) );
        const nextItem  = properties.items [ nextIndex ];

        // Handle the case where next item differs from undefined.

        if ( nextItem !== undefined )
        {
            event.preventDefault ();
            properties.onSelectionChange ( nextItem.identifier );
            focusItem ( nextItem.identifier, nextIndex );
        }
    }

    // Return the rendered interface.

    return (
        <div
            aria-label={ properties.label }
            className = "entity-list"
            onScroll  = { event =>
            {
                // Handle the case where is near scrollable end result is enabled.

                if ( isNearScrollableEnd ( event.currentTarget ) )
                {
                    progressiveRendering.revealNextBatch ();
                }
            } }
            role="listbox"
        >
            { visibleItems.map (
                ( item, itemIndex ) =>
                {
                    // Initialize the local values needed by this operation.

                    const selected = item.identifier === effectiveSelectedIdentifier;

                    // Return the rendered interface.

                    return (
                        <div
                            aria-selected={ selected }
                            aria-posinset={ itemIndex + 1 }
                            aria-setsize={ properties.items.length }
                            className = "entity-list-row"
                            key       = { item.identifier }
                            onClick   = { () => properties.onSelectionChange ( item.identifier ) }
                            onKeyDown = { event =>
                            {
                                // Handle the case where at least one branch condition is satisfied.

                                if ( event.key === "ArrowDown" || event.key === "ArrowUp" )
                                {
                                    selectRelativeItem ( event, event.key === "ArrowDown" ? 1 : -1 );
                                }
                                else if ( event.key === "Home" || event.key === "End" )
                                {
                                    // Initialize the local values needed by this operation.

                                    const targetItem = event.key === "Home" ? properties.items [ 0 ] : properties.items.at ( -1 );

                                    // Handle the case where target item differs from undefined.

                                    if ( targetItem !== undefined )
                                    {
                                        event.preventDefault ();
                                        properties.onSelectionChange ( targetItem.identifier );

                                        // Calculate the target index value from the current inputs.

                                        const targetIndex = event.key === "Home" ? 0 : properties.items.length - 1;
                                        focusItem ( targetItem.identifier, targetIndex );
                                    }
                                }
                            } }
                            ref={ element =>
                            {
                                // Handle the case where element matches an absent value.

                                if ( element === null )
                                {
                                    itemReferences.current.delete ( item.identifier );
                                }
                                else
                                {
                                    // Handle the remaining case after the preceding condition is
                                    // false.

                                    itemReferences.current.set ( item.identifier, element );
                                }
                            } }
                            role     = "option"
                            tabIndex = { selected ? 0 : -1 }
                        >
                            { item.label }
                        </div>
                    );
                }
            ) }
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: DataGridColumn
//
// Description:
//
//   Defines the structure of data grid column.
//
//--------------------------------------------------------------------------------------------------

export interface DataGridColumn<RowValue>
{
    readonly cellClassName?: string;
    readonly heading: string;
    readonly render:  ( row: RowValue ) => ReactNode;
}

//--------------------------------------------------------------------------------------------------
// Interface: DataGridProperties
//
// Description:
//
//   Defines the properties accepted by the data grid interface.
//
//--------------------------------------------------------------------------------------------------

interface DataGridProperties<RowValue>
{
    readonly columns:              readonly DataGridColumn<RowValue>[];
    readonly getKey:               ( row: RowValue ) => string;
    readonly label:                string;
    readonly onRowSelectionChange?: ( key: string ) => void;
    readonly rows:                 readonly RowValue[];
    readonly selectedKey?:         string | null;
}

//--------------------------------------------------------------------------------------------------
// Function: DataGrid
//
// Description:
//
//   Renders the data grid interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered data grid interface.
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

export function DataGrid<RowValue> ( properties: DataGridProperties<RowValue> )
{
    // Initialize the local values needed by this operation.

    const [ activeCell, setActiveCell ] = useState ( { column: 0, row: 0 } );
    const cellReferences         = useRef <Map <string, HTMLDivElement>> ( new Map () );
    const pendingFocusIdentifier = useRef <string | null> ( null );
    const selectedRowIndex       = properties.selectedKey === undefined || properties.selectedKey === null
        ? -1
        : properties.rows.findIndex ( row => properties.getKey ( row ) === properties.selectedKey );
    const progressiveRendering = useProgressiveRendering (
        properties.rows.length,
        Math.max ( activeCell.row, selectedRowIndex ),
    );
    const visibleRows = properties.rows.slice ( 0, progressiveRendering.visibleItemCount );

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const identifier = pendingFocusIdentifier.current;

        // Handle the case where identifier differs from an absent value.

        if ( identifier !== null )
        {
            // Initialize the local values needed by this operation.

            const element = cellReferences.current.get ( identifier );

            // Handle the case where element differs from undefined.

            if ( element !== undefined )
            {
                pendingFocusIdentifier.current = null;
                element.focus ();
            }
        }
    }, [ activeCell, progressiveRendering.visibleItemCount ] );

    //----------------------------------------------------------------------------------------------
    // Function: cellIdentifier
    //
    // Description:
    //
    //   Derives the cell identifier.
    //
    // Parameters:
    //
    //   - rowIndex:
    //     The row index supplied to the operation.
    //
    //   - columnIndex:
    //     The column index supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    function cellIdentifier ( rowIndex: number, columnIndex: number ): string
    {
        // Return the computed result.

        return `${rowIndex}:${columnIndex}`;
    }

    //----------------------------------------------------------------------------------------------
    // Function: moveCell
    //
    // Description:
    //
    //   Moves the cell.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - rowIndex:
    //     The row index supplied to the operation.
    //
    //   - columnIndex:
    //     The column index supplied to the operation.
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

    function moveCell (
        event: KeyboardEvent <HTMLDivElement>,
        rowIndex: number,
        columnIndex: number
    ): void
    {
        // Handle the case where event target differs from event current target.

        if ( event.target !== event.currentTarget )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        let nextRow    = rowIndex;
        let nextColumn = columnIndex;

        // Handle the case where event key matches the ArrowDown value.

        if ( event.key === "ArrowDown" )
        {
            nextRow = Math.min ( properties.rows.length - 1, rowIndex + 1 );
        }
        else if ( event.key === "ArrowUp" )
        {
            nextRow = Math.max ( 0, rowIndex - 1 );
        }
        else if ( event.key === "ArrowRight" )
        {
            nextColumn = Math.min ( properties.columns.length - 1, columnIndex + 1 );
        }
        else if ( event.key === "ArrowLeft" )
        {
            nextColumn = Math.max ( 0, columnIndex - 1 );
        }
        else if ( event.key === "Home" )
        {
            nextColumn = 0;
        }
        else if ( event.key === "End" )
        {
            nextColumn = properties.columns.length - 1;
        }
        else
        {
            // Return control to the caller.

            return;
        }

        event.preventDefault ();
        setActiveCell ( { column: nextColumn, row: nextRow } );

        // Initialize the local values needed by this operation.

        const nextIdentifier = cellIdentifier ( nextRow, nextColumn );
        const nextElement    = cellReferences.current.get ( nextIdentifier );

        // Handle the case where next element differs from undefined.

        if ( nextElement !== undefined )
        {
            nextElement.focus ();
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            pendingFocusIdentifier.current = nextIdentifier;
            progressiveRendering.revealThrough ( nextRow );
        }
    }

    // Return the rendered interface.

    return (
        <div
            aria-colcount={ properties.columns.length }
            aria-label={ properties.label }
            aria-rowcount={ properties.rows.length + 1 }
            className = "data-grid"
            onScroll  = { event =>
            {
                // Handle the case where is near scrollable end result is enabled.

                if ( isNearScrollableEnd ( event.currentTarget ) )
                {
                    progressiveRendering.revealNextBatch ();
                }
            } }
            role="grid"
        >
            <div aria-rowindex={ 1 } role="row">
                { properties.columns.map ( column => (
                    <div key={ column.heading } role="columnheader">{ column.heading }</div>
                ) ) }
            </div>
            { visibleRows.map ( ( row, rowIndex ) => {
                // Initialize the local values needed by this operation.

                const rowKey = properties.getKey ( row );

                // Return the rendered interface.

                return (
                <div
                    aria-rowindex={ rowIndex + 2 }
                    aria-selected={ properties.selectedKey === rowKey }
                    key  = { rowKey }
                    role = "row"
                >
                    { properties.columns.map ( ( column, columnIndex ) => (
                        <div
                            className={ column.cellClassName }
                            data-active={ activeCell.column === columnIndex && activeCell.row === rowIndex ? "true" : "false" }
                            key     = { column.heading }
                            onClick = { event =>
                            {
                                setActiveCell ( { column: columnIndex, row: rowIndex } );
                                event.currentTarget.focus ();
                                properties.onRowSelectionChange?.( rowKey );
                            } }
                            onFocus={ event =>
                            {
                                // Handle the case where event target matches event current target.

                                if ( event.target === event.currentTarget )
                                {
                                    setActiveCell ( { column: columnIndex, row: rowIndex } );
                                    properties.onRowSelectionChange?.( rowKey );
                                }
                            } }
                            onKeyDown = { event => moveCell ( event, rowIndex, columnIndex ) }
                            ref       = { element =>
                            {
                                // Initialize the local values needed by this operation.

                                const identifier = cellIdentifier ( rowIndex, columnIndex );

                                // Handle the case where element matches an absent value.

                                if ( element === null )
                                {
                                    cellReferences.current.delete ( identifier );
                                }
                                else
                                {
                                    // Handle the remaining case after the preceding condition is
                                    // false.

                                    cellReferences.current.set ( identifier, element );
                                }
                            } }
                            role     = "gridcell"
                            tabIndex = { activeCell.column === columnIndex && activeCell.row === rowIndex ? 0 : -1 }
                        >
                            { column.render ( row ) }
                        </div>
                    ) ) }
                </div>
                );
            } ) }
        </div>
    );
}

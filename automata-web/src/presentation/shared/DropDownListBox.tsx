// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Drop-Down List Box
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Provides a reusable select-only list box whose dedicated button is the sole pointer target that
//   opens the list.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from "react";

import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";
import { text } from "../../localization/messages.js";
import { isNearScrollableEnd, useProgressiveRendering } from "./progressive-rendering.js";

const LIST_BOX_GAP            = 2;
const MAXIMUM_LIST_BOX_HEIGHT = 220;
const MINIMUM_LIST_BOX_WIDTH  = 160;
const VIEWPORT_MARGIN         = 8;

//--------------------------------------------------------------------------------------------------
// Interface: DropDownListBoxOption
//
// Description:
//
//   Defines the structure of drop down list box option.
//
//--------------------------------------------------------------------------------------------------

export interface DropDownListBoxOption
{
    readonly label: string;
    readonly value: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: DropDownListBoxProperties
//
// Description:
//
//   Defines the properties accepted by the drop down list box interface.
//
//--------------------------------------------------------------------------------------------------

interface DropDownListBoxProperties
{
    readonly accessibleLabel: string;
    readonly emptyMessage:    string;
    readonly identifier?:     string | undefined;
    readonly onChange:        ( value: string ) => void;
    readonly openButtonLabel:  string;
    readonly options:          readonly DropDownListBoxOption[];
    readonly value:            string;
}

//--------------------------------------------------------------------------------------------------
// Interface: ProgressiveSelectProperties
//
// Description:
//
//   Defines the properties accepted by the progressive select interface.
//
//--------------------------------------------------------------------------------------------------

interface ProgressiveSelectProperties
{
    readonly identifier:         string;
    readonly includeEmptyOption?: boolean;
    readonly onChange:           ( value: string ) => void;
    readonly options:            readonly DropDownListBoxOption[];
    readonly required?:          boolean;
    readonly searchLabel:        string;
    readonly value:              string;
}

const INITIAL_OPTION_COUNT = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;

//--------------------------------------------------------------------------------------------------
// Function: clamp
//
// Description:
//
//   Derives the clamp.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - minimum:
//     The minimum supplied to the operation.
//
//   - maximum:
//     The maximum supplied to the operation.
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

function clamp ( value: number, minimum: number, maximum: number ): number
{
    // Return the min result.

    return Math.min ( maximum, Math.max ( minimum, value ) );
}

//--------------------------------------------------------------------------------------------------
// Function: ProgressiveSelect
//
// Description:
//
//   Renders the progressive select interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered progressive select interface.
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

export function ProgressiveSelect ( properties: ProgressiveSelectProperties )
{
    // Initialize the local values needed by this operation.

    const [ searchQuery, setSearchQuery ] = useState ( "" );
    const normalizedSearchQuery = searchQuery.trim ().toLocaleLowerCase ();
    const indexedOptions        = properties.options.map ( ( option, index ) => ( { index, option } ) );
    const matchingOptions       = normalizedSearchQuery.length === 0
        ? indexedOptions
        : indexedOptions.filter ( entry =>
            entry.option.label.toLocaleLowerCase ().includes ( normalizedSearchQuery ) ||
            entry.option.value.toLocaleLowerCase ().includes ( normalizedSearchQuery ) );
    const progressiveRendering = useProgressiveRendering ( matchingOptions.length );
    const visibleOptions       = matchingOptions.slice ( 0, progressiveRendering.visibleItemCount );
    const selectedOption       = indexedOptions.find ( entry => entry.option.value === properties.value );
    const renderedOptions      = selectedOption !== undefined &&
        !visibleOptions.some ( entry => entry.option.value === selectedOption.option.value )
        ? [ ...visibleOptions, selectedOption ]
        : visibleOptions;
    const searchAvailable = properties.options.length > INITIAL_OPTION_COUNT;

    //----------------------------------------------------------------------------------------------
    // Function: changeSelectionFromKeyboard
    //
    // Description:
    //
    //   Handles the change selection from keyboard behavior.
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

    function changeSelectionFromKeyboard ( event: KeyboardEvent <HTMLSelectElement> ): void
    {
        // Handle the case where the includes result condition is not satisfied.

        if ( ![ "ArrowDown", "ArrowUp", "End", "Home" ].includes ( event.key ) )
        {
            // Return control to the caller.

            return;
        }

        const navigableValues = [
            ...( properties.includeEmptyOption === true ? [ "" ] : [] ),
            ...matchingOptions.map ( entry => entry.option.value ),
        ];

        // Handle the case where navigable values length equals 0.

        if ( navigableValues.length === 0 )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const currentIndex = navigableValues.indexOf ( properties.value );
        let nextIndex: number;

        // Handle the case where event key matches the ArrowDown value.

        if ( event.key === "ArrowDown" )
        {
            nextIndex = Math.min ( navigableValues.length - 1, Math.max ( 0, currentIndex + 1 ) );
        }
        else if ( event.key === "ArrowUp" )
        {
            nextIndex = Math.max ( 0, currentIndex < 0 ? navigableValues.length - 1 : currentIndex - 1 );
        }
        else
        {
            nextIndex = event.key === "Home" ? 0 : navigableValues.length - 1;
        }

        const nextValue = navigableValues [ nextIndex ];

        // Handle the case where all required conditions are satisfied.

        if ( nextValue !== undefined && nextValue !== properties.value )
        {
            event.preventDefault ();
            properties.onChange ( nextValue );
        }
    }

    // Return the rendered interface.

    return (
        <div className="progressive-select">
            { searchAvailable && (
                <input
                    aria-controls={ properties.identifier }
                    aria-label={ properties.searchLabel }
                    className = "progressive-select-search"
                    onChange  = { event =>
                    {
                        setSearchQuery ( event.currentTarget.value );
                        progressiveRendering.reset ();
                    } }
                    placeholder = { properties.searchLabel }
                    type        = "search"
                    value       = { searchQuery }
                />
            ) }
            <select
                id        = { properties.identifier }
                onChange  = { event => properties.onChange ( event.currentTarget.value ) }
                onKeyDown = { changeSelectionFromKeyboard }
                required  = { properties.required }
                value     = { properties.value }
            >
                { properties.includeEmptyOption === true && (
                    <option
                        aria-posinset={ 1 }
                        aria-setsize={ properties.options.length + 1 }
                        value=""
                    />
                ) }
                { renderedOptions.map ( entry => (
                    <option
                        aria-posinset={ entry.index + ( properties.includeEmptyOption === true ? 2 : 1 ) }
                        aria-setsize={ properties.options.length + ( properties.includeEmptyOption === true ? 1 : 0 ) }
                        key   = { entry.option.value }
                        value = { entry.option.value }
                    >
                        { entry.option.label }
                    </option>
                ) ) }
            </select>
            { searchAvailable && normalizedSearchQuery.length > 0 && matchingOptions.length === 0 && (
                <span aria-live="polite" className="field-description" role="status">
                    { text ( "shared.noMatchingOptions" ) }
                </span>
            ) }
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: DropDownListBox
//
// Description:
//
//   Renders the drop down list box interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered drop down list box interface.
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

export function DropDownListBox ( properties: DropDownListBoxProperties )
{
    // Initialize the local values needed by this operation.

    const listBoxIdentifier = useId ();
    const rootReference     = useRef <HTMLDivElement> ( null );
    const buttonReference   = useRef <HTMLButtonElement> ( null );
    const listBoxReference  = useRef <HTMLDivElement> ( null );
    const [ activeIndex, setActiveIndex ]   = useState ( -1 );
    const [ listBoxOpen, setListBoxOpen ]   = useState ( false );
    const [ listBoxStyle, setListBoxStyle ] = useState <CSSProperties> ( {} );
    const selectedIndex        = properties.options.findIndex ( option => option.value === properties.value );
    const selectedOption       = properties.options [ selectedIndex ];
    const progressiveRendering = useProgressiveRendering ( properties.options.length );
    const visibleOptionIndexes = Array.from (
        { length: progressiveRendering.visibleItemCount },
        ( _, index ) => index,
    );

    // Handle the case where all required conditions are satisfied.

    if ( activeIndex >= progressiveRendering.visibleItemCount && activeIndex < properties.options.length )
    {
        visibleOptionIndexes.push ( activeIndex );
    }

    const visibleOptions = visibleOptionIndexes.flatMap ( index =>
    {
        // Initialize the local values needed by this operation.

        const option = properties.options [ index ];

        // Return the result selected by the current condition.

        return option === undefined ? [] : [ { index, option } ];
    } );

    //----------------------------------------------------------------------------------------------
    // Function: closeListBox
    //
    // Description:
    //
    //   Closes the list box.
    //
    // Parameters:
    //
    //   - restoreButtonFocus:
    //     The restore button focus supplied to the operation.
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

    function closeListBox ( restoreButtonFocus: boolean ): void
    {
        // Handle the case where restore button focus is enabled.

        if ( restoreButtonFocus )
        {
            buttonReference.current?.focus ();
        }

        setListBoxOpen ( false );
    }

    //----------------------------------------------------------------------------------------------
    // Function: openListBox
    //
    // Description:
    //
    //   Opens the list box.
    //
    // Parameters:
    //
    //   - initialIndex:
    //     The initial index supplied to the operation.
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

    function openListBox ( initialIndex = selectedIndex ): void
    {
        // Initialize the local values needed by this operation.

        const fallbackIndex = properties.options.length === 0 ? -1 : 0;

        progressiveRendering.reset ();
        setActiveIndex ( initialIndex >= 0 ? initialIndex : fallbackIndex );
        setListBoxOpen ( true );
    }

    //----------------------------------------------------------------------------------------------
    // Function: selectOption
    //
    // Description:
    //
    //   Selects option.
    //
    // Parameters:
    //
    //   - index:
    //     The index supplied to the operation.
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

    function selectOption ( index: number ): void
    {
        // Initialize the local values needed by this operation.

        const option = properties.options [ index ];

        // Handle the case where option differs from undefined.

        if ( option !== undefined )
        {
            properties.onChange ( option.value );
            closeListBox ( true );
        }
    }

    useLayoutEffect ( () =>
    {
        // Handle the case where the list box open condition is not satisfied.

        if ( !listBoxOpen )
        {
            // Return control to the caller.

            return;
        }

        //------------------------------------------------------------------------------------------
        // Function: positionListBox
        //
        // Description:
        //
        //   Handles the position list box behavior.
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

        function positionListBox (): void
        {
            // Initialize the local values needed by this operation.

            const root    = rootReference.current;
            const listBox = listBoxReference.current;

            // Handle the case where at least one branch condition is satisfied.

            if ( root === null || listBox === null )
            {
                // Return control to the caller.

                return;
            }

            // Initialize the local values needed by this operation.

            const rootRectangle        = root.getBoundingClientRect ();
            const maximumViewportWidth = Math.max ( 0, window.innerWidth - VIEWPORT_MARGIN * 2 );
            const width                = Math.min (
                maximumViewportWidth,
                Math.max ( MINIMUM_LIST_BOX_WIDTH, rootRectangle.width ),
            );
            const left = clamp (
                rootRectangle.left,
                VIEWPORT_MARGIN,
                Math.max ( VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN ),
            );
            const availableHeightBelow = window.innerHeight - rootRectangle.bottom - VIEWPORT_MARGIN - LIST_BOX_GAP;
            const availableHeightAbove = rootRectangle.top - VIEWPORT_MARGIN - LIST_BOX_GAP;
            const preferredHeight      = Math.min ( listBox.scrollHeight, MAXIMUM_LIST_BOX_HEIGHT );
            const openAbove            = availableHeightBelow < preferredHeight && availableHeightAbove > availableHeightBelow;
            const availableHeight      = openAbove ? availableHeightAbove : availableHeightBelow;
            const maxHeight            = Math.max ( 0, Math.min ( MAXIMUM_LIST_BOX_HEIGHT, availableHeight ) );
            const renderedHeight       = Math.min ( preferredHeight, maxHeight );
            const top                  = openAbove
                ? Math.max ( VIEWPORT_MARGIN, rootRectangle.top - renderedHeight - LIST_BOX_GAP )
                : rootRectangle.bottom + LIST_BOX_GAP;

            setListBoxStyle ( { left, maxHeight, top, width } );
        }

        positionListBox ();
        listBoxReference.current?.focus ();
        window.addEventListener ( "resize", positionListBox );
        window.addEventListener ( "scroll", positionListBox, true );

        // Return the computed result.

        return () =>
        {
            window.removeEventListener ( "resize", positionListBox );
            window.removeEventListener ( "scroll", positionListBox, true );
        };
    }, [ listBoxOpen ] );

    useEffect ( () =>
    {
        // Handle the case where the list box open condition is not satisfied.

        if ( !listBoxOpen )
        {
            // Return control to the caller.

            return;
        }

        //------------------------------------------------------------------------------------------
        // Function: closeOnOutsidePointer
        //
        // Description:
        //
        //   Closes the on outside pointer.
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
        //------------------------------------------------------------------------------------------

        function closeOnOutsidePointer ( event: globalThis.PointerEvent ): void
        {
            // Initialize the local values needed by this operation.

            const target = event.target;

            // Handle the case where the current value condition is not satisfied.

            if ( !( target instanceof Node ) )
            {
                // Return control to the caller.

                return;
            }

            // Handle the case where all required conditions are satisfied.

            if ( rootReference.current?.contains ( target ) !== true &&
                listBoxReference.current?.contains ( target ) !== true )
            {
                closeListBox ( false );
            }
        }

        document.addEventListener ( "pointerdown", closeOnOutsidePointer );

        // Return the computed result.

        return () => document.removeEventListener ( "pointerdown", closeOnOutsidePointer );
    }, [ listBoxOpen ] );

    useLayoutEffect ( () =>
    {
        // Handle the case where all required conditions are satisfied.

        if ( listBoxOpen && activeIndex >= 0 )
        {
            listBoxReference.current
                ?.querySelector <HTMLElement> ( `[data-option-index='${activeIndex}']` )
                ?.scrollIntoView?.( { block: "nearest" } );
        }
    }, [ activeIndex, listBoxOpen ] );

    //----------------------------------------------------------------------------------------------
    // Function: handleButtonClick
    //
    // Description:
    //
    //   Handles button click.
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

    function handleButtonClick ( event: MouseEvent <HTMLButtonElement> ): void
    {
        event.stopPropagation ();

        // Handle the case where list box open is enabled.

        if ( listBoxOpen )
        {
            closeListBox ( false );
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            openListBox ();
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleButtonKeyDown
    //
    // Description:
    //
    //   Handles button key down.
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

    function handleButtonKeyDown ( event: KeyboardEvent <HTMLButtonElement> ): void
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === "ArrowDown" || event.key === "ArrowUp" )
        {
            event.preventDefault ();
            event.stopPropagation ();
            openListBox ( event.key === "ArrowUp" ? properties.options.length - 1 : selectedIndex );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleButtonPointerDown
    //
    // Description:
    //
    //   Handles button pointer down.
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

    function handleButtonPointerDown ( event: PointerEvent <HTMLButtonElement> ): void
    {
        event.preventDefault ();
        event.stopPropagation ();
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleListBoxKeyDown
    //
    // Description:
    //
    //   Handles list box key down.
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

    function handleListBoxKeyDown ( event: KeyboardEvent <HTMLDivElement> ): void
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === "ArrowDown" || event.key === "ArrowUp" )
        {
            event.preventDefault ();

            // Handle the case where length equals 0.

            if ( properties.options.length === 0 )
            {
                // Return control to the caller.

                return;
            }

            // Initialize the local values needed by this operation.

            const offset    = event.key === "ArrowDown" ? 1 : -1;
            const nextIndex = clamp ( activeIndex + offset, 0, Math.max ( 0, properties.options.length - 1 ) );

            setActiveIndex ( nextIndex );
        }
        else if ( event.key === "Home" || event.key === "End" )
        {
            event.preventDefault ();
            setActiveIndex ( event.key === "Home" ? 0 : properties.options.length - 1 );
        }
        else if ( event.key === "Enter" || event.key === " " )
        {
            event.preventDefault ();
            selectOption ( activeIndex );
        }
        else if ( event.key === "Escape" )
        {
            event.preventDefault ();
            closeListBox ( true );
        }
    }

    // Calculate the list box value from the current inputs.

    const listBox = listBoxOpen
        ? (
            <div
                aria-activedescendant={ activeIndex >= 0 ? `${listBoxIdentifier}-option-${activeIndex}` : undefined }
                aria-label={ properties.accessibleLabel }
                className = "drop-down-list-box-popup"
                id        = { listBoxIdentifier }
                onBlur    = { event =>
                {
                    // Initialize the local values needed by this operation.

                    const relatedTarget = event.relatedTarget;

                    // Handle the case where at least one branch condition is satisfied.

                    if ( !( relatedTarget instanceof Node ) || !event.currentTarget.contains ( relatedTarget ) )
                    {
                        closeListBox ( false );
                    }
                } }
                onKeyDown = { handleListBoxKeyDown }
                onScroll  = { event =>
                {
                    // Handle the case where is near scrollable end result is enabled.

                    if ( isNearScrollableEnd ( event.currentTarget ) )
                    {
                        progressiveRendering.revealNextBatch ();
                    }
                } }
                ref      = { listBoxReference }
                role     = "listbox"
                style    = { listBoxStyle }
                tabIndex = { -1 }
            >
                { properties.options.length === 0
                    ? <div className="drop-down-list-box-empty">{ properties.emptyMessage }</div>
                    : visibleOptions.map ( ( { index, option } ) => (
                        <div
                            aria-posinset={ index + 1 }
                            aria-selected={ option.value === properties.value }
                            aria-setsize={ properties.options.length }
                            className="drop-down-list-box-option"
                            data-active={ index === activeIndex }
                            data-option-index={ index }
                            id      = { `${listBoxIdentifier}-option-${index}` }
                            key     = { option.value }
                            onClick = { event =>
                            {
                                event.stopPropagation ();
                                selectOption ( index );
                            } }
                            onMouseEnter  = { () => setActiveIndex ( index ) }
                            onPointerDown = { event => event.preventDefault () }
                            role          = "option"
                        >
                            { option.label }
                        </div>
                    ) ) }
            </div>
        )
        : null;

    // Return the rendered interface.

    return (
        <div className="drop-down-list-box" ref={ rootReference }>
            <span className="drop-down-list-box-value">{ selectedOption?.label ?? "" }</span>
            <button
                aria-controls={ listBoxOpen ? listBoxIdentifier : undefined }
                aria-expanded={ listBoxOpen }
                aria-haspopup="listbox"
                aria-label={ properties.openButtonLabel }
                className     = "drop-down-list-box-button"
                id            = { properties.identifier }
                onClick       = { handleButtonClick }
                onKeyDown     = { handleButtonKeyDown }
                onPointerDown = { handleButtonPointerDown }
                ref           = { buttonReference }
                title         = { properties.openButtonLabel }
                type          = "button"
            >
                <span aria-hidden="true">{ "\u25be" }</span>
            </button>
            { listBox }
        </div>
    );
}

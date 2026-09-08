// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Splitter
// Version: 1.1.0
// Date:    2026-08-20
// Author:  Rohin Gosling
//
// Description:
//
//   Provides pointer and keyboard panel resizing with an accessible separator value.
//
//   A splitter stores the size of ONE adjacent pane, and which of the two that is decides the sign
//   of every drag. The caller therefore declares it through `controls`, and both the pointer sign
//   and the arrow-key mapping derive from that declaration. Deriving the sign from orientation
//   alone is what made the Simulator trace splitter move opposite to the pointer: its stored pane
//   is above it, while the Console splitter's stored pane is below its own. The shared
//   pane-selection rule keeps pointer and keyboard movement consistent for either adjacent pane.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

export const MAXIMUM_SPLITTER_RANGE_FRACTION = 2 / 3;

// Which adjacent pane the stored value sizes. "leading" is the pane before the splitter along its
// axis -- left for a vertical splitter, above for a horizontal one -- and "trailing" is the pane
// after it.

//--------------------------------------------------------------------------------------------------
// Type: SplitterControlledPane
//
// Description:
//
//   Defines the supported splitter controlled pane alternatives.
//
//--------------------------------------------------------------------------------------------------

export type SplitterControlledPane = "leading" | "trailing";

//--------------------------------------------------------------------------------------------------
// Interface: SplitterProperties
//
// Description:
//
//   Defines the properties accepted by the splitter interface.
//
//--------------------------------------------------------------------------------------------------

interface SplitterProperties
{
    readonly controls?:   SplitterControlledPane | undefined;
    readonly label:       string;
    readonly minimum:     number;
    readonly onChange:    ( value: number ) => void;
    readonly opposingMinimum?: number | undefined;
    readonly orientation: "horizontal" | "vertical";
    readonly value:       number;
}

//--------------------------------------------------------------------------------------------------
// Function: Splitter
//
// Description:
//
//   Renders the splitter interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered splitter interface.
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

export function Splitter ( properties: SplitterProperties )
{
    // Initialize the local values needed by this operation.

    const splitterReference       = useRef <HTMLDivElement> ( null );
    const pointerCleanupReference = useRef <( () => void ) | null> ( null );
    const [ measuredMaximum, setMeasuredMaximum ] = useState <number | null> ( null );
    const maximum = measuredMaximum ?? Math.max ( properties.minimum, properties.value );

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const splitter       = splitterReference.current;
        const rangeContainer = splitter?.parentElement;

        // Handle the case where at least one branch condition is satisfied.

        if ( splitter === null || splitter === undefined || rangeContainer === null || rangeContainer === undefined )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const observedContainer = rangeContainer;
        const observedSplitter  = splitter;

        //------------------------------------------------------------------------------------------
        // Function: measureMaximum
        //
        // Description:
        //
        //   Calculates maximum.
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

        function measureMaximum (): void
        {
            // Initialize the local values needed by this operation.

            const range = properties.orientation === "vertical"
                ? observedContainer.clientWidth
                : observedContainer.clientHeight;
            const splitterSize = properties.orientation === "vertical"
                ? observedSplitter.clientWidth
                : observedSplitter.clientHeight;

            // Handle the case where range exceeds 0.

            if ( range > 0 )
            {
                // Initialize the local values needed by this operation.

                const fractionMaximum     = Math.floor ( range * MAXIMUM_SPLITTER_RANGE_FRACTION );
                const opposingPaneMaximum = range - splitterSize - ( properties.opposingMinimum ?? 0 );

                setMeasuredMaximum ( Math.max (
                    properties.minimum,
                    Math.min ( fractionMaximum, opposingPaneMaximum )
                ) );
            }
        }

        measureMaximum ();

        // Handle the case where current value matches "undefined".

        if ( typeof ResizeObserver === "undefined" )
        {
            window.addEventListener ( "resize", measureMaximum );

            // Return the computed result.

            return () => window.removeEventListener ( "resize", measureMaximum );
        }

        const observer = new ResizeObserver ( measureMaximum );

        observer.observe ( observedContainer );

        // Return the computed result.

        return () => observer.disconnect ();
    }, [ properties.minimum, properties.opposingMinimum, properties.orientation ] );

    useEffect ( () => () => pointerCleanupReference.current?.(), [] );

    useEffect ( () =>
    {
        // Handle the case where all required conditions are satisfied.

        if ( measuredMaximum !== null && ( properties.value < properties.minimum || properties.value > measuredMaximum ) )
        {
            properties.onChange ( Math.min ( measuredMaximum, Math.max ( properties.minimum, properties.value ) ) );
        }
    }, [ measuredMaximum, properties ] );

    //----------------------------------------------------------------------------------------------
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

    function clamp ( value: number ): number
    {
        // Return the min result.

        return Math.min ( maximum, Math.max ( properties.minimum, value ) );
    }

    // The arrow that grows the stored pane is the one pointing at that pane's far edge, so the
    // mapping follows the controlled side rather than the orientation. A leading pane grows
    // rightward or downward; a trailing pane grows leftward or upward.

    //----------------------------------------------------------------------------------------------
    // Function: changeByKeyboard
    //
    // Description:
    //
    //   Handles the change by keyboard behavior.
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

    function changeByKeyboard ( event: KeyboardEvent <HTMLDivElement> ): void
    {
        // Initialize the local values needed by this operation.

        const controlsLeadingPane = ( properties.controls ?? "leading" ) === "leading";
        const positiveKey         = properties.orientation === "vertical" ? "ArrowRight" : "ArrowDown";
        const negativeKey         = properties.orientation === "vertical" ? "ArrowLeft"  : "ArrowUp";
        const increaseKey         = controlsLeadingPane ? positiveKey : negativeKey;
        const decreaseKey         = controlsLeadingPane ? negativeKey : positiveKey;

        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === decreaseKey || event.key === increaseKey )
        {
            event.preventDefault ();
            properties.onChange ( clamp ( properties.value + ( event.key === increaseKey ? 12 : -12 ) ) );
        }
        else if ( event.key === "Home" )
        {
            event.preventDefault ();
            properties.onChange ( properties.minimum );
        }
        else if ( event.key === "End" )
        {
            event.preventDefault ();
            properties.onChange ( maximum );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: beginPointerResize
    //
    // Description:
    //
    //   Begins the pointer resize.
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

    function beginPointerResize ( event: ReactPointerEvent <HTMLDivElement> ): void
    {
        // Initialize the local values needed by this operation.

        const startCoordinate   = properties.orientation === "vertical" ? event.clientX : event.clientY;
        const startValue        = properties.value;
        const target            = event.currentTarget;
        const pointerIdentifier = event.pointerId;

        pointerCleanupReference.current?.();
        target.setPointerCapture ( pointerIdentifier );

        //------------------------------------------------------------------------------------------
        // Function: move
        //
        // Description:
        //
        //   Moves the requested value.
        //
        // Parameters:
        //
        //   - pointerEvent:
        //     The pointer event supplied to the operation.
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

        function move ( pointerEvent: globalThis.PointerEvent ): void
        {
            // Handle the case where pointer event pointer identifier differs from pointer
            // identifier.

            if ( pointerEvent.pointerId !== pointerIdentifier )
            {
                // Return control to the caller.

                return;
            }

            // Initialize the local values needed by this operation.

            const currentCoordinate = properties.orientation === "vertical"
                ? pointerEvent.clientX
                : pointerEvent.clientY;
            const coordinateDelta = currentCoordinate - startCoordinate;
            const nextValue       = ( properties.controls ?? "leading" ) === "leading"
                ? startValue + coordinateDelta
                : startValue - coordinateDelta;

            properties.onChange ( clamp ( nextValue ) );
        }

        //------------------------------------------------------------------------------------------
        // Function: finish
        //
        // Description:
        //
        //   Finalizes the requested value.
        //
        // Parameters:
        //
        //   - pointerEvent:
        //     The pointer event supplied to the operation.
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

        function finish ( pointerEvent: globalThis.PointerEvent ): void
        {
            // Handle the case where pointer event pointer identifier differs from pointer
            // identifier.

            if ( pointerEvent.pointerId !== pointerIdentifier )
            {
                // Return control to the caller.

                return;
            }

            pointerCleanupReference.current?.();
        }

        pointerCleanupReference.current = () =>
        {
            window.removeEventListener ( "pointermove", move );
            window.removeEventListener ( "pointerup", finish );
            window.removeEventListener ( "pointercancel", finish );
            target.removeEventListener ( "lostpointercapture", finish );
            pointerCleanupReference.current = null;
        };
        window.addEventListener ( "pointermove", move );
        window.addEventListener ( "pointerup", finish );
        window.addEventListener ( "pointercancel", finish );
        target.addEventListener ( "lostpointercapture", finish );
    }

    // Return the rendered interface.

    return (
        <div
            aria-label={ properties.label }
            aria-orientation={ properties.orientation }
            aria-valuemax={ maximum }
            aria-valuemin={ properties.minimum }
            aria-valuenow={ Math.round ( properties.value ) }
            className     = { `splitter splitter-${properties.orientation}` }
            onKeyDown     = { changeByKeyboard }
            onPointerDown = { beginPointerResize }
            ref           = { splitterReference }
            role          = "separator"
            tabIndex      = { 0 }
        >
            <span aria-hidden="true" className="splitter-grip" />
        </div>
    );
}

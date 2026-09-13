// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Command Bar Minimum Width
// Version: 1.0.0
// Date:    2026-08-17
// Author:  Rohin Gosling
//
// Description:
//
//   Measures the width a pane needs to keep its standard button bar on one unwrapped row.
//
//   A splitter controlling a pane with a standard action panel must clamp that pane to a width that
//   keeps the panel unwrapped. The clamp derives from the rendered button widths, gaps, and pane
//   chrome instead of a fixed estimate. Button widths depend on localized label text and responsive
//   padding, so measurement occurs after layout.
//
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

//--------------------------------------------------------------------------------------------------
// Function: pixelValue
//
// Description:
//
//   Derives the pixel value.
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
//--------------------------------------------------------------------------------------------------

function pixelValue ( value: string ): number
{
    // Initialize the local values needed by this operation.

    const parsedValue = Number.parseFloat ( value );

    // Return the result selected by the current condition.

    return Number.isFinite ( parsedValue ) ? parsedValue : 0;
}

//--------------------------------------------------------------------------------------------------
// Function: useCommandBarMinimumWidth
//
// Description:
//
//   Provides the command bar minimum width hook state and behavior.
//
// Parameters:
//
//   - commandBarReference:
//     The command bar reference supplied to the operation.
//
//   - baseMinimumWidth:
//     The base minimum width supplied to the operation.
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

export function useCommandBarMinimumWidth (
    commandBarReference: RefObject<HTMLDivElement | null>,
    baseMinimumWidth: number,
): number
{
    // Initialize the local values needed by this operation.

    const [ minimumWidth, setMinimumWidth ] = useState ( baseMinimumWidth );

    useLayoutEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const commandBar = commandBarReference.current;
        const pane       = commandBar?.parentElement;

        // Handle the case where at least one branch condition is satisfied.

        if ( commandBar === null || commandBar === undefined || pane === null || pane === undefined )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const measuredCommandBar = commandBar;
        const measuredPane       = pane;

        //------------------------------------------------------------------------------------------
        // Function: measureMinimumWidth
        //
        // Description:
        //
        //   Calculates minimum width.
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

        function measureMinimumWidth (): void
        {
            // Initialize the local values needed by this operation.

            const commandBarStyle = window.getComputedStyle ( measuredCommandBar );
            const paneStyle       = window.getComputedStyle ( measuredPane );
            const buttons         = Array.from ( measuredCommandBar.querySelectorAll ( "button" ) );
            const gap             = pixelValue ( commandBarStyle.columnGap || commandBarStyle.gap || "0" );
            const buttonWidth     = buttons.reduce (
                ( totalWidth, button ) => totalWidth + button.getBoundingClientRect ().width,
                0,
            );
            const barChromeWidth  = pixelValue ( commandBarStyle.paddingInlineStart ) +
                pixelValue ( commandBarStyle.paddingInlineEnd );
            const paneChromeWidth = pixelValue ( paneStyle.paddingInlineStart ) +
                pixelValue ( paneStyle.paddingInlineEnd ) +
                pixelValue ( paneStyle.borderInlineStartWidth ) +
                pixelValue ( paneStyle.borderInlineEndWidth );
            const requiredWidth   = Math.ceil (
                buttonWidth + Math.max ( 0, buttons.length - 1 ) * gap + barChromeWidth + paneChromeWidth,
            );

            setMinimumWidth ( Math.max ( baseMinimumWidth, requiredWidth ) );
        }

        measureMinimumWidth ();

        // Handle the case where current value matches "undefined".

        if ( typeof ResizeObserver === "undefined" )
        {
            window.addEventListener ( "resize", measureMinimumWidth );

            // Return the computed result.

            return () => window.removeEventListener ( "resize", measureMinimumWidth );
        }

        const observer = new ResizeObserver ( measureMinimumWidth );

        observer.observe ( measuredCommandBar );

        // Process each button from the query selector all result collection in order.

        for ( const button of measuredCommandBar.querySelectorAll ( "button" ) )
        {
            observer.observe ( button );
        }

        // Return the computed result.

        return () => observer.disconnect ();
    }, [ baseMinimumWidth, commandBarReference ] );

    // Return the minimum width.

    return minimumWidth;
}

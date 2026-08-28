// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Measured Inline Size
// Version: 1.0.0
// Date:    2026-08-28
// Author:  Rohin Gosling
//
// Description:
//
//   Reports the rendered inline size of an element, kept current as the element is resized.
//
//   A splitter stores the size of one adjacent pane as a number, so a pane whose default position
//   is expressed in CSS as a fraction has no number to give it until layout exists. Measuring the
//   pane keeps the splitter's reported value and drag origin correct while the fractional default
//   remains in force.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

//--------------------------------------------------------------------------------------------------
// Function: useMeasuredInlineSize
//
// Description:
//
//   Provides the measured inline size hook state and behavior.
//
// Parameters:
//
//   - elementReference:
//     The element reference supplied to the operation.
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

export function useMeasuredInlineSize ( elementReference: RefObject<HTMLElement | null> ): number
{
    // Initialize the local values needed by this operation.

    const [ inlineSize, setInlineSize ] = useState ( 0 );

    useLayoutEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const element = elementReference.current;

        // Handle the case where at least one branch condition is satisfied.

        if ( element === null || element === undefined )
        {
            // Return control to the caller.

            return;
        }

        const measuredElement = element;

        //------------------------------------------------------------------------------------------
        // Function: measureInlineSize
        //
        // Description:
        //
        //   Calculates inline size.
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

        function measureInlineSize (): void
        {
            setInlineSize ( measuredElement.getBoundingClientRect ().width );
        }

        measureInlineSize ();

        // Handle the case where current value matches the undefined value.

        if ( typeof ResizeObserver === "undefined" )
        {
            window.addEventListener ( "resize", measureInlineSize );

            // Return the computed result.

            return () => window.removeEventListener ( "resize", measureInlineSize );
        }

        const observer = new ResizeObserver ( measureInlineSize );

        observer.observe ( measuredElement );

        // Return the computed result.

        return () => observer.disconnect ();
    }, [ elementReference ] );

    // Return the inline size.

    return inlineSize;
}

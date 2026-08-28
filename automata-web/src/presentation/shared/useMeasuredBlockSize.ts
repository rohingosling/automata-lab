// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Measured Block Size
// Version: 1.0.0
// Date:    2026-08-20
// Author:  Rohin Gosling
//
// Description:
//
//   Reports the rendered block size of an element, kept current as the element is resized.
//
//   A splitter stores the size of one adjacent pane as a number, so a pane whose default position
//   is expressed in CSS -- an even division written as two equal fractions -- has no number to give
//   it until the layout exists. Measuring the pane supplies one, which keeps the splitter's
//   reported value and its drag origin correct while the default is still in force, and lets the
//   default keep tracking the container's height rather than freezing at whatever the first frame
//   happened to measure.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

//--------------------------------------------------------------------------------------------------
// Function: useMeasuredBlockSize
//
// Description:
//
//   Provides the measured block size hook state and behavior.
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

export function useMeasuredBlockSize ( elementReference: RefObject<HTMLElement | null> ): number
{
    // Initialize the local values needed by this operation.

    const [ blockSize, setBlockSize ] = useState ( 0 );

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
        // Function: measureBlockSize
        //
        // Description:
        //
        //   Calculates block size.
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

        function measureBlockSize (): void
        {
            setBlockSize ( measuredElement.getBoundingClientRect ().height );
        }

        measureBlockSize ();

        // Handle the case where current value matches the undefined value.

        if ( typeof ResizeObserver === "undefined" )
        {
            window.addEventListener ( "resize", measureBlockSize );

            // Return the computed result.

            return () => window.removeEventListener ( "resize", measureBlockSize );
        }

        const observer = new ResizeObserver ( measureBlockSize );

        observer.observe ( measuredElement );

        // Return the computed result.

        return () => observer.disconnect ();
    }, [ elementReference ] );

    // Return the block size.

    return blockSize;
}

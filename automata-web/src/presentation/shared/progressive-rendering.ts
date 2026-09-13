// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Progressive Rendering
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Bounds the initial DOM contribution of large collections while allowing scrolling, selection,
//   and keyboard navigation to reveal additional batches on demand.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useState } from "react";

import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";

const PROGRESSIVE_RENDERING_CONFIGURATION = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering;

//--------------------------------------------------------------------------------------------------
// Interface: ProgressiveRendering
//
// Description:
//
//   Defines the structure of progressive rendering.
//
//--------------------------------------------------------------------------------------------------

interface ProgressiveRendering
{
    readonly revealNextBatch:  () => void;
    readonly revealThrough:    ( itemIndex: number ) => void;
    readonly reset:            () => void;
    readonly visibleItemCount: number;
}

//--------------------------------------------------------------------------------------------------
// Function: useProgressiveRendering
//
// Description:
//
//   Provides the progressive rendering hook state and behavior.
//
// Parameters:
//
//   - itemCount:
//     The item count supplied to the operation.
//
//   - requiredItemIndex:
//     The required item index supplied to the operation.
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

export function useProgressiveRendering (
    itemCount: number,
    requiredItemIndex: number = -1,
): ProgressiveRendering
{
    // Calculate the visible item count value from the current inputs.

    const [ requestedItemCount, setRequestedItemCount ] = useState<number> (
        PROGRESSIVE_RENDERING_CONFIGURATION.initialItemCount,
    );

    const visibleItemCount = Math.min (
        itemCount,
        Math.max (
            requestedItemCount,
            PROGRESSIVE_RENDERING_CONFIGURATION.initialItemCount,
            requiredItemIndex + 1,
        ),
    );

    //----------------------------------------------------------------------------------------------
    // Function: revealNextBatch
    //
    // Description:
    //
    //   Reveals the next batch.
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

    function revealNextBatch (): void
    {
        setRequestedItemCount ( currentItemCount => Math.min (
            itemCount,
            currentItemCount + PROGRESSIVE_RENDERING_CONFIGURATION.batchSize,
        ) );
    }

    //----------------------------------------------------------------------------------------------
    // Function: revealThrough
    //
    // Description:
    //
    //   Reveals the through.
    //
    // Parameters:
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

    function revealThrough ( itemIndex: number ): void
    {
        setRequestedItemCount ( currentItemCount => Math.min (
            itemCount,
            Math.max ( currentItemCount, itemIndex + 1 ),
        ) );
    }

    //----------------------------------------------------------------------------------------------
    // Function: reset
    //
    // Description:
    //
    //   Resets the requested value.
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

    function reset (): void
    {
        setRequestedItemCount ( PROGRESSIVE_RENDERING_CONFIGURATION.initialItemCount );
    }

    // Return the assembled result.

    return { revealNextBatch, revealThrough, reset, visibleItemCount };
}

//--------------------------------------------------------------------------------------------------
// Function: isNearScrollableEnd
//
// Description:
//
//   Determines whether near scrollable end.
//
// Parameters:
//
//   - element:
//     The element supplied to the operation.
//
// Returns:
//
//   True when the named condition is satisfied; otherwise, false.
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

export function isNearScrollableEnd ( element: HTMLElement ): boolean
{
    // Calculate the remaining scroll distance value from the current inputs.

    const remainingScrollDistance = element.scrollHeight - element.scrollTop - element.clientHeight;

    // Return the computed result.

    return remainingScrollDistance <= Math.max ( 54, element.clientHeight / 2 );
}

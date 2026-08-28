// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Chart Layout Port
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Executes one bounded ELK layout job in a disposable worker and rejects stale or malformed
//   responses.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import ELK from "elkjs/lib/elk-api.js";
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";

import
{
    MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT,
    MAXIMUM_INTERACTIVE_CHART_STATE_COUNT,
} from "../../application/chart-layout-limits.js";
import type
{
    ChartLayoutEdge,
    ChartLayoutNode,
    ChartLayoutOptions,
    ChartLayoutPort,
    ChartLayoutResult,
} from "../../application/ports/contracts.js";
import { createElkChartLayout } from "./elk-chart-layout.js";
import type { ChartLayoutEngine } from "./elk-chart-layout.js";

//--------------------------------------------------------------------------------------------------
// Type: ChartLayoutEngineFactory
//
// Description:
//
//   Defines the chart layout engine factory type.
//
//--------------------------------------------------------------------------------------------------

export type ChartLayoutEngineFactory = () => ChartLayoutEngine;

export const CHART_LAYOUT_TIMEOUT_MILLISECONDS = 3_000;

const INVALID_LAYOUT_RESULT_MESSAGE         = "The Chart layout worker returned an invalid result.";
const LAYOUT_TIMEOUT_MESSAGE                = "Chart layout exceeded its three-second bound.";
const MAXIMUM_LAYOUT_ERROR_CODE_POINT_COUNT = 4_096;

//--------------------------------------------------------------------------------------------------
// Function: defaultLayoutEngineFactory
//
// Description:
//
//   Creates the default layout engine factory.
//
// Parameters:
//
//   None.
//
// Returns:
//
//   The value produced by the operation.
//
// Preconditions:
//
//   - None.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

function defaultLayoutEngineFactory (): ChartLayoutEngine
{
    // Return the computed result.

    return new ELK ( { workerFactory: () => new ElkWorker () } );
}

//--------------------------------------------------------------------------------------------------
// Function: boundText
//
// Description:
//
//   Constrains the text to its permitted range.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - maximumCodePointCount:
//     The maximum code point count supplied to the operation.
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

function boundText ( value: string, maximumCodePointCount: number ): string
{
    // Initialize the local values needed by this operation.

    let codePointCount = 0;
    let codeUnitCount  = 0;

    // Process each character from the value collection in order.

    for ( const character of value )
    {
        // Handle the case where code point count is at least maximum code point count.

        if ( codePointCount >= maximumCodePointCount )
        {
            break;
        }

        codePointCount++;
        codeUnitCount += character.length;
    }

    // Return the slice result.

    return value.slice ( 0, codeUnitCount );
}

//--------------------------------------------------------------------------------------------------
// Function: immutableLayoutResult
//
// Description:
//
//   Derives the immutable layout result.
//
// Parameters:
//
//   - result:
//     The result supplied to the operation.
//
//   - nodes:
//     The nodes supplied to the operation.
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

function immutableLayoutResult (
    result: ChartLayoutResult,
    nodes: readonly ChartLayoutNode[],
): ChartLayoutResult | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( result.states.length !== nodes.length ||
        !Number.isFinite ( result.effectiveMinimumStateDistance ) )
    {
        // Return the computed result.

        return null;
    }

    const states: { readonly state: string; readonly x: number; readonly y: number }[] = [];

    // Repeat the operation across the bounded iteration range.

    for ( let stateIndex = 0; stateIndex < result.states.length; stateIndex++ )
    {
        // Initialize the local values needed by this operation.

        const state        = result.states [ stateIndex ];
        const expectedNode = nodes [ stateIndex ];

        // Handle the case where at least one branch condition is satisfied.

        if ( state === undefined || expectedNode === undefined || state.state !== expectedNode.state ||
            !Number.isFinite ( state.x ) || !Number.isFinite ( state.y ) )
        {
            // Return the computed result.

            return null;
        }

        states.push ( Object.freeze ( { state: state.state, x: state.x, y: state.y } ) );
    }

    // Return the freeze result.

    return Object.freeze ( {
        effectiveMinimumStateDistance: result.effectiveMinimumStateDistance,
        states:                        Object.freeze ( states ),
    } );
}

//--------------------------------------------------------------------------------------------------
// Class: BrowserChartLayoutPort
//
// Description:
//
//   Defines the boundary used by browser chart layout.
//
//--------------------------------------------------------------------------------------------------

export class BrowserChartLayoutPort implements ChartLayoutPort
{
    //----------------------------------------------------------------------------------------------
    // Constructor: BrowserChartLayoutPort
    //
    // Description:
    //
    //   Initializes a BrowserChartLayoutPort instance.
    //
    // Parameters:
    //
    //   - layoutEngineFactory:
    //     The layout engine factory supplied to the operation.
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

    public constructor (
        private readonly layoutEngineFactory: ChartLayoutEngineFactory = defaultLayoutEngineFactory,
    )
    {
    }

    //----------------------------------------------------------------------------------------------
    // Method: layout
    //
    // Description:
    //
    //   Derives the layout.
    //
    // Parameters:
    //
    //   - nodes:
    //     The nodes supplied to the operation.
    //
    //   - edges:
    //     The edges supplied to the operation.
    //
    //   - options:
    //     Options that control the operation.
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

    public async layout (
        nodes: readonly ChartLayoutNode[],
        edges: readonly ChartLayoutEdge[],
        options?: ChartLayoutOptions,
    ): Promise<ChartLayoutResult>
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( nodes.length > MAXIMUM_INTERACTIVE_CHART_STATE_COUNT ||
            edges.length > MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT )
        {
            throw new Error (
                `Interactive Chart layout supports at most ${MAXIMUM_INTERACTIVE_CHART_STATE_COUNT} states and ` +
                `${MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT} transitions.`,
            );
        }

        let layoutEngine: ChartLayoutEngine;

        // Run the operation that may report a recoverable failure.

        try
        {
            layoutEngine = this.layoutEngineFactory ();
        }
        catch
        {
            // Recover from the reported failure without hiding its outcome.

            throw new Error ( "The Chart layout worker is unavailable." );
        }

        // Initialize the local values needed by this operation.

        let timeout: ReturnType<typeof setTimeout> | null = null;
        const timeoutResult                               = new Promise<never> ( ( _, reject ) =>
        {
            timeout = setTimeout ( () => reject ( new Error ( LAYOUT_TIMEOUT_MESSAGE ) ),
                CHART_LAYOUT_TIMEOUT_MILLISECONDS );
        } );

        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const result = await Promise.race ( [
                createElkChartLayout ( layoutEngine, nodes, edges, options ),
                timeoutResult,
            ] );
            const immutableResult = immutableLayoutResult ( result, nodes );

            // Handle the case where immutable result matches an absent value.

            if ( immutableResult === null )
            {
                throw new Error ( INVALID_LAYOUT_RESULT_MESSAGE );
            }

            // Return the immutable result.

            return immutableResult;
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            const isKnownBoundaryFailure = error instanceof Error && (
                error.message === LAYOUT_TIMEOUT_MESSAGE ||
                error.message === INVALID_LAYOUT_RESULT_MESSAGE ||
                error.message === "ELK did not return a position for every Chart state."
            );

            // Handle the case where is known boundary failure is enabled.

            if ( isKnownBoundaryFailure )
            {
                throw new Error (
                    error.message === "ELK did not return a position for every Chart state."
                        ? INVALID_LAYOUT_RESULT_MESSAGE
                        : error.message,
                    { cause: error },
                );
            }

            throw new Error (
                error instanceof Error && error.message.trim ().length > 0
                    ? boundText ( error.message, MAXIMUM_LAYOUT_ERROR_CODE_POINT_COUNT )
                    : "The Chart layout worker crashed.",
                { cause: error },
            );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            if ( timeout !== null )
            {
                clearTimeout ( timeout );
            }

            // Run the operation that may report a recoverable failure.

            try
            {
                layoutEngine.terminateWorker ();
            }
            catch
            {
                // A failed termination cannot keep a completed logical layout active.

            }
        }
    }
}

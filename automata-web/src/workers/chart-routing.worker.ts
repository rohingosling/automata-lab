// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Worker Entry Point
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Runs bounded deterministic Chart routing in one persistent worker with cooperative cancellation
//   and exact reuse.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

/// <reference lib="webworker" />

import
{
    ChartRoutingReuseCache,
    routeChartRelationsCooperatively,
} from "../infrastructure/chart/orthogonal-chart-router.js";
import
{
    CHART_ROUTING_PROTOCOL_VERSION,
    decodeChartRoutingWorkerRequest,
} from "../protocol/chart-routing-worker-protocol.js";
import type
{
    ChartRoutingWorkerCancelled,
    ChartRoutingWorkerResult,
    ChartRoutingWorkerRouteRequest,
} from "../protocol/chart-routing-worker-protocol.js";

declare const self: DedicatedWorkerGlobalScope;

const RELATION_CHECKPOINT_YIELD_INTERVAL = 8;

const reuseCache     = new ChartRoutingReuseCache ();
let activeGeneration = 0;

//--------------------------------------------------------------------------------------------------
// Function: cancelledResponse
//
// Description:
//
//   Derives the cancelled response.
//
// Parameters:
//
//   - generation:
//     The generation supplied to the operation.
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

function cancelledResponse ( generation: number ): ChartRoutingWorkerCancelled
{
    // Return the assembled result.

    return {
        generation,
        kind: "cancelled",
        protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: route
//
// Description:
//
//   Routes the requested value.
//
// Parameters:
//
//   - message:
//     The message supplied to the operation.
//
// Returns:
//
//   A promise that resolves when the operation is complete.
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

async function route ( message: ChartRoutingWorkerRouteRequest ): Promise<void>
{
    // Initialize the local values needed by this operation.

    const generation            = message.generation;
    let relationCheckpointCount = 0;

    activeGeneration = generation;

    // Calculate the result value from the current inputs.

    const result = await routeChartRelationsCooperatively ( message.request, reuseCache, {
        isCancelled: () => activeGeneration !== generation,
        yieldControl: checkpoint =>
        {
            // Handle the case where checkpoint matches the relation value.

            if ( checkpoint === "relation" )
            {
                relationCheckpointCount += 1;

                // Handle the case where current value differs from the 0 value.

                if ( relationCheckpointCount % RELATION_CHECKPOINT_YIELD_INTERVAL !== 0 )
                {
                    // Return the resolve result.

                    return Promise.resolve ();
                }
            }

            // Return the computed result.

            return new Promise ( resolve => setTimeout ( resolve, 0 ) );
        },
    } );

    // Handle the case where at least one branch condition is satisfied.

    if ( result === null || activeGeneration !== generation )
    {
        self.postMessage ( cancelledResponse ( generation ) );

        // Return control to the caller.

        return;
    }

    const response: ChartRoutingWorkerResult = {
        generation,
        kind: "result",
        protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
        result,
    };

    activeGeneration = 0;
    self.postMessage ( response );
}

self.addEventListener ( "message", event =>
{
    // Initialize the local values needed by this operation.

    const message = decodeChartRoutingWorkerRequest ( event.data );

    // Handle the case where message matches an absent value.

    if ( message === null )
    {
        // Return control to the caller.

        return;
    }

    // Handle the case where message kind matches the cancel value.

    if ( message.kind === "cancel" )
    {
        // Handle the case where active generation matches message generation.

        if ( activeGeneration === message.generation )
        {
            activeGeneration = 0;
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            self.postMessage ( cancelledResponse ( message.generation ) );
        }

        // Return control to the caller.

        return;
    }

    void route ( message );
} );

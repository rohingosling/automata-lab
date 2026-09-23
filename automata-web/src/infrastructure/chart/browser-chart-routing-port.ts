// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Chart Routing Port
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Owns one persistent bounded Chart routing worker, cooperatively replaces work, and recreates
//   failed workers.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ChartRoutingPort,
    ChartRoutingRequest,
    ChartRoutingResult,
} from "../../application/ports/contracts.js";
import
{
    CHART_ROUTING_PROTOCOL_VERSION,
    decodeChartRoutingWorkerRequest,
    decodeChartRoutingWorkerResponse,
    MAXIMUM_CHART_ROUTING_TEXT_CODE_POINT_COUNT,
} from "../../protocol/chart-routing-worker-protocol.js";
import type
{
    ChartRoutingWorkerRequest,
    ChartRoutingWorkerRouteRequest,
} from "../../protocol/chart-routing-worker-protocol.js";

export const CHART_ROUTING_TIMEOUT_MILLISECONDS              = 3_000;
export const CHART_ROUTING_CANCELLATION_TIMEOUT_MILLISECONDS = 250;

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingWorkerLike
//
// Description:
//
//   Defines the structure of chart routing worker like.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingWorkerLike
{
    onerror:   ( ( event: ErrorEvent ) => void ) | null;
    onmessage: ( ( event: MessageEvent<unknown> ) => void ) | null;
    postMessage ( message: ChartRoutingWorkerRequest ): void;
    terminate (): void;
}

//--------------------------------------------------------------------------------------------------
// Type: ChartRoutingWorkerFactory
//
// Description:
//
//   Defines the chart routing worker factory type.
//
//--------------------------------------------------------------------------------------------------

export type ChartRoutingWorkerFactory = () => ChartRoutingWorkerLike;

//--------------------------------------------------------------------------------------------------
// Interface: ActiveRoutingJob
//
// Description:
//
//   Defines the structure of active routing job.
//
//--------------------------------------------------------------------------------------------------

interface ActiveRoutingJob
{
    readonly generation:    number;
    readonly reject:        ( reason: Error ) => void;
    readonly request:       ChartRoutingRequest;
    readonly resolve:       ( result: ChartRoutingResult ) => void;
    readonly timeout:       ReturnType<typeof setTimeout>;
    readonly workerRequest: ChartRoutingWorkerRouteRequest;
}

//--------------------------------------------------------------------------------------------------
// Function: defaultWorkerFactory
//
// Description:
//
//   Creates the default worker factory.
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

function defaultWorkerFactory (): ChartRoutingWorkerLike
{
    // Return the computed result.

    return new Worker ( new URL ( "../../workers/chart-routing.worker.ts", import.meta.url ), { type: "module" } );
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
// Function: resultMatchesRequest
//
// Description:
//
//   Derives the result matches request.
//
// Parameters:
//
//   - result:
//     The result supplied to the operation.
//
//   - request:
//     The request supplied to the operation.
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

function resultMatchesRequest ( result: ChartRoutingResult, request: ChartRoutingRequest ): boolean
{
    // Return the computed result.

    return result.relations.length === request.relations.length && result.relations.every ( ( relation, index ) =>
        relation.identifier === request.relations [ index ]?.identifier );
}

//--------------------------------------------------------------------------------------------------
// Class: BrowserChartRoutingPort
//
// Description:
//
//   Defines the boundary used by browser chart routing.
//
//--------------------------------------------------------------------------------------------------

export class BrowserChartRoutingPort implements ChartRoutingPort
{
    private activeJob: ActiveRoutingJob | null = null;
    private readonly cancellationTimeouts = new Map<number, ReturnType<typeof setTimeout>> ();
    private generation = 0;
    private worker: ChartRoutingWorkerLike | null = null;

    //----------------------------------------------------------------------------------------------
    // Constructor: BrowserChartRoutingPort
    //
    // Description:
    //
    //   Initializes a BrowserChartRoutingPort instance.
    //
    // Parameters:
    //
    //   - workerFactory:
    //     The worker factory supplied to the operation.
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

    public constructor ( private readonly workerFactory: ChartRoutingWorkerFactory = defaultWorkerFactory )
    {
    }

    //----------------------------------------------------------------------------------------------
    // Method: route
    //
    // Description:
    //
    //   Routes the requested value.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
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

    public route ( request: ChartRoutingRequest ): Promise<ChartRoutingResult>
    {
        this.replaceActiveJob ( new Error ( "The previous Chart routing request was replaced." ) );

        // Initialize the local values needed by this operation.

        const generation = this.nextGeneration ();

        const workerRequest = decodeChartRoutingWorkerRequest ( {
            generation,
            kind: "route",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
            request,
        } );

        // Handle the case where at least one branch condition is satisfied.

        if ( workerRequest === null || workerRequest.kind !== "route" )
        {
            // Return the reject result.

            return Promise.reject ( new Error (
                "The Chart routing request exceeds the bounded Chart routing worker protocol.",
            ) );
        }

        // Return the computed result.

        return new Promise ( ( resolve, reject ) =>
        {
            // Initialize the local values needed by this operation.

            const timeout = setTimeout ( () =>
            {
                // Handle the case where generation matches generation.

                if ( this.activeJob?.generation === generation )
                {
                    this.failActiveJobAndWorker ( new Error ( "Chart routing exceeded its three-second bound." ) );
                }
            }, CHART_ROUTING_TIMEOUT_MILLISECONDS );

            this.activeJob = { generation, reject, request, resolve, timeout, workerRequest };
            this.postActiveJob ();
        } );
    }

    //----------------------------------------------------------------------------------------------
    // Method: cancel
    //
    // Description:
    //
    //   Cancels the requested value.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    public cancel (): Promise<void>
    {
        this.replaceActiveJob ( new Error ( "The Chart routing request was cancelled." ) );

        // Return the resolve result.

        return Promise.resolve ();
    }

    //----------------------------------------------------------------------------------------------
    // Method: acknowledgeCancellation
    //
    // Description:
    //
    //   Acknowledges the cancellation.
    //
    // Parameters:
    //
    //   - generation:
    //     The generation supplied to the operation.
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

    private acknowledgeCancellation ( generation: number ): void
    {
        // Initialize the local values needed by this operation.

        const timeout = this.cancellationTimeouts.get ( generation );

        // Handle the case where timeout differs from undefined.

        if ( timeout !== undefined )
        {
            clearTimeout ( timeout );
            this.cancellationTimeouts.delete ( generation );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: createWorker
    //
    // Description:
    //
    //   Creates worker.
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
    //----------------------------------------------------------------------------------------------

    private createWorker (): ChartRoutingWorkerLike | null
    {
        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const worker = this.workerFactory ();

            worker.onmessage = event => this.handleWorkerMessage ( worker, event.data );
            worker.onerror   = event => this.handleWorkerError ( worker, event );
            this.worker      = worker;

            // Return the worker.

            return worker;
        }
        catch
        {
            // Recover from the reported failure without hiding its outcome.

            return null;
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: failActiveJobAndWorker
    //
    // Description:
    //
    //   Marks the active job and worker as failed.
    //
    // Parameters:
    //
    //   - error:
    //     The error supplied to the operation.
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

    private failActiveJobAndWorker ( error: Error ): void
    {
        // Initialize the local values needed by this operation.

        const activeJob = this.activeJob;

        this.activeJob = null;
        this.terminateWorker ();

        // Handle the case where active job differs from an absent value.

        if ( activeJob !== null )
        {
            clearTimeout ( activeJob.timeout );
            activeJob.reject ( error );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: finishActiveJob
    //
    // Description:
    //
    //   Finalizes the active job.
    //
    // Parameters:
    //
    //   - result:
    //     The result supplied to the operation.
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

    private finishActiveJob ( result: ChartRoutingResult ): void
    {
        // Initialize the local values needed by this operation.

        const activeJob = this.activeJob;

        // Handle the case where active job matches an absent value.

        if ( activeJob === null )
        {
            // Return control to the caller.

            return;
        }

        this.activeJob = null;
        clearTimeout ( activeJob.timeout );
        activeJob.resolve ( result );
    }

    //----------------------------------------------------------------------------------------------
    // Method: handleCancellationTimeout
    //
    // Description:
    //
    //   Handles cancellation timeout.
    //
    // Parameters:
    //
    //   - worker:
    //     The worker supplied to the operation.
    //
    //   - generation:
    //     The generation supplied to the operation.
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

    private handleCancellationTimeout ( worker: ChartRoutingWorkerLike, generation: number ): void
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( this.worker !== worker || !this.cancellationTimeouts.has ( generation ) )
        {
            // Return control to the caller.

            return;
        }

        this.cancellationTimeouts.delete ( generation );

        const activeJob = this.activeJob;

        this.terminateWorker ();

        // Handle the case where all required conditions are satisfied.

        if ( activeJob !== null && this.activeJob === activeJob )
        {
            this.postActiveJob ();
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: handleWorkerError
    //
    // Description:
    //
    //   Handles worker error.
    //
    // Parameters:
    //
    //   - worker:
    //     The worker supplied to the operation.
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

    private handleWorkerError ( worker: ChartRoutingWorkerLike, event: ErrorEvent ): void
    {
        // Handle the case where worker differs from worker.

        if ( this.worker !== worker )
        {
            // Return control to the caller.

            return;
        }

        event.preventDefault ();
        this.failActiveJobAndWorker ( new Error (
            typeof event.message === "string" && event.message.trim ().length > 0
                ? boundText ( event.message, MAXIMUM_CHART_ROUTING_TEXT_CODE_POINT_COUNT )
                : "The Chart routing worker crashed.",
        ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: handleWorkerMessage
    //
    // Description:
    //
    //   Handles worker message.
    //
    // Parameters:
    //
    //   - worker:
    //     The worker supplied to the operation.
    //
    //   - data:
    //     The data supplied to the operation.
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

    private handleWorkerMessage ( worker: ChartRoutingWorkerLike, data: unknown ): void
    {
        // Handle the case where worker differs from worker.

        if ( this.worker !== worker )
        {
            // Return control to the caller.

            return;
        }

        const message = decodeChartRoutingWorkerResponse ( data );

        // Handle the case where message matches an absent value.

        if ( message === null )
        {
            this.failActiveJobAndWorker ( new Error ( "The Chart routing worker returned an invalid result." ) );

            // Return control to the caller.

            return;
        }

        // Handle the case where message kind matches the cancelled value.

        if ( message.kind === "cancelled" )
        {
            this.acknowledgeCancellation ( message.generation );

            // Return control to the caller.

            return;
        }

        const activeJob = this.activeJob;

        // Handle the case where at least one branch condition is satisfied.

        if ( activeJob === null || message.generation !== activeJob.generation )
        {
            // Return control to the caller.

            return;
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( message.result.requestId !== activeJob.request.requestId ||
            message.result.documentRevision !== activeJob.request.documentRevision ||
            message.result.geometryRevision !== activeJob.request.geometryRevision ||
            message.result.preferenceRevision !== activeJob.request.preferenceRevision )
        {
            // Return control to the caller.

            return;
        }

        // Handle the case where the result matches request result condition is not satisfied.

        if ( !resultMatchesRequest ( message.result, activeJob.workerRequest.request ) )
        {
            this.failActiveJobAndWorker ( new Error ( "The Chart routing worker returned an invalid result." ) );

            // Return control to the caller.

            return;
        }

        this.finishActiveJob ( message.result );
    }

    //----------------------------------------------------------------------------------------------
    // Method: nextGeneration
    //
    // Description:
    //
    //   Advances the generation.
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
    //----------------------------------------------------------------------------------------------

    private nextGeneration (): number
    {
        this.generation = this.generation >= Number.MAX_SAFE_INTEGER ? 1 : this.generation + 1;

        // Return the computed result.

        return this.generation;
    }

    //----------------------------------------------------------------------------------------------
    // Method: postActiveJob
    //
    // Description:
    //
    //   Posts the active job.
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

    private postActiveJob (): void
    {
        // Initialize the local values needed by this operation.

        const activeJob = this.activeJob;

        // Handle the case where active job matches an absent value.

        if ( activeJob === null )
        {
            // Return control to the caller.

            return;
        }

        const worker = this.worker ?? this.createWorker ();

        // Handle the case where worker matches an absent value.

        if ( worker === null )
        {
            this.failActiveJobAndWorker ( new Error ( "The Chart routing worker is unavailable." ) );

            // Return control to the caller.

            return;
        }

        // Run the operation that may report a recoverable failure.

        try
        {
            worker.postMessage ( activeJob.workerRequest );
        }
        catch
        {
            // Recover from the reported failure without hiding its outcome.

            this.failActiveJobAndWorker ( new Error ( "The Chart routing worker is unavailable." ) );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: replaceActiveJob
    //
    // Description:
    //
    //   Replaces the active job.
    //
    // Parameters:
    //
    //   - error:
    //     The error supplied to the operation.
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

    private replaceActiveJob ( error: Error ): void
    {
        // Initialize the local values needed by this operation.

        const activeJob = this.activeJob;

        // Handle the case where active job matches an absent value.

        if ( activeJob === null )
        {
            // Return control to the caller.

            return;
        }

        this.activeJob = null;
        clearTimeout ( activeJob.timeout );
        activeJob.reject ( error );
        this.requestCooperativeCancellation ( activeJob.generation );
    }

    //----------------------------------------------------------------------------------------------
    // Method: requestCooperativeCancellation
    //
    // Description:
    //
    //   Requests the cooperative cancellation.
    //
    // Parameters:
    //
    //   - generation:
    //     The generation supplied to the operation.
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

    private requestCooperativeCancellation ( generation: number ): void
    {
        // Initialize the local values needed by this operation.

        const worker = this.worker;

        // Handle the case where worker matches an absent value.

        if ( worker === null )
        {
            // Return control to the caller.

            return;
        }

        const timeout = setTimeout ( () =>
        {
            this.handleCancellationTimeout ( worker, generation );
        }, CHART_ROUTING_CANCELLATION_TIMEOUT_MILLISECONDS );

        this.cancellationTimeouts.set ( generation, timeout );

        // Run the operation that may report a recoverable failure.

        try
        {
            worker.postMessage ( {
                generation,
                kind: "cancel",
                protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
            } );
        }
        catch
        {
            // Recover from the reported failure without hiding its outcome.

            this.terminateWorker ();
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: terminateWorker
    //
    // Description:
    //
    //   Terminates the worker.
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

    private terminateWorker (): void
    {
        // Initialize the local values needed by this operation.

        const worker = this.worker;

        this.worker = null;
        this.cancellationTimeouts.forEach ( timeout => clearTimeout ( timeout ) );
        this.cancellationTimeouts.clear ();

        // Handle the case where worker matches an absent value.

        if ( worker === null )
        {
            // Return control to the caller.

            return;
        }

        worker.onerror   = null;
        worker.onmessage = null;

        // Run the operation that may report a recoverable failure.

        try
        {
            worker.terminate ();
        }
        catch
        {
            // A failed termination cannot keep a failed logical worker active.

        }
    }
}

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Solver Worker Port
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Owns one disposable Solver Worker job, rejects stale messages, and terminates cancellation or
//   failure cleanly.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { SolverJobPort, SolverJobRequest, SolverProgress } from "../../application/ports/contracts.js";
import type { SolverInferenceResult } from "../../domain/solver/contracts.js";
import
{
    decodeSolverWorkerMessage,
    decodeSolverWorkerRequest,
    MAXIMUM_SOLVER_WORKER_TEXT_CODE_POINT_COUNT,
    SOLVER_PROTOCOL_VERSION,
} from "../../protocol/solver-worker-protocol.js";
import type { SolverWorkerSolveRequest } from "../../protocol/solver-worker-protocol.js";

//--------------------------------------------------------------------------------------------------
// Interface: SolverWorkerLike
//
// Description:
//
//   Defines the structure of solver worker like.
//
//--------------------------------------------------------------------------------------------------

export interface SolverWorkerLike
{
    onerror:   ( ( event: ErrorEvent ) => void ) | null;
    onmessage: ( ( event: MessageEvent<unknown> ) => void ) | null;
    postMessage ( message: SolverWorkerSolveRequest ): void;
    terminate (): void;
}

//--------------------------------------------------------------------------------------------------
// Type: SolverWorkerFactory
//
// Description:
//
//   Defines the solver worker factory type.
//
//--------------------------------------------------------------------------------------------------

export type SolverWorkerFactory = () => SolverWorkerLike;

//--------------------------------------------------------------------------------------------------
// Interface: ActiveSolverJob
//
// Description:
//
//   Defines the structure of active solver job.
//
//--------------------------------------------------------------------------------------------------

interface ActiveSolverJob
{
    readonly jobId: string;
    readonly resolve: ( result: SolverInferenceResult ) => void;
    readonly worker: SolverWorkerLike;
}

//--------------------------------------------------------------------------------------------------
// Function: failureResult
//
// Description:
//
//   Derives the failure result.
//
// Parameters:
//
//   - code:
//     The code supplied to the operation.
//
//   - message:
//     The message supplied to the operation.
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

function failureResult ( code: "SOLVER_CANCELLED" | "SOLVER_FAILURE", message: string ): SolverInferenceResult
{
    // Initialize the local values needed by this operation.

    const boundedMessage = boundText ( message, MAXIMUM_SOLVER_WORKER_TEXT_CODE_POINT_COUNT );
    const diagnostic     = Object.freeze ( {
        code,
        severity: "error" as const,
        message: boundedMessage,
        remediation: code === "SOLVER_CANCELLED"
            ? "Run Solve again when ready."
            : "Retry with a fresh Solver Worker and review the Console if the failure repeats.",
        relatedLocations: Object.freeze ( [] ),
    } );

    // Return the freeze result.

    return Object.freeze ( {
        status: "failure",
        diagnostics: Object.freeze ( [ diagnostic ] ),
    } );
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

        codePointCount += 1;
        codeUnitCount += character.length;
    }

    // Return the slice result.

    return value.slice ( 0, codeUnitCount );
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

function defaultWorkerFactory (): SolverWorkerLike
{
    // Return the computed result.

    return new Worker ( new URL ( "../../workers/solver.worker.ts", import.meta.url ), { type: "module" } );
}

//--------------------------------------------------------------------------------------------------
// Class: BrowserSolverWorkerPort
//
// Description:
//
//   Defines the boundary used by browser solver worker.
//
//--------------------------------------------------------------------------------------------------

export class BrowserSolverWorkerPort implements SolverJobPort
{
    private activeJob: ActiveSolverJob | null = null;

    //----------------------------------------------------------------------------------------------
    // Constructor: BrowserSolverWorkerPort
    //
    // Description:
    //
    //   Initializes a BrowserSolverWorkerPort instance.
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

    public constructor ( private readonly workerFactory: SolverWorkerFactory = defaultWorkerFactory )
    {
    }

    //----------------------------------------------------------------------------------------------
    // Method: solve
    //
    // Description:
    //
    //   Derives the solve.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
    //
    //   - reportProgress:
    //     The report progress supplied to the operation.
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

    public solve (
        request: SolverJobRequest,
        reportProgress: ( progress: SolverProgress ) => void,
    ): Promise<SolverInferenceResult>
    {
        // Handle the case where active job differs from an absent value.

        if ( this.activeJob !== null )
        {
            this.finishActiveJob ( failureResult ( "SOLVER_CANCELLED", "The previous Solver job was replaced." ) );
        }

        const workerRequest = decodeSolverWorkerRequest (
            {
                protocolVersion: SOLVER_PROTOCOL_VERSION,
                kind: "solve",
                jobId: request.jobId,
                request:
                {
                    documentRevision: request.documentRevision,
                    solverRevision: request.solverRevision,
                    observations: request.observations,
                },
            },
        );

        // Handle the case where worker request matches an absent value.

        if ( workerRequest === null )
        {
            // Return the resolve result.

            return Promise.resolve ( failureResult (
                "SOLVER_FAILURE",
                "The Solver request exceeds the bounded Solver Worker protocol.",
            ) );
        }

        // Return the computed result.

        return new Promise ( resolve =>
        {
            // Initialize the local values needed by this operation.

            let worker: SolverWorkerLike;

            // Run the operation that may report a recoverable failure.

            try
            {
                worker = this.workerFactory ();
            }
            catch
            {
                // Recover from the reported failure without hiding its outcome.

                resolve ( failureResult ( "SOLVER_FAILURE", "The Solver Worker is unavailable." ) );

                // Return control to the caller.

                return;
            }

            this.activeJob = { jobId: request.jobId, resolve, worker };

            worker.onmessage = event =>
            {
                // Handle the case where at least one branch condition is satisfied.

                if ( this.activeJob?.worker !== worker || this.activeJob.jobId !== request.jobId )
                {
                    // Return control to the caller.

                    return;
                }

                const message = decodeSolverWorkerMessage ( event.data );

                // Handle the case where message matches an absent value.

                if ( message === null )
                {
                    this.finishActiveJob ( failureResult (
                        "SOLVER_FAILURE",
                        "The Solver Worker returned an invalid message.",
                    ) );

                    // Return control to the caller.

                    return;
                }

                // Handle the case where message job identifier differs from request job identifier.

                if ( message.jobId !== request.jobId )
                {
                    // Return control to the caller.

                    return;
                }

                // Handle the case where message kind matches the progress value.

                if ( message.kind === "progress" )
                {
                    reportProgress ( message.progress );

                    // Return control to the caller.

                    return;
                }

                this.finishActiveJob ( message.result );
            };
            worker.onerror = event =>
            {
                event.preventDefault ();
                this.finishActiveJob ( failureResult (
                    "SOLVER_FAILURE",
                    typeof event.message === "string" && event.message.trim ().length > 0
                        ? event.message
                        : "The Solver Worker crashed.",
                ) );
            };

            // Run the operation that may report a recoverable failure.

            try
            {
                worker.postMessage ( workerRequest );
            }
            catch
            {
                // Recover from the reported failure without hiding its outcome.

                this.finishActiveJob ( failureResult ( "SOLVER_FAILURE", "The Solver Worker is unavailable." ) );
            }
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
        this.finishActiveJob ( failureResult ( "SOLVER_CANCELLED", "The Solver job was cancelled." ) );

        // Return the resolve result.

        return Promise.resolve ();
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

    private finishActiveJob ( result: SolverInferenceResult ): void
    {
        // Initialize the local values needed by this operation.

        const activeJob = this.activeJob;

        // Handle the case where active job matches an absent value.

        if ( activeJob === null )
        {
            // Return control to the caller.

            return;
        }

        this.activeJob             = null;
        activeJob.worker.onerror   = null;
        activeJob.worker.onmessage = null;

        // Run the operation that may report a recoverable failure.

        try
        {
            activeJob.worker.terminate ();
        }
        catch
        {
            // A failed termination cannot keep a completed logical job active.

        }

        activeJob.resolve ( result );
    }
}

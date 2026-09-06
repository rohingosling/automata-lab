// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Worker Entry Point
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Runs deterministic inference in an isolated terminable worker and emits only bounded progress
//   and final messages.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

/// <reference lib="webworker" />

import { inferSolverCandidate } from "../domain/solver/inference.js";
import { decodeSolverWorkerRequest, SOLVER_PROTOCOL_VERSION } from "../protocol/solver-worker-protocol.js";
import type { SolverWorkerMessage } from "../protocol/solver-worker-protocol.js";

declare const self: DedicatedWorkerGlobalScope;

//--------------------------------------------------------------------------------------------------
// Function: post
//
// Description:
//
//   Posts the requested value.
//
// Parameters:
//
//   - message:
//     The message supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function post ( message: SolverWorkerMessage ): void
{
    self.postMessage ( message );
}

self.addEventListener ( "message", event =>
{
    // Initialize the local values needed by this operation.

    const request = decodeSolverWorkerRequest ( event.data );

    // Handle the case where request matches an absent value.

    if ( request === null )
    {
        // Return control to the caller.

        return;
    }

    post (
        {
            protocolVersion: SOLVER_PROTOCOL_VERSION,
            kind: "progress",
            jobId: request.jobId,
            progress: { completedWork: 0, totalWork: 1, message: "Building and merging Solver evidence." },
        },
    );

    const result = inferSolverCandidate ( request.request );

    post (
        {
            protocolVersion: SOLVER_PROTOCOL_VERSION,
            kind: "progress",
            jobId: request.jobId,
            progress: { completedWork: 1, totalWork: 1, message: "Candidate replay verification complete." },
        },
    );
    post ( { protocolVersion: SOLVER_PROTOCOL_VERSION, kind: "result", jobId: request.jobId, result } );
} );

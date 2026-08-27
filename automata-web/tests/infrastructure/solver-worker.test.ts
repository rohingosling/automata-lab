// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Worker Adapter Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies progress, cancellation by termination, stale response rejection, immutable results,
//   and fresh retries.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import type { SolverJobRequest } from "../../src/application/ports/contracts.js";
import
{
    MAXIMUM_NAME_CODE_POINT_COUNT,
    MAXIMUM_SOLVER_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_TOKEN_COUNT,
    MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT,
} from "../../src/domain/model/limits.js";
import { inferSolverCandidate } from "../../src/domain/solver/inference.js";
import { BrowserSolverWorkerPort } from "../../src/infrastructure/solver/browser-solver-worker-port.js";
import type { SolverWorkerLike } from "../../src/infrastructure/solver/browser-solver-worker-port.js";
import
{
    decodeSolverWorkerMessage,
    decodeSolverWorkerRequest,
    MAXIMUM_SOLVER_WORKER_TEXT_CODE_POINT_COUNT,
    SOLVER_PROTOCOL_VERSION,
} from "../../src/protocol/solver-worker-protocol.js";
import type { SolverWorkerSolveRequest } from "../../src/protocol/solver-worker-protocol.js";

//--------------------------------------------------------------------------------------------------
// Class: FakeErrorEvent
//
// Description:
//
//   Implements the fake error event behavior.
//
//--------------------------------------------------------------------------------------------------

class FakeErrorEvent extends Event implements ErrorEvent
{
    public readonly colno = 0;
    public readonly error: unknown = null;
    public readonly filename = "solver.worker.ts";
    public readonly lineno = 0;

    //----------------------------------------------------------------------------------------------
    // Constructor: FakeErrorEvent
    //
    // Description:
    //
    //   Initializes a FakeErrorEvent instance.
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
    //----------------------------------------------------------------------------------------------

    public constructor ( public readonly message: string )
    {
        super ( "error", { cancelable: true } );
    }
}

//--------------------------------------------------------------------------------------------------
// Class: FakeSolverWorker
//
// Description:
//
//   Implements the fake solver worker behavior.
//
//--------------------------------------------------------------------------------------------------

class FakeSolverWorker implements SolverWorkerLike
{
    public onerror: ( ( event: ErrorEvent ) => void ) | null = null;
    public onmessage: ( ( event: MessageEvent<unknown> ) => void ) | null = null;
    public postedRequest: SolverWorkerSolveRequest | null = null;
    public terminated = false;

    //----------------------------------------------------------------------------------------------
    // Method: postMessage
    //
    // Description:
    //
    //   Posts the message.
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
    //----------------------------------------------------------------------------------------------

    public postMessage ( message: SolverWorkerSolveRequest ): void
    {
        this.postedRequest = message;
    }

    //----------------------------------------------------------------------------------------------
    // Method: terminate
    //
    // Description:
    //
    //   Terminates the requested value.
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

    public terminate (): void
    {
        this.terminated = true;
    }

    //----------------------------------------------------------------------------------------------
    // Method: emit
    //
    // Description:
    //
    //   Emits the requested value.
    //
    // Parameters:
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

    public emit ( data: unknown ): void
    {
        this.onmessage?.( new MessageEvent ( "message", { data } ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: fail
    //
    // Description:
    //
    //   Marks the operation as failed.
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
    //----------------------------------------------------------------------------------------------

    public fail ( message: string ): void
    {
        this.onerror?.( new FakeErrorEvent ( message ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: failWithoutMessage
    //
    // Description:
    //
    //   Marks the without message as failed.
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

    public failWithoutMessage (): void
    {
        this.onerror?.( new Event ( "error", { cancelable: true } ) as ErrorEvent );
    }
}

//--------------------------------------------------------------------------------------------------
// Class: ThrowingPostSolverWorker
//
// Description:
//
//   Implements the throwing post solver worker behavior.
//
//--------------------------------------------------------------------------------------------------

class ThrowingPostSolverWorker extends FakeSolverWorker
{
    //----------------------------------------------------------------------------------------------
    // Method: postMessage
    //
    // Description:
    //
    //   Posts the message.
    //
    // Parameters:
    //
    //   - _message:
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
    //----------------------------------------------------------------------------------------------

    public override postMessage ( _message: SolverWorkerSolveRequest ): void
    {
        throw new Error ( "Blocked by browser policy." );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: createJob
//
// Description:
//
//   Creates job for the test scenario.
//
// Parameters:
//
//   - jobId:
//     The job identifier supplied to the operation.
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

function createJob ( jobId: string ): SolverJobRequest
{
    // Return the assembled result.

    return {
        jobId,
        documentRevision: 2,
        solverRevision: 4,
        observations:
        [
            {
                name: "worker",
                startContext: "initial",
                rawTokens: [ "state_ready", "event_finish", "state_done" ],
            },
        ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: workerResult
//
// Description:
//
//   Derives the worker result.
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
//--------------------------------------------------------------------------------------------------

function workerResult ( request: SolverJobRequest )
{
    // Return the infer solver candidate result.

    return inferSolverCandidate (
        {
            documentRevision: request.documentRevision,
            solverRevision: request.solverRevision,
            observations: request.observations,
        },
    );
}

//--------------------------------------------------------------------------------------------------
// Function: protocolRequest
//
// Description:
//
//   Derives the protocol request.
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
//--------------------------------------------------------------------------------------------------

function protocolRequest ( request: SolverJobRequest )
{
    // Return the assembled result.

    return {
        protocolVersion: SOLVER_PROTOCOL_VERSION,
        kind: "solve",
        jobId: request.jobId,
        request:
        {
            documentRevision: request.documentRevision,
            solverRevision: request.solverRevision,
            observations: request.observations.map ( observation => ( {
                name: observation.name,
                startContext: observation.startContext,
                rawTokens: [ ...observation.rawTokens ],
            } ) ),
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: resultMessage
//
// Description:
//
//   Derives the result message.
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
//--------------------------------------------------------------------------------------------------

function resultMessage ( request: SolverJobRequest )
{
    // Return the assembled result.

    return {
        protocolVersion: SOLVER_PROTOCOL_VERSION,
        kind: "result",
        jobId: request.jobId,
        result: workerResult ( request ),
    };
}

describe ( "Solver Worker protocol boundary", () =>
{
    it ( "accepts exactly 1,000 observations and 50,000 aggregate tokens, then rejects either limit plus one", () =>
    {
        // Initialize the local values needed by this operation.

        const observations = Array.from ( { length: MAXIMUM_SOLVER_SEQUENCE_COUNT }, ( _, index ) => ( {
            name: `sequence_${index}`,
            startContext: "infer" as const,
            rawTokens: index === 0
                ? Array.from ( { length: MAXIMUM_SOLVER_TOKEN_COUNT - MAXIMUM_SOLVER_SEQUENCE_COUNT + 1 }, () => "state_x" )
                : [ "state_x" ],
        } ) );
        const boundaryRequest = {
            protocolVersion: SOLVER_PROTOCOL_VERSION,
            kind: "solve",
            jobId: "boundary",
            request: { documentRevision: 0, solverRevision: 0, observations },
        };

        expect ( decodeSolverWorkerRequest ( boundaryRequest ) ).not.toBeNull ();

        observations [ 0 ]?.rawTokens.push ( "state_x" );
        expect ( decodeSolverWorkerRequest ( boundaryRequest ) ).toBeNull ();

        // Calculate the too many observations value from the current inputs.

        const tooManyObservations = {
            ...boundaryRequest,
            request:
            {
                ...boundaryRequest.request,
                observations: Array.from ( { length: MAXIMUM_SOLVER_SEQUENCE_COUNT + 1 }, ( _, index ) => ( {
                    name: `sequence_${index}`,
                    startContext: "infer",
                    rawTokens: [],
                } ) ),
            },
        };

        expect ( decodeSolverWorkerRequest ( tooManyObservations ) ).toBeNull ();
    } );

    it ( "accepts an exact-length raw token and rejects one Unicode code point above the worker bound", () =>
    {
        // Initialize the local values needed by this operation.

        const request     = protocolRequest ( createJob ( "token-boundary" ) );
        const observation = request.request.observations [ 0 ];
        const exactToken  = `action_${"😀".repeat (
            MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT - [ ..."action_" ].length,
        )}`;

        // Handle the case where observation matches undefined.

        if ( observation === undefined )
        {
            throw new Error ( "The worker-boundary fixture requires one observation." );
        }

        observation.rawTokens = [ exactToken ];
        expect ( decodeSolverWorkerRequest ( request ) ).not.toBeNull ();

        observation.rawTokens = [ `${exactToken}😀` ];
        expect ( decodeSolverWorkerRequest ( request ) ).toBeNull ();
    } );

    it ( "rejects extra, forbidden, inherited, accessor, and oversized request fields", () =>
    {
        // Initialize the local values needed by this operation.

        const extraEnvelope        = { ...protocolRequest ( createJob ( "extra" ) ), unexpected: true };
        const forbiddenRequest     = protocolRequest ( createJob ( "forbidden" ) );
        const inheritedRequest     = protocolRequest ( createJob ( "inherited" ) );
        const accessorRequest      = protocolRequest ( createJob ( "accessor" ) );
        const oversizedNameRequest = protocolRequest ( createJob ( "oversized" ) );

        Object.defineProperty ( forbiddenRequest.request, "__proto__", { enumerable: true, value: {} } );
        Object.setPrototypeOf ( inheritedRequest.request.observations [ 0 ] ?? {}, { injected: true } );
        Object.defineProperty ( accessorRequest.request, "solverRevision", {
            enumerable: true,
            get: () => 4,
        } );

        const oversizedObservation = oversizedNameRequest.request.observations [ 0 ];

        // Handle the case where oversized observation differs from undefined.

        if ( oversizedObservation !== undefined )
        {
            oversizedObservation.name = "n".repeat ( MAXIMUM_NAME_CODE_POINT_COUNT + 1 );
        }

        expect ( decodeSolverWorkerRequest ( extraEnvelope ) ).toBeNull ();
        expect ( decodeSolverWorkerRequest ( forbiddenRequest ) ).toBeNull ();
        expect ( decodeSolverWorkerRequest ( inheritedRequest ) ).toBeNull ();
        expect ( decodeSolverWorkerRequest ( accessorRequest ) ).toBeNull ();
        expect ( decodeSolverWorkerRequest ( oversizedNameRequest ) ).toBeNull ();
    } );

    it ( "accepts safe progress counts and rejects unsafe or overlong progress without retaining the raw object", () =>
    {
        // Initialize the local values needed by this operation.

        const progress = { completedWork: 1, totalWork: 2, message: "Working" };
        const decoded  = decodeSolverWorkerMessage ( {
            protocolVersion: SOLVER_PROTOCOL_VERSION,
            kind: "progress",
            jobId: "progress",
            progress,
        } );

        expect ( decoded ).toMatchObject ( { kind: "progress", progress } );
        expect ( decoded?.kind === "progress" && decoded.progress ).not.toBe ( progress );
        expect ( decoded?.kind === "progress" && Object.isFrozen ( decoded.progress ) ).toBe ( true );

        // Process each invalid progress from the current value collection in order.

        for ( const invalidProgress of [
            { completedWork: -1, totalWork: 2, message: "Working" },
            { completedWork: 0.5, totalWork: 2, message: "Working" },
            { completedWork: 0, totalWork: 0, message: "Working" },
            { completedWork: 3, totalWork: 2, message: "Working" },
            { completedWork: 0, totalWork: Number.MAX_SAFE_INTEGER + 1, message: "Working" },
            { completedWork: 0, totalWork: 1, message: "x".repeat ( MAXIMUM_SOLVER_WORKER_TEXT_CODE_POINT_COUNT + 1 ) },
        ] )
        {
            expect ( decodeSolverWorkerMessage ( {
                protocolVersion: SOLVER_PROTOCOL_VERSION,
                kind: "progress",
                jobId: "progress",
                progress: invalidProgress,
            } ) ).toBeNull ();
        }
    } );

    it ( "accepts 100 bounded diagnostics and rejects a diagnostic count or published string above its bound", () =>
    {
        // Initialize the local values needed by this operation.

        const diagnostics = Array.from ( { length: 100 }, ( _, index ) => ( {
            code: "SOLVER_FAILURE",
            severity: "error",
            message: `Failure ${index}`,
            remediation: "Retry.",
            relatedLocations: [],
        } ) );
        const message = {
            protocolVersion: SOLVER_PROTOCOL_VERSION,
            kind: "result",
            jobId: "diagnostics",
            result: { status: "failure", diagnostics },
        };

        expect ( decodeSolverWorkerMessage ( message ) ).not.toBeNull ();

        diagnostics.push ( { ...diagnostics [ 0 ]!, message: "One too many." } );
        expect ( decodeSolverWorkerMessage ( message ) ).toBeNull ();

        diagnostics.splice ( 1 );
        const diagnostic = diagnostics [ 0 ];

        // Handle the case where diagnostic differs from undefined.

        if ( diagnostic !== undefined )
        {
            diagnostic.message = "x".repeat ( MAXIMUM_SOLVER_WORKER_TEXT_CODE_POINT_COUNT + 1 );
        }

        expect ( decodeSolverWorkerMessage ( message ) ).toBeNull ();
    } );

    it ( "copies and freezes a valid result while rejecting malformed, cyclic, and prototype-bearing candidates", () =>
    {
        // Initialize the local values needed by this operation.

        const request    = createJob ( "result" );
        const rawMessage = resultMessage ( request );
        const decoded    = decodeSolverWorkerMessage ( rawMessage );

        expect ( decoded?.kind ).toBe ( "result" );

        // Handle the case where all required conditions are satisfied.

        if ( decoded?.kind === "result" && decoded.result.status === "success" )
        {
            expect ( decoded.result.candidate ).not.toBe ( rawMessage.result.status === "success"
                ? rawMessage.result.candidate
                : null );
            expect ( Object.isFrozen ( decoded.result.candidate ) ).toBe ( true );
            expect ( Object.isFrozen ( decoded.result.candidate.stateMachine.states ) ).toBe ( true );
        }

        // Initialize the local values needed by this operation.

        const extraCandidateMessage = structuredClone ( rawMessage );
        const cyclicMessage         = structuredClone ( rawMessage );
        const prototypeMessage      = structuredClone ( rawMessage );

        // Handle the case where status matches "success".

        if ( extraCandidateMessage.result.status === "success" )
        {
            Object.assign ( extraCandidateMessage.result.candidate, { unexpected: true } );
        }

        // Handle the case where status matches "success".

        if ( cyclicMessage.result.status === "success" )
        {
            // Initialize the local values needed by this operation.

            const cyclicDiagnostics = cyclicMessage.result.diagnostics as unknown[];

            cyclicDiagnostics.push ( cyclicDiagnostics );
        }

        // Handle the case where status matches "success".

        if ( prototypeMessage.result.status === "success" )
        {
            Object.setPrototypeOf ( prototypeMessage.result.candidate.statistics, { injected: true } );
        }

        expect ( decodeSolverWorkerMessage ( extraCandidateMessage ) ).toBeNull ();
        expect ( decodeSolverWorkerMessage ( cyclicMessage ) ).toBeNull ();
        expect ( decodeSolverWorkerMessage ( prototypeMessage ) ).toBeNull ();
    } );
} );

describe ( "browser Solver Worker port", () =>
{
    it ( "returns a stable unavailable failure when Worker construction fails and permits a fresh retry", async () =>
    {
        // Initialize the local values needed by this operation.

        const worker                 = new FakeSolverWorker ();
        let constructionAttemptCount = 0;
        const port                   = new BrowserSolverWorkerPort ( () =>
        {
            constructionAttemptCount++;

            // Handle the case where construction attempt count matches 1.

            if ( constructionAttemptCount === 1 )
            {
                throw new Error ( "Worker construction blocked." );
            }

            // Return the worker.

            return worker;
        } );

        await expect ( port.solve ( createJob ( "unavailable" ), () => undefined ) ).resolves.toMatchObject (
            {
                status: "failure",
                diagnostics: [ { code: "SOLVER_FAILURE", message: "The Solver Worker is unavailable." } ],
            },
        );

        // Initialize the local values needed by this operation.

        const retryRequest = createJob ( "retry" );
        const retryPromise = port.solve ( retryRequest, () => undefined );

        worker.emit ( resultMessage ( retryRequest ) );

        await expect ( retryPromise ).resolves.toMatchObject ( { status: "success" } );
        expect ( constructionAttemptCount ).toBe ( 2 );
    } );

    it ( "settles a postMessage failure, terminates the unavailable worker, and leaves the port retryable", async () =>
    {
        // Initialize the local values needed by this operation.

        const unavailableWorker           = new ThrowingPostSolverWorker ();
        const retryWorker                 = new FakeSolverWorker ();
        const workers: SolverWorkerLike[] = [ unavailableWorker, retryWorker ];
        const port                        = new BrowserSolverWorkerPort ( () => workers.shift () ?? retryWorker );

        await expect ( port.solve ( createJob ( "blocked" ), () => undefined ) ).resolves.toMatchObject (
            {
                status: "failure",
                diagnostics: [ { code: "SOLVER_FAILURE", message: "The Solver Worker is unavailable." } ],
            },
        );
        expect ( unavailableWorker.terminated ).toBe ( true );

        // Initialize the local values needed by this operation.

        const retryRequest = createJob ( "retry" );
        const retryPromise = port.solve ( retryRequest, () => undefined );

        retryWorker.emit ( resultMessage ( retryRequest ) );
        await expect ( retryPromise ).resolves.toMatchObject ( { status: "success" } );
    } );

    it ( "rejects an invalid active message as a structured failure and succeeds on retry", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: FakeSolverWorker[] = [];
        const port                        = new BrowserSolverWorkerPort ( () =>
        {
            // Initialize the local values needed by this operation.

            const worker = new FakeSolverWorker ();

            workers.push ( worker );

            // Return the worker.

            return worker;
        } );
        const invalidPromise = port.solve ( createJob ( "invalid" ), () => undefined );

        workers [ 0 ]?.emit ( {
            protocolVersion: SOLVER_PROTOCOL_VERSION,
            kind: "progress",
            jobId: "invalid",
            progress: { completedWork: -1, totalWork: 0, message: "Invalid" },
        } );

        await expect ( invalidPromise ).resolves.toMatchObject (
            {
                status: "failure",
                diagnostics: [ { code: "SOLVER_FAILURE", message: "The Solver Worker returned an invalid message." } ],
            },
        );
        expect ( workers [ 0 ]?.terminated ).toBe ( true );

        // Initialize the local values needed by this operation.

        const retryRequest = createJob ( "retry" );
        const retryPromise = port.solve ( retryRequest, () => undefined );

        workers [ 1 ]?.emit ( resultMessage ( retryRequest ) );
        await expect ( retryPromise ).resolves.toMatchObject ( { status: "success" } );
    } );

    it ( "preflights oversized requests without constructing a Worker", async () =>
    {
        // Initialize the local values needed by this operation.

        let constructionAttemptCount = 0;
        const port                   = new BrowserSolverWorkerPort ( () =>
        {
            constructionAttemptCount++;

            // Return the computed result.

            return new FakeSolverWorker ();
        } );
        const oversizedRequest: SolverJobRequest = {
            jobId: "oversized",
            documentRevision: 0,
            solverRevision: 0,
            observations: Array.from ( { length: MAXIMUM_SOLVER_SEQUENCE_COUNT + 1 }, ( _, index ) => ( {
                name: `sequence_${index}`,
                startContext: "infer",
                rawTokens: [],
            } ) ),
        };

        await expect ( port.solve ( oversizedRequest, () => undefined ) ).resolves.toMatchObject (
            {
                status: "failure",
                diagnostics:
                [
                    {
                        code: "SOLVER_FAILURE",
                        message: "The Solver request exceeds the bounded Solver Worker protocol.",
                    },
                ],
            },
        );
        expect ( constructionAttemptCount ).toBe ( 0 );
    } );

    it ( "forwards bounded progress and freezes the completed candidate", async () =>
    {
        // Initialize the local values needed by this operation.

        const worker                     = new FakeSolverWorker ();
        const port                       = new BrowserSolverWorkerPort ( () => worker );
        const progressMessages: string[] = [];
        const request                    = createJob ( "job-one" );
        const promise                    = port.solve ( request, progress => progressMessages.push ( progress.message ) );

        worker.emit (
            {
                protocolVersion: SOLVER_PROTOCOL_VERSION,
                kind: "progress",
                jobId: request.jobId,
                progress: { completedWork: 0, totalWork: 1, message: "Working" },
            },
        );
        worker.emit (
            {
                protocolVersion: SOLVER_PROTOCOL_VERSION,
                kind: "result",
                jobId: request.jobId,
                result: workerResult ( request ),
            },
        );

        const result = await promise;

        expect ( progressMessages ).toEqual ( [ "Working" ] );
        expect ( result.status ).toBe ( "success" );
        expect ( worker.terminated ).toBe ( true );

        // Handle the case where result status matches "success".

        if ( result.status === "success" )
        {
            expect ( Object.isFrozen ( result.candidate ) ).toBe ( true );
            expect ( Object.isFrozen ( result.candidate.stateMachine.states ) ).toBe ( true );
        }
    } );

    it ( "terminates cancellation and uses a fresh worker for retry", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: FakeSolverWorker[] = [];
        const port                        = new BrowserSolverWorkerPort ( () =>
        {
            // Initialize the local values needed by this operation.

            const worker = new FakeSolverWorker ();

            workers.push ( worker );

            // Return the worker.

            return worker;
        } );
        const firstRequest = createJob ( "first" );
        const firstPromise = port.solve ( firstRequest, () => undefined );

        await port.cancel ();

        // Initialize the local values needed by this operation.

        const cancelled     = await firstPromise;
        const secondRequest = createJob ( "second" );
        const secondPromise = port.solve ( secondRequest, () => undefined );
        const secondWorker  = workers [ 1 ];

        secondWorker?.emit (
            {
                protocolVersion: SOLVER_PROTOCOL_VERSION,
                kind: "result",
                jobId: secondRequest.jobId,
                result: workerResult ( secondRequest ),
            },
        );

        expect ( cancelled ).toMatchObject ( { status: "failure", diagnostics: [ { code: "SOLVER_CANCELLED" } ] } );
        expect ( workers ).toHaveLength ( 2 );
        expect ( workers [ 0 ]?.terminated ).toBe ( true );
        await expect ( secondPromise ).resolves.toMatchObject ( { status: "success" } );
    } );

    it ( "ignores a stale result from a terminated prior worker", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: FakeSolverWorker[] = [];
        const port                        = new BrowserSolverWorkerPort ( () =>
        {
            // Initialize the local values needed by this operation.

            const worker = new FakeSolverWorker ();

            workers.push ( worker );

            // Return the worker.

            return worker;
        } );
        const firstRequest  = createJob ( "first" );
        const firstPromise  = port.solve ( firstRequest, () => undefined );
        const secondRequest = createJob ( "second" );
        const secondPromise = port.solve ( secondRequest, () => undefined );

        workers [ 0 ]?.emit (
            {
                protocolVersion: SOLVER_PROTOCOL_VERSION,
                kind: "result",
                jobId: firstRequest.jobId,
                result: workerResult ( firstRequest ),
            },
        );
        workers [ 1 ]?.emit (
            {
                protocolVersion: SOLVER_PROTOCOL_VERSION,
                kind: "result",
                jobId: secondRequest.jobId,
                result: workerResult ( secondRequest ),
            },
        );

        await expect ( firstPromise ).resolves.toMatchObject ( { status: "failure" } );
        await expect ( secondPromise ).resolves.toMatchObject ( { status: "success" } );
    } );

    it ( "falls back to a stable diagnostic when the browser supplies no worker error message", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: FakeSolverWorker[] = [];
        const port                        = new BrowserSolverWorkerPort ( () =>
        {
            // Initialize the local values needed by this operation.

            const worker = new FakeSolverWorker ();

            workers.push ( worker );

            // Return the worker.

            return worker;
        } );
        const silentPromise = port.solve ( createJob ( "silent" ), () => undefined );

        workers [ 0 ]?.failWithoutMessage ();
        await expect ( silentPromise ).resolves.toMatchObject (
            {
                status: "failure",
                diagnostics: [ { code: "SOLVER_FAILURE", message: "The Solver Worker crashed." } ],
            },
        );
    } );

    it ( "returns a structured crash and succeeds through a fresh retry worker", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: FakeSolverWorker[] = [];
        const port                        = new BrowserSolverWorkerPort ( () =>
        {
            // Initialize the local values needed by this operation.

            const worker = new FakeSolverWorker ();

            workers.push ( worker );

            // Return the worker.

            return worker;
        } );
        const crashedRequest = createJob ( "crashed" );
        const crashedPromise = port.solve ( crashedRequest, () => undefined );

        workers [ 0 ]?.fail ( "Worker crashed for test." );
        await expect ( crashedPromise ).resolves.toMatchObject (
            { status: "failure", diagnostics: [ { code: "SOLVER_FAILURE", message: "Worker crashed for test." } ] },
        );

        // Initialize the local values needed by this operation.

        const retryRequest = createJob ( "retry" );
        const retryPromise = port.solve ( retryRequest, () => undefined );

        workers [ 1 ]?.emit (
            {
                protocolVersion: SOLVER_PROTOCOL_VERSION,
                kind: "result",
                jobId: retryRequest.jobId,
                result: workerResult ( retryRequest ),
            },
        );
        await expect ( retryPromise ).resolves.toMatchObject ( { status: "success" } );
        expect ( workers ).toHaveLength ( 2 );
    } );

    it ( "bounds a browser-supplied crash message before publishing it", async () =>
    {
        // Initialize the local values needed by this operation.

        const worker        = new FakeSolverWorker ();
        const port          = new BrowserSolverWorkerPort ( () => worker );
        const resultPromise = port.solve ( createJob ( "bounded-crash" ), () => undefined );

        worker.fail ( "x".repeat ( MAXIMUM_SOLVER_WORKER_TEXT_CODE_POINT_COUNT + 100 ) );

        const result = await resultPromise;

        expect ( result.status ).toBe ( "failure" );
        expect ( [ ...result.diagnostics [ 0 ]?.message ?? "" ] ).toHaveLength (
            MAXIMUM_SOLVER_WORKER_TEXT_CODE_POINT_COUNT,
        );
    } );
} );

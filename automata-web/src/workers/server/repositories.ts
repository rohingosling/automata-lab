// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Worker Repositories
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Owns the immutable hosted-model head and bounded revision-pinned runtime sessions used by the
//   emulated server.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { AutomataDocument } from "../../domain/model/contracts.js";
import type
{
    CompiledModel,
    RuntimeOperationResult,
    RuntimeSession,
} from "../../domain/runtime/contracts.js";
import
{
    resetRuntimeSession,
    runRuntimeSession,
    stepRuntimeSession,
} from "../../domain/runtime/runtime.js";

export const MAXIMUM_SERVER_SESSION_COUNT                = 64;
export const MAXIMUM_SESSION_TRACE_LENGTH                = 50_000;
export const MAXIMUM_RETAINED_REQUEST_IDENTIFIER_COUNT = 2_048;

//--------------------------------------------------------------------------------------------------
// Type: HostedModelRevision
//
// Description:
//
//   Defines the hosted model revision type.
//
//--------------------------------------------------------------------------------------------------

export type HostedModelRevision = `sha256:${string}`;

//--------------------------------------------------------------------------------------------------
// Class: RecentRequestIdentifierRepository
//
// Description:
//
//   Implements the recent request identifier repository behavior.
//
//--------------------------------------------------------------------------------------------------

export class RecentRequestIdentifierRepository
{
    private readonly identifiers  = new Set<string> ();
    private readonly insertionOrder: string[] = [];

    //----------------------------------------------------------------------------------------------
    // Method: remember
    //
    // Description:
    //
    //   Derives the remember.
    //
    // Parameters:
    //
    //   - requestIdentifier:
    //     The request identifier supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public remember ( requestIdentifier: string ): boolean
    {
        // Handle the case where has result is enabled.

        if ( this.identifiers.has ( requestIdentifier ) )
        {
            // Return the computed result.

            return false;
        }

        this.identifiers.add ( requestIdentifier );
        this.insertionOrder.push ( requestIdentifier );

        // Handle the case where length exceeds maximum retained request identifier count.

        if ( this.insertionOrder.length > MAXIMUM_RETAINED_REQUEST_IDENTIFIER_COUNT )
        {
            // Initialize the local values needed by this operation.

            const expiredIdentifier = this.insertionOrder.shift ();

            // Handle the case where expired identifier differs from undefined.

            if ( expiredIdentifier !== undefined )
            {
                this.identifiers.delete ( expiredIdentifier );
            }
        }

        // Return the computed result.

        return true;
    }
}

//--------------------------------------------------------------------------------------------------
// Interface: HostedModelSnapshot
//
// Description:
//
//   Defines the structure of hosted model snapshot.
//
//--------------------------------------------------------------------------------------------------

export interface HostedModelSnapshot
{
    readonly canonicalDocumentText: string;
    readonly compiledModel:         CompiledModel;
    readonly document:              AutomataDocument;
    readonly modelRevision:         HostedModelRevision;
}

//--------------------------------------------------------------------------------------------------
// Class: HostedModelRepository
//
// Description:
//
//   Implements the hosted model repository behavior.
//
//--------------------------------------------------------------------------------------------------

export class HostedModelRepository
{
    private hostedModel: HostedModelSnapshot | null = null;

    //----------------------------------------------------------------------------------------------
    // Method: get
    //
    // Description:
    //
    //   Returns the requested value.
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

    public get (): HostedModelSnapshot | null
    {
        // Return the computed result.

        return this.hostedModel;
    }

    //----------------------------------------------------------------------------------------------
    // Method: replace
    //
    // Description:
    //
    //   Replaces the requested value.
    //
    // Parameters:
    //
    //   - hostedModel:
    //     The hosted model supplied to the operation.
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

    public replace ( hostedModel: HostedModelSnapshot ): void
    {
        this.hostedModel = hostedModel;
    }
}

//--------------------------------------------------------------------------------------------------
// Interface: SimulationSessionRecord
//
// Description:
//
//   Defines the structure of simulation session record.
//
//--------------------------------------------------------------------------------------------------

export interface SimulationSessionRecord
{
    readonly sessionId:           string;
    readonly hostedModel:         HostedModelSnapshot;
    readonly processedEventCount: number;
    readonly runtimeSession:      RuntimeSession;
    readonly traceTruncated:      boolean;
}

//--------------------------------------------------------------------------------------------------
// Type: CreateSimulationSessionResult
//
// Description:
//
//   Describes the result produced by create simulation session.
//
//--------------------------------------------------------------------------------------------------

export type CreateSimulationSessionResult =
    | {
        readonly isSuccessful: true;
        readonly session:      SimulationSessionRecord;
    }
    | {
        readonly isSuccessful: false;
        readonly reason:       "SESSION_LIMIT_REACHED";
    };

//--------------------------------------------------------------------------------------------------
// Interface: BoundedRuntimeSession
//
// Description:
//
//   Defines the structure of bounded runtime session.
//
//--------------------------------------------------------------------------------------------------

interface BoundedRuntimeSession
{
    readonly runtimeSession: RuntimeSession;
    readonly wasTruncated:   boolean;
}

//--------------------------------------------------------------------------------------------------
// Function: capRuntimeSessionTraces
//
// Description:
//
//   Derives the cap runtime session traces.
//
// Parameters:
//
//   - runtimeSession:
//     The runtime session supplied to the operation.
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

function capRuntimeSessionTraces ( runtimeSession: RuntimeSession ): BoundedRuntimeSession
{
    // Return the assembled result.

    return {
        runtimeSession:
        {
            ...runtimeSession,
            transitionTrace: runtimeSession.transitionTrace.slice ( -MAXIMUM_SESSION_TRACE_LENGTH ),
            actionTrace:     runtimeSession.actionTrace.slice ( -MAXIMUM_SESSION_TRACE_LENGTH ),
        },
        wasTruncated: runtimeSession.transitionTrace.length > MAXIMUM_SESSION_TRACE_LENGTH ||
            runtimeSession.actionTrace.length > MAXIMUM_SESSION_TRACE_LENGTH,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: copyRuntimeSession
//
// Description:
//
//   Copies the runtime session.
//
// Parameters:
//
//   - runtimeSession:
//     The runtime session supplied to the operation.
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

function copyRuntimeSession ( runtimeSession: RuntimeSession ): RuntimeSession
{
    // Return the assembled result.

    return {
        ...runtimeSession,
        transitionTrace: runtimeSession.transitionTrace.map ( ( entry ) => ( { ...entry } ) ),
        actionTrace:     runtimeSession.actionTrace.map ( ( entry ) => ( { ...entry } ) ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: copySessionRecord
//
// Description:
//
//   Copies the session record.
//
// Parameters:
//
//   - session:
//     The session supplied to the operation.
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

function copySessionRecord ( session: SimulationSessionRecord ): SimulationSessionRecord
{
    // Return the assembled result.

    return {
        ...session,
        runtimeSession: copyRuntimeSession ( session.runtimeSession ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: copyOperationResult
//
// Description:
//
//   Copies the operation result.
//
// Parameters:
//
//   - result:
//     The result supplied to the operation.
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

function copyOperationResult ( result: RuntimeOperationResult ): RuntimeOperationResult
{
    // Return the assembled result.

    return {
        ...result,
        session:        copyRuntimeSession ( result.session ),
        emittedActions: [ ...result.emittedActions ],
        warnings:       result.warnings.map ( ( warning ) => ( { ...warning } ) ),
    };
}

//--------------------------------------------------------------------------------------------------
// Class: SimulationSessionRepository
//
// Description:
//
//   Implements the simulation session repository behavior.
//
//--------------------------------------------------------------------------------------------------

export class SimulationSessionRepository
{
    private readonly sessionsById = new Map<string, SimulationSessionRecord> ();

    //----------------------------------------------------------------------------------------------
    // Method: create
    //
    // Description:
    //
    //   Derives the create.
    //
    // Parameters:
    //
    //   - sessionId:
    //     The session identifier supplied to the operation.
    //
    //   - hostedModel:
    //     The hosted model supplied to the operation.
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

    public create ( sessionId: string, hostedModel: HostedModelSnapshot ): CreateSimulationSessionResult
    {
        // Handle the case where size is at least maximum server session count.

        if ( this.sessionsById.size >= MAXIMUM_SERVER_SESSION_COUNT )
        {
            // Return the assembled result.

            return { isSuccessful: false, reason: "SESSION_LIMIT_REACHED" };
        }

        const session: SimulationSessionRecord =
        {
            sessionId,
            hostedModel,
            processedEventCount: 0,
            runtimeSession:      resetRuntimeSession ( hostedModel.compiledModel ),
            traceTruncated:      false,
        };

        this.sessionsById.set ( sessionId, session );

        // Return the assembled result.

        return { isSuccessful: true, session: copySessionRecord ( session ) };
    }

    //----------------------------------------------------------------------------------------------
    // Method: get
    //
    // Description:
    //
    //   Returns the requested value.
    //
    // Parameters:
    //
    //   - sessionId:
    //     The session identifier supplied to the operation.
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

    public get ( sessionId: string ): SimulationSessionRecord | null
    {
        // Initialize the local values needed by this operation.

        const session = this.sessionsById.get ( sessionId );

        // Return the result selected by the current condition.

        return session === undefined ? null : copySessionRecord ( session );
    }

    //----------------------------------------------------------------------------------------------
    // Method: run
    //
    // Description:
    //
    //   Runs the requested value.
    //
    // Parameters:
    //
    //   - sessionId:
    //     The session identifier supplied to the operation.
    //
    //   - events:
    //     The events supplied to the operation.
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

    public run ( sessionId: string, events: readonly string[] ): RuntimeOperationResult | null
    {
        // Return the execute result.

        return this.execute ( sessionId, events, runRuntimeSession );
    }

    //----------------------------------------------------------------------------------------------
    // Method: step
    //
    // Description:
    //
    //   Advances the requested value.
    //
    // Parameters:
    //
    //   - sessionId:
    //     The session identifier supplied to the operation.
    //
    //   - events:
    //     The events supplied to the operation.
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

    public step ( sessionId: string, events: readonly string[] ): RuntimeOperationResult | null
    {
        // Return the execute result.

        return this.execute ( sessionId, events, stepRuntimeSession );
    }

    //----------------------------------------------------------------------------------------------
    // Method: reset
    //
    // Description:
    //
    //   Resets the requested value.
    //
    // Parameters:
    //
    //   - sessionId:
    //     The session identifier supplied to the operation.
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

    public reset ( sessionId: string ): SimulationSessionRecord | null
    {
        // Initialize the local values needed by this operation.

        const session = this.sessionsById.get ( sessionId );

        // Handle the case where session matches undefined.

        if ( session === undefined )
        {
            // Return the computed result.

            return null;
        }

        const resetSession: SimulationSessionRecord =
        {
            ...session,
            processedEventCount: 0,
            runtimeSession:      resetRuntimeSession ( session.hostedModel.compiledModel ),
            traceTruncated:      false,
        };

        this.sessionsById.set ( sessionId, resetSession );

        // Return the copy session record result.

        return copySessionRecord ( resetSession );
    }

    //----------------------------------------------------------------------------------------------
    // Method: close
    //
    // Description:
    //
    //   Closes the requested value.
    //
    // Parameters:
    //
    //   - sessionId:
    //     The session identifier supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public close ( sessionId: string ): boolean
    {
        // Return the delete result.

        return this.sessionsById.delete ( sessionId );
    }

    //----------------------------------------------------------------------------------------------
    // Method: execute
    //
    // Description:
    //
    //   Executes the requested value.
    //
    // Parameters:
    //
    //   - sessionId:
    //     The session identifier supplied to the operation.
    //
    //   - events:
    //     The events supplied to the operation.
    //
    //   - operation:
    //     The operation supplied to the operation.
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

    private execute (
        sessionId: string,
        events: readonly string[],
        operation: (
            model: CompiledModel,
            session: RuntimeSession,
            eventBuffer: readonly string[],
        ) => RuntimeOperationResult,
    ): RuntimeOperationResult | null
    {
        // Initialize the local values needed by this operation.

        const session = this.sessionsById.get ( sessionId );

        // Handle the case where session matches undefined.

        if ( session === undefined )
        {
            // Return the computed result.

            return null;
        }

        // Initialize the local values needed by this operation.

        const operationResult                       = operation ( session.hostedModel.compiledModel, session.runtimeSession, events );
        const boundedRuntimeSession                 = capRuntimeSessionTraces ( operationResult.session );
        const boundedResult: RuntimeOperationResult = 
        {
            ...operationResult,
            emittedActions: operationResult.emittedActions.slice ( -MAXIMUM_SESSION_TRACE_LENGTH ),
            session:        boundedRuntimeSession.runtimeSession,
            warnings:       operationResult.warnings.slice ( -MAXIMUM_SESSION_TRACE_LENGTH ),
        };

        this.sessionsById.set (
            sessionId,
            {
                ...session,
                processedEventCount: Math.min (
                    Number.MAX_SAFE_INTEGER,
                    session.processedEventCount + operationResult.consumedEventCount,
                ),
                runtimeSession: boundedResult.session,
                traceTruncated: session.traceTruncated || boundedRuntimeSession.wasTruncated ||
                    operationResult.emittedActions.length > MAXIMUM_SESSION_TRACE_LENGTH ||
                    operationResult.warnings.length > MAXIMUM_SESSION_TRACE_LENGTH,
            },
        );

        // Return the copy operation result result.

        return copyOperationResult ( boundedResult );
    }
}

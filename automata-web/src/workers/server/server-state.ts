// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Worker State
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Coordinates the hosted-model and session repositories without depending on transport envelope
//   details.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ContentHashPort,
    DocumentCodecPort,
    UuidPort,
} from "../../application/ports/contracts.js";
import type { DomainDiagnostic } from "../../domain/model/diagnostics.js";
import type
{
    RuntimeActionTraceEntry,
    RuntimeTransitionTraceEntry,
    RuntimeWarning,
} from "../../domain/runtime/contracts.js";
import { stageHostedModel } from "./hosting.js";
import type { HostedModelStagingResult } from "./hosting.js";
import
{
    HostedModelRepository,
    MAXIMUM_SERVER_SESSION_COUNT,
    SimulationSessionRepository,
} from "./repositories.js";
import type
{
    HostedModelSnapshot,
    SimulationSessionRecord,
} from "./repositories.js";

//--------------------------------------------------------------------------------------------------
// Type: ServerStateFailureCode
//
// Description:
//
//   Defines the supported server state failure code alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ServerStateFailureCode =
    | "DOCUMENT_TOO_LARGE"
    | "INTERNAL_ERROR"
    | "MODEL_INVALID"
    | "MODEL_REVISION_CONFLICT"
    | "SERVER_NOT_READY"
    | "SESSION_CAPACITY_EXCEEDED"
    | "SESSION_NOT_FOUND";

//--------------------------------------------------------------------------------------------------
// Interface: ServerStateFailure
//
// Description:
//
//   Defines the structure of server state failure.
//
//--------------------------------------------------------------------------------------------------

export interface ServerStateFailure
{
    readonly code:        ServerStateFailureCode;
    readonly diagnostics: readonly DomainDiagnostic[];
    readonly message:     string;
}

//--------------------------------------------------------------------------------------------------
// Type: ServerStateResult
//
// Description:
//
//   Describes the result produced by server state.
//
//--------------------------------------------------------------------------------------------------

export type ServerStateResult<Value> =
    | { readonly isSuccessful: true; readonly value: Value }
    | { readonly isSuccessful: false; readonly failure: ServerStateFailure };

//--------------------------------------------------------------------------------------------------
// Interface: ServerStateDependencies
//
// Description:
//
//   Defines the structure of server state dependencies.
//
//--------------------------------------------------------------------------------------------------

export interface ServerStateDependencies
{
    readonly contentHasher: ContentHashPort;
    readonly documentCodec: DocumentCodecPort;
    readonly uuid:          UuidPort;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerStateReadiness
//
// Description:
//
//   Defines the structure of server state readiness.
//
//--------------------------------------------------------------------------------------------------

export interface ServerStateReadiness
{
    readonly diagnostics:   readonly DomainDiagnostic[];
    readonly modelRevision: HostedModelSnapshot [ "modelRevision" ] | null;
    readonly ready:         boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerHostedDocument
//
// Description:
//
//   Defines the structure of server hosted document.
//
//--------------------------------------------------------------------------------------------------

export interface ServerHostedDocument
{
    readonly canonicalDocument: string;
    readonly modelRevision:     HostedModelSnapshot [ "modelRevision" ];
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerHostedReplacement
//
// Description:
//
//   Defines the structure of server hosted replacement.
//
//--------------------------------------------------------------------------------------------------

export interface ServerHostedReplacement
{
    readonly disposition:          "replaced" | "unchanged";
    readonly modelRevision:         HostedModelSnapshot [ "modelRevision" ];
    readonly previousModelRevision: HostedModelSnapshot [ "modelRevision" ];
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerSessionSnapshot
//
// Description:
//
//   Defines the structure of server session snapshot.
//
//--------------------------------------------------------------------------------------------------

export interface ServerSessionSnapshot
{
    readonly actionTrace:                readonly RuntimeActionTraceEntry[];
    readonly currentState:               string;
    readonly initialEntryActionsPending: boolean;
    readonly pinnedModelRevision:        HostedModelSnapshot [ "modelRevision" ];
    readonly processedEventCount:        number;
    readonly sessionId:                  string;
    readonly isStale:                    boolean;
    readonly traceTruncated:             boolean;
    readonly transitionTrace:            readonly RuntimeTransitionTraceEntry[];
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerSessionOperation
//
// Description:
//
//   Defines the structure of server session operation.
//
//--------------------------------------------------------------------------------------------------

export interface ServerSessionOperation
{
    readonly consumedEventCount: number;
    readonly emittedActions:     readonly string[];
    readonly session:            ServerSessionSnapshot;
    readonly warnings:           readonly ( RuntimeWarning & { readonly event: string } )[];
}

//--------------------------------------------------------------------------------------------------
// Function: createInternalDiagnostic
//
// Description:
//
//   Creates internal diagnostic.
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

function createInternalDiagnostic (): DomainDiagnostic
{
    // Return the assembled result.

    return {
        code:        "SERVER_INTERNAL_ERROR",
        severity:    "error",
        source:      "server",
        message:     "The Server Worker could not complete the operation.",
        remediation: "Restart the built-in server and try again.",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createFailure
//
// Description:
//
//   Creates failure.
//
// Parameters:
//
//   - code:
//     The code supplied to the operation.
//
//   - message:
//     The message supplied to the operation.
//
//   - diagnostics:
//     The diagnostics supplied to the operation.
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

function createFailure (
    code: ServerStateFailureCode,
    message: string,
    diagnostics: readonly DomainDiagnostic[] = [],
): ServerStateFailure
{
    // Return the assembled result.

    return {
        code,
        message,
        diagnostics: diagnostics.map ( ( diagnostic ) => ( { ...diagnostic } ) ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: cleanEvents
//
// Description:
//
//   Cleans the events.
//
// Parameters:
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
//--------------------------------------------------------------------------------------------------

function cleanEvents ( events: readonly string[] ): readonly string[]
{
    // Return the filtered collection.

    return events.map ( event => event.trim () ).filter ( event => event.length > 0 );
}

//--------------------------------------------------------------------------------------------------
// Class: ServerState
//
// Description:
//
//   Implements the server state behavior.
//
//--------------------------------------------------------------------------------------------------

export class ServerState
{
    private readonly hostedModels = new HostedModelRepository ();
    private readonly sessions     = new SimulationSessionRepository ();
    private startupDiagnostics: readonly DomainDiagnostic[] = [];

    //----------------------------------------------------------------------------------------------
    // Constructor: ServerState
    //
    // Description:
    //
    //   Initializes a ServerState instance.
    //
    // Parameters:
    //
    //   - dependencies:
    //     The services required by the operation.
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

    public constructor ( private readonly dependencies: ServerStateDependencies )
    {
    }

    //----------------------------------------------------------------------------------------------
    // Method: initialize
    //
    // Description:
    //
    //   Derives the initialize.
    //
    // Parameters:
    //
    //   - bundledDocumentText:
    //     The bundled document text supplied to the operation.
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

    public async initialize ( bundledDocumentText: string ): Promise<ServerStateReadiness>
    {
        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const stagingResult = await stageHostedModel ( bundledDocumentText, this.dependencies );

            // Handle the case where the staging result is successful condition is not satisfied.

            if ( !stagingResult.isSuccessful )
            {
                this.startupDiagnostics = stagingResult.diagnostics.map ( ( diagnostic ) => ( { ...diagnostic } ) );

                // Return the readiness result.

                return this.readiness ();
            }

            this.hostedModels.replace ( stagingResult.hostedModel );
            this.startupDiagnostics = [];

            // Return the readiness result.

            return this.readiness ();
        }
        catch
        {
            // Recover from the reported failure without hiding its outcome.

            this.startupDiagnostics = [ createInternalDiagnostic () ];

            // Return the readiness result.

            return this.readiness ();
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: readiness
    //
    // Description:
    //
    //   Derives the readiness.
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

    public readiness (): ServerStateReadiness
    {
        // Initialize the local values needed by this operation.

        const hostedModel = this.hostedModels.get ();

        // Return the assembled result.

        return {
            diagnostics:   this.startupDiagnostics.map ( ( diagnostic ) => ( { ...diagnostic } ) ),
            modelRevision: hostedModel?.modelRevision ?? null,
            ready:         hostedModel !== null,
        };
    }

    //----------------------------------------------------------------------------------------------
    // Method: getHostedDocument
    //
    // Description:
    //
    //   Returns hosted document.
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

    public getHostedDocument (): ServerStateResult<ServerHostedDocument>
    {
        // Initialize the local values needed by this operation.

        const hostedModelResult = this.requireHostedModel ();

        // Handle the case where the hosted model result is successful condition is not satisfied.

        if ( !hostedModelResult.isSuccessful )
        {
            // Return the hosted model result.

            return hostedModelResult;
        }

        // Return the assembled result.

        return {
            isSuccessful: true,
            value:
            {
                canonicalDocument: hostedModelResult.value.canonicalDocumentText,
                modelRevision:     hostedModelResult.value.modelRevision,
            },
        };
    }

    //----------------------------------------------------------------------------------------------
    // Method: replaceHostedDocument
    //
    // Description:
    //
    //   Replaces the hosted document.
    //
    // Parameters:
    //
    //   - canonicalDocument:
    //     The canonical document supplied to the operation.
    //
    //   - conditionalModelRevision:
    //     The conditional model revision supplied to the operation.
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

    public async replaceHostedDocument (
        canonicalDocument: string,
        conditionalModelRevision: string,
    ): Promise<ServerStateResult<ServerHostedReplacement>>
    {
        // Initialize the local values needed by this operation.

        const hostedModelResult = this.requireHostedModel ();

        // Handle the case where the hosted model result is successful condition is not satisfied.

        if ( !hostedModelResult.isSuccessful )
        {
            // Return the hosted model result.

            return hostedModelResult;
        }

        const previousHostedModel = hostedModelResult.value;

        // Handle the case where conditional model revision differs from previous hosted model model
        // revision.

        if ( conditionalModelRevision !== previousHostedModel.modelRevision )
        {
            // Return the assembled result.

            return {
                isSuccessful: false,
                failure: createFailure (
                    "MODEL_REVISION_CONFLICT",
                    "The hosted model changed after the client last synchronized.",
                ),
            };
        }

        let stagingResult: HostedModelStagingResult;

        // Run the operation that may report a recoverable failure.

        try
        {
            stagingResult = await stageHostedModel ( canonicalDocument, this.dependencies );
        }
        catch
        {
            // Recover from the reported failure without hiding its outcome.

            return {
                isSuccessful: false,
                failure: createFailure (
                    "INTERNAL_ERROR",
                    "The Server Worker could not stage the hosted document.",
                    [ createInternalDiagnostic () ],
                ),
            };
        }

        // Handle the case where the staging result is successful condition is not satisfied.

        if ( !stagingResult.isSuccessful )
        {
            // Return the assembled result.

            return {
                isSuccessful: false,
                failure: createFailure (
                    stagingResult.reason === "DOCUMENT_TOO_LARGE" ? "DOCUMENT_TOO_LARGE" : "MODEL_INVALID",
                    stagingResult.reason === "DOCUMENT_TOO_LARGE"
                        ? "The canonical document exceeds the hosted-document capacity and was not hosted."
                        : "The document is not a valid Automata Lab model and was not hosted.",
                    stagingResult.diagnostics,
                ),
            };
        }

        // Handle the case where canonical document text matches previous hosted model canonical
        // document text.

        if ( stagingResult.hostedModel.canonicalDocumentText === previousHostedModel.canonicalDocumentText )
        {
            // Return the assembled result.

            return {
                isSuccessful: true,
                value:
                {
                    disposition:          "unchanged",
                    modelRevision:         previousHostedModel.modelRevision,
                    previousModelRevision: previousHostedModel.modelRevision,
                },
            };
        }

        this.hostedModels.replace ( stagingResult.hostedModel );

        // Return the assembled result.

        return {
            isSuccessful: true,
            value:
            {
                disposition:          "replaced",
                modelRevision:         stagingResult.hostedModel.modelRevision,
                previousModelRevision: previousHostedModel.modelRevision,
            },
        };
    }

    //----------------------------------------------------------------------------------------------
    // Method: startSession
    //
    // Description:
    //
    //   Starts the session.
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

    public startSession (): ServerStateResult<ServerSessionSnapshot>
    {
        // Initialize the local values needed by this operation.

        const hostedModelResult = this.requireHostedModel ();

        // Handle the case where the hosted model result is successful condition is not satisfied.

        if ( !hostedModelResult.isSuccessful )
        {
            // Return the hosted model result.

            return hostedModelResult;
        }

        // Repeat the operation across the bounded iteration range.

        for ( let attempt = 0; attempt <= MAXIMUM_SERVER_SESSION_COUNT; attempt++ )
        {
            // Initialize the local values needed by this operation.

            const sessionId = this.dependencies.uuid.create ();

            // Handle the case where get result differs from an absent value.

            if ( this.sessions.get ( sessionId ) !== null )
            {
                continue;
            }

            const creationResult = this.sessions.create ( sessionId, hostedModelResult.value );

            // Handle the case where the creation result is successful condition is not satisfied.

            if ( !creationResult.isSuccessful )
            {
                // Return the assembled result.

                return {
                    isSuccessful: false,
                    failure: createFailure (
                        "SESSION_CAPACITY_EXCEEDED",
                        "The Server Worker already owns the maximum number of simulation sessions.",
                    ),
                };
            }

            // Return the assembled result.

            return {
                isSuccessful: true,
                value: this.projectSession ( creationResult.session ),
            };
        }

        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: createFailure (
                "INTERNAL_ERROR",
                "The Server Worker could not allocate a unique session identifier.",
                [ createInternalDiagnostic () ],
            ),
        };
    }

    //----------------------------------------------------------------------------------------------
    // Method: runSession
    //
    // Description:
    //
    //   Runs the session.
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

    public runSession ( sessionId: string, events: readonly string[] ): ServerStateResult<ServerSessionOperation>
    {
        // Return the execute session result.

        return this.executeSession ( sessionId, events, "run" );
    }

    //----------------------------------------------------------------------------------------------
    // Method: stepSession
    //
    // Description:
    //
    //   Advances the session.
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

    public stepSession ( sessionId: string, events: readonly string[] ): ServerStateResult<ServerSessionOperation>
    {
        // Return the execute session result.

        return this.executeSession ( sessionId, events, "step" );
    }

    //----------------------------------------------------------------------------------------------
    // Method: resetSession
    //
    // Description:
    //
    //   Resets the session.
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

    public resetSession ( sessionId: string ): ServerStateResult<ServerSessionSnapshot>
    {
        // Initialize the local values needed by this operation.

        const session = this.sessions.reset ( sessionId );

        // Handle the case where session matches an absent value.

        if ( session === null )
        {
            // Return the session not found result.

            return this.sessionNotFound ();
        }

        // Return the assembled result.

        return { isSuccessful: true, value: this.projectSession ( session ) };
    }

    //----------------------------------------------------------------------------------------------
    // Method: closeSession
    //
    // Description:
    //
    //   Closes the session.
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

    public closeSession ( sessionId: string ): ServerStateResult<{ readonly sessionId: string; readonly closed: true }>
    {
        // Handle the case where the close result condition is not satisfied.

        if ( !this.sessions.close ( sessionId ) )
        {
            // Return the session not found result.

            return this.sessionNotFound ();
        }

        // Return the assembled result.

        return { isSuccessful: true, value: { sessionId, closed: true } };
    }

    //----------------------------------------------------------------------------------------------
    // Method: requireHostedModel
    //
    // Description:
    //
    //   Validates and returns the hosted model.
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

    private requireHostedModel (): ServerStateResult<HostedModelSnapshot>
    {
        // Initialize the local values needed by this operation.

        const hostedModel = this.hostedModels.get ();

        // Handle the case where hosted model matches an absent value.

        if ( hostedModel === null )
        {
            // Return the assembled result.

            return {
                isSuccessful: false,
                failure: createFailure (
                    "SERVER_NOT_READY",
                    "The Server Worker is live but has no valid hosted model.",
                    this.startupDiagnostics,
                ),
            };
        }

        // Return the assembled result.

        return { isSuccessful: true, value: hostedModel };
    }

    //----------------------------------------------------------------------------------------------
    // Method: executeSession
    //
    // Description:
    //
    //   Executes the session.
    //
    // Parameters:
    //
    //   - sessionId:
    //     The session identifier supplied to the operation.
    //
    //   - events:
    //     The events supplied to the operation.
    //
    //   - mode:
    //     The mode supplied to the operation.
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

    private executeSession (
        sessionId: string,
        events: readonly string[],
        mode: "run" | "step",
    ): ServerStateResult<ServerSessionOperation>
    {
        // Initialize the local values needed by this operation.

        const operationResult = mode === "run"
            ? this.sessions.run ( sessionId, cleanEvents ( events ) )
            : this.sessions.step ( sessionId, cleanEvents ( events ) );

        // Handle the case where operation result matches an absent value.

        if ( operationResult === null )
        {
            // Return the session not found result.

            return this.sessionNotFound ();
        }

        const session = this.sessions.get ( sessionId );

        // Handle the case where session matches an absent value.

        if ( session === null )
        {
            // Return the session not found result.

            return this.sessionNotFound ();
        }

        // Return the assembled result.

        return {
            isSuccessful: true,
            value:
            {
                consumedEventCount: operationResult.consumedEventCount,
                emittedActions:     [ ...operationResult.emittedActions ],
                session:            this.projectSession ( session ),
                warnings: operationResult.warnings.map ( warning => ( {
                    ...warning,
                    event: warning.event ?? "",
                } ) ),
            },
        };
    }

    //----------------------------------------------------------------------------------------------
    // Method: projectSession
    //
    // Description:
    //
    //   Projects the session.
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
    //----------------------------------------------------------------------------------------------

    private projectSession ( session: SimulationSessionRecord ): ServerSessionSnapshot
    {
        // Initialize the local values needed by this operation.

        const currentModelRevision = this.hostedModels.get ()?.modelRevision ?? null;

        // Return the assembled result.

        return {
            actionTrace: session.runtimeSession.actionTrace.map ( ( entry ) => ( { ...entry } ) ),
            currentState: session.runtimeSession.currentState,
            initialEntryActionsPending: session.runtimeSession.initialEntryActionsPending,
            pinnedModelRevision: session.hostedModel.modelRevision,
            processedEventCount: session.processedEventCount,
            sessionId: session.sessionId,
            isStale: currentModelRevision !== session.hostedModel.modelRevision,
            traceTruncated: session.traceTruncated,
            transitionTrace: session.runtimeSession.transitionTrace.map ( ( entry ) => ( { ...entry } ) ),
        };
    }

    //----------------------------------------------------------------------------------------------
    // Method: sessionNotFound
    //
    // Description:
    //
    //   Derives the session not found.
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

    private sessionNotFound<Value> (): ServerStateResult<Value>
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: createFailure ( "SESSION_NOT_FOUND", "The requested simulation session does not exist." ),
        };
    }
}

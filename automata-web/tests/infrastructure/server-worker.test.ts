// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Server Worker Gateway Tests
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies worker lifecycle, request correlation, response validation, and non-idempotent timeout
//   reconciliation.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import type { ServerGatewayFailure } from "../../src/application/server-contracts.js";
import
{
    BrowserServerWorkerGateway,
} from "../../src/infrastructure/server/browser-server-worker-gateway.js";
import type
{
    BrowserServerWorkerEndpoint,
} from "../../src/infrastructure/server/browser-server-worker-gateway.js";
import
{
    createServerErrorResponseEnvelope,
    createServerSuccessResponseEnvelope,
    decodeServerRequestEnvelope,
    SERVER_PROTOCOL_LIMITS,
    SERVER_PROTOCOL_OPERATIONS,
    SERVER_PROTOCOL_VERSION,
} from "../../src/workers/server/protocol.js";
import type
{
    ServerModelRevision,
    ServerRequestEnvelope,
    ServerSessionSnapshot,
} from "../../src/workers/server/protocol.js";

const INSTANCE_IDENTIFIER                    = "00000000-0000-4000-8000-000000000001";
const SESSION_IDENTIFIER                     = "00000000-0000-4000-8000-000000000002";
const INITIAL_REVISION: ServerModelRevision  = `sha256:${"a".repeat ( 64 )}`;
const REPLACED_REVISION: ServerModelRevision = `sha256:${"b".repeat ( 64 )}`;
const TIMESTAMP                              = "2026-08-14T10:00:00.000Z";

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
    public readonly filename = "server.worker.ts";
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
// Class: ScriptedServerWorker
//
// Description:
//
//   Implements the scripted server worker behavior.
//
//--------------------------------------------------------------------------------------------------

class ScriptedServerWorker implements BrowserServerWorkerEndpoint
{
    public onerror: ( ( event: ErrorEvent ) => void ) | null = null;
    public onmessage: ( ( event: MessageEvent<unknown> ) => void ) | null = null;
    public onmessageerror: ( ( event: MessageEvent<unknown> ) => void ) | null = null;
    public autoRespond = true;
    public canonicalDocument = "{\"hosted\":true}\n";
    public ignoreNextModelPutResponse = false;
    public modelRevision = INITIAL_REVISION;
    public readonly requests: ServerRequestEnvelope[] = [];
    public terminated = false;
    private serverSequence = 0;

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

    public postMessage ( message: unknown ): void
    {
        // Initialize the local values needed by this operation.

        const decodeResult = decodeServerRequestEnvelope ( message );

        // Handle the case where the decode result is successful condition is not satisfied.

        if ( !decodeResult.isSuccessful )
        {
            throw new Error ( decodeResult.error.message );
        }

        this.requests.push ( decodeResult.request );

        // Handle the case where auto respond is enabled.

        if ( this.autoRespond )
        {
            this.respond ( decodeResult.request );
        }
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

    //----------------------------------------------------------------------------------------------
    // Method: respond
    //
    // Description:
    //
    //   Handles the respond behavior.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
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

    public respond ( request: ServerRequestEnvelope ): void
    {
        this.serverSequence++;

        // Dispatch according to the request operation value.

        switch ( request.operation )
        {
            // Handle the "server.hello" case.

            case "server.hello":
                this.emit ( createServerSuccessResponseEnvelope (
                    {
                        operation: request.operation,
                        requestId: request.requestId,
                        result:
                        {
                            capabilities: [ ...SERVER_PROTOCOL_OPERATIONS ],
                            instanceId: INSTANCE_IDENTIFIER,
                            limits: SERVER_PROTOCOL_LIMITS,
                            modelRevision: this.modelRevision,
                            protocol: SERVER_PROTOCOL_VERSION,
                            ready: true,
                        },
                        serverSequence: this.serverSequence,
                        timestampUtc: TIMESTAMP,
                    },
                ) );

                // Return control to the caller.

                return;

            // Handle the "health.live" case.

            case "health.live":
                this.emit ( createServerSuccessResponseEnvelope (
                    {
                        operation: request.operation,
                        requestId: request.requestId,
                        result: { instanceId: INSTANCE_IDENTIFIER, live: true },
                        serverSequence: this.serverSequence,
                        timestampUtc: TIMESTAMP,
                    },
                ) );

                // Return control to the caller.

                return;

            // Handle the "health.ready" case.

            case "health.ready":
                this.emit ( createServerSuccessResponseEnvelope (
                    {
                        operation: request.operation,
                        requestId: request.requestId,
                        result: { diagnostics: [], modelRevision: this.modelRevision, ready: true },
                        serverSequence: this.serverSequence,
                        timestampUtc: TIMESTAMP,
                    },
                ) );

                // Return control to the caller.

                return;

            // Handle the "model.get" case.

            case "model.get":
                this.emit ( createServerSuccessResponseEnvelope (
                    {
                        operation: request.operation,
                        requestId: request.requestId,
                        result:
                        {
                            canonicalDocument: this.canonicalDocument,
                            modelRevision: this.modelRevision,
                        },
                        serverSequence: this.serverSequence,
                        timestampUtc: TIMESTAMP,
                    },
                ) );

                // Return control to the caller.

                return;

            // Handle the "model.put" case.

            case "model.put":

                // Handle the case where request conditional model revision differs from model
                // revision.

                if ( request.conditionalModelRevision !== this.modelRevision )
                {
                    this.emit ( createServerErrorResponseEnvelope (
                        {
                            error:
                            {
                                code: "MODEL_REVISION_CONFLICT",
                                diagnostics: [],
                                message: "The hosted model has changed.",
                            },
                            operation: request.operation,
                            requestId: request.requestId,
                            serverSequence: this.serverSequence,
                            timestampUtc: TIMESTAMP,
                        },
                    ) );

                    // Return control to the caller.

                    return;
                }

                this.canonicalDocument = request.payload.canonicalDocument;
                this.modelRevision     = REPLACED_REVISION;

                // Handle the case where ignore next model put response is enabled.

                if ( this.ignoreNextModelPutResponse )
                {
                    this.ignoreNextModelPutResponse = false;
                    this.serverSequence--;

                    // Return control to the caller.

                    return;
                }

                this.emit ( createServerSuccessResponseEnvelope (
                    {
                        operation: request.operation,
                        requestId: request.requestId,
                        result: { disposition: "replaced", modelRevision: this.modelRevision },
                        serverSequence: this.serverSequence,
                        timestampUtc: TIMESTAMP,
                    },
                ) );

                // Return control to the caller.

                return;

            // Handle the group of case values that share the following outcome.

            case "simulation.start":
            case "simulation.reset":
                this.emit ( createServerSuccessResponseEnvelope (
                    {
                        operation: request.operation,
                        requestId: request.requestId,
                        result: this.sessionSnapshot (),
                        serverSequence: this.serverSequence,
                        timestampUtc: TIMESTAMP,
                    },
                ) );

                // Return control to the caller.

                return;

            // Handle the group of case values that share the following outcome.

            case "simulation.run":
            case "simulation.step":
                this.emit ( createServerSuccessResponseEnvelope (
                    {
                        operation: request.operation,
                        requestId: request.requestId,
                        result:
                        {
                            consumedEventCount: request.operation === "simulation.step"
                                ? Math.min ( 1, request.payload.events.length )
                                : request.payload.events.length,
                            emittedActions: [],
                            session: this.sessionSnapshot (),
                            warnings: [],
                        },
                        serverSequence: this.serverSequence,
                        timestampUtc: TIMESTAMP,
                    },
                ) );

                // Return control to the caller.

                return;

            // Handle the "simulation.close" case.

            case "simulation.close":
                this.emit ( createServerSuccessResponseEnvelope (
                    {
                        operation: request.operation,
                        requestId: request.requestId,
                        result: { closed: true, sessionId: request.sessionId },
                        serverSequence: this.serverSequence,
                        timestampUtc: TIMESTAMP,
                    },
                ) );

                // Return control to the caller.

                return;
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: emitWithSequence
    //
    // Description:
    //
    //   Emits the with sequence.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
    //
    //   - serverSequence:
    //     The server sequence supplied to the operation.
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

    public emitWithSequence ( request: ServerRequestEnvelope, serverSequence: number ): void
    {
        // Handle the case where request operation differs from "model.get".

        if ( request.operation !== "model.get" )
        {
            throw new Error ( "The sequence helper expects model.get." );
        }

        this.emit ( createServerSuccessResponseEnvelope (
            {
                operation: request.operation,
                requestId: request.requestId,
                result:
                {
                    canonicalDocument: this.canonicalDocument,
                    modelRevision: this.modelRevision,
                },
                serverSequence,
                timestampUtc: TIMESTAMP,
            },
        ) );
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

    private emit ( data: unknown ): void
    {
        this.onmessage?.( new MessageEvent ( "message", { data } ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: sessionSnapshot
    //
    // Description:
    //
    //   Derives the session snapshot.
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

    private sessionSnapshot (): ServerSessionSnapshot
    {
        // Return the assembled result.

        return {
            actionTrace: [],
            currentState: "state_start",
            initialEntryActionsPending: true,
            isStale: false,
            pinnedModelRevision: this.modelRevision,
            processedEventCount: 0,
            sessionId: SESSION_IDENTIFIER,
            traceTruncated: false,
            transitionTrace: [],
        };
    }
}

//--------------------------------------------------------------------------------------------------
// Function: sequentialRequestIdentifiers
//
// Description:
//
//   Derives the sequential request identifiers.
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

function sequentialRequestIdentifiers ()
{
    // Initialize the local values needed by this operation.

    let sequence = 10;

    // Return the computed result.

    return () =>
    {
        // Initialize the local values needed by this operation.

        const suffix = sequence.toString ( 16 ).padStart ( 12, "0" );

        sequence++;

        // Return the computed result.

        return `00000000-0000-4000-8000-${suffix}`;
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createGateway
//
// Description:
//
//   Creates gateway for the test scenario.
//
// Parameters:
//
//   - worker:
//     The worker supplied to the operation.
//
//   - requestTimeoutMilliseconds:
//     The request timeout milliseconds supplied to the operation.
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

function createGateway ( worker: ScriptedServerWorker, requestTimeoutMilliseconds = 100 )
{
    // Return the computed result.

    return new BrowserServerWorkerGateway (
        {
            createRequestIdentifier: sequentialRequestIdentifiers (),
            createWorker: () => worker,
            requestTimeoutMilliseconds,
        },
    );
}

describe ( "browser Server Worker gateway", () =>
{
    it ( "fails visibly when Web Workers are unavailable and never creates a main-thread server", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new BrowserServerWorkerGateway ();
        const result  = await gateway.connect ( "builtin://server" );

        expect ( result ).toMatchObject (
            { isSuccessful: false, failure: { code: "SERVER_WORKER_UNSUPPORTED" } },
        );
    } );

    it ( "rejects unsupported external URLs without creating a worker", async () =>
    {
        // Initialize the local values needed by this operation.

        let creationCount = 0;
        const gateway     = new BrowserServerWorkerGateway (
            {
                createWorker: () =>
                {
                    creationCount++;

                    // Return the computed result.

                    return new ScriptedServerWorker ();
                },
            },
        );
        const result = await gateway.connect ( "https://example.invalid/api" );

        expect ( result ).toMatchObject (
            { isSuccessful: false, failure: { code: "SERVER_CONNECTION_FAILED" } },
        );
        expect ( creationCount ).toBe ( 0 );
    } );

    it ( "disconnects and reconnects without terminating or replacing the worker-owned state", async () =>
    {
        // Initialize the local values needed by this operation.

        const worker  = new ScriptedServerWorker ();
        const gateway = createGateway ( worker );

        await expect ( gateway.connect ( "builtin://server" ) ).resolves.toMatchObject (
            { isSuccessful: true, value: { instanceId: INSTANCE_IDENTIFIER, isReady: true } },
        );
        await gateway.disconnect ();

        expect ( worker.terminated ).toBe ( false );
        await expect ( gateway.connect ( "builtin://server" ) ).resolves.toMatchObject (
            { isSuccessful: true, value: { instanceId: INSTANCE_IDENTIFIER } },
        );
        expect ( worker.terminated ).toBe ( false );
    } );

    it ( "correlates concurrent responses even when they arrive in the opposite request order", async () =>
    {
        // Initialize the local values needed by this operation.

        const worker  = new ScriptedServerWorker ();
        const gateway = createGateway ( worker );

        await gateway.connect ( "builtin://server" );
        worker.autoRespond = false;

        // Initialize the local values needed by this operation.

        const documentPromise = gateway.getHostedDocument ();
        const sessionPromise  = gateway.startSession ();
        const documentRequest = worker.requests.at ( -2 );
        const sessionRequest  = worker.requests.at ( -1 );

        // Handle the case where at least one branch condition is satisfied.

        if ( documentRequest === undefined || sessionRequest === undefined )
        {
            throw new Error ( "Expected two pending worker requests." );
        }

        worker.respond ( sessionRequest );
        worker.respond ( documentRequest );

        await expect ( documentPromise ).resolves.toMatchObject (
            { isSuccessful: true, value: { modelRevision: INITIAL_REVISION } },
        );
        await expect ( sessionPromise ).resolves.toMatchObject (
            { isSuccessful: true, value: { sessionId: SESSION_IDENTIFIER } },
        );
    } );

    it ( "reconciles a timed-out model replacement without blindly posting it twice", async () =>
    {
        // Initialize the local values needed by this operation.

        const worker          = new ScriptedServerWorker ();
        const gateway         = createGateway ( worker, 5 );
        const replacementText = "{\"replacement\":true}\n";

        await gateway.connect ( "builtin://server" );
        worker.ignoreNextModelPutResponse = true;

        const result = await gateway.putHostedDocument (
            {
                canonicalDocument: { text: replacementText },
                expectedModelRevision: INITIAL_REVISION,
            },
        );

        expect ( result ).toMatchObject (
            { isSuccessful: true, value: { modelRevision: REPLACED_REVISION } },
        );
        expect ( worker.requests.filter ( request => request.operation === "model.put" ) ).toHaveLength ( 1 );
        expect ( worker.requests.at ( -1 )?.operation ).toBe ( "model.get" );
    } );

    it ( "rejects pending work on crash and creates a fresh worker on restart", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: ScriptedServerWorker[]            = [];
        const connectionFailures: ServerGatewayFailure[] = [];
        const gateway                                    = new BrowserServerWorkerGateway (
            {
                createRequestIdentifier: sequentialRequestIdentifiers (),
                createWorker: () =>
                {
                    // Initialize the local values needed by this operation.

                    const worker = new ScriptedServerWorker ();

                    workers.push ( worker );

                    // Return the worker.

                    return worker;
                },
                onConnectionLost: failure => connectionFailures.push ( failure ),
                requestTimeoutMilliseconds: 100,
            },
        );

        await gateway.connect ( "builtin://server" );

        const firstWorker = workers [ 0 ];

        // Handle the case where first worker matches undefined.

        if ( firstWorker === undefined )
        {
            throw new Error ( "Expected the initial worker." );
        }

        firstWorker.autoRespond = false;
        const pendingDocument = gateway.getHostedDocument ();

        firstWorker.fail ( "Expected test crash." );

        await expect ( pendingDocument ).resolves.toMatchObject (
            { isSuccessful: false, failure: { code: "SERVER_WORKER_FAILED" } },
        );
        expect ( connectionFailures ).toHaveLength ( 1 );
        expect ( connectionFailures [ 0 ] ).toMatchObject ( { code: "SERVER_WORKER_FAILED" } );
        expect ( firstWorker.terminated ).toBe ( true );
        await expect ( gateway.restart () ).resolves.toMatchObject (
            { isSuccessful: true, value: { instanceId: INSTANCE_IDENTIFIER } },
        );
        expect ( workers ).toHaveLength ( 2 );
    } );

    it ( "reports the browser's worker error message and falls back when none is supplied", async () =>
    {
        // Initialize the local values needed by this operation.

        const reportingWorker  = new ScriptedServerWorker ();
        const reportingGateway = createGateway ( reportingWorker );

        await reportingGateway.connect ( "builtin://server" );
        reportingWorker.autoRespond = false;

        const reportedRequest = reportingGateway.getHostedDocument ();

        reportingWorker.fail ( "Unexpected token '<'" );
        await expect ( reportedRequest ).resolves.toMatchObject (
            {
                isSuccessful: false,
                failure: { code: "SERVER_WORKER_FAILED", message: "Unexpected token '<'" },
            },
        );

        // Initialize the local values needed by this operation.

        const silentWorker  = new ScriptedServerWorker ();
        const silentGateway = createGateway ( silentWorker );

        await silentGateway.connect ( "builtin://server" );
        silentWorker.autoRespond = false;

        const silentRequest = silentGateway.getHostedDocument ();

        silentWorker.failWithoutMessage ();
        await expect ( silentRequest ).resolves.toMatchObject (
            {
                isSuccessful: false,
                failure: { code: "SERVER_WORKER_FAILED", message: "The built-in server worker crashed." },
            },
        );
    } );

    it ( "fails closed when a response sequence is stale", async () =>
    {
        // Initialize the local values needed by this operation.

        const worker  = new ScriptedServerWorker ();
        const gateway = createGateway ( worker );

        await gateway.connect ( "builtin://server" );
        worker.autoRespond = false;

        // Initialize the local values needed by this operation.

        const documentPromise = gateway.getHostedDocument ();
        const request         = worker.requests.at ( -1 );

        // Handle the case where request matches undefined.

        if ( request === undefined )
        {
            throw new Error ( "Expected a pending model.get request." );
        }

        worker.emitWithSequence ( request, 1 );

        await expect ( documentPromise ).resolves.toMatchObject (
            { isSuccessful: false, failure: { code: "SERVER_RESPONSE_INVALID" } },
        );
        expect ( worker.terminated ).toBe ( true );
    } );
} );

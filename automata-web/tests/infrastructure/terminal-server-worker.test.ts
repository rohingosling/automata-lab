// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Terminal Server Integration Tests
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Exercises the real engine, protocol codec, gateway and application boundary together.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";
import { BrowserServerWorkerGateway } from "../../src/infrastructure/server/browser-server-worker-gateway.js";
import type { BrowserServerWorkerEndpoint } from "../../src/infrastructure/server/browser-server-worker-gateway.js";
import { AutomataDocumentCodec } from "../../src/infrastructure/files/file-codec.js";
import { Sha256ContentHasher } from "../../src/infrastructure/hashing/sha256-content-hasher.js";
import { serializeCanonicalDocument } from "../../src/domain/model/canonicalization.js";
import { ServerEngine } from "../../src/workers/server/server-engine.js";
import { SERVER_PROTOCOL_VERSION } from "../../src/workers/server/protocol.js";
import type { ServerOutboundEnvelope } from "../../src/workers/server/protocol.js";
import type { ServerGatewayResult } from "../../src/application/server-contracts.js";
import { terminalDocument } from "../runtime/terminal-state-fixture.js";

function requireSuccess<Value> ( result: ServerGatewayResult<Value> ): Value
{
    if ( !result.isSuccessful )
    {
        throw new Error ( JSON.stringify ( result.failure ) );
    }
    return result.value;
}

function identifiers (): () => string
{
    let identifier = 0;
    return () => `00000000-0000-4000-8000-${( ++identifier ).toString ( 16 ).padStart ( 12, "0" )}`;
}

class EngineEndpoint implements BrowserServerWorkerEndpoint
{
    public onerror: BrowserServerWorkerEndpoint [ "onerror" ] = null;
    public onmessage: BrowserServerWorkerEndpoint [ "onmessage" ] = null;
    public onmessageerror: BrowserServerWorkerEndpoint [ "onmessageerror" ] = null;
    public transform: ( message: ServerOutboundEnvelope ) => unknown = message => message;
    public readonly engine: ServerEngine;
    public readonly requests: unknown[] = [];

    public constructor ( initialTerminal = false )
    {
        this.engine = new ServerEngine ( {
            bundledDocumentText: serializeCanonicalDocument ( terminalDocument ( initialTerminal ) ).text,
            clock: { nowUtc: () => "2026-09-16T00:00:00.000Z" },
            contentHasher: new Sha256ContentHasher (),
            documentCodec: new AutomataDocumentCodec (),
            uuid: { create: identifiers () },
        } );
    }

    public postMessage ( request: unknown ): void
    {
        this.requests.push ( request );
        void this.engine.handle ( request ).then ( messages =>
        {
            for ( const message of messages )
            {
                this.onmessage?.( new MessageEvent ( "message", { data: this.transform ( message ) } ) );
            }
        } );
    }

    public terminate (): void {}
}

function createGateway ( endpoint: EngineEndpoint ): BrowserServerWorkerGateway
{
    return new BrowserServerWorkerGateway ( {
        createWorker: () => endpoint,
        createRequestIdentifier: identifiers (),
        requestTimeoutMilliseconds: 2_000,
    } );
}

describe ( "terminal server integration", () =>
{
    it ( "stops batches, rejects later advancement, preserves pinned policy and resets stale models", async () =>
    {
        const endpoint = new EngineEndpoint ();
        const gateway  = createGateway ( endpoint );
        requireSuccess ( await gateway.connect ( "builtin://server" ) );
        const started = requireSuccess ( await gateway.startSession ( { enableTerminalStates: true } ) );
        const result = requireSuccess ( await gateway.runSession (
            { sessionId: started.sessionId, eventBuffer: [ "unknown", "go", "back" ] },
        ) );
        expect ( result.consumedEventCount ).toBe ( 2 );
        expect ( result.session.processedEventCount ).toBe ( 2 );
        expect ( result.emittedActions ).toEqual ( [ "initial", "leave", "arrive", "arrive" ] );
        expect ( result.session.executionStatus ).toEqual (
            { kind: "terminated", reason: "terminal_state", state: "done" },
        );
        for ( const operation of [ gateway.runSession.bind ( gateway ), gateway.stepSession.bind ( gateway ) ] )
        {
            expect ( await operation ( { sessionId: started.sessionId, eventBuffer: [ "back" ] } ) )
                .toMatchObject ( { isSuccessful: false, failure: { code: "SESSION_TERMINATED", isRetryable: false } } );
        }
        const hosted = requireSuccess ( await gateway.getHostedDocument () );
        const replacement = terminalDocument ( true );
        requireSuccess ( await gateway.putHostedDocument ( {
            canonicalDocument: serializeCanonicalDocument ( replacement ), expectedModelRevision: hosted.modelRevision,
        } ) );
        const reset = requireSuccess ( await gateway.resetSession ( started.sessionId, { enableTerminalStates: false } ) );
        expect ( reset ).toMatchObject ( {
            isStale: true, modelRevision: started.modelRevision, initialEntryActionsPending: true,
            processedEventCount: 0, executionPolicy: { enableTerminalStates: false },
            executionStatus: { kind: "active" }, actionTrace: [], transitionTrace: [], traceTruncated: false,
        } );
        const resumed = requireSuccess ( await gateway.runSession (
            { sessionId: started.sessionId, eventBuffer: [ "go", "loop", "back" ] },
        ) );
        expect ( resumed.consumedEventCount ).toBe ( 3 );
        expect ( resumed.session.currentState ).toBe ( "idle" );
        requireSuccess ( await gateway.closeSession ( started.sessionId ) );
        await gateway.dispose ();
    } );

    it ( "initializes with zero events and ignores later caller policy mutation", async () =>
    {
        const gateway = createGateway ( new EngineEndpoint ( true ) );
        requireSuccess ( await gateway.connect ( "builtin://server" ) );
        const policy = { enableTerminalStates: true };
        const pending = gateway.startSession ( policy );
        policy.enableTerminalStates = false;
        const session = requireSuccess ( await pending );
        const result = requireSuccess ( await gateway.stepSession ( { sessionId: session.sessionId, eventBuffer: [] } ) );
        expect ( result ).toMatchObject ( {
            consumedEventCount: 0, emittedActions: [ "initial" ], warnings: [],
            session: { processedEventCount: 0, transitionTrace: [], executionStatus: { kind: "terminated" } },
        } );
        await gateway.dispose ();
    } );

    it.each ( [ "policy", "count", "total", "session", "revision", "zero", "initial_pending" ] ) (
        "rejects inconsistent correlated advancement (%s)", async corruption =>
        {
            const endpoint = new EngineEndpoint ();
            const gateway  = createGateway ( endpoint );
            requireSuccess ( await gateway.connect ( "builtin://server" ) );
            const session = requireSuccess ( await gateway.startSession ( { enableTerminalStates: true } ) );
            endpoint.transform = message =>
            {
                if ( message.kind !== "success" || message.operation !== "simulation.run" )
                {
                    return message;
                }
                const result = message.result;
                const snapshot = result.session;
                return { ...message, result: { ...result,
                    ...( corruption === "count" ? { consumedEventCount: 3 } : {} ),
                    ...( corruption === "zero" ? { consumedEventCount: 0 } : {} ),
                    session: { ...snapshot,
                        ...( corruption === "policy" ? { executionPolicy: { enableTerminalStates: false },
                            executionStatus: { kind: "active" } } : {} ),
                        ...( corruption === "total" ? { processedEventCount: 99 } : {} ),
                        ...( corruption === "session" ? { sessionId: "90000000-0000-4000-8000-000000000001" } : {} ),
                        ...( corruption === "revision" ? { pinnedModelRevision: `sha256:${"f".repeat ( 64 )}` } : {} ),
                        ...( corruption === "initial_pending" ? { initialEntryActionsPending: true } : {} ),
                    },
                } };
            };
            expect ( await gateway.runSession ( { sessionId: session.sessionId, eventBuffer: [ "go", "back" ] } ) )
                .toMatchObject ( { isSuccessful: false } );
            await gateway.dispose ();
        },
    );

    it ( "rejects a start policy echo mismatch", async () =>
    {
        const endpoint = new EngineEndpoint ();
        const gateway  = createGateway ( endpoint );
        requireSuccess ( await gateway.connect ( "builtin://server" ) );
        endpoint.transform = message => message.kind === "success" && message.operation === "simulation.start"
            ? { ...message, result: { ...message.result, executionPolicy: { enableTerminalStates: false } } } : message;
        expect ( await gateway.startSession ( { enableTerminalStates: true } ) ).toMatchObject (
            { isSuccessful: false, failure: { code: "SERVER_RESPONSE_INVALID" } },
        );
        await gateway.dispose ();
    } );

    it ( "requires /2 and refuses omitted or malformed start/reset policies", async () =>
    {
        const endpoint = new EngineEndpoint ();
        const nextIdentifier = identifiers ();
        await endpoint.engine.start ();
        for ( const operation of [ "simulation.start", "simulation.reset" ] )
        {
            for ( const payload of [ {}, { enableTerminalStates: "true" },
                { enableTerminalStates: null }, { enableTerminalStates: true, extra: false } ] )
            {
                const messages = await endpoint.engine.handle ( {
                    protocol: SERVER_PROTOCOL_VERSION, kind: "request", requestId: nextIdentifier (), operation,
                    conditionalModelRevision: null, sessionId: operation === "simulation.reset" ? nextIdentifier () : null,
                    payload,
                } );
                expect ( messages.at ( -1 ) ).toMatchObject ( { kind: "error", error: { code: "PAYLOAD_INVALID" } } );
            }
        }
        const messages = await endpoint.engine.handle ( {
            protocol: "automata-lab-server/1", kind: "request", requestId: nextIdentifier (),
            operation: "server.hello", conditionalModelRevision: null, sessionId: null, payload: {},
        } );
        expect ( messages.at ( -1 ) ).toMatchObject ( { kind: "error", error: { code: "PROTOCOL_UNSUPPORTED" } } );
    } );
} );

it ( "preserves existing whitespace-event normalization in /2 accounting", async () =>
{
    const gateway = createGateway ( new EngineEndpoint () );
    requireSuccess ( await gateway.connect ( "builtin://server" ) );
    const session = requireSuccess ( await gateway.startSession ( { enableTerminalStates: false } ) );
    const result = requireSuccess ( await gateway.runSession ( {
        sessionId: session.sessionId, eventBuffer: [ "  ", " go ", "", " back " ],
    } ) );
    expect ( result.consumedEventCount ).toBe ( 2 );
    expect ( result.session.currentState ).toBe ( "idle" );
    await gateway.dispose ();
} );

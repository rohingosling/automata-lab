// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Application Simulator Shell Tests
// Version: 1.0.0
// Date:    2026-08-17
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the integrated Simulator workflow through the shell: session lifecycle, buffered Run
//   and Step, initialization semantics, warnings, Reset, continuation, staleness reported to the
//   Console, sequence persistence, and CSV availability.
//
//   The gateway is doubled at the transport boundary only. It executes the same pure runtime
//   functions the server worker uses, so these tests exercise real execution semantics rather than
//   a hand-written imitation of them.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash, webcrypto } from "node:crypto";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Application } from "../../src/Application.js";
import type
{
    ConditionalHostedDocumentPut,
    HostedDocumentDto,
    HostedDocumentPutResult,
    HostedSessionDto,
    HostedSessionEventRequest,
    HostedSessionOperationResult,
    ServerConnectionDescription,
    ServerGateway,
    ServerGatewayResult,
    ServerTestResult,
} from "../../src/application/server-contracts.js";
import
{
    serializeCanonicalDocument,
    serializeCanonicalHostedContent,
} from "../../src/domain/model/canonicalization.js";
import type { AutomataDocument, CanonicalSerializedDocument } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import
{
    compileDocument,
    resetRuntimeSession,
    runRuntimeSession,
    stepRuntimeSession,
} from "../../src/domain/runtime/runtime.js";
import type { CompiledModel, RuntimeSession } from "../../src/domain/runtime/contracts.js";
import { AutomataDocumentCodec } from "../../src/infrastructure/files/file-codec.js";
import { BrowserServerWorkerGateway } from "../../src/infrastructure/server/index.js";

const SERVER_INSTANCE_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID         = "00000000-0000-4000-8000-000000000101";

//--------------------------------------------------------------------------------------------------
// Function: successful
//
// Description:
//
//   Creates the successful result.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
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

function successful<Value> ( value: Value ): ServerGatewayResult<Value>
{
    // Return the assembled result.

    return { isSuccessful: true, value };
}

//--------------------------------------------------------------------------------------------------
// Function: semanticRevision
//
// Description:
//
//   Derives the semantic revision.
//
// Parameters:
//
//   - document:
//     The document to process.
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

function semanticRevision ( document: AutomataDocument ): string
{
    // Return the computed result.

    return `sha256:${createHash ( "sha256" ).update ( serializeCanonicalHostedContent ( document ) ).digest ( "hex" )}`;
}

// A two-state lamp with entry and exit actions on both states, one declared event, and a deliberate
// gap: state_on has no transition for event_toggle_off_missing, so NO_TRANSITION is reachable
// without editing the model.

//--------------------------------------------------------------------------------------------------
// Function: createHostedDocument
//
// Description:
//
//   Creates hosted document for the test scenario.
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

function createHostedDocument (): AutomataDocument
{
    // Initialize the local values needed by this operation.

    const emptyDraft = createEmptyAuthoringDraft ();

    // Return the assembled result.

    return {
        ...emptyDraft,
        settings:     { ...emptyDraft.settings, name: "Lamp" },
        simulator:
        {
            sequences: [ { description: "", name: "sequence_1", sequence: [ "event_toggle" ] } ],
        },
        stateMachine:
        {
            ...emptyDraft.stateMachine,
            actions:      [
                { description: "", name: "action_light_on" },
                { description: "", name: "action_light_off" },
            ],
            events:       [ { description: "", name: "event_toggle" } ],
            initialState: "state_off",
            stateActions:
            {
                entry: [ { action: "action_light_on", state: "state_on" } ],
                exit:  [ { action: "action_light_off", state: "state_on" } ],
            },
            states:
            [
                { description: "", name: "state_off" },
                { description: "", name: "state_on" },
            ],
            transitionTable:
            [
                { event: "event_toggle", state: "state_off", stateNext: "state_on" },
                { event: "event_toggle", state: "state_on", stateNext: "state_off" },
            ],
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Class: SimulatorGateway
//
// Description:
//
//   Implements the simulator gateway behavior.
//
//--------------------------------------------------------------------------------------------------

class SimulatorGateway extends BrowserServerWorkerGateway implements ServerGateway
{
    public putRequestCount = 0;
    public runRequests: HostedSessionEventRequest[] = [];
    public startSessionRequestCount = 0;
    public stepRequests: HostedSessionEventRequest[] = [];

    private canonicalDocument: CanonicalSerializedDocument;
    private compiledModel:     CompiledModel;
    private modelRevision:     string;
    private pinnedModel:       CompiledModel | null = null;
    private pinnedRevision:    string | null = null;
    private runtimeSession:    RuntimeSession | null = null;

    //----------------------------------------------------------------------------------------------
    // Constructor: SimulatorGateway
    //
    // Description:
    //
    //   Initializes a SimulatorGateway instance.
    //
    // Parameters:
    //
    //   - document:
    //     The document to process.
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

    public constructor ( document = createHostedDocument () )
    {
        super ();

        this.canonicalDocument = serializeCanonicalDocument ( document );
        this.compiledModel     = compileDocument ( document );
        this.modelRevision     = semanticRevision ( document );
    }

    //----------------------------------------------------------------------------------------------
    // Method: connect
    //
    // Description:
    //
    //   Connects the requested value.
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

    public override async connect (): Promise<ServerGatewayResult<ServerConnectionDescription>>
    {
        // Return the successful result.

        return successful ( this.connectionDescription () );
    }

    //----------------------------------------------------------------------------------------------
    // Method: disconnect
    //
    // Description:
    //
    //   Disconnects the requested value.
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

    public override async disconnect (): Promise<ServerGatewayResult<void>>
    {
        // Return the successful result.

        return successful ( undefined );
    }

    //----------------------------------------------------------------------------------------------
    // Method: test
    //
    // Description:
    //
    //   Checks the requested condition.
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

    public override async test (): Promise<ServerGatewayResult<ServerTestResult>>
    {
        // Return the successful result.

        return successful ( { ...this.connectionDescription (), isLive: true } );
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

    public override async getHostedDocument (): Promise<ServerGatewayResult<HostedDocumentDto>>
    {
        // Return the successful result.

        return successful ( { canonicalDocument: this.canonicalDocument, modelRevision: this.modelRevision } );
    }

    //----------------------------------------------------------------------------------------------
    // Method: putHostedDocument
    //
    // Description:
    //
    //   Stores the hosted document.
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

    public override async putHostedDocument (
        request: ConditionalHostedDocumentPut,
    ): Promise<ServerGatewayResult<HostedDocumentPutResult>>
    {
        this.putRequestCount++;

        // Initialize the local values needed by this operation.

        const isIdempotent = request.canonicalDocument.text === this.canonicalDocument.text;
        const decoded      = new AutomataDocumentCodec ().open ( request.canonicalDocument.text );

        // Handle the case where the decoded is successful condition is not satisfied.

        if ( !decoded.isSuccessful )
        {
            throw new Error ( "The Simulator shell test received a non-decodable Push document." );
        }

        this.canonicalDocument = request.canonicalDocument;
        this.compiledModel     = compileDocument ( decoded.document );
        this.modelRevision     = semanticRevision ( decoded.document );

        // Return the successful result.

        return successful ( { isIdempotent, modelRevision: this.modelRevision } );
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

    public override async startSession (): Promise<ServerGatewayResult<HostedSessionDto>>
    {
        this.startSessionRequestCount++;
        this.pinnedModel    = this.compiledModel;
        this.pinnedRevision = this.modelRevision;
        this.runtimeSession = resetRuntimeSession ( this.compiledModel );

        // Return the successful result.

        return successful ( this.snapshot ( 0 ) );
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

    public override async runSession (
        request: HostedSessionEventRequest,
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>
    {
        this.runRequests.push ( request );

        // Return the successful result.

        return successful ( this.operate ( request, runRuntimeSession ) );
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

    public override async stepSession (
        request: HostedSessionEventRequest,
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>
    {
        this.stepRequests.push ( request );

        // Return the successful result.

        return successful ( this.operate ( request, stepRuntimeSession ) );
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

    public override async resetSession (): Promise<ServerGatewayResult<HostedSessionDto>>
    {
        // Initialize the local values needed by this operation.

        const pinnedModel = this.requirePinnedModel ();

        this.runtimeSession = resetRuntimeSession ( pinnedModel );

        // Return the successful result.

        return successful ( this.snapshot ( 0 ) );
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

    public override async closeSession (): Promise<ServerGatewayResult<void>>
    {
        this.runtimeSession = null;
        this.pinnedModel    = null;
        this.pinnedRevision = null;

        // Return the successful result.

        return successful ( undefined );
    }

    //----------------------------------------------------------------------------------------------
    // Method: restart
    //
    // Description:
    //
    //   Restarts the requested value.
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

    public override async restart (): Promise<ServerGatewayResult<ServerConnectionDescription>>
    {
        // Return the successful result.

        return successful ( this.connectionDescription () );
    }

    //----------------------------------------------------------------------------------------------
    // Method: dispose
    //
    // Description:
    //
    //   Disposes the requested value.
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

    public override async dispose (): Promise<ServerGatewayResult<void>>
    {
        // Return the successful result.

        return successful ( undefined );
    }

    //----------------------------------------------------------------------------------------------
    // Method: setConnectionLostHandler
    //
    // Description:
    //
    //   Updates connection lost handler.
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

    public override setConnectionLostHandler (): void
    {
    }

    // Stands in for a concurrent Push by another client. The live session keeps its pinned
    // snapshot; only the hosted head moves.

    //----------------------------------------------------------------------------------------------
    // Method: replaceHostedDocument
    //
    // Description:
    //
    //   Replaces the hosted document.
    //
    // Parameters:
    //
    //   - document:
    //     The document to process.
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

    public replaceHostedDocument ( document: AutomataDocument ): void
    {
        this.canonicalDocument = serializeCanonicalDocument ( document );
        this.compiledModel     = compileDocument ( document );
        this.modelRevision     = semanticRevision ( document );
    }

    //----------------------------------------------------------------------------------------------
    // Method: connectionDescription
    //
    // Description:
    //
    //   Derives the connection description.
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

    private connectionDescription (): ServerConnectionDescription
    {
        // Return the assembled result.

        return { instanceId: SERVER_INSTANCE_ID, isReady: true, modelRevision: this.modelRevision };
    }

    //----------------------------------------------------------------------------------------------
    // Method: requirePinnedModel
    //
    // Description:
    //
    //   Validates and returns the pinned model.
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

    private requirePinnedModel (): CompiledModel
    {
        // Handle the case where pinned model matches an absent value.

        if ( this.pinnedModel === null )
        {
            throw new Error ( "The Simulator shell test operated a session that was never started." );
        }

        // Return the computed result.

        return this.pinnedModel;
    }

    //----------------------------------------------------------------------------------------------
    // Method: operate
    //
    // Description:
    //
    //   Runs an operation on the active value.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
    //
    //   - execute:
    //     The execute supplied to the operation.
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

    private operate (
        request: HostedSessionEventRequest,
        execute: (
            model: CompiledModel,
            session: RuntimeSession,
            eventBuffer: readonly string[],
        ) => ReturnType<typeof runRuntimeSession>,
    ): HostedSessionOperationResult
    {
        // Initialize the local values needed by this operation.

        const pinnedModel = this.requirePinnedModel ();

        // Handle the case where runtime session matches an absent value.

        if ( this.runtimeSession === null )
        {
            throw new Error ( "The Simulator shell test operated a session that was never started." );
        }

        const result = execute ( pinnedModel, this.runtimeSession, request.eventBuffer );

        this.runtimeSession = result.session;

        // Return the assembled result.

        return {
            consumedEventCount: result.consumedEventCount,
            emittedActions:     result.emittedActions,
            session:            this.snapshot ( result.consumedEventCount ),
            warnings:           result.warnings,
        };
    }

    private processedEventCount = 0;

    //----------------------------------------------------------------------------------------------
    // Method: snapshot
    //
    // Description:
    //
    //   Derives the snapshot.
    //
    // Parameters:
    //
    //   - consumedEventCount:
    //     The consumed event count supplied to the operation.
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

    private snapshot ( consumedEventCount: number ): HostedSessionDto
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( this.runtimeSession === null || this.pinnedRevision === null )
        {
            throw new Error ( "The Simulator shell test projected a session that was never started." );
        }

        this.processedEventCount = consumedEventCount === 0 && this.runtimeSession.transitionTrace.length === 0
            ? 0
            : this.processedEventCount + consumedEventCount;

        // Return the assembled result.

        return {
            actionTrace:                this.runtimeSession.actionTrace,
            currentState:               this.runtimeSession.currentState,
            initialEntryActionsPending: this.runtimeSession.initialEntryActionsPending,
            isStale:                    this.pinnedRevision !== this.modelRevision,
            modelRevision:              this.pinnedRevision,
            processedEventCount:        this.processedEventCount,
            sessionId:                  SESSION_ID,
            traceTruncated:             false,
            transitionTrace:            this.runtimeSession.transitionTrace,
        };
    }
}

//--------------------------------------------------------------------------------------------------
// Function: toolbarButton
//
// Description:
//
//   Derives the toolbar button.
//
// Parameters:
//
//   - identifier:
//     The identifier supplied to the operation.
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

function toolbarButton ( identifier: string ): HTMLButtonElement
{
    // Initialize the local values needed by this operation.

    const button = document.querySelector<HTMLButtonElement> ( `[data-toolbar-entry='${identifier}']` );

    // Handle the case where button matches an absent value.

    if ( button === null )
    {
        throw new Error ( `The '${identifier}' toolbar button was not rendered.` );
    }

    // Return the button.

    return button;
}

//--------------------------------------------------------------------------------------------------
// Function: openSimulatorWithHostedModel
//
// Description:
//
//   Opens the simulator with hosted model.
//
// Parameters:
//
//   - gateway:
//     The gateway supplied to the operation.
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

async function openSimulatorWithHostedModel ( gateway: SimulatorGateway ): Promise<ReturnType<typeof userEvent.setup>>
{
    // Initialize the local values needed by this operation.

    const user = userEvent.setup ();

    render ( <Application serverGateway={ gateway } /> );

    await waitFor ( () => expect ( toolbarButton ( "toolbar-pull" ) ).toBeEnabled () );
    await user.click ( toolbarButton ( "toolbar-pull" ) );
    await waitFor ( () => expect ( screen.queryByRole ( "dialog" ) ).toBeNull () );
    await user.click ( toolbarButton ( "toolbar-simulator" ) );
    await screen.findByRole ( "heading", { name: "Event Sequences" } );

    // Return the user.

    return user;
}

//--------------------------------------------------------------------------------------------------
// Function: changeLoadedModelName
//
// Description:
//
//   Derives the change loaded model name.
//
// Parameters:
//
//   - user:
//     The user supplied to the operation.
//
//   - modelName:
//     The model name supplied to the operation.
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

async function changeLoadedModelName (
    user: ReturnType<typeof userEvent.setup>,
    modelName: string,
): Promise<void>
{
    await user.click ( toolbarButton ( "toolbar-editor" ) );

    const editorNode = screen.getByRole ( "treeitem", { name: "Editor" } );

    // Handle the case where get attribute result differs from "true".

    if ( editorNode.getAttribute ( "aria-expanded" ) !== "true" )
    {
        await user.click ( editorNode );
        await user.keyboard ( "{ArrowRight}" );
    }

    await user.click ( screen.getByRole ( "treeitem", { name: "State Machine" } ) );

    const nameEditor = screen.getByRole ( "textbox", { name: "Name" } );

    await user.clear ( nameEditor );
    await user.type ( nameEditor, modelName );
    await user.tab ();
    await user.click ( toolbarButton ( "toolbar-simulator" ) );
}

//--------------------------------------------------------------------------------------------------
// Function: transitionTraceRows
//
// Description:
//
//   Derives the transition trace rows.
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

function transitionTraceRows (): readonly HTMLElement[]
{
    // Initialize the local values needed by this operation.

    const region = screen.getByRole ( "heading", { name: "Transition Trace" } ).parentElement as HTMLElement;

    // Return the slice result.

    return within ( region ).queryAllByRole ( "row" ).slice ( 1 );
}

//--------------------------------------------------------------------------------------------------
// Function: actionTraceRows
//
// Description:
//
//   Derives the action trace rows.
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

function actionTraceRows (): readonly HTMLElement[]
{
    // Initialize the local values needed by this operation.

    const region = screen.getByRole ( "heading", { name: "Action Trace" } ).parentElement as HTMLElement;

    // Return the slice result.

    return within ( region ).queryAllByRole ( "row" ).slice ( 1 );
}

describe ( "Phase 8 Simulator shell", () =>
{
    beforeEach ( () =>
    {
        window.localStorage.clear ();
        Object.defineProperty ( globalThis, "crypto", { configurable: true, value: webcrypto } );
    } );

    afterEach ( cleanup );

    it ( "blocks Run, Step, and Reset until a document, a ready server, and a session exist", async () =>
    {
        // Initialize the local values needed by this operation.

        const user    = userEvent.setup ();
        const gateway = new SimulatorGateway ();

        render ( <Application serverGateway={ gateway } /> );

        await waitFor ( () => expect ( toolbarButton ( "toolbar-pull" ) ).toBeEnabled () );
        await user.click ( toolbarButton ( "toolbar-simulator" ) );

        // No document is open yet, so the page asks for one instead of offering an inoperable
        // session.

        expect ( screen.getByText ( /Create or open a document/u ) ).toBeTruthy ();
        expect ( screen.queryByRole ( "button", { name: "Start Session" } ) ).toBeNull ();

        await user.click ( toolbarButton ( "toolbar-pull" ) );
        await waitFor ( () => expect ( toolbarButton ( "toolbar-push" ) ).toBeEnabled () );
        await user.click ( toolbarButton ( "toolbar-simulator" ) );
        await screen.findByRole ( "heading", { name: "Event Sequences" } );

        expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeDisabled ();
        expect ( screen.getByRole ( "button", { name: "Start Session" } ) ).toBeEnabled ();

        await user.click ( screen.getByRole ( "button", { name: "Start Session" } ) );

        await waitFor ( () => expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeEnabled () );
        expect ( screen.getByRole ( "button", { name: "Step" } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "button", { name: "Reset" } ) ).toBeEnabled ();
    } );

    it ( "pushes a different loaded model before starting when the user accepts synchronization", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        await changeLoadedModelName ( user, "Locally Updated Lamp" );
        await user.click ( screen.getByRole ( "button", { name: "Start Session" } ) );

        // Initialize the local values needed by this operation.

        const dialog             = await screen.findByRole ( "dialog", { name: "Loaded and Hosted Models Differ" } );
        const pushAndStartButton = within ( dialog ).getByRole ( "button", { name: "Push and Start Session" } );

        expect ( gateway.putRequestCount ).toBe ( 0 );
        expect ( gateway.startSessionRequestCount ).toBe ( 0 );
        expect ( pushAndStartButton ).toHaveFocus ();

        await user.click ( pushAndStartButton );

        await waitFor ( () => expect ( gateway.startSessionRequestCount ).toBe ( 1 ) );
        expect ( gateway.putRequestCount ).toBe ( 1 );
        expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeEnabled ();
    } );

    it ( "starts with the hosted model and warns when the user declines synchronization", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        await changeLoadedModelName ( user, "Another Local Lamp" );
        await user.click ( screen.getByRole ( "button", { name: "Start Session" } ) );

        const dialog = await screen.findByRole ( "dialog", { name: "Loaded and Hosted Models Differ" } );

        await user.click ( within ( dialog ).getByRole ( "button", { name: "Start Without Pushing" } ) );

        await waitFor ( () => expect ( gateway.startSessionRequestCount ).toBe ( 1 ) );
        expect ( gateway.putRequestCount ).toBe ( 0 );
        expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeEnabled ();
        expect ( await screen.findByText ( /without pushing the loaded model/u, { selector: ".console-text" } ) )
            .toHaveTextContent ( /behavior may not match the current document/u );
    } );
    it ( "emits initial entry actions once on the first Run and traces the transition", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        await user.click ( screen.getByRole ( "button", { name: "Start Session" } ) );
        await waitFor ( () => expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeEnabled () );

        expect ( actionTraceRows () ).toHaveLength ( 0 );

        await user.click ( screen.getByRole ( "button", { name: "Run" } ) );

        await waitFor ( () => expect ( transitionTraceRows () ).toHaveLength ( 1 ) );
        expect ( transitionTraceRows () [ 0 ]?.textContent ).toContain ( "event_toggle" );
        expect ( transitionTraceRows () [ 0 ]?.textContent ).toContain ( "Transition" );

        // state_off declares no entry actions, so the only emitted action is state_on's entry
        // action.

        const actions = actionTraceRows ().map ( row => row.textContent ?? "" );

        expect ( actions.filter ( action => action.includes ( "action_light_on" ) ) ).toHaveLength ( 1 );
    } );

    it ( "continues Run with the unconsumed buffer after Step", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        const editor = screen.getByRole ( "textbox", { name: "Editor" } );

        await user.clear ( editor );
        await user.type ( editor, "event_toggle\n\n  event_toggle  \n" );
        await user.click ( screen.getByRole ( "button", { name: "Start Session" } ) );
        await waitFor ( () => expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeEnabled () );
        await user.click ( screen.getByRole ( "button", { name: "Step" } ) );

        await waitFor ( () => expect ( gateway.stepRequests ).toHaveLength ( 1 ) );
        expect ( gateway.stepRequests [ 0 ]?.eventBuffer ).toEqual ( [ "event_toggle" ] );

        await user.click ( screen.getByRole ( "button", { name: "Run" } ) );

        await waitFor ( () => expect ( gateway.runRequests ).toHaveLength ( 1 ) );
        expect ( gateway.runRequests [ 0 ]?.eventBuffer ).toEqual ( [ "event_toggle" ] );
        await waitFor ( () => expect ( transitionTraceRows () ).toHaveLength ( 2 ) );

        const status = screen.getByRole ( "contentinfo", { name: "Application status" } );

        await waitFor ( () => expect ( within ( status ).getByText ( /Simulator State: state_off/u ) ).toBeTruthy () );
    } );

    it ( "consumes an unknown event with a warning row and a Console entry without aborting the run", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        const editor = screen.getByRole ( "textbox", { name: "Editor" } );

        await user.clear ( editor );
        await user.type ( editor, "event_not_declared\nevent_toggle" );
        await user.click ( screen.getByRole ( "button", { name: "Start Session" } ) );
        await waitFor ( () => expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeEnabled () );
        await user.click ( screen.getByRole ( "button", { name: "Run" } ) );

        await waitFor ( () => expect ( transitionTraceRows () ).toHaveLength ( 2 ) );
        expect ( transitionTraceRows () [ 0 ]?.textContent ).toContain ( "Unknown event" );

        // The later declared event still executed, so the run did not abort.

        expect ( transitionTraceRows () [ 1 ]?.textContent ).toContain ( "Transition" );
        expect ( ( await screen.findAllByText ( /is not declared and was consumed/u ) ).length )
            .toBeGreaterThan ( 0 );
    } );

    it ( "clears both traces on Reset without emitting an action, then re-emits initial actions once", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        await user.click ( screen.getByRole ( "button", { name: "Start Session" } ) );
        await waitFor ( () => expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeEnabled () );
        await user.click ( screen.getByRole ( "button", { name: "Run" } ) );
        await waitFor ( () => expect ( transitionTraceRows () ).toHaveLength ( 1 ) );

        await user.click ( screen.getByRole ( "button", { name: "Reset" } ) );

        await waitFor ( () => expect ( transitionTraceRows () ).toHaveLength ( 0 ) );
        expect ( actionTraceRows () ).toHaveLength ( 0 );
        expect ( ( await screen.findAllByText ( /no actions were emitted/u ) ).length ).toBeGreaterThan ( 0 );

        await user.click ( screen.getByRole ( "button", { name: "Run" } ) );
        await waitFor ( () => expect ( transitionTraceRows () ).toHaveLength ( 1 ) );
    } );

    it ( "continues a second Run from the retained current state", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        await user.click ( screen.getByRole ( "button", { name: "Start Session" } ) );
        await waitFor ( () => expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeEnabled () );
        await user.click ( screen.getByRole ( "button", { name: "Run" } ) );
        await waitFor ( () => expect ( transitionTraceRows () ).toHaveLength ( 1 ) );

        const status = screen.getByRole ( "contentinfo", { name: "Application status" } );

        await waitFor ( () => expect ( within ( status ).getByText ( /Simulator State: state_on/u ) ).toBeTruthy () );

        // Run remains available at exhaustion, and the second buffer starts where the first
        // stopped.

        expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeEnabled ();

        await user.click ( screen.getByRole ( "button", { name: "Run" } ) );

        await waitFor ( () => expect ( transitionTraceRows () ).toHaveLength ( 2 ) );
        expect ( transitionTraceRows () [ 1 ]?.textContent ).toContain ( "state_on" );

        await waitFor ( () => expect ( within ( status ).getByText ( /Simulator State: state_off/u ) ).toBeTruthy () );
    } );

    it ( "contributes the current state to the status bar only while the Simulator is active", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        await user.click ( screen.getByRole ( "button", { name: "Start Session" } ) );

        const status = screen.getByRole ( "contentinfo", { name: "Application status" } );

        await waitFor ( () => expect ( within ( status ).getByText ( /Simulator State: state_off/u ) ).toBeTruthy () );

        await user.click ( toolbarButton ( "toolbar-editor" ) );

        await waitFor ( () => expect ( within ( status ).queryByText ( /Simulator State/u ) ).toBeNull () );
    } );

    it ( "persists a sequence edit as one undoable document change", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        const editor = screen.getByRole ( "textbox", { name: "Editor" } );

        await user.clear ( editor );
        await user.type ( editor, "event_toggle\nevent_toggle" );
        await user.tab ();

        await waitFor ( () => expect ( toolbarButton ( "toolbar-undo" ) ).toBeEnabled () );
        await user.click ( toolbarButton ( "toolbar-undo" ) );

        await waitFor ( () => expect (
            ( screen.getByRole ( "textbox", { name: "Editor" } ) as HTMLTextAreaElement ).value,
        ).toBe ( "event_toggle" ) );
    } );

    it ( "reports a live session stale after the hosted head moves, without mutating its pinned snapshot", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        await user.click ( screen.getByRole ( "button", { name: "Start Session" } ) );
        await waitFor ( () => expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeEnabled () );
        await user.click ( screen.getByRole ( "button", { name: "Run" } ) );
        await waitFor ( () => expect ( transitionTraceRows () ).toHaveLength ( 1 ) );

        const hostedDocument = createHostedDocument ();

        gateway.replaceHostedDocument (
            {
                ...hostedDocument,
                stateMachine:
                {
                    ...hostedDocument.stateMachine,
                    states: [ ...hostedDocument.stateMachine.states, { description: "", name: "state_extra" } ],
                },
            },
        );

        await user.click ( toolbarButton ( "toolbar-pull" ) );
        await waitFor ( () => expect ( screen.queryByRole ( "dialog" ) ).toBeNull () );
        await user.click ( toolbarButton ( "toolbar-simulator" ) );

        // Staleness reaches the user through the Console and the status bar. The page itself says
        // nothing.

        // Scoped to the entry's own text element. An unscoped text query also matches the row
        // containing it, which makes one Console entry look like two.

        expect (
            await screen.findAllByText ( /pinned to superseded revision/u, { selector: ".console-text" } ),
        ).toHaveLength ( 1 );
        expect ( screen.queryByRole ( "heading", { name: "State Machine" } ) ).toBeNull ();

        // The pinned snapshot is intact: the trace and current state survive the hosted
        // replacement.

        expect ( transitionTraceRows () ).toHaveLength ( 1 );

        const status = screen.getByRole ( "contentinfo", { name: "Application status" } );

        expect ( within ( status ).getByText ( /Simulator State: state_on/u ) ).toBeTruthy ();
    } );

    it ( "enables the Simulator sequence CSV commands once a document is open", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new SimulatorGateway ();
        const user    = await openSimulatorWithHostedModel ( gateway );

        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );
        await user.click ( screen.getByRole ( "menuitem", { name: "Import from CSV" } ) );

        expect ( screen.getByRole ( "menuitem", { name: "Simulator Event Sequence" } ) ).toBeEnabled ();
    } );
} );

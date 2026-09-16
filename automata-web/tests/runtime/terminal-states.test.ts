// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Terminal Runtime Tests
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies optional terminal entry, immutable stopping, exact prefixes and disabled execution.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";
import {
    compileDocument, resetRuntimeSession, runRuntimeSession, stepRuntimeSession,
    RuntimeSessionTerminatedError,
} from "../../src/domain/runtime/runtime.js";
import { terminalDocument } from "./terminal-state-fixture.js";

const ENABLED = { enableTerminalStates: true };

describe ( "terminal runtime", () =>
{
    it.each ( [ runRuntimeSession, stepRuntimeSession ] ) (
        "initializes a terminal initial state before consuming any event (%#)", execute =>
        {
            const model   = compileDocument ( terminalDocument ( true ) );
            const session = resetRuntimeSession ( model, ENABLED );
            expect ( session.executionStatus ).toEqual ( { kind: "active" } );
            expect ( session.actionTrace ).toEqual ( [] );
            for ( const events of [ [], [ "go", "back" ] ] )
            {
                const result = execute ( model, session, events );
                expect ( result.consumedEventCount ).toBe ( 0 );
                expect ( result.emittedActions ).toEqual ( [ "initial" ] );
                expect ( result.warnings ).toEqual ( [] );
                expect ( result.session.transitionTrace ).toEqual ( [] );
                expect ( result.session.executionStatus ).toEqual (
                    { kind: "terminated", reason: "terminal_state", state: "idle" },
                );
                expect ( () => execute ( model, result.session, events ) ).toThrow ( RuntimeSessionTerminatedError );
            }
            expect ( session.initialEntryActionsPending ).toBe ( true );
            expect ( session.actionTrace ).toEqual ( [] );
        },
    );

    it ( "finishes ordered duplicate entry actions and preserves only the consumed prefix", () =>
    {
        const model   = compileDocument ( terminalDocument () );
        const session = resetRuntimeSession ( model, ENABLED );
        const result  = runRuntimeSession ( model, session, [ "unknown", "unmapped", "go", "back", "loop" ] );
        expect ( result.consumedEventCount ).toBe ( 3 );
        expect ( result.emittedActions ).toEqual ( [ "initial", "leave", "arrive", "arrive" ] );
        expect ( result.warnings.map ( warning => warning.code ) ).toEqual ( [ "UNKNOWN_EVENT", "NO_TRANSITION" ] );
        expect ( result.session.currentState ).toBe ( "done" );
        expect ( result.session.transitionTrace.map ( entry => entry.outcome ) ).toEqual (
            [ "UNKNOWN_EVENT", "NO_TRANSITION", "TRANSITION" ],
        );
        expect ( result.session.executionStatus ).toEqual (
            { kind: "terminated", reason: "terminal_state", state: "done" },
        );
        const before = JSON.stringify ( result );
        expect ( () => runRuntimeSession ( model, result.session, [ "back" ] ) ).toThrow ( RuntimeSessionTerminatedError );
        expect ( JSON.stringify ( result ) ).toBe ( before );
        expect ( session.transitionTrace ).toEqual ( [] );
    } );

    it.each ( [ false, true ] ) ( "stops with empty entry actions (initial=%s)", initialTerminal =>
    {
        const model = compileDocument ( terminalDocument ( initialTerminal, false ) );
        const result = runRuntimeSession ( model, resetRuntimeSession ( model, ENABLED ), [ "go", "back" ] );
        expect ( result.emittedActions ).toEqual ( [] );
        expect ( result.consumedEventCount ).toBe ( initialTerminal ? 0 : 1 );
        expect ( result.session.executionStatus.kind ).toBe ( "terminated" );
    } );

    it ( "ignores flags with disabled/default policy, including outgoing and self transitions", () =>
    {
        const model = compileDocument ( terminalDocument ( true ) );
        const result = runRuntimeSession ( model, resetRuntimeSession ( model ), [ "go", "loop", "back" ] );
        expect ( result.consumedEventCount ).toBe ( 3 );
        expect ( result.session.currentState ).toBe ( "idle" );
        expect ( result.session.executionStatus ).toEqual ( { kind: "active" } );
        expect ( result.emittedActions ).toEqual (
            [ "initial", "leave", "arrive", "arrive", "terminal_exit", "arrive", "arrive", "terminal_exit", "initial" ],
        );
    } );

    it ( "copies the policy and Reset silently starts another execution", () =>
    {
        const model  = compileDocument ( terminalDocument () );
        const policy = { enableTerminalStates: true };
        const session = resetRuntimeSession ( model, policy );
        policy.enableTerminalStates = false;
        const stopped = runRuntimeSession ( model, session, [ "go", "back" ] );
        expect ( stopped.consumedEventCount ).toBe ( 1 );
        const reset = resetRuntimeSession ( model, policy );
        expect ( reset.actionTrace ).toEqual ( [] );
        expect ( reset.executionStatus.kind ).toBe ( "active" );
        expect ( runRuntimeSession ( model, reset, [ "go", "back" ] ).consumedEventCount ).toBe ( 2 );
    } );

    it ( "keeps ordinary empty-buffer initialization and exhaustion resumable", () =>
    {
        const model = compileDocument ( terminalDocument () );
        const initialized = runRuntimeSession ( model, resetRuntimeSession ( model, ENABLED ), [] );
        expect ( initialized.consumedEventCount ).toBe ( 0 );
        expect ( initialized.session.executionStatus.kind ).toBe ( "active" );
        const result = stepRuntimeSession ( model, initialized.session, [ "go", "back" ] );
        expect ( result.emittedActions ).toEqual ( [ "leave", "arrive", "arrive" ] );
        expect ( result.consumedEventCount ).toBe ( 1 );
    } );
} );

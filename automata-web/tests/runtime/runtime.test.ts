// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Deterministic Runtime Tests
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies Reset, delayed initialization, Run and Step parity, ordered actions, warnings, and
//   continuous execution.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";
import
{
    compileDocument,
    resetRuntimeSession,
    runRuntimeSession,
    stepRuntimeSession,
} from "../../src/domain/runtime/runtime.js";
import { loadExampleDocument } from "../model/example-helpers.js";

describe ( "deterministic runtime", () =>
{
    it ( "ignores Chart-only decorations during compilation", () =>
    {
        // Initialize the local values needed by this operation.

        const document          = loadExampleDocument ( "state-machine-comprehensive.json" );
        const decoratedDocument = {
            ...document,
            chart:
            {
                ...document.chart,
                draftTransitions:
                [
                    ...document.chart.draftTransitions,
                    { id: 91, source: { x: 10, y: 20 }, target: { x: 30, y: 40 } },
                ],
                indicators:
                {
                    ...document.chart.indicators,
                    terminalStateIndicators:
                    [
                        ...document.chart.indicators.terminalStateIndicators,
                        { id: 7, x: 800, y: 300 },
                    ],
                    terminalStateTransitions:
                    [
                        ...document.chart.indicators.terminalStateTransitions,
                        { state: "state_idle", terminalStateIndicatorId: 7 },
                    ],
                },
            },
        };

        expect ( compileDocument ( decoratedDocument ) ).toEqual ( compileDocument ( document ) );
    } );

    it ( "resets without output and initializes exactly once before the first Step event", () =>
    {
        // Initialize the local values needed by this operation.

        const model   = compileDocument ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const reset   = resetRuntimeSession ( model );
        const stepped = stepRuntimeSession ( model, reset, [ "event_start" ] );

        expect ( reset.initialEntryActionsPending ).toBe ( true );
        expect ( reset.actionTrace ).toEqual ( [] );
        expect ( reset.transitionTrace ).toEqual ( [] );
        expect ( stepped.consumedEventCount ).toBe ( 1 );
        expect ( stepped.emittedActions ).toEqual (
            [ "action_log", "action_leave", "action_begin", "action_log", "action_log" ],
        );
        expect ( stepped.session.currentState ).toBe ( "state_active" );
        expect ( stepped.session.initialEntryActionsPending ).toBe ( false );
    } );

    it ( "uses exit then entry ordering for a self-transition and preserves duplicates", () =>
    {
        // Initialize the local values needed by this operation.

        const model      = compileDocument ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const started    = runRuntimeSession ( model, resetRuntimeSession ( model ), [ "event_start" ] );
        const selfResult = stepRuntimeSession ( model, started.session, [ "event_tick" ] );

        expect ( selfResult.emittedActions ).toEqual (
            [ "action_leave", "action_begin", "action_log", "action_log" ],
        );
        expect ( selfResult.session.currentState ).toBe ( "state_active" );
        expect ( selfResult.session.transitionTrace ).toHaveLength ( 2 );
    } );

    it ( "produces Run and repeated-Step parity for the same event buffer", () =>
    {
        // Initialize the local values needed by this operation.

        const model                     = compileDocument ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const eventBuffer               = [ "event_unknown", "event_start", "event_tick", "event_finish", "event_reset" ];
        const runResult                 = runRuntimeSession ( model, resetRuntimeSession ( model ), eventBuffer );
        let steppedSession              = resetRuntimeSession ( model );
        const steppedActions: string[]  = [];
        const steppedWarnings: string[] = [];

        // Process each event name from the event buffer collection in order.

        for ( const eventName of eventBuffer )
        {
            // Initialize the local values needed by this operation.

            const stepResult = stepRuntimeSession ( model, steppedSession, [ eventName ] );

            steppedSession = stepResult.session;
            steppedActions.push ( ...stepResult.emittedActions );
            steppedWarnings.push ( ...stepResult.warnings.map ( ( warning ) => warning.code ) );
        }

        expect ( steppedSession ).toEqual ( runResult.session );
        expect ( steppedActions ).toEqual ( runResult.emittedActions );
        expect ( steppedWarnings ).toEqual ( runResult.warnings.map ( ( warning ) => warning.code ) );
    } );

    it ( "consumes unknown and missing-transition events while Run continues", () =>
    {
        // Initialize the local values needed by this operation.

        const model  = compileDocument ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const result = runRuntimeSession (
            model,
            resetRuntimeSession ( model ),
            [ "event_unknown", "event_finish", "event_start" ],
        );

        expect ( result.consumedEventCount ).toBe ( 3 );
        expect ( result.warnings.map ( ( warning ) => warning.code ) ).toEqual (
            [ "UNKNOWN_EVENT", "NO_TRANSITION" ],
        );
        expect ( result.session.currentState ).toBe ( "state_active" );
        expect ( result.session.initialEntryActionsPending ).toBe ( false );
    } );

    it ( "continues through every supplied event and remains running", () =>
    {
        // Initialize the local values needed by this operation.

        const model  = compileDocument ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const result = runRuntimeSession (
            model,
            resetRuntimeSession ( model ),
            [ "event_start", "event_finish", "event_reset" ],
        );

        expect ( result.consumedEventCount ).toBe ( 3 );
        expect ( result.session.initialEntryActionsPending ).toBe ( false );
        expect ( result.session.currentState ).toBe ( "state_idle" );
        expect ( result.emittedActions ).toContain ( "action_finish" );
    } );
} );

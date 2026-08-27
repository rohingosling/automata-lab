// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Domain Model Property Tests
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Exercises serialization, transition-key uniqueness, rename closure, and runtime determinism
//   over generated inputs.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import
{
    createDocumentEditorState,
    executeDocumentCommand,
    planDocumentCommand,
} from "../../src/domain/model/commands.js";
import { serializeCanonicalDocument } from "../../src/domain/model/canonicalization.js";
import type { AutomataDocument } from "../../src/domain/model/contracts.js";
import { validateAuthoringDraft } from "../../src/domain/model/validation.js";
import
{
    compileDocument,
    resetRuntimeSession,
    runRuntimeSession,
} from "../../src/domain/runtime/runtime.js";
import { openAutomataDocument } from "../../src/infrastructure/files/file-codec.js";
import { loadExampleDocument } from "./example-helpers.js";

const STATE_NAMES = [ "state_idle", "state_active", "state_complete" ];
const EVENT_NAMES = [ "event_start", "event_tick", "event_finish", "event_reset" ];

describe ( "domain model properties", () =>
{
    it ( "serializes identical domain values deterministically and round-trips them", () =>
    {
        fc.assert (
            fc.property ( fc.stringMatching ( /^[a-z][a-z0-9_]{0,31}$/ ), ( generatedName ) =>
            {
                // Initialize the local values needed by this operation.

                const sourceDocument             = loadExampleDocument ( "state-machine-solver-candidate.json" );
                const document: AutomataDocument = 
                {
                    ...sourceDocument,
                    settings: { ...sourceDocument.settings, name: generatedName },
                };
                const first  = serializeCanonicalDocument ( document );
                const second = serializeCanonicalDocument ( document );
                const opened = openAutomataDocument ( first.text );

                expect ( second.text ).toBe ( first.text );
                expect ( opened.isSuccessful ).toBe ( true );

                // Handle the case where opened is successful is enabled.

                if ( opened.isSuccessful )
                {
                    expect ( serializeCanonicalDocument ( opened.document ).text ).toBe ( first.text );
                }
            } ),
            { numRuns: 50 },
        );
    } );

    it ( "preserves unique deterministic transition keys in generated valid tables", () =>
    {
        // Initialize the local values needed by this operation.

        const pairArbitrary = fc.tuple (
            fc.constantFrom ( ...STATE_NAMES ),
            fc.constantFrom ( ...EVENT_NAMES ),
            fc.constantFrom ( ...STATE_NAMES ),
        );

        fc.assert (
            fc.property (
                fc.uniqueArray ( pairArbitrary, { selector: ( transition ) => JSON.stringify ( transition.slice ( 0, 2 ) ) } ),
                ( generatedTransitions ) =>
                {
                    // Initialize the local values needed by this operation.

                    const sourceDocument             = loadExampleDocument ( "state-machine-comprehensive.json" );
                    const document: AutomataDocument = 
                    {
                        ...sourceDocument,
                        stateMachine:
                        {
                            ...sourceDocument.stateMachine,
                            transitionTable: generatedTransitions.map ( ( [ state, event, stateNext ] ) =>
                                ( { state, event, stateNext } ) ),
                        },
                    };
                    const keys = document.stateMachine.transitionTable.map (
                        ( transition ) => JSON.stringify ( [ transition.state, transition.event ] ),
                    );

                    expect ( new Set ( keys ).size ).toBe ( keys.length );
                    expect ( validateAuthoringDraft ( document ).isValid ).toBe ( true );
                },
            ),
            { numRuns: 50 },
        );
    } );

    it ( "closes every typed state reference for generated rename targets", () =>
    {
        fc.assert (
            fc.property ( fc.stringMatching ( /^state_generated_[a-z0-9]{1,16}$/ ), ( generatedName ) =>
            {
                // Initialize the local values needed by this operation.

                const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
                const planResult   = planDocumentCommand (
                    initialState,
                    {
                        kind:             "rename_entity",
                        entityKind:       "state",
                        previousName:     "state_active",
                        newName:          generatedName,
                        expectedRevision: 1,
                    },
                );

                expect ( planResult.isSuccessful ).toBe ( true );

                // Handle the case where the plan result is successful condition is not satisfied.

                if ( !planResult.isSuccessful )
                {
                    // Return control to the caller.

                    return;
                }

                const executionResult = executeDocumentCommand ( initialState, planResult.plan );

                expect ( executionResult.isSuccessful ).toBe ( true );

                // Handle the case where execution result is successful is enabled.

                if ( executionResult.isSuccessful )
                {
                    expect ( JSON.stringify ( executionResult.state.draft ) ).not.toContain ( "state_active" );
                    expect ( validateAuthoringDraft ( executionResult.state.draft ).isValid ).toBe ( true );
                }
            } ),
            { numRuns: 50 },
        );
    } );

    it ( "produces identical runtime results for identical event buffers", () =>
    {
        // Initialize the local values needed by this operation.

        const eventArbitrary = fc.array (
            fc.constantFrom ( ...EVENT_NAMES, "event_unknown" ),
            { maxLength: 20 },
        );

        fc.assert (
            fc.property ( eventArbitrary, ( eventBuffer ) =>
            {
                // Initialize the local values needed by this operation.

                const model  = compileDocument ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
                const reset  = resetRuntimeSession ( model );
                const first  = runRuntimeSession ( model, reset, eventBuffer );
                const second = runRuntimeSession ( model, reset, eventBuffer );

                expect ( second ).toEqual ( first );
            } ),
            { numRuns: 100 },
        );
    } );
} );

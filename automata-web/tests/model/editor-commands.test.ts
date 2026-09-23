// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Editor Document Command Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the complete data-centric command surface, ordered duplicates, and clean-baseline
//   history.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";
import
{
    createDocumentEditorState,
    executeDocumentCommand,
    markDocumentEditorStateClean,
    planDocumentCommand,
    undoDocumentCommand,
} from "../../src/domain/model/commands.js";
import type { DocumentCommand, DocumentEditorState } from "../../src/domain/model/commands.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { loadExampleDocument } from "./example-helpers.js";

//--------------------------------------------------------------------------------------------------
// Function: execute
//
// Description:
//
//   Executes the requested value.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - command:
//     The command supplied to the operation.
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

function execute ( state: DocumentEditorState, command: DocumentCommand ): DocumentEditorState
{
    // Initialize the local values needed by this operation.

    const planResult = planDocumentCommand ( state, command );

    // Handle the case where the plan result is successful condition is not satisfied.

    if ( !planResult.isSuccessful )
    {
        throw new Error ( planResult.message );
    }

    const executionResult = executeDocumentCommand ( state, planResult.plan );

    // Handle the case where the execution result is successful condition is not satisfied.

    if ( !executionResult.isSuccessful )
    {
        throw new Error ( executionResult.message );
    }

    // Return the computed result.

    return executionResult.state;
}

describe ( "Phase 3 Editor commands", () =>
{
    it ( "builds a valid model through the one revisioned command path and preserves duplicate action rows", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createDocumentEditorState ( createEmptyAuthoringDraft ( true ) );

        expect ( state.documentRevision ).toBe ( 1 );
        expect ( state.validationSummary.isValid ).toBe ( false );

        state = execute ( state, {
            kind: "add_entity", entityKind: "state", entity: { name: "state_idle", description: "Idle" },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_entity", entityKind: "event", entity: { name: "event_start", description: "Start" },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_entity", entityKind: "action", entity: { name: "action_log", description: "Log" },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "set_initial_state", initialState: "state_idle", expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_state_action", actionKind: "entry", mapping: { state: "state_idle", action: "action_log" },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_state_action", actionKind: "entry", mapping: { state: "state_idle", action: "action_log" },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_transition",
            transition: { state: "state_idle", event: "event_start", stateNext: "state_idle" },
            expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.stateMachine.stateActions.entry ).toEqual (
            [
                { state: "state_idle", action: "action_log" },
                { state: "state_idle", action: "action_log" },
            ],
        );
        expect ( state.documentRevision ).toBe ( 8 );
        expect ( state.validationSummary ).toMatchObject ( { isValid: true, errorCount: 0 } );
    } );

    it ( "updates names and descriptions atomically and rejects a duplicate deterministic key", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const updatedState = execute ( initialState, {
            kind:         "update_entity",
            entityKind:   "event",
            previousName: "event_start",
            entity:       { name: "event_begin", description: "Begin processing" },
            expectedRevision: initialState.documentRevision,
        } );

        expect ( updatedState.draft.stateMachine.events ).toContainEqual (
            { name: "event_begin", description: "Begin processing" },
        );
        expect ( updatedState.draft.stateMachine.transitionTable.some ( transition =>
            transition.event === "event_begin" ) ).toBe ( true );
        expect ( JSON.stringify ( updatedState.draft ) ).not.toContain ( "event_start" );

        const existingTransition = updatedState.draft.stateMachine.transitionTable [ 0 ];

        // Handle the case where existing transition matches undefined.

        if ( existingTransition === undefined )
        {
            throw new Error ( "The comprehensive example must contain transitions." );
        }

        const duplicateResult = planDocumentCommand ( updatedState, {
            kind:             "add_transition",
            transition:       existingTransition,
            expectedRevision: updatedState.documentRevision,
        } );

        expect ( duplicateResult ).toMatchObject ( { isSuccessful: false, code: "TRANSITION_EXISTS" } );
    } );

    it ( "returns to a saved clean baseline through undo", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-light-switch.json" ) );
        const renamedState = execute ( initialState, {
            kind:             "rename_entity",
            entityKind:       "state",
            previousName:     "state_off",
            newName:          "state_dark",
            expectedRevision: initialState.documentRevision,
        } );
        const cleanState  = markDocumentEditorStateClean ( renamedState );
        const editedState = execute ( cleanState, {
            kind:         "update_entity",
            entityKind:   "state",
            previousName: "state_dark",
            entity:       { name: "state_dark", description: "A dark room" },
            expectedRevision: cleanState.documentRevision,
        } );
        const undoResult = undoDocumentCommand ( editedState );

        expect ( undoResult.isSuccessful ).toBe ( true );

        // Handle the case where undo result is successful is enabled.

        if ( undoResult.isSuccessful )
        {
            expect ( undoResult.state.draft ).toBe ( cleanState.draft );
            expect ( undoResult.state.dirty ).toBe ( false );
        }
    } );

    it ( "edits and reorders every Editor collection without bypassing revision checks", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );

        state = execute ( state, {
            kind: "move_entity", entityKind: "event", name: "event_start", direction: "down",
            expectedRevision: state.documentRevision,
        } );
        expect ( state.draft.stateMachine.events [ 1 ]?.name ).toBe ( "event_start" );

        const activeLogIndex = state.draft.stateMachine.stateActions.entry.findIndex ( mapping =>
            mapping.state === "state_active" && mapping.action === "action_log" );

        state = execute ( state, {
            kind: "update_state_action", actionKind: "entry", index: activeLogIndex,
            mapping: { state: "state_active", action: "action_finish" }, expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "move_state_action", actionKind: "entry", index: activeLogIndex,
            direction: "down", expectedRevision: state.documentRevision,
        } );

        // Calculate the moved mapping index value from the current inputs.

        const movedMappingIndex = activeLogIndex + 1;

        expect ( state.draft.stateMachine.stateActions.entry [ movedMappingIndex ] ).toEqual (
            { state: "state_active", action: "action_finish" },
        );
        state = execute ( state, {
            kind: "delete_state_action", actionKind: "entry", index: movedMappingIndex,
            expectedRevision: state.documentRevision,
        } );

        const firstTransition = state.draft.stateMachine.transitionTable [ 0 ];

        // Handle the case where first transition matches undefined.

        if ( firstTransition === undefined )
        {
            throw new Error ( "The comprehensive example must contain a transition." );
        }

        state = execute ( state, {
            kind: "update_transition", index: 0,
            transition: { ...firstTransition, stateNext: "state_complete" }, expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "move_transition", index: 0, direction: "down", expectedRevision: state.documentRevision,
        } );
        expect ( state.draft.stateMachine.transitionTable [ 1 ]?.stateNext ).toBe ( "state_complete" );
        state = execute ( state, {
            kind: "delete_transition", index: 1, expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.stateMachine.transitionTable ).toHaveLength ( 3 );
        expect ( state.validationSummary.isValid ).toBe ( true );
    } );
} );

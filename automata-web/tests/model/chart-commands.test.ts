// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    State Chart Command Tests
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies Chart geometry, visual indicators, semantic isolation, compound deletion, and history.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import
{
    createDocumentEditorState,
    executeDocumentCommand,
    planDocumentCommand,
    redoDocumentCommand,
    undoDocumentCommand,
} from "../../src/domain/model/commands.js";
import type { DocumentCommand, DocumentEditorState } from "../../src/domain/model/commands.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { MAXIMUM_CHART_DRAFT_TRANSITION_COUNT } from "../../src/domain/model/limits.js";

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

//--------------------------------------------------------------------------------------------------
// Function: createChartFixture
//
// Description:
//
//   Creates chart fixture for the test scenario.
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

function createChartFixture (): DocumentEditorState
{
    // Initialize the local values needed by this operation.

    let state = createDocumentEditorState ( createEmptyAuthoringDraft ( true ) );

    state = execute ( state, {
        kind: "add_entity", entityKind: "state", entity: { name: "state_idle", description: "Idle" },
        chartPlacement: { state: "state_idle", x: 100, y: 100 }, expectedRevision: state.documentRevision,
    } );
    state = execute ( state, {
        kind: "add_entity", entityKind: "state", entity: { name: "state_done", description: "Done" },
        chartPlacement: { state: "state_done", x: 300, y: 300 }, expectedRevision: state.documentRevision,
    } );
    state = execute ( state, {
        kind: "add_entity", entityKind: "event", entity: { name: "event_finish", description: "Finish" },
        expectedRevision: state.documentRevision,
    } );

    // Return the state.

    return state;
}

describe ( "Phase 5 State Chart commands", () =>
{
    it ( "adds semantic states and transitions with atomic Chart placements", () =>
    {
        // Initialize the local values needed by this operation.

        let chartState  = createDocumentEditorState ( createEmptyAuthoringDraft ( true ) );
        let editorState = createDocumentEditorState ( createEmptyAuthoringDraft ( true ) );

        chartState = execute ( chartState, {
            kind: "add_entity", entityKind: "state", entity: { name: "state_idle", description: "Idle" },
            chartPlacement: { state: "state_idle", x: 80, y: 60 }, expectedRevision: chartState.documentRevision,
        } );
        editorState = execute ( editorState, {
            kind: "add_entity", entityKind: "state", entity: { name: "state_idle", description: "Idle" },
            expectedRevision: editorState.documentRevision,
        } );
        chartState = execute ( chartState, {
            kind: "add_entity", entityKind: "state", entity: { name: "state_done", description: "Done" },
            expectedRevision: chartState.documentRevision,
        } );
        editorState = execute ( editorState, {
            kind: "add_entity", entityKind: "state", entity: { name: "state_done", description: "Done" },
            expectedRevision: editorState.documentRevision,
        } );
        chartState = execute ( chartState, {
            kind: "add_entity", entityKind: "event", entity: { name: "event_finish", description: "Finish" },
            expectedRevision: chartState.documentRevision,
        } );
        editorState = execute ( editorState, {
            kind: "add_entity", entityKind: "event", entity: { name: "event_finish", description: "Finish" },
            expectedRevision: editorState.documentRevision,
        } );
        chartState = execute ( chartState, {
            kind: "add_transition",
            transition: { state: "state_idle", event: "event_finish", stateNext: "state_done" },
            chartStatePlacements: [ { state: "state_done", x: 360, y: 240 } ],
            expectedRevision: chartState.documentRevision,
        } );
        editorState = execute ( editorState, {
            kind: "add_transition",
            transition: { state: "state_idle", event: "event_finish", stateNext: "state_done" },
            expectedRevision: editorState.documentRevision,
        } );

        expect ( chartState.draft.stateMachine ).toEqual ( editorState.draft.stateMachine );
        expect ( chartState.draft.chart.states ).toEqual ( [
            { state: "state_idle", x: 80, y: 60 },
            { state: "state_done", x: 360, y: 240 },
        ] );
    } );

    it ( "keeps an orphan initial indicator independent from the semantic initial state", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "set_chart_initial_indicator", indicator: { x: 20, y: 100 },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "set_initial_state", initialState: "state_idle", expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "set_chart_initial_indicator", indicator: null, expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.chart.indicators.initialStateIndicator ).toBeNull ();
        expect ( state.draft.stateMachine.initialState ).toBe ( "state_idle" );

        const undoResult = undoDocumentCommand ( state );

        expect ( undoResult.isSuccessful ).toBe ( true );

        // Handle the case where undo result is successful is enabled.

        if ( undoResult.isSuccessful )
        {
            expect ( undoResult.state.draft.chart.indicators.initialStateIndicator ).toEqual ( { x: 20, y: 100 } );
            expect ( undoResult.state.draft.stateMachine.initialState ).toBe ( "state_idle" );
        }
    } );

    it ( "sets and clears a connected initial indicator and semantic initial state atomically", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "set_chart_initial_indicator",
            indicator: { state: "state_idle", x: 20, y: 100 },
            expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.chart.indicators.initialStateIndicator ).toEqual (
            { state: "state_idle", x: 20, y: 100 },
        );
        expect ( state.draft.stateMachine.initialState ).toBe ( "state_idle" );

        state = execute ( state, {
            kind: "set_initial_state", initialState: "state_done", expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.chart.indicators.initialStateIndicator?.state ).toBe ( "state_done" );

        state = execute ( state, {
            kind: "set_chart_initial_indicator", indicator: null, expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.chart.indicators.initialStateIndicator ).toBeNull ();
        expect ( state.draft.stateMachine.initialState ).toBeNull ();
    } );

    it ( "associates multiple states with one visual final indicator without changing model semantics", () =>
    {
        // Initialize the local values needed by this operation.

        let state          = createChartFixture ();
        const stateMachine = state.draft.stateMachine;

        state = execute ( state, {
            kind: "add_chart_terminal_indicator", indicator: { id: 0, x: 500, y: 200 },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_chart_terminal_indicator", indicator: { id: 1, x: 500, y: 400 },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "connect_chart_terminal_indicator", state: "state_idle", indicatorId: 0,
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "connect_chart_terminal_indicator", state: "state_done", indicatorId: 0,
            expectedRevision: state.documentRevision,
        } );

        state = execute ( state, {
            kind: "connect_chart_terminal_indicator", state: "state_idle", indicatorId: 1,
            expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.stateMachine ).toBe ( stateMachine );
        expect ( state.draft.chart.indicators.terminalStateIndicators ).toHaveLength ( 2 );
        expect ( state.draft.chart.indicators.terminalStateTransitions ).toEqual (
            [
                { state: "state_done", terminalStateIndicatorId: 0 },
                { state: "state_idle", terminalStateIndicatorId: 1 },
            ],
        );
    } );

    it ( "places an indicator, relation, and displaced geometry as one undoable command", () =>
    {
        // Initialize the local values needed by this operation.

        let state           = createChartFixture ();
        const originalDraft = state.draft;

        state = execute ( state, {
            kind: "place_chart_indicator",
            initialState: "state_idle",
            initialStateIndicator: { state: "state_idle", x: 234, y: 40 },
            terminalStateIndicators: [],
            terminalStateTransitions: [],
            statePlacements:
            [
                { state: "state_idle", x: 100, y: 120, height: 62 },
                { state: "state_done", x: 300, y: 320, height: 62 },
            ],
            draftTransitions: [],
            expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.stateMachine.initialState ).toBe ( "state_idle" );
        expect ( state.draft.chart.indicators.initialStateIndicator ).toEqual (
            { state: "state_idle", x: 234, y: 40 },
        );
        expect ( state.draft.chart.states [ 0 ]?.y ).toBe ( 120 );

        const undoResult = undoDocumentCommand ( state );

        expect ( undoResult.isSuccessful ).toBe ( true );

        // Handle the case where undo result is successful is enabled.

        if ( undoResult.isSuccessful )
        {
            expect ( undoResult.state.draft ).toEqual ( originalDraft );
        }
    } );

    it ( "keeps visual final relations referentially closed across state rename and deletion", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "add_chart_terminal_indicator", indicator: { id: 0, x: 500, y: 200 },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "connect_chart_terminal_indicator", state: "state_idle", indicatorId: 0,
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "rename_entity", entityKind: "state", previousName: "state_idle", newName: "state_ready",
            expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.chart.indicators.terminalStateTransitions ).toEqual (
            [ { state: "state_ready", terminalStateIndicatorId: 0 } ],
        );

        const deletionPlan = planDocumentCommand ( state, {
            kind: "delete_entity", entityKind: "state", name: "state_ready",
            expectedRevision: state.documentRevision,
        } );

        expect ( deletionPlan.isSuccessful ).toBe ( true );

        // Handle the case where the deletion plan is successful condition is not satisfied.

        if ( !deletionPlan.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( deletionPlan.plan.impact.chartTerminalRelationCount ).toBe ( 1 );

        const executionResult = executeDocumentCommand ( state, deletionPlan.plan );

        expect ( executionResult.isSuccessful ).toBe ( true );

        // Handle the case where execution result is successful is enabled.

        if ( executionResult.isSuccessful )
        {
            expect ( executionResult.state.draft.chart.indicators.terminalStateTransitions ).toEqual ( [] );
            expect ( executionResult.state.draft.chart.indicators.terminalStateIndicators ).toHaveLength ( 1 );
        }
    } );

    it ( "replaces complete state and terminal-indicator geometry without changing semantic relations", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "add_chart_terminal_indicator", indicator: { id: 7, x: 500, y: 200 },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "connect_chart_terminal_indicator", state: "state_done", indicatorId: 7,
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_chart_draft_transition",
            draftTransition: { id: 12, source: { x: 40, y: 50 }, target: { x: 80, y: 90 } },
            expectedRevision: state.documentRevision,
        } );

        // Initialize the local values needed by this operation.

        const previousStateMachine = state.draft.stateMachine;
        const movedState           = execute ( state, {
            kind: "replace_chart_geometry",
            statePlacements:
            [
                { state: "state_idle", x: 200, y: 150 },
                { state: "state_done", x: 400, y: 350 },
            ],
            initialStateIndicator: null,
            terminalStateIndicators: [ { id: 7, x: 640, y: 420 } ],
            draftTransitions: [ { id: 12, source: { x: 140, y: 150 }, target: { x: 180, y: 190 } } ],
            expectedRevision: state.documentRevision,
        } );

        expect ( movedState.draft.stateMachine ).toBe ( previousStateMachine );
        expect ( movedState.draft.chart.states [ 0 ] ).toEqual ( { state: "state_idle", x: 200, y: 150 } );
        expect ( movedState.draft.chart.indicators.terminalStateIndicators ).toEqual ( [ { id: 7, x: 640, y: 420 } ] );
        expect ( movedState.draft.chart.indicators.terminalStateTransitions ).toEqual (
            [ { state: "state_done", terminalStateIndicatorId: 7 } ],
        );
        expect ( movedState.draft.chart.draftTransitions ).toEqual (
            [ { id: 12, source: { x: 140, y: 150 }, target: { x: 180, y: 190 } } ],
        );
        expect ( movedState.documentRevision ).toBe ( state.documentRevision + 1 );

        const incompleteGeometry = planDocumentCommand ( movedState, {
            kind: "replace_chart_geometry",
            statePlacements: movedState.draft.chart.states,
            initialStateIndicator: null,
            terminalStateIndicators: [],
            draftTransitions: movedState.draft.chart.draftTransitions,
            expectedRevision: movedState.documentRevision,
        } );

        expect ( incompleteGeometry ).toMatchObject ( { isSuccessful: false, code: "COMMAND_INVALID" } );

        const incompleteDraftGeometry = planDocumentCommand ( movedState, {
            kind: "replace_chart_geometry",
            statePlacements: movedState.draft.chart.states,
            initialStateIndicator: null,
            terminalStateIndicators: movedState.draft.chart.indicators.terminalStateIndicators,
            draftTransitions: [],
            expectedRevision: movedState.documentRevision,
        } );

        expect ( incompleteDraftGeometry ).toMatchObject ( { isSuccessful: false, code: "COMMAND_INVALID" } );
    } );

    it ( "atomically removes only orphan indicators and whole drafts during automatic layout", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "set_chart_initial_indicator",
            indicator: { x: 40, y: 30, state: null },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_chart_terminal_indicator", indicator: { id: 4, x: 500, y: 200 },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_chart_terminal_indicator", indicator: { id: 7, x: 600, y: 200 },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "connect_chart_terminal_indicator", state: "state_done", indicatorId: 7,
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_chart_draft_transition",
            draftTransition: { id: 12, source: { x: 40, y: 50 }, target: { x: 80, y: 90 } },
            expectedRevision: state.documentRevision,
        } );

        const cleaned = execute ( state, {
            kind: "replace_chart_geometry",
            deleteOrphanedItems: true,
            statePlacements: state.draft.chart.states,
            initialStateIndicator: null,
            terminalStateIndicators: [ { id: 7, x: 640, y: 420 } ],
            draftTransitions: [],
            expectedRevision: state.documentRevision,
        } );

        expect ( cleaned.draft.chart.indicators.initialStateIndicator ).toBeNull ();
        expect ( cleaned.draft.chart.indicators.terminalStateIndicators ).toEqual ( [ { id: 7, x: 640, y: 420 } ] );
        expect ( cleaned.draft.chart.indicators.terminalStateTransitions ).toEqual (
            [ { state: "state_done", terminalStateIndicatorId: 7 } ],
        );
        expect ( cleaned.draft.chart.draftTransitions ).toEqual ( [] );
        expect ( cleaned.documentRevision ).toBe ( state.documentRevision + 1 );
    } );

    it ( "deletes only a selected visual terminal relation and restores it through undo and redo", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "add_chart_terminal_indicator", indicator: { id: 4, x: 500, y: 300 },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "connect_chart_terminal_indicator", state: "state_done", indicatorId: 4,
            expectedRevision: state.documentRevision,
        } );

        const deletionPlan = planDocumentCommand ( state, {
            kind: "delete_chart_selection",
            stateNames: [],
            transitionKeys: [],
            terminalStateIndicatorIds: [],
            terminalStateRelationStates: [ "state_done" ],
            draftTransitionIds: [],
            clearInitialStateRelation: false,
            deleteInitialStateIndicator: false,
            expectedRevision: state.documentRevision,
        } );

        expect ( deletionPlan.isSuccessful ).toBe ( true );

        // Handle the case where the deletion plan is successful condition is not satisfied.

        if ( !deletionPlan.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( deletionPlan.plan.impact.chartTerminalIndicatorCount ).toBe ( 0 );
        expect ( deletionPlan.plan.impact.chartTerminalRelationCount ).toBe ( 1 );

        const executionResult = executeDocumentCommand ( state, deletionPlan.plan );

        expect ( executionResult.isSuccessful ).toBe ( true );

        // Handle the case where the execution result is successful condition is not satisfied.

        if ( !executionResult.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        state = executionResult.state;

        expect ( state.draft.stateMachine.states ).toHaveLength ( 2 );
        expect ( state.draft.chart.indicators.terminalStateIndicators ).toEqual ( [ { id: 4, x: 500, y: 300 } ] );
        expect ( state.draft.chart.indicators.terminalStateTransitions ).toEqual ( [] );

        const undoResult = undoDocumentCommand ( state );

        expect ( undoResult.isSuccessful ).toBe ( true );

        // Handle the case where the undo result is successful condition is not satisfied.

        if ( !undoResult.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( undoResult.state.draft.chart.indicators.terminalStateTransitions ).toEqual (
            [ { state: "state_done", terminalStateIndicatorId: 4 } ],
        );

        const redoResult = redoDocumentCommand ( undoResult.state );

        expect ( redoResult.isSuccessful ).toBe ( true );

        // Handle the case where redo result is successful is enabled.

        if ( redoResult.isSuccessful )
        {
            expect ( redoResult.state.draft.chart.indicators.terminalStateIndicators ).toHaveLength ( 1 );
            expect ( redoResult.state.draft.chart.indicators.terminalStateTransitions ).toEqual ( [] );
        }
    } );

    it ( "reports an unconnected visual terminal indicator in deletion impact", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "add_chart_terminal_indicator", indicator: { id: 9, x: 500, y: 300 },
            expectedRevision: state.documentRevision,
        } );

        const deletionPlan = planDocumentCommand ( state, {
            kind: "delete_chart_selection",
            stateNames: [],
            transitionKeys: [],
            terminalStateIndicatorIds: [ 9 ],
            terminalStateRelationStates: [],
            draftTransitionIds: [],
            clearInitialStateRelation: false,
            deleteInitialStateIndicator: false,
            expectedRevision: state.documentRevision,
        } );

        expect ( deletionPlan.isSuccessful ).toBe ( true );

        // Handle the case where deletion plan is successful is enabled.

        if ( deletionPlan.isSuccessful )
        {
            expect ( deletionPlan.plan.impact.chartTerminalIndicatorCount ).toBe ( 1 );
            expect ( deletionPlan.plan.impact.chartTerminalRelationCount ).toBe ( 0 );
        }
    } );

    it ( "deletes a mixed multi-selection atomically and restores it with one undo", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "add_transition",
            transition: { state: "state_idle", event: "event_finish", stateNext: "state_done" },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_chart_terminal_indicator", indicator: { id: 0, x: 500, y: 300 },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "connect_chart_terminal_indicator", state: "state_done", indicatorId: 0,
            expectedRevision: state.documentRevision,
        } );

        // Initialize the local values needed by this operation.

        const beforeDeletion = state.draft;
        const planResult     = planDocumentCommand ( state, {
            kind: "delete_chart_selection",
            stateNames: [ "state_idle" ],
            transitionKeys: [ { state: "state_idle", event: "event_finish" } ],
            terminalStateIndicatorIds: [ 0 ],
            terminalStateRelationStates: [],
            draftTransitionIds: [],
            clearInitialStateRelation: false,
            deleteInitialStateIndicator: false,
            expectedRevision: state.documentRevision,
        } );

        expect ( planResult.isSuccessful ).toBe ( true );

        // Handle the case where the plan result is successful condition is not satisfied.

        if ( !planResult.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( planResult.plan.impact.declarationCount ).toBe ( 1 );
        expect ( planResult.plan.impact.transitionCount ).toBe ( 1 );
        expect ( planResult.plan.impact.chartTerminalIndicatorCount ).toBe ( 1 );
        expect ( planResult.plan.impact.chartTerminalRelationCount ).toBe ( 1 );
        const executionResult = executeDocumentCommand ( state, planResult.plan );

        expect ( executionResult.isSuccessful ).toBe ( true );

        // Handle the case where the execution result is successful condition is not satisfied.

        if ( !executionResult.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        state = executionResult.state;

        expect ( state.draft.stateMachine.states.map ( item => item.name ) ).toEqual ( [ "state_done" ] );
        expect ( state.draft.stateMachine.transitionTable ).toEqual ( [] );
        expect ( state.draft.chart.indicators.terminalStateIndicators ).toEqual ( [] );
        expect ( state.draft.chart.indicators.terminalStateTransitions ).toEqual ( [] );

        const undoResult = undoDocumentCommand ( state );

        expect ( undoResult.isSuccessful ).toBe ( true );

        // Handle the case where undo result is successful is enabled.

        if ( undoResult.isSuccessful )
        {
            expect ( undoResult.state.draft ).toEqual ( beforeDeletion );
        }
    } );

    it ( "configures a Chart draft transition atomically and restores the draft through undo and redo", () =>
    {
        // Initialize the local values needed by this operation.

        let state           = createChartFixture ();
        const semanticModel = state.draft.stateMachine;

        state = execute ( state, {
            kind: "add_chart_draft_transition",
            draftTransition: { id: 5, source: { x: 10, y: 20 }, target: { x: 210, y: 220 } },
            expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.stateMachine ).toBe ( semanticModel );

        const draftBeforeConfiguration = state.draft;

        state = execute ( state, {
            kind: "configure_chart_draft_transition",
            draftTransitionId: 5,
            transition: { state: "state_idle", event: "event_finish", stateNext: "state_done" },
            chartStatePlacements: [ { state: "state_done", x: 420, y: 320 } ],
            expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.chart.draftTransitions ).toEqual ( [] );
        expect ( state.draft.stateMachine.transitionTable ).toEqual (
            [ { state: "state_idle", event: "event_finish", stateNext: "state_done" } ],
        );
        expect ( state.draft.chart.states ).toContainEqual ( { state: "state_done", x: 420, y: 320 } );

        const undoResult = undoDocumentCommand ( state );

        expect ( undoResult.isSuccessful ).toBe ( true );

        // Handle the case where the undo result is successful condition is not satisfied.

        if ( !undoResult.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( undoResult.state.draft ).toEqual ( draftBeforeConfiguration );

        const redoResult = redoDocumentCommand ( undoResult.state );

        expect ( redoResult.isSuccessful ).toBe ( true );

        // Handle the case where redo result is successful is enabled.

        if ( redoResult.isSuccessful )
        {
            expect ( redoResult.state.draft.chart.draftTransitions ).toEqual ( [] );
            expect ( redoResult.state.draft.stateMachine.transitionTable ).toHaveLength ( 1 );
        }
    } );

    it ( "leaves a Chart draft transition untouched when atomic configuration fails", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "add_chart_draft_transition",
            draftTransition: { id: 6, source: { x: 10, y: 20 }, target: { x: 210, y: 220 } },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_transition",
            transition: { state: "state_idle", event: "event_finish", stateNext: "state_done" },
            expectedRevision: state.documentRevision,
        } );

        // Initialize the local values needed by this operation.

        const beforeFailure = state.draft;
        const duplicatePlan = planDocumentCommand ( state, {
            kind: "configure_chart_draft_transition",
            draftTransitionId: 6,
            transition: { state: "state_idle", event: "event_finish", stateNext: "state_idle" },
            expectedRevision: state.documentRevision,
        } );

        expect ( duplicatePlan ).toMatchObject ( { isSuccessful: false, code: "TRANSITION_EXISTS" } );
        expect ( state.draft ).toBe ( beforeFailure );
        expect ( state.draft.chart.draftTransitions ).toHaveLength ( 1 );
    } );

    it ( "rejects new Chart draft transitions after the hard capacity is reached", () =>
    {
        // Initialize the local values needed by this operation.

        const fixture = createChartFixture ();
        const state   = createDocumentEditorState ( {
            ...fixture.draft,
            chart:
            {
                ...fixture.draft.chart,
                draftTransitions: Array.from (
                    { length: MAXIMUM_CHART_DRAFT_TRANSITION_COUNT },
                    ( _value, id ) => ( {
                        id,
                        source: { x: id, y: id },
                        target: { x: id + 1, y: id + 1 },
                    } ),
                ),
            },
        } );
        const planResult = planDocumentCommand ( state, {
            kind: "add_chart_draft_transition",
            draftTransition:
            {
                id: MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
                source: { x: 0, y: 0 },
                target: { x: 1, y: 1 },
            },
            expectedRevision: state.documentRevision,
        } );

        expect ( planResult ).toMatchObject ( { isSuccessful: false, code: "COMMAND_INVALID" } );
    } );

    it ( "deletes only selected Chart drafts and reports their deletion impact", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "add_chart_draft_transition",
            draftTransition: { id: 8, source: { x: 10, y: 20 }, target: { x: 210, y: 220 } },
            expectedRevision: state.documentRevision,
        } );

        const deletionPlan = planDocumentCommand ( state, {
            kind: "delete_chart_selection",
            stateNames: [],
            transitionKeys: [],
            terminalStateIndicatorIds: [],
            terminalStateRelationStates: [],
            draftTransitionIds: [ 8 ],
            clearInitialStateRelation: false,
            deleteInitialStateIndicator: false,
            expectedRevision: state.documentRevision,
        } );

        expect ( deletionPlan.isSuccessful ).toBe ( true );

        // Handle the case where the deletion plan is successful condition is not satisfied.

        if ( !deletionPlan.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( deletionPlan.plan.impact.chartDraftTransitionCount ).toBe ( 1 );

        const executionResult = executeDocumentCommand ( state, deletionPlan.plan );

        expect ( executionResult.isSuccessful ).toBe ( true );

        // Handle the case where execution result is successful is enabled.

        if ( executionResult.isSuccessful )
        {
            expect ( executionResult.state.draft.chart.draftTransitions ).toEqual ( [] );
            expect ( executionResult.state.draft.stateMachine ).toEqual ( state.draft.stateMachine );
        }
    } );

    it ( "reconnects both semantic transition endpoints atomically through update_transition", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "add_transition",
            transition: { state: "state_idle", event: "event_finish", stateNext: "state_done" },
            expectedRevision: state.documentRevision,
        } );

        const beforeReconnect = state.draft;

        state = execute ( state, {
            kind: "update_transition",
            index: 0,
            transition: { state: "state_done", event: "event_finish", stateNext: "state_idle" },
            expectedRevision: state.documentRevision,
        } );

        expect ( state.draft.stateMachine.transitionTable ).toEqual ( [ {
            state: "state_done", event: "event_finish", stateNext: "state_idle",
        } ] );

        // Initialize the local values needed by this operation.

        const reconnectedDraft = state.draft;
        const undoResult       = undoDocumentCommand ( state );

        expect ( undoResult.isSuccessful ).toBe ( true );

        // Handle the case where the undo result is successful condition is not satisfied.

        if ( !undoResult.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( undoResult.state.draft ).toEqual ( beforeReconnect );

        const redoResult = redoDocumentCommand ( undoResult.state );

        expect ( redoResult.isSuccessful ).toBe ( true );

        // Handle the case where redo result is successful is enabled.

        if ( redoResult.isSuccessful )
        {
            expect ( redoResult.state.draft ).toEqual ( reconnectedDraft );
        }
    } );

    it ( "rejects a source-endpoint re-key collision without changing either transition", () =>
    {
        // Initialize the local values needed by this operation.

        let state = createChartFixture ();

        state = execute ( state, {
            kind: "add_transition",
            transition: { state: "state_idle", event: "event_finish", stateNext: "state_done" },
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "add_transition",
            transition: { state: "state_done", event: "event_finish", stateNext: "state_idle" },
            expectedRevision: state.documentRevision,
        } );

        // Initialize the local values needed by this operation.

        const draftBeforeRejection = state.draft;
        const planResult           = planDocumentCommand ( state, {
            kind: "update_transition",
            index: 0,
            transition: { state: "state_done", event: "event_finish", stateNext: "state_done" },
            expectedRevision: state.documentRevision,
        } );

        expect ( planResult ).toMatchObject ( { isSuccessful: false, code: "TRANSITION_EXISTS" } );
        expect ( state.draft ).toBe ( draftBeforeRejection );
    } );

} );

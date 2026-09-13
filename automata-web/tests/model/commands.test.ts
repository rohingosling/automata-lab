// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Immutable Document Command Tests
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies atomic typed cascades, impact plans, revision checks, and complete undo and redo
//   restoration.
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
import type
{
    DocumentCommand,
    DocumentCommandPlan,
    DocumentEditorState,
} from "../../src/domain/model/commands.js";
import type { AuthoringDraft, SimulatorSequence, SolverSequence } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import
{
    MAXIMUM_ACTION_COUNT,
    MAXIMUM_ENTRY_ACTION_COUNT,
    MAXIMUM_EVENT_BUFFER_COUNT,
    MAXIMUM_EVENT_COUNT,
    MAXIMUM_EXIT_ACTION_COUNT,
    MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_TOKEN_COUNT,
    MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT,
    MAXIMUM_STATE_COUNT,
} from "../../src/domain/model/limits.js";
import { validateAuthoringDraft } from "../../src/domain/model/validation.js";
import { inferSolverCandidate } from "../../src/domain/solver/inference.js";
import { loadExampleDocument } from "./example-helpers.js";

//--------------------------------------------------------------------------------------------------
// Function: requirePlan
//
// Description:
//
//   Validates and returns the plan.
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

function requirePlan ( state: DocumentEditorState, command: DocumentCommand ): DocumentCommandPlan
{
    // Initialize the local values needed by this operation.

    const result = planDocumentCommand ( state, command );

    // Handle the case where the result is successful condition is not satisfied.

    if ( !result.isSuccessful )
    {
        throw new Error ( result.message );
    }

    // Return the computed result.

    return result.plan;
}

//--------------------------------------------------------------------------------------------------
// Function: requireExecution
//
// Description:
//
//   Validates and returns the execution.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - plan:
//     The plan supplied to the operation.
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

function requireExecution ( state: DocumentEditorState, plan: DocumentCommandPlan ): DocumentEditorState
{
    // Initialize the local values needed by this operation.

    const result = executeDocumentCommand ( state, plan );

    // Handle the case where the result is successful condition is not satisfied.

    if ( !result.isSuccessful )
    {
        throw new Error ( result.message );
    }

    // Return the computed result.

    return result.state;
}

//--------------------------------------------------------------------------------------------------
// Function: createPlannerState
//
// Description:
//
//   Creates planner state for the test scenario.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
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

function createPlannerState ( draft: AuthoringDraft ): DocumentEditorState
{
    // Initialize the local values needed by this operation.

    const emptyState = createDocumentEditorState ( createEmptyAuthoringDraft () );

    // Return the assembled result.

    return { ...emptyState, draft, cleanDraft: draft };
}

describe ( "immutable document commands", () =>
{
    it ( "renames every state reference atomically and remains valid", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const plan         = requirePlan (
            initialState,
            {
                kind:             "rename_entity",
                entityKind:       "state",
                previousName:     "state_active",
                newName:          "state_running",
                expectedRevision: 1,
            },
        );
        const renamedState         = requireExecution ( initialState, plan );
        const serializedReferences = JSON.stringify ( renamedState.draft );

        expect ( plan.impact.transitionCount ).toBeGreaterThan ( 0 );
        expect ( renamedState.documentRevision ).toBe ( 2 );
        expect ( renamedState.dirty ).toBe ( true );
        expect ( renamedState.validationSummary.isValid ).toBe ( true );
        expect ( serializedReferences ).toContain ( "state_running" );
        expect ( serializedReferences ).not.toContain ( "state_active" );
        expect ( validateAuthoringDraft ( renamedState.draft ).isValid ).toBe ( true );
    } );

    it ( "deletes the initial state and every dependent reference in one incomplete draft", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const plan         = requirePlan (
            initialState,
            {
                kind:             "delete_entity",
                entityKind:       "state",
                name:             "state_idle",
                expectedRevision: 1,
            },
        );
        const deletedState = requireExecution ( initialState, plan );

        expect ( plan.impact.initialStateReferenceCount ).toBe ( 1 );
        expect ( plan.impact.chartInitialIndicatorCount ).toBe ( 0 );
        expect ( deletedState.draft.stateMachine.initialState ).toBeNull ();
        expect ( deletedState.draft.chart.indicators.initialStateIndicator ).toEqual ( { x: 40, y: 120, state: null } );
        expect ( deletedState.validationSummary ).toMatchObject ( { isValid: false, errorCount: 1 } );
        expect ( JSON.stringify ( deletedState.draft.stateMachine ) ).not.toContain ( "state_idle" );
        expect ( validateAuthoringDraft ( deletedState.draft ).isValid ).toBe ( false );
    } );

    it ( "cascades action deletion and restores the exact command through undo and redo", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const plan         = requirePlan (
            initialState,
            {
                kind:             "delete_entity",
                entityKind:       "action",
                name:             "action_log",
                expectedRevision: 1,
            },
        );
        const deletedState = requireExecution ( initialState, plan );
        const undoResult   = undoDocumentCommand ( deletedState );

        expect ( plan.impact.actionMappingCount ).toBeGreaterThan ( 1 );
        expect ( undoResult.isSuccessful ).toBe ( true );

        // Handle the case where the undo result is successful condition is not satisfied.

        if ( !undoResult.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( undoResult.state.draft ).toEqual ( initialState.draft );
        expect ( undoResult.state.documentRevision ).toBe ( 3 );

        const redoResult = redoDocumentCommand ( undoResult.state );

        expect ( redoResult.isSuccessful ).toBe ( true );

        // Handle the case where redo result is successful is enabled.

        if ( redoResult.isSuccessful )
        {
            expect ( redoResult.state.draft ).toEqual ( deletedState.draft );
            expect ( redoResult.state.documentRevision ).toBe ( 4 );
        }
    } );

    it ( "rejects stale and duplicate rename commands without changing state", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const staleResult  = planDocumentCommand (
            initialState,
            {
                kind:             "delete_entity",
                entityKind:       "event",
                name:             "event_start",
                expectedRevision: 2,
            },
        );
        const duplicateResult = planDocumentCommand (
            initialState,
            {
                kind:             "rename_entity",
                entityKind:       "state",
                previousName:     "state_idle",
                newName:          "state_active",
                expectedRevision: 1,
            },
        );

        expect ( staleResult ).toMatchObject ( { isSuccessful: false, code: "REVISION_MISMATCH" } );
        expect ( duplicateResult ).toMatchObject ( { isSuccessful: false, code: "ENTITY_EXISTS" } );
        expect ( initialState.documentRevision ).toBe ( 1 );
        expect ( initialState.dirty ).toBe ( false );
        expect ( initialState.undoStack ).toEqual ( [] );
    } );

    it ( "applies a current Solver candidate as one undoable replacement while preserving libraries and settings", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const solverResult = inferSolverCandidate (
            {
                documentRevision: initialState.documentRevision,
                solverRevision: initialState.solverRevision,
                observations:
                [
                    {
                        name: "replacement",
                        startContext: "initial",
                        rawTokens: [ "state_new", "action_enter", "event_finish", "state_done" ],
                    },
                ],
            },
        );

        expect ( solverResult.status ).toBe ( "success" );

        // Handle the case where solver result status differs from "success".

        if ( solverResult.status !== "success" )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const plan = requirePlan (
            initialState,
            {
                kind: "apply_solver_candidate",
                candidate: solverResult.candidate,
                expectedRevision: initialState.documentRevision,
                expectedSolverRevision: initialState.solverRevision,
            },
        );
        const appliedState = requireExecution ( initialState, plan );

        expect ( appliedState.draft.settings ).toBe ( initialState.draft.settings );
        expect ( appliedState.draft.solver ).toBe ( initialState.draft.solver );
        expect ( appliedState.draft.simulator ).toBe ( initialState.draft.simulator );
        expect ( appliedState.draft.stateMachine ).toEqual ( solverResult.candidate.stateMachine );
        expect ( appliedState.draft.chart.settings ).toBe ( initialState.draft.chart.settings );
        expect ( appliedState.documentRevision ).toBe ( 2 );
        expect ( appliedState.solverRevision ).toBe ( 1 );
        expect ( appliedState.undoStack ).toHaveLength ( 1 );

        const undoResult = undoDocumentCommand ( appliedState );

        expect ( undoResult.isSuccessful ).toBe ( true );

        // Handle the case where undo result is successful is enabled.

        if ( undoResult.isSuccessful )
        {
            expect ( undoResult.state.draft ).toEqual ( initialState.draft );
        }
    } );

    it ( "applies a valid inferred candidate to an incomplete blank draft", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( createEmptyAuthoringDraft ( true ) );
        const solverResult = inferSolverCandidate (
            {
                documentRevision: initialState.documentRevision,
                solverRevision: initialState.solverRevision,
                observations:
                [
                    {
                        name: "state-free",
                        startContext: "infer",
                        rawTokens: [ "event begin", "action ready", "event-finish", "action_done" ],
                    },
                ],
            },
        );

        expect ( initialState.validationSummary.isValid ).toBe ( false );
        expect ( solverResult.status ).toBe ( "success" );

        // Handle the case where solver result status differs from "success".

        if ( solverResult.status !== "success" )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const plan = requirePlan (
            initialState,
            {
                kind: "apply_solver_candidate",
                candidate: solverResult.candidate,
                expectedRevision: initialState.documentRevision,
                expectedSolverRevision: initialState.solverRevision,
            },
        );
        const appliedState = requireExecution ( initialState, plan );

        expect ( appliedState.validationSummary.isValid ).toBe ( true );
        expect ( appliedState.draft.stateMachine.initialState ).toMatch ( /^state_/u );
        expect ( appliedState.draft.stateMachine.states.length ).toBeGreaterThan ( 0 );
    } );

    it ( "increments the Solver revision for sequence edits and rejects a now-stale candidate", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const solverResult = inferSolverCandidate (
            {
                documentRevision: initialState.documentRevision,
                solverRevision: initialState.solverRevision,
                observations: [],
            },
        );

        expect ( solverResult.status ).toBe ( "success" );

        // Handle the case where solver result status differs from "success".

        if ( solverResult.status !== "success" )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const editedSequences = [
            ...initialState.draft.solver.sequences,
            { name: "new-sequence", description: "", startContext: "infer" as const, sequence: [ "event_new" ] },
        ];
        const sequencePlan = requirePlan (
            initialState,
            {
                kind: "replace_solver_sequences",
                sequences: editedSequences,
                expectedRevision: initialState.documentRevision,
            },
        );
        const editedState = requireExecution ( initialState, sequencePlan );
        const staleResult = planDocumentCommand (
            editedState,
            {
                kind: "apply_solver_candidate",
                candidate: solverResult.candidate,
                expectedRevision: editedState.documentRevision,
                expectedSolverRevision: editedState.solverRevision,
            },
        );

        expect ( editedState.solverRevision ).toBe ( 2 );
        expect ( staleResult ).toMatchObject ( { isSuccessful: false, code: "SOLVER_CANDIDATE_STALE" } );
    } );

    it ( "accepts and rejects exact Solver library capacity boundaries atomically", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );

        //------------------------------------------------------------------------------------------
        // Function: createSequences
        //
        // Description:
        //
        //   Creates sequences for the test scenario.
        //
        // Parameters:
        //
        //   - sequenceCount:
        //     The sequence count supplied to the operation.
        //
        //   - tokenCount:
        //     The token count supplied to the operation.
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
        //------------------------------------------------------------------------------------------

        const createSequences = ( sequenceCount: number, tokenCount: number ): readonly SolverSequence[] =>
            Array.from ( { length: sequenceCount }, ( _value, index ) => ( {
                name:         `solver_sequence_${index}`,
                description:  "",
                startContext: "infer",
                sequence:     index === 0 ? Array.from ( { length: tokenCount }, () => "event_capacity" ) : [],
            } ) );
        const exactSequenceResult = planDocumentCommand (
            initialState,
            {
                kind:             "replace_solver_sequences",
                sequences:        createSequences ( MAXIMUM_SOLVER_SEQUENCE_COUNT, 0 ),
                expectedRevision: initialState.documentRevision,
            },
        );
        const exactTokenResult = planDocumentCommand (
            initialState,
            {
                kind:             "replace_solver_sequences",
                sequences:        createSequences ( 1, MAXIMUM_SOLVER_TOKEN_COUNT ),
                expectedRevision: initialState.documentRevision,
            },
        );
        const excessiveSequenceResult = planDocumentCommand (
            initialState,
            {
                kind:             "replace_solver_sequences",
                sequences:        createSequences ( MAXIMUM_SOLVER_SEQUENCE_COUNT + 1, 0 ),
                expectedRevision: initialState.documentRevision,
            },
        );
        const excessiveTokenResult = planDocumentCommand (
            initialState,
            {
                kind:             "replace_solver_sequences",
                sequences:        createSequences ( 1, MAXIMUM_SOLVER_TOKEN_COUNT + 1 ),
                expectedRevision: initialState.documentRevision,
            },
        );

        expect ( exactSequenceResult ).toMatchObject ( { isSuccessful: true } );
        expect ( exactTokenResult ).toMatchObject ( { isSuccessful: true } );
        expect ( excessiveSequenceResult ).toMatchObject ( {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      expect.stringContaining ( `${MAXIMUM_SOLVER_SEQUENCE_COUNT}` ),
        } );
        expect ( excessiveTokenResult ).toMatchObject ( {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      expect.stringContaining ( `${MAXIMUM_SOLVER_TOKEN_COUNT}` ),
        } );
    } );

    it.each (
        [
            { entityKind: "state" as const, propertyName: "states" as const, maximumCount: MAXIMUM_STATE_COUNT },
            { entityKind: "event" as const, propertyName: "events" as const, maximumCount: MAXIMUM_EVENT_COUNT },
            { entityKind: "action" as const, propertyName: "actions" as const, maximumCount: MAXIMUM_ACTION_COUNT },
        ],
    ) ( "guards the exact $entityKind declaration capacity before allocating N+1", (
        { entityKind, propertyName, maximumCount },
    ) =>
    {
        //------------------------------------------------------------------------------------------
        // Function: createState
        //
        // Description:
        //
        //   Creates state for the test scenario.
        //
        // Parameters:
        //
        //   - declarationCount:
        //     The declaration count supplied to the operation.
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
        //------------------------------------------------------------------------------------------

        const createState = ( declarationCount: number ): DocumentEditorState =>
        {
            // Initialize the local values needed by this operation.

            const draft        = createEmptyAuthoringDraft ();
            const declarations = Array.from ( { length: declarationCount }, ( _value, index ) => ( {
                name:        `${entityKind}_${index}`,
                description: "",
            } ) );
            const boundaryDraft: AuthoringDraft = {
                ...draft,
                stateMachine: { ...draft.stateMachine, [ propertyName ]: declarations },
            };

            // Return the create planner state result.

            return createPlannerState ( boundaryDraft );
        };
        const addCommand = {
            kind:             "add_entity" as const,
            entityKind,
            entity:           { name: `${entityKind}_boundary`, description: "" },
            expectedRevision: 1,
        };
        const exactResult     = planDocumentCommand ( createState ( maximumCount - 1 ), addCommand );
        const excessiveResult = planDocumentCommand ( createState ( maximumCount ), addCommand );

        expect ( exactResult ).toMatchObject ( { isSuccessful: true } );

        // Handle the case where exact result is successful is enabled.

        if ( exactResult.isSuccessful )
        {
            expect ( exactResult.plan.resultingDraft.stateMachine [ propertyName ] ).toHaveLength ( maximumCount );
        }

        expect ( excessiveResult ).toMatchObject ( {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      expect.stringContaining ( `${maximumCount}` ),
        } );
    } );

    it.each (
        [
            { actionKind: "entry" as const, maximumCount: MAXIMUM_ENTRY_ACTION_COUNT },
            { actionKind: "exit" as const, maximumCount: MAXIMUM_EXIT_ACTION_COUNT },
        ],
    ) ( "guards the exact $actionKind action-mapping capacity before allocating N+1", (
        { actionKind, maximumCount },
    ) =>
    {
        // Initialize the local values needed by this operation.

        const mapping = { state: "state_boundary", action: "action_boundary" };

        //------------------------------------------------------------------------------------------
        // Function: createState
        //
        // Description:
        //
        //   Creates state for the test scenario.
        //
        // Parameters:
        //
        //   - mappingCount:
        //     The mapping count supplied to the operation.
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
        //------------------------------------------------------------------------------------------

        const createState = ( mappingCount: number ): DocumentEditorState =>
        {
            // Initialize the local values needed by this operation.

            const draft                         = createEmptyAuthoringDraft ();
            const mappings                      = Array.from ( { length: mappingCount }, () => mapping );
            const boundaryDraft: AuthoringDraft = {
                ...draft,
                stateMachine:
                {
                    ...draft.stateMachine,
                    states:  [ { name: mapping.state, description: "" } ],
                    actions: [ { name: mapping.action, description: "" } ],
                    stateActions:
                    {
                        entry: actionKind === "entry" ? mappings : [],
                        exit:  actionKind === "exit" ? mappings : [],
                    },
                },
            };

            // Return the create planner state result.

            return createPlannerState ( boundaryDraft );
        };
        const addCommand = {
            kind:             "add_state_action" as const,
            actionKind,
            mapping,
            expectedRevision: 1,
        };
        const exactResult     = planDocumentCommand ( createState ( maximumCount - 1 ), addCommand );
        const excessiveResult = planDocumentCommand ( createState ( maximumCount ), addCommand );

        expect ( exactResult ).toMatchObject ( { isSuccessful: true } );

        // Handle the case where exact result is successful is enabled.

        if ( exactResult.isSuccessful )
        {
            expect ( exactResult.plan.resultingDraft.stateMachine.stateActions [ actionKind ] )
                .toHaveLength ( maximumCount );
        }

        expect ( excessiveResult ).toMatchObject ( {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      expect.stringContaining ( `${maximumCount}` ),
        } );
    } );

    it ( "accepts an exact-length saved Solver token and rejects one Unicode code point above it", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const exactToken   = `action_${"x".repeat ( MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT - "action_".length )}`;

        //------------------------------------------------------------------------------------------
        // Function: createSequences
        //
        // Description:
        //
        //   Creates sequences for the test scenario.
        //
        // Parameters:
        //
        //   - token:
        //     The token supplied to the operation.
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
        //------------------------------------------------------------------------------------------

        const createSequences = ( token: string ): readonly SolverSequence[] => [ {
            name: "token-boundary",
            description: "",
            startContext: "infer",
            sequence: [ token ],
        } ];
        const exactResult = planDocumentCommand (
            initialState,
            {
                kind:             "replace_solver_sequences",
                sequences:        createSequences ( exactToken ),
                expectedRevision: initialState.documentRevision,
            },
        );
        const excessiveResult = planDocumentCommand (
            initialState,
            {
                kind:             "replace_solver_sequences",
                sequences:        createSequences ( `${exactToken}x` ),
                expectedRevision: initialState.documentRevision,
            },
        );

        expect ( exactResult ).toMatchObject ( { isSuccessful: true } );
        expect ( excessiveResult ).toMatchObject ( {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      expect.stringContaining ( `${MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT}` ),
        } );
    } );
} );

describe ( "Simulator sequence commands", () =>
{
    // Initialize the local values needed by this operation.

    const SEQUENCE = { description: "happy path", name: "sequence_1", sequence: [ "event_go" ] };

    //----------------------------------------------------------------------------------------------
    // Function: createSimulatorSequences
    //
    // Description:
    //
    //   Creates simulator sequences for the test scenario.
    //
    // Parameters:
    //
    //   - sequenceCount:
    //     The sequence count supplied to the operation.
    //
    //   - firstSequenceEventCount:
    //     The first sequence event count supplied to the operation.
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

    function createSimulatorSequences (
        sequenceCount: number,
        firstSequenceEventCount = 0,
    ): readonly SimulatorSequence[]
    {
        // Return the generated collection.

        return Array.from ( { length: sequenceCount }, ( _value, index ) => ( {
            name:        `simulator_sequence_${index}`,
            description: "",
            sequence:    index === 0
                ? Array.from ( { length: firstSequenceEventCount }, () => "event_capacity" )
                : [],
        } ) );
    }

    it ( "replaces the sequence library as one revisioned command", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const plan         = requirePlan (
            initialState,
            {
                kind: "replace_simulator_sequences",
                sequences: [ SEQUENCE ],
                expectedRevision: initialState.documentRevision,
            },
        );
        const nextState = requireExecution ( initialState, plan );

        expect ( nextState.draft.simulator.sequences ).toEqual ( [ SEQUENCE ] );
        expect ( nextState.documentRevision ).toBe ( initialState.documentRevision + 1 );
    } );

    it ( "rejects an unchanged library rather than inventing a revision", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const result       = planDocumentCommand (
            initialState,
            {
                kind: "replace_simulator_sequences",
                sequences: initialState.draft.simulator.sequences,
                expectedRevision: initialState.documentRevision,
            },
        );

        expect ( result ).toMatchObject ( { isSuccessful: false, code: "COMMAND_INVALID" } );
    } );

    it ( "plans a replacement at both exact persisted capacity boundaries", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const sequences    = createSimulatorSequences (
            MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
            MAXIMUM_EVENT_BUFFER_COUNT,
        );
        const result = planDocumentCommand (
            initialState,
            {
                kind: "replace_simulator_sequences",
                sequences,
                expectedRevision: initialState.documentRevision,
            },
        );

        expect ( result ).toMatchObject ( { isSuccessful: true } );
    } );

    it ( "rejects a replacement one persisted sequence above capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const result       = planDocumentCommand (
            initialState,
            {
                kind: "replace_simulator_sequences",
                sequences: createSimulatorSequences ( MAXIMUM_SIMULATOR_SEQUENCE_COUNT + 1 ),
                expectedRevision: initialState.documentRevision,
            },
        );

        expect ( result ).toMatchObject ( {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      expect.stringContaining ( `${MAXIMUM_SIMULATOR_SEQUENCE_COUNT}` ),
        } );
    } );

    it ( "rejects a replacement with one event above persisted Run-buffer capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const result       = planDocumentCommand (
            initialState,
            {
                kind: "replace_simulator_sequences",
                sequences: createSimulatorSequences ( 1, MAXIMUM_EVENT_BUFFER_COUNT + 1 ),
                expectedRevision: initialState.documentRevision,
            },
        );

        expect ( result ).toMatchObject ( {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      expect.stringContaining ( `${MAXIMUM_EVENT_BUFFER_COUNT}` ),
        } );
    } );

    it ( "rejects a stale expected revision", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const result       = planDocumentCommand (
            initialState,
            {
                kind: "replace_simulator_sequences",
                sequences: [ SEQUENCE ],
                expectedRevision: initialState.documentRevision + 7,
            },
        );

        expect ( result ).toMatchObject ( { isSuccessful: false } );
    } );

    it ( "leaves the semantic model untouched", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const plan         = requirePlan (
            initialState,
            {
                kind: "replace_simulator_sequences",
                sequences: [ SEQUENCE ],
                expectedRevision: initialState.documentRevision,
            },
        );
        const nextState = requireExecution ( initialState, plan );

        expect ( nextState.draft.stateMachine ).toEqual ( initialState.draft.stateMachine );
        expect ( nextState.draft.chart ).toEqual ( initialState.draft.chart );
        expect ( nextState.draft.solver ).toEqual ( initialState.draft.solver );
    } );

    it ( "accepts undeclared event names in a saved sequence", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( loadExampleDocument ( "state-machine-comprehensive.json" ) );
        const plan         = requirePlan (
            initialState,
            {
                kind: "replace_simulator_sequences",
                sequences: [ { description: "", name: "negative", sequence: [ "not_a_declared_event" ] } ],
                expectedRevision: initialState.documentRevision,
            },
        );
        const nextState = requireExecution ( initialState, plan );

        expect ( validateAuthoringDraft ( nextState.draft ).isValid ).toBe ( true );
    } );
} );

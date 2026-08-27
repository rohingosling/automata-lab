// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Semantic Validation Tests
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies valid-document promotion, reference checks, determinism, draft incompleteness, and
//   advisory warnings.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";
import type { AuthoringDraft, SimulatorSequence } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import
{
    MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
    MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
    MAXIMUM_CHART_TERMINAL_RELATION_COUNT,
    MAXIMUM_EVENT_BUFFER_COUNT,
    MAXIMUM_NAME_CODE_POINT_COUNT,
    MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT,
    MAXIMUM_STATE_COUNT,
} from "../../src/domain/model/limits.js";
import
{
    validateAuthoringDraft,
    validatePersistableAuthoringDraft,
} from "../../src/domain/model/validation.js";
import { loadExampleDocument } from "./example-helpers.js";

//--------------------------------------------------------------------------------------------------
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
//--------------------------------------------------------------------------------------------------

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

describe ( "semantic document validation", () =>
{
    it ( "promotes an error-free draft to a valid document", () =>
    {
        // Initialize the local values needed by this operation.

        const document = loadExampleDocument ( "state-machine-comprehensive.json" );
        const result   = validateAuthoringDraft ( document );

        expect ( result.isValid ).toBe ( true );
    } );

    it ( "keeps an incomplete authoring draft distinct from a valid document", () =>
    {
        // Initialize the local values needed by this operation.

        const document              = loadExampleDocument ( "state-machine-comprehensive.json" );
        const draft: AuthoringDraft = 
        {
            ...document,
            stateMachine: { ...document.stateMachine, initialState: null },
        };
        const result = validateAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( false );
        expect ( result.diagnostics.some ( ( diagnostic ) => diagnostic.code === "INITIAL_STATE_REQUIRED" ) ).toBe ( true );
    } );

    it ( "treats missing states and an initial state as persistable authoring warnings", () =>
    {
        // Initialize the local values needed by this operation.

        const result = validatePersistableAuthoringDraft ( createEmptyAuthoringDraft ( true ) );

        expect ( result ).toMatchObject (
            {
                isValid: true,
                diagnostics:
                [
                    { code: "INITIAL_STATE_UNDEFINED", severity: "warning" },
                    { code: "STATE_DEFINITIONS_MISSING", severity: "warning" },
                ],
            },
        );
    } );

    it ( "keeps integrity errors blocking and sorts them before incomplete-authoring warnings", () =>
    {
        // Initialize the local values needed by this operation.

        const document              = loadExampleDocument ( "state-machine-comprehensive.json" );
        const draft: AuthoringDraft = 
        {
            ...document,
            settings: { ...document.settings, version: "invalid" },
            stateMachine: { ...document.stateMachine, initialState: null },
            chart:
            {
                ...document.chart,
                indicators:
                {
                    ...document.chart.indicators,
                    initialStateIndicator: document.chart.indicators.initialStateIndicator === null
                        ? null
                        : { ...document.chart.indicators.initialStateIndicator, state: null },
                },
            },
        };
        const result = validatePersistableAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( false );
        expect ( result.diagnostics ).toEqual (
            expect.arrayContaining (
                [
                    expect.objectContaining ( { code: "MODEL_VERSION_INVALID", severity: "error" } ),
                    expect.objectContaining ( { code: "INITIAL_STATE_UNDEFINED", severity: "warning" } ),
                ],
            ),
        );

        const firstWarningIndex = result.diagnostics.findIndex ( diagnostic => diagnostic.severity === "warning" );

        expect ( firstWarningIndex ).toBeGreaterThanOrEqual ( 0 );
        expect ( result.diagnostics.slice ( firstWarningIndex ).every ( diagnostic => diagnostic.severity === "warning" ) )
            .toBe ( true );
    } );

    it ( "reports duplicate transition keys and dangling typed references", () =>
    {
        // Initialize the local values needed by this operation.

        const document        = loadExampleDocument ( "state-machine-comprehensive.json" );
        const firstTransition = document.stateMachine.transitionTable [ 0 ];

        // Handle the case where first transition matches undefined.

        if ( firstTransition === undefined )
        {
            throw new Error ( "The comprehensive fixture requires a transition." );
        }

        // Initialize the local values needed by this operation.

        const draft: AuthoringDraft =
        {
            ...document,
            stateMachine:
            {
                ...document.stateMachine,
                stateActions:
                {
                    ...document.stateMachine.stateActions,
                    entry:
                    [
                        ...document.stateMachine.stateActions.entry,
                        { state: "state_missing", action: "action_log" },
                    ],
                },
                transitionTable: [ ...document.stateMachine.transitionTable, firstTransition ],
            },
        };
        const result = validateAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( false );
        expect ( result.diagnostics.map ( ( diagnostic ) => diagnostic.code ) ).toEqual (
            expect.arrayContaining ( [ "ACTION_MAPPING_STATE_UNKNOWN", "DUPLICATE_TRANSITION_KEY" ] ),
        );
    } );

    it ( "validates visual final-indicator relations without adding model acceptance semantics", () =>
    {
        // Initialize the local values needed by this operation.

        const document                   = loadExampleDocument ( "state-machine-comprehensive.json" );
        const validDraft: AuthoringDraft = 
        {
            ...document,
            chart:
            {
                ...document.chart,
                indicators:
                {
                    ...document.chart.indicators,
                    terminalStateIndicators:
                    [
                        { id: 0, x: 640, y: 120 },
                        { id: 1, x: 640, y: 260 },
                    ],
                    terminalStateTransitions:
                    [
                        { state: "state_complete", terminalStateIndicatorId: 0 },
                        { state: "state_active", terminalStateIndicatorId: 0 },
                    ],
                },
            },
        };
        const validResult   = validateAuthoringDraft ( validDraft );
        const invalidResult = validateAuthoringDraft (
            {
                ...validDraft,
                chart:
                {
                    ...validDraft.chart,
                    indicators:
                    {
                        ...validDraft.chart.indicators,
                        terminalStateTransitions:
                        [
                            ...validDraft.chart.indicators.terminalStateTransitions,
                            { state: "state_missing", terminalStateIndicatorId: 99 },
                        ],
                    },
                },
            },
        );

        expect ( validResult.isValid ).toBe ( true );
        expect ( invalidResult.isValid ).toBe ( false );
        expect ( invalidResult.diagnostics.map ( diagnostic => diagnostic.code ) ).toEqual (
            expect.arrayContaining (
                [ "CHART_TERMINAL_RELATION_STATE_UNKNOWN", "CHART_TERMINAL_INDICATOR_UNKNOWN" ],
            ),
        );
    } );

    it ( "enforces the visual final-indicator hard capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const document              = loadExampleDocument ( "state-machine-comprehensive.json" );
        const draft: AuthoringDraft = 
        {
            ...document,
            chart:
            {
                ...document.chart,
                indicators:
                {
                    ...document.chart.indicators,
                    terminalStateIndicators: Array.from (
                        { length: MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT + 1 },
                        ( _value, id ) => ( { id, x: id, y: id } ),
                    ),
                },
            },
        };
        const result = validateAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( false );
        expect ( result.diagnostics ).toEqual (
            expect.arrayContaining ( [ expect.objectContaining ( {
                code: "CAPACITY_EXCEEDED",
                path: "/chart/indicators/terminal_state_indicators",
            } ) ] ),
        );
    } );

    it ( "enforces the Chart state-placement hard capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const document  = loadExampleDocument ( "state-machine-comprehensive.json" );
        const placement = document.chart.states [ 0 ];

        // Handle the case where placement matches undefined.

        if ( placement === undefined )
        {
            throw new Error ( "The comprehensive fixture has no Chart state placement." );
        }

        // Initialize the local values needed by this operation.

        const draft: AuthoringDraft =
        {
            ...document,
            chart:
            {
                ...document.chart,
                states: Array.from ( { length: MAXIMUM_STATE_COUNT + 1 }, () => placement ),
            },
        };
        const result = validateAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( false );
        expect ( result.diagnostics ).toEqual ( expect.arrayContaining ( [ expect.objectContaining ( {
            code: "CAPACITY_EXCEEDED",
            path: "/chart/states",
        } ) ] ) );
    } );

    it ( "accepts persisted Simulator libraries at both exact capacity boundaries", () =>
    {
        // Initialize the local values needed by this operation.

        const document              = loadExampleDocument ( "state-machine-comprehensive.json" );
        const draft: AuthoringDraft = {
            ...document,
            simulator:
            {
                sequences: createSimulatorSequences (
                    MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
                    MAXIMUM_EVENT_BUFFER_COUNT,
                ),
            },
        };
        const result = validateAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( true );
    } );

    it ( "rejects a persisted Simulator library one sequence above capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const document              = loadExampleDocument ( "state-machine-comprehensive.json" );
        const draft: AuthoringDraft = {
            ...document,
            simulator: { sequences: createSimulatorSequences ( MAXIMUM_SIMULATOR_SEQUENCE_COUNT + 1 ) },
        };
        const result = validateAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( false );
        expect ( result.diagnostics ).toEqual ( expect.arrayContaining ( [ expect.objectContaining ( {
            code: "CAPACITY_EXCEEDED",
            path: "/simulator/sequences",
        } ) ] ) );
    } );

    it ( "rejects a persisted Simulator sequence one event above Run-buffer capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const document              = loadExampleDocument ( "state-machine-comprehensive.json" );
        const draft: AuthoringDraft = {
            ...document,
            simulator: { sequences: createSimulatorSequences ( 1, MAXIMUM_EVENT_BUFFER_COUNT + 1 ) },
        };
        const result = validateAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( false );
        expect ( result.diagnostics ).toEqual ( expect.arrayContaining ( [ expect.objectContaining ( {
            code: "CAPACITY_EXCEEDED",
            path: "/simulator/sequences/0/sequence",
        } ) ] ) );
    } );

    it ( "enforces the visual final-indicator relation hard capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const document    = loadExampleDocument ( "state-machine-comprehensive.json" );
        const sourceState = document.stateMachine.states [ 0 ]?.name;
        const indicatorId = document.chart.indicators.terminalStateIndicators [ 0 ]?.id;

        // Handle the case where at least one branch condition is satisfied.

        if ( sourceState === undefined || indicatorId === undefined )
        {
            throw new Error ( "The comprehensive fixture requires a state and a visual final indicator." );
        }

        // Initialize the local values needed by this operation.

        const draft: AuthoringDraft =
        {
            ...document,
            chart:
            {
                ...document.chart,
                indicators:
                {
                    ...document.chart.indicators,
                    terminalStateTransitions: Array.from (
                        { length: MAXIMUM_CHART_TERMINAL_RELATION_COUNT + 1 },
                        () => ( { state: sourceState, terminalStateIndicatorId: indicatorId } ),
                    ),
                },
            },
        };
        const result = validateAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( false );
        expect ( result.diagnostics ).toEqual (
            expect.arrayContaining ( [ expect.objectContaining ( {
                code: "CAPACITY_EXCEEDED",
                path: "/chart/indicators/terminal_state_transitions",
            } ) ] ),
        );
    } );

    it ( "validates Chart draft-transition identifiers, endpoints, and hard capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const document              = loadExampleDocument ( "state-machine-comprehensive.json" );
        const draft: AuthoringDraft = 
        {
            ...document,
            chart:
            {
                ...document.chart,
                draftTransitions:
                [
                    { id: 4, source: { x: 10, y: 20 }, target: { x: 30, y: 40 } },
                    { id: 4, source: { x: Number.POSITIVE_INFINITY, y: 50 }, target: { x: 60, y: 70 } },
                    { id: Number.MAX_SAFE_INTEGER + 1, source: { x: 80, y: 90 }, target: { x: 100, y: 110 } },
                    ...Array.from (
                        { length: MAXIMUM_CHART_DRAFT_TRANSITION_COUNT - 2 },
                        ( _value, index ) => ( {
                            id:     index + 10,
                            source: { x: index, y: index },
                            target: { x: index + 1, y: index + 1 },
                        } ),
                    ),
                ],
            },
        };
        const result = validateAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( false );
        expect ( result.diagnostics ).toEqual ( expect.arrayContaining (
            [
                expect.objectContaining ( { code: "CAPACITY_EXCEEDED", path: "/chart/draft_transitions" } ),
                expect.objectContaining ( { code: "CHART_COORDINATE_INVALID" } ),
                expect.objectContaining ( { code: "CHART_DRAFT_TRANSITION_ID_DUPLICATE" } ),
                expect.objectContaining ( { code: "CHART_DRAFT_TRANSITION_ID_INVALID" } ),
            ],
        ) );
    } );

    it ( "accepts an exact-length saved Solver token and rejects raw or canonical text above the name bound", () =>
    {
        // Initialize the local values needed by this operation.

        const document   = loadExampleDocument ( "state-machine-comprehensive.json" );
        const exactToken = `action_${"😀".repeat (
            MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT - [ ..."action_" ].length,
        )}`;
        const compactCanonicalOverflow = `Action${"x".repeat (
            MAXIMUM_NAME_CODE_POINT_COUNT - [ ..."Action" ].length,
        )}`;

        //------------------------------------------------------------------------------------------
        // Function: validateToken
        //
        // Description:
        //
        //   Validates token.
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

        const validateToken = ( token: string ) => validateAuthoringDraft ( {
            ...document,
            solver:
            {
                sequences:
                [
                    {
                        name:         "token-boundary",
                        description:  "",
                        startContext: "infer",
                        sequence:     [ token ],
                    },
                ],
            },
        } );
        const exactResult             = validateToken ( exactToken );
        const excessiveResult         = validateToken ( `${exactToken}😀` );
        const canonicalOverflowResult = validateToken ( compactCanonicalOverflow );

        expect ( exactResult.isValid ).toBe ( true );
        expect ( excessiveResult ).toMatchObject ( {
            isValid: false,
            diagnostics: [ expect.objectContaining ( { code: "SOLVER_TOKEN_TOO_LONG" } ) ],
        } );
        expect ( canonicalOverflowResult.isValid ).toBe ( false );
        expect ( canonicalOverflowResult.diagnostics ).toEqual ( expect.arrayContaining ( [
            expect.objectContaining ( { code: "SOLVER_TOKEN_TOO_LONG" } ),
        ] ) );
        expect ( excessiveResult.diagnostics.map ( diagnostic => diagnostic.message ).join ( " " ) )
            .not.toContain ( exactToken );
    } );

    it ( "reports unreachable states and unused declarations as non-blocking warnings", () =>
    {
        // Initialize the local values needed by this operation.

        const document              = loadExampleDocument ( "state-machine-comprehensive.json" );
        const draft: AuthoringDraft = 
        {
            ...document,
            stateMachine:
            {
                ...document.stateMachine,
                events:
                [
                    ...document.stateMachine.events,
                    { name: "event_unused", description: "Unused event." },
                ],
                states:
                [
                    ...document.stateMachine.states,
                    { name: "state_isolated", description: "Disconnected state." },
                ],
                actions:
                [
                    ...document.stateMachine.actions,
                    { name: "action_unused", description: "Unused action." },
                ],
            },
        };
        const result = validateAuthoringDraft ( draft );

        expect ( result.isValid ).toBe ( true );
        expect ( result.diagnostics.map ( ( diagnostic ) => diagnostic.code ) ).toEqual (
            expect.arrayContaining ( [ "UNREACHABLE_STATE", "UNUSED_ACTION", "UNUSED_EVENT" ] ),
        );
        expect ( result.diagnostics.every ( ( diagnostic ) => diagnostic.severity === "warning" ) ).toBe ( true );
    } );
} );

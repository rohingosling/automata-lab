// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Constrained State-Merging Solver Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies hard constraints, partial candidates, deterministic output, provenance, replay, and
//   no-evidence behavior.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import { MAXIMUM_SOLVER_TOKEN_COUNT } from "../../src/domain/model/limits.js";
import
{
    inferSolverCandidate,
    normalizeSolverObservations,
    replaySolverObservation,
    serializeCanonicalSolverCandidate,
} from "../../src/domain/solver/index.js";
import type
{
    SolverInferenceRequest,
    SolverObservationInput,
} from "../../src/domain/solver/index.js";
import { loadExampleDocument } from "../model/example-helpers.js";

const OBSERVATIONS: readonly SolverObservationInput[] =
[
    {
        name: "main",
        startContext: "initial",
        rawTokens:
        [
            "state_idle",
            "action_ready",
            "event_go",
            "action_working",
            "state_active",
            "event_finish",
            "state_done",
            "action_complete",
        ],
    },
    {
        name: "reset-fragment",
        startContext: "continuation",
        rawTokens:
        [
            "action_working",
            "state_active",
            "event_reset",
            "action_ready",
            "state_idle",
        ],
    },
    {
        name: "hidden-fragment",
        startContext: "infer",
        rawTokens: [ "action_waiting", "event_go", "action_working", "state_active" ],
    },
];

//--------------------------------------------------------------------------------------------------
// Function: createRequest
//
// Description:
//
//   Creates request for the test scenario.
//
// Parameters:
//
//   - observations:
//     The observations supplied to the operation.
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

function createRequest ( observations: readonly SolverObservationInput[] = OBSERVATIONS ): SolverInferenceRequest
{
    // Return the assembled result.

    return {
        documentRevision: 7,
        solverRevision: 3,
        observations,
    };
}

describe ( "constrained state-merging solver", () =>
{
    it ( "produces a partial immutable candidate and replays every hard observation", () =>
    {
        // Initialize the local values needed by this operation.

        const result = inferSolverCandidate ( createRequest () );

        expect ( result.status ).toBe ( "success" );

        // Handle the case where result status differs from "success".

        if ( result.status !== "success" )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const candidate      = result.candidate;
        const transitionKeys = candidate.stateMachine.transitionTable.map ( transition =>
            `${transition.state}\u0000${transition.event}` );

        expect ( candidate.baselineDocumentRevision ).toBe ( 7 );
        expect ( candidate.baselineSolverRevision ).toBe ( 3 );
        expect ( candidate.stateMachine.initialState ).toBe ( "state_idle" );
        expect ( candidate.stateMachine.stateActions.exit ).toEqual ( [] );
        expect ( candidate.chart.draftTransitions ).toEqual ( [] );
        expect ( candidate.chart.indicators.terminalStateIndicators ).toEqual ( [] );
        expect ( candidate.chart.indicators.terminalStateTransitions ).toEqual ( [] );
        expect ( new Set ( transitionKeys ).size ).toBe ( transitionKeys.length );
        expect ( candidate.stateMachine.transitionTable.some ( transition =>
            transition.state === "state_done" ) ).toBe ( false );
        expect ( candidate.provenance.generatedStateNames.length ).toBeGreaterThan ( 0 );
        expect ( candidate.provenance.states.every ( state => state.evidence === "observed" || state.evidence === "inferred" ) )
            .toBe ( true );
        expect ( candidate.traceCoverage.every ( coverage => coverage.isSuccessful ) ).toBe ( true );
        expect ( candidate.consistencyStatement ).toContain ( "not asserted" );
        expect ( Object.isFrozen ( candidate ) ).toBe ( true );
        expect ( Object.isFrozen ( candidate.stateMachine.transitionTable ) ).toBe ( true );

        const normalization = normalizeSolverObservations ( OBSERVATIONS );

        expect ( normalization.isSuccessful ).toBe ( true );

        // Handle the case where normalization is successful is enabled.

        if ( normalization.isSuccessful )
        {
            // Process each observation from the normalization observations collection in order.

            for ( const observation of normalization.observations )
            {
                expect ( replaySolverObservation ( candidate, observation ).isSuccessful ).toBe ( true );
            }
        }
    } );

    it ( "leaves every unobserved state/event pair undefined", () =>
    {
        // Initialize the local values needed by this operation.

        const result = inferSolverCandidate ( createRequest () );

        expect ( result.status ).toBe ( "success" );

        // Handle the case where result status matches "success".

        if ( result.status === "success" )
        {
            // Initialize the local values needed by this operation.

            const observedEvents = new Set ( OBSERVATIONS.flatMap ( observation => observation.rawTokens )
                .filter ( token => token.startsWith ( "event_" ) ) );

            expect ( result.candidate.stateMachine.events.map ( event => event.name ).sort () ).toEqual (
                [ ...observedEvents ].sort (),
            );
            expect ( result.candidate.stateMachine.transitionTable.length ).toBeLessThan (
                result.candidate.stateMachine.states.length * result.candidate.stateMachine.events.length,
            );
            expect ( serializeCanonicalSolverCandidate ( result.candidate ) ).not.toContain ( "Finalize" );
            expect ( serializeCanonicalSolverCandidate ( result.candidate ) ).not.toContain ( "invalid" );
        }
    } );

    it ( "is byte deterministic when cosmetic observation order changes", () =>
    {
        // Initialize the local values needed by this operation.

        const forward = inferSolverCandidate ( createRequest () );
        const reverse = inferSolverCandidate ( createRequest ( [ ...OBSERVATIONS ].reverse () ) );

        expect ( forward.status ).toBe ( "success" );
        expect ( reverse.status ).toBe ( "success" );

        // Handle the case where all required conditions are satisfied.

        if ( forward.status === "success" && reverse.status === "success" )
        {
            expect ( serializeCanonicalSolverCandidate ( forward.candidate ) ).toBe (
                serializeCanonicalSolverCandidate ( reverse.candidate ),
            );
        }
    } );

    it ( "returns trace-specific diagnostics and no candidate for forced deterministic conflicts", () =>
    {
        // Initialize the local values needed by this operation.

        const result = inferSolverCandidate ( createRequest (
            [
                {
                    name: "left",
                    startContext: "initial",
                    rawTokens: [ "state_root", "event_go", "state_left", "action_left" ],
                },
                {
                    name: "right",
                    startContext: "initial",
                    rawTokens: [ "state_root", "event_go", "state_right", "action_right" ],
                },
            ],
        ) );

        expect ( result.status ).toBe ( "failure" );

        // Handle the case where result status matches "failure".

        if ( result.status === "failure" )
        {
            expect ( result.diagnostics.map ( diagnostic => diagnostic.code ) ).toContain ( "DETERMINISM_CONFLICT" );
            expect ( result.diagnostics.flatMap ( diagnostic => diagnostic.relatedLocations )
                .map ( location => location.sequenceName ) ).toEqual ( expect.arrayContaining ( [ "left", "right" ] ) );
            expect ( "candidate" in result ).toBe ( false );
        }
    } );

    it ( "creates a disclosed one-state candidate for zero observations", () =>
    {
        // Initialize the local values needed by this operation.

        const result = inferSolverCandidate ( createRequest ( [] ) );

        expect ( result.status ).toBe ( "success" );

        // Handle the case where result status matches "success".

        if ( result.status === "success" )
        {
            expect ( result.candidate.stateMachine.states ).toEqual (
                [ { name: "state_generated_0001", description: "" } ],
            );
            expect ( result.candidate.stateMachine.transitionTable ).toEqual ( [] );
            expect ( result.candidate.inferenceReport.map ( entry => entry.code ) ).toContain ( "NO_OBSERVATIONS" );
            expect ( result.diagnostics.map ( diagnostic => diagnostic.code ) ).toEqual ( [ "NO_OBSERVATIONS" ] );
        }
    } );

    it ( "rejects input beyond the Solver token capacity before inference", () =>
    {
        // Calculate the result value from the current inputs.

        const result = inferSolverCandidate ( createRequest (
            [
                {
                    name:         "over-capacity",
                    startContext: "infer",
                    rawTokens:    new Array<string> ( MAXIMUM_SOLVER_TOKEN_COUNT + 1 ).fill ( "action_repeated" ),
                },
            ],
        ) );

        expect ( result ).toMatchObject (
            { status: "failure", diagnostics: [ { code: "CAPACITY_EXCEEDED" } ] },
        );
    } );

    it ( "reconstructs the maintained Solver-candidate example from its saved evidence", () =>
    {
        // Initialize the local values needed by this operation.

        const example = loadExampleDocument ( "state-machine-solver-candidate.json" );
        const result  = inferSolverCandidate (
            {
                documentRevision: 0,
                solverRevision: 0,
                observations: example.solver.sequences.map ( sequence => ( {
                    name:         sequence.name,
                    startContext: sequence.startContext,
                    rawTokens:    sequence.sequence,
                } ) ),
            },
        );

        expect ( result.status ).toBe ( "success" );

        // Handle the case where result status matches "success".

        if ( result.status === "success" )
        {
            expect ( result.candidate.stateMachine.initialState ).toBe ( example.stateMachine.initialState );
            expect ( result.candidate.stateMachine.states.map ( state => state.name ).sort () ).toEqual (
                example.stateMachine.states.map ( state => state.name ).sort (),
            );
            expect ( result.candidate.stateMachine.events.map ( event => event.name ).sort () ).toEqual (
                example.stateMachine.events.map ( event => event.name ).sort (),
            );
            expect ( result.candidate.stateMachine.actions.map ( action => action.name ).sort () ).toEqual (
                example.stateMachine.actions.map ( action => action.name ).sort (),
            );
            expect ( result.candidate.stateMachine.stateActions ).toEqual ( example.stateMachine.stateActions );
            expect ( result.candidate.stateMachine.transitionTable ).toEqual ( example.stateMachine.transitionTable );
            expect ( result.candidate.traceCoverage.every ( trace => trace.isSuccessful ) ).toBe ( true );
        }
    } );

    it ( "completes repeated-event state-free evidence without stalling", () =>
    {
        // Initialize the local values needed by this operation.

        const result = inferSolverCandidate ( createRequest (
            [
                {
                    name: "reported-sequence",
                    startContext: "infer",
                    rawTokens:
                    [
                        "event-start",
                        "event-next",
                        "action-left",
                        "event-next",
                        "event-next",
                        "event-next",
                        "action-right",
                        "event-next",
                        "action-left",
                        "event-stop",
                    ],
                },
            ],
        ) );

        expect ( result.status ).toBe ( "success" );

        // Handle the case where result status matches "success".

        if ( result.status === "success" )
        {
            expect ( result.candidate.traceCoverage ).toMatchObject ( [ { isSuccessful: true } ] );
            expect ( result.candidate.statistics.inputTokenCount ).toBe ( 10 );
        }
    }, 1_000 );
} );

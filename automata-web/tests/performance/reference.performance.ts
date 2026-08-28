// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Routing Performance Reference Harness
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Records deterministic warmup and repeated-sample P95 evidence for the reference authoring,
//   Simulator, and Solver CPU paths. Browser rendering, Worker scheduling, and message-transfer
//   latency remain outside this neutral harness.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cpus, release as operatingSystemRelease, totalmem as totalMemory } from "node:os";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import type { AutomataDocument } from "../../src/domain/model/contracts.js";
import
{
    createDocumentEditorState,
    executeDocumentCommand,
    planDocumentCommand,
} from "../../src/domain/model/commands.js";
import { compileDocument, resetRuntimeSession, stepRuntimeSession } from "../../src/domain/runtime/runtime.js";
import type { SolverInferenceRequest } from "../../src/domain/solver/contracts.js";
import { inferSolverCandidate } from "../../src/domain/solver/inference.js";

const REFERENCE_STATE_COUNT            = 200;
const REFERENCE_EVENT_COUNT            = 100;
const REFERENCE_ACTION_COUNT           = 100;
const REFERENCE_TRANSITION_COUNT       = 10_000;
const REFERENCE_ENTRY_ASSIGNMENT_COUNT = 2_500;
const REFERENCE_EXIT_ASSIGNMENT_COUNT  = 2_500;
const SOLVER_OBSERVATION_COUNT         = 1_000;
const SOLVER_TOKENS_PER_OBSERVATION    = 50;
const SOLVER_SOURCE_ACTION_COUNT       = 23;
const SOLVER_DESTINATION_ACTION_COUNT  = 24;
const EDITOR_WARMUP_COUNT              = 5;
const EDITOR_SAMPLE_COUNT              = 50;
const SIMULATOR_WARMUP_COUNT           = 100;
const SIMULATOR_SAMPLE_COUNT           = 1_000;
const SOLVER_WARMUP_COUNT              = 2;
const SOLVER_SAMPLE_COUNT              = 10;

const EDITOR_THRESHOLD_MILLISECONDS    = 100;
const SIMULATOR_THRESHOLD_MILLISECONDS = 50;
const SOLVER_THRESHOLD_MILLISECONDS    = 2_000;

//--------------------------------------------------------------------------------------------------
// Interface: BenchmarkMeasurement
//
// Description:
//
//   Defines the structure of benchmark measurement.
//
//--------------------------------------------------------------------------------------------------

interface BenchmarkMeasurement
{
    readonly name:                         string;
    readonly warmupCount:                  number;
    readonly sampleCount:                  number;
    readonly percentile95Milliseconds:     number;
    readonly thresholdMilliseconds:        number;
    readonly samplesMilliseconds:          readonly number[];
}

//--------------------------------------------------------------------------------------------------
// Function: stateName
//
// Description:
//
//   Derives the state name.
//
// Parameters:
//
//   - stateIndex:
//     The state index supplied to the operation.
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

function stateName ( stateIndex: number ): string
{
    // Return the computed result.

    return `state_${stateIndex.toString ().padStart ( 3, "0" )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: eventName
//
// Description:
//
//   Derives the event name.
//
// Parameters:
//
//   - eventIndex:
//     The event index supplied to the operation.
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

function eventName ( eventIndex: number ): string
{
    // Return the computed result.

    return `event_${eventIndex.toString ().padStart ( 3, "0" )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: actionName
//
// Description:
//
//   Derives the action name.
//
// Parameters:
//
//   - actionIndex:
//     The action index supplied to the operation.
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

function actionName ( actionIndex: number ): string
{
    // Return the computed result.

    return `action_${actionIndex.toString ().padStart ( 3, "0" )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: createReferenceDocument
//
// Description:
//
//   Creates reference document for the test scenario.
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

function createReferenceDocument (): AutomataDocument
{
    // Initialize the local values needed by this operation.

    const states = Array.from ( { length: REFERENCE_STATE_COUNT }, ( _, stateIndex ) =>
        ( { name: stateName ( stateIndex ), description: `Reference state ${stateIndex}.` } ) );
    const events = Array.from ( { length: REFERENCE_EVENT_COUNT }, ( _, eventIndex ) =>
        ( { name: eventName ( eventIndex ), description: `Reference event ${eventIndex}.` } ) );
    const actions = Array.from ( { length: REFERENCE_ACTION_COUNT }, ( _, actionIndex ) =>
        ( { name: actionName ( actionIndex ), description: `Reference action ${actionIndex}.` } ) );
    const transitionTable = Array.from ( { length: REFERENCE_TRANSITION_COUNT }, ( _, transitionIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const sourceStateIndex = Math.floor ( transitionIndex / REFERENCE_EVENT_COUNT );
        const eventIndex       = transitionIndex % REFERENCE_EVENT_COUNT;
        const targetStateIndex = ( sourceStateIndex + eventIndex + 1 ) % REFERENCE_STATE_COUNT;

        // Return the assembled result.

        return {
            state:     stateName ( sourceStateIndex ),
            event:     eventName ( eventIndex ),
            stateNext: stateName ( targetStateIndex ),
        };
    } );

    //----------------------------------------------------------------------------------------------
    // Function: createActionAssignments
    //
    // Description:
    //
    //   Creates action assignments for the test scenario.
    //
    // Parameters:
    //
    //   - assignmentCount:
    //     The assignment count supplied to the operation.
    //
    //   - actionOffset:
    //     The action offset supplied to the operation.
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

    const createActionAssignments = ( assignmentCount: number, actionOffset: number ) =>
        Array.from ( { length: assignmentCount }, ( _, assignmentIndex ) =>
        {
            // Initialize the local values needed by this operation.

            const stateIndex  = assignmentIndex % REFERENCE_STATE_COUNT;
            const actionIndex = ( Math.floor ( assignmentIndex / REFERENCE_STATE_COUNT ) + actionOffset ) %
                REFERENCE_ACTION_COUNT;

            // Return the assembled result.

            return { state: stateName ( stateIndex ), action: actionName ( actionIndex ) };
        } );

    // Return the assembled result.

    return {
        settings:
        {
            name:        "Phase 9 reference model",
            description: "Deterministic reference-capacity performance fixture.",
            version:     "1.0.0",
        },
        stateMachine:
        {
            initialState: stateName ( 0 ),
            states,
            events,
            actions,
            stateActions:
            {
                entry: createActionAssignments ( REFERENCE_ENTRY_ASSIGNMENT_COUNT, 0 ),
                exit:  createActionAssignments ( REFERENCE_EXIT_ASSIGNMENT_COUNT, REFERENCE_ACTION_COUNT / 2 ),
            },
            transitionTable,
        },
        chart:
        {
            settings: { expandStates: false },
            indicators:
            {
                initialStateIndicator:    { state: stateName ( 0 ), x: -32, y: 0 },
                terminalStateIndicators:  [],
                terminalStateTransitions: [],
            },
            states: Array.from ( { length: REFERENCE_STATE_COUNT }, ( _, stateIndex ) =>
                ( {
                    state: stateName ( stateIndex ),
                    x:     ( stateIndex % 20 ) * 160,
                    y:     Math.floor ( stateIndex / 20 ) * 96,
                } ) ),
            draftTransitions: [],
        },
        solver:    { sequences: [] },
        simulator: { sequences: [] },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createSolverRequest
//
// Description:
//
//   Creates solver request for the test scenario.
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

function createSolverRequest (): SolverInferenceRequest
{
    // Initialize the local values needed by this operation.

    const rawTokens = [
        "state_reference_source",
        ...Array.from ( { length: SOLVER_SOURCE_ACTION_COUNT }, () => "action_source" ),
        "event_advance",
        "state_reference_destination",
        ...Array.from ( { length: SOLVER_DESTINATION_ACTION_COUNT }, () => "action_destination" ),
    ];

    // Handle the case where raw tokens length differs from solver tokens per observation.

    if ( rawTokens.length !== SOLVER_TOKENS_PER_OBSERVATION )
    {
        throw new Error (
            `Reference Solver observation contains ${rawTokens.length} tokens instead of ` +
            `${SOLVER_TOKENS_PER_OBSERVATION}.`,
        );
    }

    // Return the assembled result.

    return {
        documentRevision: 1,
        solverRevision:   1,
        observations: Array.from ( { length: SOLVER_OBSERVATION_COUNT }, ( _, observationIndex ) =>
            ( {
                name:         `observation_${observationIndex.toString ().padStart ( 4, "0" )}`,
                startContext: observationIndex === 0 ? "initial" : "continuation",
                rawTokens,
            } ) ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: percentile95
//
// Description:
//
//   Derives the percentile95.
//
// Parameters:
//
//   - samplesMilliseconds:
//     The samples milliseconds supplied to the operation.
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

function percentile95 ( samplesMilliseconds: readonly number[] ): number
{
    // Initialize the local values needed by this operation.

    const sortedSamples = [ ...samplesMilliseconds ].sort ( ( left, right ) => left - right );
    const sampleIndex   = Math.max ( 0, Math.ceil ( sortedSamples.length * 0.95 ) - 1 );
    const percentile    = sortedSamples [ sampleIndex ];

    // Handle the case where percentile matches undefined.

    if ( percentile === undefined )
    {
        throw new Error ( "A performance measurement requires at least one sample." );
    }

    // Return the percentile.

    return percentile;
}

//--------------------------------------------------------------------------------------------------
// Function: measureOperation
//
// Description:
//
//   Calculates operation.
//
// Parameters:
//
//   - name:
//     The name supplied to the operation.
//
//   - warmupCount:
//     The warmup count supplied to the operation.
//
//   - sampleCount:
//     The sample count supplied to the operation.
//
//   - thresholdMilliseconds:
//     The threshold milliseconds supplied to the operation.
//
//   - operation:
//     The operation supplied to the operation.
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

function measureOperation (
    name: string,
    warmupCount: number,
    sampleCount: number,
    thresholdMilliseconds: number,
    operation: () => number,
): BenchmarkMeasurement
{
    // Initialize the local values needed by this operation.

    let checksum = 0;

    // Repeat the operation across the bounded iteration range.

    for ( let warmupIndex = 0; warmupIndex < warmupCount; warmupIndex++ )
    {
        checksum += operation ();
    }

    const samplesMilliseconds: number[] = [];

    // Repeat the operation across the bounded iteration range.

    for ( let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++ )
    {
        // Initialize the local values needed by this operation.

        const startMilliseconds = performance.now ();
        const operationResult   = operation ();
        const endMilliseconds   = performance.now ();

        checksum += operationResult;
        samplesMilliseconds.push ( endMilliseconds - startMilliseconds );
    }

    // Handle the case where the is finite result condition is not satisfied.

    if ( !Number.isFinite ( checksum ) )
    {
        throw new Error ( `Performance operation '${name}' produced a non-finite checksum.` );
    }

    // Return the assembled result.

    return {
        name,
        warmupCount,
        sampleCount,
        percentile95Milliseconds: percentile95 ( samplesMilliseconds ),
        thresholdMilliseconds,
        samplesMilliseconds,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: summarizeMeasurement
//
// Description:
//
//   Derives the summarize measurement.
//
// Parameters:
//
//   - measurement:
//     The measurement supplied to the operation.
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

function summarizeMeasurement ( measurement: BenchmarkMeasurement )
{
    // Initialize the local values needed by this operation.

    const sortedSamples = [ ...measurement.samplesMilliseconds ].sort ( ( left, right ) => left - right );
    const minimum       = sortedSamples [ 0 ];
    const median        = sortedSamples [ Math.floor ( sortedSamples.length / 2 ) ];
    const maximum       = sortedSamples [ sortedSamples.length - 1 ];

    // Handle the case where at least one branch condition is satisfied.

    if ( minimum === undefined || median === undefined || maximum === undefined )
    {
        throw new Error ( `Performance measurement '${measurement.name}' contains no samples.` );
    }

    // Return the assembled result.

    return {
        name:                       measurement.name,
        warmupCount:                measurement.warmupCount,
        sampleCount:                measurement.sampleCount,
        minimumMilliseconds:        Number ( minimum.toFixed ( 3 ) ),
        medianMilliseconds:         Number ( median.toFixed ( 3 ) ),
        percentile95Milliseconds: Number ( measurement.percentile95Milliseconds.toFixed ( 3 ) ),
        maximumMilliseconds:        Number ( maximum.toFixed ( 3 ) ),
        thresholdMilliseconds:      measurement.thresholdMilliseconds,
    };
}

describe ( "Phase 9 reference performance", () =>
{
    it ( "records warmup and repeated-sample P95 evidence for AL-PER-001 through AL-PER-003", () =>
    {
        // Initialize the local values needed by this operation.

        const referenceDocument    = createReferenceDocument ();
        const referenceEditorState = createDocumentEditorState ( referenceDocument );

        expect ( referenceEditorState.validationSummary.isValid ).toBe ( true );
        expect ( referenceDocument.stateMachine.states ).toHaveLength ( REFERENCE_STATE_COUNT );
        expect ( referenceDocument.stateMachine.events ).toHaveLength ( REFERENCE_EVENT_COUNT );
        expect ( referenceDocument.stateMachine.transitionTable ).toHaveLength ( REFERENCE_TRANSITION_COUNT );
        expect ( referenceDocument.stateMachine.stateActions.entry.length +
            referenceDocument.stateMachine.stateActions.exit.length ).toBe (
            REFERENCE_ENTRY_ASSIGNMENT_COUNT + REFERENCE_EXIT_ASSIGNMENT_COUNT,
        );

        // Initialize the local values needed by this operation.

        const editorStateDerivation = measureOperation (
            "editor-state-derivation",
            EDITOR_WARMUP_COUNT,
            EDITOR_SAMPLE_COUNT,
            EDITOR_THRESHOLD_MILLISECONDS,
            () =>
            {
                // Initialize the local values needed by this operation.

                const editorState = createDocumentEditorState ( referenceDocument );

                // Return the computed result.

                return editorState.documentRevision + editorState.validationSummary.diagnostics.length;
            },
        );
        const authoringCommand = measureOperation (
            "accepted-authoring-command",
            EDITOR_WARMUP_COUNT,
            EDITOR_SAMPLE_COUNT,
            EDITOR_THRESHOLD_MILLISECONDS,
            () =>
            {
                // Calculate the plan result value from the current inputs.

                const planResult = planDocumentCommand (
                    referenceEditorState,
                    {
                        kind:             "update_entity",
                        entityKind:       "state",
                        previousName:     stateName ( REFERENCE_STATE_COUNT - 1 ),
                        entity:
                        {
                            name:        stateName ( REFERENCE_STATE_COUNT - 1 ),
                            description: "Reference state updated by the performance command.",
                        },
                        expectedRevision: referenceEditorState.documentRevision,
                    },
                );

                // Handle the case where the plan result is successful condition is not satisfied.

                if ( !planResult.isSuccessful )
                {
                    throw new Error ( `Reference authoring command planning failed: ${planResult.message}` );
                }

                const executionResult = executeDocumentCommand ( referenceEditorState, planResult.plan );

                // Handle the case where the execution result is successful condition is not
                // satisfied.

                if ( !executionResult.isSuccessful )
                {
                    throw new Error ( `Reference authoring command execution failed: ${executionResult.message}` );
                }

                // Return the computed result.

                return executionResult.state.documentRevision + executionResult.state.validationSummary.diagnostics.length;
            },
        );
        const compiledModel  = compileDocument ( referenceDocument );
        const runtimeSession = resetRuntimeSession ( compiledModel );
        const simulatorEvent = measureOperation (
            "single-simulator-event",
            SIMULATOR_WARMUP_COUNT,
            SIMULATOR_SAMPLE_COUNT,
            SIMULATOR_THRESHOLD_MILLISECONDS,
            () =>
            {
                // Initialize the local values needed by this operation.

                const operationResult = stepRuntimeSession (
                    compiledModel,
                    runtimeSession,
                    [ eventName ( 0 ) ],
                );

                // Return the computed result.

                return operationResult.consumedEventCount + operationResult.emittedActions.length;
            },
        );
        const solverRequest     = createSolverRequest ();
        const correctnessResult = inferSolverCandidate ( solverRequest );

        expect ( correctnessResult.status ).toBe ( "success" );

        // Handle the case where correctness result status differs from "success".

        if ( correctnessResult.status !== "success" )
        {
            throw new Error ( `Reference Solver request failed: ${correctnessResult.diagnostics [ 0 ]?.message ?? "unknown"}` );
        }

        expect ( correctnessResult.candidate.statistics ).toMatchObject (
            {
                observationCount:   SOLVER_OBSERVATION_COUNT,
                inputTokenCount:    SOLVER_OBSERVATION_COUNT * SOLVER_TOKENS_PER_OBSERVATION,
                evidenceStateCount: SOLVER_OBSERVATION_COUNT * 2,
                candidateStateCount: 2,
                transitionCount:    1,
            },
        );

        // Initialize the local values needed by this operation.

        const solverInference = measureOperation (
            "solver-inference",
            SOLVER_WARMUP_COUNT,
            SOLVER_SAMPLE_COUNT,
            SOLVER_THRESHOLD_MILLISECONDS,
            () =>
            {
                // Initialize the local values needed by this operation.

                const inferenceResult = inferSolverCandidate ( solverRequest );

                // Handle the case where inference result status differs from "success".

                if ( inferenceResult.status !== "success" )
                {
                    throw new Error ( `Reference Solver inference failed: ${inferenceResult.diagnostics [ 0 ]?.message ?? "unknown"}` );
                }

                // Return the computed result.

                return inferenceResult.candidate.statistics.inputTokenCount +
                    inferenceResult.candidate.statistics.candidateStateCount;
            },
        );
        const measurements         = [ editorStateDerivation, authoringCommand, simulatorEvent, solverInference ];
        const processorDescription = cpus () [ 0 ]?.model ?? "unknown";
        const evidence             = 
        {
            environment:
            {
                node:                   process.version,
                v8:                     process.versions.v8,
                platform:               process.platform,
                operatingSystemRelease: operatingSystemRelease (),
                architecture:           process.arch,
                processor:              processorDescription.trim (),
                logicalProcessors:      cpus ().length,
                totalMemoryBytes:       totalMemory (),
            },
            referenceModel:
            {
                stateCount:            REFERENCE_STATE_COUNT,
                eventCount:            REFERENCE_EVENT_COUNT,
                actionCount:           REFERENCE_ACTION_COUNT,
                transitionCount:       REFERENCE_TRANSITION_COUNT,
                actionAssignmentCount: REFERENCE_ENTRY_ASSIGNMENT_COUNT + REFERENCE_EXIT_ASSIGNMENT_COUNT,
            },
            solverInput:
            {
                observationCount:         SOLVER_OBSERVATION_COUNT,
                tokenCount:               SOLVER_OBSERVATION_COUNT * SOLVER_TOKENS_PER_OBSERVATION,
                evidenceStateCount:       correctnessResult.candidate.statistics.evidenceStateCount,
                evidenceTransitionCount:  SOLVER_OBSERVATION_COUNT,
                candidateTransitionCount: correctnessResult.candidate.statistics.transitionCount,
            },
            measurements: measurements.map ( summarizeMeasurement ),
        };

        process.stdout.write ( `\nPHASE_9_PERFORMANCE_EVIDENCE ${JSON.stringify ( evidence )}\n` );

        // Process each measurement from the measurements collection in order.

        for ( const measurement of measurements )
        {
            expect ( measurement.percentile95Milliseconds, measurement.name )
                .toBeLessThanOrEqual ( measurement.thresholdMilliseconds );
        }
    } );
} );

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    File Codec Contract Tests
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies strict lexical rejection, schema/version dispatch, semantic loading, and canonical
//   round trips.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { serializeCanonicalDocument } from "../../src/domain/model/canonicalization.js";
import type { AutomataDocument, SimulatorSequence } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import
{
    MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
    MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
    MAXIMUM_CHART_TERMINAL_RELATION_COUNT,
    MAXIMUM_EVENT_BUFFER_COUNT,
    MAXIMUM_FILE_BYTE_COUNT,
    MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_TOKEN_COUNT,
    MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT,
    MAXIMUM_STATE_COUNT,
} from "../../src/domain/model/limits.js";
import { openAuthoringDocument, openAutomataDocument } from "../../src/infrastructure/files/file-codec.js";
import { FILE_SCHEMA_V1 } from "../../src/infrastructure/files/schema-v1.js";
import { EXAMPLE_FILE_NAMES, readExampleText } from "./example-helpers.js";

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

describe ( "Automata Lab file codec", () =>
{
    it.each ( EXAMPLE_FILE_NAMES ) ( "loads and canonically round-trips %s", ( fileName ) =>
    {
        // Initialize the local values needed by this operation.

        const firstOpen = openAutomataDocument ( readExampleText ( fileName ) );

        expect ( firstOpen.isSuccessful ).toBe ( true );

        // Handle the case where the first open is successful condition is not satisfied.

        if ( !firstOpen.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const firstSerialization = serializeCanonicalDocument ( firstOpen.document );
        const secondOpen         = openAutomataDocument ( firstSerialization.text );

        expect ( secondOpen.isSuccessful ).toBe ( true );

        // Handle the case where the second open is successful condition is not satisfied.

        if ( !secondOpen.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        const secondSerialization = serializeCanonicalDocument ( secondOpen.document );

        expect ( secondOpen.document ).toEqual ( firstOpen.document );
        expect ( secondSerialization.text ).toBe ( firstSerialization.text );
        expect ( firstSerialization.text.endsWith ( "\n" ) ).toBe ( true );
        expect ( firstSerialization.text.endsWith ( "\n\n" ) ).toBe ( false );
    } );

    it ( "opens and canonically round-trips an authoring file with no initial state", () =>
    {
        // Initialize the local values needed by this operation.

        const source = JSON.parse ( readExampleText ( "state-machine-light-switch.json" ) ) as {
            chart: { indicators: { initial_state_indicator: null | { state?: string | null } } };
            state_machine: { initial_state: string | null };
        };

        source.state_machine.initial_state = null;

        // Handle the case where initial state indicator differs from an absent value.

        if ( source.chart.indicators.initial_state_indicator !== null )
        {
            source.chart.indicators.initial_state_indicator.state = null;
        }

        // Initialize the local values needed by this operation.

        const sourceText      = JSON.stringify ( source );
        const strictResult    = openAutomataDocument ( sourceText );
        const authoringResult = openAuthoringDocument ( sourceText );

        expect ( strictResult ).toMatchObject (
            { isSuccessful: false, diagnostics: [ { code: "INITIAL_STATE_REQUIRED", severity: "error" } ] },
        );
        expect ( authoringResult ).toMatchObject (
            { isSuccessful: true, diagnostics: [ { code: "INITIAL_STATE_UNDEFINED", severity: "warning" } ] },
        );

        // Handle the case where authoring result is successful is enabled.

        if ( authoringResult.isSuccessful )
        {
            // Initialize the local values needed by this operation.

            const canonicalText = serializeCanonicalDocument ( authoringResult.document ).text;

            expect ( JSON.parse ( canonicalText ).state_machine.initial_state ).toBeNull ();
            expect ( openAuthoringDocument ( canonicalText ) ).toMatchObject (
                { isSuccessful: true, document: { stateMachine: { initialState: null } } },
            );
        }
    } );

    it ( "opens and canonically round-trips a metadata-only authoring project", () =>
    {
        // Initialize the local values needed by this operation.

        const draft      = createEmptyAuthoringDraft ( true );
        const sourceText = serializeCanonicalDocument (
            {
                ...draft,
                settings: { name: "Metadata Only", description: "Work in progress", version: "1.2.3" },
            },
        ).text;
        const strictResult    = openAutomataDocument ( sourceText );
        const authoringResult = openAuthoringDocument ( sourceText );

        expect ( strictResult ).toMatchObject ( { isSuccessful: false } );
        expect ( strictResult.diagnostics.map ( diagnostic => diagnostic.code ) ).toEqual (
            [ "INITIAL_STATE_REQUIRED", "STATE_REQUIRED" ],
        );
        expect ( authoringResult ).toMatchObject (
            {
                isSuccessful: true,
                diagnostics:
                [
                    { code: "INITIAL_STATE_UNDEFINED", severity: "warning" },
                    { code: "STATE_DEFINITIONS_MISSING", severity: "warning" },
                ],
            },
        );

        // Handle the case where authoring result is successful is enabled.

        if ( authoringResult.isSuccessful )
        {
            // Initialize the local values needed by this operation.

            const canonicalText = serializeCanonicalDocument ( authoringResult.document ).text;
            const canonicalFile = JSON.parse ( canonicalText ) as {
                state_machine: { initial_state: string | null; states: readonly unknown[] };
            };

            expect ( canonicalFile.state_machine.initial_state ).toBeNull ();
            expect ( canonicalFile.state_machine.states ).toEqual ( [] );
            expect ( openAuthoringDocument ( canonicalText ).isSuccessful ).toBe ( true );
        }
    } );

    it ( "rejects duplicate object members before ordinary object mapping", () =>
    {
        // Initialize the local values needed by this operation.

        const source          = readExampleText ( "state-machine-solver-candidate.json" );
        const duplicateMember = source.replace (
            '  "file_id": "automata-lab-state-machine",',
            '  "file_id": "automata-lab-state-machine",\n  "file_id": "automata-lab-state-machine",',
        );
        const result = openAutomataDocument ( duplicateMember );

        expect ( result.isSuccessful ).toBe ( false );
        expect ( result.diagnostics [ 0 ]?.code ).toBe ( "DUPLICATE_JSON_MEMBER" );
    } );

    it ( "defaults omitted optional Chart arrays and emits them canonically", () =>
    {
        // Initialize the local values needed by this operation.

        const legacyFile = JSON.parse ( readExampleText ( "state-machine-solver-candidate.json" ) ) as {
            chart: {
                draft_transitions?: unknown;
                indicators: {
                    terminal_state_indicators?: unknown;
                    terminal_state_transitions?: unknown;
                };
            };
        };

        delete legacyFile.chart.draft_transitions;
        delete legacyFile.chart.indicators.terminal_state_indicators;
        delete legacyFile.chart.indicators.terminal_state_transitions;

        const opened = openAutomataDocument ( JSON.stringify ( legacyFile ) );

        expect ( opened.isSuccessful ).toBe ( true );

        // Handle the case where the opened is successful condition is not satisfied.

        if ( !opened.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( opened.document.chart.draftTransitions ).toEqual ( [] );
        expect ( opened.document.chart.indicators.terminalStateIndicators ).toEqual ( [] );
        expect ( opened.document.chart.indicators.terminalStateTransitions ).toEqual ( [] );

        const canonicalFile = JSON.parse ( serializeCanonicalDocument ( opened.document ).text ) as {
            chart: {
                draft_transitions: unknown;
                indicators: {
                    terminal_state_indicators: unknown;
                    terminal_state_transitions: unknown;
                };
            };
        };

        expect ( canonicalFile.chart.draft_transitions ).toEqual ( [] );
        expect ( canonicalFile.chart.indicators.terminal_state_indicators ).toEqual ( [] );
        expect ( canonicalFile.chart.indicators.terminal_state_transitions ).toEqual ( [] );
    } );

    it ( "uses the configured expanded minimum for a missing legacy height and emits the attachment", () =>
    {
        // Initialize the local values needed by this operation.

        const legacyFile = JSON.parse ( readExampleText ( "state-machine-light-switch.json" ) ) as {
            chart: {
                states: Array<{ width?: number; height?: number }>;
                indicators: { initial_state_indicator: null | { state?: string | null; x: number; y: number } };
            };
            state_machine: { initial_state: string };
        };

        legacyFile.chart.states.forEach ( placement =>
        {
            delete placement.width;
            delete placement.height;
        } );

        // Handle the case where initial state indicator differs from an absent value.

        if ( legacyFile.chart.indicators.initial_state_indicator !== null )
        {
            delete legacyFile.chart.indicators.initial_state_indicator.state;
        }

        const opened = openAutomataDocument ( JSON.stringify ( legacyFile ) );

        expect ( opened.isSuccessful ).toBe ( true );

        // Handle the case where the opened is successful condition is not satisfied.

        if ( !opened.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( opened.document.chart.states.every ( placement => placement.height === undefined ) ).toBe ( true );
        expect ( opened.document.chart.indicators.initialStateIndicator?.state ).toBe (
            legacyFile.state_machine.initial_state,
        );

        const canonicalFile = JSON.parse ( serializeCanonicalDocument ( opened.document, 180 ).text ) as {
            chart: {
                states: Array<{ width?: number; height: number }>;
                indicators: { initial_state_indicator: null | { state: string | null } };
            };
        };

        expect ( canonicalFile.chart.states.every (
            placement => placement.width === undefined && placement.height === 180,
        ) ).toBe ( true );
        expect ( canonicalFile.chart.indicators.initial_state_indicator?.state ).toBe (
            legacyFile.state_machine.initial_state,
        );
    } );

    it ( "converts legacy centered state geometry without visible movement and discards legacy width", () =>
    {
        // Initialize the local values needed by this operation.

        const legacyFile = JSON.parse ( readExampleText ( "state-machine-light-switch.json" ) ) as {
            chart: {
                settings: { state_origin_centered?: boolean };
                states: Array<{ state: string; x: number; y: number; width?: number; height?: number }>;
            };
        };
        const firstPlacement = legacyFile.chart.states [ 0 ];

        expect ( firstPlacement ).toBeDefined ();

        // Handle the case where first placement matches undefined.

        if ( firstPlacement === undefined )
        {
            // Return control to the caller.

            return;
        }

        legacyFile.chart.settings.state_origin_centered = true;
        firstPlacement.x                                = 200;
        firstPlacement.y                                = 150;
        firstPlacement.width                            = 300;
        firstPlacement.height                           = 100;

        const opened = openAutomataDocument ( JSON.stringify ( legacyFile ) );

        expect ( opened.isSuccessful ).toBe ( true );

        // Handle the case where the opened is successful condition is not satisfied.

        if ( !opened.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( opened.document.chart.states [ 0 ] ).toEqual ( {
            state: firstPlacement.state,
            x: 50,
            y: 100,
            height: 100,
        } );

        const canonicalFile = JSON.parse ( serializeCanonicalDocument ( opened.document ).text ) as {
            chart: {
                settings: { state_origin_centered: boolean };
                states: Array<{ width?: number }>;
            };
        };

        expect ( canonicalFile.chart.settings.state_origin_centered ).toBe ( false );
        expect ( canonicalFile.chart.states [ 0 ]?.width ).toBeUndefined ();
    } );

    it ( "round-trips Chart draft-transition geometry", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceDocument = openAutomataDocument ( readExampleText ( "state-machine-comprehensive.json" ) );

        // Handle the case where the source document is successful condition is not satisfied.

        if ( !sourceDocument.isSuccessful )
        {
            throw new Error ( "The comprehensive fixture must open before Chart metadata is added." );
        }

        // Initialize the local values needed by this operation.

        const document: AutomataDocument = {
            ...sourceDocument.document,
            chart:
            {
                ...sourceDocument.document.chart,
                draftTransitions:
                [
                    { id: Number.MAX_SAFE_INTEGER, source: { x: -25.5, y: 10 }, target: { x: 800, y: 600.25 } },
                ],
            },
        };
        const reopened = openAutomataDocument ( serializeCanonicalDocument ( document ).text );

        expect ( reopened.isSuccessful ).toBe ( true );

        // Handle the case where reopened is successful is enabled.

        if ( reopened.isSuccessful )
        {
            expect ( reopened.document.chart.draftTransitions ).toEqual ( document.chart.draftTransitions );
        }

        // Initialize the local values needed by this operation.

        const unsafeIdentifierDocument: AutomataDocument = {
            ...document,
            chart:
            {
                ...document.chart,
                draftTransitions:
                [
                    {
                        id:     Number.MAX_SAFE_INTEGER + 1,
                        source: { x: 0, y: 0 },
                        target: { x: 1, y: 1 },
                    },
                ],
            },
        };
        const rejected = openAutomataDocument ( serializeCanonicalDocument ( unsafeIdentifierDocument ).text );

        expect ( rejected.isSuccessful ).toBe ( false );
        expect ( rejected.diagnostics.map ( diagnostic => diagnostic.code ) ).toContain ( "FILE_SCHEMA_INVALID" );
    } );

    it ( "rejects an initial-indicator attachment that differs from the semantic initial state", () =>
    {
        // Initialize the local values needed by this operation.

        const file = JSON.parse ( readExampleText ( "state-machine-light-switch.json" ) ) as {
            chart: { indicators: { initial_state_indicator: null | { state?: string | null } } };
            state_machine: { initial_state: string; states: Array<{ name: string }> };
        };
        const differentState = file.state_machine.states.find ( state => state.name !== file.state_machine.initial_state );

        // Handle the case where at least one branch condition is satisfied.

        if ( file.chart.indicators.initial_state_indicator === null || differentState === undefined )
        {
            throw new Error ( "The light-switch fixture must contain an initial indicator and a second state." );
        }

        file.chart.indicators.initial_state_indicator.state = differentState.name;
        const opened = openAutomataDocument ( JSON.stringify ( file ) );

        expect ( opened.isSuccessful ).toBe ( false );
        expect ( opened.diagnostics.map ( diagnostic => diagnostic.code ) ).toContain (
            "CHART_INITIAL_INDICATOR_STATE_MISMATCH",
        );
    } );

    it ( "round-trips two source states related to the same visual terminal indicator", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceDocument = openAutomataDocument ( readExampleText ( "state-machine-light-switch.json" ) );

        // Handle the case where at least one branch condition is satisfied.

        if ( !sourceDocument.isSuccessful || sourceDocument.document.stateMachine.states.length < 2 )
        {
            throw new Error ( "The light-switch fixture must provide two states for the visual-relation round trip." );
        }

        // Initialize the local values needed by this operation.

        const firstState                 = sourceDocument.document.stateMachine.states [ 0 ]?.name ?? "";
        const secondState                = sourceDocument.document.stateMachine.states [ 1 ]?.name ?? "";
        const document: AutomataDocument = {
            ...sourceDocument.document,
            chart:
            {
                ...sourceDocument.document.chart,
                indicators:
                {
                    ...sourceDocument.document.chart.indicators,
                    terminalStateIndicators: [ { id: 42, x: 600, y: 300 } ],
                    terminalStateTransitions:
                    [
                        { state: firstState, terminalStateIndicatorId: 42 },
                        { state: secondState, terminalStateIndicatorId: 42 },
                    ],
                },
            },
        };
        const reopened = openAutomataDocument ( serializeCanonicalDocument ( document ).text );

        expect ( reopened.isSuccessful ).toBe ( true );

        // Handle the case where reopened is successful is enabled.

        if ( reopened.isSuccessful )
        {
            expect ( reopened.document.chart.indicators.terminalStateIndicators ).toEqual (
                document.chart.indicators.terminalStateIndicators,
            );
            expect ( reopened.document.chart.indicators.terminalStateTransitions ).toEqual (
                document.chart.indicators.terminalStateTransitions,
            );
        }
    } );

    it ( "rejects malformed JSON and forbidden prototype keys", () =>
    {
        // Initialize the local values needed by this operation.

        const malformed = openAutomataDocument ( "{\"file_id\":" );
        const polluted  = openAutomataDocument (
            '{"file_id":"automata-lab-state-machine","file_version":"1.0.0","__proto__":{}}',
        );

        expect ( malformed.isSuccessful ).toBe ( false );
        expect ( malformed.diagnostics [ 0 ]?.code ).toBe ( "JSON_MALFORMED" );
        expect ( polluted.isSuccessful ).toBe ( false );
        expect ( polluted.diagnostics [ 0 ]?.code ).toBe ( "PROTOTYPE_KEY_FORBIDDEN" );
    } );

    it ( "rejects the wrong identity, unsupported versions, and unknown or obsolete properties", () =>
    {
        // Initialize the local values needed by this operation.

        const source        = readExampleText ( "state-machine-solver-candidate.json" );
        const wrongIdentity = openAutomataDocument (
            source.replace ( "automata-lab-state-machine", "another-format" ),
        );
        const unsupportedVersion = openAutomataDocument (
            source.replace ( '"file_version": "1.0.0"', '"file_version": "2.0.0"' ),
        );
        const unknownProperty = openAutomataDocument (
            source.replace ( '  "file_version": "1.0.0",', '  "file_version": "1.0.0",\n  "unexpected": true,' ),
        );
        const obsoleteTransitionAnchors = openAutomataDocument (
            source.replace ( '    "draft_transitions": []',
                '    "draft_transitions": [],\n    "transition_anchors": []' ),
        );

        expect ( wrongIdentity.isSuccessful ).toBe ( false );
        expect ( wrongIdentity.diagnostics [ 0 ]?.code ).toBe ( "FILE_ID_INVALID" );
        expect ( unsupportedVersion.isSuccessful ).toBe ( false );
        expect ( unsupportedVersion.diagnostics [ 0 ]?.code ).toBe ( "FILE_VERSION_UNSUPPORTED" );
        expect ( unknownProperty.isSuccessful ).toBe ( false );
        expect ( unknownProperty.diagnostics.some ( ( diagnostic ) => diagnostic.code === "FILE_SCHEMA_INVALID" ) ).toBe ( true );
        expect ( obsoleteTransitionAnchors.isSuccessful ).toBe ( false );
        expect ( obsoleteTransitionAnchors.diagnostics.some (
            diagnostic => diagnostic.code === "FILE_SCHEMA_INVALID",
        ) ).toBe ( true );
    } );

    it ( "rejects dangling references and files over the byte limit", () =>
    {
        // Initialize the local values needed by this operation.

        const source                     = readExampleText ( "state-machine-solver-candidate.json" );
        const danglingSource             = source.replace ( '"state_next": "state_open"', '"state_next": "state_missing"' );
        const danglingReference          = openAutomataDocument ( danglingSource );
        const authoringDanglingReference = openAuthoringDocument ( danglingSource );
        const oversized                  = openAutomataDocument ( " ".repeat ( MAXIMUM_FILE_BYTE_COUNT + 1 ) );

        expect ( danglingReference.isSuccessful ).toBe ( false );
        expect ( danglingReference.diagnostics.some (
            ( diagnostic ) => diagnostic.code === "TRANSITION_DESTINATION_UNKNOWN",
        ) ).toBe ( true );
        expect ( authoringDanglingReference.isSuccessful ).toBe ( false );
        expect ( authoringDanglingReference.diagnostics.some (
            ( diagnostic ) => diagnostic.code === "TRANSITION_DESTINATION_UNKNOWN",
        ) ).toBe ( true );
        expect ( oversized.isSuccessful ).toBe ( false );
        expect ( oversized.diagnostics [ 0 ]?.code ).toBe ( "FILE_TOO_LARGE" );
    } );

    it ( "rejects per-sequence and aggregate Solver-token capacity violations", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceDocument = openAutomataDocument ( readExampleText ( "state-machine-solver-candidate.json" ) );

        // Handle the case where the source document is successful condition is not satisfied.

        if ( !sourceDocument.isSuccessful )
        {
            throw new Error ( "The Solver candidate fixture must open before capacity mutation." );
        }

        // Initialize the local values needed by this operation.

        const oversizedDocument: AutomataDocument =
        {
            ...sourceDocument.document,
            solver:
            {
                sequences:
                [
                    {
                        name:         "capacity",
                        description:  "Exceeds the aggregate token limit.",
                        startContext: "infer",
                        sequence:     Array<string> ( 50_001 ).fill ( "event_capacity" ),
                    },
                ],
            },
        };
        const sequenceResult                      = openAutomataDocument ( serializeCanonicalDocument ( oversizedDocument ).text );
        const aggregateDocument: AutomataDocument = 
        {
            ...oversizedDocument,
            solver:
            {
                sequences:
                [
                    { ...oversizedDocument.solver.sequences [ 0 ]!, sequence: Array<string> ( 25_000 ).fill ( "event_a" ) },
                    {
                        name:         "aggregate-capacity",
                        description:  "Exceeds the aggregate token limit across sequences.",
                        startContext: "infer",
                        sequence:     Array<string> ( 25_001 ).fill ( "event_b" ),
                    },
                ],
            },
        };
        const aggregateResult = openAutomataDocument ( serializeCanonicalDocument ( aggregateDocument ).text );

        expect ( sequenceResult ).toMatchObject ( {
            isSuccessful: false,
            diagnostics:
            [
                expect.objectContaining ( {
                    code: "FILE_SCHEMA_INVALID",
                    path: "/solver/sequences/0/sequence",
                } ),
            ],
        } );
        expect ( aggregateResult.isSuccessful ).toBe ( false );
        expect ( aggregateResult.diagnostics.some ( ( diagnostic ) => diagnostic.code === "CAPACITY_EXCEEDED" ) )
            .toBe ( true );
    } );

    it ( "accepts an exact-length saved Solver token and rejects one Unicode code point above the schema bound", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceDocument = openAutomataDocument ( readExampleText ( "state-machine-solver-candidate.json" ) );

        // Handle the case where the source document is successful condition is not satisfied.

        if ( !sourceDocument.isSuccessful )
        {
            throw new Error ( "The Solver candidate fixture must open before token-length mutation." );
        }

        // Initialize the local values needed by this operation.

        const exactToken = `action_${"😀".repeat (
            MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT - [ ..."action_" ].length,
        )}`;

        //------------------------------------------------------------------------------------------
        // Function: createDocument
        //
        // Description:
        //
        //   Creates document for the test scenario.
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

        const createDocument = ( token: string ): AutomataDocument => ( {
            ...sourceDocument.document,
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
        const exactResult     = openAutomataDocument ( serializeCanonicalDocument ( createDocument ( exactToken ) ).text );
        const excessiveResult = openAutomataDocument (
            serializeCanonicalDocument ( createDocument ( `${exactToken}😀` ) ).text,
        );

        expect ( exactResult.isSuccessful ).toBe ( true );
        expect ( excessiveResult ).toMatchObject ( {
            isSuccessful: false,
            diagnostics:
            [
                expect.objectContaining ( {
                    code: "FILE_SCHEMA_INVALID",
                    path: "/solver/sequences/0/sequence/0",
                } ),
            ],
        } );
    } );

    it ( "accepts persisted Simulator data at both exact schema capacity boundaries", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceDocument = openAutomataDocument ( readExampleText ( "state-machine-comprehensive.json" ) );

        // Handle the case where the source document is successful condition is not satisfied.

        if ( !sourceDocument.isSuccessful )
        {
            throw new Error ( "The comprehensive fixture must open before Simulator capacity mutation." );
        }

        // Initialize the local values needed by this operation.

        const boundaryDocument: AutomataDocument = {
            ...sourceDocument.document,
            simulator:
            {
                sequences: createSimulatorSequences (
                    MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
                    MAXIMUM_EVENT_BUFFER_COUNT,
                ),
            },
        };
        const result = openAutomataDocument ( serializeCanonicalDocument ( boundaryDocument ).text );

        expect ( result.isSuccessful ).toBe ( true );
    } );

    it ( "rejects persisted Simulator data one sequence above schema capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceDocument = openAutomataDocument ( readExampleText ( "state-machine-comprehensive.json" ) );

        // Handle the case where the source document is successful condition is not satisfied.

        if ( !sourceDocument.isSuccessful )
        {
            throw new Error ( "The comprehensive fixture must open before Simulator capacity mutation." );
        }

        // Initialize the local values needed by this operation.

        const oversizedDocument: AutomataDocument = {
            ...sourceDocument.document,
            simulator: { sequences: createSimulatorSequences ( MAXIMUM_SIMULATOR_SEQUENCE_COUNT + 1 ) },
        };
        const result = openAutomataDocument ( serializeCanonicalDocument ( oversizedDocument ).text );

        expect ( result ).toMatchObject ( {
            isSuccessful: false,
            diagnostics: [ expect.objectContaining ( { code: "FILE_SCHEMA_INVALID", path: "/simulator/sequences" } ) ],
        } );
    } );

    it ( "rejects a persisted Simulator sequence one event above schema capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceDocument = openAutomataDocument ( readExampleText ( "state-machine-comprehensive.json" ) );

        // Handle the case where the source document is successful condition is not satisfied.

        if ( !sourceDocument.isSuccessful )
        {
            throw new Error ( "The comprehensive fixture must open before Simulator capacity mutation." );
        }

        // Initialize the local values needed by this operation.

        const oversizedDocument: AutomataDocument = {
            ...sourceDocument.document,
            simulator: { sequences: createSimulatorSequences ( 1, MAXIMUM_EVENT_BUFFER_COUNT + 1 ) },
        };
        const result = openAutomataDocument ( serializeCanonicalDocument ( oversizedDocument ).text );

        expect ( result ).toMatchObject ( {
            isSuccessful: false,
            diagnostics:
            [
                expect.objectContaining ( {
                    code: "FILE_SCHEMA_INVALID",
                    path: "/simulator/sequences/0/sequence",
                } ),
            ],
        } );
    } );

    it ( "ships a parseable Draft 2020-12 public schema", () =>
    {
        // Initialize the local values needed by this operation.

        const schemaText = readFileSync (
            new URL ( "../../public/schema/automata-lab-state-machine-1.0.0.schema.json", import.meta.url ),
            "utf8",
        );
        const schema: unknown = JSON.parse ( schemaText );

        expect ( schema ).toMatchObject (
            {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                $id:     expect.stringContaining ( "1.0.0" ),
                properties:
                {
                    chart:
                    {
                        properties:
                        {
                            states: { maxItems: MAXIMUM_STATE_COUNT },
                            indicators:
                            {
                                properties:
                                {
                                    terminal_state_indicators:
                                    {
                                        maxItems: MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
                                        items:
                                        {
                                            properties:
                                            {
                                                id: { maximum: Number.MAX_SAFE_INTEGER },
                                            },
                                        },
                                    },
                                    terminal_state_transitions:
                                    {
                                        maxItems: MAXIMUM_CHART_TERMINAL_RELATION_COUNT,
                                        items:
                                        {
                                            properties:
                                            {
                                                terminal_state_indicator_id:
                                                {
                                                    maximum: Number.MAX_SAFE_INTEGER,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            draft_transitions:
                            {
                                maxItems: MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
                                items:
                                {
                                    properties:
                                    {
                                        id: { maximum: Number.MAX_SAFE_INTEGER },
                                    },
                                },
                            },
                        },
                    },
                    solver:
                    {
                        properties:
                        {
                            sequences:
                            {
                                items:
                                {
                                    properties:
                                    {
                                        sequence:
                                        {
                                            maxItems: MAXIMUM_SOLVER_TOKEN_COUNT,
                                            items:    { maxLength: MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        );

        // Handle the case where at least one branch condition is satisfied.

        if ( typeof schema !== "object" || schema === null )
        {
            throw new Error ( "The public schema must be a JSON object." );
        }

        // Initialize the local values needed by this operation.

        const publicChartProperties        = ( schema as typeof FILE_SCHEMA_V1 ).properties.chart.properties;
        const sourceChartProperties        = FILE_SCHEMA_V1.properties.chart.properties;
        const publicStateMachineProperties = ( schema as typeof FILE_SCHEMA_V1 ).properties.state_machine.properties;
        const sourceStateMachineProperties = FILE_SCHEMA_V1.properties.state_machine.properties;
        const publicSimulatorSequences     = ( schema as typeof FILE_SCHEMA_V1 ).properties.simulator.properties.sequences;
        const sourceSimulatorSequences     = FILE_SCHEMA_V1.properties.simulator.properties.sequences;
        const publicSolverSequences        = ( schema as typeof FILE_SCHEMA_V1 ).properties.solver.properties.sequences;
        const sourceSolverSequences        = FILE_SCHEMA_V1.properties.solver.properties.sequences;

        expect ( publicChartProperties.states.maxItems ).toBe ( sourceChartProperties.states.maxItems );
        expect ( publicChartProperties.draft_transitions.maxItems ).toBe (
            sourceChartProperties.draft_transitions.maxItems,
        );
        expect ( publicChartProperties.draft_transitions.items.properties.id.maximum ).toBe (
            sourceChartProperties.draft_transitions.items.properties.id.maximum,
        );
        expect ( publicChartProperties.indicators.properties.terminal_state_indicators.items.properties.id.maximum )
            .toBe ( sourceChartProperties.indicators.properties.terminal_state_indicators.items.properties.id.maximum );
        expect ( publicChartProperties.indicators.properties.terminal_state_transitions.items.properties
            .terminal_state_indicator_id.maximum ).toBe ( sourceChartProperties.indicators.properties
            .terminal_state_transitions.items.properties.terminal_state_indicator_id.maximum );
        expect ( publicStateMachineProperties.state_actions.properties.entry.maxItems ).toBe (
            sourceStateMachineProperties.state_actions.properties.entry.maxItems,
        );
        expect ( publicStateMachineProperties.state_actions.properties.exit.maxItems ).toBe (
            sourceStateMachineProperties.state_actions.properties.exit.maxItems,
        );
        expect ( publicSimulatorSequences.maxItems ).toBe ( sourceSimulatorSequences.maxItems );
        expect ( publicSimulatorSequences.items.properties.sequence.maxItems ).toBe (
            sourceSimulatorSequences.items.properties.sequence.maxItems,
        );
        expect ( publicSolverSequences.items.properties.sequence.maxItems ).toBe (
            sourceSolverSequences.items.properties.sequence.maxItems,
        );
        expect ( publicSolverSequences.items.properties.sequence.items.maxLength ).toBe (
            sourceSolverSequences.items.properties.sequence.items.maxLength,
        );

        const validate = new Ajv2020 ( { strict: true } ).compile ( schema );

        // Process each file name from the example file names collection in order.

        for ( const fileName of EXAMPLE_FILE_NAMES )
        {
            // Initialize the local values needed by this operation.

            const example: unknown = JSON.parse ( readExampleText ( fileName ) );

            expect ( validate ( example ), JSON.stringify ( validate.errors ) ).toBe ( true );
        }

        // Initialize the local values needed by this operation.

        const decoratedExample = JSON.parse ( readExampleText ( "state-machine-solver-candidate.json" ) ) as {
            chart: {
                draft_transitions: Array<{
                    id: number;
                    source: { x: number; y: number };
                    target: { x: number; y: number };
                }>;
                indicators: {
                    terminal_state_indicators: Array<{ id: number; x: number; y: number }>;
                    terminal_state_transitions: Array<{ state: string; terminal_state_indicator_id: number }>;
                };
            };
            state_machine: {
                transition_table: Array<{ state: string; event: string }>;
            };
        };
        const decoratedTransition = decoratedExample.state_machine.transition_table [ 0 ];

        // Handle the case where decorated transition matches undefined.

        if ( decoratedTransition === undefined )
        {
            throw new Error ( "The Solver candidate example must contain a transition." );
        }

        decoratedExample.chart.draft_transitions = [ {
            id:     Number.MAX_SAFE_INTEGER,
            source: { x: -100, y: 0 },
            target: { x: 100, y: 200 },
        } ];
        decoratedExample.chart.indicators.terminal_state_indicators = [ {
            id: Number.MAX_SAFE_INTEGER,
            x:  0,
            y:  0,
        } ];
        decoratedExample.chart.indicators.terminal_state_transitions = [ {
            state: decoratedTransition.state,
            terminal_state_indicator_id: Number.MAX_SAFE_INTEGER,
        } ];

        expect ( validate ( decoratedExample ), JSON.stringify ( validate.errors ) ).toBe ( true );

        decoratedExample.chart.draft_transitions [ 0 ]!.id = Number.MAX_SAFE_INTEGER + 1;

        expect ( validate ( decoratedExample ) ).toBe ( false );

        decoratedExample.chart.draft_transitions [ 0 ]!.id = Number.MAX_SAFE_INTEGER;
        decoratedExample.chart.indicators.terminal_state_indicators [ 0 ]!.id = Number.MAX_SAFE_INTEGER + 1;

        expect ( validate ( decoratedExample ) ).toBe ( false );

        decoratedExample.chart.indicators.terminal_state_indicators [ 0 ]!.id = Number.MAX_SAFE_INTEGER;
        decoratedExample.chart.indicators.terminal_state_transitions [ 0 ]!.terminal_state_indicator_id =
            Number.MAX_SAFE_INTEGER + 1;

        expect ( validate ( decoratedExample ) ).toBe ( false );

        const legacyExample = JSON.parse ( readExampleText ( "state-machine-solver-candidate.json" ) ) as {
            chart: {
                draft_transitions?: unknown;
                indicators: {
                    terminal_state_indicators?: unknown;
                    terminal_state_transitions?: unknown;
                };
            };
        };

        delete legacyExample.chart.draft_transitions;
        delete legacyExample.chart.indicators.terminal_state_indicators;
        delete legacyExample.chart.indicators.terminal_state_transitions;

        expect ( validate ( legacyExample ), JSON.stringify ( validate.errors ) ).toBe ( true );
    } );
} );

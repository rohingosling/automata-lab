// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    CSV Model-Element Transfer Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies strict CSV parsing, optional schedules, ignored columns, canonical headers, quoting,
//   and diagnostics.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import
{
    createCsvExportDocument,
    createCsvSimulatorSequenceExportDocument,
    createCsvSolverSequenceExportDocument,
    prepareCsvModelElementImport,
    prepareCsvSimulatorSequenceImport,
    prepareCsvSolverSequenceImport,
} from "../../src/application/csv-transfer";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts";
import { MAXIMUM_EVENT_BUFFER_COUNT } from "../../src/domain/model/limits";

describe ( "CSV model-element transfer", () =>
{
    it ( "imports named entities by header and ignores unrelated columns", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvModelElementImport (
            "ignored,Description,Name\r\n42,\"First, state\",state_one\r\n99,\"Second\nstate\",state_two\r\n",
            "states",
        );

        expect ( result ).toEqual (
            {
                isSuccessful: true,
                modelImport:
                {
                    kind:       "named_entities",
                    entityKind: "state",
                    rows:
                    [
                        { rowNumber: 2, value: { name: "state_one", description: "First, state" } },
                        { rowNumber: 3, value: { name: "state_two", description: "Second\nstate" } },
                    ],
                },
                rowCount: 2,
            },
        );
    } );

    it ( "maps every named collection through its declared schema", () =>
    {
        // Initialize the local values needed by this operation.

        const eventResult = prepareCsvModelElementImport (
            "name,description\r\nevent_go,Go\r\n",
            "events",
        );
        const actionResult = prepareCsvModelElementImport (
            "name,description\r\naction_start,Start\r\n",
            "actions",
        );

        expect ( eventResult ).toMatchObject (
            {
                isSuccessful: true,
                modelImport: { kind: "named_entities", entityKind: "event" },
            },
        );
        expect ( actionResult ).toMatchObject (
            {
                isSuccessful: true,
                modelImport: { kind: "named_entities", entityKind: "action" },
            },
        );
    } );

    it ( "defaults state-action schedules to entry only when the schedule column is absent", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvModelElementImport (
            "state,action\r\nstate_one,action_start\r\nstate_one,action_log\r\n",
            "state_actions",
        );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.modelImport ).toMatchObject (
                {
                    kind: "state_actions",
                    rows:
                    [
                        { value: { state: "state_one", action: "action_start", schedule: "entry" } },
                        { value: { state: "state_one", action: "action_log", schedule: "entry" } },
                    ],
                },
            );
        }
    } );

    it ( "accepts explicit entry and exit schedules and rejects a blank schedule", () =>
    {
        // Initialize the local values needed by this operation.

        const validResult = prepareCsvModelElementImport (
            "state,action,schedule\nstate_one,action_start,entry\nstate_one,action_stop,EXIT\n",
            "state_actions",
        );
        const invalidResult = prepareCsvModelElementImport (
            "state,action,schedule\nstate_one,action_start,\n",
            "state_actions",
        );

        expect ( validResult.isSuccessful ).toBe ( true );
        expect ( invalidResult ).toMatchObject (
            {
                isSuccessful: false,
                diagnostics: [ { code: "CSV_SCHEDULE_INVALID", path: "/csv/rows/2" } ],
            },
        );
    } );

    it ( "rejects malformed quoting and missing required headers", () =>
    {
        // Initialize the local values needed by this operation.

        const malformedResult     = prepareCsvModelElementImport ( "name,description\n\"state_one,broken\n", "states" );
        const missingHeaderResult = prepareCsvModelElementImport ( "state,event,destination\na,b,c\n", "transition_table" );

        expect ( malformedResult ).toMatchObject (
            { isSuccessful: false, diagnostics: [ { code: "CSV_SYNTAX_INVALID" } ] },
        );
        expect ( missingHeaderResult ).toMatchObject (
            { isSuccessful: false, diagnostics: [ { code: "CSV_HEADER_MISSING" } ] },
        );
    } );

    it ( "exports canonical state-action and transition CSV projections", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = 
        {
            ...emptyDraft,
            settings: { ...emptyDraft.settings, name: "CSV Example" },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                stateActions:
                {
                    entry: [ { state: "state_one", action: "action_start" } ],
                    exit:  [ { state: "state_one", action: "action_stop" } ],
                },
                transitionTable: [ { state: "state_one", event: "event_go", stateNext: "state_two" } ],
            },
        };

        expect ( createCsvExportDocument ( draft, "state_actions" ) ).toEqual (
            {
                rowCount:      2,
                suggestedName: "csv-example-state-actions.csv",
                text:          "state,action,schedule\r\nstate_one,action_start,entry\r\nstate_one,action_stop,exit\r\n",
            },
        );
        expect ( createCsvExportDocument ( draft, "transition_table" ).text )
            .toBe ( "state,event,next_state\r\nstate_one,event_go,state_two\r\n" );
    } );

    it ( "exports every catalog with canonical headers", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = 
        {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                actions:        [ { name: "action_start", description: "Start" } ],
                events:         [ { name: "event_go", description: "Go" } ],
                states:         [ { name: "state_one", description: "One" } ],
            },
        };

        expect ( createCsvExportDocument ( draft, "states" ).text )
            .toBe ( "name,description\r\nstate_one,One\r\n" );
        expect ( createCsvExportDocument ( draft, "events" ).text )
            .toBe ( "name,description\r\nevent_go,Go\r\n" );
        expect ( createCsvExportDocument ( draft, "actions" ).text )
            .toBe ( "name,description\r\naction_start,Start\r\n" );
    } );

    it ( "imports only the first Model Metadata record and reports ignored records", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvModelElementImport (
            "description,initial_state,name,version\r\nFirst,state_one,Imported Model,2.3.4\r\nSecond,state_two,Ignored Model,9.9.9\r\n",
            "model_metadata",
        );

        expect ( result ).toMatchObject (
            {
                isSuccessful: true,
                modelImport:
                {
                    kind: "model_metadata",
                    rows:
                    [
                        {
                            rowNumber: 2,
                            value:
                            {
                                name:         "Imported Model",
                                description:  "First",
                                version:      "2.3.4",
                                initialState: "state_one",
                            },
                        },
                    ],
                },
                rowCount: 1,
                warnings: [ { code: "CSV_MODEL_METADATA_EXTRA_ROWS", severity: "warning" } ],
            },
        );
    } );

    it ( "maps blank Model Metadata initial_state to null and exports one canonical record", () =>
    {
        // Initialize the local values needed by this operation.

        const imported = prepareCsvModelElementImport (
            "name,description,version,initial_state\r\nImported,Description,1.2.3,   \r\n",
            "model_metadata",
        );

        expect ( imported ).toMatchObject (
            {
                isSuccessful: true,
                modelImport: { rows: [ { value: { initialState: null } } ] },
            },
        );

        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = 
        {
            ...emptyDraft,
            settings: { name: "Metadata Model", description: "Comma, quote \" and\nline", version: "3.2.1" },
        };

        expect ( createCsvExportDocument ( draft, "model_metadata" ) ).toEqual (
            {
                rowCount:      1,
                suggestedName: "metadata-model-model-metadata.csv",
                text:          "name,description,version,initial_state\r\nMetadata Model,\"Comma, quote \"\" and\nline\",3.2.1,\r\n",
            },
        );
    } );

    it ( "quotes exported commas, newlines, and quotes without changing content", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = 
        {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_one", description: "Comma, quote \" and\nline" } ],
            },
        };

        const exported = createCsvExportDocument ( draft, "states" );

        expect ( exported.text ).toBe ( "name,description\r\nstate_one,\"Comma, quote \"\" and\nline\"\r\n" );
        expect ( prepareCsvModelElementImport ( exported.text, "states" ) ).toMatchObject (
            {
                isSuccessful: true,
                modelImport:
                {
                    rows: [ { value: { name: "state_one", description: "Comma, quote \" and\nline" } } ],
                },
            },
        );
    } );

    it ( "normalizes missing and matching Solver prefixes and round-trips named tokens", () =>
    {
        // Initialize the local values needed by this operation.

        const imported = prepareCsvSolverSequenceImport (
            "ignored, TYPE , Name\r\n1,event,start\r\n2,state,state_ready\r\n3,action,enter\r\n",
            "Imported",
        );

        expect ( imported ).toEqual (
            {
                isSuccessful: true,
                rowCount: 3,
                tokens: [ "event_start", "state_ready", "action_enter" ],
            },
        );

        // Handle the case where imported is successful is enabled.

        if ( imported.isSuccessful )
        {
            // Initialize the local values needed by this operation.

            const exported = createCsvSolverSequenceExportDocument (
                "Model",
                {
                    name: "Imported",
                    description: "",
                    startContext: "infer",
                    sequence: imported.tokens,
                },
            );

            expect ( exported ).toMatchObject ( { isSuccessful: true } );

            // Handle the case where exported is successful is enabled.

            if ( exported.isSuccessful )
            {
                expect ( exported.document.text ).toBe (
                    "name,type\r\nevent_start,event\r\nstate_ready,state\r\naction_enter,action\r\n",
                );
                expect ( prepareCsvSolverSequenceImport ( exported.document.text, "Round trip" ) ).toEqual (
                    { isSuccessful: true, rowCount: 3, tokens: imported.tokens },
                );
            }
        }
    } );

    it ( "exports human-friendly Solver spellings through canonical CSV names", () =>
    {
        // Initialize the local values needed by this operation.

        const exported = createCsvSolverSequenceExportDocument (
            "Model",
            {
                name: "Human friendly",
                description: "",
                startContext: "infer",
                sequence: [ "Event-open", "STATE ready", "ActionComplete" ],
            },
        );

        expect ( exported.isSuccessful ).toBe ( true );

        // Handle the case where exported is successful is enabled.

        if ( exported.isSuccessful )
        {
            expect ( exported.document.text ).toBe (
                "name,type\r\nevent_open,event\r\nstate_ready,state\r\naction_Complete,action\r\n",
            );
        }
    } );

    it ( "aggregates invalid Solver rows and rejects a conflicting prefix without partial output", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvSolverSequenceImport (
            "name,type\r\nevent_wrong,state\r\nvalue,unknown\r\n",
            "Rejected",
        );

        expect ( result.isSuccessful ).toBe ( false );

        // Handle the case where the result is successful condition is not satisfied.

        if ( !result.isSuccessful )
        {
            expect ( result.diagnostics.map ( diagnostic => diagnostic.code ) ).toEqual (
                [ "CSV_SOLVER_PREFIX_CONFLICT", "CSV_SOLVER_TYPE_INVALID" ],
            );
        }
    } );

} );

describe ( "CSV Simulator event-sequence transfer", () =>
{
    it ( "imports one event per row in dispatch order", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvSimulatorSequenceImport ( "name\r\nevent_go\r\nevent_stop\r\nevent_go\r\n" );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.events ).toEqual ( [ "event_go", "event_stop", "event_go" ] );
            expect ( result.rowCount ).toBe ( 3 );
        }
    } );

    it ( "accepts undeclared event names so negative testing remains possible", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvSimulatorSequenceImport ( "name\r\nnot_declared_at_all\r\n" );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.events ).toEqual ( [ "not_declared_at_all" ] );
        }
    } );

    it ( "ignores unknown columns and normalizes header case and whitespace", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvSimulatorSequenceImport ( "  NAME , note\r\nevent_go,ignored\r\n" );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.events ).toEqual ( [ "event_go" ] );
        }
    } );

    it ( "trims surrounding whitespace from each event name", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvSimulatorSequenceImport ( "name\r\n   event_go   \r\n" );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.events ).toEqual ( [ "event_go" ] );
        }
    } );

    it ( "rejects the complete import when any row has a blank name", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvSimulatorSequenceImport ( "name\r\nevent_go\r\n   \r\nevent_stop\r\n" );

        expect ( result.isSuccessful ).toBe ( false );

        // Handle the case where the result is successful condition is not satisfied.

        if ( !result.isSuccessful )
        {
            expect ( result.diagnostics.map ( diagnostic => diagnostic.code ) )
                .toEqual ( [ "CSV_SIMULATOR_EVENT_BLANK" ] );
        }
    } );

    it ( "rejects an event name longer than the bounded-name limit", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvSimulatorSequenceImport ( `name\r\n${"e".repeat ( 129 )}\r\n` );

        expect ( result.isSuccessful ).toBe ( false );

        // Handle the case where the result is successful condition is not satisfied.

        if ( !result.isSuccessful )
        {
            expect ( result.diagnostics.map ( diagnostic => diagnostic.code ) )
                .toEqual ( [ "CSV_SIMULATOR_EVENT_TOO_LONG" ] );
        }
    } );

    it ( "rejects a buffer larger than the server could ever accept", () =>
    {
        // Initialize the local values needed by this operation.

        const rows   = Array.from ( { length: MAXIMUM_EVENT_BUFFER_COUNT + 1 }, () => "event_go" ).join ( "\r\n" );
        const result = prepareCsvSimulatorSequenceImport ( `name\r\n${rows}\r\n` );

        expect ( result.isSuccessful ).toBe ( false );

        // Handle the case where the result is successful condition is not satisfied.

        if ( !result.isSuccessful )
        {
            expect ( result.diagnostics.map ( diagnostic => diagnostic.code ) )
                .toEqual ( [ "CSV_SIMULATOR_SEQUENCE_TOO_LARGE" ] );
        }
    } );

    it ( "accepts a buffer at the exact persisted Run-buffer capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const rows   = Array.from ( { length: MAXIMUM_EVENT_BUFFER_COUNT }, () => "event_go" ).join ( "\r\n" );
        const result = prepareCsvSimulatorSequenceImport ( `name\r\n${rows}\r\n` );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.rowCount ).toBe ( MAXIMUM_EVENT_BUFFER_COUNT );
            expect ( result.events ).toHaveLength ( MAXIMUM_EVENT_BUFFER_COUNT );
        }
    } );

    it ( "rejects a file without the required name column", () =>
    {
        // Initialize the local values needed by this operation.

        const result = prepareCsvSimulatorSequenceImport ( "type\r\nevent\r\n" );

        expect ( result.isSuccessful ).toBe ( false );
    } );

    it ( "exports canonical columns with CRLF records and one trailing CRLF", () =>
    {
        // Initialize the local values needed by this operation.

        const result = createCsvSimulatorSequenceExportDocument (
            "Light Switch",
            { description: "", name: "happy path", sequence: [ "event_go", "event_stop" ] },
        );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.document.text ).toBe ( "name\r\nevent_go\r\nevent_stop\r\n" );
            expect ( result.document.rowCount ).toBe ( 2 );
            expect ( result.document.suggestedName ).toBe ( "light-switch-happy-path-simulator-events.csv" );
        }
    } );

    it ( "escapes fields that contain a separator, quote, or newline", () =>
    {
        // Initialize the local values needed by this operation.

        const result = createCsvSimulatorSequenceExportDocument (
            "model",
            { description: "", name: "s", sequence: [ "a,b", "c\"d" ] },
        );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.document.text ).toBe ( "name\r\n\"a,b\"\r\n\"c\"\"d\"\r\n" );
        }
    } );

    it ( "round-trips an exported sequence back through import", () =>
    {
        // Initialize the local values needed by this operation.

        const events   = [ "event_go", "event_stop", "event_go" ];
        const exported = createCsvSimulatorSequenceExportDocument (
            "model",
            { description: "", name: "s", sequence: events },
        );

        expect ( exported.isSuccessful ).toBe ( true );

        // Handle the case where exported is successful is enabled.

        if ( exported.isSuccessful )
        {
            // Initialize the local values needed by this operation.

            const reimported = prepareCsvSimulatorSequenceImport ( exported.document.text );

            expect ( reimported.isSuccessful ).toBe ( true );

            // Handle the case where reimported is successful is enabled.

            if ( reimported.isSuccessful )
            {
                expect ( reimported.events ).toEqual ( events );
            }
        }
    } );

    it ( "exports an empty sequence as a header-only document", () =>
    {
        // Initialize the local values needed by this operation.

        const result = createCsvSimulatorSequenceExportDocument (
            "model",
            { description: "", name: "s", sequence: [] },
        );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.document.text ).toBe ( "name\r\n" );
            expect ( result.document.rowCount ).toBe ( 0 );
        }
    } );
} );

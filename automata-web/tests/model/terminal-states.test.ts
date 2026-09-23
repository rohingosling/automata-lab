// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Terminal State Foundation Tests
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies strict file boundaries, migration, preparation gating, CSV semantics, and state data.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it, vi } from "vitest";
import type { AuthoringDraft, AutomataDocument, FileDocumentV1 } from "../../src/domain/model/contracts.js";
import type { TerminalStatePreparationPort } from "../../src/application/ports/terminal-state-preparation.js";
import
{
    createTerminalStateCsvExportDocument,
    prepareCsvModelElementImport,
    prepareTerminalStateCsvImport,
} from "../../src/application/csv-transfer.js";
import
{
    encodeFileDocumentV1,
    encodeFileDocumentV1_4,
    serializeCanonicalDocument,
    serializeCanonicalHostedContent,
} from "../../src/domain/model/canonicalization.js";
import { createDocumentEditorState, planDocumentCommand } from "../../src/domain/model/commands.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { inspectModelElementImport } from "../../src/domain/model/model-element-import.js";
import { hasCoherentTerminalStateNotation } from "../../src/domain/model/terminal-states.js";
import { validatePersistableAuthoringDraft } from "../../src/domain/model/validation.js";
import { compileDocument } from "../../src/domain/runtime/runtime.js";
import { inferSolverCandidate } from "../../src/domain/solver/inference.js";
import { openAuthoringDocument } from "../../src/infrastructure/files/file-codec.js";
import { TerminalStateDocumentCodec } from "../../src/infrastructure/files/terminal-state-file-codec.js";
import { FILE_SCHEMA_V1_4 } from "../../src/infrastructure/files/schema-v1.js";
import validateModernFile from "../../src/infrastructure/files/generated/file-schema-v1-4-validator.js";
import { decodeSolverWorkerMessage, SOLVER_PROTOCOL_VERSION } from "../../src/protocol/solver-worker-protocol.js";

import { AutomataDocumentCodec } from "../../src/infrastructure/files/file-codec.js";

const NO_REPAIR = { addedIndicatorCount: 0, addedRelationCount: 0, removedRelationCount: 0 };
const IDENTITY_PREPARATION: TerminalStatePreparationPort =
{
    prepare: document => ( { isSuccessful: true, document, summary: NO_REPAIR } ),
};
const CODEC = new TerminalStateDocumentCodec ( IDENTITY_PREPARATION );
const LEGACY_VERSIONS: readonly FileDocumentV1["file_version"][] = [ "1.0.0", "1.1.0", "1.2.0", "1.3.0" ];

function fixture ( terminalState = false ): AutomataDocument
{
    const empty = createEmptyAuthoringDraft ();

    return {
        ...empty,
        stateMachine:
        {
            ...empty.stateMachine,
            initialState: "A",
            states: [
                { name: "A", description: "First", terminalState },
                { name: "B", description: "Second", terminalState },
                { name: "C", description: "Third", terminalState: false },
            ],
            events: [ { name: "go", description: "" } ],
            actions: [ { name: "report", description: "" } ],
            stateActions: { entry: [ { state: "B", action: "report" } ], exit: [] },
            transitionTable: [ { state: "A", event: "go", stateNext: "B" } ],
        },
        chart:
        {
            ...empty.chart,
            indicators:
            {
                initialStateIndicator: { state: "A", x: 0, y: 0 },
                terminalStateIndicators: [ { id: 7, x: 100, y: 300 }, { id: 9, x: 400, y: 300 } ],
                terminalStateTransitions: terminalState ? [
                    { state: "A", terminalStateIndicatorId: 7 },
                    { state: "B", terminalStateIndicatorId: 7 },
                ] : [],
            },
        },
    };
}

function legacyFixture ( version: FileDocumentV1["file_version"] ): FileDocumentV1
{
    return { ...encodeFileDocumentV1 ( fixture ( true ) ), file_version: version };
}

function inspectCsv ( draft: AuthoringDraft, text: string )
{
    const parsed = prepareTerminalStateCsvImport ( text );

    if ( !parsed.isSuccessful )
    {
        throw new Error ( "Test CSV must parse." );
    }

    return inspectModelElementImport ( draft, parsed.modelImport );
}

describe ( "terminal file foundation", () =>
{
    it ( "keeps public schema, source schema, and generated validator equivalent", () =>
    {
        const schema = JSON.parse ( readFileSync (
            "public/schema/automata-lab-state-machine-1.4.0.schema.json", "utf8",
        ) );
        const oracle = new Ajv2020 ( { strict: true, allErrors: true } ).compile ( schema );
        const source = encodeFileDocumentV1_4 ( fixture () );

        expect ( schema ).toEqual ( FILE_SCHEMA_V1_4 );
        for ( const value of [ true, false, "true", "false", 0, 1, null, undefined, {}, [] ] )
        {
            const input = {
                ...source,
                state_machine: { ...source.state_machine, states: [ {
                    name: "A", description: "", ...( value === undefined ? {} : { terminal_state: value } ),
                } ] },
            };
            expect ( validateModernFile ( input ) ).toBe ( oracle ( input ) );
            expect ( validateModernFile ( input ) ).toBe ( typeof value === "boolean" );
        }
    } );

    it.each ( LEGACY_VERSIONS ) ( "migrates only configured shared relations from %s", version =>
    {
        const source = legacyFixture ( version );
        const before = JSON.stringify ( source );
        const opened = CODEC.open ( before );

        expect ( opened.isSuccessful ).toBe ( true );
        if ( !opened.isSuccessful )
        {
            throw new Error ( "Legacy fixture must open." );
        }
        expect ( opened.document.stateMachine.states.map ( state => state.terminalState ) )
            .toEqual ( [ true, true, false ] );
        expect ( opened.document.chart.indicators.terminalStateIndicators )
            .toEqual ( fixture ( true ).chart.indicators.terminalStateIndicators );
        expect ( opened.notices ).toMatchObject ( [ {
            kind: "legacy_migration", sourceVersion: version, convertedStateCount: 2,
        } ] );
        expect ( opened.notices [ 0 ]?.message ).toContain ( "next Save will write format 1.4.0" );
        expect ( JSON.stringify ( source ) ).toBe ( before );

        const saved = CODEC.serialize ( opened.document );
        if ( !saved.isSuccessful )
        {
            throw new Error ( "Migrated document must serialize." );
        }
        const reopened = CODEC.open ( saved.text );
        if ( !reopened.isSuccessful )
        {
            throw new Error ( "Canonical document must open." );
        }
        expect ( reopened.notices ).toEqual ( [] );
        expect ( reopened.document ).toEqual ( opened.document );
        expect ( CODEC.serialize ( reopened.document ) ).toMatchObject ( { text: saved.text } );
        expect ( JSON.parse ( saved.text ).file_version ).toBe ( "1.4.0" );
    } );

    it.each ( LEGACY_VERSIONS ) ( "rejects the new field in original schema %s", version =>
    {
        const source = legacyFixture ( version );
        const input = { ...source, state_machine: { ...source.state_machine, states: [ {
            name: "A", description: "", terminal_state: false,
        } ] } };
        expect ( CODEC.openAuthoring ( JSON.stringify ( input ) ) ).toMatchObject ( {
            isSuccessful: false, diagnostics: [ { code: "FILE_SCHEMA_INVALID" } ],
        } );
    } );

    it ( "does not infer terminal membership from orphan, direct, half-connected, or event drafts", () =>
    {
        const base = encodeFileDocumentV1 ( fixture () );
        const source: FileDocumentV1 = {
            ...base,
            file_version: "1.3.0",
            chart: {
                ...base.chart,
                indicators: {
                    ...base.chart.indicators,
                    indicator_transitions: [ { id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 7 } } ],
                },
                draft_transitions: [
                    { id: 1, source: { x: 1, y: 1 }, target: { x: 2, y: 2 }, target_indicator: { kind: "terminal", id: 9 } },
                    { id: 2, source: { x: 1, y: 1 }, target: { x: 2, y: 2 }, source_state: "A", target_state: "B" },
                ],
            },
        };
        const opened = CODEC.open ( JSON.stringify ( source ) );
        if ( !opened.isSuccessful )
        {
            throw new Error ( "Visual draft fixture must open." );
        }
        expect ( opened.document.stateMachine.states.every ( state => !state.terminalState ) ).toBe ( true );
        expect ( opened.document.chart.draftTransitions ).toHaveLength ( 2 );
        expect ( opened.document.chart.indicators.indicatorTransitions ).toHaveLength ( 1 );
        expect ( opened.notices ).toMatchObject ( [ { convertedStateCount: 0 } ] );
    } );

    it.each ( [ null, "true", "false", 0, 1, {}, [] ] ) ( "rejects invalid modern boolean %j", value =>
    {
        const source = encodeFileDocumentV1_4 ( fixture () );
        const input = { ...source, state_machine: { ...source.state_machine, states: [ {
            name: "A", description: "", terminal_state: value,
        } ] } };
        expect ( CODEC.openAuthoring ( JSON.stringify ( input ) ).isSuccessful ).toBe ( false );
    } );

    it ( "rejects missing fields, aliases, unknown properties, duplicate members, and unsupported versions", () =>
    {
        const source = encodeFileDocumentV1_4 ( fixture () );
        for ( const state of [
            { name: "A", description: "" },
            { name: "A", description: "", terminal_State: true },
            { name: "A", description: "", terminalState: true },
            { name: "A", description: "", terminal_state: false, extra: 1 },
        ] )
        {
            expect ( CODEC.openAuthoring ( JSON.stringify ( {
                ...source, state_machine: { ...source.state_machine, states: [ state ] },
            } ) ).isSuccessful ).toBe ( false );
        }
        expect ( CODEC.openAuthoring ( JSON.stringify ( source ).replace (
            '"terminal_state":false', '"terminal_state":false,"terminal_state":true',
        ) ).isSuccessful ).toBe ( false );
        expect ( CODEC.openAuthoring ( JSON.stringify ( { ...source, file_version: "1.5.0" } ) ) )
            .toMatchObject ( { isSuccessful: false, diagnostics: [ { code: "FILE_VERSION_UNSUPPORTED" } ] } );
        expect ( CODEC.openAuthoring ( JSON.stringify ( { ...source, file_id: "other" } ) ) )
            .toMatchObject ( { isSuccessful: false, diagnostics: [ { code: "FILE_ID_INVALID" } ] } );
    } );

    it.each ( LEGACY_VERSIONS ) ( "rejects dangling and duplicate relations before preparation for %s", version =>
    {
        const source = legacyFixture ( version );
        const prepare = vi.fn ( IDENTITY_PREPARATION.prepare );
        const codec = new TerminalStateDocumentCodec ( { prepare } );
        for ( const relations of [
            [ { state: "A", terminal_state_indicator_id: 999 } ],
            [ { state: "missing", terminal_state_indicator_id: 7 } ],
            [ { state: "A", terminal_state_indicator_id: 7 }, { state: "A", terminal_state_indicator_id: 9 } ],
        ] )
        {
            expect ( codec.openAuthoring ( JSON.stringify ( { ...source, chart: {
                ...source.chart, indicators: { ...source.chart.indicators, terminal_state_transitions: relations },
            } } ) ).isSuccessful ).toBe ( false );
        }
        expect ( prepare ).not.toHaveBeenCalled ();
    } );

    it ( "passes authoritative modern false flags to repair while retaining unrelated indicators", () =>
    {
        const source = encodeFileDocumentV1_4 ( fixture ( true ) );
        const input = { ...source, state_machine: { ...source.state_machine, states:
            source.state_machine.states.map ( state => ( { ...state, terminal_state: false } ) ),
        } };
        const prepare = vi.fn<TerminalStatePreparationPort["prepare"]> ( document => ( {
            isSuccessful: true,
            document: { ...document, chart: { ...document.chart, indicators: {
                ...document.chart.indicators, terminalStateTransitions: [],
            } } },
            summary: { ...NO_REPAIR, removedRelationCount: 2 },
        } ) );
        const opened = new TerminalStateDocumentCodec ( { prepare } ).open ( JSON.stringify ( input ) );
        if ( !opened.isSuccessful )
        {
            throw new Error ( "Prepared modern document must open." );
        }
        expect ( prepare.mock.calls [ 0 ]?.[ 0 ].stateMachine.states.every ( state => !state.terminalState ) ).toBe ( true );
        expect ( opened.document.chart.indicators.terminalStateIndicators ).toHaveLength ( 2 );
        expect ( opened.notices ).toMatchObject ( [ { kind: "notation_repair", summary: { removedRelationCount: 2 } } ] );
        expect ( CODEC.open ( JSON.stringify ( input ) ).isSuccessful ).toBe ( false );
        expect ( CODEC.serialize ( opened.document ) ).toMatchObject ( { isSuccessful: true, notices: [] } );
    } );

    it ( "requires preparation for true states with missing notation and preserves input on failure", () =>
    {
        const source = fixture ( true );
        const inconsistent = { ...source, chart: { ...source.chart, indicators: {
            ...source.chart.indicators, terminalStateTransitions: [],
        } } };
        const before = JSON.stringify ( inconsistent );
        expect ( CODEC.serialize ( inconsistent ).isSuccessful ).toBe ( false );
        expect ( CODEC.open ( JSON.stringify ( encodeFileDocumentV1_4 ( inconsistent ) ) ).isSuccessful ).toBe ( false );
        const codec = new TerminalStateDocumentCodec ( { prepare: () => ( {
            isSuccessful: false,
            diagnostics: [ { code: "CAPACITY", severity: "error", source: "preparation",
                message: "No room for terminal notation.", remediation: "Remove unused indicators." } ],
        } ) } );
        expect ( codec.serialize ( inconsistent ) ).toMatchObject ( { isSuccessful: false, diagnostics: [ { code: "CAPACITY" } ] } );
        expect ( JSON.stringify ( inconsistent ) ).toBe ( before );
    } );

    it ( "rejects modern invalid references before contradictory false notation can be removed", () =>
    {
        const source = encodeFileDocumentV1_4 ( fixture () );
        const prepare = vi.fn ( IDENTITY_PREPARATION.prepare );
        const input = { ...source, chart: { ...source.chart, indicators: {
            ...source.chart.indicators, terminal_state_transitions: [ { state: "A", terminal_state_indicator_id: 99 } ],
        } } };
        expect ( new TerminalStateDocumentCodec ( { prepare } ).open ( JSON.stringify ( input ) ).isSuccessful ).toBe ( false );
        expect ( prepare ).not.toHaveBeenCalled ();
    } );

    it ( "refuses a preparer that rewrites semantic flags instead of repairing notation", () =>
    {
        const codec = new TerminalStateDocumentCodec ( { prepare: () => ( {
            isSuccessful: true, document: fixture ( true ), summary: NO_REPAIR,
        } ) } );
        expect ( codec.serialize ( fixture () ).isSuccessful ).toBe ( false );
    } );

    it ( "writes explicit false values and format 1.4.0 even for an empty authoring document", () =>
    {
        const source = fixture ();
        const saved = CODEC.serialize ( source );
        if ( !saved.isSuccessful )
        {
            throw new Error ( "Document must save." );
        }
        const parsed = JSON.parse ( saved.text );
        expect ( parsed.state_machine.states ).toEqual ( source.stateMachine.states.map ( state => ( {
            name: state.name, description: state.description, terminal_state: false,
        } ) ) );
        expect ( saved.text ).not.toContain ( '"terminalState"' );
        expect ( parsed.state_machine.events ).toEqual ( source.stateMachine.events );
        expect ( parsed.state_machine.actions ).toEqual ( source.stateMachine.actions );
        expect ( parsed.settings.version ).toBe ( "1.0.0" );
        expect ( saved.text.endsWith ( "\n" ) ).toBe ( true );
        expect ( saved.text.endsWith ( "\n\n" ) ).toBe ( false );

        const empty = CODEC.serialize ( createEmptyAuthoringDraft () );
        if ( !empty.isSuccessful )
        {
            throw new Error ( "Empty authoring document must save." );
        }
        expect ( JSON.parse ( empty.text ).file_version ).toBe ( "1.4.0" );
        expect ( CODEC.openAuthoring ( empty.text ).isSuccessful ).toBe ( true );
        expect ( CODEC.open ( empty.text ).isSuccessful ).toBe ( false );
    } );

    it ( "activates modern Open and canonical Save with atomic preparation", () =>
    {
        expect ( openAuthoringDocument ( JSON.stringify ( encodeFileDocumentV1_4 ( fixture () ) ) ).isSuccessful ).toBe ( true );
        expect ( JSON.parse ( serializeCanonicalDocument ( fixture () ).text ).file_version ).toBe ( "1.4.0" );
    } );
} );

describe ( "terminal state data contracts", () =>
{
    it ( "changes the semantic hash for flags while ignoring geometry and notation repair", () =>
    {
        const draft = fixture ( true );
        const digest = ( document: AuthoringDraft ) => createHash ( "sha256" )
            .update ( serializeCanonicalHostedContent ( document ) ).digest ( "hex" );
        const moved = { ...draft, chart: { ...draft.chart, indicators: {
            ...draft.chart.indicators,
            terminalStateIndicators: draft.chart.indicators.terminalStateIndicators.map ( indicator => ( {
                ...indicator, x: indicator.x + 400,
            } ) ),
        } } };
        const noNotation = { ...draft, chart: createEmptyAuthoringDraft ().chart };
        expect ( digest ( moved ) ).toBe ( digest ( draft ) );
        expect ( digest ( noNotation ) ).toBe ( digest ( draft ) );
        expect ( digest ( fixture () ) ).not.toBe ( digest ( draft ) );
    } );

    it ( "copies flags into compiled states while retaining ordered actions", () =>
    {
        const compiled = compileDocument ( fixture ( true ) );
        expect ( compiled.statesByName.get ( "A" )?.terminalState ).toBe ( true );
        expect ( compiled.statesByName.get ( "B" ) ).toMatchObject ( {
            terminalState: true, entryActions: [ "report" ], exitActions: [],
        } );
        expect ( compiled.statesByName.get ( "C" )?.terminalState ).toBe ( false );
        expect ( compileDocument ( fixture () ).statesByName.get ( "A" )?.terminalState ).toBe ( false );
    } );

    it.each ( [ "state", "event", "action" ] as const ) ( "defaults only new %s declarations through commands", entityKind =>
    {
        const state = createDocumentEditorState ( fixture () );
        const plan = planDocumentCommand ( state, {
            kind: "add_entity", entityKind, entity: { name: "new", description: "" },
            expectedRevision: state.documentRevision,
            ...( entityKind === "state" ? { chartPlacement: { state: "new", x: 50, y: 100 } } : {} ),
        } );
        if ( !plan.isSuccessful )
        {
            throw new Error ( "Add must plan." );
        }
        const collection = entityKind === "state" ? plan.plan.resultingDraft.stateMachine.states
            : entityKind === "event" ? plan.plan.resultingDraft.stateMachine.events : plan.plan.resultingDraft.stateMachine.actions;
        expect ( collection.at ( -1 ) ).toEqual ( {
            name: "new", description: "", ...( entityKind === "state" ? { terminalState: false } : {} ),
        } );
    } );

    it ( "preserves terminal membership and shared relations during rename and description edits", () =>
    {
        const state = createDocumentEditorState ( fixture ( true ) );
        const planned = planDocumentCommand ( state, {
            kind: "update_entity", entityKind: "state", previousName: "A",
            entity: { name: "renamed", description: "Updated" }, expectedRevision: state.documentRevision,
        } );
        if ( !planned.isSuccessful )
        {
            throw new Error ( "Edit must plan." );
        }
        expect ( planned.plan.resultingDraft.stateMachine.states [ 0 ] ).toEqual ( {
            name: "renamed", description: "Updated", terminalState: true,
        } );
        expect ( hasCoherentTerminalStateNotation ( planned.plan.resultingDraft ) ).toBe ( true );
    } );

    it ( "rejects invalid terminal values at the domain boundary", () =>
    {
        const draft = fixture ();
        const state = draft.stateMachine.states [ 0 ];
        if ( state === undefined )
        {
            throw new Error ( "Fixture needs a state." );
        }
        for ( const value of [ "true", null, 0, undefined ] )
        {
            const malformed = { ...draft, stateMachine: { ...draft.stateMachine, states: [ {
                ...state, terminalState: value,
            } ] } };
            // Deliberately cross the typed boundary as malformed external input.
            // @ts-expect-error terminalState rejects non-boolean domain values.
            expect ( validatePersistableAuthoringDraft ( malformed ) ).toMatchObject ( {
                isValid: false, diagnostics: expect.arrayContaining ( [ expect.objectContaining ( {
                    code: "STATE_TERMINAL_FLAG_INVALID",
                } ) ] ),
            } );
        }
    } );
} );

describe ( "terminal States CSV foundation", () =>
{
    it ( "preserves overwritten flags without the optional column and defaults new states false", () =>
    {
        const draft = fixture ( true );
        const inspected = inspectCsv ( draft, "name,description\r\nA,updated\r\nD,new\r\n" );
        if ( !inspected.isSuccessful )
        {
            throw new Error ( "Import must inspect." );
        }
        expect ( inspected.resultingDraft.stateMachine.states ).toMatchObject ( [
            { name: "A", description: "updated", terminalState: true },
            { name: "B", terminalState: true }, { name: "C", terminalState: false },
            { name: "D", terminalState: false },
        ] );
        expect ( inspected.conflicts ).toEqual ( [ { key: "A" } ] );
        expect ( inspected.resultingDraft.chart ).toBe ( draft.chart );
    } );

    it ( "normalizes explicit boolean text while preserving order and requiring subsequent chart repair", () =>
    {
        const before = fixture ( true );
        const inspected = inspectCsv ( before, "name,description,terminal_state\nA,updated, False \nD,new, TRUE \n" );
        if ( !inspected.isSuccessful )
        {
            throw new Error ( "Import must inspect." );
        }
        expect ( inspected.resultingDraft.stateMachine.states [ 0 ]?.terminalState ).toBe ( false );
        expect ( inspected.resultingDraft.stateMachine.states.at ( -1 )?.terminalState ).toBe ( true );
        expect ( inspected.resultingDraft.chart ).toBe ( before.chart );
        expect ( hasCoherentTerminalStateNotation ( inspected.resultingDraft ) ).toBe ( false );
        expect ( before.stateMachine.states [ 0 ]?.terminalState ).toBe ( true );
    } );

    it.each ( [ "", " ", "yes", "no", "0", "1", "null" ] ) ( "rejects the entire CSV for terminal value %j", value =>
    {
        expect ( prepareTerminalStateCsvImport ( "name,description,terminal_state\nA,,true\nB,," + value + "\n" ) )
            .toMatchObject ( { isSuccessful: false, diagnostics: [ { code: "CSV_TERMINAL_STATE_INVALID" } ] } );
    } );

    it ( "round-trips quoted state fields and both flags through the new projection", () =>
    {
        const draft = fixture ( true );
        const source = { ...draft, stateMachine: { ...draft.stateMachine, states:
            draft.stateMachine.states.map ( state => ( { ...state, description: 'Quoted "text",\nnext line' } ) ),
        } };
        const exported = createTerminalStateCsvExportDocument ( source );
        const inspected = inspectCsv ( createEmptyAuthoringDraft (), exported.text );
        if ( !inspected.isSuccessful )
        {
            throw new Error ( "Exported CSV must inspect." );
        }
        expect ( exported.text.startsWith ( "name,description,terminal_state\r\n" ) ).toBe ( true );
        expect ( inspected.resultingDraft.stateMachine.states ).toEqual ( source.stateMachine.states );
        expect ( prepareCsvModelElementImport ( exported.text, "states" ).isSuccessful ).toBe ( true );
    } );
} );

describe ( "Solver terminal defaults", () =>
{
    it.each ( [
        { rawTokens: [] },
        { rawTokens: [ "state_start", "event_go", "state_end" ] },
        { rawTokens: [ "action_ready", "event_go", "action_done" ] },
    ] ) ( "generates false flags across the worker boundary: $rawTokens", ( { rawTokens } ) =>
    {
        const result = inferSolverCandidate ( {
            documentRevision: 0, solverRevision: 0,
            observations: rawTokens.length === 0 ? [] : [ { name: "input", startContext: "initial", rawTokens } ],
        } );
        if ( result.status !== "success" )
        {
            throw new Error ( "Solver fixture must succeed." );
        }
        expect ( result.candidate.stateMachine.states.every ( state => state.terminalState === false ) ).toBe ( true );
        const envelope = { protocolVersion: SOLVER_PROTOCOL_VERSION, kind: "result", jobId: "terminal", result };
        expect ( decodeSolverWorkerMessage ( envelope ) ).not.toBeNull ();
        for ( const terminalState of [ true, null, "false", undefined ] )
        {
            expect ( decodeSolverWorkerMessage ( { ...envelope, result: { ...result, candidate: {
                ...result.candidate, stateMachine: { ...result.candidate.stateMachine, states:
                    result.candidate.stateMachine.states.map ( state => ( { ...state, terminalState } ) ),
                },
            } } } ) ).toBeNull ();
        }
    } );
} );

describe ( "terminal preparation and transfer guard regressions", () =>
{
    it ( "accepts a complete injected repair for missing true-state notation and saves it once", () =>
    {
        const coherent = fixture ( true );
        const unprepared = { ...coherent, chart: { ...coherent.chart, indicators: {
            ...coherent.chart.indicators, terminalStateTransitions: [],
        } } };
        const prepare = vi.fn<TerminalStatePreparationPort["prepare"]> ( document => ( {
            isSuccessful: true,
            document: hasCoherentTerminalStateNotation ( document ) ? document : coherent,
            summary: hasCoherentTerminalStateNotation ( document )
                ? NO_REPAIR : { ...NO_REPAIR, addedRelationCount: 2 },
        } ) );
        const codec = new TerminalStateDocumentCodec ( { prepare } );
        const opened = codec.open ( JSON.stringify ( encodeFileDocumentV1_4 ( unprepared ) ) );

        if ( !opened.isSuccessful )
        {
            throw new Error ( "The injected complete repair must succeed." );
        }

        expect ( opened.document ).toEqual ( coherent );
        expect ( opened.notices ).toMatchObject ( [ { kind: "notation_repair" } ] );
        const saved = codec.serialize ( opened.document );

        if ( !saved.isSuccessful )
        {
            throw new Error ( "Prepared content must save." );
        }

        expect ( saved.notices ).toEqual ( [] );
        expect ( codec.open ( saved.text ) ).toMatchObject ( {
            isSuccessful: true, document: coherent, notices: [],
        } );
        expect ( unprepared.chart.indicators.terminalStateTransitions ).toEqual ( [] );
    } );

    it ( "retains 1.3.0 direct connections, draft endpoint roles, and memory in canonical 1.4.0", () =>
    {
        const draft = fixture ();
        const withDrafts: AuthoringDraft = {
            ...draft,
            chart: {
                ...draft.chart,
                indicators: {
                    ...draft.chart.indicators,
                    indicatorTransitions: [ {
                        id: 5, source: { kind: "initial" }, target: { kind: "terminal", id: 7 },
                    } ],
                },
                draftTransitions: [
                    { id: 1, source: { x: 3, y: 4 }, target: { x: 5, y: 6 },
                        sourceIndicator: { kind: "initial" }, targetState: "A" },
                    { id: 2, source: { x: 7, y: 8 }, target: { x: 9, y: 10 },
                        sourceState: "B", rememberedEvent: "go", rememberedTransitionIndex: 0 },
                ],
            },
        };
        const saved = CODEC.serialize ( withDrafts );

        if ( !saved.isSuccessful )
        {
            throw new Error ( "Modern draft data must save." );
        }

        const opened = CODEC.openAuthoring ( saved.text );
        expect ( opened ).toMatchObject ( { isSuccessful: true, document: withDrafts, notices: [] } );
    } );

    it ( "rejects invalid modern capacities before calling the preparation boundary", () =>
    {
        const source = encodeFileDocumentV1_4 ( fixture () );
        const prepare = vi.fn ( IDENTITY_PREPARATION.prepare );
        const input = { ...source, chart: { ...source.chart, indicators: {
            ...source.chart.indicators,
            terminal_state_indicators: Array.from ( { length: 10_001 }, ( _, index ) => ( {
                id: index, x: 0, y: 0,
            } ) ),
        } } };
        expect ( new TerminalStateDocumentCodec ( { prepare } ).openAuthoring ( JSON.stringify ( input ) ) )
            .toMatchObject ( { isSuccessful: false, diagnostics: [ { code: "FILE_SCHEMA_INVALID" } ] } );
        expect ( prepare ).not.toHaveBeenCalled ();
    } );

    it ( "canonical serialization preserves explicit terminal flags", () =>
    {
        expect ( JSON.parse ( serializeCanonicalDocument ( fixture ( true ) ).text ).state_machine.states [ 0 ].terminal_state ).toBe ( true );
    } );

    it ( "rejects an unprepared terminal CSV command atomically", () =>
    {
        const state = createDocumentEditorState ( fixture () );
        const initialRevision = state.documentRevision;
        const parsed = prepareTerminalStateCsvImport ( "name,description,terminal_state\nA,,true\n" );

        if ( !parsed.isSuccessful )
        {
            throw new Error ( "CSV proposal must parse." );
        }

        const planned = planDocumentCommand ( state, {
            kind: "import_model_elements", modelImport: parsed.modelImport,
            overwriteConflicts: true, expectedRevision: state.documentRevision,
        } );
        expect ( planned.isSuccessful ).toBe ( false );
        expect ( state.draft.stateMachine.states [ 0 ]?.terminalState ).toBe ( false );
        expect ( state.documentRevision ).toBe ( initialRevision );
    } );

    it ( "rejects invalid booleans in direct domain import proposals", () =>
    {
        const malformed = {
            kind: "named_entities" as const, entityKind: "state" as const,
            rows: [ { rowNumber: 2, value: { name: "A", description: "", terminalState: "true" } } ],
        };
        // @ts-expect-error The domain boundary must also reject untyped invalid import values.
        expect ( inspectModelElementImport ( fixture (), malformed ) ).toMatchObject ( {
            isSuccessful: false, diagnostics: [ { code: "CSV_TERMINAL_STATE_INVALID" } ],
        } );
    } );
} );


describe ( "TS5 maintained terminal examples", () =>
{
    it ( "migrates the legacy example to the same model as its explicit modern counterpart", () =>
    {
        const codec = new AutomataDocumentCodec ();
        const legacyText = readFileSync ( "../examples/state-machine-light-switch.json", "utf8" );
        const modernText = readFileSync ( "../examples/state-machine-terminal-states.json", "utf8" );
        const legacy = codec.open ( legacyText );
        const modern = codec.open ( modernText );
        expect ( validateModernFile ( JSON.parse ( modernText ) ) ).toBe ( true );
        if ( !legacy.isSuccessful || !modern.isSuccessful )
        {
            throw new Error ( "Both maintained examples must open through the strict prepared codec." );
        }
        expect ( modern.document ).toEqual ( legacy.document );
        expect ( modern.document.stateMachine.states.filter ( state => state.terminalState ).map ( state => state.name ) )
            .toEqual ( [ "state_fuse_blown" ] );
        expect ( modern.notices ).toEqual ( [] );
        const saved = serializeCanonicalDocument ( modern.document ).text;
        const reopened = codec.open ( saved );
        expect ( reopened.isSuccessful && serializeCanonicalDocument ( reopened.document ).text ).toBe ( saved );
    } );
} );

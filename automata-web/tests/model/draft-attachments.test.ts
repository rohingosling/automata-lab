// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Draft Endpoint Attachment Tests
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies attachment history, reference closure, and strict versioned file persistence.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { createDocumentEditorState, executeDocumentCommand, planDocumentCommand,
    undoDocumentCommand, redoDocumentCommand } from "../../src/domain/model/commands.js";
import type { DocumentCommand, DocumentEditorState } from "../../src/domain/model/commands.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { encodeFileDocumentV1, serializeCanonicalDocument,
    serializeCanonicalHostedContent } from "../../src/domain/model/canonicalization.js";
import { openAuthoringDocument, openAutomataDocument } from "../../src/infrastructure/files/file-codec.js";
import { resolveAuthoringDraftAttachments } from "../../src/presentation/chart/chart-projection.js";
import { DEFAULT_APPLICATION_PREFERENCES } from "../../src/infrastructure/preferences/index.js";
import { FILE_SCHEMA_V1_1 } from "../../src/infrastructure/files/schema-v1.js";

//--------------------------------------------------------------------------------------------------
// Function: fixture
//
// Description:
//
//   Creates a complete semantic model with one free chart-only draft.
//--------------------------------------------------------------------------------------------------

function fixture (): DocumentEditorState
{
    const draft = createEmptyAuthoringDraft ( false );
    return createDocumentEditorState ( {
        ...draft,
        stateMachine:
        {
            ...draft.stateMachine,
            states: [ { name: "A", description: "" }, { name: "B", description: "" } ],
            events: [ { name: "go", description: "" } ],
            initialState: "A",
        },
        chart:
        {
            ...draft.chart,
            states: [ { state: "A", x: 0, y: 0 }, { state: "B", x: 500, y: 0 } ],
            draftTransitions: [ { id: 1, source: { x: 100, y: 50 }, target: { x: 600, y: 50 } } ],
        },
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: execute
//
// Description:
//
//   Applies the same revision-checked command plan used by the application.
//--------------------------------------------------------------------------------------------------

function execute ( state: DocumentEditorState, command: DocumentCommand ): DocumentEditorState
{
    const planned = planDocumentCommand ( state, command );
    if ( !planned.isSuccessful )
    {
        throw new Error ( planned.message );
    }
    const executed = executeDocumentCommand ( state, planned.plan );
    if ( !executed.isSuccessful )
    {
        throw new Error ( executed.message );
    }
    return executed.state;
}

describe ( "draft attachments", () =>
{
    it.each ( [ false, true ] ) ( "attaches either end first, including self-pairs (%s)", targetFirst =>
    {
        let state = fixture ();
        const original = state.draft;
        for ( const endpoint of targetFirst ? [ "target", "source" ] as const : [ "source", "target" ] as const )
        {
            state = execute ( state, {
                kind: "update_chart_draft_endpoint", draftTransitionId: 1, endpoint,
                point: { x: 150, y: 50 }, state: "A", expectedRevision: state.documentRevision,
            } );
        }
        expect ( state.draft.stateMachine ).toBe ( original.stateMachine );
        expect ( state.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( {
            sourceState: "A", targetState: "A",
        } );
        const beforeConfirm = state.draft;
        state = execute ( state, {
            kind: "configure_chart_draft_transition", draftTransitionId: 1,
            transition: { state: "A", event: "go", stateNext: "A" }, expectedRevision: state.documentRevision,
        } );
        expect ( state.draft.chart.draftTransitions ).toEqual ( [] );
        const undone = undoDocumentCommand ( state );
        expect ( undone.isSuccessful ).toBe ( true );
        if ( !undone.isSuccessful )
        {
            return;
        }
        expect ( undone.state.draft ).toEqual ( beforeConfirm );
        const redone = redoDocumentCommand ( undone.state );
        expect ( redone.isSuccessful ).toBe ( true );
        if ( redone.isSuccessful )
        {
            expect ( redone.state.draft ).toEqual ( state.draft );
        }
    } );

    it ( "renames references and detaches them on deletion with undo", () =>
    {
        let state = fixture ();
        state = execute ( state, {
            kind: "update_chart_draft_endpoint", draftTransitionId: 1, endpoint: "source",
            point: { x: 150, y: 50 }, state: "A", expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "rename_entity", entityKind: "state", previousName: "A", newName: "Renamed",
            expectedRevision: state.documentRevision,
        } );
        expect ( state.draft.chart.draftTransitions [ 0 ]?.sourceState ).toBe ( "Renamed" );
        const beforeDeletion = state.draft;
        state = execute ( state, {
            kind: "delete_entity", entityKind: "state", name: "Renamed", expectedRevision: state.documentRevision,
        } );
        expect ( state.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( {
            sourceState: null, source: { x: 150, y: 50 },
        } );
        const undone = undoDocumentCommand ( state );
        if ( !undone.isSuccessful )
        {
            throw new Error ( undone.message );
        }
        expect ( undone.state.draft ).toEqual ( beforeDeletion );
    } );

    it ( "detaches at the current resized state center and preserves the other attachment", () =>
    {
        let state = fixture ();
        for ( const endpoint of [ "source", "target" ] as const )
        {
            state = execute ( state, {
                kind: "update_chart_draft_endpoint", draftTransitionId: 1, endpoint,
                point: { x: 150, y: 50 }, state: endpoint === "source" ? "A" : "B",
                expectedRevision: state.documentRevision,
            } );
        }
        const resolved = resolveAuthoringDraftAttachments ( state.draft, {
            ...DEFAULT_APPLICATION_PREFERENCES, collapsedStateWidth: 400, collapsedStateHeight: 200,
        } );
        expect ( resolved.chart.draftTransitions [ 0 ]?.source ).toEqual ( { x: 200, y: 100 } );
        state = execute ( state, {
            kind: "delete_entity", entityKind: "state", name: "A",
            draftEndpointPositions: resolved.chart.draftTransitions, expectedRevision: state.documentRevision,
        } );
        expect ( state.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( {
            sourceState: null, source: { x: 200, y: 100 }, targetState: "B",
        } );
    } );

    it ( "rejects missing states and stale endpoint commands without mutation", () =>
    {
        const state = fixture ();
        const command = {
            kind: "update_chart_draft_endpoint" as const, draftTransitionId: 1, endpoint: "target" as const,
            point: { x: 0, y: 0 }, state: "missing", expectedRevision: state.documentRevision,
        };
        expect ( planDocumentCommand ( state, command ).isSuccessful ).toBe ( false );
        expect ( planDocumentCommand ( state, { ...command, state: "A", expectedRevision: -1 } )
            .isSuccessful ).toBe ( false );
        expect ( state.draft.chart.draftTransitions [ 0 ]?.targetState ).toBeUndefined ();
    } );

    it ( "uses the minimum file version and preserves attachments through authoring and strict readers", () =>
    {
        const original = fixture ().draft;
        const draft = { ...original, chart: { ...original.chart, draftTransitions:
            original.chart.draftTransitions.map ( transition => ( {
                ...transition, sourceState: "A", targetState: "B",
            } ) ),
        } };
        expect ( encodeFileDocumentV1 ( original ).file_version ).toBe ( "1.0.0" );
        expect ( encodeFileDocumentV1 ( draft ).file_version ).toBe ( "1.1.0" );
        const serialized = serializeCanonicalDocument ( draft );
        for ( const reader of [ openAuthoringDocument, openAutomataDocument ] )
        {
            const opened = reader ( serialized.text );
            expect ( opened.isSuccessful ).toBe ( true );
            if ( !opened.isSuccessful )
            {
                throw new Error ( JSON.stringify ( opened.diagnostics ) );
            }
            expect ( opened.document.chart.draftTransitions ).toEqual ( draft.chart.draftTransitions );
            expect ( serializeCanonicalDocument ( opened.document ).text ).toBe ( serialized.text );
        }
        const originalOpened = openAutomataDocument ( serializeCanonicalDocument ( original ).text );
        const attachedOpened = openAutomataDocument ( serialized.text );
        if ( !originalOpened.isSuccessful || !attachedOpened.isSuccessful )
        {
            throw new Error ( "Invalid fixture" );
        }
        expect ( serializeCanonicalHostedContent ( attachedOpened.document ) )
            .toBe ( serializeCanonicalHostedContent ( originalOpened.document ) );
    } );

    it ( "rejects attachment fields in 1.0.0, dangling references, and unknown 1.1.0 properties", () =>
    {
        const draft = fixture ().draft;
        const file = encodeFileDocumentV1 ( draft );
        for ( const [ version, attachments ] of [
            [ "1.0.0", { source_state: null } ],
            [ "1.1.0", { source_state: "missing" } ],
            [ "1.1.0", { source_state: "A", unexpected: true } ],
            [ "1.1.0", { source_state: 42 } ],
        ] as const )
        {
            const input = { ...file, file_version: version, chart: { ...file.chart,
                draft_transitions: [ { id: 1, source: { x: 0, y: 0 }, target: { x: 0, y: 0 }, ...attachments } ],
            } };
            expect ( openAuthoringDocument ( JSON.stringify ( input ) ).isSuccessful ).toBe ( false );
        }
    } );

    it ( "keeps public and source 1.1.0 schemas equivalent on attachment fixtures", () =>
    {
        const publicSchema = JSON.parse ( readFileSync (
            "public/schema/automata-lab-state-machine-1.1.0.schema.json", "utf8",
        ) );
        const validatePublic = new Ajv2020 ( { strict: true } ).compile ( publicSchema );
        const validateSource = new Ajv2020 ( { strict: true } ).compile ( FILE_SCHEMA_V1_1 );
        const input = encodeFileDocumentV1 ( fixture ().draft );
        for ( const sourceState of [ "A", null, 42, "" ] )
        {
            const value = { ...input, file_version: "1.1.0", chart: { ...input.chart,
                draft_transitions: [ { id: 1, source: { x: 0, y: 0 }, target: { x: 0, y: 0 }, source_state: sourceState } ],
            } };
            expect ( validateSource ( value ) ).toBe ( validatePublic ( value ) );
        }
    } );
} );

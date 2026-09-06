// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Detached Transition Tests
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies atomic transition detachment, remembered restoration, history, and versioned
//   persistence.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { createDocumentEditorState, executeDocumentCommand, planDocumentCommand,
    redoDocumentCommand, undoDocumentCommand } from "../../src/domain/model/commands.js";
import type { DocumentCommand, DocumentEditorState } from "../../src/domain/model/commands.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { encodeFileDocumentV1, serializeCanonicalDocument,
    serializeCanonicalHostedContent } from "../../src/domain/model/canonicalization.js";
import { MAXIMUM_CHART_DRAFT_TRANSITION_COUNT, MAXIMUM_TRANSITION_COUNT } from "../../src/domain/model/limits.js";
import { openAuthoringDocument, openAutomataDocument } from "../../src/infrastructure/files/file-codec.js";
import { FILE_SCHEMA_V1_2 } from "../../src/infrastructure/files/schema-v1.js";

//--------------------------------------------------------------------------------------------------
// Function: fixture
//
// Description:
//
//   Creates ordered transitions with the selected A-to-B transition between two surviving rows.
//--------------------------------------------------------------------------------------------------

function fixture (): DocumentEditorState
{
    const draft = createEmptyAuthoringDraft ( false );
    return createDocumentEditorState ( {
        ...draft,
        stateMachine:
        {
            ...draft.stateMachine,
            states: [ "A", "B", "C" ].map ( name => ( { name, description: "" } ) ),
            events: [ { name: "go", description: "" }, { name: "other", description: "" } ],
            initialState: "A",
            transitionTable: [
                { state: "C", event: "go", stateNext: "A" },
                { state: "A", event: "go", stateNext: "B" },
                { state: "B", event: "go", stateNext: "C" },
            ],
        },
        chart:
        {
            ...draft.chart,
            states: [ { state: "A", x: 0, y: 0 }, { state: "B", x: 500, y: 0 }, { state: "C", x: 1000, y: 0 } ],
        },
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: execute
//
// Description:
//
//   Commits a validated command through the production history boundary.
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

//--------------------------------------------------------------------------------------------------
// Function: detach
//
// Description:
//
//   Releases one end into free space and captures the opposite state's effective center.
//--------------------------------------------------------------------------------------------------

function detach ( state: DocumentEditorState, endpoint: "source" | "target" = "target" ): DocumentEditorState
{
    return execute ( state, {
        kind: "detach_transition_endpoint", index: 1, endpoint, draftTransitionId: 7,
        point: { x: 400, y: 400 }, oppositePoint: endpoint === "target" ? { x: 150, y: 50 } : { x: 650, y: 50 },
        expectedRevision: state.documentRevision,
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: moveEndpoint
//
// Description:
//
//   Applies an endpoint move with the latest revision and an explicit optional attachment.
//--------------------------------------------------------------------------------------------------

function moveEndpoint (
    state: DocumentEditorState,
    endpoint: "source" | "target",
    attachment: string | null,
): DocumentEditorState
{
    return execute ( state, {
        kind: "update_chart_draft_endpoint", draftTransitionId: 7, endpoint,
        point: { x: 300, y: 300 }, state: attachment, expectedRevision: state.documentRevision,
    } );
}

describe ( "detached transitions", () =>
{
    it.each ( [ "source", "target" ] as const ) ( "detaches and restores %s atomically at the original table position", endpoint =>
    {
        const original = fixture ();
        const detached = detach ( original, endpoint );
        expect ( detached.draft.stateMachine.transitionTable ).toEqual ( [
            original.draft.stateMachine.transitionTable [ 0 ], original.draft.stateMachine.transitionTable [ 2 ],
        ] );
        expect ( detached.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( {
            id: 7, rememberedEvent: "go", rememberedTransitionIndex: 1,
            sourceState: endpoint === "target" ? "A" : null,
            targetState: endpoint === "source" ? "B" : null,
        } );
        expect ( detached.undoStack ).toHaveLength ( 1 );
        const restored = moveEndpoint ( detached, endpoint, endpoint === "source" ? "A" : "B" );
        expect ( restored.draft.stateMachine.transitionTable ).toEqual ( original.draft.stateMachine.transitionTable );
        expect ( restored.draft.chart.draftTransitions ).toEqual ( [] );
        expect ( restored.undoStack ).toHaveLength ( 2 );
        const undoneRestore = undoDocumentCommand ( restored );
        if ( !undoneRestore.isSuccessful )
        {
            throw new Error ( undoneRestore.message );
        }
        expect ( undoneRestore.state.draft ).toEqual ( detached.draft );
        const undoneDetach = undoDocumentCommand ( undoneRestore.state );
        if ( !undoneDetach.isSuccessful )
        {
            throw new Error ( undoneDetach.message );
        }
        expect ( undoneDetach.state.draft ).toEqual ( original.draft );
        const redoneDetach = redoDocumentCommand ( undoneDetach.state );
        if ( !redoneDetach.isSuccessful )
        {
            throw new Error ( redoneDetach.message );
        }
        const redoneRestore = redoDocumentCommand ( redoneDetach.state );
        expect ( redoneRestore.isSuccessful && redoneRestore.state.draft ).toEqual ( restored.draft );
    } );

    it.each ( [ false, true ] ) ( "remembers both-free drafts and restores either attachment order, including loops (%s)", targetFirst =>
    {
        let state = moveEndpoint ( detach ( fixture () ), "source", null );
        expect ( state.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( {
            sourceState: null, targetState: null, rememberedEvent: "go",
        } );
        const saved = serializeCanonicalDocument ( state.draft );
        const opened = openAuthoringDocument ( saved.text );
        if ( !opened.isSuccessful )
        {
            throw new Error ( JSON.stringify ( opened.diagnostics ) );
        }
        state = createDocumentEditorState ( opened.document );
        const first = targetFirst ? "target" : "source";
        const second = targetFirst ? "source" : "target";
        state = moveEndpoint ( state, first, "A" );
        expect ( state.draft.chart.draftTransitions [ 0 ]?.rememberedEvent ).toBe ( "go" );
        expect ( state.draft.stateMachine.transitionTable ).toHaveLength ( 2 );
        state = moveEndpoint ( state, second, "A" );
        expect ( state.draft.chart.draftTransitions ).toEqual ( [] );
        expect ( state.draft.stateMachine.transitionTable [ 1 ] ).toEqual ( { state: "A", event: "go", stateNext: "A" } );
    } );

    it ( "rejects conflicting restoration without accepting the endpoint move or losing its event", () =>
    {
        let state = detach ( fixture () );
        state = execute ( state, {
            kind: "add_transition", transition: { state: "A", event: "go", stateNext: "C" },
            expectedRevision: state.documentRevision,
        } );
        const before = JSON.stringify ( state );
        const planned = planDocumentCommand ( state, {
            kind: "update_chart_draft_endpoint", draftTransitionId: 7, endpoint: "target", state: "B",
            point: { x: 650, y: 50 }, expectedRevision: state.documentRevision,
        } );
        expect ( planned ).toMatchObject ( { isSuccessful: false, code: "TRANSITION_EXISTS" } );
        expect ( JSON.stringify ( state ) ).toBe ( before );
    } );

    it ( "closes state/event rename and delete references without forgetting surviving attachments", () =>
    {
        let state = detach ( fixture () );
        state = execute ( state, {
            kind: "rename_entity", entityKind: "event", previousName: "go", newName: "renamed",
            expectedRevision: state.documentRevision,
        } );
        state = execute ( state, {
            kind: "rename_entity", entityKind: "state", previousName: "A", newName: "Renamed A",
            expectedRevision: state.documentRevision,
        } );
        expect ( state.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( {
            rememberedEvent: "renamed", sourceState: "Renamed A",
        } );
        const eventDelete = planDocumentCommand ( state, {
            kind: "delete_entity", entityKind: "event", name: "renamed", expectedRevision: state.documentRevision,
        } );
        expect ( eventDelete.isSuccessful && eventDelete.plan.impact.chartDraftEventReferenceCount ).toBe ( 1 );
        const before = state.draft;
        state = execute ( state, {
            kind: "delete_entity", entityKind: "event", name: "renamed", expectedRevision: state.documentRevision,
        } );
        expect ( state.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( {
            rememberedEvent: null, rememberedTransitionIndex: null, sourceState: "Renamed A",
        } );
        expect ( encodeFileDocumentV1 ( state.draft ).file_version ).toBe ( "1.1.0" );
        const undone = undoDocumentCommand ( state );
        if ( !undone.isSuccessful )
        {
            throw new Error ( undone.message );
        }
        expect ( undone.state.draft ).toEqual ( before );
        state = execute ( undone.state, {
            kind: "delete_entity", entityKind: "state", name: "Renamed A", expectedRevision: undone.state.documentRevision,
        } );
        expect ( state.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( {
            sourceState: null, rememberedEvent: "renamed", rememberedTransitionIndex: 1,
        } );
        expect ( openAuthoringDocument ( serializeCanonicalDocument ( state.draft ).text ).isSuccessful ).toBe ( true );
    } );

    it ( "does not restore a draft whose event was deleted", () =>
    {
        let state = detach ( fixture () );
        state = execute ( state, {
            kind: "delete_entity", entityKind: "event", name: "go", expectedRevision: state.documentRevision,
        } );
        state = moveEndpoint ( state, "target", "B" );
        expect ( state.draft.chart.draftTransitions ).toHaveLength ( 1 );
        expect ( state.draft.stateMachine.transitionTable ).toEqual ( [] );
    } );

    it ( "rejects stale, malformed, conflicting-identifier, and exhausted-capacity detach commands", () =>
    {
        const state = fixture ();
        const command = {
            kind: "detach_transition_endpoint" as const, index: 1, endpoint: "target" as const,
            draftTransitionId: 7, point: { x: 0, y: 0 }, oppositePoint: { x: 150, y: 50 },
            expectedRevision: state.documentRevision,
        };
        for ( const invalid of [ { ...command, expectedRevision: -1 }, { ...command, index: -1 },
            { ...command, draftTransitionId: -1 }, { ...command, point: { x: Infinity, y: 0 } },
            { ...command, oppositePoint: { x: 0, y: NaN } } ] )
        {
            expect ( planDocumentCommand ( state, invalid ).isSuccessful ).toBe ( false );
        }
        const detached = detach ( state );
        expect ( planDocumentCommand ( detached, { ...command, expectedRevision: detached.documentRevision } ) )
            .toMatchObject ( { isSuccessful: false, code: "ENTITY_EXISTS" } );
        const crowded = { ...state, draft: { ...state.draft, chart: { ...state.draft.chart,
            draftTransitions: Array.from ( { length: MAXIMUM_CHART_DRAFT_TRANSITION_COUNT }, ( _value, id ) => ( {
                id, source: { x: 0, y: 0 }, target: { x: 100, y: 100 },
            } ) ),
        } } };
        expect ( planDocumentCommand ( crowded, command ) ).toMatchObject ( { isSuccessful: false, code: "COMMAND_INVALID" } );
        const full = { ...detached, draft: { ...detached.draft, stateMachine: { ...detached.draft.stateMachine,
            transitionTable: Array.from ( { length: MAXIMUM_TRANSITION_COUNT }, () => ( {
                state: "C", event: "go", stateNext: "A",
            } ) ),
        } } };
        expect ( planDocumentCommand ( full, {
            kind: "update_chart_draft_endpoint", draftTransitionId: 7, endpoint: "target", state: "B",
            point: { x: 650, y: 50 }, expectedRevision: full.documentRevision,
        } ) ).toMatchObject ( { isSuccessful: false, code: "COMMAND_INVALID" } );
        expect ( state.undoStack ).toEqual ( [] );
    } );

    it ( "uses strict 1.2.0 only for remembered metadata and preserves it through both file readers", () =>
    {
        const draft = detach ( fixture () ).draft;
        const serialized = serializeCanonicalDocument ( draft );
        expect ( encodeFileDocumentV1 ( draft ).file_version ).toBe ( "1.2.0" );
        for ( const reader of [ openAuthoringDocument, openAutomataDocument ] )
        {
            const opened = reader ( serialized.text );
            if ( !opened.isSuccessful )
            {
                throw new Error ( JSON.stringify ( opened.diagnostics ) );
            }
            expect ( opened.document.chart.draftTransitions [ 0 ] ).toMatchObject ( {
                sourceState: "A", rememberedEvent: "go", rememberedTransitionIndex: 1,
            } );
            expect ( serializeCanonicalDocument ( opened.document ).text ).toBe ( serialized.text );
        }
        const original = openAutomataDocument ( serializeCanonicalDocument ( fixture ().draft ).text );
        const detached = openAutomataDocument ( serialized.text );
        if ( !original.isSuccessful || !detached.isSuccessful )
        {
            throw new Error ( "The strict fixtures must be valid." );
        }
        expect ( serializeCanonicalHostedContent ( original.document ) )
            .not.toBe ( serializeCanonicalHostedContent ( detached.document ) );
        const withoutMemory = { ...detached.document, chart: { ...detached.document.chart, draftTransitions: [] } };
        expect ( serializeCanonicalHostedContent ( withoutMemory ) )
            .toBe ( serializeCanonicalHostedContent ( detached.document ) );
    } );

    it ( "rejects legacy-version metadata, dangling events, invalid ordering and unknown properties", () =>
    {
        const file = encodeFileDocumentV1 ( detach ( fixture () ).draft );
        const transition = file.chart.draft_transitions?.[ 0 ];
        for ( const version of [ "1.0.0", "1.1.0" ] )
        {
            for ( const metadata of [ { remembered_event: null }, { remembered_transition_index: null } ] )
            {
                const value = { ...file, file_version: version, chart: { ...file.chart,
                    draft_transitions: [ { id: 7, source: { x: 0, y: 0 }, target: { x: 0, y: 0 }, ...metadata } ],
                } };
                expect ( openAuthoringDocument ( JSON.stringify ( value ) ).isSuccessful ).toBe ( false );
            }
        }
        for ( const invalid of [ { remembered_event: "missing" }, { remembered_event: null },
            { remembered_transition_index: -1 }, { remembered_transition_index: 0.5 },
            { remembered_transition_index: MAXIMUM_TRANSITION_COUNT }, { unknown: true } ] )
        {
            const value = { ...file, chart: { ...file.chart, draft_transitions: [ { ...transition, ...invalid } ] } };
            expect ( openAuthoringDocument ( JSON.stringify ( value ) ).isSuccessful ).toBe ( false );
        }
    } );

    it ( "keeps source and public 1.2.0 structural schemas equivalent", () =>
    {
        const publicSchema = JSON.parse ( readFileSync ( "public/schema/automata-lab-state-machine-1.2.0.schema.json", "utf8" ) );
        const validatePublic = new Ajv2020 ( { strict: true } ).compile ( publicSchema );
        const validateSource = new Ajv2020 ( { strict: true } ).compile ( FILE_SCHEMA_V1_2 );
        const file = encodeFileDocumentV1 ( detach ( fixture () ).draft );
        for ( const rememberedEvent of [ "go", null, 42, "" ] )
        {
            for ( const rememberedIndex of [ 0, null, -1, 0.5, MAXIMUM_TRANSITION_COUNT ] )
            {
                const value = { ...file, chart: { ...file.chart, draft_transitions: [ {
                    ...file.chart.draft_transitions?.[ 0 ], remembered_event: rememberedEvent,
                    remembered_transition_index: rememberedIndex,
                } ] } };
                expect ( validateSource ( value ) ).toBe ( validatePublic ( value ) );
            }
        }
    } );
} );

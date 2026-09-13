// /////////////////////////////////////////////////////////////////////////////////////////////////
// Name:    Indicator Draft Transition Tests
// Version: 1.0.0
// Date:    2026-09-08
// Author:  Rohin Gosling
// Description:
//   Verifies atomic notation conversion, durable references, deletion closure, and strict files.
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { createDocumentEditorState, executeDocumentCommand, planDocumentCommand,
    undoDocumentCommand, redoDocumentCommand } from "../../src/domain/model/commands.js";
import type { DocumentCommand, DocumentEditorState } from "../../src/domain/model/commands.js";
import type { ChartIndicatorReference } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { encodeFileDocumentV1, serializeCanonicalDocument } from "../../src/domain/model/canonicalization.js";
import { resolveDraftTransitionEndpoints } from "../../src/domain/model/draft-transition-attachments.js";
import { openAuthoringDocument } from "../../src/infrastructure/files/file-codec.js";
import { validatePersistableAuthoringDraft } from "../../src/domain/model/validation.js";
import { FILE_SCHEMA_V1_3 } from "../../src/infrastructure/files/schema-v1.js";

function fixture (): DocumentEditorState
{
    const draft = createEmptyAuthoringDraft ( false );
    return createDocumentEditorState ( {
        ...draft,
        stateMachine: { ...draft.stateMachine, states: [ { name: "A", description: "" }, { name: "B", description: "" } ],
            events: [ { name: "go", description: "" } ], initialState: "A" },
        chart:
        {
            ...draft.chart,
            states: [ { state: "A", x: 100, y: 100 }, { state: "B", x: 500, y: 100 } ],
            indicators:
            {
                initialStateIndicator: { x: 50, y: 50, state: "A" },
                terminalStateIndicators: [ { id: 3, x: 800, y: 80 }, { id: 4, x: 800, y: 200 } ],
                terminalStateTransitions: [],
            },
            draftTransitions: [ { id: 7, source: { x: 10, y: 20 }, target: { x: 300, y: 20 } } ],
        },
    } );
}

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

function attach ( state: DocumentEditorState, endpoint: "source" | "target", attachment: string | ChartIndicatorReference ): DocumentEditorState
{
    return execute ( state, { kind: "update_chart_draft_endpoint", draftTransitionId: 7, endpoint,
        point: { x: 50, y: 50 }, state: typeof attachment === "string" ? attachment : null,
        indicator: typeof attachment === "string" ? null : attachment, expectedRevision: state.documentRevision } );
}

function freeEndpoint ( state: DocumentEditorState ): "source" | "target"
{
    const transition = state.draft.chart.draftTransitions.find ( candidate => candidate.id === 7 );
    if ( transition === undefined )
    {
        throw new Error ( "The draft transition is missing." );
    }
    const sourceAttached = transition.sourceState != null || transition.sourceIndicator != null;
    const targetAttached = transition.targetState != null || transition.targetIndicator != null;
    if ( sourceAttached === targetAttached )
    {
        throw new Error ( "Expected exactly one free endpoint." );
    }
    return sourceAttached ? "target" : "source";
}

function expectHistory ( state: DocumentEditorState, before: DocumentEditorState ): void
{
    const undone = undoDocumentCommand ( state );
    if ( !undone.isSuccessful )
    {
        throw new Error ( undone.message );
    }
    expect ( undone.state.draft ).toEqual ( before.draft );
    const redone = redoDocumentCommand ( undone.state );
    if ( !redone.isSuccessful )
    {
        throw new Error ( redone.message );
    }
    expect ( redone.state.draft ).toEqual ( state.draft );
}

describe ( "indicator draft endpoint commands", () =>
{
    it.each ( [ "initial", "terminal" ] as const ) ( "completes %s notation in both roles and either attachment order", kind =>
    {
        for ( const indicatorEndpoint of [ "source", "target" ] as const )
        {
            for ( const indicatorFirst of [ true, false ] )
            {
                const indicator: ChartIndicatorReference = kind === "initial" ? { kind } : { kind, id: 3 };
                const stateEndpoint = indicatorEndpoint === "source" ? "target" : "source";
                const original = fixture ();
                let state = indicatorFirst ? attach ( original, indicatorEndpoint, indicator ) : attach ( original, stateEndpoint, "B" );
                const beforeCompletion = state;
                expect ( state.draft.stateMachine ).toBe ( original.draft.stateMachine );
                expect ( state.draft.chart.draftTransitions ).toHaveLength ( 1 );
                state = indicatorFirst ? attach ( state, freeEndpoint ( state ), "B" ) : attach ( state, indicatorEndpoint, indicator );
                expect ( state.draft.chart.draftTransitions ).toEqual ( [] );
                expect ( state.draft.stateMachine.transitionTable ).toEqual ( [] );
                if ( kind === "initial" )
                {
                    expect ( state.draft.stateMachine.initialState ).toBe ( "B" );
                    expect ( state.draft.chart.indicators.initialStateIndicator ).toEqual ( { x: 50, y: 50, state: "B" } );
                }
                else
                {
                    expect ( state.draft.stateMachine ).toBe ( original.draft.stateMachine );
                    expect ( state.draft.chart.indicators.terminalStateTransitions ).toEqual ( [ { state: "B", terminalStateIndicatorId: 3 } ] );
                }
                expectHistory ( state, beforeCompletion );
                expect ( encodeFileDocumentV1 ( state.draft ).file_version ).toBe ( "1.0.0" );
            }
        }
    } );

    it.each ( [ false, true ] ) ( "keeps initial-relation deletion persistable and reconnectable (legacy=%s)", legacy =>
    {
        const original = fixture ();
        const initialState = legacy ? createDocumentEditorState ( {
            ...original.draft,
            chart: { ...original.draft.chart, indicators: { ...original.draft.chart.indicators,
                initialStateIndicator: { x: 50, y: 50 },
            } },
        } ) : original;
        const attached = attach ( initialState, "target", { kind: "initial" } );
        const removed = execute ( attached, {
            kind: "delete_chart_selection", stateNames: [], transitionKeys: [],
            terminalStateIndicatorIds: [], terminalStateRelationStates: [], draftTransitionIds: [],
            deleteInitialStateIndicator: false, clearInitialStateRelation: true,
            expectedRevision: attached.documentRevision,
        } );

        expect ( removed.draft.stateMachine.initialState ).toBeNull ();
        expect ( removed.draft.chart.indicators.initialStateIndicator ).toEqual ( { x: 50, y: 50, state: null } );
        expect ( removed.draft.chart.draftTransitions ).toEqual ( attached.draft.chart.draftTransitions );
        expect ( removed.draft.chart.indicators.terminalStateIndicators )
            .toEqual ( attached.draft.chart.indicators.terminalStateIndicators );
        expect ( validatePersistableAuthoringDraft ( removed.draft ).isValid ).toBe ( true );
        expectHistory ( removed, attached );
        const opened = openAuthoringDocument ( serializeCanonicalDocument ( removed.draft ).text );

        if ( !opened.isSuccessful )
        {
            throw new Error ( JSON.stringify ( opened.diagnostics ) );
        }
        expect ( opened.document.chart.indicators.initialStateIndicator?.state ).toBeNull ();
        const restored = createDocumentEditorState ( opened.document );
        const completed = attach ( restored, "target", "A" );

        expect ( completed.draft.stateMachine.initialState ).toBe ( "A" );
        expect ( completed.draft.chart.indicators.initialStateIndicator?.state ).toBe ( "A" );
        expect ( completed.draft.chart.draftTransitions ).toEqual ( [] );
        expect ( validatePersistableAuthoringDraft ( completed.draft ).isValid ).toBe ( true );
        expectHistory ( completed, restored );
    } );

    it ( "keeps the semantic initial state when deleting an orphan indicator", () =>
    {
        const original = fixture ();
        const orphaned = createDocumentEditorState ( {
            ...original.draft,
            chart: { ...original.draft.chart, indicators: { ...original.draft.chart.indicators,
                initialStateIndicator: { x: 50, y: 50, state: null },
            } },
        } );
        const removed = execute ( orphaned, {
            kind: "delete_chart_selection", stateNames: [], transitionKeys: [],
            terminalStateIndicatorIds: [], terminalStateRelationStates: [], draftTransitionIds: [],
            deleteInitialStateIndicator: true, clearInitialStateRelation: false,
            expectedRevision: orphaned.documentRevision,
        } );

        expect ( removed.draft.chart.indicators.initialStateIndicator ).toBeNull ();
        expect ( removed.draft.stateMachine ).toEqual ( orphaned.draft.stateMachine );
        expect ( validatePersistableAuthoringDraft ( removed.draft ).isValid ).toBe ( true );
        expectHistory ( removed, orphaned );
    } );

    it ( "repairs an initial connection left inconsistent by an earlier deletion", () =>
    {
        const original = fixture ();
        const inconsistent = createDocumentEditorState ( {
            ...original.draft,
            stateMachine: { ...original.draft.stateMachine, initialState: null },
        } );

        expect ( validatePersistableAuthoringDraft ( inconsistent.draft ).isValid ).toBe ( false );
        const attached = attach ( inconsistent, "target", { kind: "initial" } );
        const completed = attach ( attached, "target", "A" );

        expect ( completed.draft.stateMachine.initialState ).toBe ( "A" );
        expect ( completed.draft.chart.indicators.initialStateIndicator )
            .toEqual ( original.draft.chart.indicators.initialStateIndicator );
        expect ( completed.draft.chart.draftTransitions ).toEqual ( [] );
        expect ( validatePersistableAuthoringDraft ( completed.draft ).isValid ).toBe ( true );
        expectHistory ( completed, attached );
    } );

    it ( "replaces a state's terminal relation while retaining other states' shared indicator relations", () =>
    {
        let state = fixture ();
        state = execute ( state, { kind: "connect_chart_terminal_indicator", state: "A", indicatorId: 3, expectedRevision: state.documentRevision } );
        state = execute ( state, { kind: "connect_chart_terminal_indicator", state: "B", indicatorId: 4, expectedRevision: state.documentRevision } );
        state = attach ( state, "source", "B" );
        state = attach ( state, "target", { kind: "terminal", id: 3 } );
        expect ( state.draft.chart.indicators.terminalStateTransitions ).toEqual ( [
            { state: "A", terminalStateIndicatorId: 3 }, { state: "B", terminalStateIndicatorId: 3 },
        ] );
    } );

    it.each ( [ "initial", "terminal" ] as const ) ( "finishes an existing %s relation without an error or duplicate", kind =>
    {
        for ( const indicatorEndpoint of [ "source", "target" ] as const )
        {
            for ( const indicatorFirst of [ true, false ] )
            {
                let state = fixture ();
                if ( kind === "terminal" )
                {
                    state = execute ( state,
                        {
                            kind: "connect_chart_terminal_indicator", state: "A", indicatorId: 3,
                            expectedRevision: state.documentRevision,
                        }
                    );
                }
                const indicator: ChartIndicatorReference = kind === "initial" ? { kind } : { kind, id: 3 };
                const stateEndpoint = indicatorEndpoint === "source" ? "target" : "source";
                const initialDraft = state.draft;
                state = indicatorFirst ? attach ( state, indicatorEndpoint, indicator ) : attach ( state, stateEndpoint, "A" );
                const beforeCompletion = state;
                state = indicatorFirst ? attach ( state, freeEndpoint ( state ), "A" ) : attach ( state, indicatorEndpoint, indicator );

                expect ( state.draft.chart.draftTransitions ).toEqual ( [] );
                expect ( state.draft.chart.indicators ).toEqual ( initialDraft.chart.indicators );
                expect ( state.draft.stateMachine ).toEqual ( initialDraft.stateMachine );
                expect ( state.documentRevision ).toBe ( beforeCompletion.documentRevision + 1 );
                expectHistory ( state, beforeCompletion );
            }
        }
    } );

    it.each ( [ "initial", "terminal" ] as const ) ( "immediately reverses the first wrong-end %s drop in one undo step", kind =>
    {
        const original = fixture ();
        const endpoint = kind === "initial" ? "target" : "source";
        const indicator: ChartIndicatorReference = kind === "initial" ? { kind } : { kind, id: 3 };
        const attached = attach ( original, endpoint, indicator );
        const transition = attached.draft.chart.draftTransitions [ 0 ]!;
        const correctEndpoint = kind === "initial" ? "source" : "target";

        expect ( transition [ correctEndpoint ] ).toEqual ( { x: 50, y: 50 } );
        expect ( transition [ endpoint ] ).toEqual ( original.draft.chart.draftTransitions [ 0 ]! [ correctEndpoint ] );
        expect ( transition.sourceIndicator ?? null ).toEqual ( kind === "initial" ? indicator : null );
        expect ( transition.targetIndicator ?? null ).toEqual ( kind === "terminal" ? indicator : null );
        expect ( transition.sourceState ?? null ).toBeNull ();
        expect ( transition.targetState ?? null ).toBeNull ();
        expect ( attached.draft.stateMachine ).toBe ( original.draft.stateMachine );
        expect ( attached.documentRevision ).toBe ( original.documentRevision + 1 );
        expectHistory ( attached, original );

        const opened = openAuthoringDocument ( serializeCanonicalDocument ( attached.draft ).text );
        if ( !opened.isSuccessful )
        {
            throw new Error ( JSON.stringify ( opened.diagnostics ) );
        }
        expect ( encodeFileDocumentV1 ( opened.document ) ).toEqual ( encodeFileDocumentV1 ( attached.draft ) );
        const restored = createDocumentEditorState ( opened.document );
        const completed = attach ( restored, endpoint, "A" );
        expect ( completed.draft.chart.draftTransitions ).toEqual ( [] );
    } );

    it ( "completes and persists direct notation in an empty authoring draft without creating semantic state", () =>
    {
        const empty = createEmptyAuthoringDraft ( false );
        const placed = fixture ().draft.chart;
        const original = createDocumentEditorState ( {
            ...empty,
            chart:
            {
                ...empty.chart,
                indicators: { ...placed.indicators, initialStateIndicator: { x: 50, y: 50, state: null } },
                draftTransitions: placed.draftTransitions,
            },
        } );
        const halfAttached = attach ( original, "target", { kind: "initial" } );
        const complete = attach ( halfAttached, freeEndpoint ( halfAttached ), { kind: "terminal", id: 3 } );
        expect ( complete.draft.stateMachine ).toBe ( original.draft.stateMachine );
        expect ( complete.draft.stateMachine.states ).toEqual ( [] );
        expect ( complete.draft.stateMachine.events ).toEqual ( [] );
        expect ( complete.draft.stateMachine.initialState ).toBeNull ();
        expect ( complete.draft.chart.indicators.initialStateIndicator?.state ).toBeNull ();
        expect ( complete.draft.chart.indicators.indicatorTransitions ).toEqual ( [ {
            id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 3 },
        } ] );
        const file = encodeFileDocumentV1 ( complete.draft );
        expect ( file.file_version ).toBe ( "1.3.0" );
        const opened = openAuthoringDocument ( serializeCanonicalDocument ( complete.draft ).text );
        if ( !opened.isSuccessful )
        {
            throw new Error ( JSON.stringify ( opened.diagnostics ) );
        }
        expect ( encodeFileDocumentV1 ( opened.document ) ).toEqual ( file );
        expectHistory ( complete, halfAttached );
    } );

    it.each ( [ false, true ] ) ( "normalizes direct initial-to-terminal notation without semantic effects (%s)", reverse =>
    {
        const original = fixture ();
        let state = attach ( original, "source", reverse ? { kind: "terminal", id: 3 } : { kind: "initial" } );
        const halfAttached = state;
        state = attach ( state, freeEndpoint ( state ), reverse ? { kind: "initial" } : { kind: "terminal", id: 3 } );
        expect ( state.draft.stateMachine ).toBe ( original.draft.stateMachine );
        expect ( state.draft.chart.indicators.initialStateIndicator ).toEqual ( original.draft.chart.indicators.initialStateIndicator );
        expect ( state.draft.chart.indicators.indicatorTransitions ).toEqual ( [ {
            id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 3 },
        } ] );
        expect ( state.draft.chart.draftTransitions ).toEqual ( [] );
        expectHistory ( state, halfAttached );
    } );

    it.each ( [
        [ { kind: "initial" }, { kind: "initial" } ],
        [ { kind: "terminal", id: 3 }, { kind: "terminal", id: 3 } ],
        [ { kind: "terminal", id: 3 }, { kind: "terminal", id: 4 } ],
    ] as const ) ( "rejects unsupported indicator pairs atomically", ( first, second ) =>
    {
        const state = attach ( fixture (), "source", first );
        const result = planDocumentCommand ( state, { kind: "update_chart_draft_endpoint", draftTransitionId: 7,
            endpoint: freeEndpoint ( state ), state: null, indicator: second, point: { x: 0, y: 0 }, expectedRevision: state.documentRevision } );
        expect ( result.isSuccessful ).toBe ( false );
        expect ( state.draft.chart.draftTransitions [ 0 ]?.[ freeEndpoint ( state ) ] ).toEqual ( { x: 300, y: 20 } );
    } );

    it ( "rejects remembered-event, mixed, missing, and stale indicator drops", () =>
    {
        const original = fixture ();
        const remembered = createDocumentEditorState ( { ...original.draft, chart: { ...original.draft.chart,
            draftTransitions: [ { ...original.draft.chart.draftTransitions [ 0 ]!, rememberedEvent: "go" } ] } } );
        for ( const [ state, overrides ] of [
            [ remembered, {} ], [ original, { state: "A" } ], [ original, { indicator: { kind: "terminal", id: 999 } } ],
            [ original, { expectedRevision: 50 } ],
        ] as const )
        {
            const result = planDocumentCommand ( state, { kind: "update_chart_draft_endpoint", draftTransitionId: 7,
                endpoint: "source", state: null, indicator: { kind: "initial" }, point: { x: 50, y: 50 }, expectedRevision: state.documentRevision,
                ...overrides } );
            expect ( result.isSuccessful ).toBe ( false );
        }
    } );

    it ( "moves attached endpoints with indicators and releases deleted indicators at current centers", () =>
    {
        let state = attach ( fixture (), "target", { kind: "initial" } );
        state = execute ( state, { kind: "set_chart_initial_indicator", indicator: { x: 80, y: 90, state: "A" },
            expectedRevision: state.documentRevision } );
        const transition = state.draft.chart.draftTransitions [ 0 ]!;
        const resolved = resolveDraftTransitionEndpoints ( transition, new Map (), state.draft.chart.indicators );
        expect ( resolved.target ).toEqual ( transition.target );
        expect ( resolved.source ).toEqual ( { x: 80, y: 90 } );
        const before = state;
        state = execute ( state, { kind: "set_chart_initial_indicator", indicator: null, expectedRevision: state.documentRevision } );
        expect ( state.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( { sourceIndicator: null, source: { x: 80, y: 90 } } );
        expectHistory ( state, before );
    } );

    it ( "deletes direct relations and releases unfinished ends when a terminal indicator is removed", () =>
    {
        let state = attach ( fixture (), "source", { kind: "initial" } );
        state = attach ( state, "target", { kind: "terminal", id: 3 } );
        state = execute ( state, { kind: "add_chart_draft_transition", draftTransition: {
            id: 8, source: { x: 0, y: 0 }, target: { x: 1, y: 1 }, sourceIndicator: { kind: "terminal", id: 3 },
        }, expectedRevision: state.documentRevision } );
        const before = state;
        state = execute ( state, { kind: "delete_chart_terminal_indicator", indicatorId: 3, expectedRevision: state.documentRevision } );
        expect ( state.draft.chart.indicators.indicatorTransitions ).toEqual ( [] );
        expect ( state.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( { sourceIndicator: null, source: { x: 800, y: 80 } } );
        expectHistory ( state, before );
    } );

    it ( "rejects duplicate direct pairs and releases attached drafts through multi-selection deletion", () =>
    {
        let state = attach ( fixture (), "source", { kind: "initial" } );
        state = attach ( state, "target", { kind: "terminal", id: 3 } );
        state = execute ( state, { kind: "add_chart_draft_transition", expectedRevision: state.documentRevision,
            draftTransition: { id: 7, source: { x: 1, y: 2 }, target: { x: 3, y: 4 }, sourceIndicator: { kind: "initial" } } } );
        const duplicate = planDocumentCommand ( state, { kind: "update_chart_draft_endpoint", draftTransitionId: 7,
            endpoint: "target", state: null, indicator: { kind: "terminal", id: 3 }, point: { x: 800, y: 80 },
            expectedRevision: state.documentRevision } );
        expect ( duplicate.isSuccessful ).toBe ( false );
        const before = state;
        state = execute ( state, { kind: "delete_chart_selection", stateNames: [], transitionKeys: [],
            terminalStateIndicatorIds: [], terminalStateRelationStates: [], draftTransitionIds: [],
            clearInitialStateRelation: false, deleteInitialStateIndicator: true, expectedRevision: state.documentRevision } );
        expect ( state.draft.chart.indicators.indicatorTransitions ).toEqual ( [] );
        expect ( state.draft.chart.draftTransitions [ 0 ] ).toMatchObject ( { sourceIndicator: null, source: { x: 50, y: 50 } } );
        expectHistory ( state, before );
    } );

    it ( "retains direct-related indicators through orphan-cleanup layout and deletes direct relations explicitly", () =>
    {
        let state = attach ( fixture (), "source", { kind: "initial" } );
        state = attach ( state, "target", { kind: "terminal", id: 3 } );
        state = execute ( state, { kind: "replace_chart_geometry", expectedRevision: state.documentRevision,
            statePlacements: state.draft.chart.states, initialStateIndicator: { x: 20, y: 30, state: "A" },
            terminalStateIndicators: [ { id: 3, x: 900, y: 900 } ], draftTransitions: [], deleteOrphanedItems: true } );
        expect ( state.draft.chart.indicators.indicatorTransitions ).toHaveLength ( 1 );
        const before = state;
        state = execute ( state, { kind: "delete_chart_selection", stateNames: [], transitionKeys: [],
            terminalStateIndicatorIds: [], terminalStateRelationStates: [], draftTransitionIds: [], indicatorTransitionIds: [ 0 ],
            clearInitialStateRelation: false, deleteInitialStateIndicator: false, expectedRevision: state.documentRevision } );
        expect ( state.draft.chart.indicators.indicatorTransitions ).toEqual ( [] );
        expectHistory ( state, before );
    } );
} );

describe ( "indicator file version 1.3.0", () =>
{
    it ( "round-trips either incomplete attachment and complete visual relations without changing hosted semantics", () =>
    {
        const original = fixture ();
        const initial = attach ( original, "target", { kind: "initial" } );
        const terminal = attach ( original, "source", { kind: "terminal", id: 3 } );
        const complete = attach ( initial, freeEndpoint ( initial ), { kind: "terminal", id: 3 } );
        for ( const state of [ initial, terminal, complete ] )
        {
            const file = encodeFileDocumentV1 ( state.draft );
            expect ( file.file_version ).toBe ( "1.3.0" );
            const opened = openAuthoringDocument ( serializeCanonicalDocument ( state.draft ).text );
            if ( !opened.isSuccessful )
            {
                throw new Error ( JSON.stringify ( opened.diagnostics ) );
            }
            expect ( encodeFileDocumentV1 ( opened.document ) ).toEqual ( file );
            expect ( opened.document.stateMachine ).toEqual ( original.draft.stateMachine );
        }
    } );

    it ( "retains earlier reversed drafts on Open and normalizes only their next explicit edit", () =>
    {
        const original = fixture ();
        const earlier = createDocumentEditorState (
            {
                ...original.draft,
                chart:
                {
                    ...original.draft.chart,
                    draftTransitions:
                    [
                        { ...original.draft.chart.draftTransitions [ 0 ]!, targetIndicator: { kind: "initial" } },
                    ],
                },
            }
        );
        const file = encodeFileDocumentV1 ( earlier.draft );
        const opened = openAuthoringDocument ( serializeCanonicalDocument ( earlier.draft ).text );
        if ( !opened.isSuccessful )
        {
            throw new Error ( JSON.stringify ( opened.diagnostics ) );
        }
        expect ( encodeFileDocumentV1 ( opened.document ) ).toEqual ( file );
        const restored = createDocumentEditorState ( opened.document );
        const completed = attach ( restored, "source", "A" );
        expect ( completed.draft.chart.draftTransitions ).toEqual ( [] );
        expectHistory ( completed, restored );
    } );

    it.each ( [ "1.0.0", "1.1.0", "1.2.0" ] ) ( "rejects indicator extension fields in earlier version %s, even null or empty", fileVersion =>
    {
        const original = encodeFileDocumentV1 ( fixture ().draft );
        for ( const field of [ "source_indicator", "target_indicator" ] )
        {
            const input = { ...original, file_version: fileVersion, chart: { ...original.chart,
                draft_transitions: [ { ...original.chart.draft_transitions?.[ 0 ], [ field ]: null } ] } };
            expect ( openAuthoringDocument ( JSON.stringify ( input ) ).isSuccessful ).toBe ( false );
        }
        const input = { ...original, file_version: fileVersion, chart: { ...original.chart,
            indicators: { ...original.chart.indicators, indicator_transitions: [] } } };
        expect ( openAuthoringDocument ( JSON.stringify ( input ) ).isSuccessful ).toBe ( false );
    } );

    it ( "rejects reversed, unsupported, duplicate, and dangling direct relations on Open", () =>
    {
        const completed = attach ( attach ( fixture (), "source", { kind: "initial" } ), "target", { kind: "terminal", id: 3 } );
        const file = encodeFileDocumentV1 ( completed.draft );
        for ( const indicatorTransitions of [
            [ { id: 0, source: { kind: "terminal", id: 3 }, target: { kind: "initial" } } ],
            [ { id: 0, source: { kind: "terminal", id: 3 }, target: { kind: "terminal", id: 4 } } ],
            [ { id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 999 } } ],
            [ { id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 3 } },
                { id: 1, source: { kind: "initial" }, target: { kind: "terminal", id: 3 } } ],
            [ { id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 3 } },
                { id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 4 } } ],
        ] )
        {
            const input = { ...file, chart: { ...file.chart,
                indicators: { ...file.chart.indicators, indicator_transitions: indicatorTransitions } } };
            expect ( openAuthoringDocument ( JSON.stringify ( input ) ).isSuccessful ).toBe ( false );
        }
    } );

    it ( "keeps source/public schemas identical and rejects malformed, dangling, mixed and remembered indicator references", () =>
    {
        const file = encodeFileDocumentV1 ( attach ( fixture (), "source", { kind: "initial" } ).draft );
        const publicSchema = JSON.parse ( readFileSync ( "public/schema/automata-lab-state-machine-1.3.0.schema.json", "utf8" ) );
        expect ( publicSchema ).toEqual ( FILE_SCHEMA_V1_3 );
        const validate = new Ajv2020 ( { strict: true } ).compile ( FILE_SCHEMA_V1_3 );
        expect ( validate ( file ) ).toBe ( true );
        for ( const reference of [ { kind: "unknown" }, { kind: "initial", id: 0 }, { kind: "terminal", id: -1 },
            { kind: "terminal", id: 999 }, "initial" ] )
        {
            const input = { ...file, chart: { ...file.chart,
                draft_transitions: [ { ...file.chart.draft_transitions?.[ 0 ], source_indicator: reference } ] } };
            expect ( openAuthoringDocument ( JSON.stringify ( input ) ).isSuccessful ).toBe ( false );
        }
        for ( const conflicts of [ { source_state: "A" }, { remembered_event: "go" } ] )
        {
            const input = { ...file, chart: { ...file.chart,
                draft_transitions: [ { ...file.chart.draft_transitions?.[ 0 ], ...conflicts } ] } };
            expect ( openAuthoringDocument ( JSON.stringify ( input ) ).isSuccessful ).toBe ( false );
        }
    } );
} );

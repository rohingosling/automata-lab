// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Terminal State Preparation Tests
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies deterministic geometry, atomic commands, exact history, and prepared persistence.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash } from "node:crypto";
import { stageHostedModel } from "../../src/workers/server/hosting.js";
import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import type { AuthoringDraft } from "../../src/domain/model/contracts.js";
import { createDocumentEditorState, executeDocumentCommand, planDocumentCommand,
    undoDocumentCommand, redoDocumentCommand } from "../../src/domain/model/commands.js";
import type { DocumentCommand, DocumentEditorState } from "../../src/domain/model/commands.js";
import { MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT } from "../../src/domain/model/limits.js";
import { hasCoherentTerminalStateNotation } from "../../src/domain/model/terminal-states.js";
import { serializeCanonicalDocument, serializeCanonicalHostedContent } from "../../src/domain/model/canonicalization.js";
import { DEFAULT_APPLICATION_PREFERENCES } from "../../src/configuration/compile-time-configuration.js";
import { createTerminalStatePreparation, prepareTerminalStateNotation, resolveTerminalStateGeometry }
    from "../../src/application/chart-terminal-state-preparation.js";
import type { TerminalStateGeometryContext } from "../../src/application/ports/terminal-state-preparation.js";
import { createNewDocumentWorkspace, prepareDocumentWorkspace, saveDocumentWorkspace,
    mergeSavedDocumentWorkspace } from "../../src/application/document-workspace.js";
import { prepareTerminalStateCsvImport } from "../../src/application/csv-transfer.js";
import { createPrintableReport } from "../../src/application/printing.js";
import { AuthoringDocumentCodec, AutomataDocumentCodec } from "../../src/infrastructure/files/file-codec.js";

function fixture ( terminalState = true ): AuthoringDraft
{
    const empty = createEmptyAuthoringDraft ();
    return { ...empty, stateMachine: { ...empty.stateMachine, initialState: "A", states: [
        { name: "A", description: "", terminalState },
        { name: "B", description: "", terminalState: false },
    ] }, chart: { ...empty.chart, states: [ { state: "A", x: 0, y: 0 }, { state: "B", x: 500, y: 0 } ] } };
}

function geometry (): TerminalStateGeometryContext
{
    return {
        stateBounds: new Map ( [ [ "A", { x: 0, y: 0, width: 100, height: 100 } ],
            [ "B", { x: 0, y: 0, width: 100, height: 100 } ] ] ),
        occupiedRectangles: [ { x: 0, y: 0, width: 100, height: 100 } ],
        retainedDraftEndpoints: [], indicatorWidth: 80, indicatorHeight: 80, gridSize: 50, routeClearance: 12,
    };
}

function prepared ( document: AuthoringDraft, context = geometry () )
{
    const result = prepareTerminalStateNotation ( document, context );
    if ( !result.isSuccessful )
    {
        throw new Error ( JSON.stringify ( result.diagnostics ) );
    }
    return result;
}

function execute ( state: DocumentEditorState, command: DocumentCommand ): DocumentEditorState
{
    const plan = planDocumentCommand ( state, command, createTerminalStatePreparation () );
    if ( !plan.isSuccessful )
    {
        throw new Error ( plan.message );
    }
    const result = executeDocumentCommand ( state, plan.plan );
    if ( !result.isSuccessful )
    {
        throw new Error ( result.message );
    }
    expect ( hasCoherentTerminalStateNotation ( result.state.draft ) ).toBe ( true );
    return result.state;
}

function expectHistory ( state: DocumentEditorState, before: DocumentEditorState ): void
{
    expect ( state.documentRevision ).toBe ( before.documentRevision + 1 );
    const undone = undoDocumentCommand ( state );
    if ( !undone.isSuccessful )
    {
        throw new Error ( undone.message );
    }
    expect ( undone.state.draft ).toBe ( before.draft );
    const redone = redoDocumentCommand ( undone.state );
    if ( !redone.isSuccessful )
    {
        throw new Error ( redone.message );
    }
    expect ( redone.state.draft ).toBe ( state.draft );
}

function connectedFixture (): AuthoringDraft
{
    const document = fixture ();
    return { ...document, stateMachine: { ...document.stateMachine,
        states: document.stateMachine.states.map ( state => ( { ...state, terminalState: true } ) ),
    }, chart: { ...document.chart, indicators: { ...document.chart.indicators,
        terminalStateIndicators: [ { id: 7, x: 150, y: 300 } ],
        terminalStateTransitions: [ { state: "A", terminalStateIndicatorId: 7 },
            { state: "B", terminalStateIndicatorId: 7 } ],
    } } };
}

describe ( "terminal placement", () =>
{
    it ( "uses the specified center formula and is an identity on repeat", () =>
    {
        const document = fixture ();
        const result = prepared ( document );
        expect ( result.document.chart.indicators.terminalStateIndicators ).toEqual ( [ { id: 0, x: 50, y: 200 } ] );
        expect ( result.summary ).toEqual ( { addedIndicatorCount: 1, addedRelationCount: 1, removedRelationCount: 0 } );
        expect ( prepared ( result.document ).document ).toBe ( result.document );
        expect ( serializeCanonicalHostedContent ( result.document ) ).toBe ( serializeCanonicalHostedContent ( document ) );
    } );

    it ( "jumps below the greatest colliding bottom using a center-aligned ceiling", () =>
    {
        const context = geometry ();
        const result = prepared ( fixture (), { ...context, occupiedRectangles: [ ...context.occupiedRectangles,
            { x: 10, y: 160, width: 80, height: 80 }, { x: 20, y: 190, width: 30, height: 120 } ] } );
        expect ( result.document.chart.indicators.terminalStateIndicators [ 0 ]?.y ).toBe ( 350 );
    } );

    it ( "avoids retained endpoints while allowing exact edge contact", () =>
    {
        expect ( prepared ( fixture (), { ...geometry (), retainedDraftEndpoints: [ { x: 50, y: 200 } ] } )
            .document.chart.indicators.terminalStateIndicators [ 0 ]?.y ).toBe ( 250 );
        expect ( prepared ( fixture (), { ...geometry (), retainedDraftEndpoints: [ { x: 10, y: 200 } ] } )
            .document.chart.indicators.terminalStateIndicators [ 0 ]?.y ).toBe ( 200 );
    } );

    it ( "reserves earlier placements and allocates lowest unused identifiers in declaration order", () =>
    {
        const document = fixture ();
        const source = { ...document, stateMachine: { ...document.stateMachine,
            states: document.stateMachine.states.map ( state => ( { ...state, terminalState: true } ) ),
        }, chart: { ...document.chart, indicators: { ...document.chart.indicators,
            terminalStateIndicators: [ { id: 0, x: 1000, y: 1000 }, { id: 2, x: 2000, y: 2000 } ],
        } } };
        const result = prepared ( source );
        expect ( result.document.chart.indicators.terminalStateIndicators.slice ( 2 ) ).toEqual (
            [ { id: 1, x: 50, y: 200 }, { id: 3, x: 50, y: 300 } ],
        );
        expect ( result.document.chart.indicators.terminalStateTransitions.map ( relation => relation.state ) )
            .toEqual ( [ "A", "B" ] );
        expect ( source.chart.indicators.terminalStateIndicators ).toHaveLength ( 2 );
    } );

    it ( "clears a false relation while preserving a shared icon, other relation and authored geometry", () =>
    {
        const document = connectedFixture ();
        const source = { ...document, stateMachine: { ...document.stateMachine,
            states: document.stateMachine.states.map ( state => ( { ...state, terminalState: state.name === "B" } ) ),
        } };
        const result = prepared ( source );
        expect ( result.document.chart.indicators.terminalStateTransitions ).toEqual ( [ { state: "B", terminalStateIndicatorId: 7 } ] );
        expect ( result.document.chart.indicators.terminalStateIndicators ).toEqual ( document.chart.indicators.terminalStateIndicators );
        expect ( result.summary.removedRelationCount ).toBe ( 1 );
    } );

    it ( "rejects capacity without removing or reusing authored orphan indicators", () =>
    {
        const document = fixture ();
        const source = { ...document, chart: { ...document.chart, indicators: { ...document.chart.indicators,
            terminalStateIndicators: Array.from ( { length: MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT },
                ( _, index ) => ( { id: index, x: 1000, y: 1000 } ) ),
        } } };
        const snapshot = JSON.stringify ( source );
        expect ( prepareTerminalStateNotation ( source, geometry () ).isSuccessful ).toBe ( false );
        expect ( JSON.stringify ( source ) ).toBe ( snapshot );
    } );

    it.each ( [ 0, -1, Infinity, NaN ] ) ( "rejects invalid grid %s without a partial result", gridSize =>
    {
        expect ( prepareTerminalStateNotation ( fixture (), { ...geometry (), gridSize } ) )
            .toMatchObject ( { isSuccessful: false } );
    } );

    it ( "rejects nonfinite arithmetic and missing bounds", () =>
    {
        expect ( prepareTerminalStateNotation ( fixture (), { ...geometry (), stateBounds: new Map () } ).isSuccessful ).toBe ( false );
        const context = { ...geometry (), stateBounds: new Map ( [ [ "A", { x: 1e308, y: 1e308, width: 1e308, height: 1e308 } ] ] ) };
        expect ( prepareTerminalStateNotation ( fixture (), context ).isSuccessful ).toBe ( false );
    } );

    it ( "rejects dangling references before removing contradictory notation", () =>
    {
        const document = fixture ( false );
        const source = { ...document, chart: { ...document.chart, indicators: { ...document.chart.indicators,
            terminalStateTransitions: [ { state: "A", terminalStateIndicatorId: 99 } ],
        } } };
        expect ( prepareTerminalStateNotation ( source, geometry () ).isSuccessful ).toBe ( false );
    } );

    it ( "uses shared preference-aware fallback bounds without persisting state placements", () =>
    {
        const document = fixture ();
        const source = { ...document, chart: { ...document.chart, states: [] } };
        const context = resolveTerminalStateGeometry ( source, { ...DEFAULT_APPLICATION_PREFERENCES, collapsedStateWidth: 500 } );
        expect ( context.stateBounds.get ( "A" )?.width ).toBe ( 500 );
        const result = prepared ( source, context );
        expect ( result.document.chart.states ).toEqual ( [] );
        expect ( createTerminalStatePreparation ().prepare ( result.document ) ).toMatchObject ( { isSuccessful: true, document: result.document } );
    } );

    it ( "is deterministic and never overlaps reserved indicators across bounded generated grids", () =>
    {
        fc.assert ( fc.property ( fc.integer ( { min: 1, max: 100 } ), gridSize =>
        {
            const document = fixture ();
            const source = { ...document, stateMachine: { ...document.stateMachine,
                states: document.stateMachine.states.map ( state => ( { ...state, terminalState: true } ) ),
            } };
            const context = { ...geometry (), gridSize };
            const first = prepared ( source, context );
            expect ( prepared ( source, context ) ).toEqual ( first );
            const indicators = first.document.chart.indicators.terminalStateIndicators;
            expect ( Math.abs ( ( indicators [ 1 ]?.y ?? 0 ) - ( indicators [ 0 ]?.y ?? 0 ) ) ).toBeGreaterThanOrEqual ( 80 );
        } ), { numRuns: 100 } );
    } );
} );

describe ( "atomic terminal commands", () =>
{
    it ( "checks and clears membership with one exact history entry each", () =>
    {
        const before = createDocumentEditorState ( fixture ( false ) );
        const checked = execute ( before, { kind: "update_entity", entityKind: "state", previousName: "A",
            entity: { name: "A", description: "", terminalState: true }, expectedRevision: 1 } );
        expectHistory ( checked, before );
        const cleared = execute ( checked, { kind: "update_entity", entityKind: "state", previousName: "A",
            entity: { name: "A", description: "", terminalState: false }, expectedRevision: 2 } );
        expectHistory ( cleared, checked );
        expect ( cleared.draft.chart.indicators.terminalStateIndicators ).toEqual ( checked.draft.chart.indicators.terminalStateIndicators );
        expect ( cleared.draft.chart.indicators.terminalStateTransitions ).toEqual ( [] );
    } );

    it ( "renames a terminal state without changing its indicator identity", () =>
    {
        const before = createDocumentEditorState ( connectedFixture () );
        const after = execute ( before, { kind: "rename_entity", entityKind: "state", previousName: "A", newName: "Renamed", expectedRevision: 1 } );
        expect ( after.draft.stateMachine.states [ 0 ]?.terminalState ).toBe ( true );
        expect ( after.draft.chart.indicators.terminalStateTransitions [ 0 ] ).toEqual ( { state: "Renamed", terminalStateIndicatorId: 7 } );
        expectHistory ( after, before );
    } );

    it ( "deleting a shared icon clears all connected surviving states atomically", () =>
    {
        const before = createDocumentEditorState ( connectedFixture () );
        const after = execute ( before, { kind: "delete_chart_terminal_indicator", indicatorId: 7, expectedRevision: 1 } );
        expect ( after.draft.stateMachine.states.every ( state => !state.terminalState ) ).toBe ( true );
        expect ( after.draft.chart.indicators.terminalStateIndicators ).toEqual ( [] );
        expectHistory ( after, before );
    } );

    it ( "deleting one relation retains shared membership and the icon", () =>
    {
        const before = createDocumentEditorState ( connectedFixture () );
        const after = execute ( before, { kind: "delete_chart_selection", expectedRevision: 1, stateNames: [], transitionKeys: [],
            terminalStateIndicatorIds: [], terminalStateRelationStates: [ "A" ], draftTransitionIds: [],
            clearInitialStateRelation: false, deleteInitialStateIndicator: false } );
        expect ( after.draft.stateMachine.states.map ( state => state.terminalState ) ).toEqual ( [ false, true ] );
        expect ( after.draft.chart.indicators.terminalStateIndicators ).toHaveLength ( 1 );
        expectHistory ( after, before );
    } );

    it ( "handles overlapping mixed deletion once from the original snapshot", () =>
    {
        const before = createDocumentEditorState ( connectedFixture () );
        const after = execute ( before, { kind: "delete_chart_selection", expectedRevision: 1, stateNames: [ "A" ], transitionKeys: [],
            terminalStateIndicatorIds: [ 7 ], terminalStateRelationStates: [ "B" ], draftTransitionIds: [],
            clearInitialStateRelation: false, deleteInitialStateIndicator: false } );
        expect ( after.draft.stateMachine.states ).toEqual ( [ { name: "B", description: "", terminalState: false } ] );
        expectHistory ( after, before );
    } );

    it ( "imports true/false through one planner and retains the shared orphan", () =>
    {
        const before = createDocumentEditorState ( connectedFixture () );
        const imported = prepareTerminalStateCsvImport ( "name,description,terminal_state\nA,,false\nB,,false\nC,,true\n" );
        if ( !imported.isSuccessful )
        {
            throw new Error ( "Expected valid import" );
        }
        const after = execute ( before, { kind: "import_model_elements", modelImport: imported.modelImport,
            overwriteConflicts: true, expectedRevision: 1 } );
        expect ( after.draft.stateMachine.states.map ( state => state.terminalState ) ).toEqual ( [ false, false, true ] );
        expect ( after.draft.chart.indicators.terminalStateIndicators ).toHaveLength ( 2 );
        expectHistory ( after, before );
    } );

    it ( "rejects stale revision before running geometry preparation", () =>
    {
        const before = createDocumentEditorState ( fixture ( false ) );
        const prepare = vi.fn ( createTerminalStatePreparation ().prepare );
        expect ( planDocumentCommand ( before, { kind: "prepare_terminal_notation", expectedRevision: 99 }, { prepare } ) )
            .toMatchObject ( { isSuccessful: false, code: "REVISION_MISMATCH" } );
        expect ( prepare ).not.toHaveBeenCalled ();
    } );
} );

describe ( "prepared file and report boundaries", () =>
{
    it ( "normalizes missing modern notation identically for browser and headless codecs", () =>
    {
        const text = serializeCanonicalDocument ( fixture () ).text;
        const authoring = new AuthoringDocumentCodec ().open ( text );
        const server = new AutomataDocumentCodec ().open ( text );
        expect ( authoring ).toEqual ( server );
        if ( !authoring.isSuccessful )
        {
            throw new Error ( "Expected prepared file" );
        }
        expect ( authoring.notices.map ( notice => notice.kind ) ).toEqual ( [ "notation_repair" ] );
        const encoded = serializeCanonicalDocument ( authoring.document ).text;
        const repeated = new AutomataDocumentCodec ().open ( encoded );
        expect ( repeated.isSuccessful && repeated.notices ).toEqual ( [] );
        expect ( repeated.isSuccessful && serializeCanonicalDocument ( repeated.document ).text ).toBe ( encoded );
    } );

    it ( "commits defensive repair before destination cancellation and creates no repeated revision", async () =>
    {
        const before = { ...createNewDocumentWorkspace (), editorState: createDocumentEditorState ( fixture () ) };
        const result = prepareDocumentWorkspace ( before );
        if ( !result.isSuccessful || result.workspace.editorState === null )
        {
            throw new Error ( "Expected repair" );
        }
        expectHistory ( result.workspace.editorState, before.editorState );
        const saveTextDocument = vi.fn ( async () => null );
        expect ( await saveDocumentWorkspace ( result.workspace, { openTextDocument: async () => null, saveTextDocument }, false, false ) )
            .toEqual ( { status: "cancelled" } );
        expect ( result.workspace.editorState.dirty ).toBe ( true );
        const repeated = prepareDocumentWorkspace ( result.workspace );
        expect ( repeated.isSuccessful && repeated.workspace ).toBe ( result.workspace );
        expect ( saveTextDocument ).toHaveBeenCalledTimes ( 1 );
    } );

    it ( "keeps later edits dirty after a captured write completes", () =>
    {
        const captured = { ...createNewDocumentWorkspace (), editorState: createDocumentEditorState ( fixture ( false ) ) };
        const state = execute ( captured.editorState, { kind: "update_entity", entityKind: "state", previousName: "A",
            entity: { name: "A", description: "Later" }, expectedRevision: 1 } );
        const current = { ...captured, editorState: state };
        const merged = mergeSavedDocumentWorkspace ( current, captured, captured );
        expect ( merged.editorState?.draft ).toBe ( state.draft );
        expect ( merged.editorState?.dirty ).toBe ( true );
    } );

    it ( "prepares standalone report notation before any Chart visit", () =>
    {
        const document = fixture ();
        const report = createPrintableReport ( document, 0, DEFAULT_APPLICATION_PREFERENCES );
        expect ( JSON.stringify ( report ) ).toContain ( '"terminalIndicators":[{' );
        expect ( document.chart.indicators.terminalStateIndicators ).toEqual ( [] );
        expect ( report.sections.find ( section => section.kind === "states" )?.rows.map ( state => state.terminalState ) )
            .toEqual ( [ true, false ] );
        expect ( createPrintableReport ( document, 0, { ...DEFAULT_APPLICATION_PREFERENCES,
            simulatorEnableTerminalStates: true } ) ).toEqual ( report );
    } );
} );

describe ( "terminal failure isolation and hosting", () =>
{
    it ( "rolls back an entire state edit when indicator capacity is exhausted", () =>
    {
        const document = fixture ( false );
        const before = createDocumentEditorState ( { ...document, chart: { ...document.chart,
            indicators: { ...document.chart.indicators, terminalStateIndicators:
                Array.from ( { length: MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT },
                    ( _, index ) => ( { id: index, x: 1000, y: 1000 } ) ),
            },
        } } );
        const original = JSON.stringify ( before );
        const planned = planDocumentCommand ( before, { kind: "update_entity", entityKind: "state",
            previousName: "A", entity: { name: "A", description: "", terminalState: true },
            expectedRevision: before.documentRevision }, createTerminalStatePreparation () );
        expect ( planned ).toMatchObject ( { isSuccessful: false, code: "COMMAND_INVALID" } );
        expect ( JSON.stringify ( before ) ).toBe ( original );
    } );

    it ( "rejects the complete plan when a later state cannot be placed after an earlier reservation", () =>
    {
        const document = fixture ();
        const source = { ...document, stateMachine: { ...document.stateMachine, states:
            document.stateMachine.states.map ( state => ( { ...state, terminalState: true } ) ) } };
        const context = geometry ();
        const result = prepareTerminalStateNotation ( source, { ...context, stateBounds: new Map ( [
            [ "A", { x: 0, y: 0, width: 100, height: 100 } ],
            [ "B", { x: 1e20, y: 1e20, width: 100, height: 100 } ],
        ] ) } );
        expect ( result ).toMatchObject ( { isSuccessful: false } );
        expect ( result ).not.toHaveProperty ( "document" );
        expect ( source.chart.indicators.terminalStateIndicators ).toEqual ( [] );
    } );

    it ( "does not repair an invalid reference out of a defensive command", () =>
    {
        const document = fixture ( false );
        const before = createDocumentEditorState ( { ...document, chart: { ...document.chart,
            indicators: { ...document.chart.indicators,
                terminalStateTransitions: [ { state: "A", terminalStateIndicatorId: 99 } ],
            },
        } } );
        expect ( planDocumentCommand ( before, { kind: "prepare_terminal_notation",
            expectedRevision: before.documentRevision }, createTerminalStatePreparation () ).isSuccessful ).toBe ( false );
        expect ( before.undoStack ).toEqual ( [] );
    } );

    it ( "adds an explicit terminal state with its notation in one revision", () =>
    {
        const before = createDocumentEditorState ( fixture ( false ) );
        const after = execute ( before, { kind: "add_entity", entityKind: "state",
            entity: { name: "C", description: "", terminalState: true }, expectedRevision: before.documentRevision } );
        expect ( after.draft.stateMachine.states.at ( -1 )?.terminalState ).toBe ( true );
        expect ( after.draft.chart.indicators.terminalStateTransitions [ 0 ]?.state ).toBe ( "C" );
        expectHistory ( after, before );
    } );

    it ( "preserves shared terminal membership when deleting only one state", () =>
    {
        const before = createDocumentEditorState ( connectedFixture () );
        const after = execute ( before, { kind: "delete_entity", entityKind: "state", name: "B",
            expectedRevision: before.documentRevision } );
        expect ( after.draft.stateMachine.states [ 0 ]?.terminalState ).toBe ( true );
        expect ( after.draft.chart.indicators.terminalStateIndicators ).toEqual ( before.draft.chart.indicators.terminalStateIndicators );
        expectHistory ( after, before );
    } );

    it ( "hosts repaired and client-prepared documents without changing canonical geometry on repeat", async () =>
    {
        const dependencies = { documentCodec: new AutomataDocumentCodec (), contentHasher: {
            hashCanonicalText: async ( text: string ) => "sha256:" + createHash ( "sha256" ).update ( text ).digest ( "hex" ),
        } };
        const hosted = await stageHostedModel ( serializeCanonicalDocument ( fixture () ).text, dependencies );
        if ( !hosted.isSuccessful )
        {
            throw new Error ( "Hosting must prepare missing notation." );
        }
        const repeated = await stageHostedModel ( hosted.hostedModel.canonicalDocumentText, dependencies );
        expect ( repeated ).toEqual ( hosted );
        const client = new AuthoringDocumentCodec ( createTerminalStatePreparation ( {
            ...DEFAULT_APPLICATION_PREFERENCES, gridSize: 100, collapsedStateWidth: 500,
        } ) ).open ( hosted.hostedModel.canonicalDocumentText );
        expect ( client.isSuccessful && serializeCanonicalDocument ( client.document ).text )
            .toBe ( hosted.hostedModel.canonicalDocumentText );
        expect ( client.isSuccessful && client.notices ).toEqual ( [] );
    } );
} );

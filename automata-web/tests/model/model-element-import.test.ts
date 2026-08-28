// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Model Element Import Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies validated merging, collision handling, reference failures, ordering, and one-step
//   import undo.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import
{
    createDocumentEditorState,
    executeDocumentCommand,
    planDocumentCommand,
    undoDocumentCommand,
} from "../../src/domain/model/commands";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts";
import { inspectModelElementImport } from "../../src/domain/model/model-element-import";

//--------------------------------------------------------------------------------------------------
// Function: createImportDraft
//
// Description:
//
//   Creates import draft for the test scenario.
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

function createImportDraft ()
{
    // Initialize the local values needed by this operation.

    const emptyDraft = createEmptyAuthoringDraft ( true );

    // Return the assembled result.

    return {
        ...emptyDraft,
        stateMachine:
        {
            ...emptyDraft.stateMachine,
            actions:
            [
                { name: "action_start", description: "Start" },
                { name: "action_stop", description: "Stop" },
            ],
            events: [ { name: "event_go", description: "Go" } ],
            states:
            [
                { name: "state_one", description: "One" },
                { name: "state_two", description: "Two" },
            ],
            transitionTable: [ { state: "state_one", event: "event_go", stateNext: "state_two" } ],
        },
    };
}

describe ( "model-element import", () =>
{
    it ( "replaces colliding named descriptions in place and appends new declarations", () =>
    {
        // Initialize the local values needed by this operation.

        const inspection = inspectModelElementImport (
            createImportDraft (),
            {
                kind:       "named_entities",
                entityKind: "state",
                rows:
                [
                    { rowNumber: 2, value: { name: "state_two", description: "Updated two" } },
                    { rowNumber: 3, value: { name: "state_three", description: "Three" } },
                ],
            },
        );

        expect ( inspection.isSuccessful ).toBe ( true );

        // Handle the case where inspection is successful is enabled.

        if ( inspection.isSuccessful )
        {
            expect ( inspection.conflicts ).toEqual ( [ { key: "state_two" } ] );
            expect ( inspection.resultingDraft.stateMachine.states ).toEqual (
                [
                    { name: "state_one", description: "One" },
                    { name: "state_two", description: "Updated two" },
                    { name: "state_three", description: "Three" },
                ],
            );
        }
    } );

    it ( "preserves duplicate state-action assignments and appends them to their scheduled lists", () =>
    {
        // Initialize the local values needed by this operation.

        const draft      = createImportDraft ();
        const inspection = inspectModelElementImport (
            {
                ...draft,
                stateMachine:
                {
                    ...draft.stateMachine,
                    stateActions:
                    {
                        entry: [ { state: "state_one", action: "action_start" } ],
                        exit:  [],
                    },
                },
            },
            {
                kind: "state_actions",
                rows:
                [
                    {
                        rowNumber: 2,
                        value: { state: "state_one", action: "action_start", schedule: "entry" },
                    },
                    {
                        rowNumber: 3,
                        value: { state: "state_one", action: "action_stop", schedule: "exit" },
                    },
                ],
            },
        );

        expect ( inspection.isSuccessful ).toBe ( true );

        // Handle the case where inspection is successful is enabled.

        if ( inspection.isSuccessful )
        {
            expect ( inspection.conflicts ).toEqual ( [] );
            expect ( inspection.resultingDraft.stateMachine.stateActions ).toEqual (
                {
                    entry:
                    [
                        { state: "state_one", action: "action_start" },
                        { state: "state_one", action: "action_start" },
                    ],
                    exit: [ { state: "state_one", action: "action_stop" } ],
                },
            );
        }
    } );

    it ( "rejects every unresolved reference without producing a partial draft", () =>
    {
        // Initialize the local values needed by this operation.

        const inspection = inspectModelElementImport (
            createImportDraft (),
            {
                kind: "state_actions",
                rows:
                [
                    { rowNumber: 2, value: { state: "missing", action: "action_start", schedule: "entry" } },
                    { rowNumber: 3, value: { state: "state_one", action: "missing", schedule: "exit" } },
                ],
            },
        );

        expect ( inspection ).toMatchObject (
            {
                isSuccessful: false,
                diagnostics:
                [
                    { code: "CSV_REFERENCE_INVALID", path: "/csv/rows/2" },
                    { code: "CSV_REFERENCE_INVALID", path: "/csv/rows/3" },
                ],
            },
        );
        expect ( inspection ).not.toHaveProperty ( "resultingDraft" );
    } );

    it ( "replaces transition-key collisions and appends new transition keys", () =>
    {
        // Initialize the local values needed by this operation.

        const inspection = inspectModelElementImport (
            createImportDraft (),
            {
                kind: "transitions",
                rows:
                [
                    {
                        rowNumber: 2,
                        value: { state: "state_one", event: "event_go", stateNext: "state_one" },
                    },
                    {
                        rowNumber: 3,
                        value: { state: "state_two", event: "event_go", stateNext: "state_one" },
                    },
                ],
            },
        );

        expect ( inspection.isSuccessful ).toBe ( true );

        // Handle the case where inspection is successful is enabled.

        if ( inspection.isSuccessful )
        {
            expect ( inspection.conflicts ).toEqual ( [ { key: "state_one + event_go" } ] );
            expect ( inspection.resultingDraft.stateMachine.transitionTable ).toEqual (
                [
                    { state: "state_one", event: "event_go", stateNext: "state_one" },
                    { state: "state_two", event: "event_go", stateNext: "state_one" },
                ],
            );
        }
    } );

    it ( "imports Model Metadata atomically and keeps a connected initial indicator synchronized", () =>
    {
        // Initialize the local values needed by this operation.

        const draft      = createImportDraft ();
        const inspection = inspectModelElementImport (
            {
                ...draft,
                chart:
                {
                    ...draft.chart,
                    indicators:
                    {
                        ...draft.chart.indicators,
                        initialStateIndicator: { x: 10, y: 20, state: "state_one" },
                    },
                },
                stateMachine: { ...draft.stateMachine, initialState: "state_one" },
            },
            {
                kind: "model_metadata",
                rows:
                [
                    {
                        rowNumber: 2,
                        value:
                        {
                            name:         "Imported Model",
                            description:  "Imported description",
                            version:      "2.0.1",
                            initialState: "state_two",
                        },
                    },
                ],
            },
        );

        expect ( inspection.isSuccessful ).toBe ( true );

        // Handle the case where inspection is successful is enabled.

        if ( inspection.isSuccessful )
        {
            expect ( inspection.resultingDraft.settings ).toEqual (
                { name: "Imported Model", description: "Imported description", version: "2.0.1" },
            );
            expect ( inspection.resultingDraft.stateMachine.initialState ).toBe ( "state_two" );
            expect ( inspection.resultingDraft.chart.indicators.initialStateIndicator )
                .toEqual ( { x: 10, y: 20, state: "state_two" } );
        }
    } );

    it ( "clears Model Metadata initial state without attaching an orphan indicator", () =>
    {
        // Initialize the local values needed by this operation.

        const draft      = createImportDraft ();
        const inspection = inspectModelElementImport (
            {
                ...draft,
                chart:
                {
                    ...draft.chart,
                    indicators:
                    {
                        ...draft.chart.indicators,
                        initialStateIndicator: { x: 10, y: 20, state: null },
                    },
                },
                stateMachine: { ...draft.stateMachine, initialState: "state_one" },
            },
            {
                kind: "model_metadata",
                rows:
                [
                    {
                        rowNumber: 2,
                        value: { name: "Draft", description: "", version: "1.0.0", initialState: null },
                    },
                ],
            },
        );

        expect ( inspection.isSuccessful ).toBe ( true );

        // Handle the case where inspection is successful is enabled.

        if ( inspection.isSuccessful )
        {
            expect ( inspection.resultingDraft.stateMachine.initialState ).toBeNull ();
            expect ( inspection.resultingDraft.chart.indicators.initialStateIndicator )
                .toEqual ( { x: 10, y: 20, state: null } );
        }
    } );

    it ( "commits Model Metadata as one undoable command", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( createImportDraft () );
        const plan         = planDocumentCommand (
            initialState,
            {
                kind: "import_model_elements",
                modelImport:
                {
                    kind: "model_metadata",
                    rows:
                    [
                        {
                            rowNumber: 2,
                            value:
                            {
                                name:         "Imported",
                                description:  "Atomic metadata",
                                version:      "4.5.6",
                                initialState: "state_two",
                            },
                        },
                    ],
                },
                overwriteConflicts: true,
                expectedRevision:   initialState.documentRevision,
            },
        );

        expect ( plan.isSuccessful ).toBe ( true );

        // Handle the case where the plan is successful condition is not satisfied.

        if ( !plan.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        const execution = executeDocumentCommand ( initialState, plan.plan );

        expect ( execution.isSuccessful ).toBe ( true );

        // Handle the case where the execution is successful condition is not satisfied.

        if ( !execution.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( execution.state.undoStack ).toHaveLength ( 1 );
        expect ( execution.state.documentRevision ).toBe ( initialState.documentRevision + 1 );
        expect ( execution.state.draft.settings.name ).toBe ( "Imported" );

        const undo = undoDocumentCommand ( execution.state );

        expect ( undo.isSuccessful ).toBe ( true );

        // Handle the case where undo is successful is enabled.

        if ( undo.isSuccessful )
        {
            expect ( undo.state.draft ).toBe ( initialState.draft );
        }
    } );

    it ( "rejects an undeclared imported metadata initial state", () =>
    {
        // Initialize the local values needed by this operation.

        const inspection = inspectModelElementImport (
            createImportDraft (),
            {
                kind: "model_metadata",
                rows:
                [
                    {
                        rowNumber: 2,
                        value: { name: "Draft", description: "", version: "1.0.0", initialState: "missing" },
                    },
                ],
            },
        );

        expect ( inspection ).toMatchObject (
            { isSuccessful: false, diagnostics: [ { code: "CSV_REFERENCE_INVALID" } ] },
        );
    } );

    it ( "reports missing transition states and events once in first CSV appearance order", () =>
    {
        // Initialize the local values needed by this operation.

        const inspection = inspectModelElementImport (
            createImportDraft (),
            {
                kind: "transitions",
                rows:
                [
                    { rowNumber: 2, value: { state: "missing_source", event: "missing_second", stateNext: "missing_target" } },
                    { rowNumber: 3, value: { state: "missing_target", event: "missing_first", stateNext: "missing_source" } },
                    { rowNumber: 4, value: { state: "missing_third", event: "missing_second", stateNext: "state_one" } },
                ],
            },
        );

        expect ( inspection ).toMatchObject (
            {
                isSuccessful: false,
                missingReferences:
                {
                    states: [ "missing_source", "missing_target", "missing_third" ],
                    events: [ "missing_second", "missing_first" ],
                },
            },
        );
    } );

    it ( "requires collision confirmation and commits an accepted import as one undoable command", () =>
    {
        // Initialize the local values needed by this operation.

        const initialState = createDocumentEditorState ( createImportDraft () );
        const modelImport  = 
        {
            kind:       "named_entities" as const,
            entityKind: "event" as const,
            rows:
            [
                { rowNumber: 2, value: { name: "event_go", description: "Updated" } },
                { rowNumber: 3, value: { name: "event_stop", description: "Stop" } },
            ],
        };
        const blockedPlan = planDocumentCommand (
            initialState,
            {
                kind: "import_model_elements", modelImport, overwriteConflicts: false,
                expectedRevision: initialState.documentRevision,
            },
        );

        expect ( blockedPlan ).toMatchObject ( { isSuccessful: false, code: "IMPORT_CONFLICT" } );

        const acceptedPlan = planDocumentCommand (
            initialState,
            {
                kind: "import_model_elements", modelImport, overwriteConflicts: true,
                expectedRevision: initialState.documentRevision,
            },
        );

        expect ( acceptedPlan.isSuccessful ).toBe ( true );

        // Handle the case where the accepted plan is successful condition is not satisfied.

        if ( !acceptedPlan.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        const execution = executeDocumentCommand ( initialState, acceptedPlan.plan );

        expect ( execution.isSuccessful ).toBe ( true );

        // Handle the case where the execution is successful condition is not satisfied.

        if ( !execution.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( execution.state.undoStack ).toHaveLength ( 1 );
        expect ( execution.state.documentRevision ).toBe ( initialState.documentRevision + 1 );
        expect ( execution.state.draft.stateMachine.events ).toEqual (
            [
                { name: "event_go", description: "Updated" },
                { name: "event_stop", description: "Stop" },
            ],
        );

        const undone = undoDocumentCommand ( execution.state );

        expect ( undone.isSuccessful ).toBe ( true );

        // Handle the case where undone is successful is enabled.

        if ( undone.isSuccessful )
        {
            expect ( undone.state.draft ).toBe ( initialState.draft );
        }
    } );

} );

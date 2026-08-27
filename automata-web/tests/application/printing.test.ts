// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Printable Report Composition Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies deterministic section selection, immutable report capture, identity metadata, and
//   incomplete drafts.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import type { ApplicationPreferences } from "../../src/application/ports/contracts.js";
import { createPrintableReport } from "../../src/application/printing.js";
import type { AuthoringDraft } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { FILE_VERSION } from "../../src/domain/model/limits.js";
import { DEFAULT_APPLICATION_PREFERENCES } from "../../src/configuration/compile-time-configuration.js";


//--------------------------------------------------------------------------------------------------
// Function: createPopulatedDraft
//
// Description:
//
//   Creates populated draft for the test scenario.
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

function createPopulatedDraft (): AuthoringDraft
{
    // Return the assembled result.

    return {
        settings:
        {
            name:        "Printable Machine",
            description: "A complete report fixture.",
            version:     "2.3.4",
        },
        stateMachine:
        {
            initialState: "state_idle",
            events:
            [
                { description: "Begins work.", name: "event_start" },
            ],
            states:
            [
                { description: "Waiting.", name: "state_idle" },
                { description: "Working.", name: "state_active" },
            ],
            actions:
            [
                { description: "Starts the motor.", name: "action_start" },
                { description: "Records activity.", name: "action_log" },
            ],
            stateActions:
            {
                entry:
                [
                    { action: "action_start", state: "state_active" },
                    { action: "action_log", state: "state_active" },
                    { action: "action_start", state: "state_active" },
                ],
                exit:
                [
                    { action: "action_log", state: "state_active" },
                    { action: "action_log", state: "state_active" },
                ],
            },
            transitionTable:
            [
                { event: "event_start", state: "state_idle", stateNext: "state_active" },
            ],
        },
        chart:
        {
            settings: { expandStates: true },
            indicators:
            {
                initialStateIndicator: { state: "state_idle", x: 20, y: 40 },
                terminalStateIndicators: [ { id: 1, x: 600, y: 400 } ],
                terminalStateTransitions: [ { state: "state_active", terminalStateIndicatorId: 1 } ],
            },
            states:
            [
                { height: 80, state: "state_idle", x: 100, y: 100 },
                { height: 100, state: "state_active", x: 400, y: 300 },
            ],
            draftTransitions:
            [
                { id: 7, source: { x: 10, y: 20 }, target: { x: 30, y: 40 } },
            ],
        },
        solver:
        {
            sequences:
            [
                {
                    description:  "A starting observation.",
                    name:         "solver_sequence",
                    sequence:     [ "state_idle", "event_start", "state_active" ],
                    startContext: "initial",
                },
            ],
        },
        simulator:
        {
            sequences:
            [
                { description: "A run sequence.", name: "simulator_sequence", sequence: [ "event_start" ] },
            ],
        },
    };
}

describe ( "AL-PRN-002 printable report section selection", () =>
{
    it ( "orders every included section deterministically and omits excluded sections", () =>
    {
        // Initialize the local values needed by this operation.

        const draft          = createPopulatedDraft ();
        const completeReport = createPrintableReport ( draft, 12, DEFAULT_APPLICATION_PREFERENCES );

        expect ( completeReport.sections.map ( section => section.kind ) ).toEqual (
            [
                "modelSummary",
                "states",
                "events",
                "actions",
                "transitionTable",
                "stateChart",
                "chart",
                "solver",
                "simulator",
            ],
        );


        // Initialize the local values needed by this operation.

        const filteredPreferences: ApplicationPreferences =
        {
            ...DEFAULT_APPLICATION_PREFERENCES,
            printIncludeActions:         false,
            printIncludeChart:           false,
            printIncludeEvents:          true,
            printIncludeModelSummary:    false,
            printIncludeSimulator:       false,
            printIncludeSolver:          false,
            printIncludeStateChart:      false,
            printIncludeStates:          false,
            printIncludeTransitionTable: true,
        };
        const filteredReport = createPrintableReport ( draft, 12, filteredPreferences );

        expect ( filteredReport.sections.map ( section => section.kind ) ).toEqual (
            [ "events", "transitionTable" ],
        );
    } );

    it ( "defaults print fields missing from a legacy runtime preference snapshot", () =>
    {
        // Initialize the local values needed by this operation.

        const legacyPreferences = {
            ...DEFAULT_APPLICATION_PREFERENCES,
            printIncludeStateChart: undefined,
            printStyle:             undefined,
        } as unknown as ApplicationPreferences;
        const report = createPrintableReport ( createPopulatedDraft (), 12, legacyPreferences );

        expect ( report.pageSetup.printIncludeStateChart ).toBe ( true );
        expect ( report.pageSetup.printStyle ).toBe ( "Academic" );
        expect ( report.sections.some ( section => section.kind === "stateChart" ) ).toBe ( true );
    } );

    it ( "preserves duplicate entry and exit actions in declared order", () =>
    {
        // Initialize the local values needed by this operation.

        const report        = createPrintableReport ( createPopulatedDraft (), 4, DEFAULT_APPLICATION_PREFERENCES );
        const statesSection = report.sections.find ( section => section.kind === "states" );
        const activeState   = statesSection?.rows.find ( state => state.name === "state_active" );

        expect ( activeState?.entryActions ).toEqual ( [ "action_start", "action_log", "action_start" ] );
        expect ( activeState?.exitActions ).toEqual ( [ "action_log", "action_log" ] );
    } );
} );

describe ( "AL-PRN-003 immutable printable report capture", () =>
{
    it ( "copies every captured value instead of retaining mutable draft references", () =>
    {
        // Initialize the local values needed by this operation.

        const settings             = { name: "Before Capture", description: "Before", version: "1.0.0" };
        const state                = { description: "Original state", name: "state_original" };
        const action               = { description: "Original action", name: "action_original" };
        const entryMapping         = { action: "action_original", state: "state_original" };
        const chartState           = { height: 80, state: "state_original", x: 25, y: 50 };
        const solverSequenceTokens = [ "state_original", "action_original" ];
        const draft                = {
            ...createEmptyAuthoringDraft (),
            settings,
            stateMachine:
            {
                initialState: "state_original",
                events:       [],
                states:       [ state ],
                actions:      [ action ],
                stateActions:
                {
                    entry: [ entryMapping ],
                    exit:  [],
                },
                transitionTable: [],
            },
            chart:
            {
                ...createEmptyAuthoringDraft ().chart,
                states: [ chartState ],
            },
            solver:
            {
                sequences:
                [
                    {
                        description:  "Original sequence",
                        name:         "solver_original",
                        sequence:     solverSequenceTokens,
                        startContext: "initial",
                    },
                ],
            },
        } satisfies AuthoringDraft;
        const stateChartImageSource = "data:image/svg+xml;charset=utf-8,%3Csvg%20data-model=%22Before%22/%3E";
        const report                = createPrintableReport (
            draft,
            9,
            DEFAULT_APPLICATION_PREFERENCES,
            "before.json",
            stateChartImageSource,
        );

        settings.name              = "After Capture";
        state.name                 = "state_changed";
        action.name                = "action_changed";
        entryMapping.action        = "action_changed";
        chartState.x               = 999;
        solverSequenceTokens [ 0 ] = "state_changed";


        // Initialize the local values needed by this operation.

        const statesSection     = report.sections.find ( section => section.kind === "states" );
        const stateChartSection = report.sections.find ( section => section.kind === "stateChart" );
        const chartSection      = report.sections.find ( section => section.kind === "chart" );
        const solverSection     = report.sections.find ( section => section.kind === "solver" );

        expect ( report.modelName ).toBe ( "Before Capture" );
        expect ( statesSection?.rows ).toEqual (
            [
                {
                    description:  "Original state",
                    entryActions: [ "action_original" ],
                    exitActions:  [],
                    name:         "state_original",
                },
            ],
        );
        expect ( stateChartSection?.imageSource ).toBe ( stateChartImageSource );
        expect ( chartSection?.statePlacements [ 0 ]?.x ).toBe ( 25 );
        expect ( solverSection?.rows [ 0 ]?.sequence ).toEqual ( [ "state_original", "action_original" ] );
    } );

    it ( "identifies the model, file version, and captured document revision in the report header", () =>
    {
        // Initialize the local values needed by this operation.

        const report = createPrintableReport ( createPopulatedDraft (), 37, DEFAULT_APPLICATION_PREFERENCES );

        expect ( report.modelName ).toBe ( "Printable Machine" );
        expect ( report.fileVersion ).toBe ( FILE_VERSION );
        expect ( report.capturedDocumentRevision ).toBe ( 37 );
    } );

    it ( "composes every enabled section for an empty incomplete authoring draft", () =>
    {
        // Initialize the local values needed by this operation.

        const report = createPrintableReport (
            createEmptyAuthoringDraft (),
            1,
            DEFAULT_APPLICATION_PREFERENCES,
        );
        const summarySection    = report.sections.find ( section => section.kind === "modelSummary" );
        const stateChartSection = report.sections.find ( section => section.kind === "stateChart" );
        const chartSection      = report.sections.find ( section => section.kind === "chart" );
        const rowSections       = report.sections.filter ( section => "rows" in section );

        expect ( report.modelName ).toBe ( "Untitled State Machine" );
        expect ( summarySection ).toMatchObject ( {
            actionCount:         0,
            entryMappingCount:   0,
            eventCount:          0,
            exitMappingCount:    0,
            initialState:        null,
            simulatorSequenceCount: 0,
            solverSequenceCount: 0,
            stateCount:          0,
            transitionCount:     0,
        } );
        expect ( rowSections.every ( section => section.rows.length === 0 ) ).toBe ( true );
        expect ( stateChartSection ).toMatchObject ( { imageSource: null } );
        expect ( chartSection ).toMatchObject ( {
            draftTransitions:   [],
            initialIndicator:   null,
            statePlacements:    [],
            terminalIndicators: [],
            terminalRelations:  [],
        } );
    } );
} );

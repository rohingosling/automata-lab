// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Printable Report Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies semantic report rendering, selected sections, output escaping, page rules, and
//   long-table structure.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import type { PrintableReport, PrintableState } from "../../src/application/printing.js";
import { extractPrintPageSetup } from "../../src/application/printing.js";
import { DEFAULT_APPLICATION_PREFERENCES } from "../../src/configuration/compile-time-configuration.js";
import { createPrintPageStyle } from "../../src/presentation/printing/print-page-style.js";
import { PrintableReportSurface } from "../../src/presentation/printing/PrintableReport.js";

const APPLICATION_STYLE = readFileSync ( "src/application.css", "utf8" );


//--------------------------------------------------------------------------------------------------
// Function: createCompleteReport
//
// Description:
//
//   Creates complete report for the test scenario.
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

function createCompleteReport (): PrintableReport
{
    // Return the assembled result.

    return {
        capturedDocumentRevision: 42,
        fileName:                 "report-machine.json",
        fileVersion:              "1.0.0",
        modelName:                "Report Machine",
        pageSetup:                extractPrintPageSetup ( DEFAULT_APPLICATION_PREFERENCES ),
        sections:
        [
            {
                actionCount:            2,
                description:            "A semantic report fixture.",
                entryMappingCount:      2,
                eventCount:             1,
                exitMappingCount:       1,
                initialState:           "state_idle",
                kind:                   "modelSummary",
                modelVersion:           "2.0.0",
                simulatorSequenceCount: 1,
                solverSequenceCount:    1,
                stateCount:             2,
                transitionCount:        1,
            },
            {
                kind: "states",
                rows:
                [
                    {
                        description:  "Waiting for input.",
                        entryActions: [ "action_enter", "action_log" ],
                        exitActions:  [ "action_leave" ],
                        name:         "state_idle",
                    },
                ],
            },
            {
                kind: "events",
                rows: [ { description: "Begins work.", name: "event_start" } ],
            },
            {
                kind: "actions",
                rows: [ { description: "Records entry.", name: "action_enter" } ],
            },
            {
                kind: "transitionTable",
                rows: [ { destinationState: "state_active", event: "event_start", sourceState: "state_idle" } ],
            },
            {
                imageSource: "data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox=%220%200%20100%20100%22/%3E",
                kind:        "stateChart",
            },
            {
                draftTransitions:
                [
                    { id: 5, sourceX: 10, sourceY: 20, targetX: 30, targetY: 40 },
                ],
                initialIndicator: { state: "state_idle", x: 25, y: 50 },
                kind:             "chart",
                statePlacements:
                [
                    { height: 80, state: "state_idle", x: 100, y: 200 },
                ],
                terminalIndicators: [ { id: 7, x: 500, y: 600 } ],
                terminalRelations:  [ { state: "state_active", terminalIndicatorId: 7 } ],
            },
            {
                kind: "solver",
                rows:
                [
                    {
                        description:  "Observed startup.",
                        name:         "solver_start",
                        sequence:     [ "state_idle", "event_start", "state_active" ],
                        startContext: "initial",
                    },
                ],
            },
            {
                kind: "simulator",
                rows:
                [
                    { description: "Startup run.", name: "simulator_start", sequence: [ "event_start" ] },
                ],
            },
        ],
    };
}

describe ( "AL-PRN-004 printable report surface", () =>
{
    afterEach ( cleanup );

    it ( "renders the semantic identity header and every document table", () =>
    {
        render ( <PrintableReportSurface report={ createCompleteReport () } /> );

        const report = screen.getByRole ( "article", { name: "Printable State Machine Report" } );

        expect ( within ( report ).getByRole ( "heading", { level: 1, name: "Report Machine" } ) ).toBeInTheDocument ();
        expect ( within ( report ).getByText ( "File Version" ).tagName ).toBe ( "DT" );
        expect ( within ( report ).getByText ( "1.0.0" ).tagName ).toBe ( "DD" );
        expect ( within ( report ).getByText ( "Captured Document Revision" ).tagName ).toBe ( "DT" );
        expect ( within ( report ).getByText ( "42" ).tagName ).toBe ( "DD" );
        expect ( within ( report ).getAllByRole ( "heading", { level: 2 } ).map ( heading => heading.textContent ) )
            .toEqual ( [
                "Model Summary",
                "States",
                "Events",
                "Actions",
                "Transition Table",
                "State Chart",
                "Chart Projection",
                "Solver Observation Sequences",
                "Simulator Event Sequences",
            ] );
        expect ( within ( report ).getByRole ( "img", { name: "State Chart" } ) ).toBeInTheDocument ();
        expect ( within ( report ).getByRole ( "table", { name: "States" } ) ).toBeInTheDocument ();
        expect ( within ( report ).getByRole ( "table", { name: "Transition Table" } ) ).toBeInTheDocument ();
        expect ( within ( report ).getByRole ( "table", { name: "Solver Observation Sequences" } ) )
            .toBeInTheDocument ();
        expect ( within ( report ).getByRole ( "columnheader", { name: "Entry Actions" } ) ).toBeInTheDocument ();

        // Initialize the local values needed by this operation.

        const statesTable    = within ( report ).getByRole ( "table", { name: "States" } );
        const solverTable    = within ( report ).getByRole ( "table", { name: "Solver Observation Sequences" } );
        const simulatorTable = within ( report ).getByRole ( "table", { name: "Simulator Event Sequences" } );

        expect ( within ( statesTable ).getAllByRole ( "listitem" ).map ( item => item.textContent ) ).toEqual ( [
            "action_enter",
            "action_log",
            "action_leave",
        ] );
        expect ( within ( statesTable ).queryByText ( "action_enter → action_log" ) ).not.toBeInTheDocument ();
        expect ( within ( solverTable ).getAllByRole ( "listitem" ).map ( item => item.textContent ) ).toEqual ( [
            "state_idle",
            "event_start",
            "state_active",
        ] );
        expect ( within ( simulatorTable ).getAllByRole ( "listitem" ).map ( item => item.textContent ) )
            .toEqual ( [ "event_start" ] );
        expect ( within ( solverTable ).queryByText ( "state_idle → event_start → state_active" ) )
            .not.toBeInTheDocument ();
    } );

    it ( "renders only the selected report sections and no interactive controls", () =>
    {
        // Initialize the local values needed by this operation.

        const completeReport          = createCompleteReport ();
        const report: PrintableReport = {
            ...completeReport,
            sections: completeReport.sections.filter ( section =>
                section.kind === "events" || section.kind === "simulator" ),
        };
        const { container } = render ( <PrintableReportSurface report={ report } /> );
        const reportElement = screen.getByRole ( "article", { name: "Printable State Machine Report" } );

        expect ( within ( reportElement ).getAllByRole ( "heading", { level: 2 } ).map ( heading => heading.textContent ) )
            .toEqual ( [ "Events", "Simulator Event Sequences" ] );
        expect ( within ( reportElement ).queryByRole ( "heading", { name: "States" } ) ).not.toBeInTheDocument ();
        expect ( within ( reportElement ).queryByRole ( "table", { name: "Transition Table" } ) )
            .not.toBeInTheDocument ();
        expect ( container.querySelectorAll (
            "button, input, select, textarea, a[href], [contenteditable='true'], [tabindex]",
        ) ).toHaveLength ( 0 );
    } );

    it ( "renders a legacy report without a print style as Academic instead of throwing", () =>
    {
        // Initialize the local values needed by this operation.

        const completeReport = createCompleteReport ();
        const legacyReport   = {
            ...completeReport,
            pageSetup:
            {
                ...completeReport.pageSetup,
                printStyle: undefined as never,
            },
        };
        const { container } = render ( <PrintableReportSurface report={ legacyReport } /> );
        const report = screen.getByRole ( "article", { name: "Printable State Machine Report" } );

        expect ( report ).toHaveAttribute ( "data-print-style", "academic" );
        expect ( container.querySelector ( "style[media='print']" ) ).toHaveTextContent ( "Times New Roman" );
    } );

    it ( "renders malicious model content as inert text", () =>
    {
        // Initialize the local values needed by this operation.

        const maliciousText           = "<script>globalThis.compromised = true</script><img src=x onerror=alert(1)>";
        const completeReport          = createCompleteReport ();
        const report: PrintableReport = {
            ...completeReport,
            modelName: maliciousText,
            sections:
            [
                {
                    kind: "events",
                    rows: [ { description: maliciousText, name: "event_malicious" } ],
                },
            ],
        };
        const { container } = render ( <PrintableReportSurface report={ report } /> );

        expect ( screen.getByRole ( "heading", { level: 1 } ) ).toHaveTextContent ( maliciousText );
        expect ( screen.getByRole ( "cell", { name: maliciousText } ) ).toHaveTextContent ( maliciousText );
        expect ( container.querySelector ( "script" ) ).toBeNull ();
        expect ( container.querySelector ( "img" ) ).toBeNull ();
        expect ( Reflect.get ( globalThis, "compromised" ) ).toBeUndefined ();
    } );

    it ( "creates the exact allowlisted page-style string", () =>
    {
        // Initialize the local values needed by this operation.

        const completeReport          = createCompleteReport ();
        const report: PrintableReport = {
            ...completeReport,
            pageSetup:
            {
                ...completeReport.pageSetup,
                printMarginBottomMillimetres: 50,
                printMarginLeftMillimetres:   6.25,
                printMarginRightMillimetres:  12.7,
                printMarginTopMillimetres:    0,
                printOrientation:             "Landscape",
                printPaperSize:               "Letter",
            },
        };
        const expectedStyle = '@page { size: letter landscape; margin: 0mm 12.7mm 50mm 6.25mm; ' +
            '@top-left { content: none; } @top-center { content: "Automata Lab — report-machine.json"; ' +
            'font-family: "Times New Roman", Times, serif; font-size: 8pt; text-align: center; } ' +
            '@top-right { content: none; } } .print-report { --print-state-chart-height: 147.9mm; }';
        const { container } = render ( <PrintableReportSurface report={ report } /> );

        expect ( createPrintPageStyle ( report ) ).toBe ( expectedStyle );
        expect ( container.querySelector ( "style[media='print']" ) ).toHaveTextContent ( expectedStyle );
    } );

    it ( "uses semantic table headers that repeat for a long table where the browser supports it", () =>
    {
        // Initialize the local values needed by this operation.

        const rows: PrintableState[] = Array.from ( { length: 150 }, ( _value, index ) => ( {
            description:  `State row ${index + 1}`,
            entryActions: [],
            exitActions:  [],
            name:         `state_${index + 1}`,
        } ) );
        const completeReport          = createCompleteReport ();
        const report: PrintableReport = {
            ...completeReport,
            sections: [ { kind: "states", rows } ],
        };

        render ( <PrintableReportSurface report={ report } /> );

        // Initialize the local values needed by this operation.

        const table     = screen.getByRole ( "table", { name: "States" } );
        const tableHead = table.querySelector ( "thead" );

        expect ( tableHead ).not.toBeNull ();
        expect ( within ( tableHead as HTMLElement ).getAllByRole ( "columnheader" ).map (
            heading => heading.textContent,
        ) ).toEqual ( [ "Name", "Description", "Entry Actions", "Exit Actions" ] );
        expect ( table.querySelectorAll ( "tbody > tr" ) ).toHaveLength ( 150 );
        expect ( APPLICATION_STYLE ).toMatch (
            /\.print-report-table\s+thead\s*\{[^}]*display:\s*table-header-group;/su,
        );
    } );

    it ( "uses the compact print typography scale", () =>
    {
        expect ( APPLICATION_STYLE ).toMatch ( /\.print-report\s*\{[^}]*font-size:\s*8pt;/su );
        expect ( APPLICATION_STYLE ).toMatch ( /\.print-report-header\s*\{[^}]*text-align:\s*left;/su );
        expect ( APPLICATION_STYLE ).toMatch ( /\.print-report-header\s+h1\s*\{[^}]*font-size:\s*14pt;/su );
        expect ( APPLICATION_STYLE ).toMatch ( /\.print-report\s+h2\s*\{[^}]*font-size:\s*11pt;/su );
        expect ( APPLICATION_STYLE ).toMatch ( /\.print-report\s+h3\s*\{[^}]*font-size:\s*9pt;/su );
        expect ( APPLICATION_STYLE ).toMatch (
            /\.print-report-table\s+th,[\s\S]*?\.print-report-table\s+td\s*\{[^}]*font-size:\s*7pt;/su,
        );
        expect ( APPLICATION_STYLE ).toMatch ( /data-print-style="academic"[^}]*Times New Roman/su );
        expect ( APPLICATION_STYLE ).toMatch ( /data-print-style="industry"[^}]*thead th[^}]*#cccccc/su );
        expect ( APPLICATION_STYLE ).toMatch ( /data-print-style="industry"[^}]*print-color-adjust:\s*exact/su );
        expect ( APPLICATION_STYLE ).toMatch ( /print-report-section \+ \.print-report-section[^}]*break-before:\s*page/su );
        expect ( APPLICATION_STYLE ).toMatch ( /\.print-report-table\s*\{[^}]*margin-top:\s*3\.8mm/su );
    } );
} );

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Printable Report
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Renders the immutable printable-report model as control-free semantic headings and tables.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ReactNode } from "react";

import type
{
    PrintableActionsSection,
    PrintableChartSection,
    PrintableEventsSection,
    PrintableModelSummarySection,
    PrintableNamedEntity,
    PrintableReport,
    PrintableReportSection,
    PrintableSimulatorSection,
    PrintableSolverSection,
    PrintableStateChartSection,
    PrintableStatesSection,
    PrintableTransitionTableSection,
} from "../../application/printing.js";
import { text } from "../../localization/messages.js";
import { createPrintPageStyle } from "./print-page-style.js";


//--------------------------------------------------------------------------------------------------
// Interface: PrintableReportProperties
//
// Description:
//
//   Defines the properties accepted by the printable report interface.
//
//--------------------------------------------------------------------------------------------------

interface PrintableReportProperties
{
    readonly report: PrintableReport;
}


//--------------------------------------------------------------------------------------------------
// Interface: ReportTableProperties
//
// Description:
//
//   Defines the properties accepted by the report table interface.
//
//--------------------------------------------------------------------------------------------------

interface ReportTableProperties
{
    readonly children: ReactNode;
    readonly headings: readonly string[];
    readonly label:    string;
}


//--------------------------------------------------------------------------------------------------
// Function: ReportTable
//
// Description:
//
//   Renders the report table interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered report table interface.
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

function ReportTable ( properties: ReportTableProperties )
{
    // Return the rendered interface.

    return (
        <table aria-label={ properties.label } className="print-report-table">
            <thead>
                <tr>{ properties.headings.map ( heading => <th key={ heading } scope="col">{ heading }</th> ) }</tr>
            </thead>
            <tbody>{ properties.children }</tbody>
        </table>
    );
}


//--------------------------------------------------------------------------------------------------
// Function: emptyValue
//
// Description:
//
//   Derives the empty value.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
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

function emptyValue ( value: string | null ): string
{
    // Return the result selected by the current condition.

    return value === null || value.length === 0 ? text ( "report.value.none" ) : value;
}


//--------------------------------------------------------------------------------------------------
// Function: TableListValues
//
// Description:
//
//   Renders the table list values interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered table list values interface.
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

function TableListValues ( properties: { readonly values: readonly string[] } )
{
    // Handle the case where length equals 0.

    if ( properties.values.length === 0 )
    {
        // Return the rendered interface.

        return <>{ text ( "report.value.none" ) }</>;
    }


    // Return the rendered interface.

    return (
        <ul className="print-table-list">
            { properties.values.map ( ( value, index ) => <li key={ `${index}\u0000${value}` }>{ value }</li> ) }
        </ul>
    );
}


//--------------------------------------------------------------------------------------------------
// Function: StateChartSection
//
// Description:
//
//   Renders the state chart section interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered state chart section interface.
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

function StateChartSection ( properties: { readonly section: PrintableStateChartSection } )
{
    // Return the rendered interface.

    return (
        <section className="print-report-section print-state-chart-section">
            <h2>{ text ( "report.section.stateChart" ) }</h2>
            <div className="print-state-chart-frame">
                { properties.section.imageSource === null
                    ? <p>{ text ( "report.value.none" ) }</p>
                    : (
                        <img
                            alt       = { text ( "report.section.stateChart" ) }
                            className = "print-state-chart-image"
                            src       = { properties.section.imageSource }
                        />
                    ) }
            </div>
        </section>
    );
}


//--------------------------------------------------------------------------------------------------
// Function: renderNamedEntityRows
//
// Description:
//
//   Renders named entity rows.
//
// Parameters:
//
//   - rows:
//     The rows supplied to the operation.
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

function renderNamedEntityRows ( rows: readonly PrintableNamedEntity[] ): ReactNode
{
    // Return the mapped collection.

    return rows.map ( row => (
        <tr key={ row.name }>
            <th scope="row">{ row.name }</th>
            <td>{ emptyValue ( row.description ) }</td>
        </tr>
    ) );
}


//--------------------------------------------------------------------------------------------------
// Function: ModelSummarySection
//
// Description:
//
//   Renders the model summary section interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered model summary section interface.
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

function ModelSummarySection ( properties: { readonly section: PrintableModelSummarySection } )
{
    // Initialize the local values needed by this operation.

    const section = properties.section;


    // Return the rendered interface.

    return (
        <section className="print-report-section">
            <h2>{ text ( "report.section.modelSummary" ) }</h2>
            <dl className="print-report-summary">
                <div><dt>{ text ( "report.model.description" ) }</dt><dd>{ emptyValue ( section.description ) }</dd></div>
                <div><dt>{ text ( "report.model.version" ) }</dt><dd>{ emptyValue ( section.modelVersion ) }</dd></div>
                <div><dt>{ text ( "report.model.initialState" ) }</dt><dd>{ emptyValue ( section.initialState ) }</dd></div>
            </dl>
            <ReportTable
                headings = { [ text ( "report.column.measure" ), text ( "report.column.count" ) ] }
                label    = { text ( "report.table.modelCounts" ) }
            >
                <tr><th scope="row">{ text ( "report.count.states" ) }</th><td>{ section.stateCount }</td></tr>
                <tr><th scope="row">{ text ( "report.count.events" ) }</th><td>{ section.eventCount }</td></tr>
                <tr><th scope="row">{ text ( "report.count.actions" ) }</th><td>{ section.actionCount }</td></tr>
                <tr><th scope="row">{ text ( "report.count.transitions" ) }</th><td>{ section.transitionCount }</td></tr>
                <tr><th scope="row">{ text ( "report.count.entryMappings" ) }</th><td>{ section.entryMappingCount }</td></tr>
                <tr><th scope="row">{ text ( "report.count.exitMappings" ) }</th><td>{ section.exitMappingCount }</td></tr>
                <tr><th scope="row">{ text ( "report.count.solverSequences" ) }</th><td>{ section.solverSequenceCount }</td></tr>
                <tr><th scope="row">{ text ( "report.count.simulatorSequences" ) }</th><td>{ section.simulatorSequenceCount }</td></tr>
            </ReportTable>
        </section>
    );
}


//--------------------------------------------------------------------------------------------------
// Function: StatesSection
//
// Description:
//
//   Renders the states section interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered states section interface.
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

function StatesSection ( properties: { readonly section: PrintableStatesSection } )
{
    // Return the rendered interface.

    return (
        <section className="print-report-section">
            <h2>{ text ( "report.section.states" ) }</h2>
            <ReportTable
                headings={ [
                    text ( "report.column.name" ),
                    text ( "report.column.description" ),
                    text ( "report.column.entryActions" ),
                    text ( "report.column.exitActions" ),
                ] }
                label={ text ( "report.section.states" ) }
            >
                { properties.section.rows.map ( row => (
                    <tr key={ row.name }>
                        <th scope="row">{ row.name }</th>
                        <td>{ emptyValue ( row.description ) }</td>
                        <td><TableListValues values={ row.entryActions } /></td>
                        <td><TableListValues values={ row.exitActions } /></td>
                    </tr>
                ) ) }
            </ReportTable>
        </section>
    );
}


//--------------------------------------------------------------------------------------------------
// Function: EntitySection
//
// Description:
//
//   Renders the entity section interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered entity section interface.
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

function EntitySection ( properties: {
    readonly section: PrintableActionsSection | PrintableEventsSection;
} )
{
    // Initialize the local values needed by this operation.

    const title = text ( properties.section.kind === "actions"
        ? "report.section.actions"
        : "report.section.events" );


    // Return the rendered interface.

    return (
        <section className="print-report-section">
            <h2>{ title }</h2>
            <ReportTable
                headings = { [ text ( "report.column.name" ), text ( "report.column.description" ) ] }
                label    = { title }
            >
                { renderNamedEntityRows ( properties.section.rows ) }
            </ReportTable>
        </section>
    );
}


//--------------------------------------------------------------------------------------------------
// Function: TransitionTableSection
//
// Description:
//
//   Renders the transition table section interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered transition table section interface.
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

function TransitionTableSection ( properties: { readonly section: PrintableTransitionTableSection } )
{
    // Return the rendered interface.

    return (
        <section className="print-report-section">
            <h2>{ text ( "report.section.transitionTable" ) }</h2>
            <ReportTable
                headings={ [
                    text ( "report.column.sourceState" ),
                    text ( "report.column.event" ),
                    text ( "report.column.destinationState" ),
                ] }
                label={ text ( "report.section.transitionTable" ) }
            >
                { properties.section.rows.map ( ( row, index ) => (
                    <tr key={ `${row.sourceState}\u0000${row.event}\u0000${index}` }>
                        <td>{ row.sourceState }</td>
                        <td>{ row.event }</td>
                        <td>{ row.destinationState }</td>
                    </tr>
                ) ) }
            </ReportTable>
        </section>
    );
}


//--------------------------------------------------------------------------------------------------
// Function: ChartSection
//
// Description:
//
//   Renders the chart section interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered chart section interface.
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

function ChartSection ( properties: { readonly section: PrintableChartSection } )
{
    // Initialize the local values needed by this operation.

    const section = properties.section;


    // Return the rendered interface.

    return (
        <section className="print-report-section">
            <h2>{ text ( "report.section.chart" ) }</h2>
            <h3>{ text ( "report.chart.statePlacements" ) }</h3>
            <ReportTable
                headings={ [
                    text ( "report.column.state" ),
                    text ( "report.column.x" ),
                    text ( "report.column.y" ),
                    text ( "report.column.height" ),
                ] }
                label={ text ( "report.chart.statePlacements" ) }
            >
                { section.statePlacements.map ( row => (
                    <tr key={ row.state }>
                        <th scope="row">{ row.state }</th>
                        <td>{ row.x }</td>
                        <td>{ row.y }</td>
                        <td>{ row.height ?? text ( "report.value.default" ) }</td>
                    </tr>
                ) ) }
            </ReportTable>
            <h3>{ text ( "report.chart.initialIndicator" ) }</h3>
            <ReportTable
                headings = { [ text ( "report.column.state" ), text ( "report.column.x" ), text ( "report.column.y" ) ] }
                label    = { text ( "report.chart.initialIndicator" ) }
            >
                { section.initialIndicator === null
                    ? null
                    : (
                        <tr>
                            <td>{ emptyValue ( section.initialIndicator.state ) }</td>
                            <td>{ section.initialIndicator.x }</td>
                            <td>{ section.initialIndicator.y }</td>
                        </tr>
                    ) }
            </ReportTable>
            <h3>{ text ( "report.chart.terminalIndicators" ) }</h3>
            <ReportTable
                headings = { [ text ( "report.column.identifier" ), text ( "report.column.x" ), text ( "report.column.y" ) ] }
                label    = { text ( "report.chart.terminalIndicators" ) }
            >
                { section.terminalIndicators.map ( row => (
                    <tr key={ row.id }><th scope="row">{ row.id }</th><td>{ row.x }</td><td>{ row.y }</td></tr>
                ) ) }
            </ReportTable>
            <h3>{ text ( "report.chart.terminalRelations" ) }</h3>
            <ReportTable
                headings = { [ text ( "report.column.state" ), text ( "report.column.terminalIndicator" ) ] }
                label    = { text ( "report.chart.terminalRelations" ) }
            >
                { section.terminalRelations.map ( ( row, index ) => (
                    <tr key={ `${row.state}\u0000${row.terminalIndicatorId}\u0000${index}` }>
                        <td>{ row.state }</td><td>{ row.terminalIndicatorId }</td>
                    </tr>
                ) ) }
            </ReportTable>
            <h3>{ text ( "report.chart.draftTransitions" ) }</h3>
            <ReportTable
                headings={ [
                    text ( "report.column.identifier" ),
                    text ( "report.column.sourceCoordinates" ),
                    text ( "report.column.targetCoordinates" ),
                ] }
                label={ text ( "report.chart.draftTransitions" ) }
            >
                { section.draftTransitions.map ( row => (
                    <tr key={ row.id }>
                        <th scope="row">{ row.id }</th>
                        <td>{ `${row.sourceX}, ${row.sourceY}` }</td>
                        <td>{ `${row.targetX}, ${row.targetY}` }</td>
                    </tr>
                ) ) }
            </ReportTable>
        </section>
    );
}


//--------------------------------------------------------------------------------------------------
// Function: SolverSection
//
// Description:
//
//   Renders the solver section interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered solver section interface.
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

function SolverSection ( properties: { readonly section: PrintableSolverSection } )
{
    // Return the rendered interface.

    return (
        <section className="print-report-section">
            <h2>{ text ( "report.section.solver" ) }</h2>
            <ReportTable
                headings={ [
                    text ( "report.column.name" ),
                    text ( "report.column.description" ),
                    text ( "report.column.startContext" ),
                    text ( "report.column.sequence" ),
                ] }
                label={ text ( "report.section.solver" ) }
            >
                { properties.section.rows.map ( row => (
                    <tr key={ row.name }>
                        <th scope="row">{ row.name }</th>
                        <td>{ emptyValue ( row.description ) }</td>
                        <td>{ row.startContext }</td>
                        <td><TableListValues values={ row.sequence } /></td>
                    </tr>
                ) ) }
            </ReportTable>
        </section>
    );
}


//--------------------------------------------------------------------------------------------------
// Function: SimulatorSection
//
// Description:
//
//   Renders the simulator section interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered simulator section interface.
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

function SimulatorSection ( properties: { readonly section: PrintableSimulatorSection } )
{
    // Return the rendered interface.

    return (
        <section className="print-report-section">
            <h2>{ text ( "report.section.simulator" ) }</h2>
            <ReportTable
                headings={ [
                    text ( "report.column.name" ),
                    text ( "report.column.description" ),
                    text ( "report.column.sequence" ),
                ] }
                label={ text ( "report.section.simulator" ) }
            >
                { properties.section.rows.map ( row => (
                    <tr key={ row.name }>
                        <th scope="row">{ row.name }</th>
                        <td>{ emptyValue ( row.description ) }</td>
                        <td><TableListValues values={ row.sequence } /></td>
                    </tr>
                ) ) }
            </ReportTable>
        </section>
    );
}


//--------------------------------------------------------------------------------------------------
// Function: ReportSection
//
// Description:
//
//   Renders the report section interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   No value is returned.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - The described side effects are complete when the callable returns.
//
//--------------------------------------------------------------------------------------------------

function ReportSection ( properties: { readonly section: PrintableReportSection } )
{
    // Dispatch according to the kind value.

    switch ( properties.section.kind )
    {
        // Handle the "modelSummary" case.

        case "modelSummary":

            // Return the rendered interface.

            return <ModelSummarySection section={ properties.section } />;

        // Handle the "states" case.

        case "states":

            // Return the rendered interface.

            return <StatesSection section={ properties.section } />;

        // Handle the group of case values that share the following outcome.

        case "events":
        case "actions":

            // Return the rendered interface.

            return <EntitySection section={ properties.section } />;

        // Handle the "transitionTable" case.

        case "transitionTable":

            // Return the rendered interface.

            return <TransitionTableSection section={ properties.section } />;

        // Handle the "stateChart" case.

        case "stateChart":

            // Return the rendered interface.

            return <StateChartSection section={ properties.section } />;

        // Handle the "chart" case.

        case "chart":

            // Return the rendered interface.

            return <ChartSection section={ properties.section } />;

        // Handle the "solver" case.

        case "solver":

            // Return the rendered interface.

            return <SolverSection section={ properties.section } />;

        // Handle the "simulator" case.

        case "simulator":

            // Return the rendered interface.

            return <SimulatorSection section={ properties.section } />;
    }
}


//--------------------------------------------------------------------------------------------------
// Function: PrintableReportSurface
//
// Description:
//
//   Renders the printable report surface interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered printable report surface interface.
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

export function PrintableReportSurface ( properties: PrintableReportProperties )
{
    // Initialize the local values needed by this operation.

    const report     = properties.report;
    const printStyle = report.pageSetup.printStyle === "Industry" ? "industry" : "academic";


    // Return the rendered interface.

    return (
        <article
            aria-label={ text ( "report.title" ) }
            className="print-report"
            data-print-style={ printStyle }
        >
            <style media="print">{ createPrintPageStyle ( report ) }</style>
            <header className="print-report-header">
                <h1>{ emptyValue ( report.modelName ) }</h1>
                <dl>
                    <div><dt>{ text ( "report.fileVersion" ) }</dt><dd>{ report.fileVersion }</dd></div>
                    <div>
                        <dt>{ text ( "report.documentRevision" ) }</dt>
                        <dd>{ report.capturedDocumentRevision }</dd>
                    </div>
                </dl>
            </header>
            { report.sections.map ( section => <ReportSection key={ section.kind } section={ section } /> ) }
        </article>
    );
}

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Sequence and Candidate Review Page
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Provides saved partial-observation editing and an immutable, provenance-rich candidate review
//   workspace.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, KeyboardEvent } from "react";

import type { SolverWorkspaceState } from "../../application/solver-workspace.js";
import type
{
    AuthoringDraft,
    SolverCandidate,
    SolverSequence,
} from "../../domain/model/contracts.js";
import type { SolverObservationDiagnostic, SolverObservationInput } from "../../domain/solver/contracts.js";
import { normalizeSolverObservations } from "../../domain/solver/normalization.js";
import { text } from "../../localization/messages.js";
import { SolverSequenceDialog } from "../dialogs/DialogPatterns.js";
import { isNearScrollableEnd, useProgressiveRendering } from "../shared/progressive-rendering.js";
import { Splitter } from "../shared/Splitter.js";
import { Tabs } from "../shared/Tabs.js";
import { CandidateStateChart } from "./CandidateStateChart.js";
import type { CandidateChartNameWrapping } from "./CandidateStateChart.js";

//--------------------------------------------------------------------------------------------------
// Type: CandidateReviewTab
//
// Description:
//
//   Defines the supported candidate review tab alternatives.
//
//--------------------------------------------------------------------------------------------------

type CandidateReviewTab =
    | "solver-candidate-summary"
    | "solver-candidate-chart"
    | "solver-candidate-states"
    | "solver-candidate-transitions"
    | "solver-candidate-coverage"
    | "solver-candidate-report"
    | "solver-candidate-comparison";

const DEFAULT_SOLVER_SEQUENCE: SolverSequence =
{
    description:  "",
    name:         "observation_1",
    sequence:     [],
    startContext: "infer",
};
const DEFAULT_SOLVER_SEQUENCE_LIST_WIDTH      = 420;
const BASE_MINIMUM_SOLVER_SEQUENCE_LIST_WIDTH = 260;
const MINIMUM_SOLVER_TOKEN_EDITOR_WIDTH       = 360;

//--------------------------------------------------------------------------------------------------
// Interface: SolverPageProperties
//
// Description:
//
//   Defines the properties accepted by the solver page interface.
//
//--------------------------------------------------------------------------------------------------

interface SolverPageProperties
{
    readonly chartNameWrapping: CandidateChartNameWrapping;
    readonly draft:             AuthoringDraft | null;
    readonly solverWorkspace:   SolverWorkspaceState;
    readonly onApplyCandidate:  ( candidate: SolverCandidate ) => void;
    readonly onCancelSolve:     () => void;
    readonly onDiscardCandidate: () => void;
    readonly onSequencesChange: ( sequences: readonly SolverSequence[] ) => void;
    readonly onSolve:           ( observations: readonly SolverObservationInput[] ) => void;
    readonly onValidate:        ( diagnostics: readonly SolverObservationDiagnostic[] ) => void;
}

//--------------------------------------------------------------------------------------------------
// Function: observationInputs
//
// Description:
//
//   Derives the observation inputs.
//
// Parameters:
//
//   - sequences:
//     The sequences supplied to the operation.
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

function observationInputs ( sequences: readonly SolverSequence[] ): readonly SolverObservationInput[]
{
    // Return the mapped collection.

    return sequences.map ( sequence => ( {
        name: sequence.name,
        startContext: sequence.startContext,
        rawTokens: sequence.sequence,
    } ) );
}

//--------------------------------------------------------------------------------------------------
// Function: cleanTokenLines
//
// Description:
//
//   Cleans the token lines.
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

function cleanTokenLines ( value: string ): readonly string[]
{
    // Return the filtered collection.

    return value.split ( /\r?\n/gu ).map ( token => token.trim () ).filter ( token => token.length > 0 );
}

//--------------------------------------------------------------------------------------------------
// Function: revealProgressiveItemsFromKeyboard
//
// Description:
//
//   Reveals the progressive items from keyboard.
//
// Parameters:
//
//   - event:
//     The event to process.
//
//   - revealNextBatch:
//     The reveal next batch supplied to the operation.
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

function revealProgressiveItemsFromKeyboard (
    event: KeyboardEvent<HTMLElement>,
    revealNextBatch: () => void,
): void
{
    // Handle the case where at least one branch condition is satisfied.

    if ( event.key === "End" || event.key === "PageDown" )
    {
        revealNextBatch ();
    }
}

//--------------------------------------------------------------------------------------------------
// Function: StateActionsView
//
// Description:
//
//   Renders the state actions view interface.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
//
// Returns:
//
//   The rendered state actions view interface.
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

function StateActionsView ( candidate: SolverCandidate )
{
    // Initialize the local values needed by this operation.

    const progressiveRendering = useProgressiveRendering ( candidate.stateMachine.states.length );
    const entryActionsByState  = new Map<string, string[]> ();
    const evidenceByState      = new Map ( candidate.provenance.states.map ( state => [ state.state, state.evidence ] ) );

    // Process each mapping from the entry collection in order.

    for ( const mapping of candidate.stateMachine.stateActions.entry )
    {
        // Initialize the local values needed by this operation.

        const actions = entryActionsByState.get ( mapping.state ) ?? [];

        actions.push ( mapping.action );
        entryActionsByState.set ( mapping.state, actions );
    }

    // Return the rendered interface.

    return (
        <div
            aria-label={ text ( "solver.candidate.statesActions" ) }
            className = "solver-review-scroll"
            onKeyDown = { event => revealProgressiveItemsFromKeyboard (
                event,
                progressiveRendering.revealNextBatch,
            ) }
            onScroll={ event =>
            {
                // Handle the case where is near scrollable end result is enabled.

                if ( isNearScrollableEnd ( event.currentTarget ) )
                {
                    progressiveRendering.revealNextBatch ();
                }
            } }
            role     = "region"
            tabIndex = { 0 }
        >
            <table className="data-table solver-review-table">
                <thead><tr><th>{ text ( "solver.candidate.state" ) }</th><th>{ text ( "solver.candidate.provenance" ) }</th><th>{ text ( "solver.candidate.actions" ) }</th><th>{ text ( "solver.candidate.exitActions" ) }</th></tr></thead>
                <tbody>
                    { candidate.stateMachine.states.slice ( 0, progressiveRendering.visibleItemCount ).map ( state =>
                    {
                        // Initialize the local values needed by this operation.

                        const entryActions = entryActionsByState.get ( state.name ) ?? [];
                        const evidence     = evidenceByState.get ( state.name ) ?? "inferred";

                        // Return the rendered interface.

                        return (
                            <tr key={ state.name }>
                                <th scope="row">{ state.name }</th><td>{ evidence }</td>
                                <td>{ entryActions.length === 0 ? text ( "shared.none" ) : entryActions.join ( " → " ) }</td>
                                <td>{ text ( "shared.none" ) }</td>
                            </tr>
                        );
                    } ) }
                </tbody>
            </table>
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: TransitionView
//
// Description:
//
//   Renders the transition view interface.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
//
// Returns:
//
//   The rendered transition view interface.
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

function TransitionView ( candidate: SolverCandidate )
{
    // Initialize the local values needed by this operation.

    const progressiveRendering   = useProgressiveRendering ( candidate.stateMachine.transitionTable.length );
    const evidenceByEventByState = new Map<string, Map<string, string>> ();

    // Process each provenance from the transitions collection in order.

    for ( const provenance of candidate.provenance.transitions )
    {
        // Initialize the local values needed by this operation.

        const evidenceByEvent = evidenceByEventByState.get ( provenance.state ) ?? new Map<string, string> ();

        evidenceByEvent.set ( provenance.event, provenance.evidence );
        evidenceByEventByState.set ( provenance.state, evidenceByEvent );
    }

    // Return the rendered interface.

    return (
        <div
            aria-label={ text ( "solver.candidate.transitionTable" ) }
            className = "solver-review-scroll"
            onKeyDown = { event => revealProgressiveItemsFromKeyboard (
                event,
                progressiveRendering.revealNextBatch,
            ) }
            onScroll={ event =>
            {
                // Handle the case where is near scrollable end result is enabled.

                if ( isNearScrollableEnd ( event.currentTarget ) )
                {
                    progressiveRendering.revealNextBatch ();
                }
            } }
            role     = "region"
            tabIndex = { 0 }
        >
            <table className="data-table solver-review-table">
                <thead><tr><th>{ text ( "solver.candidate.state" ) }</th><th>{ text ( "solver.candidate.event" ) }</th><th>{ text ( "solver.candidate.nextState" ) }</th><th>{ text ( "solver.candidate.provenance" ) }</th></tr></thead>
                <tbody>{ candidate.stateMachine.transitionTable.slice ( 0, progressiveRendering.visibleItemCount )
                    .map ( ( transition, transitionIndex ) =>
                {
                    // Initialize the local values needed by this operation.

                    const evidence = evidenceByEventByState.get ( transition.state )?.get ( transition.event );

                    // Return the rendered interface.

                    return (
                        <tr key={ `${transition.state}-${transition.event}-${transitionIndex}` }>
                            <td>{ transition.state }</td><td>{ transition.event }</td><td>{ transition.stateNext }</td>
                            <td>{ evidence ?? "inferred" }</td>
                        </tr>
                    );
                } ) }</tbody>
            </table>
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: TraceCoverageView
//
// Description:
//
//   Renders the trace coverage view interface.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
//
// Returns:
//
//   The rendered trace coverage view interface.
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

function TraceCoverageView ( candidate: SolverCandidate )
{
    // Initialize the local values needed by this operation.

    const coverageItemCount = candidate.traceCoverage.reduce (
        ( count, trace ) => count + Math.max ( 1, trace.intervals.length ),
        0,
    );
    const progressiveRendering = useProgressiveRendering ( coverageItemCount );
    let remainingItemCount     = progressiveRendering.visibleItemCount;
    const renderedCoverage     = [];

    // Process each trace from the candidate trace coverage collection in order.

    for ( const trace of candidate.traceCoverage )
    {
        // Handle the case where remaining item count is at most 0.

        if ( remainingItemCount <= 0 )
        {
            break;
        }

        const renderedIntervalCount = Math.min ( trace.intervals.length, remainingItemCount );

        renderedCoverage.push ( { renderedIntervalCount, trace } );
        remainingItemCount -= Math.max ( 1, renderedIntervalCount );
    }

    // Return the rendered interface.

    return (
        <div
            aria-label={ text ( "solver.candidate.traceCoverage" ) }
            className = "solver-coverage-list solver-review-scroll"
            onKeyDown = { event => revealProgressiveItemsFromKeyboard (
                event,
                progressiveRendering.revealNextBatch,
            ) }
            onScroll={ event =>
            {
                // Handle the case where is near scrollable end result is enabled.

                if ( isNearScrollableEnd ( event.currentTarget ) )
                {
                    progressiveRendering.revealNextBatch ();
                }
            } }
            role     = "region"
            tabIndex = { 0 }
        >
            { renderedCoverage.map ( ( { renderedIntervalCount, trace } ) => (
                    <section key={ trace.sequenceName }>
                        <h3>{ trace.sequenceName } — { trace.startContext }</h3>
                        <ol>{ trace.intervals.slice ( 0, renderedIntervalCount ).map ( interval => (
                            <li key={ interval.intervalIndex }>
                                { interval.incomingEvent ?? text ( "solver.candidate.start" ) } → { interval.state } [{ interval.entryActions.join ( ", " ) || text ( "shared.none" ) }]
                            </li>
                        ) ) }</ol>
                    </section>
            ) ) }
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: InferenceReportView
//
// Description:
//
//   Renders the inference report view interface.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
//
// Returns:
//
//   The rendered inference report view interface.
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

function InferenceReportView ( candidate: SolverCandidate )
{
    // Initialize the local values needed by this operation.

    const progressiveRendering = useProgressiveRendering ( candidate.inferenceReport.length );

    // Return the rendered interface.

    return (
        <ol
            aria-label={ text ( "solver.candidate.inferenceReport" ) }
            className = "solver-report-list solver-review-scroll"
            onKeyDown = { event => revealProgressiveItemsFromKeyboard (
                event,
                progressiveRendering.revealNextBatch,
            ) }
            onScroll={ event =>
            {
                // Handle the case where is near scrollable end result is enabled.

                if ( isNearScrollableEnd ( event.currentTarget ) )
                {
                    progressiveRendering.revealNextBatch ();
                }
            } }
            tabIndex={ 0 }
        >
            { candidate.inferenceReport.slice ( 0, progressiveRendering.visibleItemCount ).map ( ( entry, index ) => (
                <li key={ `${entry.code}-${index}` }>
                    <strong>{ entry.code } — { entry.summary }</strong><p>{ entry.detail }</p>
                </li>
            ) ) }
        </ol>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: CandidateReview
//
// Description:
//
//   Renders the candidate review interface.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
//
//   - currentDraft:
//     The current draft supplied to the operation.
//
//   - chartNameWrapping:
//     The chart name wrapping supplied to the operation.
//
//   - activeTab:
//     The active tab supplied to the operation.
//
//   - onSelectTab:
//     The on select tab supplied to the operation.
//
// Returns:
//
//   The rendered candidate review interface.
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

function CandidateReview (
    candidate: SolverCandidate,
    currentDraft: AuthoringDraft,
    chartNameWrapping: CandidateChartNameWrapping,
    activeTab: CandidateReviewTab,
    onSelectTab: ( tab: CandidateReviewTab ) => void,
)
{
    // Initialize the local values needed by this operation.

    const tabs =
    [
        { identifier: "solver-candidate-summary", label: text ( "solver.candidate.summary" ) },
        { identifier: "solver-candidate-chart", label: text ( "solver.candidate.stateChart" ) },
        { identifier: "solver-candidate-states", label: text ( "solver.candidate.statesActions" ) },
        { identifier: "solver-candidate-transitions", label: text ( "solver.candidate.transitionTable" ) },
        { identifier: "solver-candidate-coverage", label: text ( "solver.candidate.traceCoverage" ) },
        { identifier: "solver-candidate-report", label: text ( "solver.candidate.inferenceReport" ) },
        { identifier: "solver-candidate-comparison", label: text ( "solver.candidate.comparison" ) },
    ] as const;
    let content;

    // Dispatch according to the active tab value.

    switch ( activeTab )
    {
        // Handle the "solver-candidate-chart" case.

        case "solver-candidate-chart":
            content = (
                <CandidateStateChart
                    candidate    = { candidate }
                    expanded     = { currentDraft.chart.settings.expandStates }
                    nameWrapping = { chartNameWrapping }
                />
            );
            break;

        // Handle the "solver-candidate-states" case.

        case "solver-candidate-states":
            content = <StateActionsView { ...candidate } />;
            break;

        // Handle the "solver-candidate-transitions" case.

        case "solver-candidate-transitions":
            content = <TransitionView { ...candidate } />;
            break;

        // Handle the "solver-candidate-coverage" case.

        case "solver-candidate-coverage":
            content = <TraceCoverageView { ...candidate } />;
            break;

        // Handle the "solver-candidate-report" case.

        case "solver-candidate-report":
            content = <InferenceReportView { ...candidate } />;
            break;

        // Handle the "solver-candidate-comparison" case.

        case "solver-candidate-comparison":
            content = (
                <table className="data-table solver-review-table">
                    <thead><tr><th>{ text ( "solver.candidate.measure" ) }</th><th>{ text ( "solver.candidate.current" ) }</th><th>{ text ( "solver.candidate.candidate" ) }</th></tr></thead>
                    <tbody>
                        <tr><th scope="row">{ text ( "editor.count.states" ) }</th><td>{ currentDraft.stateMachine.states.length }</td><td>{ candidate.stateMachine.states.length }</td></tr>
                        <tr><th scope="row">{ text ( "editor.count.events" ) }</th><td>{ currentDraft.stateMachine.events.length }</td><td>{ candidate.stateMachine.events.length }</td></tr>
                        <tr><th scope="row">{ text ( "editor.count.actions" ) }</th><td>{ currentDraft.stateMachine.actions.length }</td><td>{ candidate.stateMachine.actions.length }</td></tr>
                        <tr><th scope="row">{ text ( "editor.count.transitions" ) }</th><td>{ currentDraft.stateMachine.transitionTable.length }</td><td>{ candidate.stateMachine.transitionTable.length }</td></tr>
                        <tr><th scope="row">{ text ( "solver.candidate.exitActions" ) }</th><td>{ currentDraft.stateMachine.stateActions.exit.length }</td><td>0</td></tr>
                    </tbody>
                </table>
            );
            break;

        // Handle the "solver-candidate-summary" case.

        case "solver-candidate-summary":
            content = (
                <div className="solver-summary-grid">
                    <dl>
                        <div><dt>{ text ( "solver.candidate.baseline" ) }</dt><dd>{ text ( "solver.candidate.baselineValue" ) } { candidate.baselineDocumentRevision } / { candidate.baselineSolverRevision }</dd></div>
                        <div><dt>{ text ( "solver.candidate.observations" ) }</dt><dd>{ candidate.statistics.observationCount }</dd></div>
                        <div><dt>{ text ( "solver.candidate.evidenceStates" ) }</dt><dd>{ candidate.statistics.evidenceStateCount }</dd></div>
                        <div><dt>{ text ( "solver.candidate.candidateStates" ) }</dt><dd>{ candidate.statistics.candidateStateCount }</dd></div>
                        <div><dt>{ text ( "solver.candidate.generatedStates" ) }</dt><dd>{ candidate.statistics.generatedStateCount }</dd></div>
                        <div><dt>{ text ( "solver.candidate.acceptedMerges" ) }</dt><dd>{ candidate.statistics.acceptedMergeCount }</dd></div>
                        <div><dt>{ text ( "solver.candidate.consistency" ) }</dt><dd>{ candidate.consistencyStatement }</dd></div>
                    </dl>
                </div>
            );
            break;
    }

    // Return the rendered interface.

    return (
        <Tabs
            activeTab = { activeTab }
            label     = { text ( "solver.candidate.reviewViews" ) }
            onSelect  = { onSelectTab }
            tabs      = { tabs }
        >
            { content }
        </Tabs>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: SolverPage
//
// Description:
//
//   Renders the solver page interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered solver page interface.
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

export function SolverPage ( properties: SolverPageProperties )
{
    // Initialize the local values needed by this operation.

    const savedSequences = properties.draft?.solver.sequences ?? [];
    const sequences      = properties.draft !== null && savedSequences.length === 0
        ? [ DEFAULT_SOLVER_SEQUENCE ]
        : savedSequences;
    const [ selectedSequenceIndex, setSelectedSequenceIndex ]       = useState ( 0 );
    const [ tokenDraft, setTokenDraft ]                             = useState<{ readonly sequenceName: string; readonly value: string } | null> ( null );
    const [ sequenceDialogMode, setSequenceDialogMode ]             = useState<"add" | "edit" | null> ( null );
    const [ sequenceListWidth, setSequenceListWidth ]               = useState ( DEFAULT_SOLVER_SEQUENCE_LIST_WIDTH );
    const [ sequenceListMinimumWidth, setSequenceListMinimumWidth ] = useState (
        BASE_MINIMUM_SOLVER_SEQUENCE_LIST_WIDTH,
    );
    const sequenceCommandBarReference = useRef<HTMLDivElement> ( null );
    const [ activeCandidateTab, setActiveCandidateTab ] = useState<CandidateReviewTab> ( "solver-candidate-summary" );
    const [ hiddenCandidate, setHiddenCandidate ]       = useState<SolverCandidate | null> ( null );
    const effectiveSequenceIndex       = Math.min ( selectedSequenceIndex, Math.max ( 0, sequences.length - 1 ) );
    const selectedSequence             = sequences [ effectiveSequenceIndex ];
    const progressiveSequenceRendering = useProgressiveRendering ( sequences.length, effectiveSequenceIndex );
    const tokenText                    = selectedSequence === undefined
        ? ""
        : tokenDraft?.sequenceName === selectedSequence.name
            ? tokenDraft.value
            : selectedSequence.sequence.join ( "\n" );
    const selectedTokens = cleanTokenLines ( tokenText );
    const validation     = selectedSequence === undefined ? null : normalizeSolverObservations (
        [ { name: selectedSequence.name, startContext: selectedSequence.startContext, rawTokens: selectedTokens } ],
    );
    const selectedInvalid                = validation?.isSuccessful === false;
    const diagnosticProgressiveRendering = useProgressiveRendering ( validation?.diagnostics.length ?? 0 );

    useLayoutEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const commandBar       = sequenceCommandBarReference.current;
        const sequenceListPane = commandBar?.parentElement;

        // Handle the case where at least one branch condition is satisfied.

        if ( commandBar === null || sequenceListPane === null || sequenceListPane === undefined )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const measuredCommandBar       = commandBar;
        const measuredSequenceListPane = sequenceListPane;

        //------------------------------------------------------------------------------------------
        // Function: measureMinimumWidth
        //
        // Description:
        //
        //   Calculates minimum width.
        //
        // Parameters:
        //
        //   None.
        //
        // Returns:
        //
        //   No value is returned.
        //
        // Preconditions:
        //
        //   - None.
        //
        // Postconditions:
        //
        //   - The described side effects are complete when the callable returns.
        //
        //------------------------------------------------------------------------------------------

        function measureMinimumWidth (): void
        {
            //--------------------------------------------------------------------------------------
            // Function: pixelValue
            //
            // Description:
            //
            //   Derives the pixel value.
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
            //--------------------------------------------------------------------------------------

            function pixelValue ( value: string ): number
            {
                // Initialize the local values needed by this operation.

                const parsedValue = Number.parseFloat ( value );

                // Return the result selected by the current condition.

                return Number.isFinite ( parsedValue ) ? parsedValue : 0;
            }

            // Initialize the local values needed by this operation.

            const commandBarStyle       = window.getComputedStyle ( measuredCommandBar );
            const sequenceListPaneStyle = window.getComputedStyle ( measuredSequenceListPane );
            const buttons               = Array.from ( measuredCommandBar.querySelectorAll ( "button" ) );
            const gap                   = pixelValue ( commandBarStyle.columnGap || commandBarStyle.gap || "0" );
            const buttonWidth           = buttons.reduce (
                ( totalWidth, button ) => totalWidth + button.getBoundingClientRect ().width,
                0,
            );
            const paneChromeWidth = pixelValue ( sequenceListPaneStyle.paddingInlineStart ) +
                pixelValue ( sequenceListPaneStyle.paddingInlineEnd ) +
                pixelValue ( sequenceListPaneStyle.borderInlineStartWidth ) +
                pixelValue ( sequenceListPaneStyle.borderInlineEndWidth );
            const requiredWidth = Math.ceil (
                buttonWidth + Math.max ( 0, buttons.length - 1 ) * gap + paneChromeWidth,
            );

            setSequenceListMinimumWidth ( Math.max ( BASE_MINIMUM_SOLVER_SEQUENCE_LIST_WIDTH, requiredWidth ) );
        }

        measureMinimumWidth ();

        // Handle the case where current value matches the undefined value.

        if ( typeof ResizeObserver === "undefined" )
        {
            window.addEventListener ( "resize", measureMinimumWidth );

            // Return the computed result.

            return () => window.removeEventListener ( "resize", measureMinimumWidth );
        }

        const observer = new ResizeObserver ( measureMinimumWidth );

        observer.observe ( measuredCommandBar );

        // Process each button from the query selector all result collection in order.

        for ( const button of measuredCommandBar.querySelectorAll ( "button" ) )
        {
            observer.observe ( button );
        }

        // Return the computed result.

        return () => observer.disconnect ();
    }, [] );

    // Handle the case where properties draft matches an absent value.

    if ( properties.draft === null )
    {
        // Return the rendered interface.

        return <p className="empty-state">{ text ( "solver.sequence.noDocument" ) }</p>;
    }

    //----------------------------------------------------------------------------------------------
    // Function: replaceSequence
    //
    // Description:
    //
    //   Replaces the sequence.
    //
    // Parameters:
    //
    //   - index:
    //     The index supplied to the operation.
    //
    //   - sequence:
    //     The sequence supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    function replaceSequence ( index: number, sequence: SolverSequence ): void
    {
        properties.onSequencesChange ( sequences.map ( ( current, currentIndex ) => currentIndex === index ? sequence : current ) );
    }

    //----------------------------------------------------------------------------------------------
    // Function: sequencesWithCurrentTokens
    //
    // Description:
    //
    //   Derives the sequences with current tokens.
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
    //----------------------------------------------------------------------------------------------

    function sequencesWithCurrentTokens (): readonly SolverSequence[]
    {
        // Return the mapped collection.

        return sequences.map ( ( sequence, index ) => index === effectiveSequenceIndex
            ? { ...sequence, sequence: cleanTokenLines ( tokenText ) }
            : sequence );
    }

    //----------------------------------------------------------------------------------------------
    // Function: commitSequenceCollection
    //
    // Description:
    //
    //   Commits the sequence collection.
    //
    // Parameters:
    //
    //   - nextSequences:
    //     The next sequences supplied to the operation.
    //
    //   - nextSelectedIndex:
    //     The next selected index supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    function commitSequenceCollection ( nextSequences: readonly SolverSequence[], nextSelectedIndex: number ): void
    {
        setTokenDraft ( null );
        setSelectedSequenceIndex ( nextSelectedIndex );
        properties.onSequencesChange ( nextSequences );
    }

    //----------------------------------------------------------------------------------------------
    // Function: moveSelectedSequence
    //
    // Description:
    //
    //   Moves the selected sequence.
    //
    // Parameters:
    //
    //   - direction:
    //     The direction supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    function moveSelectedSequence ( direction: "down" | "up" ): void
    {
        // Calculate the destination index value from the current inputs.

        const destinationIndex = effectiveSequenceIndex + ( direction === "up" ? -1 : 1 );

        // Handle the case where at least one branch condition is satisfied.

        if ( selectedSequence === undefined || destinationIndex < 0 || destinationIndex >= sequences.length )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const reorderedSequences  = [ ...sequencesWithCurrentTokens () ];
        const sourceSequence      = reorderedSequences [ effectiveSequenceIndex ];
        const destinationSequence = reorderedSequences [ destinationIndex ];

        // Handle the case where at least one branch condition is satisfied.

        if ( sourceSequence === undefined || destinationSequence === undefined )
        {
            // Return control to the caller.

            return;
        }

        reorderedSequences [ effectiveSequenceIndex ] = destinationSequence;
        reorderedSequences [ destinationIndex ]       = sourceSequence;
        commitSequenceCollection ( reorderedSequences, destinationIndex );
    }

    //----------------------------------------------------------------------------------------------
    // Function: deleteSelectedSequence
    //
    // Description:
    //
    //   Deletes the selected sequence.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function deleteSelectedSequence (): void
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( selectedSequence === undefined || savedSequences.length === 0 )
        {
            // Return control to the caller.

            return;
        }

        const remainingSequences = sequencesWithCurrentTokens ()
            .filter ( ( _, index ) => index !== effectiveSequenceIndex );

        commitSequenceCollection (
            remainingSequences,
            Math.min ( effectiveSequenceIndex, Math.max ( 0, remainingSequences.length - 1 ) ),
        );
    }

    //----------------------------------------------------------------------------------------------
    // Function: saveSequenceFromDialog
    //
    // Description:
    //
    //   Saves the sequence from dialog.
    //
    // Parameters:
    //
    //   - sequence:
    //     The sequence supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    function saveSequenceFromDialog ( sequence: SolverSequence ): void
    {
        // Initialize the local values needed by this operation.

        const currentSequences = sequencesWithCurrentTokens ();

        // Handle the case where sequence dialog mode matches the add value.

        if ( sequenceDialogMode === "add" )
        {
            commitSequenceCollection ( [ ...currentSequences, sequence ], currentSequences.length );
        }
        else if ( selectedSequence !== undefined )
        {
            commitSequenceCollection (
                currentSequences.map ( ( currentSequence, index ) => index === effectiveSequenceIndex
                    ? { ...sequence, sequence: currentSequence.sequence }
                    : currentSequence ),
                effectiveSequenceIndex,
            );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: commitTokens
    //
    // Description:
    //
    //   Commits the tokens.
    //
    // Parameters:
    //
    //   - tokens:
    //     The tokens supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    function commitTokens ( tokens: readonly string[] = cleanTokenLines ( tokenText ) ): void
    {
        // Handle the case where all required conditions are satisfied.

        if ( selectedSequence !== undefined && JSON.stringify ( tokens ) !== JSON.stringify ( selectedSequence.sequence ) )
        {
            replaceSequence ( effectiveSequenceIndex, { ...selectedSequence, sequence: tokens } );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: validateSequences
    //
    // Description:
    //
    //   Validates sequences.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function validateSequences (): void
    {
        // Initialize the local values needed by this operation.

        const result = normalizeSolverObservations ( currentObservationInputs () );

        properties.onValidate ( result.diagnostics );
    }

    //----------------------------------------------------------------------------------------------
    // Function: currentObservationInputs
    //
    // Description:
    //
    //   Derives the current observation inputs.
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
    //----------------------------------------------------------------------------------------------

    function currentObservationInputs (): readonly SolverObservationInput[]
    {
        // Return the observation inputs result.

        return observationInputs ( sequences.map ( ( sequence, index ) =>
            index === effectiveSequenceIndex
                ? { ...sequence, sequence: cleanTokenLines ( tokenText ) }
                : sequence ) );
    }

    const candidate = properties.solverWorkspace.candidate;

    // Handle the case where all required conditions are satisfied.

    if ( candidate !== null && candidate !== hiddenCandidate )
    {
        // Return the rendered interface.

        return (
            <section className="solver-candidate-review" aria-labelledby="solver-candidate-title">
                <div className="solver-page-command-bar">
                    <button onClick={ () => setHiddenCandidate ( candidate ) } type="button">{ text ( "button.backToSequences" ) }</button>
                    <button onClick={ () => properties.onSolve ( observationInputs ( sequences ) ) } type="button">{ text ( "button.solveAgain" ) }</button>
                    <button onClick={ properties.onDiscardCandidate } type="button">{ text ( "button.discardCandidate" ) }</button>
                    <button
                        className = "danger-button"
                        disabled  = { properties.solverWorkspace.status === "stale" }
                        onClick   = { () => properties.onApplyCandidate ( candidate ) }
                        type      = "button"
                    >
                        { text ( "button.applyCandidate" ) }
                    </button>
                </div>
                <h2 id="solver-candidate-title">{ text ( "solver.candidate.title" ) }</h2>
                { properties.solverWorkspace.status === "stale" && (
                    <p className="solver-stale-warning" role="status">⚠ { text ( "solver.candidate.warningStale" ) }</p>
                ) }
                { CandidateReview (
                    candidate,
                    properties.draft,
                    properties.chartNameWrapping,
                    activeCandidateTab,
                    setActiveCandidateTab,
                ) }
            </section>
        );
    }

    // Return the rendered interface.

    return (
        <section className="solver-sequence-workspace">
            <div
                className = "solver-panes"
                style     = {
                    {
                        "--solver-sequence-list-minimum-width": `${sequenceListMinimumWidth}px`,
                        "--solver-sequence-list-width":         `${sequenceListWidth}px`,
                    } as CSSProperties
                }
            >
                <section className="solver-sequence-list" aria-labelledby="solver-sequence-list-title">
                    <h2 id="solver-sequence-list-title">{ text ( "solver.sequence.list" ) }</h2>
                    { sequences.length === 0
                        ? <p>{ text ( "solver.sequence.empty" ) }</p>
                        : (
                            <select
                                aria-label={ text ( "solver.sequence.list" ) }
                                onKeyDown={ event =>
                                {
                                    // Handle the case where event key matches the End value.

                                    if ( event.key === "End" )
                                    {
                                        progressiveSequenceRendering.revealThrough ( sequences.length - 1 );
                                    }
                                    else if ( event.key === "ArrowDown" &&
                                        effectiveSequenceIndex >= progressiveSequenceRendering.visibleItemCount - 1 )
                                    {
                                        progressiveSequenceRendering.revealNextBatch ();
                                    }
                                } }
                                onChange={ event =>
                                {
                                    setSelectedSequenceIndex ( Number ( event.currentTarget.value ) );
                                    setTokenDraft ( null );
                                } }
                                onScroll={ event =>
                                {
                                    // Handle the case where is near scrollable end result is
                                    // enabled.

                                    if ( isNearScrollableEnd ( event.currentTarget ) )
                                    {
                                        progressiveSequenceRendering.revealNextBatch ();
                                    }
                                } }
                                size  = { Math.min ( 10, Math.max ( 2, sequences.length ) ) }
                                value = { effectiveSequenceIndex }
                            >
                                { sequences.slice ( 0, progressiveSequenceRendering.visibleItemCount )
                                    .map ( ( sequence, index ) => (
                                    <option key={ sequence.name } value={ index }>
                                        { sequence.name } — { sequence.startContext }
                                    </option>
                                    ) ) }
                            </select>
                        ) }
                    <div className="list-command-bar solver-sequence-actions" ref={ sequenceCommandBarReference }>
                        <button
                            disabled = { effectiveSequenceIndex <= 0 || selectedSequence === undefined }
                            onClick  = { () => moveSelectedSequence ( "up" ) }
                            type     = "button"
                        >
                            <span aria-hidden="true">{ "\u2191" }</span> { text ( "button.moveUp" ) }
                        </button>
                        <button
                            disabled = { selectedSequence === undefined || effectiveSequenceIndex >= sequences.length - 1 }
                            onClick  = { () => moveSelectedSequence ( "down" ) }
                            type     = "button"
                        >
                            <span aria-hidden="true">{ "\u2193" }</span> { text ( "button.moveDown" ) }
                        </button>
                        <button onClick={ () => setSequenceDialogMode ( "add" ) } type="button">
                            { text ( "button.add" ) }
                        </button>
                        <button
                            disabled = { selectedSequence === undefined || savedSequences.length === 0 }
                            onClick  = { deleteSelectedSequence }
                            type     = "button"
                        >
                            { text ( "button.delete" ) }
                        </button>
                        <button
                            disabled = { selectedSequence === undefined }
                            onClick  = { () => setSequenceDialogMode ( "edit" ) }
                            type     = "button"
                        >
                            { text ( "button.edit" ) }
                        </button>
                    </div>
                </section>
                <Splitter
                    label           = { text ( "solver.sequence.resize" ) }
                    minimum         = { sequenceListMinimumWidth }
                    onChange        = { setSequenceListWidth }
                    opposingMinimum = { MINIMUM_SOLVER_TOKEN_EDITOR_WIDTH }
                    orientation     = "vertical"
                    value           = { sequenceListWidth }
                />
                <section className="solver-token-editor" aria-labelledby="solver-token-editor-title">
                    <h2 id="solver-token-editor-title">{ text ( "solver.sequence.editor" ) }</h2>
                    <textarea
                        aria-label={ text ( "solver.sequence.editor" ) }
                        aria-describedby={ selectedInvalid ? "solver-token-errors" : undefined }
                        aria-invalid={ selectedInvalid }
                        disabled = { selectedSequence === undefined }
                        id       = "solver-token-text"
                        onBlur   = { () => commitTokens () }
                        onChange = { ( event: ChangeEvent<HTMLTextAreaElement> ) =>
                        {
                            setTokenDraft ( { sequenceName: selectedSequence?.name ?? "", value: event.currentTarget.value } );
                        } }
                        spellCheck = { false }
                        value      = { tokenText }
                    />
                    { selectedInvalid && validation !== null && (
                        <ul
                            aria-label={ text ( "solver.sequence.validationDiagnostics" ) }
                            className = "solver-token-errors"
                            id        = "solver-token-errors"
                            onKeyDown = { event => revealProgressiveItemsFromKeyboard (
                                event,
                                diagnosticProgressiveRendering.revealNextBatch,
                            ) }
                            onScroll={ event =>
                            {
                                // Handle the case where is near scrollable end result is enabled.

                                if ( isNearScrollableEnd ( event.currentTarget ) )
                                {
                                    diagnosticProgressiveRendering.revealNextBatch ();
                                }
                            } }
                            tabIndex={ 0 }
                        >
                            { validation.diagnostics.slice ( 0, diagnosticProgressiveRendering.visibleItemCount )
                                .map ( ( diagnostic, index ) =>
                                    <li key={ `${diagnostic.code}-${index}` }>⚠ { diagnostic.message }</li> ) }
                        </ul>
                    ) }
                </section>
            </div>
            <div className="solver-page-command-bar">
                { properties.solverWorkspace.progress !== null && (
                    <div className="solver-progress-status" role="status">
                        <span>{ properties.solverWorkspace.progress.message }</span>
                        <progress
                            aria-label={ properties.solverWorkspace.progress.message }
                            max   = { properties.solverWorkspace.progress.totalWork }
                            value = { properties.solverWorkspace.progress.completedWork }
                        />
                    </div>
                ) }
                <button onClick={ validateSequences } type="button">{ text ( "button.validateSequences" ) }</button>
                { properties.solverWorkspace.status === "running"
                    ? <button onClick={ properties.onCancelSolve } type="button">{ text ( "button.cancelSolve" ) }</button>
                    : <button onClick={ () => properties.onSolve ( currentObservationInputs () ) } type="button">{ text ( "button.solve" ) }</button> }
            </div>
            { sequenceDialogMode !== null && (
                <SolverSequenceDialog
                    existingNames={ sequences
                        .filter ( ( _, index ) => sequenceDialogMode === "add" || index !== effectiveSequenceIndex )
                        .map ( sequence => sequence.name ) }
                    initialValue={ sequenceDialogMode === "edit" && selectedSequence !== undefined
                        ? { ...selectedSequence, sequence: cleanTokenLines ( tokenText ) }
                        : DEFAULT_SOLVER_SEQUENCE }
                    onClose   = { () => setSequenceDialogMode ( null ) }
                    onConfirm = { saveSequenceFromDialog }
                    open
                />
            ) }
        </section>
    );
}

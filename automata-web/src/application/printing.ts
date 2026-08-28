// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Printable Report Composition
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Captures one immutable authoring revision as a purpose-built, presentation-neutral printable
//   report model.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ApplicationPreferences } from "./ports/contracts.js";
import { DEFAULT_APPLICATION_PREFERENCES } from "../configuration/compile-time-configuration.js";
import type { AuthoringDraft, NamedEntity } from "../domain/model/contracts.js";
import { FILE_VERSION } from "../domain/model/limits.js";


//--------------------------------------------------------------------------------------------------
// Type: PrintPageSetup
//
// Description:
//
//   Defines the print page setup type.
//
//--------------------------------------------------------------------------------------------------

export type PrintPageSetup = Pick <ApplicationPreferences,
    | "printIncludeActions"
    | "printIncludeChart"
    | "printIncludeEvents"
    | "printIncludeModelSummary"
    | "printIncludeSimulator"
    | "printIncludeSolver"
    | "printIncludeStateChart"
    | "printIncludeStates"
    | "printIncludeTransitionTable"
    | "printMarginBottomMillimetres"
    | "printMarginLeftMillimetres"
    | "printMarginRightMillimetres"
    | "printMarginTopMillimetres"
    | "printOrientation"
    | "printPaperSize"
    | "printStyle"
>;


//--------------------------------------------------------------------------------------------------
// Interface: PrintableNamedEntity
//
// Description:
//
//   Defines the structure of printable named entity.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableNamedEntity
{
    readonly description: string;
    readonly name:        string;
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableState
//
// Description:
//
//   Defines the structure of printable state.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableState extends PrintableNamedEntity
{
    readonly entryActions: readonly string[];
    readonly exitActions:  readonly string[];
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableTransition
//
// Description:
//
//   Defines the structure of printable transition.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableTransition
{
    readonly destinationState: string;
    readonly event:            string;
    readonly sourceState:      string;
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableChartState
//
// Description:
//
//   Defines the structure of printable chart state.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableChartState
{
    readonly height: number | null;
    readonly width?: number;
    readonly state:  string;
    readonly x:      number;
    readonly y:      number;
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableInitialIndicator
//
// Description:
//
//   Defines the structure of printable initial indicator.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableInitialIndicator
{
    readonly state: string | null;
    readonly x:     number;
    readonly y:     number;
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableTerminalIndicator
//
// Description:
//
//   Defines the structure of printable terminal indicator.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableTerminalIndicator
{
    readonly id: number;
    readonly x:  number;
    readonly y:  number;
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableTerminalRelation
//
// Description:
//
//   Defines the structure of printable terminal relation.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableTerminalRelation
{
    readonly state:               string;
    readonly terminalIndicatorId: number;
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableDraftTransition
//
// Description:
//
//   Defines the structure of printable draft transition.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableDraftTransition
{
    readonly id:      number;
    readonly sourceX: number;
    readonly sourceY: number;
    readonly targetX: number;
    readonly targetY: number;
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableSolverSequence
//
// Description:
//
//   Defines the structure of printable solver sequence.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableSolverSequence
{
    readonly description:  string;
    readonly name:         string;
    readonly sequence:     readonly string[];
    readonly startContext: "continuation" | "infer" | "initial";
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableSimulatorSequence
//
// Description:
//
//   Defines the structure of printable simulator sequence.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableSimulatorSequence
{
    readonly description: string;
    readonly name:        string;
    readonly sequence:    readonly string[];
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableModelSummarySection
//
// Description:
//
//   Defines the structure of printable model summary section.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableModelSummarySection
{
    readonly actionCount:         number;
    readonly description:         string;
    readonly entryMappingCount:   number;
    readonly eventCount:          number;
    readonly exitMappingCount:    number;
    readonly initialState:        string | null;
    readonly kind:                "modelSummary";
    readonly modelVersion:        string;
    readonly simulatorSequenceCount: number;
    readonly solverSequenceCount: number;
    readonly stateCount:          number;
    readonly transitionCount:     number;
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableStatesSection
//
// Description:
//
//   Defines the structure of printable states section.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableStatesSection
{
    readonly kind: "states";
    readonly rows: readonly PrintableState[];
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableEventsSection
//
// Description:
//
//   Defines the structure of printable events section.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableEventsSection
{
    readonly kind: "events";
    readonly rows: readonly PrintableNamedEntity[];
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableActionsSection
//
// Description:
//
//   Defines the structure of printable actions section.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableActionsSection
{
    readonly kind: "actions";
    readonly rows: readonly PrintableNamedEntity[];
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableTransitionTableSection
//
// Description:
//
//   Defines the structure of printable transition table section.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableTransitionTableSection
{
    readonly kind: "transitionTable";
    readonly rows: readonly PrintableTransition[];
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableStateChartSection
//
// Description:
//
//   Defines the structure of printable state chart section.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableStateChartSection
{
    readonly imageSource: string | null;
    readonly kind:        "stateChart";
}

//--------------------------------------------------------------------------------------------------
// Interface: PrintableChartSection
//
// Description:
//
//   Defines the structure of printable chart section.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableChartSection
{
    readonly draftTransitions:   readonly PrintableDraftTransition[];
    readonly initialIndicator:   PrintableInitialIndicator | null;
    readonly kind:               "chart";
    readonly statePlacements:    readonly PrintableChartState[];
    readonly terminalIndicators: readonly PrintableTerminalIndicator[];
    readonly terminalRelations:  readonly PrintableTerminalRelation[];
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableSolverSection
//
// Description:
//
//   Defines the structure of printable solver section.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableSolverSection
{
    readonly kind: "solver";
    readonly rows: readonly PrintableSolverSequence[];
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintableSimulatorSection
//
// Description:
//
//   Defines the structure of printable simulator section.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableSimulatorSection
{
    readonly kind: "simulator";
    readonly rows: readonly PrintableSimulatorSequence[];
}


//--------------------------------------------------------------------------------------------------
// Type: PrintableReportSection
//
// Description:
//
//   Defines the supported printable report section alternatives.
//
//--------------------------------------------------------------------------------------------------

export type PrintableReportSection =
    | PrintableActionsSection
    | PrintableChartSection
    | PrintableEventsSection
    | PrintableModelSummarySection
    | PrintableSimulatorSection
    | PrintableSolverSection
    | PrintableStateChartSection
    | PrintableStatesSection
    | PrintableTransitionTableSection;


//--------------------------------------------------------------------------------------------------
// Interface: PrintableReport
//
// Description:
//
//   Defines the structure of printable report.
//
//--------------------------------------------------------------------------------------------------

export interface PrintableReport
{
    readonly capturedDocumentRevision: number;
    readonly fileName:                 string;
    readonly fileVersion:              string;
    readonly modelName:                string;
    readonly pageSetup:                PrintPageSetup;
    readonly sections:                 readonly PrintableReportSection[];
}


//--------------------------------------------------------------------------------------------------
// Function: extractPrintPageSetup
//
// Description:
//
//   Derives the extract print page setup.
//
// Parameters:
//
//   - preferences:
//     The preferences supplied to the operation.
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

export function extractPrintPageSetup ( preferences: ApplicationPreferences ): PrintPageSetup
{
    // Return the assembled result.

    return {
        printIncludeActions:          preferences.printIncludeActions,
        printIncludeChart:            preferences.printIncludeChart,
        printIncludeEvents:           preferences.printIncludeEvents,
        printIncludeModelSummary:     preferences.printIncludeModelSummary,
        printIncludeSimulator:        preferences.printIncludeSimulator,
        printIncludeSolver:           preferences.printIncludeSolver,
        printIncludeStateChart:       typeof preferences.printIncludeStateChart === "boolean"
            ? preferences.printIncludeStateChart
            : DEFAULT_APPLICATION_PREFERENCES.printIncludeStateChart,
        printIncludeStates:           preferences.printIncludeStates,
        printIncludeTransitionTable:  preferences.printIncludeTransitionTable,
        printMarginBottomMillimetres: preferences.printMarginBottomMillimetres,
        printMarginLeftMillimetres:   preferences.printMarginLeftMillimetres,
        printMarginRightMillimetres:  preferences.printMarginRightMillimetres,
        printMarginTopMillimetres:    preferences.printMarginTopMillimetres,
        printOrientation:             preferences.printOrientation,
        printPaperSize:               preferences.printPaperSize,
        printStyle:                   preferences.printStyle === "Academic" || preferences.printStyle === "Industry"
            ? preferences.printStyle
            : DEFAULT_APPLICATION_PREFERENCES.printStyle,
    };
}


//--------------------------------------------------------------------------------------------------
// Function: cloneNamedEntities
//
// Description:
//
//   Derives the clone named entities.
//
// Parameters:
//
//   - entities:
//     The entities supplied to the operation.
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

function cloneNamedEntities ( entities: readonly NamedEntity[] ): readonly PrintableNamedEntity[]
{
    // Return the mapped collection.

    return entities.map ( entity => ( { description: entity.description, name: entity.name } ) );
}


//--------------------------------------------------------------------------------------------------
// Function: createActionSchedule
//
// Description:
//
//   Creates action schedule.
//
// Parameters:
//
//   - mappings:
//     The mappings supplied to the operation.
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

function createActionSchedule (
    mappings: readonly { readonly action: string; readonly state: string }[],
): ReadonlyMap <string, readonly string[]>
{
    // Initialize the local values needed by this operation.

    const schedule = new Map <string, string[]> ();


    // Process each mapping from the mappings collection in order.

    for ( const mapping of mappings )
    {
        // Initialize the local values needed by this operation.

        const actions = schedule.get ( mapping.state );


        // Handle the case where actions matches undefined.

        if ( actions === undefined )
        {
            schedule.set ( mapping.state, [ mapping.action ] );
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            actions.push ( mapping.action );
        }
    }


    // Return the schedule.

    return schedule;
}


//--------------------------------------------------------------------------------------------------
// Function: createModelSummarySection
//
// Description:
//
//   Creates model summary section.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
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

function createModelSummarySection ( draft: AuthoringDraft ): PrintableModelSummarySection
{
    // Return the assembled result.

    return {
        actionCount:            draft.stateMachine.actions.length,
        description:            draft.settings.description,
        entryMappingCount:      draft.stateMachine.stateActions.entry.length,
        eventCount:             draft.stateMachine.events.length,
        exitMappingCount:       draft.stateMachine.stateActions.exit.length,
        initialState:           draft.stateMachine.initialState,
        kind:                   "modelSummary",
        modelVersion:           draft.settings.version,
        simulatorSequenceCount: draft.simulator.sequences.length,
        solverSequenceCount:    draft.solver.sequences.length,
        stateCount:             draft.stateMachine.states.length,
        transitionCount:        draft.stateMachine.transitionTable.length,
    };
}


//--------------------------------------------------------------------------------------------------
// Function: createStatesSection
//
// Description:
//
//   Creates states section.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
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

function createStatesSection ( draft: AuthoringDraft ): PrintableStatesSection
{
    // Initialize the local values needed by this operation.

    const entrySchedule = createActionSchedule ( draft.stateMachine.stateActions.entry );
    const exitSchedule  = createActionSchedule ( draft.stateMachine.stateActions.exit );


    // Return the assembled result.

    return {
        kind: "states",
        rows: draft.stateMachine.states.map ( state => ( {
            description: state.description,
            entryActions: [ ...( entrySchedule.get ( state.name ) ?? [] ) ],
            exitActions:  [ ...( exitSchedule.get ( state.name ) ?? [] ) ],
            name: state.name,
        } ) ),
    };
}


//--------------------------------------------------------------------------------------------------
// Function: createChartSection
//
// Description:
//
//   Creates chart section.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
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

function createChartSection ( draft: AuthoringDraft ): PrintableChartSection
{
    // Initialize the local values needed by this operation.

    const initialIndicator = draft.chart.indicators.initialStateIndicator;


    // Return the assembled result.

    return {
        draftTransitions: draft.chart.draftTransitions.map ( transition => ( {
            id:      transition.id,
            sourceX: transition.source.x,
            sourceY: transition.source.y,
            targetX: transition.target.x,
            targetY: transition.target.y,
        } ) ),
        initialIndicator: initialIndicator === null
            ? null
            : {
                state: initialIndicator.state ?? null,
                x:     initialIndicator.x,
                y:     initialIndicator.y,
            },
        kind: "chart",
        statePlacements: draft.chart.states.map ( state => ( {
            height: state.height ?? null,
            state:  state.state,
            x:      state.x,
            y:      state.y,
        } ) ),
        terminalIndicators: draft.chart.indicators.terminalStateIndicators.map ( indicator => ( {
            id: indicator.id,
            x:  indicator.x,
            y:  indicator.y,
        } ) ),
        terminalRelations: draft.chart.indicators.terminalStateTransitions.map ( relation => ( {
            state:               relation.state,
            terminalIndicatorId: relation.terminalStateIndicatorId,
        } ) ),
    };
}


//--------------------------------------------------------------------------------------------------
// Function: createPrintableReport
//
// Description:
//
//   Creates printable report.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - documentRevision:
//     The document revision supplied to the operation.
//
//   - preferences:
//     The preferences supplied to the operation.
//
//   - fileName:
//     The file name supplied to the operation.
//
//   - stateChartImageSource:
//     The state chart image source supplied to the operation.
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

export function createPrintableReport (
    draft: AuthoringDraft,
    documentRevision: number,
    preferences: ApplicationPreferences,
    fileName = `${draft.settings.name}.json`,
    stateChartImageSource: string | null = null,
): PrintableReport
{
    // Initialize the local values needed by this operation.

    const pageSetup                          = extractPrintPageSetup ( preferences );
    const sections: PrintableReportSection[] = [];


    // Handle the case where page setup print include model summary is enabled.

    if ( pageSetup.printIncludeModelSummary )
    {
        sections.push ( createModelSummarySection ( draft ) );
    }


    // Handle the case where page setup print include states is enabled.

    if ( pageSetup.printIncludeStates )
    {
        sections.push ( createStatesSection ( draft ) );
    }


    // Handle the case where page setup print include events is enabled.

    if ( pageSetup.printIncludeEvents )
    {
        sections.push ( { kind: "events", rows: cloneNamedEntities ( draft.stateMachine.events ) } );
    }


    // Handle the case where page setup print include actions is enabled.

    if ( pageSetup.printIncludeActions )
    {
        sections.push ( { kind: "actions", rows: cloneNamedEntities ( draft.stateMachine.actions ) } );
    }


    // Handle the case where page setup print include transition table is enabled.

    if ( pageSetup.printIncludeTransitionTable )
    {
        sections.push ( {
            kind: "transitionTable",
            rows: draft.stateMachine.transitionTable.map ( transition => ( {
                destinationState: transition.stateNext,
                event:            transition.event,
                sourceState:      transition.state,
            } ) ),
        } );
    }


    // Handle the case where page setup print include state chart is enabled.

    if ( pageSetup.printIncludeStateChart )
    {
        sections.push ( { imageSource: stateChartImageSource, kind: "stateChart" } );
    }


    // Handle the case where page setup print include chart is enabled.

    if ( pageSetup.printIncludeChart )
    {
        sections.push ( createChartSection ( draft ) );
    }


    // Handle the case where page setup print include solver is enabled.

    if ( pageSetup.printIncludeSolver )
    {
        sections.push ( {
            kind: "solver",
            rows: draft.solver.sequences.map ( sequence => ( {
                description:  sequence.description,
                name:         sequence.name,
                sequence:     [ ...sequence.sequence ],
                startContext: sequence.startContext,
            } ) ),
        } );
    }


    // Handle the case where page setup print include simulator is enabled.

    if ( pageSetup.printIncludeSimulator )
    {
        sections.push ( {
            kind: "simulator",
            rows: draft.simulator.sequences.map ( sequence => ( {
                description: sequence.description,
                name:        sequence.name,
                sequence:    [ ...sequence.sequence ],
            } ) ),
        } );
    }


    // Return the assembled result.

    return {
        capturedDocumentRevision: documentRevision,
        fileName,
        fileVersion:              FILE_VERSION,
        modelName:                draft.settings.name,
        pageSetup,
        sections,
    };
}

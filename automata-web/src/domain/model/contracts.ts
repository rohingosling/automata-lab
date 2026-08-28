// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Domain Model Contracts
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Defines the file-independent authoring, valid-document, hosted-snapshot, and Solver-candidate
//   representations.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Interface: NamedEntity
//
// Description:
//
//   Defines the structure of named entity.
//
//--------------------------------------------------------------------------------------------------

export interface NamedEntity
{
    readonly name:        string;
    readonly description: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: DocumentSettings
//
// Description:
//
//   Defines the structure of document settings.
//
//--------------------------------------------------------------------------------------------------

export interface DocumentSettings
{
    readonly name:        string;
    readonly description: string;
    readonly version:     string;
}

//--------------------------------------------------------------------------------------------------
// Interface: StateActionMapping
//
// Description:
//
//   Defines the structure of state action mapping.
//
//--------------------------------------------------------------------------------------------------

export interface StateActionMapping
{
    readonly state:  string;
    readonly action: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: TransitionDefinition
//
// Description:
//
//   Defines the structure of transition definition.
//
//--------------------------------------------------------------------------------------------------

export interface TransitionDefinition
{
    readonly state:     string;
    readonly event:     string;
    readonly stateNext: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: StateActionDefinitions
//
// Description:
//
//   Defines the structure of state action definitions.
//
//--------------------------------------------------------------------------------------------------

export interface StateActionDefinitions
{
    readonly entry: readonly StateActionMapping[];
    readonly exit:  readonly StateActionMapping[];
}

//--------------------------------------------------------------------------------------------------
// Interface: StateMachineDefinition
//
// Description:
//
//   Defines the structure of state machine definition.
//
//--------------------------------------------------------------------------------------------------

export interface StateMachineDefinition<InitialState extends string | null>
{
    readonly initialState:    InitialState;
    readonly events:          readonly NamedEntity[];
    readonly states:          readonly NamedEntity[];
    readonly actions:         readonly NamedEntity[];
    readonly stateActions:    StateActionDefinitions;
    readonly transitionTable: readonly TransitionDefinition[];
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartSettings
//
// Description:
//
//   Defines the structure of chart settings.
//
//--------------------------------------------------------------------------------------------------

export interface ChartSettings
{
    readonly expandStates: boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartPoint
//
// Description:
//
//   Defines the structure of chart point.
//
//--------------------------------------------------------------------------------------------------

export interface ChartPoint
{
    readonly x: number;
    readonly y: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartDraftTransition
//
// Description:
//
//   Defines the structure of chart draft transition.
//
//--------------------------------------------------------------------------------------------------

export interface ChartDraftTransition
{
    readonly id:     number;
    readonly source: ChartPoint;
    readonly target: ChartPoint;
}

//--------------------------------------------------------------------------------------------------
// Interface: TerminalStateIndicator
//
// Description:
//
//   Defines the structure of terminal state indicator.
//
//--------------------------------------------------------------------------------------------------

export interface TerminalStateIndicator extends ChartPoint
{
    readonly id: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: TerminalStateIndicatorTransition
//
// Description:
//
//   Defines the structure of terminal state indicator transition.
//
//--------------------------------------------------------------------------------------------------

export interface TerminalStateIndicatorTransition
{
    readonly state:                    string;
    readonly terminalStateIndicatorId: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartStatePlacement
//
// Description:
//
//   Defines the structure of chart state placement.
//
//--------------------------------------------------------------------------------------------------

export interface ChartStatePlacement extends ChartPoint
{
    readonly state:  string;
    readonly height?: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartInitialStateIndicator
//
// Description:
//
//   Defines the structure of chart initial state indicator.
//
//--------------------------------------------------------------------------------------------------

export interface ChartInitialStateIndicator extends ChartPoint
{
    readonly state?: string | null;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartIndicators
//
// Description:
//
//   Defines the structure of chart indicators.
//
//--------------------------------------------------------------------------------------------------

export interface ChartIndicators
{
    readonly initialStateIndicator:    ChartInitialStateIndicator | null;
    readonly terminalStateIndicators:  readonly TerminalStateIndicator[];
    readonly terminalStateTransitions: readonly TerminalStateIndicatorTransition[];
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartProjection
//
// Description:
//
//   Defines the structure of chart projection.
//
//--------------------------------------------------------------------------------------------------

export interface ChartProjection
{
    readonly settings:         ChartSettings;
    readonly indicators:       ChartIndicators;
    readonly states:           readonly ChartStatePlacement[];
    readonly draftTransitions: readonly ChartDraftTransition[];
}

//--------------------------------------------------------------------------------------------------
// Type: SolverStartContext
//
// Description:
//
//   Defines the supported solver start context alternatives.
//
//--------------------------------------------------------------------------------------------------

export type SolverStartContext = "continuation" | "infer" | "initial";

//--------------------------------------------------------------------------------------------------
// Interface: SolverSequence
//
// Description:
//
//   Defines the structure of solver sequence.
//
//--------------------------------------------------------------------------------------------------

export interface SolverSequence
{
    readonly name:         string;
    readonly description:  string;
    readonly startContext: SolverStartContext;
    readonly sequence:     readonly string[];
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverLibrary
//
// Description:
//
//   Defines the structure of solver library.
//
//--------------------------------------------------------------------------------------------------

export interface SolverLibrary
{
    readonly sequences: readonly SolverSequence[];
}

//--------------------------------------------------------------------------------------------------
// Interface: SimulatorSequence
//
// Description:
//
//   Defines the structure of simulator sequence.
//
//--------------------------------------------------------------------------------------------------

export interface SimulatorSequence
{
    readonly name:        string;
    readonly description: string;
    readonly sequence:    readonly string[];
}

//--------------------------------------------------------------------------------------------------
// Interface: SimulatorLibrary
//
// Description:
//
//   Defines the structure of simulator library.
//
//--------------------------------------------------------------------------------------------------

export interface SimulatorLibrary
{
    readonly sequences: readonly SimulatorSequence[];
}

//--------------------------------------------------------------------------------------------------
// Interface: AutomataDocumentBase
//
// Description:
//
//   Defines the structure of automata document base.
//
//--------------------------------------------------------------------------------------------------

export interface AutomataDocumentBase<InitialState extends string | null>
{
    readonly settings:     DocumentSettings;
    readonly stateMachine: StateMachineDefinition<InitialState>;
    readonly chart:        ChartProjection;
    readonly solver:       SolverLibrary;
    readonly simulator:    SimulatorLibrary;
}

//--------------------------------------------------------------------------------------------------
// Type: AuthoringDraft
//
// Description:
//
//   Defines the authoring draft type.
//
//--------------------------------------------------------------------------------------------------

export type AuthoringDraft   = AutomataDocumentBase<string | null>;

//--------------------------------------------------------------------------------------------------
// Type: AutomataDocument
//
// Description:
//
//   Defines the automata document type.
//
//--------------------------------------------------------------------------------------------------

export type AutomataDocument = AutomataDocumentBase<string>;

//--------------------------------------------------------------------------------------------------
// Type: ValidDocument
//
// Description:
//
//   Defines the valid document type.
//
//--------------------------------------------------------------------------------------------------

export type ValidDocument    = AutomataDocument;

//--------------------------------------------------------------------------------------------------
// Interface: CanonicalSerializedDocument
//
// Description:
//
//   Defines the structure of canonical serialized document.
//
//--------------------------------------------------------------------------------------------------

export interface CanonicalSerializedDocument
{
    readonly text: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: HostedSnapshot
//
// Description:
//
//   Defines the structure of hosted snapshot.
//
//--------------------------------------------------------------------------------------------------

export interface HostedSnapshot
{
    readonly document:      AutomataDocument;
    readonly modelRevision: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverCandidateProvenance
//
// Description:
//
//   Defines the structure of solver candidate provenance.
//
//--------------------------------------------------------------------------------------------------

export interface SolverCandidateProvenance
{
    readonly observedStateNames: readonly string[];
    readonly generatedStateNames: readonly string[];
    readonly reportEntries:       readonly string[];
    readonly states:              readonly SolverCandidateStateProvenance[];
    readonly transitions:         readonly SolverCandidateTransitionProvenance[];
}

//--------------------------------------------------------------------------------------------------
// Type: SolverCandidateEvidenceKind
//
// Description:
//
//   Defines the supported solver candidate evidence kind alternatives.
//
//--------------------------------------------------------------------------------------------------

export type SolverCandidateEvidenceKind = "inferred" | "observed";

//--------------------------------------------------------------------------------------------------
// Interface: SolverCandidateSourceRange
//
// Description:
//
//   Defines the structure of solver candidate source range.
//
//--------------------------------------------------------------------------------------------------

export interface SolverCandidateSourceRange
{
    readonly sequenceName:      string;
    readonly tokenStart:        number;
    readonly tokenEndExclusive: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverCandidateStateProvenance
//
// Description:
//
//   Defines the structure of solver candidate state provenance.
//
//--------------------------------------------------------------------------------------------------

export interface SolverCandidateStateProvenance
{
    readonly state:     string;
    readonly evidence:  SolverCandidateEvidenceKind;
    readonly sources:   readonly SolverCandidateSourceRange[];
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverCandidateTransitionProvenance
//
// Description:
//
//   Defines the structure of solver candidate transition provenance.
//
//--------------------------------------------------------------------------------------------------

export interface SolverCandidateTransitionProvenance
{
    readonly state:     string;
    readonly event:     string;
    readonly stateNext: string;
    readonly evidence:  SolverCandidateEvidenceKind;
    readonly sources:   readonly SolverCandidateSourceRange[];
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverCandidateCoverageInterval
//
// Description:
//
//   Defines the structure of solver candidate coverage interval.
//
//--------------------------------------------------------------------------------------------------

export interface SolverCandidateCoverageInterval
{
    readonly intervalIndex: number;
    readonly state:         string;
    readonly incomingEvent: string | null;
    readonly entryActions:  readonly string[];
    readonly tokenStart:    number;
    readonly tokenEndExclusive: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverCandidateTraceCoverage
//
// Description:
//
//   Defines the structure of solver candidate trace coverage.
//
//--------------------------------------------------------------------------------------------------

export interface SolverCandidateTraceCoverage
{
    readonly sequenceName: string;
    readonly startContext: SolverStartContext;
    readonly intervals:    readonly SolverCandidateCoverageInterval[];
    readonly isSuccessful: true;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverInferenceReportEntry
//
// Description:
//
//   Defines the structure of solver inference report entry.
//
//--------------------------------------------------------------------------------------------------

export interface SolverInferenceReportEntry
{
    readonly code:     string;
    readonly category: "assumption" | "conflict" | "merge" | "provenance" | "summary";
    readonly summary:  string;
    readonly detail:   string;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverCandidateStatistics
//
// Description:
//
//   Defines the structure of solver candidate statistics.
//
//--------------------------------------------------------------------------------------------------

export interface SolverCandidateStatistics
{
    readonly observationCount:   number;
    readonly inputTokenCount:    number;
    readonly evidenceStateCount: number;
    readonly candidateStateCount: number;
    readonly transitionCount:    number;
    readonly generatedStateCount: number;
    readonly consideredMergeCount: number;
    readonly acceptedMergeCount: number;
    readonly rejectedMergeCount: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverCandidate
//
// Description:
//
//   Defines the structure of solver candidate.
//
//--------------------------------------------------------------------------------------------------

export interface SolverCandidate
{
    readonly stateMachine:             StateMachineDefinition<string>;
    readonly chart:                    ChartProjection;
    readonly baselineDocumentRevision: number;
    readonly baselineSolverRevision:   number;
    readonly provenance:               SolverCandidateProvenance;
    readonly traceCoverage:            readonly SolverCandidateTraceCoverage[];
    readonly inferenceReport:          readonly SolverInferenceReportEntry[];
    readonly statistics:               SolverCandidateStatistics;
    readonly consistencyStatement:     string;
}

//--------------------------------------------------------------------------------------------------
// Type: JsonPrimitive
//
// Description:
//
//   Defines the supported JSON primitive alternatives.
//
//--------------------------------------------------------------------------------------------------

export type JsonPrimitive = boolean | null | number | string;

//--------------------------------------------------------------------------------------------------
// Type: JsonValue
//
// Description:
//
//   Defines the supported JSON value alternatives.
//
//--------------------------------------------------------------------------------------------------

export type JsonValue     = JsonPrimitive | readonly JsonValue[] | { readonly [ propertyName: string ]: JsonValue };

//--------------------------------------------------------------------------------------------------
// Interface: FileNamedEntityV1
//
// Description:
//
//   Defines the structure of file named entity version 1.
//
//--------------------------------------------------------------------------------------------------

export interface FileNamedEntityV1
{
    readonly name:        string;
    readonly description: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: FileDocumentV1
//
// Description:
//
//   Defines the structure of file document version 1.
//
//--------------------------------------------------------------------------------------------------

export interface FileDocumentV1
{
    readonly file_id:      "automata-lab-state-machine";
    readonly file_version: "1.0.0";
    readonly settings:
    {
        readonly name:        string;
        readonly description: string;
        readonly version:     string;
    };
    readonly state_machine:
    {
        readonly initial_state:   string | null;
        readonly events:          readonly FileNamedEntityV1[];
        readonly states:          readonly FileNamedEntityV1[];
        readonly actions:         readonly FileNamedEntityV1[];
        readonly state_actions:
        {
            readonly entry: readonly { readonly state: string; readonly action: string }[];
            readonly exit:  readonly { readonly state: string; readonly action: string }[];
        };
        readonly transition_table: readonly {
            readonly state:      string;
            readonly event:      string;
            readonly state_next: string;
        }[];
    };
    readonly chart:
    {
        readonly settings:
        {
            readonly expand_states:          boolean;
            readonly state_origin_centered?: boolean;
        };
        readonly indicators:
        {
            readonly initial_state_indicator: null | {
                readonly state?: string | null;
                readonly x:      number;
                readonly y:      number;
            };
            readonly terminal_state_indicators?: readonly {
                readonly id: number;
                readonly x:  number;
                readonly y:  number;
            }[];
            readonly terminal_state_transitions?: readonly {
                readonly state:                       string;
                readonly terminal_state_indicator_id: number;
            }[];
        };
        readonly states: readonly {
            readonly state:   string;
            readonly x:       number;
            readonly y:       number;
            /** Legacy 1.0.0 compatibility input. Canonical Save omits this member. */

            readonly width?:  number;
            readonly height?: number;
        }[];
        readonly draft_transitions?: readonly {
            readonly id:     number;
            readonly source: { readonly x: number; readonly y: number };
            readonly target: { readonly x: number; readonly y: number };
        }[];
    };
    readonly solver:
    {
        readonly sequences: readonly {
            readonly name:          string;
            readonly description:   string;
            readonly start_context: SolverStartContext;
            readonly sequence:      readonly string[];
        }[];
    };
    readonly simulator:
    {
        readonly sequences: readonly {
            readonly name:        string;
            readonly description: string;
            readonly sequence:    readonly string[];
        }[];
    };
}

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Canonical Document Serialization
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Maps version 1 files to domain values and serializes schema-ordered canonical document and
//   hosted content.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    AuthoringDraft,
    AutomataDocument,
    CanonicalSerializedDocument,
    FileDocumentV1,
} from "./contracts.js";
import
{
    DEFAULT_CHART_STATE_HEIGHT,
    DEFAULT_CHART_STATE_WIDTH,
} from "./limits.js";

//--------------------------------------------------------------------------------------------------
// Function: decodeFileDocumentV1
//
// Description:
//
//   Decodes file document version 1.
//
// Parameters:
//
//   - fileDocument:
//     The file document supplied to the operation.
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

export function decodeFileDocumentV1 ( fileDocument: FileDocumentV1 ): AuthoringDraft
{
    // Initialize the local values needed by this operation.

    const stateOriginCentered = fileDocument.chart.settings.state_origin_centered ?? false;

    // Return the assembled result.

    return {
        settings:
        {
            name:        fileDocument.settings.name,
            description: fileDocument.settings.description,
            version:     fileDocument.settings.version,
        },
        stateMachine:
        {
            initialState:   fileDocument.state_machine.initial_state,
            events:         fileDocument.state_machine.events.map ( ( event ) => ( { ...event } ) ),
            states:         fileDocument.state_machine.states.map ( ( state ) => ( { ...state } ) ),
            actions:        fileDocument.state_machine.actions.map ( ( action ) => ( { ...action } ) ),
            stateActions:
            {
                entry: fileDocument.state_machine.state_actions.entry.map ( ( mapping ) => ( { ...mapping } ) ),
                exit:  fileDocument.state_machine.state_actions.exit.map ( ( mapping ) => ( { ...mapping } ) ),
            },
            transitionTable: fileDocument.state_machine.transition_table.map ( ( transition ) =>
                ( {
                    state:     transition.state,
                    event:     transition.event,
                    stateNext: transition.state_next,
                } ) ),
        },
        chart:
        {
            settings:
            {
                expandStates: fileDocument.chart.settings.expand_states,
            },
            indicators:
            {
                initialStateIndicator: fileDocument.chart.indicators.initial_state_indicator === null
                    ? null
                    : {
                        ...fileDocument.chart.indicators.initial_state_indicator,
                        state: fileDocument.chart.indicators.initial_state_indicator.state === undefined
                            ? fileDocument.state_machine.initial_state
                            : fileDocument.chart.indicators.initial_state_indicator.state,
                    },
                ...( fileDocument.chart.indicators.indicator_transitions === undefined ? {} : {
                    indicatorTransitions: fileDocument.chart.indicators.indicator_transitions.map ( relation => ( {
                        id: relation.id, source: { ...relation.source }, target: { ...relation.target },
                    } ) ),
                } ),
                terminalStateIndicators: ( fileDocument.chart.indicators.terminal_state_indicators ?? [] ).map (
                    ( indicator ) => ( { ...indicator } ),
                ),
                terminalStateTransitions: ( fileDocument.chart.indicators.terminal_state_transitions ?? [] ).map (
                    ( relation ) =>
                        ( {
                            state:                    relation.state,
                            terminalStateIndicatorId: relation.terminal_state_indicator_id,
                        } ),
                ),
            },
            states: fileDocument.chart.states.map ( ( placement ) =>
            {
                // Initialize the local values needed by this operation.

                const legacyWidth  = placement.width ?? DEFAULT_CHART_STATE_WIDTH;
                const legacyHeight = placement.height ?? DEFAULT_CHART_STATE_HEIGHT;

                // Return the assembled result.

                return {
                    state: placement.state,
                    x: stateOriginCentered ? placement.x - legacyWidth / 2 : placement.x,
                    y: stateOriginCentered ? placement.y - legacyHeight / 2 : placement.y,
                    ...( placement.height === undefined ? {} : { height: placement.height } ),
                };
            } ),
            draftTransitions: ( fileDocument.chart.draft_transitions ?? [] ).map ( ( transition ) => ( {
                id:     transition.id,
                source: { ...transition.source },
                target: { ...transition.target },
                ...( transition.source_indicator == null ? {} : { sourceIndicator: { ...transition.source_indicator } } ),
                ...( transition.target_indicator == null ? {} : { targetIndicator: { ...transition.target_indicator } } ),
                ...( transition.source_state == null ? {} : { sourceState: transition.source_state } ),
                ...( transition.target_state == null ? {} : { targetState: transition.target_state } ),
                ...( transition.remembered_event == null ? {} : { rememberedEvent: transition.remembered_event } ),
                ...( transition.remembered_transition_index == null ? {} : { rememberedTransitionIndex: transition.remembered_transition_index } ),
            } ) ),
        },
        solver:
        {
            sequences: fileDocument.solver.sequences.map ( ( sequence ) =>
                ( {
                    name:         sequence.name,
                    description:  sequence.description,
                    startContext: sequence.start_context,
                    sequence:     [ ...sequence.sequence ],
                } ) ),
        },
        simulator:
        {
            sequences: fileDocument.simulator.sequences.map ( ( sequence ) =>
                ( {
                    name:        sequence.name,
                    description: sequence.description,
                    sequence:    [ ...sequence.sequence ],
                } ) ),
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: fileVersionForDocument
//
// Description:
//
//   Selects the minimum file contract required by the document for serialization and reports.
//--------------------------------------------------------------------------------------------------

export function fileVersionForDocument ( document: Pick<AuthoringDraft, "chart"> ): FileDocumentV1["file_version"]
{
    if ( ( document.chart.indicators.indicatorTransitions?.length ?? 0 ) > 0 ||
        document.chart.draftTransitions.some ( transition => transition.sourceIndicator != null || transition.targetIndicator != null ) )
    {
        return "1.3.0";
    }
    if ( document.chart.draftTransitions.some ( transition =>
        transition.rememberedEvent != null || transition.rememberedTransitionIndex != null ) )
    {
        return "1.2.0";
    }
    return document.chart.draftTransitions.some ( transition =>
        transition.sourceState != null || transition.targetState != null ) ? "1.1.0" : "1.0.0";
}

//--------------------------------------------------------------------------------------------------
// Function: encodeFileDocumentV1
//
// Description:
//
//   Encodes file document version 1.
//
// Parameters:
//
//   - document:
//     The document to process.
//
//   - expandedStateMinimumHeight:
//     The expanded state minimum height supplied to the operation.
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

export function encodeFileDocumentV1 (
    document: AuthoringDraft,
    expandedStateMinimumHeight = DEFAULT_CHART_STATE_HEIGHT,
): FileDocumentV1
{
    // Return the assembled result.

    return {
        file_id:      "automata-lab-state-machine",
        file_version: fileVersionForDocument ( document ),
        settings:
        {
            name:        document.settings.name,
            description: document.settings.description,
            version:     document.settings.version,
        },
        state_machine:
        {
            initial_state:   document.stateMachine.initialState,
            events:          document.stateMachine.events.map ( ( event ) => ( { ...event } ) ),
            states:          document.stateMachine.states.map ( ( state ) => ( { ...state } ) ),
            actions:         document.stateMachine.actions.map ( ( action ) => ( { ...action } ) ),
            state_actions:
            {
                entry: document.stateMachine.stateActions.entry.map ( ( mapping ) => ( { ...mapping } ) ),
                exit:  document.stateMachine.stateActions.exit.map ( ( mapping ) => ( { ...mapping } ) ),
            },
            transition_table: document.stateMachine.transitionTable.map ( ( transition ) =>
                ( {
                    state:      transition.state,
                    event:      transition.event,
                    state_next: transition.stateNext,
                } ) ),
        },
        chart:
        {
            settings:
            {
                expand_states:         document.chart.settings.expandStates,
                state_origin_centered: false,
            },
            indicators:
            {
                initial_state_indicator: document.chart.indicators.initialStateIndicator === null
                    ? null
                    : {
                        ...document.chart.indicators.initialStateIndicator,
                        state: document.chart.indicators.initialStateIndicator.state ?? null,
                    },
                ...( ( document.chart.indicators.indicatorTransitions?.length ?? 0 ) === 0 ? {} : {
                    indicator_transitions: ( document.chart.indicators.indicatorTransitions ?? [] ).map ( relation => ( {
                        id: relation.id, source: { ...relation.source }, target: { ...relation.target },
                    } ) ),
                } ),
                terminal_state_indicators: document.chart.indicators.terminalStateIndicators.map (
                    ( indicator ) => ( { ...indicator } ),
                ),
                terminal_state_transitions: document.chart.indicators.terminalStateTransitions.map (
                    ( relation ) =>
                        ( {
                            state:                       relation.state,
                            terminal_state_indicator_id: relation.terminalStateIndicatorId,
                        } ),
                ),
            },
            states: document.chart.states.map ( ( placement ) => ( {
                state:  placement.state,
                x:      placement.x,
                y:      placement.y,
                height: placement.height ?? expandedStateMinimumHeight,
            } ) ),
            draft_transitions: document.chart.draftTransitions.map ( ( transition ) => ( {
                id:     transition.id,
                source: { ...transition.source },
                target: { ...transition.target },
                ...( transition.sourceIndicator == null ? {} : { source_indicator: { ...transition.sourceIndicator } } ),
                ...( transition.targetIndicator == null ? {} : { target_indicator: { ...transition.targetIndicator } } ),
                ...( transition.sourceState == null ? {} : { source_state: transition.sourceState } ),
                ...( transition.targetState == null ? {} : { target_state: transition.targetState } ),
                ...( transition.rememberedEvent == null ? {} : { remembered_event: transition.rememberedEvent } ),
                ...( transition.rememberedTransitionIndex == null ? {} : { remembered_transition_index: transition.rememberedTransitionIndex } ),
            } ) ),
        },
        solver:
        {
            sequences: document.solver.sequences.map ( ( sequence ) =>
                ( {
                    name:          sequence.name,
                    description:   sequence.description,
                    start_context: sequence.startContext,
                    sequence:      [ ...sequence.sequence ],
                } ) ),
        },
        simulator:
        {
            sequences: document.simulator.sequences.map ( ( sequence ) =>
                ( {
                    name:        sequence.name,
                    description: sequence.description,
                    sequence:    [ ...sequence.sequence ],
                } ) ),
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: serializeCanonicalDocument
//
// Description:
//
//   Serializes canonical document.
//
// Parameters:
//
//   - document:
//     The document to process.
//
//   - expandedStateMinimumHeight:
//     The expanded state minimum height supplied to the operation.
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

export function serializeCanonicalDocument (
    document: AuthoringDraft,
    expandedStateMinimumHeight = DEFAULT_CHART_STATE_HEIGHT,
): CanonicalSerializedDocument
{
    // Return the assembled result.

    return {
        text: `${JSON.stringify ( encodeFileDocumentV1 ( document, expandedStateMinimumHeight ), null, 2 )}\n`,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: serializeCanonicalHostedContent
//
// Description:
//
//   Serializes canonical hosted content.
//
// Parameters:
//
//   - document:
//     The document to process.
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

export function serializeCanonicalHostedContent ( document: AutomataDocument ): string
{
    // Initialize the local values needed by this operation.

    const fileDocument  = encodeFileDocumentV1 ( document );
    const hostedContent = 
    {
        settings:      fileDocument.settings,
        state_machine: fileDocument.state_machine,
    };

    // Return the computed result.

    return `${JSON.stringify ( hostedContent, null, 2 )}\n`;
}

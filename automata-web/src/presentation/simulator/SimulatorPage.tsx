// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    State Transducer Simulator Page
// Version: 2.1.0
// Date:    2026-08-20
// Author:  Rohin Gosling
//
// Description:
//
//   Presents the saved event-sequence library, the events editor, the transition and action traces,
//   and the revision-pinned session controls.
//
//   The page executes nothing. Run, Step, and Reset are requests to the emulated server, and every
//   runtime value rendered here arrives in a session snapshot returned by it.
//
//   The page renders no warning, error, or status message of its own. Runtime warnings, trace
//   truncation, session staleness, and session lifecycle are published to the Console by the shell,
//   which is the one place a user looks for what the application has to say. The reasons
//   accompanying disabled commands are the deliberate exception: they are enablement affordances
//   attached to the controls they explain, and a disabled button whose reason lives in another
//   panel is a button with no reason at all.
//
//   Both of the page's horizontal splitters -- the one dividing the Events pane and the one
//   dividing the trace region -- start at an even division and keep tracking their container's
//   height until they are first moved. Each is held as null until then, so the division is
//   expressed in CSS as two equal fractions rather than as a number measured on the first frame.
//   That is what makes it exactly even and what keeps it even while the window is resized.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";

import type
{
    SimulatorCommandAvailability,
    SimulatorCommandBlocker,
} from "../../application/simulator-workspace.js";
import { cleanEventLines, eventLinesText } from "../../application/simulator-workspace.js";
import type { HostedSessionDto } from "../../application/server-contracts.js";
import type { AuthoringDraft, SimulatorSequence } from "../../domain/model/contracts.js";
import type { RuntimeActionTraceEntry, RuntimeTransitionTraceEntry } from "../../domain/runtime/contracts.js";
import { text } from "../../localization/messages.js";
import type { MessageKey } from "../../localization/messages.js";
import { SimulatorEventDialog, SimulatorSequenceDialog } from "../dialogs/DialogPatterns.js";
import { isNearScrollableEnd, useProgressiveRendering } from "../shared/progressive-rendering.js";
import { Splitter } from "../shared/Splitter.js";
import { useCommandBarMinimumWidth } from "../shared/useCommandBarMinimumWidth.js";
import { useMeasuredBlockSize } from "../shared/useMeasuredBlockSize.js";
import { TraceTable } from "./TraceTable.js";
import type { TraceTableColumn } from "./TraceTable.js";

const DEFAULT_SIMULATOR_SEQUENCE: SimulatorSequence =
{
    description: "",
    name:        "sequence_1",
    sequence:    [],
};

const DEFAULT_SEQUENCE_LIST_WIDTH      = 300;
const BASE_MINIMUM_SEQUENCE_LIST_WIDTH = 220;
const DEFAULT_EVENT_EDITOR_WIDTH       = 320;
const BASE_MINIMUM_EVENT_EDITOR_WIDTH  = 240;
const MINIMUM_INSPECTOR_WIDTH          = 360;
const MINIMUM_EVENT_PANE_HEIGHT        = 96;
const MINIMUM_TRACE_HEIGHT             = 120;

const BLOCKER_MESSAGE_KEYS: Readonly<Record<SimulatorCommandBlocker, MessageKey>> =
{
    document_invalid:        "simulator.blocker.document_invalid",
    document_missing:        "simulator.blocker.document_missing",
    hosted_revision_missing: "simulator.blocker.hosted_revision_missing",
    server_not_ready:        "simulator.blocker.server_not_ready",
};

const OUTCOME_MESSAGE_KEYS =
{
    NO_TRANSITION: "simulator.outcome.NO_TRANSITION",
    TRANSITION:    "simulator.outcome.TRANSITION",
    UNKNOWN_EVENT: "simulator.outcome.UNKNOWN_EVENT",
} as const;

// Both traces divide their width evenly across these columns and render every row at one uniform
// height, so appending a row never compresses the rows already shown. Action Schedule is the
// Moore-machine phase that emitted the action.

const TRANSITION_TRACE_COLUMNS: readonly TraceTableColumn<RuntimeTransitionTraceEntry>[] =
[
    { headingKey: "simulator.column.state",     value: entry => entry.sourceState },
    { headingKey: "simulator.column.event",     value: entry => entry.event },
    { headingKey: "simulator.column.nextState", value: entry => entry.destinationState },
    { headingKey: "simulator.column.outcome",   value: entry => text ( OUTCOME_MESSAGE_KEYS [ entry.outcome ] ) },
];

const ACTION_TRACE_COLUMNS: readonly TraceTableColumn<RuntimeActionTraceEntry>[] =
[
    { headingKey: "simulator.column.action",   value: entry => entry.action },
    { headingKey: "simulator.column.state",    value: entry => entry.state },
    {
        headingKey: "simulator.column.schedule",
        value:      entry => text ( entry.phase === "entry" ? "simulator.phase.entry" : "simulator.phase.exit" ),
    },
];


//--------------------------------------------------------------------------------------------------
// Interface: SimulatorPageProperties
//
// Description:
//
//   Defines the properties accepted by the simulator page interface.
//
//--------------------------------------------------------------------------------------------------

export interface SimulatorPageProperties
{
    readonly availability:       SimulatorCommandAvailability;
    readonly draft:              AuthoringDraft | null;
    readonly onCloseSession:     () => void;
    readonly onReset:            () => void;
    readonly onRun:              ( events: readonly string[] ) => void;
    readonly onSequencesChange:  ( sequences: readonly SimulatorSequence[] ) => void;
    readonly onStartSession:     () => void;
    readonly onStep:             ( events: readonly string[] ) => void;
    readonly onStepCursorChange: ( stepCursor: number ) => void;
    readonly session:            HostedSessionDto | null;
    readonly stepCursor:         number;
}


//--------------------------------------------------------------------------------------------------
// Function: SimulatorPage
//
// Description:
//
//   Renders the simulator page interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered simulator page interface.
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

export function SimulatorPage ( properties: SimulatorPageProperties )
{
    // Initialize the local values needed by this operation.

    const [ selectedSequenceIndex, setSelectedSequenceIndex ] = useState ( 0 );
    const [ eventDraft, setEventDraft ]                       = useState<{ readonly sequenceName: string; readonly value: string } | null> (
        null,
    );
    const [ sequenceDialogMode, setSequenceDialogMode ] = useState<"add" | "edit" | null> ( null );
    const [ eventDialogOpen, setEventDialogOpen ]       = useState ( false );
    const [ sequenceListWidth, setSequenceListWidth ]   = useState ( DEFAULT_SEQUENCE_LIST_WIDTH );
    const [ eventEditorWidth, setEventEditorWidth ]     = useState ( DEFAULT_EVENT_EDITOR_WIDTH );

    // Null means the division is still even. An even division is expressed in CSS as two equal
    // fractions rather than as a stored measurement, which is what makes it exact and what keeps it
    // even while the window is resized. Dragging a splitter replaces the null with the chosen size,
    // and from then on that size is held.
    //
    // The trace region divides this way because neither trace has a claim on more of it than the
    // other before a run exists, and which one wants the space afterwards depends on the model
    // rather than on the application.

    const [ transitionTraceHeight, setTransitionTraceHeight ] = useState<number | null> ( null );
    const [ eventBufferHeight, setEventBufferHeight ]         = useState<number | null> ( null );
    const sequenceCommandBarReference   = useRef<HTMLDivElement> ( null );
    const eventCommandBarReference      = useRef<HTMLDivElement> ( null );
    const eventBufferReference          = useRef<HTMLDivElement> ( null );
    const transitionTraceReference      = useRef<HTMLElement> ( null );
    const measuredEventBufferHeight     = useMeasuredBlockSize ( eventBufferReference );
    const measuredTransitionTraceHeight = useMeasuredBlockSize ( transitionTraceReference );
    const sequenceListMinimumWidth      = useCommandBarMinimumWidth (
        sequenceCommandBarReference,
        BASE_MINIMUM_SEQUENCE_LIST_WIDTH,
    );
    const eventEditorMinimumWidth       = useCommandBarMinimumWidth (
        eventCommandBarReference,
        BASE_MINIMUM_EVENT_EDITOR_WIDTH,
    );

    const sequences              = properties.draft?.simulator.sequences ?? [];
    const effectiveSequenceIndex = Math.min ( selectedSequenceIndex, Math.max ( 0, sequences.length - 1 ) );
    const selectedSequence       = sequences [ effectiveSequenceIndex ];
    const eventText              = selectedSequence === undefined
        ? ""
        : eventDraft?.sequenceName === selectedSequence.name
            ? eventDraft.value
            : eventLinesText ( selectedSequence );
    const events                       = cleanEventLines ( eventText );
    const boundedStepCursor            = Math.max ( 0, Math.min ( properties.stepCursor, events.length ) );
    const effectiveEventIndex          = Math.min ( boundedStepCursor, Math.max ( 0, events.length - 1 ) );
    const progressiveSequenceRendering = useProgressiveRendering ( sequences.length, effectiveSequenceIndex );
    const progressiveEventRendering    = useProgressiveRendering (
        events.length,
        effectiveEventIndex,
    );


    // Handle the case where properties draft matches an absent value.

    if ( properties.draft === null )
    {
        // Return the rendered interface.

        return <p className="empty-state">{ text ( "simulator.sequence.noDocument" ) }</p>;
    }


    //----------------------------------------------------------------------------------------------
    // Function: commitSequences
    //
    // Description:
    //
    //   Commits the sequences.
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

    function commitSequences ( nextSequences: readonly SimulatorSequence[], nextSelectedIndex: number ): void
    {
        setEventDraft ( null );
        setSelectedSequenceIndex ( nextSelectedIndex );
        properties.onStepCursorChange ( 0 );
        properties.onSequencesChange ( nextSequences );
    }

    // The committed collection always carries the current editor content, so a structural command
    // can never silently discard an uncommitted edit.


    //----------------------------------------------------------------------------------------------
    // Function: sequencesWithCurrentEvents
    //
    // Description:
    //
    //   Derives the sequences with current events.
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

    function sequencesWithCurrentEvents (): readonly SimulatorSequence[]
    {
        // Return the mapped collection.

        return sequences.map ( ( sequence, index ) => index === effectiveSequenceIndex
            ? { ...sequence, sequence: events }
            : sequence );
    }


    //----------------------------------------------------------------------------------------------
    // Function: commitEvents
    //
    // Description:
    //
    //   Commits the events.
    //
    // Parameters:
    //
    //   - nextEvents:
    //     The next events supplied to the operation.
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

    function commitEvents ( nextEvents: readonly string[] = events ): void
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( selectedSequence === undefined ||
            JSON.stringify ( nextEvents ) === JSON.stringify ( selectedSequence.sequence ) )
        {
            // Return control to the caller.

            return;
        }

        setEventDraft ( null );
        properties.onSequencesChange ( sequences.map ( ( sequence, index ) => index === effectiveSequenceIndex
            ? { ...sequence, sequence: nextEvents }
            : sequence ) );
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

        const reordered   = [ ...sequencesWithCurrentEvents () ];
        const source      = reordered [ effectiveSequenceIndex ];
        const destination = reordered [ destinationIndex ];


        // Handle the case where at least one branch condition is satisfied.

        if ( source === undefined || destination === undefined )
        {
            // Return control to the caller.

            return;
        }

        reordered [ effectiveSequenceIndex ] = destination;
        reordered [ destinationIndex ]       = source;
        commitSequences ( reordered, destinationIndex );
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
        // Handle the case where selected sequence matches undefined.

        if ( selectedSequence === undefined )
        {
            // Return control to the caller.

            return;
        }

        const remaining = sequencesWithCurrentEvents ().filter ( ( _, index ) => index !== effectiveSequenceIndex );

        commitSequences ( remaining, Math.min ( effectiveSequenceIndex, Math.max ( 0, remaining.length - 1 ) ) );
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

    function saveSequenceFromDialog ( sequence: SimulatorSequence ): void
    {
        // Initialize the local values needed by this operation.

        const current = sequencesWithCurrentEvents ();


        // Handle the case where sequence dialog mode matches the add value.

        if ( sequenceDialogMode === "add" )
        {
            commitSequences ( [ ...current, sequence ], current.length );
        }
        else if ( selectedSequence !== undefined )
        {
            commitSequences (
                current.map ( ( currentSequence, index ) => index === effectiveSequenceIndex
                    ? { ...sequence, sequence: currentSequence.sequence }
                    : currentSequence ),
                effectiveSequenceIndex,
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: moveSelectedEvent
    //
    // Description:
    //
    //   Moves the selected event.
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

    function moveSelectedEvent ( direction: "down" | "up" ): void
    {
        // Calculate the destination index value from the current inputs.

        const destinationIndex = effectiveEventIndex + ( direction === "up" ? -1 : 1 );


        // Handle the case where at least one branch condition is satisfied.

        if ( destinationIndex < 0 || destinationIndex >= events.length || effectiveEventIndex >= events.length )
        {
            // Return control to the caller.

            return;
        }


        // Initialize the local values needed by this operation.

        const reordered   = [ ...events ];
        const source      = reordered [ effectiveEventIndex ];
        const destination = reordered [ destinationIndex ];


        // Handle the case where at least one branch condition is satisfied.

        if ( source === undefined || destination === undefined )
        {
            // Return control to the caller.

            return;
        }

        reordered [ effectiveEventIndex ] = destination;
        reordered [ destinationIndex ]    = source;
        commitEvents ( reordered );
        properties.onStepCursorChange ( destinationIndex );
    }


    //----------------------------------------------------------------------------------------------
    // Function: deleteSelectedEvent
    //
    // Description:
    //
    //   Deletes the selected event.
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

    function deleteSelectedEvent (): void
    {
        // Handle the case where events length equals 0.

        if ( events.length === 0 )
        {
            // Return control to the caller.

            return;
        }

        commitEvents ( events.filter ( ( _, index ) => index !== effectiveEventIndex ) );
        properties.onStepCursorChange ( Math.min ( effectiveEventIndex, Math.max ( 0, events.length - 2 ) ) );
    }


    //----------------------------------------------------------------------------------------------
    // Function: insertEvent
    //
    // Description:
    //
    //   Handles the insert event behavior.
    //
    // Parameters:
    //
    //   - eventName:
    //     The event name supplied to the operation.
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

    function insertEvent ( eventName: string ): void
    {
        // Calculate the insertion index value from the current inputs.

        const insertionIndex = Math.min ( boundedStepCursor + ( events.length === 0 ? 0 : 1 ), events.length );

        commitEvents ( [ ...events.slice ( 0, insertionIndex ), eventName, ...events.slice ( insertionIndex ) ] );
        properties.onStepCursorChange ( insertionIndex );
    }


    // Initialize the local values needed by this operation.

    const session         = properties.session;
    const sessionActive   = session !== null;
    const commandsEnabled = properties.availability.isEnabled && sessionActive;
    const transitionTrace = session?.transitionTrace ?? [];
    const actionTrace     = session?.actionTrace ?? [];


    // Return the rendered interface.

    return (
        <section className="simulator-workspace">
            { properties.availability.blockers.length > 0 && (
                <div className="simulator-blocked" role="status">
                    <p>{ text ( "simulator.blocked.title" ) }</p>
                    <ul>
                        { properties.availability.blockers.map ( blocker => (
                            <li key={ blocker }>{ text ( BLOCKER_MESSAGE_KEYS [ blocker ] ) }</li>
                        ) ) }
                    </ul>
                </div>
            ) }
            <div
                className = "simulator-panes"
                style     = {
                    {
                        "--simulator-event-editor-minimum-width":  `${eventEditorMinimumWidth}px`,
                        "--simulator-event-editor-width":          `${eventEditorWidth}px`,
                        "--simulator-event-pane-minimum-height":   `${MINIMUM_EVENT_PANE_HEIGHT}px`,
                        "--simulator-sequence-list-minimum-width": `${sequenceListMinimumWidth}px`,
                        "--simulator-sequence-list-width":         `${sequenceListWidth}px`,

                        // Left unset while a division is even, so its two rows fall back to one
                        // fraction each.

                        ...( eventBufferHeight === null
                            ? {}
                            : { "--simulator-event-buffer-height": `${eventBufferHeight}px` } ),
                        ...( transitionTraceHeight === null
                            ? {}
                            : { "--simulator-transition-trace-height": `${transitionTraceHeight}px` } ),
                    } as CSSProperties
                }
            >
                <section className="simulator-sequence-list" aria-labelledby="simulator-sequence-list-title">
                    <h2 id="simulator-sequence-list-title">{ text ( "simulator.sequence.list" ) }</h2>
                    { sequences.length === 0
                        ? <p>{ text ( "simulator.sequence.empty" ) }</p>
                        : (
                            <select
                                aria-label={ text ( "simulator.sequence.list" ) }
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
                                    setEventDraft ( null );
                                    properties.onStepCursorChange ( 0 );
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
                                    <option key={ sequence.name } value={ index }>{ sequence.name }</option>
                                    ) ) }
                            </select>
                        ) }
                    <div className="list-command-bar simulator-sequence-actions" ref={ sequenceCommandBarReference }>
                        <button
                            disabled = { effectiveSequenceIndex <= 0 || selectedSequence === undefined }
                            onClick  = { () => moveSelectedSequence ( "up" ) }
                            type     = "button"
                        >
                            <span aria-hidden="true">{ "↑" }</span> { text ( "button.moveUp" ) }
                        </button>
                        <button
                            disabled = { selectedSequence === undefined || effectiveSequenceIndex >= sequences.length - 1 }
                            onClick  = { () => moveSelectedSequence ( "down" ) }
                            type     = "button"
                        >
                            <span aria-hidden="true">{ "↓" }</span> { text ( "button.moveDown" ) }
                        </button>
                        <button onClick={ () => setSequenceDialogMode ( "add" ) } type="button">
                            { text ( "button.add" ) }
                        </button>
                        <button
                            disabled = { selectedSequence === undefined }
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
                    label           = { text ( "simulator.resizeEvents" ) }
                    minimum         = { sequenceListMinimumWidth }
                    onChange        = { setSequenceListWidth }
                    opposingMinimum = { eventEditorMinimumWidth }
                    orientation     = "vertical"
                    value           = { sequenceListWidth }
                />
                <section className="simulator-event-editor" aria-labelledby="simulator-event-editor-title">
                    <h2 id="simulator-event-editor-title">{ text ( "simulator.sequence.editor" ) }</h2>
                    <div className="simulator-event-panes">
                        <div className="simulator-event-buffer" ref={ eventBufferReference }>
                            <h3 id="simulator-event-position-title">{ text ( "simulator.events.position" ) }</h3>
                            <select
                                aria-labelledby="simulator-event-position-title"
                                className = "simulator-event-list"
                                disabled  = { events.length === 0 }
                                onKeyDown = { event =>
                                {
                                    // Handle the case where event key matches the End value.

                                    if ( event.key === "End" )
                                    {
                                        progressiveEventRendering.revealThrough ( events.length - 1 );
                                    }
                                    else if ( event.key === "ArrowDown" &&
                                        effectiveEventIndex >= progressiveEventRendering.visibleItemCount - 1 )
                                    {
                                        progressiveEventRendering.revealNextBatch ();
                                    }
                                } }
                                onChange = { event => properties.onStepCursorChange ( Number ( event.currentTarget.value ) ) }
                                onScroll = { event =>
                                {
                                    // Handle the case where is near scrollable end result is
                                    // enabled.

                                    if ( isNearScrollableEnd ( event.currentTarget ) )
                                    {
                                        progressiveEventRendering.revealNextBatch ();
                                    }
                                } }
                                size  = { Math.min ( 8, Math.max ( 2, events.length ) ) }
                                value = { effectiveEventIndex }
                            >
                                { events.slice ( 0, progressiveEventRendering.visibleItemCount )
                                    .map ( ( eventName, index ) => (
                                    <option key={ `${eventName}-${index}` } value={ index }>
                                        { index < boundedStepCursor ? "✓ " : "" }{ index + 1 }. { eventName }
                                    </option>
                                    ) ) }
                            </select>
                        </div>
                        <Splitter
                            controls        = "leading"
                            label           = { text ( "simulator.resizeEventBuffer" ) }
                            minimum         = { MINIMUM_EVENT_PANE_HEIGHT }
                            onChange        = { setEventBufferHeight }
                            opposingMinimum = { MINIMUM_EVENT_PANE_HEIGHT }
                            orientation     = "horizontal"
                            value           = { eventBufferHeight ??
                                Math.max ( measuredEventBufferHeight, MINIMUM_EVENT_PANE_HEIGHT ) }
                        />
                        <div className="simulator-event-text">
                            <h3 id="simulator-event-text-title">{ text ( "simulator.events.text" ) }</h3>
                            <textarea
                                aria-labelledby="simulator-event-text-title"
                                disabled = { selectedSequence === undefined }
                                id       = "simulator-event-text"
                                onBlur   = { () => commitEvents () }
                                onChange = { ( event: ChangeEvent<HTMLTextAreaElement> ) =>
                                {
                                    setEventDraft (
                                        { sequenceName: selectedSequence?.name ?? "", value: event.currentTarget.value },
                                    );
                                } }
                                onKeyDown={ event =>
                                {
                                    // Handle the case where all required conditions are satisfied.

                                    if ( event.key === "Enter" && !event.shiftKey && event.ctrlKey )
                                    {
                                        commitEvents ();
                                    }
                                } }
                                spellCheck = { false }
                                value      = { eventText }
                            />
                        </div>
                        </div>
                    <div className="list-command-bar simulator-event-actions" ref={ eventCommandBarReference }>
                        <button
                            disabled = { effectiveEventIndex <= 0 || events.length === 0 }
                            onClick  = { () => moveSelectedEvent ( "up" ) }
                            type     = "button"
                        >
                            <span aria-hidden="true">{ "↑" }</span> { text ( "button.moveUp" ) }
                        </button>
                        <button
                            disabled = { events.length === 0 || effectiveEventIndex >= events.length - 1 }
                            onClick  = { () => moveSelectedEvent ( "down" ) }
                            type     = "button"
                        >
                            <span aria-hidden="true">{ "↓" }</span> { text ( "button.moveDown" ) }
                        </button>
                        <button
                            disabled = { selectedSequence === undefined }
                            onClick  = { () => setEventDialogOpen ( true ) }
                            type     = "button"
                        >
                            { text ( "button.add" ) }
                        </button>
                        <button
                            disabled = { events.length === 0 }
                            onClick  = { deleteSelectedEvent }
                            type     = "button"
                        >
                            { text ( "button.delete" ) }
                        </button>
                    </div>
                </section>
                <Splitter
                    label           = { text ( "simulator.resizeInspector" ) }
                    minimum         = { eventEditorMinimumWidth }
                    onChange        = { setEventEditorWidth }
                    opposingMinimum = { MINIMUM_INSPECTOR_WIDTH }
                    orientation     = "vertical"
                    value           = { eventEditorWidth }
                />
                <div className="simulator-inspector">
                    <section
                        aria-labelledby="simulator-transition-trace-title"
                        className = "simulator-transition-trace"
                        ref       = { transitionTraceReference }
                    >
                        <h2 id="simulator-transition-trace-title">{ text ( "simulator.transitionTrace" ) }</h2>
                        <TraceTable
                            columns      = { TRANSITION_TRACE_COLUMNS }
                            emptyMessage = { text ( "simulator.trace.empty" ) }
                            entries      = { transitionTrace }
                            labelledBy   = "simulator-transition-trace-title"
                            rowOutcome   = { entry => entry.outcome }
                        />
                    </section>
                    <Splitter
                        controls        = "leading"
                        label           = { text ( "simulator.resizeTraces" ) }
                        minimum         = { MINIMUM_TRACE_HEIGHT }
                        onChange        = { setTransitionTraceHeight }
                        opposingMinimum = { MINIMUM_TRACE_HEIGHT }
                        orientation     = "horizontal"
                        value           = { transitionTraceHeight ??
                            Math.max ( measuredTransitionTraceHeight, MINIMUM_TRACE_HEIGHT ) }
                    />
                    <section className="simulator-action-trace" aria-labelledby="simulator-action-trace-title">
                        <h2 id="simulator-action-trace-title">{ text ( "simulator.actionTrace" ) }</h2>
                        <TraceTable
                            columns      = { ACTION_TRACE_COLUMNS }
                            emptyMessage = { text ( "simulator.trace.empty" ) }
                            entries      = { actionTrace }
                            labelledBy   = "simulator-action-trace-title"
                        />
                    </section>
                </div>
            </div>
            <div className="detail-button-panel simulator-command-panel">
                { sessionActive
                    ? (
                        <button onClick={ properties.onCloseSession } type="button">
                            { text ( "button.closeSession" ) }
                        </button>
                    )
                    : (
                        <button
                            disabled = { !properties.availability.isEnabled }
                            onClick  = { properties.onStartSession }
                            type     = "button"
                        >
                            { text ( "button.startSession" ) }
                        </button>
                    ) }
                <button
                    disabled = { !commandsEnabled }
                    onClick  = { () =>
                    {
                        commitEvents ();
                        properties.onRun ( events );
                    } }
                    type="button"
                >
                    { text ( "button.run" ) }
                </button>
                <button
                    disabled = { !commandsEnabled }
                    onClick  = { () =>
                    {
                        commitEvents ();
                        properties.onStep ( events );
                    } }
                    type="button"
                >
                    { text ( "button.step" ) }
                </button>
                <button disabled={ !commandsEnabled } onClick={ properties.onReset } type="button">
                    { text ( "button.reset" ) }
                </button>
            </div>
            { sequenceDialogMode !== null && (
                <SimulatorSequenceDialog
                    existingNames={ sequences
                        .filter ( ( _, index ) => sequenceDialogMode === "add" || index !== effectiveSequenceIndex )
                        .map ( sequence => sequence.name ) }
                    initialValue={ sequenceDialogMode === "edit" && selectedSequence !== undefined
                        ? { ...selectedSequence, sequence: events }
                        : DEFAULT_SIMULATOR_SEQUENCE }
                    onClose   = { () => setSequenceDialogMode ( null ) }
                    onConfirm = { saveSequenceFromDialog }
                    open
                />
            ) }
            { eventDialogOpen && (
                <SimulatorEventDialog
                    eventNames = { properties.draft.stateMachine.events.map ( declaredEvent => declaredEvent.name ) }
                    onClose    = { () => setEventDialogOpen ( false ) }
                    onConfirm  = { insertEvent }
                    open
                />
            ) }
        </section>
    );
}

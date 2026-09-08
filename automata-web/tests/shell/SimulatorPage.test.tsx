// @vitest-environment jsdom

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Simulator Page Tests
// Version: 2.0.0
// Date:    2026-08-20
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the sequence library commands, editor cleanup and buffer isolation, Run/Step/Reset
//   enablement, Step selection advance, trace rendering, trace windowing, and the absence of any
//   on-page message surface.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { simulatorCommandAvailability } from "../../src/application/simulator-workspace.js";
import type { SimulatorCommandAvailability } from "../../src/application/simulator-workspace.js";
import type { HostedSessionDto } from "../../src/application/server-contracts.js";
import { COMPILE_TIME_CONFIGURATION } from "../../src/configuration/compile-time-configuration.js";
import type { AuthoringDraft, SimulatorSequence } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { SimulatorPage } from "../../src/presentation/simulator/SimulatorPage.js";

const REVISION = `sha256:${"a".repeat ( 64 )}`;

const ENABLED: SimulatorCommandAvailability = { blockers: [], isEnabled: true };

afterEach ( cleanup );


//--------------------------------------------------------------------------------------------------
// Function: createDraft
//
// Description:
//
//   Creates draft for the test scenario.
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

function createDraft ( sequences: readonly SimulatorSequence[] = [] ): AuthoringDraft
{
    // Initialize the local values needed by this operation.

    const draft = createEmptyAuthoringDraft ( true );


    // Return the assembled result.

    return {
        ...draft,
        stateMachine:
        {
            ...draft.stateMachine,
            events: [ { name: "event_go", description: "" }, { name: "event_stop", description: "" } ],
        },
        simulator: { sequences },
    };
}


//--------------------------------------------------------------------------------------------------
// Function: createSession
//
// Description:
//
//   Creates session for the test scenario.
//
// Parameters:
//
//   - overrides:
//     The overrides supplied to the operation.
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

function createSession ( overrides: Partial<HostedSessionDto> = {} ): HostedSessionDto
{
    // Return the assembled result.

    return {
        actionTrace:                [],
        currentState:               "state_idle",
        initialEntryActionsPending: true,
        isStale:                    false,
        modelRevision:              REVISION,
        processedEventCount:        0,
        sessionId:                  "11111111-1111-4111-8111-111111111111",
        traceTruncated:             false,
        transitionTrace:            [],
        ...overrides,
    };
}


//--------------------------------------------------------------------------------------------------
// Interface: HarnessOverrides
//
// Description:
//
//   Defines the structure of harness overrides.
//
//--------------------------------------------------------------------------------------------------

interface HarnessOverrides
{
    readonly availability?: SimulatorCommandAvailability;
    readonly initialStepCursor?: number;
    readonly onRun?:        ( events: readonly string[] ) => void;
    readonly onStep?:       ( events: readonly string[] ) => void;
    readonly onReset?:      () => void;
    readonly onStartSession?: () => void;
    readonly onCloseSession?: () => void;
    readonly session?:      HostedSessionDto | null;
    readonly sequences?:    readonly SimulatorSequence[];
}

// A stateful harness, because the page is controlled: a sequence change has to come back through
// props before the editor reflects it, exactly as it does in the shell.


//--------------------------------------------------------------------------------------------------
// Function: Harness
//
// Description:
//
//   Renders the harness interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered harness interface.
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

function Harness ( properties: HarnessOverrides & { readonly onSequencesChange?: ( s: readonly SimulatorSequence[] ) => void } )
{
    // Initialize the local values needed by this operation.

    const [ sequences, setSequences ] = useState<readonly SimulatorSequence[]> (
        properties.sequences ?? [ { description: "", name: "sequence_1", sequence: [ "event_go" ] } ],
    );
    const [ stepCursor, setStepCursor ] = useState ( properties.initialStepCursor ?? 0 );


    // Return the rendered interface.

    return (
        <SimulatorPage
            availability      = { properties.availability ?? ENABLED }
            draft             = { createDraft ( sequences ) }
            onCloseSession    = { properties.onCloseSession ?? ( () => undefined ) }
            onReset           = { properties.onReset ?? ( () => undefined ) }
            onRun             = { properties.onRun ?? ( () => undefined ) }
            onSequencesChange = { next =>
            {
                setSequences ( next );
                properties.onSequencesChange?. ( next );
            } }
            onStartSession     = { properties.onStartSession ?? ( () => undefined ) }
            onStep             = { properties.onStep ?? ( () => undefined ) }
            onStepCursorChange = { setStepCursor }
            session            = { properties.session === undefined ? createSession () : properties.session }
            stepCursor         = { stepCursor }
        />
    );
}

describe ( "Simulator page composition", () =>
{
    it ( "presents the four regions and the Run, Step, and Reset commands", () =>
    {
        render ( <Harness /> );

        expect ( screen.getByRole ( "heading", { name: "Event Sequences" } ) ).toBeTruthy ();
        expect ( screen.getByRole ( "heading", { name: "Events" } ) ).toBeTruthy ();
        expect ( screen.getByRole ( "heading", { name: "Transition Trace" } ) ).toBeTruthy ();
        expect ( screen.getByRole ( "heading", { name: "Action Trace" } ) ).toBeTruthy ();
        expect ( screen.getByRole ( "button", { name: "Run" } ) ).toBeTruthy ();
        expect ( screen.getByRole ( "button", { name: "Step" } ) ).toBeTruthy ();
        expect ( screen.getByRole ( "button", { name: "Reset" } ) ).toBeTruthy ();
    } );

    it ( "carries no State Machine summary region", () =>
    {
        render ( <Harness session={ createSession ( { currentState: "state_on", processedEventCount: 3 } ) } /> );

        expect ( screen.queryByRole ( "heading", { name: "State Machine" } ) ).toBeNull ();
        expect ( screen.queryByText ( REVISION ) ).toBeNull ();
        expect ( screen.queryByTitle ( REVISION ) ).toBeNull ();
    } );

    it ( "asks for a document before offering sequence editing", () =>
    {
        render (
            <SimulatorPage
                availability       = { ENABLED }
                draft              = { null }
                onCloseSession     = { () => undefined }
                onReset            = { () => undefined }
                onRun              = { () => undefined }
                onSequencesChange  = { () => undefined }
                onStartSession     = { () => undefined }
                onStep             = { () => undefined }
                onStepCursorChange = { () => undefined }
                session            = { null }
                stepCursor         = { 0 }
            />,
        );

        expect ( screen.getByText ( /Create or open a document/u ) ).toBeTruthy ();
    } );

} );


//--------------------------------------------------------------------------------------------------
// Function: traceRegion
//
// Description:
//
//   Derives the trace region.
//
// Parameters:
//
//   - heading:
//     The heading supplied to the operation.
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

function traceRegion ( heading: string ): HTMLElement
{
    // Return the computed result.

    return screen.getByRole ( "heading", { name: heading } ).parentElement as HTMLElement;
}


//--------------------------------------------------------------------------------------------------
// Function: sequenceRegion
//
// Description:
//
//   Derives the sequence region.
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

function sequenceRegion (): HTMLElement
{
    // Return the computed result.

    return screen.getByRole ( "heading", { name: "Event Sequences" } ).parentElement as HTMLElement;
}

describe ( "Simulator sequence library", () =>
{
    it ( "progressively renders large sequence and event lists", () =>
    {
        // Initialize the local values needed by this operation.

        const initialItemCount                        = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const sequences: readonly SimulatorSequence[] = Array.from (
            { length: initialItemCount + 50 },
            ( _, index ) => ( {
                description: "",
                name:        `sequence_${index}`,
                sequence:    index === 0
                    ? Array.from ( { length: initialItemCount + 50 }, ( _event, eventIndex ) => `event_${eventIndex}` )
                    : [],
            } ),
        );

        render ( <Harness sequences={ sequences } /> );


        // Initialize the local values needed by this operation.

        const sequenceList = screen.getByRole ( "listbox", { name: "Event Sequences" } );
        const eventList    = document.querySelector<HTMLSelectElement> ( ".simulator-event-list" );


        // Handle the case where event list matches an absent value.

        if ( eventList === null )
        {
            throw new Error ( "The Simulator event list was not rendered." );
        }

        expect ( sequenceList.querySelectorAll ( "option" ) ).toHaveLength ( initialItemCount );
        expect ( eventList.querySelectorAll ( "option" ) ).toHaveLength ( initialItemCount );


        // Process each list from the current value collection in order.

        for ( const list of [ sequenceList, eventList ] )
        {
            Object.defineProperties ( list,
                {
                    clientHeight: { configurable: true, value: 200 },
                    scrollHeight: { configurable: true, value: 2_000 },
                    scrollTop:    { configurable: true, value: 1_850 },
                }
            );
            fireEvent.scroll ( list );
        }

        expect ( sequenceList.querySelectorAll ( "option" ) ).toHaveLength ( sequences.length );
        expect ( eventList.querySelectorAll ( "option" ) ).toHaveLength ( sequences [ 0 ]?.sequence.length ?? 0 );
    } );

    it ( "adds a named sequence through the dialog as one change", async () =>
    {
        // Initialize the local values needed by this operation.

        const user              = userEvent.setup ();
        const onSequencesChange = vi.fn ();

        render ( <Harness onSequencesChange={ onSequencesChange } /> );
        await user.click ( within ( sequenceRegion () ).getByRole ( "button", { name: "Add" } ) );
        await user.clear ( screen.getByLabelText ( "Sequence Name" ) );
        await user.type ( screen.getByLabelText ( "Sequence Name" ), "negative_cases" );
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );

        expect ( onSequencesChange ).toHaveBeenCalledTimes ( 1 );
        expect ( onSequencesChange.mock.calls [ 0 ]?. [ 0 ] ).toHaveLength ( 2 );
        expect ( onSequencesChange.mock.calls [ 0 ]?. [ 0 ] [ 1 ].name ).toBe ( "negative_cases" );
    } );

    it ( "refuses a duplicate sequence name", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render ( <Harness /> );
        await user.click ( within ( sequenceRegion () ).getByRole ( "button", { name: "Add" } ) );
        await user.clear ( screen.getByLabelText ( "Sequence Name" ) );
        await user.type ( screen.getByLabelText ( "Sequence Name" ), "sequence_1" );

        expect ( screen.getByRole ( "alert" ).textContent ).toContain ( "already uses that name" );
        expect ( ( screen.getByRole ( "button", { name: "Confirm" } ) as HTMLButtonElement ).disabled ).toBe ( true );
    } );

    it ( "reorders and deletes sequences", async () =>
    {
        // Initialize the local values needed by this operation.

        const user              = userEvent.setup ();
        const onSequencesChange = vi.fn ();

        render (
            <Harness
                onSequencesChange = { onSequencesChange }
                sequences         = {
                    [
                        { description: "", name: "first", sequence: [] },
                        { description: "", name: "second", sequence: [] },
                    ]
                }
            />,
        );

        await user.click ( within ( sequenceRegion () ).getByRole ( "button", { name: /Move Down/u } ) );

        expect ( onSequencesChange.mock.calls [ 0 ]?. [ 0 ].map ( ( s: SimulatorSequence ) => s.name ) )
            .toEqual ( [ "second", "first" ] );

        await user.click ( within ( sequenceRegion () ).getByRole ( "button", { name: "Delete" } ) );

        expect ( onSequencesChange.mock.calls [ 1 ]?. [ 0 ].map ( ( s: SimulatorSequence ) => s.name ) )
            .toEqual ( [ "second" ] );
    } );
} );

describe ( "Simulator events editor", () =>
{
    it ( "deletes the sole event when the step cursor is past the exhausted buffer", async () =>
    {
        // Initialize the local values needed by this operation.

        const user              = userEvent.setup ();
        const onSequencesChange = vi.fn ();

        render ( <Harness initialStepCursor={ 1 } onSequencesChange={ onSequencesChange } /> );


        // Initialize the local values needed by this operation.

        const eventsRegion = screen.getByRole ( "heading", { name: "Events" } ).parentElement as HTMLElement;
        const deleteButton = within ( eventsRegion ).getByRole ( "button", { name: "Delete" } );

        expect ( ( deleteButton as HTMLButtonElement ).disabled ).toBe ( false );

        await user.click ( deleteButton );

        expect ( onSequencesChange ).toHaveBeenCalledTimes ( 1 );
        expect ( onSequencesChange.mock.calls [ 0 ]?. [ 0 ] [ 0 ].sequence ).toEqual ( [] );
    } );

    it ( "cleans blank lines and whitespace on commit while preserving order, duplicates, and case", async () =>
    {
        // Initialize the local values needed by this operation.

        const user              = userEvent.setup ();
        const onSequencesChange = vi.fn ();

        render ( <Harness onSequencesChange={ onSequencesChange } /> );

        const editor = screen.getByRole ( "textbox", { name: "Editor" } );

        await user.clear ( editor );
        await user.type ( editor, "  event_Go \n\n  event_go\t\n\nevent_Go\n  " );
        await user.tab ();

        expect ( onSequencesChange ).toHaveBeenCalledTimes ( 1 );
        expect ( onSequencesChange.mock.calls [ 0 ]?. [ 0 ] [ 0 ].sequence )
            .toEqual ( [ "event_Go", "event_go", "event_Go" ] );
    } );

    it ( "accepts undeclared event names typed directly", async () =>
    {
        // Initialize the local values needed by this operation.

        const user              = userEvent.setup ();
        const onSequencesChange = vi.fn ();

        render ( <Harness onSequencesChange={ onSequencesChange } /> );

        const editor = screen.getByRole ( "textbox", { name: "Editor" } );

        await user.clear ( editor );
        await user.type ( editor, "not_declared" );
        await user.tab ();

        expect ( onSequencesChange.mock.calls [ 0 ]?. [ 0 ] [ 0 ].sequence ).toEqual ( [ "not_declared" ] );
    } );

    it ( "submits the cleaned buffer to Run rather than the raw editor text", async () =>
    {
        // Initialize the local values needed by this operation.

        const user  = userEvent.setup ();
        const onRun = vi.fn ();

        render ( <Harness onRun={ onRun } /> );

        const editor = screen.getByRole ( "textbox", { name: "Editor" } );

        await user.clear ( editor );
        await user.type ( editor, "event_go\n\n   event_stop   \n" );
        await user.click ( screen.getByRole ( "button", { name: "Run" } ) );

        expect ( onRun ).toHaveBeenCalledWith ( [ "event_go", "event_stop" ] );
    } );

    it ( "inserts a declared event from the combobox", async () =>
    {
        // Initialize the local values needed by this operation.

        const user              = userEvent.setup ();
        const onSequencesChange = vi.fn ();

        render ( <Harness onSequencesChange={ onSequencesChange } /> );

        const eventsRegion = screen.getByRole ( "heading", { name: "Events" } ).parentElement as HTMLElement;

        await user.click ( within ( eventsRegion ).getByRole ( "button", { name: "Add" } ) );
        await user.selectOptions ( screen.getByLabelText ( "Event" ), "event_stop" );
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );

        expect ( onSequencesChange.mock.calls [ 0 ]?. [ 0 ] [ 0 ].sequence ).toEqual ( [ "event_go", "event_stop" ] );
    } );
} );

describe ( "Simulator commands", () =>
{
    it ( "disables Run, Step, and Reset and names every unmet precondition", () =>
    {
        // Initialize the local values needed by this operation.

        const availability = simulatorCommandAvailability (
            {
                documentOpen:       true,
                documentValid:      false,
                hostedRevision:     null,
                isOperationPending: false,
                isServerReady:      false,
            },
        );

        render ( <Harness availability={ availability } session={ null } /> );

        expect ( ( screen.getByRole ( "button", { name: "Run" } ) as HTMLButtonElement ).disabled ).toBe ( true );
        expect ( ( screen.getByRole ( "button", { name: "Step" } ) as HTMLButtonElement ).disabled ).toBe ( true );
        expect ( ( screen.getByRole ( "button", { name: "Reset" } ) as HTMLButtonElement ).disabled ).toBe ( true );

        const reasons = screen.getByRole ( "status" ).textContent ?? "";

        expect ( reasons ).toContain ( "validation errors" );
        expect ( reasons ).toContain ( "connected and ready" );
        expect ( reasons ).toContain ( "pushed to the server" );
    } );

    it ( "keeps Run and Step disabled until a session exists, then enables them", async () =>
    {
        // Initialize the local values needed by this operation.

        const { rerender } = render ( <Harness session={ null } /> );

        expect ( ( screen.getByRole ( "button", { name: "Run" } ) as HTMLButtonElement ).disabled ).toBe ( true );
        expect ( screen.getByRole ( "button", { name: "Start Session" } ) ).toBeTruthy ();

        rerender ( <Harness session={ createSession () } /> );

        expect ( ( await screen.findByRole ( "button", { name: "Run" } ) as HTMLButtonElement ).disabled )
            .toBe ( false );
        expect ( screen.getByRole ( "button", { name: "Close Session" } ) ).toBeTruthy ();
    } );

    it ( "submits at most the next unconsumed event to Step", async () =>
    {
        // Initialize the local values needed by this operation.

        const user   = userEvent.setup ();
        const onStep = vi.fn ();

        render (
            <Harness
                onStep    = { onStep }
                sequences = { [ { description: "", name: "s", sequence: [ "event_go", "event_stop" ] } ] }
            />,
        );

        await user.click ( screen.getByRole ( "button", { name: "Step" } ) );

        // The page hands the complete cleaned buffer to the shell, which slices the single event
        // for the request.

        expect ( onStep ).toHaveBeenCalledWith ( [ "event_go", "event_stop" ] );
    } );

    it ( "advances the events selection when the cursor moves", async () =>
    {
        // Initialize the local values needed by this operation.

        const user = userEvent.setup ();

        render (
            <Harness
                sequences={ [ { description: "", name: "s", sequence: [ "event_go", "event_stop" ] } ] }
            />,
        );

        const eventList = screen.getByRole ( "listbox", { name: "Buffer Position" } );

        await user.selectOptions ( eventList, "1" );

        expect ( ( eventList as HTMLSelectElement ).value ).toBe ( "1" );
        expect ( screen.getByRole ( "option", { name: /1\. event_go/u } ).textContent ).toContain ( "✓" );
    } );

    it ( "requests Reset and session lifecycle changes without executing anything locally", async () =>
    {
        // Initialize the local values needed by this operation.

        const user           = userEvent.setup ();
        const onReset        = vi.fn ();
        const onCloseSession = vi.fn ();

        render ( <Harness onCloseSession={ onCloseSession } onReset={ onReset } /> );
        await user.click ( screen.getByRole ( "button", { name: "Reset" } ) );
        await user.click ( screen.getByRole ( "button", { name: "Close Session" } ) );

        expect ( onReset ).toHaveBeenCalledTimes ( 1 );
        expect ( onCloseSession ).toHaveBeenCalledTimes ( 1 );
    } );
} );

describe ( "Simulator traces", () =>
{
    it ( "renders transition and action trace rows in execution order", () =>
    {
        render (
            <Harness
                session={ createSession (
                    {
                        actionTrace:
                        [
                            { action: "action_light_on", phase: "entry", state: "state_on" },
                            { action: "action_light_off", phase: "exit", state: "state_on" },
                        ],
                        transitionTrace:
                        [
                            {
                                destinationState: "state_on",
                                event:            "event_go",
                                outcome:          "TRANSITION",
                                sourceState:      "state_idle",
                            },
                            {
                                destinationState: "state_on",
                                event:            "event_unknown",
                                outcome:          "UNKNOWN_EVENT",
                                sourceState:      "state_on",
                            },
                        ],
                    },
                ) }
            />,
        );


        // Initialize the local values needed by this operation.

        const transitionRegion = screen.getByRole ( "heading", { name: "Transition Trace" } )
            .parentElement as HTMLElement;
        const rows = within ( transitionRegion ).getAllByRole ( "row" ).slice ( 1 );

        expect ( rows [ 0 ]?.textContent ).toContain ( "event_go" );
        expect ( rows [ 0 ]?.textContent ).toContain ( "Transition" );
        expect ( rows [ 1 ]?.textContent ).toContain ( "Unknown event" );


        // Initialize the local values needed by this operation.

        const actionRegion = screen.getByRole ( "heading", { name: "Action Trace" } ).parentElement as HTMLElement;
        const actionRows   = within ( actionRegion ).getAllByRole ( "row" ).slice ( 1 );

        expect ( actionRows [ 0 ]?.textContent ).toContain ( "action_light_on" );
        expect ( actionRows [ 0 ]?.textContent ).toContain ( "Entry" );
        expect ( actionRows [ 1 ]?.textContent ).toContain ( "Exit" );
    } );

    it ( "shows an empty trace rather than an empty table", () =>
    {
        render ( <Harness /> );

        expect ( screen.getAllByText ( "No entries." ) ).toHaveLength ( 2 );
    } );

    // Truncation and staleness are conditions the shell publishes to the Console. The page's
    // contract is that it says nothing about them itself, so what is asserted here is the absence,
    // not a relocated message.

    it ( "places no truncation, staleness, or warning message on the page", () =>
    {
        render (
            <Harness
                session={ createSession (
                    {
                        isStale:         true,
                        traceTruncated:  true,
                        transitionTrace:
                        [
                            {
                                destinationState: "state_on",
                                event:            "event_go",
                                outcome:          "TRANSITION",
                                sourceState:      "state_idle",
                            },
                        ],
                    },
                ) }
            />,
        );

        expect ( screen.queryByText ( /retention bound/u ) ).toBeNull ();
        expect ( screen.queryByText ( /superseded revision/u ) ).toBeNull ();
        expect ( screen.queryByRole ( "heading", { name: "Warnings" } ) ).toBeNull ();
    } );

    // The reasons for disabled commands are enablement affordances rather than messages, so they
    // stay.

    it ( "keeps the reasons for disabled commands on the page", () =>
    {
        render (
            <Harness
                availability={ simulatorCommandAvailability ( {
                    documentOpen:       false,
                    documentValid:      false,
                    hostedRevision:     null,
                    isOperationPending: false,
                    isServerReady:      false,
                } ) }
                session={ null }
            />,
        );

        expect ( screen.getByText ( /Run, Step, and Reset are unavailable/u ) ).toBeTruthy ();
        expect ( screen.getByText ( /a document is created or opened/u ) ).toBeTruthy ();
    } );

    // A trace holds up to 50,000 entries. The scroll range must cover every one of them while the
    // DOM holds only the interval the scroll position selects, so the reported row count and the
    // rendered row count deliberately differ.

    it ( "windows a long trace while exposing its whole length", () =>
    {
        // Initialize the local values needed by this operation.

        const entryCount = 5_000;

        render (
            <Harness
                session={ createSession ( {
                    transitionTrace: Array.from ( { length: entryCount }, ( _unused, index ) => ( {
                        destinationState: `state_${index + 1}`,
                        event:            `event_${index}`,
                        outcome:          "TRANSITION" as const,
                        sourceState:      `state_${index}`,
                    } ) ),
                } ) }
            />,
        );

        const table = within ( traceRegion ( "Transition Trace" ) ).getByRole ( "table" );

        expect ( table.getAttribute ( "aria-rowcount" ) ).toBe ( String ( entryCount + 1 ) );

        const renderedRows = within ( table ).getAllByRole ( "row" ).length;

        expect ( renderedRows ).toBeLessThan ( 100 );
        expect ( renderedRows ).toBeGreaterThan ( 1 );
    } );

    it ( "gives both traces the same column count as their headings", () =>
    {
        render (
            <Harness
                session={ createSession ( {
                    actionTrace:     [ { action: "action_on", phase: "entry", state: "state_on" } ],
                    transitionTrace:
                    [
                        {
                            destinationState: "state_on",
                            event:            "event_go",
                            outcome:          "TRANSITION",
                            sourceState:      "state_idle",
                        },
                    ],
                } ) }
            />,
        );


        // Initialize the local values needed by this operation.

        const transitionRows = within ( traceRegion ( "Transition Trace" ) ).getAllByRole ( "row" );
        const actionRows     = within ( traceRegion ( "Action Trace" ) ).getAllByRole ( "row" );

        expect ( within ( transitionRows [ 0 ] as HTMLElement ).getAllByRole ( "columnheader" ) ).toHaveLength ( 4 );
        expect ( within ( transitionRows [ 1 ] as HTMLElement ).getAllByRole ( "cell" ) ).toHaveLength ( 4 );
        expect ( within ( actionRows [ 0 ] as HTMLElement ).getAllByRole ( "columnheader" ) ).toHaveLength ( 3 );
        expect ( within ( actionRows [ 1 ] as HTMLElement ).getAllByRole ( "cell" ) ).toHaveLength ( 3 );
    } );
} );

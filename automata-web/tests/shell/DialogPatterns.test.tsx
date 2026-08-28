// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Dialog Pattern Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the message, named-entity, selection, dirty-replacement, and Solver-replacement modal
//   contracts.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import rawReleaseNotes from "../../public/release-notes.txt?raw";
import { COMPILE_TIME_CONFIGURATION } from "../../src/configuration/compile-time-configuration.js";
import {
    MAXIMUM_EVENT_COUNT,
    MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_SEQUENCE_COUNT,
    MAXIMUM_STATE_COUNT,
} from "../../src/domain/model/limits.js";
import {
    AboutDialog,
    DirtyReplacementDialog,
    ImpactConfirmationDialog,
    IncompleteDocumentWarningDialog,
    MessageDialog,
    NamedEntityDialog,
    SelectionDialog,
    SimulatorEventDialog,
    SimulatorSequenceCsvDialog,
    SolverSequenceCsvDialog,
    SolverReplacementDialog,
    TransitionCsvReferenceDialog,
    TransitionDialog,
} from "../../src/presentation/dialogs/DialogPatterns";

const expectedReleaseNotes = rawReleaseNotes.replaceAll ( "\r\n", "\n" );

describe ( "AL-DLG-001 shared dialog patterns", () =>
{
    afterEach ( () =>
    {
        cleanup ();
        vi.restoreAllMocks ();
    } );

    it ( "aligns every modal value column to its longest visible field label plus ten percent", () =>
    {
        vi.spyOn ( HTMLElement.prototype, "getBoundingClientRect" ).mockImplementation ( function (
            this: HTMLElement,
        )
        {
            // Calculate the width value from the current inputs.

            const width = this.classList.contains ( "form-field-label-text" )
                ? ( this.textContent?.length ?? 0 ) * 10
                : 0;

            // Return the assembled result.

            return {
                bottom: 0,
                height: 0,
                left: 0,
                right: width,
                toJSON: () => ( {} ),
                top: 0,
                width,
                x: 0,
                y: 0,
            };
        } );

        render (
            <NamedEntityDialog
                initialValue = { { description: "", name: "" } }
                onClose      = { vi.fn () }
                onConfirm    = { vi.fn () }
                open         = { true }
            />,
        );

        expect ( screen.getByRole ( "dialog", { name: "Named entity" } ).style.getPropertyValue (
            "--form-label-column-width",
        ) ).toBe ( `${Math.ceil ( "Description".length * 10 *
            COMPILE_TIME_CONFIGURATION.dialog.formLayout.labelColumnMarginFactor )}px` );
    } );

    it ( "opens About on Licences and exposes the shipped Release Notes tab", async () =>
    {
        // Initialize the local values needed by this operation.

        const user      = userEvent.setup ();
        const close     = vi.fn ();
        const rendering = render ( <AboutDialog onClose={ close } open={ true } /> );
        const dialog    = screen.getByRole ( "dialog", { name: "About Automata Lab" } );
        const licences  = within ( dialog ).getByRole ( "tab", { name: "Licences" } );
        const notes     = within ( dialog ).getByRole ( "tab", { name: "Release Notes" } );

        expect ( within ( dialog ).getByText ( "Version 1.1.0" ) ).toBeVisible ();
        expect ( licences ).toHaveAttribute ( "aria-selected", "true" );
        expect ( notes ).toHaveAttribute ( "aria-selected", "false" );
        expect ( within ( dialog ).getAllByRole ( "textbox" ) ).toHaveLength ( 2 );
        expect ( within ( dialog ).queryByText ( "Third-Party Runtime Notices" ) ).not.toBeInTheDocument ();

        await user.click ( notes );

        expect ( notes ).toHaveAttribute ( "aria-selected", "true" );

        const releaseNotes = within ( dialog ).getByRole ( "textbox", { name: "Release Notes" } );

        expect ( releaseNotes ).toHaveAttribute ( "readonly" );
        expect ( releaseNotes ).toHaveValue ( expectedReleaseNotes );

        await user.click ( within ( dialog ).getByRole ( "button", { name: "Close" } ) );
        expect ( close ).toHaveBeenCalledOnce ();

        rendering.rerender ( <AboutDialog onClose={ close } open={ false } /> );
        rendering.rerender ( <AboutDialog onClose={ close } open={ true } /> );
        expect ( within ( dialog ).getByRole ( "tab", { name: "Licences" } ) )
            .toHaveAttribute ( "aria-selected", "true" );
    } );

    it ( "acknowledges severity messages and closes", async () =>
    {
        // Initialize the local values needed by this operation.

        const user        = userEvent.setup ();
        const acknowledge = vi.fn ();
        const close       = vi.fn ();

        render (
            <MessageDialog
                body          = "The model is valid."
                onAcknowledge = { acknowledge }
                onClose       = { close }
                open          = { true }
                severity      = "message"
            />
        );

        expect ( screen.getByRole ( "dialog", { name: "Message" } ) ).toBeVisible ();
        await user.click ( screen.getByRole ( "button", { name: "OK" } ) );
        expect ( acknowledge ).toHaveBeenCalledOnce ();
        expect ( close ).toHaveBeenCalledOnce ();
    } );

    it ( "lists incomplete requirements before confirming a warning-gated Save", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const close      = vi.fn ();
        const saveAnyway = vi.fn ();

        render (
            <IncompleteDocumentWarningDialog
                diagnostics={
                    [
                        {
                            code:        "STATE_DEFINITIONS_MISSING",
                            message:     "The state machine does not define any states.",
                            remediation: "Add at least one state before hosting or running the model.",
                            severity:    "warning",
                            source:      "model",
                        },
                        {
                            code:        "INITIAL_STATE_UNDEFINED",
                            message:     "The state machine does not define an initial state.",
                            remediation: "Select an initial state before hosting or running the model.",
                            severity:    "warning",
                            source:      "model",
                        },
                    ]
                }
                mode         = "save"
                onClose      = { close }
                onSaveAnyway = { saveAnyway }
                open         = { true }
            />,
        );

        const dialog = screen.getByRole ( "dialog", { name: "Save incomplete project?" } );

        expect ( dialog ).toHaveTextContent ( "The state machine does not define any states." );
        expect ( dialog ).toHaveTextContent ( "The state machine does not define an initial state." );
        await user.click ( screen.getByRole ( "button", { name: "Save Anyway" } ) );
        expect ( saveAnyway ).toHaveBeenCalledOnce ();
        expect ( close ).not.toHaveBeenCalled ();
    } );

    it ( "acknowledges incomplete requirements after Open", async () =>
    {
        // Initialize the local values needed by this operation.

        const user  = userEvent.setup ();
        const close = vi.fn ();

        render (
            <IncompleteDocumentWarningDialog
                diagnostics={
                    [
                        {
                            code:        "INITIAL_STATE_UNDEFINED",
                            message:     "The state machine does not define an initial state.",
                            remediation: "Select an initial state before hosting or running the model.",
                            severity:    "warning",
                            source:      "model",
                        },
                    ]
                }
                mode    = "open"
                onClose = { close }
                open    = { true }
            />,
        );

        expect ( screen.getByRole ( "dialog", { name: "Incomplete project opened" } ) )
            .toHaveTextContent ( "The state machine does not define an initial state." );
        expect ( screen.queryByRole ( "button", { name: "Save Anyway" } ) ).not.toBeInTheDocument ();
        await user.click ( screen.getByRole ( "button", { name: "OK" } ) );
        expect ( close ).toHaveBeenCalledOnce ();
    } );

    it ( "shows missing Transition Table states above missing events in selectable text areas", () =>
    {
        render (
            <TransitionCsvReferenceDialog
                missingEvents = { [ "event_missing_two", "event_missing_one" ] }
                missingStates = { [ "state_missing_one", "state_missing_two" ] }
                onClose       = { vi.fn () }
                open          = { true }
            />,
        );

        // Initialize the local values needed by this operation.

        const dialog    = screen.getByRole ( "dialog", { name: "Missing Transition Table references" } );
        const textAreas = within ( dialog ).getAllByRole ( "textbox" );

        expect ( textAreas ).toHaveLength ( 2 );
        expect ( textAreas [ 0 ] ).toHaveAccessibleName ( "Missing States" );
        expect ( textAreas [ 0 ] ).toHaveValue ( "state_missing_one\nstate_missing_two" );
        expect ( textAreas [ 0 ] ).toHaveAttribute ( "readonly" );
        expect ( textAreas [ 1 ] ).toHaveAccessibleName ( "Missing Events" );
        expect ( textAreas [ 1 ] ).toHaveValue ( "event_missing_two\nevent_missing_one" );
        expect ( textAreas [ 1 ] ).toHaveAttribute ( "readonly" );
    } );

    it ( "validates and trims named entities before confirming", async () =>
    {
        // Initialize the local values needed by this operation.

        const user    = userEvent.setup ();
        const confirm = vi.fn ();

        render (
            <NamedEntityDialog
                initialValue = { { description: "", name: "" } }
                onClose      = { vi.fn () }
                onConfirm    = { confirm }
                open         = { true }
            />
        );

        const confirmButton = screen.getByRole ( "button", { name: "Confirm" } );

        expect ( confirmButton ).toBeDisabled ();
        await user.type ( screen.getByRole ( "textbox", { name: "Name" } ), "  Ready  " );
        await user.click ( confirmButton );
        expect ( confirm ).toHaveBeenCalledWith ( { description: "", name: "Ready" } );
    } );

    it ( "requires an explicit selection and returns its stable identifier", async () =>
    {
        // Initialize the local values needed by this operation.

        const user    = userEvent.setup ();
        const confirm = vi.fn ();

        render (
            <SelectionDialog
                onClose   = { vi.fn () }
                onConfirm = { confirm }
                open      = { true }
                options   = { [ { identifier: "ready", label: "Ready" } ] }
            />
        );

        const confirmButton = screen.getByRole ( "button", { name: "Confirm" } );

        expect ( confirmButton ).toBeDisabled ();
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Existing entity" } ), "ready" );
        await user.click ( confirmButton );
        expect ( confirm ).toHaveBeenCalledWith ( "ready" );
    } );

    it ( "bounds and searches a large generic selection before confirming an item past the first batch", async () =>
    {
        // Initialize the local values needed by this operation.

        const user             = userEvent.setup ();
        const confirm          = vi.fn ();
        const initialItemCount = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const optionCount      = MAXIMUM_STATE_COUNT;

        render (
            <SelectionDialog
                onClose   = { vi.fn () }
                onConfirm = { confirm }
                open      = { true }
                options   = { Array.from ( { length: optionCount }, ( _, index ) => ( {
                    identifier: `entity-${index}`,
                    label:      `Entity ${index}`,
                } ) ) }
            />
        );

        const selection = screen.getByRole ( "combobox", { name: "Existing entity" } );

        expect ( within ( selection ).getAllByRole ( "option" ) ).toHaveLength ( initialItemCount + 1 );
        await user.type (
            screen.getByRole ( "searchbox", { name: "Search options: Existing entity" } ),
            `Entity ${optionCount - 1}`,
        );
        expect ( within ( selection ).getAllByRole ( "option" ) ).toHaveLength ( 2 );

        await user.selectOptions ( selection, `entity-${optionCount - 1}` );
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );

        expect ( confirm ).toHaveBeenCalledWith ( `entity-${optionCount - 1}` );
    } );

    it ( "keeps large transition fields bounded, searchable, and keyboard navigable", async () =>
    {
        // Initialize the local values needed by this operation.

        const user             = userEvent.setup ();
        const confirm          = vi.fn ( () => true );
        const initialItemCount = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const states           = Array.from ( { length: MAXIMUM_STATE_COUNT }, ( _, index ) => `state_${index}` );
        const events           = Array.from ( { length: MAXIMUM_EVENT_COUNT }, ( _, index ) => `event_${index}` );

        render (
            <TransitionDialog
                events       = { events }
                initialValue = { { state: states [ 0 ] ?? "", event: events [ 0 ] ?? "", stateNext: states [ 0 ] ?? "" } }
                onClose      = { vi.fn () }
                onConfirm    = { confirm }
                open         = { true }
                states       = { states }
            />,
        );

        // Initialize the local values needed by this operation.

        const dialog             = screen.getByRole ( "dialog", { name: "Transition" } );
        const stateSelection     = within ( dialog ).getByRole ( "combobox", { name: "State" } );
        const eventSelection     = within ( dialog ).getByRole ( "combobox", { name: "Event" } );
        const nextStateSelection = within ( dialog ).getByRole ( "combobox", { name: "Next State" } );

        expect ( within ( stateSelection ).getAllByRole ( "option" ) ).toHaveLength ( initialItemCount + 1 );
        expect ( within ( eventSelection ).getAllByRole ( "option" ) ).toHaveLength ( initialItemCount + 1 );
        expect ( within ( nextStateSelection ).getAllByRole ( "option" ) ).toHaveLength ( initialItemCount + 1 );

        stateSelection.focus ();
        await user.keyboard ( "{End}" );
        expect ( stateSelection ).toHaveValue ( states.at ( -1 ) );

        await user.type (
            within ( dialog ).getByRole ( "searchbox", { name: "Search options: Event" } ),
            events.at ( -1 ) ?? "",
        );
        await user.selectOptions ( eventSelection, events.at ( -1 ) ?? "" );
        await user.type (
            within ( dialog ).getByRole ( "searchbox", { name: "Search options: Next State" } ),
            states.at ( -2 ) ?? "",
        );
        await user.selectOptions ( nextStateSelection, states.at ( -2 ) ?? "" );
        await user.click ( within ( dialog ).getByRole ( "button", { name: "Confirm" } ) );

        expect ( confirm ).toHaveBeenCalledWith ( {
            event:     events.at ( -1 ),
            state:     states.at ( -1 ),
            stateNext: states.at ( -2 ),
        } );
    } );

    it ( "searches bounded Solver and Simulator exports and event selections past their first batch", async () =>
    {
        // Initialize the local values needed by this operation.

        const user             = userEvent.setup ();
        const initialItemCount = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const solverConfirm    = vi.fn ();
        const simulatorConfirm = vi.fn ();
        const eventConfirm     = vi.fn ();
        const solverSequences  = Array.from ( { length: MAXIMUM_SOLVER_SEQUENCE_COUNT }, ( _, index ) => ( {
            description:  "",
            name:         `solver_sequence_${index}`,
            sequence:     [ "event_go" ],
            startContext: "infer" as const,
        } ) );
        const simulatorSequences = Array.from ( { length: MAXIMUM_SIMULATOR_SEQUENCE_COUNT }, ( _, index ) => ( {
            description: "",
            name:        `simulator_sequence_${index}`,
            sequence:    [ "event_go" ],
        } ) );
        const eventNames = Array.from ( { length: MAXIMUM_EVENT_COUNT }, ( _, index ) => `event_${index}` );
        const rendering  = render (
            <SolverSequenceCsvDialog
                mode      = "export"
                onClose   = { vi.fn () }
                onConfirm = { solverConfirm }
                open      = { true }
                sequences = { solverSequences }
            />,
        );

        let selection = screen.getByRole ( "combobox", { name: "Sequence Name" } );

        expect ( within ( selection ).getAllByRole ( "option" ) ).toHaveLength ( initialItemCount );
        await user.type (
            screen.getByRole ( "searchbox", { name: "Search options: Sequence Name" } ),
            `solver_sequence_${MAXIMUM_SOLVER_SEQUENCE_COUNT - 1}`,
        );
        await user.selectOptions ( selection, `solver_sequence_${MAXIMUM_SOLVER_SEQUENCE_COUNT - 1}` );
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );
        expect ( solverConfirm ).toHaveBeenCalledWith ( `solver_sequence_${MAXIMUM_SOLVER_SEQUENCE_COUNT - 1}` );

        rendering.rerender (
            <SimulatorSequenceCsvDialog
                mode      = "export"
                onClose   = { vi.fn () }
                onConfirm = { simulatorConfirm }
                open      = { true }
                sequences = { simulatorSequences }
            />,
        );
        selection = screen.getByRole ( "combobox", { name: "Sequence Name" } );
        expect ( within ( selection ).getAllByRole ( "option" ) ).toHaveLength ( initialItemCount );
        await user.type (
            screen.getByRole ( "searchbox", { name: "Search options: Sequence Name" } ),
            `simulator_sequence_${MAXIMUM_SIMULATOR_SEQUENCE_COUNT - 1}`,
        );
        await user.selectOptions ( selection, `simulator_sequence_${MAXIMUM_SIMULATOR_SEQUENCE_COUNT - 1}` );
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );
        expect ( simulatorConfirm ).toHaveBeenCalledWith (
            `simulator_sequence_${MAXIMUM_SIMULATOR_SEQUENCE_COUNT - 1}`,
        );

        rendering.rerender (
            <SimulatorEventDialog
                eventNames = { eventNames }
                onClose    = { vi.fn () }
                onConfirm  = { eventConfirm }
                open       = { true }
            />,
        );
        selection = screen.getByRole ( "combobox", { name: "Event" } );
        expect ( within ( selection ).getAllByRole ( "option" ) ).toHaveLength ( initialItemCount );
        await user.type (
            screen.getByRole ( "searchbox", { name: "Search options: Event" } ),
            `event_${MAXIMUM_EVENT_COUNT - 1}`,
        );
        await user.selectOptions ( selection, `event_${MAXIMUM_EVENT_COUNT - 1}` );
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );
        expect ( eventConfirm ).toHaveBeenCalledWith ( `event_${MAXIMUM_EVENT_COUNT - 1}` );
    } );

    it ( "keeps a transition dialog open when its command is rejected", async () =>
    {
        // Initialize the local values needed by this operation.

        const user    = userEvent.setup ();
        const close   = vi.fn ();
        const confirm = vi.fn ( () => false );

        render (
            <TransitionDialog
                events       = { [ "event_go" ] }
                initialValue = { { state: "state_one", event: "event_go", stateNext: "state_two" } }
                onClose      = { close }
                onConfirm    = { confirm }
                open         = { true }
                states       = { [ "state_one", "state_two" ] }
            />,
        );

        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );

        expect ( confirm ).toHaveBeenCalledOnce ();
        expect ( close ).not.toHaveBeenCalled ();
        expect ( screen.getByRole ( "dialog", { name: "Transition" } ) ).toBeVisible ();
    } );

    it ( "edits only semantic transition fields without presentation routing controls", async () =>
    {
        // Initialize the local values needed by this operation.

        const user    = userEvent.setup ();
        const confirm = vi.fn ( () => true );

        render (
            <TransitionDialog
                events       = { [ "event_go" ] }
                initialValue = { { state: "state_one", event: "event_go", stateNext: "state_two" } }
                onClose      = { vi.fn () }
                onConfirm    = { confirm }
                open         = { true }
                states       = { [ "state_one", "state_two" ] }
            />,
        );

        expect ( screen.queryByRole ( "combobox", { name: "Connection routing" } ) ).not.toBeInTheDocument ();
        expect ( screen.queryByRole ( "combobox", { name: "Source side" } ) ).not.toBeInTheDocument ();
        expect ( screen.queryByRole ( "combobox", { name: "Target side" } ) ).not.toBeInTheDocument ();
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );

        expect ( confirm ).toHaveBeenCalledWith ( {
            state: "state_one",
            event: "event_go",
            stateNext: "state_two",
        } );
    } );

    it ( "counts Chart references and initially focuses the deletion confirmation", async () =>
    {
        // Initialize the local values needed by this operation.

        const user    = userEvent.setup ();
        const confirm = vi.fn ();

        render (
            <ImpactConfirmationDialog
                impact={ {
                    declarationCount: 0,
                    initialStateReferenceCount: 0,
                    actionMappingCount: 0,
                    transitionCount: 0,
                    chartStatePlacementCount: 0,
                    chartDraftTransitionCount: 0,
                    chartTerminalIndicatorCount: 2,
                    chartTerminalRelationCount: 1,
                    chartInitialIndicatorCount: 0,
                    solverTokenReferenceCount: 0,
                    simulatorEventReferenceCount: 0,
                } }
                onClose   = { vi.fn () }
                onConfirm = { confirm }
                open      = { true }
            />,
        );

        expect ( screen.getByText (
            "This command removes the selected items and every listed dependent reference as one undoable change.",
        ) ).toBeVisible ();

        const chartReferences = screen.getByText ( "Chart references" ).closest ( "div" );

        expect ( chartReferences ).not.toBeNull ();

        // Handle the case where chart references differs from an absent value.

        if ( chartReferences !== null )
        {
            expect ( within ( chartReferences ).getByText ( "3" ) ).toBeVisible ();
        }

        expect ( screen.getByRole ( "button", { name: "Delete" } ) ).toHaveFocus ();
        await user.keyboard ( "{Enter}" );
        expect ( confirm ).toHaveBeenCalledOnce ();
    } );

    it ( "offers only valid dirty-document outcomes and an explicit Solver replacement", async () =>
    {
        // Initialize the local values needed by this operation.

        const user    = userEvent.setup ();
        const discard = vi.fn ();
        const replace = vi.fn ();
        const { rerender } = render (
            <DirtyReplacementDialog
                canSave           = { false }
                onClose           = { vi.fn () }
                onDiscardContinue = { discard }
                onSaveContinue    = { vi.fn () }
                open              = { true }
            />
        );

        expect ( screen.queryByRole ( "button", { name: "Save and Continue" } ) ).not.toBeInTheDocument ();
        await user.click ( screen.getByRole ( "button", { name: "Discard and Continue" } ) );
        expect ( discard ).toHaveBeenCalledOnce ();

        rerender (
            <SolverReplacementDialog
                candidateSummary = "3 states, 2 events, 4 transitions"
                onClose          = { vi.fn () }
                onReplace        = { replace }
                open             = { true }
            />
        );

        expect ( screen.getByText ( "3 states, 2 events, 4 transitions" ) ).toBeVisible ();
        await user.click ( screen.getByRole ( "button", { name: "Replace State Machine" } ) );
        expect ( replace ).toHaveBeenCalledOnce ();
    } );
} );

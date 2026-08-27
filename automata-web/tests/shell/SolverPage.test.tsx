// @vitest-environment jsdom

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Page Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies keyboard-accessible observation editing, validation, candidate review navigation,
//   stale Apply, and discard.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSolverWorkspaceState } from "../../src/application/solver-workspace.js";
import { COMPILE_TIME_CONFIGURATION } from "../../src/configuration/compile-time-configuration.js";
import type { AuthoringDraft, SolverCandidate, SolverSequence } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { inferSolverCandidate } from "../../src/domain/solver/inference.js";
import { SolverPage } from "../../src/presentation/solver/SolverPage.js";

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

function createDraft ()
{
    // Initialize the local values needed by this operation.

    const draft = createEmptyAuthoringDraft ( true );

    // Return the assembled result.

    return {
        ...draft,
        solver:
        {
            sequences:
            [
                {
                    name: "initial",
                    description: "",
                    startContext: "initial" as const,
                    sequence: [ "state_ready", "event_finish", "state_done" ],
                },
                {
                    name: "fragment",
                    description: "",
                    startContext: "continuation" as const,
                    sequence: [ "state_ready", "event_tick", "state_ready" ],
                },
            ],
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: ControlledSolverPage
//
// Description:
//
//   Renders the controlled solver page interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered controlled solver page interface.
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

function ControlledSolverPage ( properties: { readonly onSequencesChange: ( sequences: readonly SolverSequence[] ) => void } )
{
    // Initialize the local values needed by this operation.

    const [ draft, setDraft ] = useState<AuthoringDraft> ( createDraft () );

    // Return the rendered interface.

    return (
        <SolverPage
            chartNameWrapping  = { { actionNames: false, eventNames: false, stateNames: false } }
            draft              = { draft }
            onApplyCandidate   = { vi.fn () }
            onCancelSolve      = { vi.fn () }
            onDiscardCandidate = { vi.fn () }
            onSequencesChange  = { sequences =>
            {
                properties.onSequencesChange ( sequences );
                setDraft ( currentDraft => ( { ...currentDraft, solver: { sequences } } ) );
            } }
            onSolve         = { vi.fn () }
            onValidate      = { vi.fn () }
            solverWorkspace = { createSolverWorkspaceState () }
        />
    );
}

describe ( "Solver page", () =>
{
    it ( "progressively renders a large saved-observation library", () =>
    {
        // Initialize the local values needed by this operation.

        const initialItemCount      = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const baseDraft             = createEmptyAuthoringDraft ( true );
        const draft: AuthoringDraft = 
        {
            ...baseDraft,
            solver:
            {
                sequences: Array.from ( { length: initialItemCount + 50 }, ( _, index ) => ( {
                    description:  "",
                    name:         `observation_${index}`,
                    sequence:     [],
                    startContext: "infer" as const,
                } ) ),
            },
        };

        render (
            <SolverPage
                chartNameWrapping  = { { actionNames: false, eventNames: false, stateNames: false } }
                draft              = { draft }
                onApplyCandidate   = { vi.fn () }
                onCancelSolve      = { vi.fn () }
                onDiscardCandidate = { vi.fn () }
                onSequencesChange  = { vi.fn () }
                onSolve            = { vi.fn () }
                onValidate         = { vi.fn () }
                solverWorkspace    = { createSolverWorkspaceState () }
            />,
        );

        const sequenceList = screen.getByRole ( "listbox", { name: "Sample Sequences" } );

        expect ( sequenceList.querySelectorAll ( "option" ) ).toHaveLength ( initialItemCount );
        Object.defineProperties ( sequenceList,
            {
                clientHeight: { configurable: true, value: 200 },
                scrollHeight: { configurable: true, value: 2_000 },
                scrollTop:    { configurable: true, value: 1_850 },
            }
        );
        fireEvent.scroll ( sequenceList );

        expect ( sequenceList.querySelectorAll ( "option" ) ).toHaveLength ( draft.solver.sequences.length );
    } );

    it ( "progressively renders a keyboard-reachable large validation-diagnostic list", () =>
    {
        // Initialize the local values needed by this operation.

        const initialItemCount      = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const baseDraft             = createEmptyAuthoringDraft ( true );
        const stateTokenCount       = initialItemCount + 51;
        const draft: AuthoringDraft = 
        {
            ...baseDraft,
            solver:
            {
                sequences:
                [
                    {
                        description:  "",
                        name:         "many-conflicts",
                        sequence:     Array.from ( { length: stateTokenCount }, ( _, index ) => `state_${index}` ),
                        startContext: "infer",
                    },
                ],
            },
        };

        const rendering = render (
            <SolverPage
                chartNameWrapping  = { { actionNames: false, eventNames: false, stateNames: false } }
                draft              = { draft }
                onApplyCandidate   = { vi.fn () }
                onCancelSolve      = { vi.fn () }
                onDiscardCandidate = { vi.fn () }
                onSequencesChange  = { vi.fn () }
                onSolve            = { vi.fn () }
                onValidate         = { vi.fn () }
                solverWorkspace    = { createSolverWorkspaceState () }
            />,
        );
        const diagnosticList = rendering.container.querySelector<HTMLElement> ( ".solver-token-errors" );

        expect ( diagnosticList ).not.toBeNull ();
        expect ( diagnosticList ).toHaveAccessibleName ( "Sequence validation diagnostics" );
        expect ( diagnosticList ).toHaveAttribute ( "tabindex", "0" );
        expect ( diagnosticList?.querySelectorAll ( "li" ) ).toHaveLength ( initialItemCount );

        // Handle the case where diagnostic list differs from an absent value.

        if ( diagnosticList !== null )
        {
            diagnosticList.focus ();
            fireEvent.keyDown ( diagnosticList, { key: "PageDown" } );
        }

        expect ( diagnosticList ).toHaveFocus ();
        expect ( diagnosticList?.querySelectorAll ( "li" ) ).toHaveLength ( stateTokenCount - 1 );
    } );

    it ( "edits saved observations and reports validation without mutating a candidate", async () =>
    {
        // Initialize the local values needed by this operation.

        const user              = userEvent.setup ();
        const draft             = createDraft ();
        const onSequencesChange = vi.fn ();
        const onValidate        = vi.fn ();

        render (
            <SolverPage
                chartNameWrapping  = { { actionNames: false, eventNames: false, stateNames: false } }
                draft              = { draft }
                onApplyCandidate   = { vi.fn () }
                onCancelSolve      = { vi.fn () }
                onDiscardCandidate = { vi.fn () }
                onSequencesChange  = { onSequencesChange }
                onSolve            = { vi.fn () }
                onValidate         = { onValidate }
                solverWorkspace    = { createSolverWorkspaceState () }
            />,
        );

        expect ( screen.getByRole ( "heading", { name: "Sample Sequences" } ) ).toBeVisible ();
        const sequenceList = screen.getByRole ( "listbox", { name: "Sample Sequences" } );

        expect ( screen.getByRole ( "button", { name: "Move Up" } ) ).toBeDisabled ();
        expect ( screen.getByRole ( "button", { name: "Move Down" } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "button", { name: /^Add$/u } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "button", { name: /^Delete$/u } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "button", { name: /^Edit$/u } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "separator", { name: "Resize Sample Sequences" } ) )
            .toHaveAttribute ( "aria-orientation", "vertical" );
        expect ( Array.from ( document.querySelectorAll ( ".solver-page-command-bar button" ) )
            .map ( button => button.textContent ) ).toEqual (
            [ "Validate Sequences", "Solve" ],
        );

        await user.selectOptions ( sequenceList, "1" );

        expect ( screen.getByRole ( "button", { name: "Move Up" } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "button", { name: "Move Down" } ) ).toBeDisabled ();

        const editor = screen.getByRole ( "textbox", { name: "Sequence" } );

        expect ( editor ).toHaveValue ( "state_ready\nevent_tick\nstate_ready" );
        await user.click ( screen.getByRole ( "button", { name: "Validate Sequences" } ) );
        expect ( onValidate ).toHaveBeenCalledTimes ( 1 );
        expect ( onSequencesChange ).not.toHaveBeenCalled ();
    } );

    it ( "restores sequence reordering, addition, deletion, and metadata editing", async () =>
    {
        // Initialize the local values needed by this operation.

        const user              = userEvent.setup ();
        const draft             = createDraft ();
        const onSequencesChange = vi.fn ();

        const rendering = render ( <ControlledSolverPage onSequencesChange={ onSequencesChange } /> );
        const page      = within ( rendering.container );

        await user.click ( page.getByRole ( "button", { name: "Move Down" } ) );
        expect ( onSequencesChange ).toHaveBeenLastCalledWith ( [
            draft.solver.sequences [ 1 ],
            draft.solver.sequences [ 0 ],
        ] );

        await user.click ( page.getByRole ( "button", { name: /^Add$/u } ) );
        await user.clear ( page.getByLabelText ( "Sequence Name" ) );
        await user.type ( page.getByLabelText ( "Sequence Name" ), "initial" );
        expect ( page.getByText ( /already uses that name/iu ) ).toBeVisible ();
        expect ( page.getByRole ( "button", { name: "Confirm" } ) ).toBeDisabled ();
        await user.clear ( page.getByLabelText ( "Sequence Name" ) );
        await user.type ( page.getByLabelText ( "Sequence Name" ), "new-observation" );
        await user.selectOptions ( page.getByLabelText ( "Start Context" ), "initial" );
        await user.click ( page.getByRole ( "button", { name: "Confirm" } ) );
        expect ( onSequencesChange ).toHaveBeenLastCalledWith ( [
            draft.solver.sequences [ 1 ],
            draft.solver.sequences [ 0 ],
            { description: "", name: "new-observation", sequence: [], startContext: "initial" },
        ] );

        await user.click ( page.getByRole ( "button", { name: /^Edit$/u } ) );
        await user.clear ( page.getByLabelText ( "Sequence Name" ) );
        await user.type ( page.getByLabelText ( "Sequence Name" ), "renamed-observation" );
        await user.selectOptions ( page.getByLabelText ( "Start Context" ), "infer" );
        await user.click ( page.getByRole ( "button", { name: "Confirm" } ) );
        expect ( onSequencesChange ).toHaveBeenLastCalledWith ( [
            draft.solver.sequences [ 1 ],
            draft.solver.sequences [ 0 ],
            { description: "", name: "renamed-observation", sequence: [], startContext: "infer" },
        ] );

        await user.click ( page.getByRole ( "button", { name: /^Delete$/u } ) );
        expect ( onSequencesChange ).toHaveBeenLastCalledWith ( [
            draft.solver.sequences [ 1 ],
            draft.solver.sequences [ 0 ],
        ] );
    } );

    it ( "exposes all immutable review views and prevents stale Apply", async () =>
    {
        // Initialize the local values needed by this operation.

        const user   = userEvent.setup ();
        const draft  = createDraft ();
        const result = inferSolverCandidate (
            {
                documentRevision: 1,
                solverRevision: 1,
                observations:
                [
                    {
                        name: "candidate",
                        startContext: "initial",
                        rawTokens: [ "state_ready", "event_finish", "state_done" ],
                    },
                ],
            },
        );

        expect ( result.status ).toBe ( "success" );

        // Handle the case where result status differs from "success".

        if ( result.status !== "success" )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const initialItemCount    = COMPILE_TIME_CONFIGURATION.shell.progressiveRendering.initialItemCount;
        const candidateStateCount = initialItemCount + 50;
        const candidateStates     = Array.from ( { length: candidateStateCount }, ( _, index ) => ( {
            description: "",
            name: `candidate_state_${index}`,
        } ) );
        const largeCandidate: SolverCandidate =
        {
            ...result.candidate,
            provenance:
            {
                ...result.candidate.provenance,
                generatedStateNames: candidateStates.map ( state => state.name ),
                observedStateNames: [],
                states: candidateStates.map ( state => ( {
                    evidence: "inferred" as const,
                    sources: [],
                    state: state.name,
                } ) ),
                transitions: [],
            },
            stateMachine:
            {
                ...result.candidate.stateMachine,
                initialState: candidateStates [ 0 ]?.name ?? "candidate_state_0",
                stateActions: { entry: [], exit: [] },
                states: candidateStates,
                transitionTable: [],
            },
            statistics:
            {
                ...result.candidate.statistics,
                candidateStateCount,
                generatedStateCount: candidateStateCount,
                transitionCount: 0,
            },
        };

        render (
            <SolverPage
                chartNameWrapping  = { { actionNames: false, eventNames: false, stateNames: false } }
                draft              = { draft }
                onApplyCandidate   = { vi.fn () }
                onCancelSolve      = { vi.fn () }
                onDiscardCandidate = { vi.fn () }
                onSequencesChange  = { vi.fn () }
                onSolve            = { vi.fn () }
                onValidate         = { vi.fn () }
                solverWorkspace    = {
                    {
                        activeJobId: null,
                        candidate: largeCandidate,
                        diagnostics: [],
                        progress: null,
                        status: "stale",
                    }
                }
            />,
        );

        expect ( screen.getByText ( /candidate is stale/iu ) ).toBeVisible ();
        expect ( screen.getByRole ( "button", { name: "Apply Candidate" } ) ).toBeDisabled ();
        expect ( screen.getAllByRole ( "tab" ) ).toHaveLength ( 7 );

        await user.click ( screen.getByRole ( "tab", { name: "States and Actions" } ) );
        const stateActionsRegion = screen.getByRole ( "region", { name: "States and Actions" } );

        expect ( stateActionsRegion ).toHaveAttribute ( "tabindex", "0" );
        expect ( within ( stateActionsRegion ).getAllByRole ( "row" ) ).toHaveLength ( initialItemCount + 1 );
        stateActionsRegion.focus ();
        fireEvent.keyDown ( stateActionsRegion, { key: "PageDown" } );
        expect ( stateActionsRegion ).toHaveFocus ();
        expect ( within ( stateActionsRegion ).getAllByRole ( "row" ) ).toHaveLength ( candidateStateCount + 1 );
        await user.click ( screen.getByRole ( "tab", { name: "Transition Table" } ) );
        expect ( screen.getByRole ( "region", { name: "Transition Table" } ) ).toHaveAttribute ( "tabindex", "0" );
        await user.click ( screen.getByRole ( "tab", { name: "Trace Coverage" } ) );
        expect ( screen.getByRole ( "region", { name: "Trace Coverage" } ) ).toHaveAttribute ( "tabindex", "0" );
        expect ( screen.getByRole ( "heading", { name: /candidate/iu, level: 3 } ) ).toBeVisible ();
        await user.click ( screen.getByRole ( "tab", { name: "Inference Report" } ) );
        expect ( screen.getByRole ( "list", { name: "Inference Report" } ) ).toHaveAttribute ( "tabindex", "0" );
        expect ( screen.getByText ( /consistent with every hard observation/iu ) ).toBeVisible ();
    } );
} );

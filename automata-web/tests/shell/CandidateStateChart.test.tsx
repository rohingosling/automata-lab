// @vitest-environment jsdom

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Candidate State Chart Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies UML candidate state symbols, top-to-bottom layout, collapsed and expanded content, and
//   independent name-wrapping controls.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT,
    MAXIMUM_INTERACTIVE_CHART_NODE_COUNT,
} from "../../src/application/chart-layout-limits.js";
import { inferSolverCandidate } from "../../src/domain/solver/inference.js";
import { CandidateStateChart } from "../../src/presentation/solver/CandidateStateChart.js";
import { wrapCandidateChartName } from "../../src/presentation/solver/candidate-chart-layout.js";

const LONG_STATE_NAME  = "state_this_is_a_long_state_name_with_breakable_segments";
const LONG_EVENT_NAME  = "event_this_is_a_long_event_name_with_breakable_segments";
const LONG_ACTION_NAME = "action_this_is_a_long_action_name_with_breakable_segments";

//--------------------------------------------------------------------------------------------------
// Function: createCandidate
//
// Description:
//
//   Creates candidate for the test scenario.
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

function createCandidate ()
{
    // Initialize the local values needed by this operation.

    const result = inferSolverCandidate (
        {
            documentRevision: 1,
            solverRevision: 1,
            observations:
            [
                {
                    name: "chart",
                    startContext: "initial",
                    rawTokens:
                    [
                        LONG_STATE_NAME,
                        LONG_ACTION_NAME,
                        LONG_EVENT_NAME,
                        "state_destination_with_another_breakable_name",
                    ],
                },
            ],
        },
    );

    expect ( result.status ).toBe ( "success" );

    // Handle the case where result status differs from "success".

    if ( result.status !== "success" )
    {
        throw new Error ( "The Candidate State Chart fixture did not infer a candidate." );
    }

    // Return the computed result.

    return result.candidate;
}

//--------------------------------------------------------------------------------------------------
// Function: nameElement
//
// Description:
//
//   Derives the name element.
//
// Parameters:
//
//   - nameKind:
//     The name kind supplied to the operation.
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

function nameElement ( nameKind: "action" | "event" | "state" ): SVGTextElement
{
    // Initialize the local values needed by this operation.

    const element = document.querySelector <SVGTextElement> ( `[data-chart-name-kind='${nameKind}']` );

    // Handle the case where element matches an absent value.

    if ( element === null )
    {
        throw new Error ( `No ${nameKind} name was rendered.` );
    }

    // Return the element.

    return element;
}

describe ( "Candidate State Chart", () =>
{
    it ( "wraps only at the permitted separators when wrapping is enabled", () =>
    {
        expect ( wrapCandidateChartName ( "alpha_beta-gamma delta", false, 10 ) )
            .toEqual ( [ "alpha_beta-gamma delta" ] );
        expect ( wrapCandidateChartName ( "alpha_beta-gamma delta", true, 10 ) )
            .toEqual ( [ "alpha_", "beta-", "gamma ", "delta" ].map ( line => line.trimEnd () ) );
        expect ( wrapCandidateChartName ( "abcdefghijklmnop", true, 10 ) )
            .toEqual ( [ "abcdefghijklmnop" ] );
    } );

    it ( "bounds oversized candidate previews before constructing the SVG scene", () =>
    {
        // Initialize the local values needed by this operation.

        const candidate  = createCandidate ();
        const properties = 
        {
            expanded: false,
            nameWrapping: { actionNames: false, eventNames: false, stateNames: false },
        } as const;
        const oversizedStates = Array.from (
            { length: MAXIMUM_INTERACTIVE_CHART_NODE_COUNT + 1 },
            ( _, index ) => ( { description: "", name: `state_${index}` } ),
        );
        const rendering = render (
            <CandidateStateChart
                { ...properties }
                candidate={
                    {
                        ...candidate,
                        stateMachine: { ...candidate.stateMachine, states: oversizedStates },
                    }
                }
            />,
        );

        expect ( screen.getByRole ( "status" ) ).toHaveTextContent ( "too large" );
        expect ( rendering.container.querySelector ( "svg" ) ).toBeNull ();

        const transition = candidate.stateMachine.transitionTable [ 0 ];

        // Handle the case where transition matches undefined.

        if ( transition === undefined )
        {
            throw new Error ( "The Candidate State Chart fixture has no transition." );
        }

        rendering.rerender (
            <CandidateStateChart
                { ...properties }
                candidate={
                    {
                        ...candidate,
                        stateMachine:
                        {
                            ...candidate.stateMachine,
                            transitionTable: Array.from (
                                { length: MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT + 1 },
                                () => transition,
                            ),
                        },
                    }
                }
            />,
        );

        expect ( screen.getByRole ( "status" ) ).toHaveTextContent ( "too large" );
        expect ( rendering.container.querySelector ( "svg" ) ).toBeNull ();
    } );

    it ( "renders rounded collapsed boxes and expanded entry and exit action compartments", () =>
    {
        // Initialize the local values needed by this operation.

        const candidate = createCandidate ();
        const rendering = render (
            <CandidateStateChart
                candidate    = { candidate }
                expanded     = { false }
                nameWrapping = { { actionNames: false, eventNames: false, stateNames: true } }
            />,
        );
        const collapsedStateBox = document.querySelector ( ".solver-chart-state-box" );

        expect ( collapsedStateBox ).toHaveAttribute ( "rx", "10" );
        expect ( collapsedStateBox ).toHaveAttribute ( "width", "300" );
        expect ( collapsedStateBox ).toHaveAttribute ( "height", "60" );
        expect ( screen.queryByText ( "Entry Actions" ) ).not.toBeInTheDocument ();
        expect ( nameElement ( "state" ).querySelectorAll ( "tspan" ).length ).toBeGreaterThan ( 1 );
        expect ( nameElement ( "event" ).querySelectorAll ( "tspan" ) ).toHaveLength ( 1 );

        rendering.rerender (
            <CandidateStateChart
                candidate={ candidate }
                expanded
                nameWrapping={ { actionNames: true, eventNames: true, stateNames: false } }
            />,
        );

        expect ( screen.getAllByText ( "Entry Actions" ) ).toHaveLength ( candidate.stateMachine.states.length );
        expect ( screen.getAllByText ( "Exit Actions" ) ).toHaveLength ( candidate.stateMachine.states.length );
        expect ( nameElement ( "state" ).querySelectorAll ( "tspan" ) ).toHaveLength ( 1 );
        expect ( nameElement ( "event" ).querySelectorAll ( "tspan" ).length ).toBeGreaterThan ( 1 );
        expect ( nameElement ( "action" ).querySelectorAll ( "tspan" ).length ).toBeGreaterThan ( 1 );
    } );

    it ( "places transition destinations below their source state by default", () =>
    {
        // Initialize the local values needed by this operation.

        const candidate = createCandidate ();

        render (
            <CandidateStateChart
                candidate    = { candidate }
                expanded     = { false }
                nameWrapping = { { actionNames: false, eventNames: false, stateNames: false } }
            />,
        );

        // Initialize the local values needed by this operation.

        const sourceStateName = candidate.stateMachine.initialState;
        const transition      = candidate.stateMachine.transitionTable[ 0 ];

        expect ( transition ).toBeDefined ();

        // Handle the case where transition matches undefined.

        if ( transition === undefined )
        {
            throw new Error ( "The top-to-bottom layout fixture has no transition." );
        }

        // Initialize the local values needed by this operation.

        const sourceStateBox = document.querySelector<SVGRectElement> (
            `[data-state='${sourceStateName}'] .solver-chart-state-box`,
        );
        const destinationStateBox = document.querySelector<SVGRectElement> (
            `[data-state='${transition.stateNext}'] .solver-chart-state-box`,
        );

        expect ( document.querySelector ( ".solver-chart" ) )
            .toHaveAttribute ( "data-layout-direction", "top-to-bottom" );
        expect ( sourceStateBox ).not.toBeNull ();
        expect ( destinationStateBox ).not.toBeNull ();
        expect ( Number ( destinationStateBox?.getAttribute ( "y" ) ) )
            .toBeGreaterThan ( Number ( sourceStateBox?.getAttribute ( "y" ) ) );
    } );

    it ( "supports accessible zooming, panning, and view reset", () =>
    {
        // Initialize the local values needed by this operation.

        const rendering = render (
            <CandidateStateChart
                candidate    = { createCandidate () }
                expanded     = { false }
                nameWrapping = { { actionNames: false, eventNames: false, stateNames: false } }
            />,
        );
        const chart = within ( rendering.container ).getByRole ( "img", { name: "State Chart" } );

        expect ( chart ).toHaveAttribute ( "data-zoom", "1.00" );
        expect ( chart ).toHaveAttribute ( "data-pan-x", "0" );
        fireEvent.keyDown ( chart, { key: "+" } );
        expect ( chart ).toHaveAttribute ( "data-zoom", "1.10" );
        const panAfterZoom = Number ( chart.getAttribute ( "data-pan-x" ) );

        fireEvent.keyDown ( chart, { key: "ArrowRight" } );
        expect ( Number ( chart.getAttribute ( "data-pan-x" ) ) ).toBe ( panAfterZoom + 24 );
        fireEvent.keyDown ( chart, { key: "Home" } );
        expect ( chart ).toHaveAttribute ( "data-zoom", "1.00" );
        expect ( chart ).toHaveAttribute ( "data-pan-x", "0" );
    } );
} );

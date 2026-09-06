// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Bounded Exact-Oracle Research Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Compares small Solver results with an independent exhaustive partition oracle. These bounded
//   checks are research evidence for specific fixtures and do not assert that the production
//   heuristic is globally minimal.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import type { SolverCandidate } from "../../src/domain/model/contracts.js";
import { inferSolverCandidate } from "../../src/domain/solver/inference.js";
import type { SolverObservationInput } from "../../src/domain/solver/contracts.js";

//--------------------------------------------------------------------------------------------------
// Interface: OracleNode
//
// Description:
//
//   Defines the structure of oracle node.
//
//--------------------------------------------------------------------------------------------------

interface OracleNode
{
    readonly entryActions:  readonly string[];
    readonly explicitState: string | null;
}

//--------------------------------------------------------------------------------------------------
// Interface: OracleEdge
//
// Description:
//
//   Defines the structure of oracle edge.
//
//--------------------------------------------------------------------------------------------------

interface OracleEdge
{
    readonly destination: number;
    readonly event:       string;
    readonly source:      number;
}

//--------------------------------------------------------------------------------------------------
// Interface: OracleEvidence
//
// Description:
//
//   Defines the structure of oracle evidence.
//
//--------------------------------------------------------------------------------------------------

interface OracleEvidence
{
    readonly edges:        readonly OracleEdge[];
    readonly initialNodes: readonly number[];
    readonly nodes:        readonly OracleNode[];
}

//--------------------------------------------------------------------------------------------------
// Function: actionWordsEqual
//
// Description:
//
//   Derives the action words equal.
//
// Parameters:
//
//   - left:
//     The left supplied to the operation.
//
//   - right:
//     The right supplied to the operation.
//
// Returns:
//
//   True when the named condition is satisfied; otherwise, false.
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

function actionWordsEqual ( left: readonly string[], right: readonly string[] ): boolean
{
    // Return the computed result.

    return left.length === right.length && left.every ( ( action, index ) => action === right [ index ] );
}

//--------------------------------------------------------------------------------------------------
// Function: partitionIsCompatible
//
// Description:
//
//   Derives the partition is compatible.
//
// Parameters:
//
//   - evidence:
//     The evidence supplied to the operation.
//
//   - partition:
//     The partition supplied to the operation.
//
// Returns:
//
//   True when the named condition is satisfied; otherwise, false.
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

function partitionIsCompatible ( evidence: OracleEvidence, partition: readonly number[] ): boolean
{
    // Initialize the local values needed by this operation.

    const initialClass = partition [ evidence.initialNodes [ 0 ] ?? -1 ];

    // Handle the case where some result is enabled.

    if ( evidence.initialNodes.some ( node => partition [ node ] !== initialClass ) )
    {
        // Return the computed result.

        return false;
    }

    // Calculate the class count value from the current inputs.

    const classCount = Math.max ( ...partition ) + 1;

    // Repeat the operation across the bounded iteration range.

    for ( let classIdentifier = 0; classIdentifier < classCount; classIdentifier++ )
    {
        // Initialize the local values needed by this operation.

        const members = evidence.nodes.flatMap ( ( node, index ) =>
            partition [ index ] === classIdentifier ? [ node ] : [] );
        const firstMember    = members [ 0 ];
        const explicitStates = new Set ( members.flatMap ( node =>
            node.explicitState === null ? [] : [ node.explicitState ] ) );

        // Handle the case where at least one branch condition is satisfied.

        if ( firstMember === undefined || explicitStates.size > 1 ||
            members.some ( member => !actionWordsEqual ( firstMember.entryActions, member.entryActions ) ) )
        {
            // Return the computed result.

            return false;
        }
    }

    const destinationByTransition = new Map<string, number> ();

    // Process each edge from the evidence edges collection in order.

    for ( const edge of evidence.edges )
    {
        // Initialize the local values needed by this operation.

        const key                 = `${partition [ edge.source ]}\u0000${edge.event}`;
        const destinationClass    = partition [ edge.destination ];
        const previousDestination = destinationByTransition.get ( key );

        // Handle the case where at least one branch condition is satisfied.

        if ( destinationClass === undefined ||
            ( previousDestination !== undefined && previousDestination !== destinationClass ) )
        {
            // Return the computed result.

            return false;
        }

        destinationByTransition.set ( key, destinationClass );
    }

    // Return the computed result.

    return true;
}

//--------------------------------------------------------------------------------------------------
// Function: exactMinimumStateCount
//
// Description:
//
//   Derives the exact minimum state count.
//
// Parameters:
//
//   - evidence:
//     The evidence supplied to the operation.
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

function exactMinimumStateCount ( evidence: OracleEvidence ): number
{
    // Initialize the local values needed by this operation.

    const partition       = new Array<number> ( evidence.nodes.length ).fill ( 0 );
    let minimumStateCount = evidence.nodes.length;

    //----------------------------------------------------------------------------------------------
    // Function: visit
    //
    // Description:
    //
    //   Visits the requested value.
    //
    // Parameters:
    //
    //   - nodeIndex:
    //     The node index supplied to the operation.
    //
    //   - maximumClass:
    //     The maximum class supplied to the operation.
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

    function visit ( nodeIndex: number, maximumClass: number ): void
    {
        // Handle the case where node index matches length.

        if ( nodeIndex === evidence.nodes.length )
        {
            // Handle the case where partition is compatible result is enabled.

            if ( partitionIsCompatible ( evidence, partition ) )
            {
                minimumStateCount = Math.min ( minimumStateCount, maximumClass + 1 );
            }

            // Return control to the caller.

            return;
        }

        // Repeat the operation across the bounded iteration range.

        for ( let classIdentifier = 0; classIdentifier <= maximumClass + 1; classIdentifier++ )
        {
            partition [ nodeIndex ] = classIdentifier;
            visit ( nodeIndex + 1, Math.max ( maximumClass, classIdentifier ) );
        }
    }

    // Handle the case where length matches 0.

    if ( evidence.nodes.length === 0 )
    {
        // Return the computed result.

        return 0;
    }

    partition [ 0 ] = 0;
    visit ( 1, 0 );

    // Return the minimum state count.

    return minimumStateCount;
}

//--------------------------------------------------------------------------------------------------
// Function: candidateEvidence
//
// Description:
//
//   Derives the candidate evidence.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
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

function candidateEvidence ( candidate: SolverCandidate ): OracleEvidence
{
    // Initialize the local values needed by this operation.

    const stateIndexByName  = new Map ( candidate.stateMachine.states.map ( ( state, index ) => [ state.name, index ] ) );
    const actionWordByState = new Map<string, string[]> ();

    // Process each assignment from the entry collection in order.

    for ( const assignment of candidate.stateMachine.stateActions.entry )
    {
        // Initialize the local values needed by this operation.

        const actionWord = actionWordByState.get ( assignment.state ) ?? [];

        actionWord.push ( assignment.action );
        actionWordByState.set ( assignment.state, actionWord );
    }

    // Return the assembled result.

    return {
        nodes: candidate.stateMachine.states.map ( state =>
        {
            // Initialize the local values needed by this operation.

            const provenance = candidate.provenance.states.find ( item => item.state === state.name );

            // Return the assembled result.

            return {
                entryActions:  actionWordByState.get ( state.name ) ?? [],
                explicitState: provenance?.evidence === "observed" ? state.name : null,
            };
        } ),
        initialNodes: [ stateIndexByName.get ( candidate.stateMachine.initialState ) ?? -1 ],
        edges: candidate.stateMachine.transitionTable.map ( transition => ( {
            source:      stateIndexByName.get ( transition.state ) ?? -1,
            event:       transition.event,
            destination: stateIndexByName.get ( transition.stateNext ) ?? -1,
        } ) ),
    };
}

describe ( "bounded exact Solver oracle", () =>
{
    it ( "matches the exact result for a fixed five-node research fixture", () =>
    {
        // Initialize the local values needed by this operation.

        const observations: readonly SolverObservationInput[] =
        [
            {
                name: "primary",
                startContext: "initial",
                rawTokens:
                [
                    "state_root",
                    "event_a",
                    "action_x",
                    "event_b",
                    "action_y",
                    "state_done",
                ],
            },
            {
                name: "continuation",
                startContext: "continuation",
                rawTokens: [ "action_x", "event_c", "action_x" ],
            },
        ];
        const exactEvidence: OracleEvidence =
        {
            nodes:
            [
                { entryActions: [], explicitState: "state_root" },
                { entryActions: [ "action_x" ], explicitState: null },
                { entryActions: [ "action_y" ], explicitState: "state_done" },
                { entryActions: [ "action_x" ], explicitState: null },
                { entryActions: [ "action_x" ], explicitState: null },
            ],
            initialNodes: [ 0 ],
            edges:
            [
                { source: 0, event: "event_a", destination: 1 },
                { source: 1, event: "event_b", destination: 2 },
                { source: 3, event: "event_c", destination: 4 },
            ],
        };
        const result = inferSolverCandidate (
            {
                documentRevision: 0,
                solverRevision: 0,
                observations,
            },
        );

        expect ( exactMinimumStateCount ( exactEvidence ) ).toBe ( 3 );
        expect ( result.status ).toBe ( "success" );

        // Handle the case where result status matches "success".

        if ( result.status === "success" )
        {
            expect ( result.candidate.stateMachine.states ).toHaveLength ( 3 );
        }
    } );

    it ( "leaves no merge admitted by the completion criterion", () =>
    {
        // Initialize the local values needed by this operation.

        const result = inferSolverCandidate (
            {
                documentRevision: 0,
                solverRevision: 0,
                observations:
                [
                    {
                        name: "primary",
                        startContext: "initial",
                        rawTokens: [ "state_root", "event_a", "action_x", "event_b", "state_done" ],
                    },
                    {
                        name: "fragment",
                        startContext: "infer",
                        rawTokens: [ "action_x", "event_c", "action_x" ],
                    },
                ],
            },
        );

        expect ( result.status ).toBe ( "success" );

        // Handle the case where result status matches "success".

        if ( result.status === "success" )
        {
            // Initialize the local values needed by this operation.

            const evidence = candidateEvidence ( result.candidate );

            expect ( exactMinimumStateCount ( evidence ) ).toBe ( evidence.nodes.length );
        }
    } );
} );

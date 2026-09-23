// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    ELK Chart Layout
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Produces deterministic top-to-bottom state placements with the bundled ELK layered-layout
//   engine, then scales the result until no two state centres are closer than the Minimum State
//   Distance.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ElkLayoutArguments, ElkNode } from "elkjs/lib/elk-api.js";

import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";

import type
{
    ChartLayoutEdge,
    ChartLayoutNode,
    ChartLayoutOptions,
    ChartLayoutResult,
} from "../../application/ports/contracts.js";

//--------------------------------------------------------------------------------------------------
// Interface: ChartLayoutEngine
//
// Description:
//
//   Defines the structure of chart layout engine.
//
//--------------------------------------------------------------------------------------------------

export interface ChartLayoutEngine
{
    layout ( graph: ElkNode, argumentsValue?: ElkLayoutArguments ): Promise<ElkNode>;
    terminateWorker (): void;
}

const ELK_BETWEEN_LAYER_SEED_SPACING = COMPILE_TIME_CONFIGURATION.chart.automaticLayout.elkBetweenLayerSeedSpacing;
const ELK_WITHIN_LAYER_SEED_SPACING  = COMPILE_TIME_CONFIGURATION.chart.automaticLayout.elkWithinLayerSeedSpacing;

//--------------------------------------------------------------------------------------------------
// Interface: PlacedStateCentre
//
// Description:
//
//   Defines the structure of placed state centre.
//
//--------------------------------------------------------------------------------------------------

interface PlacedStateCentre
{
    readonly state: string;
    readonly x:     number;
    readonly y:     number;
}

// Two axis-aligned rectangles overlap exactly when their centres are closer than half the summed
// width on one axis and half the summed height on the other. A centre distance therefore only rules
// overlap out once it exceeds the hypotenuse of those two half-sums, so a Minimum State Distance
// below the largest such hypotenuse would still admit touching states. The layout raises its own
// target to that hypotenuse and reports the raise to the caller.

//--------------------------------------------------------------------------------------------------
// Function: overlapSafeStateDistance
//
// Description:
//
//   Derives the overlap safe state distance.
//
// Parameters:
//
//   - nodes:
//     The nodes supplied to the operation.
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

function overlapSafeStateDistance ( nodes: readonly ChartLayoutNode[] ): number
{
    // Initialize the local values needed by this operation.

    let safeDistance = 0;

    // Repeat the operation across the bounded iteration range.

    for ( let leftIndex = 0; leftIndex < nodes.length; leftIndex++ )
    {
        // Repeat the operation across the bounded iteration range.

        for ( let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex++ )
        {
            // Initialize the local values needed by this operation.

            const left  = nodes [ leftIndex ];
            const right = nodes [ rightIndex ];

            // Handle the case where at least one branch condition is satisfied.

            if ( left === undefined || right === undefined )
            {
                continue;
            }

            safeDistance = Math.max ( safeDistance, Math.hypot (
                ( left.width + right.width ) / 2,
                ( left.height + right.height ) / 2,
            ) );
        }
    }

    // Return the safe distance.

    return safeDistance;
}

//--------------------------------------------------------------------------------------------------
// Function: smallestCentreDistance
//
// Description:
//
//   Derives the smallest centre distance.
//
// Parameters:
//
//   - centres:
//     The centres supplied to the operation.
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

function smallestCentreDistance ( centres: readonly PlacedStateCentre[] ): number
{
    // Initialize the local values needed by this operation.

    let smallest = Number.POSITIVE_INFINITY;

    // Repeat the operation across the bounded iteration range.

    for ( let leftIndex = 0; leftIndex < centres.length; leftIndex++ )
    {
        // Repeat the operation across the bounded iteration range.

        for ( let rightIndex = leftIndex + 1; rightIndex < centres.length; rightIndex++ )
        {
            // Initialize the local values needed by this operation.

            const left  = centres [ leftIndex ];
            const right = centres [ rightIndex ];

            // Handle the case where at least one branch condition is satisfied.

            if ( left === undefined || right === undefined )
            {
                continue;
            }

            smallest = Math.min ( smallest, Math.hypot ( left.x - right.x, left.y - right.y ) );
        }
    }

    // Return the smallest.

    return smallest;
}

// ELK Layered separates states within one layer and between successive layers, but places no
// constraint at all on the remaining axis for two states in different layers, so its output can
// leave any pair arbitrarily close. Scaling every centre about a single anchor multiplies every
// pairwise distance by the same factor, which lifts the closest pair to the target while preserving
// the engine's ordering, its crossing minimisation, and its straight edges exactly. No other
// transform keeps all three, and no iteration is needed.
//
// Grid rounding runs after the scale and can move each centre by up to half a grid unit on each
// axis, drawing two centres together by at most the diagonal of a whole grid square. Scaling to the
// target plus that diagonal keeps the guarantee intact once the coordinates land on the grid.

//--------------------------------------------------------------------------------------------------
// Function: centreScaleFactor
//
// Description:
//
//   Derives the centre scale factor.
//
// Parameters:
//
//   - centres:
//     The centres supplied to the operation.
//
//   - minimumStateDistance:
//     The minimum state distance supplied to the operation.
//
//   - gridSize:
//     The grid size supplied to the operation.
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

function centreScaleFactor (
    centres: readonly PlacedStateCentre[],
    minimumStateDistance: number,
    gridSize: number,
): number
{
    // Handle the case where centres length is less than 2.

    if ( centres.length < 2 )
    {
        // Return the computed result.

        return 1;
    }

    const smallest = smallestCentreDistance ( centres );

    // Handle the case where at least one branch condition is satisfied.

    if ( !Number.isFinite ( smallest ) || smallest <= 0 )
    {
        // Return the computed result.

        return 1;
    }

    // Calculate the rounding allowance value from the current inputs.

    const roundingAllowance = gridSize * Math.SQRT2;

    // Return the max result.

    return Math.max ( 1, ( minimumStateDistance + roundingAllowance ) / smallest );
}

//--------------------------------------------------------------------------------------------------
// Function: createElkChartLayout
//
// Description:
//
//   Creates elk chart layout.
//
// Parameters:
//
//   - elk:
//     The elk supplied to the operation.
//
//   - nodes:
//     The nodes supplied to the operation.
//
//   - edges:
//     The edges supplied to the operation.
//
//   - options:
//     Options that control the operation.
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

export async function createElkChartLayout (
    elk: ChartLayoutEngine,
    nodes: readonly ChartLayoutNode[],
    edges: readonly ChartLayoutEdge[],
    options?: ChartLayoutOptions,
): Promise<ChartLayoutResult>
{
    // Initialize the local values needed by this operation.

    const requestedMinimumStateDistance = options?.minimumStateDistance ??
        COMPILE_TIME_CONFIGURATION.applicationSettings.chart.automaticLayoutAndRouting.minimumStateDistance;
    const gridSize                      = options?.gridSize ?? 1;
    const effectiveMinimumStateDistance = Math.max (
        requestedMinimumStateDistance,
        overlapSafeStateDistance ( nodes ),
    );
    const identifierByState = new Map ( nodes.map ( ( node, index ) => [ node.state, `state-${index}` ] ) );
    const stateByIdentifier = new Map ( nodes.map ( ( node, index ) => [ `state-${index}`, node.state ] ) );
    const graph             = await elk.layout (
        {
            id: "automata-chart",
            layoutOptions:
            {
                "elk.algorithm": "layered",
                "elk.direction": "DOWN",
                "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
                "elk.layered.considerModelOrder.groupModelOrder.cbPreferredSourceId": "1",
                "elk.layered.crossingMinimization.greedySwitch.type": "TWO_SIDED",
                "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
                "elk.layered.cycleBreaking.strategy": "SCC_NODE_TYPE",
                "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
                "elk.layered.nodePlacement.favorStraightEdges": "true",
                "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
                "elk.layered.spacing.nodeNodeBetweenLayers": String ( ELK_BETWEEN_LAYER_SEED_SPACING ),
                "elk.spacing.nodeNode": String ( ELK_WITHIN_LAYER_SEED_SPACING ),
                "elk.padding": "[top=40,left=40,bottom=40,right=40]",
            },
            children: nodes.map ( ( node, index ) => ( {
                id: `state-${index}`,
                width: node.width,
                height: node.height,
                layoutOptions:
                {
                    "elk.layered.considerModelOrder.groupModelOrder.cycleBreakingId": index === 0 ? "1" : "0",
                    ...( node.isInitial ? { "elk.layered.layering.layerConstraint": "FIRST_SEPARATE" } : {} ),
                },
            } ) ),
            edges: edges.flatMap ( ( edge, index ) =>
            {
                // Initialize the local values needed by this operation.

                const sourceIdentifier      = identifierByState.get ( edge.sourceState );
                const destinationIdentifier = identifierByState.get ( edge.destinationState );

                // Return the result selected by the current condition.

                return sourceIdentifier === undefined || destinationIdentifier === undefined
                    ? []
                    : [ {
                        id: `edge-${index}`,
                        sources: [ sourceIdentifier ],
                        targets: [ destinationIdentifier ],
                        labels: edge.labelWidth === undefined || edge.labelHeight === undefined
                            ? []
                            : [ {
                                id: `edge-label-${index}`,
                                width: edge.labelWidth,
                                height: edge.labelHeight,
                            } ],
                    } ];
            } ),
        },
        { layoutOptions: { "elk.randomSeed": "1" } },
    );
    const positionedStates = new Map ( graph.children?.flatMap ( child =>
    {
        // Initialize the local values needed by this operation.

        const state = stateByIdentifier.get ( child.id );

        // Return the result selected by the current condition.

        return state === undefined || child.x === undefined || child.y === undefined
            ? []
            : [ [ state, { state, x: child.x, y: child.y } ] as const ];
    } ) ?? [] );

    // Handle the case where positioned states size differs from nodes length.

    if ( positionedStates.size !== nodes.length )
    {
        throw new Error ( "ELK did not return a position for every Chart state." );
    }

    // Initialize the local values needed by this operation.

    const placedNodes = nodes.map ( node =>
    {
        // Initialize the local values needed by this operation.

        const position = positionedStates.get ( node.state ) ?? { state: node.state, x: 0, y: 0 };

        // Return the assembled result.

        return { height: node.height, state: node.state, width: node.width, x: position.x, y: position.y };
    } );
    const centres = placedNodes.map ( node => ( {
        state: node.state,
        x:     node.x + node.width / 2,
        y:     node.y + node.height / 2,
    } ) );
    const scale = centreScaleFactor ( centres, effectiveMinimumStateDistance, gridSize );

    // Anchor the scale at the layout's top-left corner so a chart that started at non-negative
    // coordinates stays there, and so the canonical origin marker keeps the same relationship to
    // the first state.

    const anchorX = Math.min ( ...placedNodes.map ( node => node.x ) );
    const anchorY = Math.min ( ...placedNodes.map ( node => node.y ) );

    // Return the assembled result.

    return {
        effectiveMinimumStateDistance,
        states: placedNodes.map ( node =>
        {
            // Initialize the local values needed by this operation.

            const scaledCentreX = anchorX + ( node.x + node.width / 2 - anchorX ) * scale;
            const scaledCentreY = anchorY + ( node.y + node.height / 2 - anchorY ) * scale;

            // Return the assembled result.

            return {
                state: node.state,
                x:     Math.round ( ( scaledCentreX - node.width / 2 ) / gridSize ) * gridSize,
                y:     Math.round ( ( scaledCentreY - node.height / 2 ) / gridSize ) * gridSize,
            };
        } ),
    };
}

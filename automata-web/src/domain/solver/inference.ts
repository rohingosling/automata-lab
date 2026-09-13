// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Constrained State-Merging Solver
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Builds exact partial-observation evidence, closes hard identity constraints, and applies a
//   deterministic red/blue-style compatible-state merge policy without completing unobserved
//   transitions.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ChartProjection,
    SolverCandidate,
    SolverCandidateTraceCoverage,
    SolverInferenceReportEntry,
    StateMachineDefinition,
} from "../model/contracts.js";
import { MAXIMUM_STATE_COUNT, MAXIMUM_TRANSITION_COUNT } from "../model/limits.js";
import type
{
    NormalizedSolverObservation,
    SolverDiagnosticLocation,
    SolverInferenceRequest,
    SolverInferenceResult,
    SolverObservationDiagnostic,
} from "./contracts.js";
import { normalizeSolverObservations } from "./normalization.js";
import { replaySolverObservation } from "./replay.js";

//--------------------------------------------------------------------------------------------------
// Interface: EvidenceNode
//
// Description:
//
//   Defines the structure of evidence node.
//
//--------------------------------------------------------------------------------------------------

interface EvidenceNode
{
    readonly identifier:     number;
    readonly entryActions:   readonly string[];
    readonly explicitState:  string | null;
    readonly sources:        readonly SolverDiagnosticLocation[];
    readonly startContexts:  readonly ( "continuation" | "infer" | "initial" )[];
}

//--------------------------------------------------------------------------------------------------
// Interface: EvidenceEdge
//
// Description:
//
//   Defines the structure of evidence edge.
//
//--------------------------------------------------------------------------------------------------

interface EvidenceEdge
{
    readonly source:      number;
    readonly event:       string;
    readonly destination: number;
    readonly sourceRange: SolverDiagnosticLocation;
}

//--------------------------------------------------------------------------------------------------
// Interface: EvidenceTrace
//
// Description:
//
//   Defines the structure of evidence trace.
//
//--------------------------------------------------------------------------------------------------

interface EvidenceTrace
{
    readonly observation: NormalizedSolverObservation;
    readonly nodeIdentifiers: readonly number[];
}

//--------------------------------------------------------------------------------------------------
// Interface: EvidenceGraph
//
// Description:
//
//   Defines the structure of evidence graph.
//
//--------------------------------------------------------------------------------------------------

interface EvidenceGraph
{
    readonly nodes:        readonly EvidenceNode[];
    readonly edges:        readonly EvidenceEdge[];
    readonly traces:       readonly EvidenceTrace[];
    readonly initialNodes: readonly number[];
    readonly inferNodes:   readonly number[];
}

//--------------------------------------------------------------------------------------------------
// Interface: MergeAttempt
//
// Description:
//
//   Defines the structure of merge attempt.
//
//--------------------------------------------------------------------------------------------------

interface MergeAttempt
{
    readonly parents:      readonly number[];
    readonly impliedMerges: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: MergeStatistics
//
// Description:
//
//   Defines the structure of merge statistics.
//
//--------------------------------------------------------------------------------------------------

interface MergeStatistics
{
    readonly considered: number;
    readonly accepted:   number;
    readonly rejected:   number;
}

//--------------------------------------------------------------------------------------------------
// Interface: MergeOutcome
//
// Description:
//
//   Defines the structure of merge outcome.
//
//--------------------------------------------------------------------------------------------------

interface MergeOutcome
{
    readonly parents:    readonly number[];
    readonly statistics: MergeStatistics;
    readonly report:     readonly SolverInferenceReportEntry[];
}

//--------------------------------------------------------------------------------------------------
// Function: compareText
//
// Description:
//
//   Compares text.
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

function compareText ( left: string, right: string ): number
{
    // Return the result selected by the current condition.

    return left < right ? -1 : left > right ? 1 : 0;
}

//--------------------------------------------------------------------------------------------------
// Function: compareNumbers
//
// Description:
//
//   Compares numbers.
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

function compareNumbers ( left: number, right: number ): number
{
    // Return the computed result.

    return left - right;
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
// Function: locationKey
//
// Description:
//
//   Derives the location key.
//
// Parameters:
//
//   - location:
//     The location supplied to the operation.
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

function locationKey ( location: SolverDiagnosticLocation ): string
{
    // Return the computed result.

    return `${location.sequenceName}\u0000${location.tokenStart.toString ().padStart ( 8, "0" )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: compareLocations
//
// Description:
//
//   Compares locations.
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

function compareLocations ( left: SolverDiagnosticLocation, right: SolverDiagnosticLocation ): number
{
    // Return the computed result.

    return compareText ( locationKey ( left ), locationKey ( right ) ) ||
        compareNumbers ( left.tokenEndExclusive, right.tokenEndExclusive );
}

//--------------------------------------------------------------------------------------------------
// Function: uniqueLocations
//
// Description:
//
//   Derives the unique locations.
//
// Parameters:
//
//   - locations:
//     The locations supplied to the operation.
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

function uniqueLocations ( locations: readonly SolverDiagnosticLocation[] ): readonly SolverDiagnosticLocation[]
{
    // Initialize the local values needed by this operation.

    const locationByKey = new Map<string, SolverDiagnosticLocation> ();

    // Process each location from the locations collection in order.

    for ( const location of locations )
    {
        locationByKey.set (
            `${location.sequenceName}\u0000${location.tokenStart}\u0000${location.tokenEndExclusive}`,
            location,
        );
    }

    // Return the sort result.

    return [ ...locationByKey.values () ].sort ( compareLocations );
}

//--------------------------------------------------------------------------------------------------
// Function: observationKey
//
// Description:
//
//   Derives the observation key.
//
// Parameters:
//
//   - observation:
//     The observation supplied to the operation.
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

function observationKey ( observation: NormalizedSolverObservation ): string
{
    // Return the stringify result.

    return JSON.stringify (
        [
            observation.startContext,
            observation.intervals.map ( interval => [
                interval.incomingEvent,
                interval.explicitState,
                interval.entryActions,
            ] ),
            observation.name,
        ],
    );
}

//--------------------------------------------------------------------------------------------------
// Function: buildEvidenceGraph
//
// Description:
//
//   Builds evidence graph.
//
// Parameters:
//
//   - observations:
//     The observations supplied to the operation.
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

function buildEvidenceGraph ( observations: readonly NormalizedSolverObservation[] ): EvidenceGraph
{
    // Initialize the local values needed by this operation.

    const nodes: EvidenceNode[]   = [];
    const edges: EvidenceEdge[]   = [];
    const traces: EvidenceTrace[] = [];
    const initialNodes: number[]  = [];
    const inferNodes: number[]    = [];
    const canonicalObservations   = [ ...observations ].sort ( ( left, right ) =>
        compareText ( observationKey ( left ), observationKey ( right ) ) );

    // Process each observation from the canonical observations collection in order.

    for ( const observation of canonicalObservations )
    {
        // Initialize the local values needed by this operation.

        const nodeIdentifiers: number[] = [];

        observation.intervals.forEach ( ( interval, intervalIndex ) =>
        {
            // Initialize the local values needed by this operation.

            const identifier                       = nodes.length;
            const source: SolverDiagnosticLocation = 
            {
                sequenceName:      observation.name,
                tokenStart:        interval.tokenStart,
                tokenEndExclusive: interval.tokenEndExclusive,
            };

            nodes.push (
                {
                    identifier,
                    entryActions:  interval.entryActions,
                    explicitState: interval.explicitState,
                    sources:       [ source ],
                    startContexts: intervalIndex === 0 ? [ observation.startContext ] : [],
                },
            );
            nodeIdentifiers.push ( identifier );

            // Handle the case where all required conditions are satisfied.

            if ( intervalIndex === 0 && observation.startContext === "initial" )
            {
                initialNodes.push ( identifier );
            }
            else if ( intervalIndex === 0 && observation.startContext === "infer" )
            {
                inferNodes.push ( identifier );
            }

            // Calculate the previous node identifier value from the current inputs.

            const previousNodeIdentifier = nodeIdentifiers [ intervalIndex - 1 ];

            // Handle the case where all required conditions are satisfied.

            if ( intervalIndex > 0 && previousNodeIdentifier !== undefined && interval.incomingEvent !== null )
            {
                edges.push (
                    {
                        source:      previousNodeIdentifier,
                        event:       interval.incomingEvent,
                        destination: identifier,
                        sourceRange:
                        {
                            sequenceName:      observation.name,
                            tokenStart:        Math.max ( 0, interval.tokenStart - 1 ),
                            tokenEndExclusive: interval.tokenEndExclusive,
                        },
                    },
                );
            }
        } );

        traces.push ( { observation, nodeIdentifiers } );
    }

    // Return the assembled result.

    return { nodes, edges, traces, initialNodes, inferNodes };
}

//--------------------------------------------------------------------------------------------------
// Function: findRoot
//
// Description:
//
//   Finds root.
//
// Parameters:
//
//   - parents:
//     The parents supplied to the operation.
//
//   - nodeIdentifier:
//     The node identifier supplied to the operation.
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

function findRoot ( parents: readonly number[], nodeIdentifier: number ): number
{
    // Initialize the local values needed by this operation.

    let root = nodeIdentifier;

    // Continue the operation while its terminating condition has not been reached.

    while ( parents [ root ] !== root )
    {
        // Initialize the local values needed by this operation.

        const parent = parents [ root ];

        // Handle the case where parent matches undefined.

        if ( parent === undefined )
        {
            // Return the root.

            return root;
        }

        root = parent;
    }

    // Return the root.

    return root;
}

//--------------------------------------------------------------------------------------------------
// Function: classMembers
//
// Description:
//
//   Derives the class members.
//
// Parameters:
//
//   - parents:
//     The parents supplied to the operation.
//
//   - nodeCount:
//     The node count supplied to the operation.
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

function classMembers (
    parents: readonly number[],
    nodeCount: number,
): ReadonlyMap<number, readonly number[]>
{
    // Initialize the local values needed by this operation.

    const membersByRoot = new Map<number, number[]> ();

    // Repeat the operation across the bounded iteration range.

    for ( let nodeIdentifier = 0; nodeIdentifier < nodeCount; nodeIdentifier++ )
    {
        // Initialize the local values needed by this operation.

        const root    = findRoot ( parents, nodeIdentifier );
        const members = membersByRoot.get ( root ) ?? [];

        members.push ( nodeIdentifier );
        membersByRoot.set ( root, members );
    }

    // Return the members by root.

    return membersByRoot;
}

//--------------------------------------------------------------------------------------------------
// Function: classLocations
//
// Description:
//
//   Derives the class locations.
//
// Parameters:
//
//   - parents:
//     The parents supplied to the operation.
//
//   - nodes:
//     The nodes supplied to the operation.
//
//   - root:
//     The root supplied to the operation.
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

function classLocations (
    parents: readonly number[],
    nodes: readonly EvidenceNode[],
    root: number,
): readonly SolverDiagnosticLocation[]
{
    // Return the unique locations result.

    return uniqueLocations ( nodes.flatMap ( node =>
        findRoot ( parents, node.identifier ) === root ? node.sources : [] ) );
}

//--------------------------------------------------------------------------------------------------
// Function: unionRoots
//
// Description:
//
//   Handles the union roots behavior.
//
// Parameters:
//
//   - parents:
//     The parents supplied to the operation.
//
//   - leftRoot:
//     The left root supplied to the operation.
//
//   - rightRoot:
//     The right root supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function unionRoots ( parents: number[], leftRoot: number, rightRoot: number ): void
{
    // Initialize the local values needed by this operation.

    const retainedRoot = Math.min ( leftRoot, rightRoot );
    const removedRoot  = Math.max ( leftRoot, rightRoot );

    parents [ removedRoot ] = retainedRoot;
}

//--------------------------------------------------------------------------------------------------
// Function: validateClassConstraints
//
// Description:
//
//   Validates class constraints.
//
// Parameters:
//
//   - parents:
//     The parents supplied to the operation.
//
//   - graph:
//     The graph supplied to the operation.
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

function validateClassConstraints (
    parents: readonly number[],
    graph: EvidenceGraph,
): boolean
{
    // Process each members from the values result collection in order.

    for ( const members of classMembers ( parents, graph.nodes.length ).values () )
    {
        // Initialize the local values needed by this operation.

        const firstNode      = graph.nodes [ members [ 0 ] ?? -1 ];
        const explicitStates = new Set ( members.flatMap ( identifier =>
        {
            // Initialize the local values needed by this operation.

            const explicitState = graph.nodes [ identifier ]?.explicitState;

            // Return the result selected by the current condition.

            return explicitState === null || explicitState === undefined ? [] : [ explicitState ];
        } ) );

        // Handle the case where at least one branch condition is satisfied.

        if ( firstNode === undefined || explicitStates.size > 1 || members.some ( identifier =>
        {
            // Initialize the local values needed by this operation.

            const node = graph.nodes [ identifier ];

            // Return the computed result.

            return node === undefined || !actionWordsEqual ( firstNode.entryActions, node.entryActions );
        } ) )
        {
            // Return the computed result.

            return false;
        }
    }

    // Return the computed result.

    return true;
}

//--------------------------------------------------------------------------------------------------
// Function: tryMergeClasses
//
// Description:
//
//   Derives the try merge classes.
//
// Parameters:
//
//   - currentParents:
//     The current parents supplied to the operation.
//
//   - graph:
//     The graph supplied to the operation.
//
//   - left:
//     The left supplied to the operation.
//
//   - right:
//     The right supplied to the operation.
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

function tryMergeClasses (
    currentParents: readonly number[],
    graph: EvidenceGraph,
    left: number,
    right: number,
): MergeAttempt | null
{
    // Initialize the local values needed by this operation.

    const parents                            = [ ...currentParents ];
    const pendingPairs: [ number, number ][] = [ [ left, right ] ];
    let impliedMerges                        = 0;

    // Continue the operation while its terminating condition has not been reached.

    while ( pendingPairs.length > 0 )
    {
        // Initialize the local values needed by this operation.

        const pair      = pendingPairs.shift ();
        const leftRoot  = pair === undefined ? -1 : findRoot ( parents, pair [ 0 ] );
        const rightRoot = pair === undefined ? -1 : findRoot ( parents, pair [ 1 ] );

        // Handle the case where left root matches right root.

        if ( leftRoot === rightRoot )
        {
            continue;
        }

        unionRoots ( parents, leftRoot, rightRoot );

        // Handle the case where the validate class constraints result condition is not satisfied.

        if ( !validateClassConstraints ( parents, graph ) )
        {
            // Return the computed result.

            return null;
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( impliedMerges > 0 || pendingPairs.length > 0 )
        {
            impliedMerges++;
        }

        const destinationsByKey = new Map<string, number> ();

        // Process each edge from the graph edges collection in order.

        for ( const edge of graph.edges )
        {
            // Initialize the local values needed by this operation.

            const sourceRoot      = findRoot ( parents, edge.source );
            const destinationRoot = findRoot ( parents, edge.destination );
            const key             = `${sourceRoot}\u0000${edge.event}`;
            const previous        = destinationsByKey.get ( key );

            // Handle the case where previous matches undefined.

            if ( previous === undefined )
            {
                destinationsByKey.set ( key, destinationRoot );
            }
            else if ( previous !== destinationRoot )
            {
                pendingPairs.push ( [ previous, destinationRoot ] );
            }
        }
    }

    // Return the assembled result.

    return { parents, impliedMerges };
}

//--------------------------------------------------------------------------------------------------
// Function: classKey
//
// Description:
//
//   Derives the class key.
//
// Parameters:
//
//   - parents:
//     The parents supplied to the operation.
//
//   - graph:
//     The graph supplied to the operation.
//
//   - root:
//     The root supplied to the operation.
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

function classKey ( parents: readonly number[], graph: EvidenceGraph, root: number ): string
{
    // Initialize the local values needed by this operation.

    const members       = classMembers ( parents, graph.nodes.length ).get ( root ) ?? [];
    const explicitState = members.flatMap ( identifier =>
    {
        // Initialize the local values needed by this operation.

        const state = graph.nodes [ identifier ]?.explicitState;

        // Return the result selected by the current condition.

        return state === null || state === undefined ? [] : [ state ];
    } ).sort ( compareText ) [ 0 ] ?? "";
    const actionWord = graph.nodes [ members [ 0 ] ?? -1 ]?.entryActions ?? [];
    const sourceKeys = members.flatMap ( identifier => graph.nodes [ identifier ]?.sources ?? [] )
        .map ( locationKey )
        .sort ( compareText );

    // Return the stringify result.

    return JSON.stringify ( [ explicitState, actionWord, sourceKeys ] );
}

//--------------------------------------------------------------------------------------------------
// Function: canonicalRoots
//
// Description:
//
//   Derives the canonical roots.
//
// Parameters:
//
//   - parents:
//     The parents supplied to the operation.
//
//   - graph:
//     The graph supplied to the operation.
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

function canonicalRoots ( parents: readonly number[], graph: EvidenceGraph ): readonly number[]
{
    // Return the sort result.

    return [ ...classMembers ( parents, graph.nodes.length ).keys () ].sort ( ( left, right ) =>
        compareText ( classKey ( parents, graph, left ), classKey ( parents, graph, right ) ) );
}

//--------------------------------------------------------------------------------------------------
// Function: outgoingRoots
//
// Description:
//
//   Derives the outgoing roots.
//
// Parameters:
//
//   - parents:
//     The parents supplied to the operation.
//
//   - graph:
//     The graph supplied to the operation.
//
//   - sourceRoot:
//     The source root supplied to the operation.
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

function outgoingRoots ( parents: readonly number[], graph: EvidenceGraph, sourceRoot: number ): readonly number[]
{
    // Initialize the local values needed by this operation.

    const destinationRoots = new Set<number> ();

    // Process each edge from the graph edges collection in order.

    for ( const edge of graph.edges )
    {
        // Handle the case where find root result matches source root.

        if ( findRoot ( parents, edge.source ) === sourceRoot )
        {
            destinationRoots.add ( findRoot ( parents, edge.destination ) );
        }
    }

    // Return the sort result.

    return [ ...destinationRoots ].sort ( ( left, right ) =>
        compareText ( classKey ( parents, graph, left ), classKey ( parents, graph, right ) ) );
}

//--------------------------------------------------------------------------------------------------
// Function: mergeScore
//
// Description:
//
//   Merges the score.
//
// Parameters:
//
//   - parents:
//     The parents supplied to the operation.
//
//   - graph:
//     The graph supplied to the operation.
//
//   - leftRoot:
//     The left root supplied to the operation.
//
//   - rightRoot:
//     The right root supplied to the operation.
//
//   - attempt:
//     The attempt supplied to the operation.
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

function mergeScore (
    parents: readonly number[],
    graph: EvidenceGraph,
    leftRoot: number,
    rightRoot: number,
    attempt: MergeAttempt,
): readonly number[]
{
    // Initialize the local values needed by this operation.

    const membersByRoot = classMembers ( parents, graph.nodes.length );
    const leftMembers   = membersByRoot.get ( leftRoot ) ?? [];
    const rightMembers  = membersByRoot.get ( rightRoot ) ?? [];
    const leftEvents    = new Set ( graph.edges.flatMap ( edge =>
        findRoot ( parents, edge.source ) === leftRoot ? [ edge.event ] : [] ) );
    const sharedEvents  = new Set ( graph.edges.flatMap ( edge =>
        findRoot ( parents, edge.source ) === rightRoot && leftEvents.has ( edge.event ) ? [ edge.event ] : [] ) ).size;
    const namedAgreement = leftMembers.some ( identifier => graph.nodes [ identifier ]?.explicitState !== null ) &&
        rightMembers.some ( identifier => graph.nodes [ identifier ]?.explicitState !== null ) ? 1 : 0;

    // Return the assembled result collection.

    return [ sharedEvents, attempt.impliedMerges, namedAgreement, leftMembers.length + rightMembers.length ];
}

//--------------------------------------------------------------------------------------------------
// Function: compareScores
//
// Description:
//
//   Compares scores.
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

function compareScores ( left: readonly number[], right: readonly number[] ): number
{
    // Repeat the operation across the bounded iteration range.

    for ( let index = 0; index < Math.max ( left.length, right.length ); index++ )
    {
        // Calculate the difference value from the current inputs.

        const difference = ( left [ index ] ?? 0 ) - ( right [ index ] ?? 0 );

        // Handle the case where difference differs from the 0 value.

        if ( difference !== 0 )
        {
            // Return the difference.

            return difference;
        }
    }

    // Return the computed result.

    return 0;
}

//--------------------------------------------------------------------------------------------------
// Function: mergeEvidenceGraph
//
// Description:
//
//   Merges the evidence graph.
//
// Parameters:
//
//   - graph:
//     The graph supplied to the operation.
//
//   - initialParents:
//     The initial parents supplied to the operation.
//
//   - initialRoot:
//     The initial root supplied to the operation.
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

function mergeEvidenceGraph (
    graph: EvidenceGraph,
    initialParents: readonly number[],
    initialRoot: number,
): MergeOutcome
{
    // Initialize the local values needed by this operation.

    let parents: readonly number[]             = initialParents;
    let considered                             = 0;
    let accepted                               = 0;
    let rejected                               = 0;
    const report: SolverInferenceReportEntry[] = [];
    const red                                  = new Set<number> ( [ findRoot ( parents, initialRoot ) ] );

    // Continue the operation while its terminating condition has not been reached.

    while ( true )
    {
        // Initialize the local values needed by this operation.

        const roots          = canonicalRoots ( parents, graph );
        const normalizedRed  = new Set ( [ ...red ].map ( root => findRoot ( parents, root ) ) );
        const blueCandidates = roots.filter ( root => !normalizedRed.has ( root ) &&
            [ ...normalizedRed ].some ( redRoot => outgoingRoots ( parents, graph, redRoot ).includes ( root ) ) );
        const blueRoot = blueCandidates [ 0 ] ?? roots.find ( root => !normalizedRed.has ( root ) );

        // Handle the case where blue root matches undefined.

        if ( blueRoot === undefined )
        {
            break;
        }

        // Initialize the local values needed by this operation.

        let selectedAttempt: MergeAttempt | null = null;
        let selectedRedRoot: number | null       = null;
        let selectedScore: readonly number[]     = [];

        // Process each red root from the sort result collection in order.

        for ( const redRoot of [ ...normalizedRed ].sort ( ( left, right ) =>
            compareText ( classKey ( parents, graph, left ), classKey ( parents, graph, right ) ) ) )
        {
            considered++;
            const attempt = tryMergeClasses ( parents, graph, redRoot, blueRoot );

            // Handle the case where attempt matches an absent value.

            if ( attempt === null )
            {
                rejected++;
                continue;
            }

            const score = mergeScore ( parents, graph, redRoot, blueRoot, attempt );

            // Handle the case where at least one branch condition is satisfied.

            if ( selectedAttempt === null || compareScores ( score, selectedScore ) > 0 )
            {
                selectedAttempt = attempt;
                selectedRedRoot = redRoot;
                selectedScore   = score;
            }
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( selectedAttempt === null || selectedRedRoot === null )
        {
            red.add ( blueRoot );
            continue;
        }

        // Initialize the local values needed by this operation.

        const leftKey  = classKey ( parents, graph, selectedRedRoot );
        const rightKey = classKey ( parents, graph, blueRoot );

        parents = selectedAttempt.parents;
        accepted++;
        red.add ( findRoot ( parents, selectedRedRoot ) );
        report.push (
            {
                code:     "COMPATIBLE_STATES_MERGED",
                category: "merge",
                summary:  "Compatible evidence states were merged.",
                detail:   `Merged ${leftKey} with ${rightKey}; score ${selectedScore.join ( "/" )}.`,
            },
        );
    }

    let completionChanged = true;

    // Continue the operation while its terminating condition has not been reached.

    while ( completionChanged )
    {
        completionChanged = false;
        const roots = canonicalRoots ( parents, graph );

        // Repeat the operation across the bounded iteration range.

        for ( let leftIndex = 0; leftIndex < roots.length && !completionChanged; leftIndex++ )
        {
            // Repeat the operation across the bounded iteration range.

            for ( let rightIndex = leftIndex + 1; rightIndex < roots.length; rightIndex++ )
            {
                // Initialize the local values needed by this operation.

                const leftRoot  = roots [ leftIndex ];
                const rightRoot = roots [ rightIndex ];

                // Handle the case where at least one branch condition is satisfied.

                if ( leftRoot === undefined || rightRoot === undefined )
                {
                    continue;
                }

                considered++;
                const attempt = tryMergeClasses ( parents, graph, leftRoot, rightRoot );

                // Handle the case where attempt matches an absent value.

                if ( attempt === null )
                {
                    rejected++;
                    continue;
                }

                parents = attempt.parents;
                accepted++;
                completionChanged = true;
                report.push (
                    {
                        code:     "COMPLETION_MERGE_ACCEPTED",
                        category: "merge",
                        summary:  "The compatible-state completion pass accepted a merge.",
                        detail:   `Merged ${classKey ( parents, graph, findRoot ( parents, leftRoot ) )}.`,
                    },
                );
                break;
            }
        }
    }

    // Return the assembled result.

    return { parents, statistics: { considered, accepted, rejected }, report };
}

//--------------------------------------------------------------------------------------------------
// Function: conflictDiagnostic
//
// Description:
//
//   Derives the conflict diagnostic.
//
// Parameters:
//
//   - code:
//     The code supplied to the operation.
//
//   - message:
//     The message supplied to the operation.
//
//   - remediation:
//     The remediation supplied to the operation.
//
//   - locations:
//     The locations supplied to the operation.
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

function conflictDiagnostic (
    code: "DETERMINISM_CONFLICT" | "INITIAL_STATE_CONFLICT",
    message: string,
    remediation: string,
    locations: readonly SolverDiagnosticLocation[],
): SolverObservationDiagnostic
{
    // Return the assembled result.

    return {
        code,
        severity: "error",
        message,
        remediation,
        relatedLocations: uniqueLocations ( locations ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: applyForcedConstraints
//
// Description:
//
//   Applies the forced constraints.
//
// Parameters:
//
//   - graph:
//     The graph supplied to the operation.
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

function applyForcedConstraints (
    graph: EvidenceGraph,
):
    | { readonly isSuccessful: false; readonly diagnostic: SolverObservationDiagnostic }
    | { readonly isSuccessful: true; readonly parents: readonly number[]; readonly initialRoot: number; readonly report: readonly SolverInferenceReportEntry[] }
{
    // Initialize the local values needed by this operation.

    let parents: readonly number[]             = graph.nodes.map ( node => node.identifier );
    const report: SolverInferenceReportEntry[] = [];
    const nodesByExplicitState                 = new Map<string, number[]> ();

    // Process each node from the graph nodes collection in order.

    for ( const node of graph.nodes )
    {
        // Handle the case where node explicit state differs from an absent value.

        if ( node.explicitState !== null )
        {
            // Initialize the local values needed by this operation.

            const identifiers = nodesByExplicitState.get ( node.explicitState ) ?? [];

            identifiers.push ( node.identifier );
            nodesByExplicitState.set ( node.explicitState, identifiers );
        }
    }

    // Process each [ explicit state, identifiers ] from the sort result collection in order.

    for ( const [ explicitState, identifiers ] of [ ...nodesByExplicitState.entries () ].sort ( ( left, right ) =>
        compareText ( left [ 0 ], right [ 0 ] ) ) )
    {
        // Initialize the local values needed by this operation.

        const firstIdentifier = identifiers [ 0 ];

        // Handle the case where first identifier matches undefined.

        if ( firstIdentifier === undefined )
        {
            continue;
        }

        // Process each identifier from the slice result collection in order.

        for ( const identifier of identifiers.slice ( 1 ) )
        {
            // Initialize the local values needed by this operation.

            const attempt = tryMergeClasses ( parents, graph, firstIdentifier, identifier );

            // Handle the case where attempt matches an absent value.

            if ( attempt === null )
            {
                // Return the assembled result.

                return {
                    isSuccessful: false,
                    diagnostic: conflictDiagnostic (
                        "DETERMINISM_CONFLICT",
                        `Observations of '${explicitState}' imply incompatible deterministic behavior.`,
                        "Separate the conflicting evidence or correct its state, action, and event observations.",
                        [
                            ...classLocations ( parents, graph.nodes, findRoot ( parents, firstIdentifier ) ),
                            ...classLocations ( parents, graph.nodes, findRoot ( parents, identifier ) ),
                        ],
                    ),
                };
            }

            parents = attempt.parents;
        }
    }

    const initialNode = graph.initialNodes [ 0 ];

    // Handle the case where initial node differs from undefined.

    if ( initialNode !== undefined )
    {
        // Process each identifier from the slice result collection in order.

        for ( const identifier of graph.initialNodes.slice ( 1 ) )
        {
            // Initialize the local values needed by this operation.

            const attempt = tryMergeClasses ( parents, graph, initialNode, identifier );

            // Handle the case where attempt matches an absent value.

            if ( attempt === null )
            {
                // Return the assembled result.

                return {
                    isSuccessful: false,
                    diagnostic: conflictDiagnostic (
                        "INITIAL_STATE_CONFLICT",
                        "Initial-context observations imply incompatible initial-state behavior.",
                        "Make every initial-context leading interval describe one compatible initial state.",
                        graph.initialNodes.flatMap ( nodeIdentifier =>
                            classLocations ( parents, graph.nodes, findRoot ( parents, nodeIdentifier ) ) ),
                    ),
                };
            }

            parents = attempt.parents;
        }

        // Return the assembled result.

        return { isSuccessful: true, parents, initialRoot: findRoot ( parents, initialNode ), report };
    }

    const inferredInitialNode = graph.inferNodes [ 0 ] ?? graph.nodes [ 0 ]?.identifier;

    // Handle the case where inferred initial node matches undefined.

    if ( inferredInitialNode === undefined )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostic: conflictDiagnostic (
                "INITIAL_STATE_CONFLICT",
                "The evidence graph has no state from which to infer an initial state.",
                "Add an observation or use the zero-observation candidate path.",
                [],
            ),
        };
    }

    report.push (
        {
            code:     "INITIAL_STATE_INFERRED",
            category: "assumption",
            summary:  "The initial state was inferred.",
            detail:   graph.inferNodes.length > 0
                ? "No initial-context sample exists; the canonical infer-context start was selected."
                : "No initial-context sample exists; the canonical evidence state was selected as a weak initial assumption.",
        },
    );

    // Return the assembled result.

    return { isSuccessful: true, parents, initialRoot: findRoot ( parents, inferredInitialNode ), report };
}

//--------------------------------------------------------------------------------------------------
// Function: createGeneratedName
//
// Description:
//
//   Creates generated name.
//
// Parameters:
//
//   - usedNames:
//     The used names supplied to the operation.
//
//   - sequenceNumber:
//     The sequence number supplied to the operation.
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

function createGeneratedName ( usedNames: Set<string>, sequenceNumber: number ): string
{
    // Initialize the local values needed by this operation.

    let candidateNumber = sequenceNumber;

    // Continue the operation while its terminating condition has not been reached.

    while ( true )
    {
        // Initialize the local values needed by this operation.

        const name = `state_generated_${candidateNumber.toString ().padStart ( 4, "0" )}`;

        // Handle the case where the has result condition is not satisfied.

        if ( !usedNames.has ( name ) )
        {
            usedNames.add ( name );

            // Return the name.

            return name;
        }

        candidateNumber++;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: orderedRoots
//
// Description:
//
//   Derives the ordered roots.
//
// Parameters:
//
//   - parents:
//     The parents supplied to the operation.
//
//   - graph:
//     The graph supplied to the operation.
//
//   - initialRoot:
//     The initial root supplied to the operation.
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

function orderedRoots (
    parents: readonly number[],
    graph: EvidenceGraph,
    initialRoot: number,
): readonly number[]
{
    // Initialize the local values needed by this operation.

    const ordered: number[] = [];
    const queued            = new Set<number> ();
    const queue: number[]   = [ findRoot ( parents, initialRoot ) ];

    queued.add ( queue [ 0 ] ?? initialRoot );

    // Continue the operation while its terminating condition has not been reached.

    while ( queue.length > 0 )
    {
        // Initialize the local values needed by this operation.

        const root = queue.shift ();

        // Handle the case where root matches undefined.

        if ( root === undefined )
        {
            continue;
        }

        ordered.push ( root );

        // Process each destination from the outgoing roots result collection in order.

        for ( const destination of outgoingRoots ( parents, graph, root ) )
        {
            // Handle the case where the has result condition is not satisfied.

            if ( !queued.has ( destination ) )
            {
                queue.push ( destination );
                queued.add ( destination );
            }
        }
    }

    // Process each root from the canonical roots result collection in order.

    for ( const root of canonicalRoots ( parents, graph ) )
    {
        // Handle the case where the has result condition is not satisfied.

        if ( !queued.has ( root ) )
        {
            ordered.push ( root );
            queued.add ( root );
        }
    }

    // Return the ordered.

    return ordered;
}

//--------------------------------------------------------------------------------------------------
// Function: buildChart
//
// Description:
//
//   Builds chart.
//
// Parameters:
//
//   - stateNames:
//     The state names supplied to the operation.
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

function buildChart ( stateNames: readonly string[] ): ChartProjection
{
    // Calculate the placements value from the current inputs.

    const placements = stateNames.map ( ( state, index ) =>
        ( { state, x: ( index % 4 ) * 220, y: Math.floor ( index / 4 ) * 140 } ) );

    // Return the assembled result.

    return {
        settings: { expandStates: false },
        indicators:
        {
            initialStateIndicator: stateNames.length === 0
                ? null
                : { x: -80, y: 40, state: stateNames [ 0 ] ?? null },
            terminalStateIndicators:  [],
            terminalStateTransitions: [],
        },
        states:           placements,
        draftTransitions: [],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: deepFreeze
//
// Description:
//
//   Derives the deep freeze.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
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

function deepFreeze<T extends object> ( value: T ): Readonly<T>
{
    // Process each key from the own keys result collection in order.

    for ( const key of Reflect.ownKeys ( value ) )
    {
        // Initialize the local values needed by this operation.

        const nestedValue: unknown = Reflect.get ( value, key );

        // Handle the case where all required conditions are satisfied.

        if ( typeof nestedValue === "object" && nestedValue !== null && !Object.isFrozen ( nestedValue ) )
        {
            deepFreeze ( nestedValue );
        }
    }

    // Return the freeze result.

    return Object.freeze ( value );
}

//--------------------------------------------------------------------------------------------------
// Function: createCandidate
//
// Description:
//
//   Creates candidate.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - graph:
//     The graph supplied to the operation.
//
//   - mergeOutcome:
//     The merge outcome supplied to the operation.
//
//   - initialRoot:
//     The initial root supplied to the operation.
//
//   - preliminaryReport:
//     The preliminary report supplied to the operation.
//
//   - inputTokenCount:
//     The input token count supplied to the operation.
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

function createCandidate (
    request: SolverInferenceRequest,
    graph: EvidenceGraph,
    mergeOutcome: MergeOutcome,
    initialRoot: number,
    preliminaryReport: readonly SolverInferenceReportEntry[],
    inputTokenCount: number,
): SolverCandidate
{
    // Initialize the local values needed by this operation.

    const parents            = mergeOutcome.parents;
    const roots              = orderedRoots ( parents, graph, initialRoot );
    const membersByRoot      = classMembers ( parents, graph.nodes.length );
    const observedStateNames = [ ...new Set ( graph.nodes.flatMap ( node =>
        node.explicitState === null ? [] : [ node.explicitState ] ) ) ].sort ( compareText );
    const usedStateNames                = new Set ( observedStateNames );
    const stateNameByRoot               = new Map<number, string> ();
    const generatedStateNames: string[] = [];
    let generatedSequenceNumber         = 1;

    // Process each root from the roots collection in order.

    for ( const root of roots )
    {
        // Initialize the local values needed by this operation.

        const members       = membersByRoot.get ( root ) ?? [];
        const explicitState = members.flatMap ( identifier =>
        {
            // Initialize the local values needed by this operation.

            const state = graph.nodes [ identifier ]?.explicitState;

            // Return the result selected by the current condition.

            return state === null || state === undefined ? [] : [ state ];
        } ).sort ( compareText ) [ 0 ];
        const stateName = explicitState ?? createGeneratedName ( usedStateNames, generatedSequenceNumber );

        // Handle the case where explicit state matches undefined.

        if ( explicitState === undefined )
        {
            generatedStateNames.push ( stateName );
            generatedSequenceNumber = Number.parseInt ( stateName.slice ( -4 ), 10 ) + 1;
        }

        stateNameByRoot.set ( root, stateName );
    }

    // Initialize the local values needed by this operation.

    const events  = [ ...new Set ( graph.edges.map ( edge => edge.event ) ) ].sort ( compareText );
    const actions = [ ...new Set ( graph.nodes.flatMap ( node => node.entryActions ) ) ].sort ( compareText );
    const states  = roots.map ( root => ( {
        name:        stateNameByRoot.get ( root ) ?? "state_generated_0001",
        description: "",
    } ) );
    const entry = roots.flatMap ( root =>
    {
        // Initialize the local values needed by this operation.

        const members         = membersByRoot.get ( root ) ?? [];
        const actionsForState = graph.nodes [ members [ 0 ] ?? -1 ]?.entryActions ?? [];
        const state           = stateNameByRoot.get ( root ) ?? "";

        // Return the mapped collection.

        return actionsForState.map ( action => ( { state, action } ) );
    } );
    const transitions = roots.flatMap ( root => events.flatMap ( event =>
    {
        // Initialize the local values needed by this operation.

        const destinations = graph.edges.flatMap ( edge =>
            findRoot ( parents, edge.source ) === root && edge.event === event
                ? [ findRoot ( parents, edge.destination ) ]
                : [] );
        const destination = destinations [ 0 ];

        // Return the result selected by the current condition.

        return destination === undefined
            ? []
            : [
                {
                    state:     stateNameByRoot.get ( root ) ?? "",
                    event,
                    stateNext: stateNameByRoot.get ( destination ) ?? "",
                },
            ];
    } ) );
    const stateMachine: StateMachineDefinition<string> =
    {
        initialState: stateNameByRoot.get ( findRoot ( parents, initialRoot ) ) ?? states [ 0 ]?.name ?? "state_generated_0001",
        events: events.map ( name => ( { name, description: "" } ) ),
        states,
        actions: actions.map ( name => ( { name, description: "" } ) ),
        stateActions: { entry, exit: [] },
        transitionTable: transitions,
    };
    const stateProvenance = roots.map ( root =>
    {
        // Initialize the local values needed by this operation.

        const sources = uniqueLocations ( ( membersByRoot.get ( root ) ?? [] ).flatMap ( identifier =>
            graph.nodes [ identifier ]?.sources ?? [] ) );
        const state = stateNameByRoot.get ( root ) ?? "";

        // Return the assembled result.

        return {
            state,
            evidence: observedStateNames.includes ( state ) ? "observed" as const : "inferred" as const,
            sources,
        };
    } );
    const transitionProvenance = transitions.map ( transition =>
    {
        // Initialize the local values needed by this operation.

        const sourceRoot      = roots.find ( root => stateNameByRoot.get ( root ) === transition.state );
        const destinationRoot = roots.find ( root => stateNameByRoot.get ( root ) === transition.stateNext );
        const sourceRanges    = graph.edges.flatMap ( edge =>
            sourceRoot !== undefined && destinationRoot !== undefined && edge.event === transition.event &&
            findRoot ( parents, edge.source ) === sourceRoot && findRoot ( parents, edge.destination ) === destinationRoot
                ? [ edge.sourceRange ]
                : [] );
        const evidence = sourceRanges.some ( source =>
        {
            // Initialize the local values needed by this operation.

            const trace           = graph.traces.find ( candidateTrace => candidateTrace.observation.name === source.sequenceName );
            const sourceNodeIndex = trace?.nodeIdentifiers.findIndex ( identifier =>
                findRoot ( parents, identifier ) === sourceRoot ) ?? -1;
            const destinationNodeIndex = trace?.nodeIdentifiers.findIndex ( identifier =>
                findRoot ( parents, identifier ) === destinationRoot ) ?? -1;

            // Return the computed result.

            return sourceNodeIndex >= 0 && destinationNodeIndex === sourceNodeIndex + 1;
        } ) ? "observed" as const : "inferred" as const;

        // Return the assembled result.

        return { ...transition, evidence, sources: uniqueLocations ( sourceRanges ) };
    } );
    const traceCoverage: SolverCandidateTraceCoverage[] = graph.traces.map ( trace =>
        ( {
            sequenceName: trace.observation.name,
            startContext: trace.observation.startContext,
            isSuccessful: true,
            intervals: trace.observation.intervals.map ( ( interval, intervalIndex ) =>
            {
                // Initialize the local values needed by this operation.

                const nodeIdentifier = trace.nodeIdentifiers [ intervalIndex ] ?? -1;

                // Return the assembled result.

                return {
                    intervalIndex,
                    state: stateNameByRoot.get ( findRoot ( parents, nodeIdentifier ) ) ?? "",
                    incomingEvent: interval.incomingEvent,
                    entryActions:  interval.entryActions,
                    tokenStart:    interval.tokenStart,
                    tokenEndExclusive: interval.tokenEndExclusive,
                };
            } ),
        } ) );
    const report = [
        ...preliminaryReport,
        ...mergeOutcome.report,
        ...generatedStateNames.map ( stateName => ( {
            code:     "HIDDEN_STATE_INVENTED",
            category: "assumption" as const,
            summary:  `Generated state '${stateName}' was introduced.`,
            detail:   "No explicit state token named this evidence class; the deterministic generated name identifies it.",
        } ) ),
        {
            code:     "CONSISTENT_NOT_MINIMAL",
            category: "summary" as const,
            summary:  "The candidate is consistent with every hard observation.",
            detail:   "Finite positive evidence does not prove uniqueness or global state minimality.",
        },
    ];
    const chart                      = buildChart ( states.map ( state => state.name ) );
    const candidate: SolverCandidate = 
    {
        stateMachine,
        chart,
        baselineDocumentRevision: request.documentRevision,
        baselineSolverRevision:   request.solverRevision,
        provenance:
        {
            observedStateNames,
            generatedStateNames,
            reportEntries: report.map ( entryValue => `${entryValue.code}: ${entryValue.summary}` ),
            states:      stateProvenance,
            transitions: transitionProvenance,
        },
        traceCoverage,
        inferenceReport: report,
        statistics:
        {
            observationCount:    graph.traces.length,
            inputTokenCount,
            evidenceStateCount:  graph.nodes.length,
            candidateStateCount: states.length,
            transitionCount:     transitions.length,
            generatedStateCount: generatedStateNames.length,
            consideredMergeCount: mergeOutcome.statistics.considered,
            acceptedMergeCount:   mergeOutcome.statistics.accepted,
            rejectedMergeCount:   mergeOutcome.statistics.rejected,
        },
        consistencyStatement: "Consistent with all supplied hard observations; not asserted unique or globally minimal.",
    };

    // Return the deep freeze result.

    return deepFreeze ( candidate );
}

//--------------------------------------------------------------------------------------------------
// Function: capacityDiagnostic
//
// Description:
//
//   Derives the capacity diagnostic.
//
// Parameters:
//
//   - message:
//     The message supplied to the operation.
//
//   - remediation:
//     The remediation supplied to the operation.
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

function capacityDiagnostic ( message: string, remediation: string ): SolverObservationDiagnostic
{
    // Return the assembled result.

    return {
        code: "CAPACITY_EXCEEDED",
        severity: "error",
        message,
        remediation,
        relatedLocations: [],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createZeroObservationCandidate
//
// Description:
//
//   Creates zero observation candidate.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
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

function createZeroObservationCandidate ( request: SolverInferenceRequest ): SolverCandidate
{
    // Initialize the local values needed by this operation.

    const stateName = "state_generated_0001";

    // Return the deep freeze result.

    return deepFreeze (
        {
            stateMachine:
            {
                initialState: stateName,
                events: [],
                states: [ { name: stateName, description: "" } ],
                actions: [],
                stateActions: { entry: [], exit: [] },
                transitionTable: [],
            },
            chart: buildChart ( [ stateName ] ),
            baselineDocumentRevision: request.documentRevision,
            baselineSolverRevision: request.solverRevision,
            provenance:
            {
                observedStateNames: [],
                generatedStateNames: [ stateName ],
                reportEntries:
                [
                    "NO_OBSERVATIONS: No behavioral observations constrain this candidate.",
                    "CONSISTENT_NOT_MINIMAL: The candidate is consistent but not asserted unique or globally minimal.",
                ],
                states: [ { state: stateName, evidence: "inferred", sources: [] } ],
                transitions: [],
            },
            traceCoverage: [],
            inferenceReport:
            [
                {
                    code: "NO_OBSERVATIONS",
                    category: "assumption",
                    summary: "No behavioral observations constrain this candidate.",
                    detail: "A canonical one-state candidate with no transitions was created.",
                },
                {
                    code: "CONSISTENT_NOT_MINIMAL",
                    category: "summary",
                    summary: "The candidate is vacuously consistent.",
                    detail: "No uniqueness or global-minimality claim is made.",
                },
            ],
            statistics:
            {
                observationCount: 0,
                inputTokenCount: 0,
                evidenceStateCount: 0,
                candidateStateCount: 1,
                transitionCount: 0,
                generatedStateCount: 1,
                consideredMergeCount: 0,
                acceptedMergeCount: 0,
                rejectedMergeCount: 0,
            },
            consistencyStatement: "No observations supplied; candidate has no behavioral evidence and no minimality claim.",
        },
    );
}

//--------------------------------------------------------------------------------------------------
// Function: inferSolverCandidate
//
// Description:
//
//   Derives the infer solver candidate.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
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

export function inferSolverCandidate ( request: SolverInferenceRequest ): SolverInferenceResult
{
    // Initialize the local values needed by this operation.

    const inputTokenCount = request.observations.reduce ( ( total, observation ) =>
        total + observation.rawTokens.length, 0 );

    const normalization = normalizeSolverObservations ( request.observations );

    // Handle the case where the normalization is successful condition is not satisfied.

    if ( !normalization.isSuccessful )
    {
        // Return the assembled result.

        return { status: "failure", diagnostics: normalization.diagnostics };
    }

    // Handle the case where length equals 0.

    if ( normalization.observations.length === 0 )
    {
        // Return the assembled result.

        return {
            status: "success",
            candidate: createZeroObservationCandidate ( request ),
            diagnostics: normalization.diagnostics,
        };
    }

    const graph = buildEvidenceGraph ( normalization.observations );

    // Handle the case where at least one branch condition is satisfied.

    if ( graph.nodes.length > MAXIMUM_STATE_COUNT || graph.edges.length > MAXIMUM_TRANSITION_COUNT )
    {
        // Return the assembled result.

        return {
            status: "failure",
            diagnostics:
            [
                capacityDiagnostic (
                    `The evidence graph requires ${graph.nodes.length} states and ${graph.edges.length} transitions.`,
                    `Keep evidence below ${MAXIMUM_STATE_COUNT} prefix states and ${MAXIMUM_TRANSITION_COUNT} transitions.`,
                ),
            ],
        };
    }

    const forcedConstraints = applyForcedConstraints ( graph );

    // Handle the case where the forced constraints is successful condition is not satisfied.

    if ( !forcedConstraints.isSuccessful )
    {
        // Return the assembled result.

        return { status: "failure", diagnostics: [ ...normalization.diagnostics, forcedConstraints.diagnostic ] };
    }

    // Initialize the local values needed by this operation.

    const mergeOutcome = mergeEvidenceGraph (
        graph,
        forcedConstraints.parents,
        forcedConstraints.initialRoot,
    );
    const candidate = createCandidate (
        request,
        graph,
        mergeOutcome,
        forcedConstraints.initialRoot,
        forcedConstraints.report,
        inputTokenCount,
    );

    // Process each observation from the normalization observations collection in order.

    for ( const observation of normalization.observations )
    {
        // Initialize the local values needed by this operation.

        const replay = replaySolverObservation ( candidate, observation );

        // Handle the case where the replay is successful condition is not satisfied.

        if ( !replay.isSuccessful )
        {
            // Return the assembled result.

            return {
                status: "failure",
                diagnostics:
                [
                    ...normalization.diagnostics,
                    replay.diagnostic ?? {
                        code: "SOLVER_FAILURE",
                        severity: "error",
                        message: `Candidate replay failed for '${observation.name}'.`,
                        remediation: "Review the Solver evidence and retry.",
                        relatedLocations: [],
                    },
                ],
            };
        }
    }

    // Return the assembled result.

    return { status: "success", candidate, diagnostics: normalization.diagnostics };
}

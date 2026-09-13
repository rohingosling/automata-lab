// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    State Chart Edge Geometry Tests
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies deterministic presentation geometry for configured Chart relationships whose distinct
//   nodes share a center.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import { routeChartRelations } from "../../src/infrastructure/chart/orthogonal-chart-router.js";
import
{
    cubicBezierCurveSamplePoints,
    cubicBezierCurvesFromPreservedBackbone,
} from "../../src/application/chart-routing-backbone.js";
import
{
    calculateCenterRoutedEdgeGeometryFromCenters,
    createChartRoutingRelation,
    gravityPointsFromBackbone,
} from "../../src/presentation/chart/StateChartEdges.js";
import type
{
    ChartNodeBoundary,
    StateChartEdgeData,
} from "../../src/presentation/chart/StateChartEdges.js";

const SOURCE_BOUNDARY: ChartNodeBoundary = { height: 80, kind: "rectangle", radius: 0, width: 200 };
const TARGET_BOUNDARY: ChartNodeBoundary = { height: 120, kind: "rectangle", radius: 0, width: 160 };
const CENTER                             = { x: 320, y: 240 };

//--------------------------------------------------------------------------------------------------
// Function: transitionData
//
// Description:
//
//   Derives the transition data.
//
// Parameters:
//
//   - parallelLaneCount:
//     The parallel lane count supplied to the operation.
//
//   - parallelLanePosition:
//     The parallel lane position supplied to the operation.
//
//   - canonicalDirectionSign:
//     The canonical direction sign supplied to the operation.
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

function transitionData (
    parallelLaneCount: number,
    parallelLanePosition: number,
    canonicalDirectionSign: number,
): StateChartEdgeData
{
    // Return the assembled result.

    return {
        kind: "transition",
        state: "state_source",
        event: `event_${parallelLanePosition}`,
        stateNext: "state_target",
        transitionIndex: 0,
        canonicalDirectionSign,
        parallelLaneCount,
        parallelLanePosition,
        selfLoopIndex: null,
        sourceBoundary: SOURCE_BOUNDARY,
        sourceTechnicalSide: "right",
        targetBoundary: TARGET_BOUNDARY,
        targetTechnicalSide: "top",
        transitionGravityPointDistance: 12,
    };
}

describe ( "coincident-center configured edge geometry", () =>
{
    it ( "clips each endpoint to its own boundary and distinguishes reciprocal and parallel lanes", () =>
    {
        // Initialize the local values needed by this operation.

        const first = calculateCenterRoutedEdgeGeometryFromCenters (
            CENTER,
            CENTER,
            transitionData ( 3, -1, 1 ),
        );
        const reciprocal = calculateCenterRoutedEdgeGeometryFromCenters (
            CENTER,
            CENTER,
            transitionData ( 3, 0, -1 ),
        );
        const parallel = calculateCenterRoutedEdgeGeometryFromCenters (
            CENTER,
            CENTER,
            transitionData ( 3, 1, 1 ),
        );

        expect ( first.source ).toEqual ( { x: 420, y: 240 } );
        expect ( first.target ).toEqual ( { x: 320, y: 180 } );
        expect ( reciprocal.target ).toEqual ( { x: 320, y: 300 } );
        expect ( parallel.source ).toEqual ( { x: 220, y: 240 } );
        expect ( new Set ( [ first.path, reciprocal.path, parallel.path ] ).size ).toBe ( 3 );
        expect ( calculateCenterRoutedEdgeGeometryFromCenters (
            CENTER,
            CENTER,
            transitionData ( 3, -1, 1 ),
        ) ).toEqual ( first );
    } );

    it ( "keeps additional same-quadrant lanes distinct through deterministic rings", () =>
    {
        // Initialize the local values needed by this operation.

        const inner = calculateCenterRoutedEdgeGeometryFromCenters (
            CENTER,
            CENTER,
            transitionData ( 5, -2, 1 ),
        );
        const outer = calculateCenterRoutedEdgeGeometryFromCenters (
            CENTER,
            CENTER,
            transitionData ( 5, 2, 1 ),
        );

        expect ( outer.source ).toEqual ( inner.source );
        expect ( outer.target ).toEqual ( inner.target );
        expect ( outer.path ).not.toBe ( inner.path );
    } );
} );

describe ( "directly visible edge routing", () =>
{
    it ( "keeps zero- and full-fraction labels on ordinary, obstacle, self-loop, and coincident curves", () =>
    {
        // Initialize the local values needed by this operation.

        const scenarios = [
            {
                data: transitionData ( 1, 0, 1 ),
                sourceCenter: { x: 0, y: 0 },
                targetCenter: { x: 300, y: 180 },
            },
            {
                data:
                {
                    ...transitionData ( 1, 0, 1 ),
                    orthogonalObstacles: [ { height: 80, width: 80, x: 110, y: 50 } ],
                },
                sourceCenter: { x: 0, y: 0 },
                targetCenter: { x: 300, y: 180 },
            },
            {
                data: { ...transitionData ( 1, 0, 1 ), selfLoopIndex: 0 },
                sourceCenter: CENTER,
                targetCenter: CENTER,
            },
            {
                data: transitionData ( 2, -0.5, 1 ),
                sourceCenter: CENTER,
                targetCenter: CENTER,
            },
        ];

        // Process each scenario from the scenarios collection in order.

        for ( const scenario of scenarios )
        {
            // Initialize the local values needed by this operation.

            const start = calculateCenterRoutedEdgeGeometryFromCenters (
                scenario.sourceCenter,
                scenario.targetCenter,
                { ...scenario.data, transitionLabelPosition: 0 },
            );
            const end = calculateCenterRoutedEdgeGeometryFromCenters (
                scenario.sourceCenter,
                scenario.targetCenter,
                { ...scenario.data, transitionLabelPosition: 1 },
            );

            expect ( start.labelX ).toBeCloseTo ( start.source.x );
            expect ( start.labelY ).toBeCloseTo ( start.source.y );
            expect ( end.labelX ).toBeCloseTo ( end.target.x );
            expect ( end.labelY ).toBeCloseTo ( end.target.y );
        }
    } );

    it ( "places local Start and End labels at 20 and 80 percent of the final visible curve", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceCenter = { x: 0, y: 0 };
        const targetCenter = { x: 300, y: 0 };
        const data         = transitionData ( 1, 0, 1 );
        const start        = calculateCenterRoutedEdgeGeometryFromCenters (
            sourceCenter,
            targetCenter,
            { ...data, transitionLabelPosition: 0.2 },
        );
        const end = calculateCenterRoutedEdgeGeometryFromCenters (
            sourceCenter,
            targetCenter,
            { ...data, transitionLabelPosition: 0.8 },
        );

        expect ( start.source.x ).toBeCloseTo ( 100 );
        expect ( start.source.y ).toBeCloseTo ( 0 );
        expect ( start.target.x ).toBeCloseTo ( 220 );
        expect ( start.target.y ).toBeCloseTo ( 0 );
        expect ( start.labelX ).toBeCloseTo ( 124 );
        expect ( start.labelY ).toBeCloseTo ( 0 );
        expect ( end.labelX ).toBeCloseTo ( 196 );
        expect ( end.labelY ).toBeCloseTo ( 0 );
    } );

    it ( "uses no internal gravity point when no obstacle blocks the endpoints", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceCenter             = { x: 100, y: 100 };
        const targetCenter             = { x: 500, y: 300 };
        const data: StateChartEdgeData = {
            ...transitionData ( 1, 0, 1 ),
            orthogonalObstacles: [],
        };
        const relation = createChartRoutingRelation (
            "transition:direct",
            "event_direct",
            sourceCenter,
            targetCenter,
            data,
        );

        expect ( relation.preferredPoints ).toHaveLength ( 2 );
    } );

    it ( "uses no phantom label box for an unlabelled indicator relation", () =>
    {
        // Initialize the local values needed by this operation.

        const relation = createChartRoutingRelation (
            "initial-relation",
            "",
            { x: 100, y: 100 },
            { x: 500, y: 300 },
            { ...transitionData ( 1, 0, 1 ), kind: "initial", orthogonalObstacles: [] },
        );

        expect ( relation.labelHeight ).toBe ( 0 );
        expect ( relation.labelWidth ).toBe ( 0 );
    } );

    it ( "renders a worker label halfway along the final visible curve when endpoint widths differ", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceCenter             = { x: 0, y: 0 };
        const targetCenter             = { x: 400, y: 0 };
        const data: StateChartEdgeData = {
            ...transitionData ( 1, 0, 1 ),
            orthogonalLabelObstacles: [],
            orthogonalObstacles: [],
            sourceBoundary: { height: 80, kind: "rectangle", radius: 0, width: 200 },
            targetBoundary: { height: 80, kind: "rectangle", radius: 0, width: 50 },
            transitionLabelPosition: 0.5,
        };
        const relation = createChartRoutingRelation (
            "transition:asymmetric",
            "x",
            sourceCenter,
            targetCenter,
            data,
        );
        const routedGeometry = routeChartRelations ( {
            documentRevision: 1,
            geometryRevision: 1,
            preferenceRevision: 1,
            relations: [ relation ],
            requestId: "asymmetric-visible-curve",
            transitionGravityPointDistance: 24,
        } ).relations [ 0 ];

        expect ( relation.sourceBoundary ).toEqual ( data.sourceBoundary );
        expect ( relation.targetBoundary ).toEqual ( data.targetBoundary );
        expect ( routedGeometry ).toBeDefined ();

        // Handle the case where routed geometry matches undefined.

        if ( routedGeometry === undefined )
        {
            throw new Error ( "Expected the worker to return the asymmetric relation." );
        }

        const geometry = calculateCenterRoutedEdgeGeometryFromCenters (
            sourceCenter,
            targetCenter,
            { ...data, routedGeometry },
        );

        expect ( geometry.source.x ).toBeCloseTo ( 100 );
        expect ( geometry.target.x ).toBeCloseTo ( 375 );
        expect ( geometry.labelX ).toBeCloseTo ( 237.5 );
        expect ( geometry.labelY ).toBeCloseTo ( 0 );
    } );

    it ( "routes around one middle state with two center-derived gravity points", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceCenter             = { x: 0, y: 0 };
        const targetCenter             = { x: 0, y: 300 };
        const data: StateChartEdgeData = {
            ...transitionData ( 1, 0, 1 ),
            orthogonalObstacles:
            [
                { height: 80, width: 80, x: -40, y: 110 },
            ],
            sourceBoundary: { height: 80, kind: "rectangle", radius: 0, width: 80 },
            targetBoundary: { height: 80, kind: "rectangle", radius: 0, width: 80 },
        };
        const relation = createChartRoutingRelation (
            "transition:A:x:C",
            "x",
            sourceCenter,
            targetCenter,
            data,
        );
        const gravityPoints  = gravityPointsFromBackbone ( relation.preferredPoints );
        const routedRelation = routeChartRelations ( {
            documentRevision: 1,
            geometryRevision: 1,
            preferenceRevision: 1,
            relations: [ relation ],
            requestId: "middle-state-route",
            transitionGravityPointDistance: data.transitionGravityPointDistance,
        } ).relations [ 0 ];
        const previewGeometry = calculateCenterRoutedEdgeGeometryFromCenters ( sourceCenter, targetCenter, data );

        expect ( relation.preferredPoints ).toHaveLength ( 4 );
        expect ( relation.preferredPoints [ 0 ] ).toEqual ( sourceCenter );
        expect ( relation.preferredPoints [ 1 ]?.y ).toBeCloseTo ( sourceCenter.y );
        expect ( relation.preferredPoints [ 2 ]?.y ).toBeCloseTo ( targetCenter.y );
        expect ( relation.preferredPoints [ 3 ] ).toEqual ( targetCenter );
        expect ( gravityPoints ).toHaveLength ( 2 );
        expect ( gravityPoints [ 0 ]?.x ).toBeLessThanOrEqual ( -64 );
        expect ( gravityPoints [ 1 ]?.x ).toBeCloseTo ( gravityPoints [ 0 ]?.x ?? Number.NaN );
        expect ( previewGeometry.path.match ( / C /g )?.length ?? 0 ).toBeGreaterThan ( 1 );
        expect ( routedRelation?.curves.length ?? 0 ).toBeGreaterThan ( 1 );

        // Process each point from the cubic bezier curve sample points result collection in order.

        for ( const point of cubicBezierCurveSamplePoints ( routedRelation?.curves ?? [] ) )
        {
            expect ( point.x > -52 && point.x < 52 && point.y > 98 && point.y < 202 ).toBe ( false );
        }
    } );

    it ( "clips the completed center curve without changing its boundary tangents", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceCenter = { x: 0, y: 0 };
        const targetCenter = { x: 0, y: 300 };
        const routedPoints = [
            sourceCenter,
            { x: -120, y: 60 },
            { x: -120, y: 240 },
            targetCenter,
        ];
        const data: StateChartEdgeData = {
            ...transitionData ( 1, 0, 1 ),
            routedGeometry:
            {
                curves: cubicBezierCurvesFromPreservedBackbone ( routedPoints ),
                exteriorFallback: false,
                identifier: "transition:A:x:C",
                label: { height: 22, width: 28, x: -134, y: 139 },
                points: routedPoints,
            },
            sourceBoundary: { height: 80, kind: "rectangle", radius: 0, width: 80 },
            targetBoundary: { height: 80, kind: "rectangle", radius: 0, width: 80 },
        };
        const geometry    = calculateCenterRoutedEdgeGeometryFromCenters ( sourceCenter, targetCenter, data );
        const coordinates = geometry.path.match ( /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi )?.map ( Number ) ?? [];

        expect ( coordinates ).toHaveLength ( 8 );
        expect ( geometry.source.x ).toBeCloseTo ( -40, 6 );
        expect ( geometry.source.y ).toBeCloseTo ( 28.258521225, 6 );
        expect ( coordinates [ 2 ] ).toBeCloseTo ( -106.666666667, 6 );
        expect ( coordinates [ 3 ] ).toBeCloseTo ( 92.856040575, 6 );
        expect ( coordinates [ 4 ] ).toBeCloseTo ( -106.666666667, 6 );
        expect ( coordinates [ 5 ] ).toBeCloseTo ( 207.143959425, 6 );
        expect ( geometry.target.x ).toBeCloseTo ( -40, 6 );
        expect ( geometry.target.y ).toBeCloseTo ( 271.741478775, 6 );
        expect ( geometry.gravityPoints ).toEqual ( routedPoints.slice ( 1, -1 ) );
        expect ( geometry.source ).not.toEqual ( { x: 0, y: 40 } );
        expect ( geometry.target ).not.toEqual ( { x: 0, y: 260 } );
    } );
} );

describe ( "gravity-point diagnostics", () =>
{
    it ( "returns only effective interior backbone influences", () =>
    {
        expect ( gravityPointsFromBackbone ( [
            { x: 0, y: 0 },
            { x: 0, y: 50 },
            { x: 0, y: 100 },
            { x: 50, y: 100 },
            { x: 100, y: 100 },
        ] ) ).toEqual ( [ { x: 0, y: 100 } ] );
        expect ( gravityPointsFromBackbone ( [
            { x: 0, y: 0 },
            { x: 100, y: 100 },
        ] ) ).toEqual ( [] );
    } );
} );

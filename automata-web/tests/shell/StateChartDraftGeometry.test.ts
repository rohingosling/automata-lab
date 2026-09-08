// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Draft Relation Geometry Tests
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies that unfinished relations share configured curve geometry while independently clipping
//   attached endpoints and retaining free endpoint coordinates through routing Worker transport.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import
{
    clipCubicBezierCurvesToBoundaries,
    cubicBezierCurvesFromPreservedBackbone,
} from "../../src/application/chart-routing-backbone.js";
import type { ChartRoutingRequest } from "../../src/application/ports/contracts.js";
import { routeChartRelations } from "../../src/infrastructure/chart/orthogonal-chart-router.js";
import
{
    CHART_ROUTING_PROTOCOL_VERSION,
    decodeChartRoutingWorkerRequest,
} from "../../src/protocol/chart-routing-worker-protocol.js";
import
{
    calculateCenterRoutedEdgeGeometryFromCenters,
    createChartRoutingRelation,
} from "../../src/presentation/chart/StateChartEdges.js";
import type
{
    ChartNodeBoundary,
    StateChartRelationGeometry,
} from "../../src/presentation/chart/StateChartEdges.js";

const SOURCE_BOUNDARY: ChartNodeBoundary = { height: 80, kind: "rectangle", radius: 0, width: 200 };
const TARGET_BOUNDARY: ChartNodeBoundary = { height: 120, kind: "rectangle", radius: 0, width: 160 };
const SOURCE_CENTER = { x: 0, y: 0 };
const TARGET_CENTER = { x: 600, y: 0 };

//--------------------------------------------------------------------------------------------------
// Function: createRelationGeometry
//
// Description:
//
//   Builds geometry without inventing semantic state or event identities for unfinished relations.
//
//--------------------------------------------------------------------------------------------------

function createRelationGeometry ( attachments: number ): StateChartRelationGeometry
{
    return {
        canonicalDirectionSign: 1,
        parallelLaneCount: 1,
        parallelLanePosition: 0,
        selfLoopIndex: null,
        transitionGravityPointDistance: 12,
        orthogonalObstacles: [],
        ...( ( attachments & 1 ) === 0 ? {} : { sourceBoundary: SOURCE_BOUNDARY } ),
        ...( ( attachments & 2 ) === 0 ? {} : { targetBoundary: TARGET_BOUNDARY } ),
    };
}

describe ( "shared geometry for independently attached transition ends", () =>
{
    it.each ( [ 0, 1, 2, 3 ] ) ( "preserves free ends and clips attached ends: %s", attachments =>
    {
        const data = createRelationGeometry ( attachments );
        const relation = createChartRoutingRelation ( "draft:42", "x", SOURCE_CENTER, TARGET_CENTER, data );
        const request: ChartRoutingRequest = {
            documentRevision: 1,
            geometryRevision: 1,
            preferenceRevision: 1,
            requestId: `attachment:${attachments}`,
            relations: [ relation ],
            transitionGravityPointDistance: 12,
        };
        const envelope = {
            generation: 1,
            kind: "route",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
            request,
        };
        const decoded = decodeChartRoutingWorkerRequest ( envelope );
        const routed = routeChartRelations ( request ).relations [ 0 ];
        const expectedSource = ( attachments & 1 ) === 0 ? SOURCE_CENTER.x : 100;
        const expectedTarget = ( attachments & 2 ) === 0 ? TARGET_CENTER.x : 520;

        expect ( decoded ).toEqual ( envelope );
        expect ( relation.sourceBoundary ).toEqual ( data.sourceBoundary );
        expect ( relation.targetBoundary ).toEqual ( data.targetBoundary );
        expect ( relation.preferredPoints [ 0 ] ).toEqual ( SOURCE_CENTER );
        expect ( relation.preferredPoints.at ( -1 ) ).toEqual ( TARGET_CENTER );
        expect ( routed ).toBeDefined ();

        if ( routed === undefined )
        {
            throw new Error ( "The routing result must contain the requested relation." );
        }

        const preview = calculateCenterRoutedEdgeGeometryFromCenters ( SOURCE_CENTER, TARGET_CENTER, data );
        const geometry = calculateCenterRoutedEdgeGeometryFromCenters (
            SOURCE_CENTER, TARGET_CENTER, { ...data, routedGeometry: routed },
        );

        expect ( preview.source.x ).toBeCloseTo ( expectedSource, 6 );
        expect ( preview.target.x ).toBeCloseTo ( expectedTarget, 6 );
        expect ( geometry.source.x ).toBeCloseTo ( expectedSource, 6 );
        expect ( geometry.target.x ).toBeCloseTo ( expectedTarget, 6 );
        expect ( geometry.source.y ).toBeCloseTo ( 0, 8 );
        expect ( geometry.target.y ).toBeCloseTo ( 0, 8 );
        expect ( routed.label.x + routed.label.width / 2 ).toBeCloseTo (
            ( expectedSource + expectedTarget ) / 2, 6,
        );
    } );

    it.each ( [ "source", "target" ] as const ) ( "clips the actual curved %s intersection", endpoint =>
    {
        const sourceCenter = { x: 0, y: 0 };
        const targetCenter = { x: 0, y: 300 };
        const points = [ sourceCenter, { x: -120, y: 60 }, { x: -120, y: 240 }, targetCenter ];
        const curves = cubicBezierCurvesFromPreservedBackbone ( points );
        const boundary: ChartNodeBoundary = { height: 80, kind: "rectangle", radius: 0, width: 80 };
        const boundaries = endpoint === "source" ? { sourceBoundary: boundary } : { targetBoundary: boundary };
        const clipped = clipCubicBezierCurvesToBoundaries ( curves, {
            ...boundaries, sourceCenter, targetCenter,
        } );
        const geometry = calculateCenterRoutedEdgeGeometryFromCenters ( sourceCenter, targetCenter, {
            ...createRelationGeometry ( 0 ),
            ...boundaries,
            routedGeometry:
            {
                curves,
                exteriorFallback: false,
                identifier: "draft:42",
                label: { x: 0, y: 0, height: 0, width: 0 },
                points,
            },
        } );

        expect ( geometry [ endpoint ].x ).toBeCloseTo ( -40, 6 );
        expect ( geometry [ endpoint ].y ).toBeCloseTo (
            endpoint === "source" ? 28.258521225 : 271.741478775, 6,
        );
        expect ( geometry.source ).toEqual ( clipped?.[ 0 ]?.source );
        expect ( geometry.target ).toEqual ( clipped?.at ( -1 )?.target );
        expect ( geometry [ endpoint === "source" ? "target" : "source" ] ).toEqual (
            endpoint === "source" ? targetCenter : sourceCenter,
        );
    } );

    it.each ( [ "sourceBoundary", "targetBoundary" ] as const ) (
        "rejects malformed independently supplied %s metadata", boundaryName =>
        {
            const relation = createChartRoutingRelation (
                "draft:42", "", SOURCE_CENTER, TARGET_CENTER, createRelationGeometry ( 0 ),
            );
            const envelope = {
                generation: 1,
                kind: "route",
                protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
                request:
                {
                    documentRevision: 1,
                    geometryRevision: 1,
                    preferenceRevision: 1,
                    requestId: "malformed-boundary",
                    relations: [ { ...relation, [ boundaryName ]: { ...SOURCE_BOUNDARY, width: -1 } } ],
                    transitionGravityPointDistance: 12,
                },
            };

            expect ( decodeChartRoutingWorkerRequest ( envelope ) ).toBeNull ();
        },
    );
} );

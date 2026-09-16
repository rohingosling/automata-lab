// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Draft Transition Rendering Tests
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies shared curve/grip geometry, stale Worker rejection and preserved self-loop labels.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { selfTransitionLoopGeometry } from "../../src/application/chart-self-transition-loops.js";
import type { ChartRoutingResultRelation } from "../../src/application/ports/contracts.js";
import
{
    StateChartDraftTransitionNodeComponent,
    draftTransitionDisplayGeometry,
} from "../../src/presentation/chart/StateChartNodes.js";
import type { StateChartDraftTransitionNodeData } from "../../src/presentation/chart/StateChartNodes.js";

const nodeData: StateChartDraftTransitionNodeData = {
    draftTransitionId: 1,
    label: "Draft transition 1",
    origin: { x: 100, y: 100 },
    source: { x: 150, y: 50 },
    sourceState: "A",
    target: { x: 500, y: 50 },
    transitionArrowHeadSize: 10,
    relationGeometry: {
        canonicalDirectionSign: 1,
        parallelLaneCount: 1,
        parallelLanePosition: 0,
        selfLoopIndex: null,
        sourceBoundary: { kind: "rectangle", width: 300, height: 100, radius: 10 },
        transitionGravityPointDistance: 50,
    },
};

afterEach ( cleanup );

describe ( "Draft transition rendering", () =>
{
    it ( "renders the shared clipped curve while retaining a separate generous curve hit target", () =>
    {
        const geometry = draftTransitionDisplayGeometry ( nodeData );
        const properties = {
            id: "draft-transition:1", type: "draftTransition", data: nodeData, selected: true,
            dragging: false, draggable: true, selectable: true, deletable: true,
            isConnectable: false, positionAbsoluteX: 100, positionAbsoluteY: 100, zIndex: 0,
        } as Parameters<typeof StateChartDraftTransitionNodeComponent>[ 0 ];
        const { container } = render ( <StateChartDraftTransitionNodeComponent { ...properties } /> );
        const path = container.querySelector ( ".chart-draft-transition-path" );
        const hitTarget = container.querySelector ( ".chart-draft-transition-hit" );

        expect ( geometry?.source.x ).toBeCloseTo ( 400 );
        expect ( geometry?.source.y ).toBeCloseTo ( 150 );
        expect ( geometry?.target ).toEqual ( { x: 600, y: 150 } );
        expect ( path ).toHaveAttribute ( "d", geometry?.path );
        expect ( path ).toHaveAttribute ( "transform", "translate(-100 -100)" );
        expect ( hitTarget ).toHaveAttribute ( "d", geometry?.path );
        expect ( container.querySelector ( ".chart-transition-selected" ) ).not.toBeNull ();
        expect ( container.querySelector ( ".chart-node-selected" ) ).toBeNull ();
        expect ( container.querySelectorAll ( ".chart-draft-transition-node > svg > path" ) ).toHaveLength ( 1 );
    } );

    it ( "rejects a route from the previous endpoint position for both the renderer and grip geometry", () =>
    {
        const staleRoute: ChartRoutingResultRelation = {
            curves: [], exteriorFallback: false, identifier: "draft-transition:1",
            label: { x: 900, y: 800, width: 100, height: 20 },
            points: [ { x: 150, y: 150 }, { x: 600, y: 150 } ],
        };
        const actual = draftTransitionDisplayGeometry ( { ...nodeData, routedGeometry: staleRoute } );
        const current = draftTransitionDisplayGeometry ( nodeData );

        expect ( actual ).toEqual ( current );
        expect ( actual?.labelX ).not.toBe ( 950 );
    } );

    it ( "retains a matching self-loop Worker label whose endpoints are the ellipse boundary grips", () =>
    {
        const center = { x: 250, y: 150 };
        const loop = selfTransitionLoopGeometry (
            { center, cornerRadius: 10, width: 300, height: 100 }, "top", 2, 75 );
        const route: ChartRoutingResultRelation = {
            curves: loop.curves, exteriorFallback: false, identifier: "draft-transition:1",
            label: { x: 900, y: 800, width: 100, height: 20 },
            points: [ loop.exit, loop.outerVertex, loop.entry ],
        };
        const geometry = draftTransitionDisplayGeometry ( {
            ...nodeData, target: nodeData.source, targetState: "A", routedGeometry: route,
            relationGeometry: { ...nodeData.relationGeometry!, selfLoopGeometry: loop, selfLoopIndex: 0 },
        } );

        expect ( geometry?.source ).toEqual ( loop.exit );
        expect ( geometry?.target ).toEqual ( loop.entry );
        expect ( geometry?.labelX ).toBe ( 950 );
        expect ( geometry?.labelY ).toBe ( 810 );
    } );
} );

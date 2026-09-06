// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Transition Repair Integration Tests
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Exercises visible endpoint controls against real command revisions, file round trips, shared
//   routing requests and retained-event restoration while keeping the React Flow host
//   deterministic.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChartLayoutPort, ChartRoutingPort } from "../../src/application/ports/contracts.js";
import
{
    createDocumentEditorState,
    executeDocumentCommand,
    planDocumentCommand,
    redoDocumentCommand,
    undoDocumentCommand,
} from "../../src/domain/model/commands.js";
import type { AuthoringDraft } from "../../src/domain/model/contracts.js";
import { serializeCanonicalDocument } from "../../src/domain/model/canonicalization.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { routeChartRelations } from "../../src/infrastructure/chart/orthogonal-chart-router.js";
import { openAuthoringDocument } from "../../src/infrastructure/files/file-codec.js";
import { ChartPage } from "../../src/presentation/chart/ChartPage.js";
import type { StateChartEdge } from "../../src/presentation/chart/StateChartEdges.js";
import { calculateCenterRoutedEdgeGeometryFromCenters } from "../../src/presentation/chart/StateChartEdges.js";
import type { StateChartNode } from "../../src/presentation/chart/StateChartNodes.js";
import { draftTransitionDisplayGeometry } from "../../src/presentation/chart/StateChartNodes.js";

//--------------------------------------------------------------------------------------------------
// Interface: ReactFlowRepairProperties
//
// Description:
//
//   Carries the rendered graph and selection callbacks needed by the deterministic Chart host.
//
//--------------------------------------------------------------------------------------------------
interface ReactFlowRepairProperties
{
    readonly children?: ReactNode;
    readonly nodes?: readonly StateChartNode[];
    readonly edges?: readonly StateChartEdge[];
    readonly onSelectionChange?: ( selection: {
        readonly nodes: readonly StateChartNode[];
        readonly edges: readonly StateChartEdge[];
    } ) => void;
    readonly onNodeClick?: ( event: MouseEvent, node: StateChartNode ) => void;
    readonly onNodeDoubleClick?: ( event: MouseEvent, node: StateChartNode ) => void;
}

const { flowRender, interactionError } = vi.hoisted ( () => ( {
    flowRender: vi.fn<( properties: ReactFlowRepairProperties ) => void> (),
    interactionError: vi.fn (),
} ) );

vi.mock ( "@xyflow/react", async () =>
{
    const actual = await vi.importActual<typeof import ( "@xyflow/react" )> ( "@xyflow/react" );
    return {
        ...actual,
        useUpdateNodeInternals: () => () => undefined,
        Background: () => null,
        BaseEdge: () => null,
        Controls: () => null,
        ReactFlowProvider: ( properties: { readonly children?: ReactNode } ) => <>{ properties.children }</>,
        ViewportPortal: ( properties: { readonly children?: ReactNode } ) => <>{ properties.children }</>,
        ReactFlow: ( properties: ReactFlowRepairProperties ) =>
        {
            flowRender ( properties );
            return <div>
                { properties.nodes?.map ( node => <div
                    aria-label={ node.ariaLabel }
                    className={ `react-flow__node react-flow__node-${node.type}` }
                    data-id={ node.id }
                    key={ node.id }
                    onClick={ event => properties.onNodeClick?. ( event, node ) }
                    onDoubleClick={ event => properties.onNodeDoubleClick?. ( event, node ) }
                    role={ node.ariaRole }
                    tabIndex={ 0 }
                /> ) }
                { properties.edges?.map ( edge => <button key={ edge.id } onClick={ () =>
                    properties.onSelectionChange?. ( { nodes: [], edges: [ edge ] } ) }>{ `Select ${edge.ariaLabel}` }</button> ) }
                { properties.children }
            </div>;
        },
    };
} );

const layoutPort: ChartLayoutPort = {
    layout: async nodes => ( {
        effectiveMinimumStateDistance: 500,
        states: nodes.map ( ( node, index ) => ( { state: node.state, x: index * 500, y: 100 } ) ),
    } ),
};

//--------------------------------------------------------------------------------------------------
// Function: createFixture
//
// Description:
//
//   Places three states at known chart coordinates for semantic and unfinished endpoint gestures.
//
//--------------------------------------------------------------------------------------------------

function createFixture (): AuthoringDraft
{
    const empty = createEmptyAuthoringDraft ( false );
    return {
        ...empty,
        stateMachine:
        {
            ...empty.stateMachine,
            states: [ "A", "B", "C" ].map ( name => ( { name, description: "" } ) ),
            events: [ "x", "y" ].map ( name => ( { name, description: "" } ) ),
            initialState: "A",
        },
        chart:
        {
            ...empty.chart,
            states: [
                { state: "A", x: 100, y: 100 },
                { state: "B", x: 700, y: 100 },
                { state: "C", x: 700, y: 400 },
            ],
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: RepairHarness
//
// Description:
//
//   Applies actual document commands, history and file replacement around the Chart interaction.
//
//--------------------------------------------------------------------------------------------------

function RepairHarness ( properties: { readonly initial: AuthoringDraft; readonly routingPort?: ChartRoutingPort } )
{
    const [ editor, setEditor ] = useState ( () => createDocumentEditorState ( properties.initial ) );
    return <>
        <button onClick={ () =>
        {
            const planned = planDocumentCommand ( editor, {
                kind: "replace_chart_geometry",
                statePlacements: editor.draft.chart.states.map ( state =>
                    state.state === "A" ? { ...state, x: state.x + 100 } : state ),
                initialStateIndicator: editor.draft.chart.indicators.initialStateIndicator,
                terminalStateIndicators: editor.draft.chart.indicators.terminalStateIndicators,
                draftTransitions: editor.draft.chart.draftTransitions,
                expectedRevision: editor.documentRevision,
            } );
            if ( !planned.isSuccessful )
            {
                throw new Error ( planned.message );
            }
            const executed = executeDocumentCommand ( editor, planned.plan );
            if ( executed.isSuccessful )
            {
                setEditor ( executed.state );
            }
        } }>Move fixture state A</button>
        <button onClick={ () =>
        {
            const result = undoDocumentCommand ( editor );
            if ( result.isSuccessful )
            {
                setEditor ( result.state );
            }
        } }>Undo fixture</button>
        <button onClick={ () =>
        {
            const result = redoDocumentCommand ( editor );
            if ( result.isSuccessful )
            {
                setEditor ( result.state );
            }
        } }>Redo fixture</button>
        <button onClick={ () =>
        {
            const opened = openAuthoringDocument ( serializeCanonicalDocument ( editor.draft ).text );
            if ( !opened.isSuccessful )
            {
                throw new Error ( "The detached transition file must remain valid." );
            }
            setEditor ( createDocumentEditorState ( opened.document ) );
        } }>Save and reopen fixture</button>
        <output data-testid="repair-document">{ JSON.stringify ( editor.draft ) }</output>
        <ChartPage
            diagnostics={ [] }
            documentRevision={ editor.documentRevision }
            draft={ editor.draft }
            layoutPort={ layoutPort }
            nameWrapping={ { actionNames: false, eventNames: false, stateNames: false } }
            onCommand={ factory =>
            {
                const planned = planDocumentCommand ( editor, factory ( editor.documentRevision ) );
                if ( !planned.isSuccessful )
                {
                    return false;
                }
                const executed = executeDocumentCommand ( editor, planned.plan );
                if ( !executed.isSuccessful )
                {
                    return false;
                }
                setEditor ( executed.state );
                return true;
            } }
            onInteractionError={ interactionError }
            onNew={ () => undefined }
            { ...( properties.routingPort === undefined ? {} : { routingPort: properties.routingPort } ) }
        />
    </>;
}

//--------------------------------------------------------------------------------------------------
// Function: currentDraft
//
// Description:
//
//   Reads the real authoring draft emitted by the integration harness.
//
//--------------------------------------------------------------------------------------------------

function currentDraft (): AuthoringDraft
{
    return JSON.parse ( screen.getByTestId ( "repair-document" ).textContent ?? "null" ) as AuthoringDraft;
}

//--------------------------------------------------------------------------------------------------
// Function: dragGrip
//
// Description:
//
//   Moves a displayed grip from its actual position so center-to-boundary offsets cannot hide bugs.
//
//--------------------------------------------------------------------------------------------------

function dragGrip ( grip: HTMLElement, target: { readonly x: number; readonly y: number }, cancel = false ): void
{
    fireEvent.pointerDown ( grip, {
        button: 0, pointerId: 19,
        clientX: Number.parseFloat ( grip.style.left ), clientY: Number.parseFloat ( grip.style.top ),
    } );
    fireEvent.pointerMove ( grip, { pointerId: 19, clientX: target.x, clientY: target.y } );
    fireEvent [ cancel ? "pointerCancel" : "pointerUp" ] ( grip, {
        pointerId: 19, clientX: target.x, clientY: target.y,
    } );
}

afterEach ( () =>
{
    cleanup ();
    flowRender.mockReset ();
    interactionError.mockReset ();
} );

describe ( "transition attachment repairs", () =>
{
    it ( "places a one-sided grip on the boundary and follows state movement", () =>
    {
        const fixture = createFixture ();
        render ( <RepairHarness initial={ {
            ...fixture,
            chart: { ...fixture.chart, draftTransitions: [ {
                id: 42, source: { x: 250, y: 150 }, sourceState: "A", target: { x: 600, y: 150 },
            } ] },
        } } /> );
        const grip = () => screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        expect ( Number.parseFloat ( grip ().style.left ) ).toBeCloseTo ( 400, 6 );
        expect ( Number.parseFloat ( grip ().style.top ) ).toBeCloseTo ( 150, 6 );
        fireEvent.click ( screen.getByRole ( "button", { name: "Move fixture state A" } ) );
        expect ( Number.parseFloat ( grip ().style.left ) ).toBeCloseTo ( 500, 6 );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.sourceState ).toBe ( "A" );
        dragGrip ( grip (), { x: 850, y: 450 } );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.sourceState ).toBe ( "C" );
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
    } );

    it ( "uses attachment identity when keyboard movement begins on a clipped state boundary", () =>
    {
        const fixture = createFixture ();
        render ( <RepairHarness initial={ {
            ...fixture,
            chart: { ...fixture.chart, draftTransitions: [ {
                id: 42, source: { x: 250, y: 150 }, sourceState: "A", target: { x: 600, y: 150 },
            } ] },
        } } /> );
        const grip = screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        fireEvent.keyDown ( grip, { key: "ArrowLeft" } );
        fireEvent.keyUp ( grip, { key: "ArrowLeft" } );
        const transition = currentDraft ().chart.draftTransitions [ 0 ];
        expect ( transition?.sourceState ).toBeNull ();
        expect ( transition?.source.x ).toBeCloseTo ( 390, 6 );
        expect ( transition?.source.y ).toBeCloseTo ( 150, 6 );
    } );

    it ( "keeps attached grips still on pointer-down and retains Worker geometry after cancellation", async () =>
    {
        const fixture = createFixture ();
        const route = vi.fn<ChartRoutingPort[ "route" ]> ( async request => routeChartRelations ( request ) );
        render ( <RepairHarness routingPort={ { route, cancel: async () => undefined } } initial={ {
            ...fixture,
            chart: { ...fixture.chart, draftTransitions: [ {
                id: 42, source: { x: 250, y: 150 }, sourceState: "A", target: { x: 600, y: 450 },
                rememberedEvent: "x", rememberedTransitionIndex: 0,
            } ] },
        } } /> );
        const currentNode = () => flowRender.mock.calls.at ( -1 )?.[ 0 ].nodes?.find (
            node => node.type === "draftTransition",
        );
        await waitFor ( () =>
        {
            const node = currentNode ();
            expect ( node?.type === "draftTransition" ? node.data.routedGeometry : undefined ).toBeDefined ();
        } );
        const originalNode = currentNode ();
        if ( originalNode?.type !== "draftTransition" )
        {
            throw new Error ( "The routed draft must exist before pointer interaction." );
        }
        const originalGeometry = draftTransitionDisplayGeometry ( originalNode.data );
        const grip = screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        const originalPosition = { left: grip.style.left, top: grip.style.top };
        const pointer = {
            button: 0, pointerId: 47,
            clientX: Number.parseFloat ( grip.style.left ), clientY: Number.parseFloat ( grip.style.top ),
        };
        fireEvent.pointerDown ( grip, pointer );
        expect ( { left: grip.style.left, top: grip.style.top } ).toEqual ( originalPosition );
        fireEvent.pointerUp ( grip, pointer );
        const afterClick = currentNode ();
        expect ( afterClick?.type === "draftTransition" ? afterClick.data.routedGeometry : undefined )
            .toEqual ( originalNode.data.routedGeometry );
        dragGrip ( screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } ),
            { x: 500, y: 350 }, true );
        const afterCancel = currentNode ();
        expect ( afterCancel?.type === "draftTransition" ? afterCancel.data.routedGeometry : undefined )
            .toEqual ( originalNode.data.routedGeometry );
        expect ( afterCancel?.type === "draftTransition" ? draftTransitionDisplayGeometry ( afterCancel.data ) : undefined )
            .toEqual ( originalGeometry );
        expect ( route ).toHaveBeenCalledTimes ( 1 );
    } );

    it.each ( [ "source", "target" ] as const ) (
        "detaches and automatically restores the remembered event after Save/Open: %s", endpoint =>
        {
            const fixture = createFixture ();
            render ( <RepairHarness initial={ {
                ...fixture,
                stateMachine: { ...fixture.stateMachine, transitionTable: [ { state: "A", event: "x", stateNext: "B" } ] },
            } } /> );
            fireEvent.click ( screen.getByRole ( "button", { name: "Select A, x, B" } ) );
            dragGrip ( screen.getByRole ( "button", { name: `Reconnect transition ${endpoint} endpoint A, x, B` } ),
                { x: 550, y: 350 } );
            expect ( currentDraft ().stateMachine.transitionTable ).toEqual ( [] );
            const detached = currentDraft ().chart.draftTransitions [ 0 ];
            expect ( detached?.rememberedEvent ).toBe ( "x" );
            expect ( endpoint === "source" ? detached?.targetState : detached?.sourceState )
                .toBe ( endpoint === "source" ? "B" : "A" );
            fireEvent.click ( screen.getByRole ( "button", { name: "Undo fixture" } ) );
            expect ( currentDraft ().chart.draftTransitions ).toHaveLength ( 0 );
            expect ( currentDraft ().stateMachine.transitionTable ).toHaveLength ( 1 );
            fireEvent.click ( screen.getByRole ( "button", { name: "Redo fixture" } ) );
            expect ( currentDraft ().stateMachine.transitionTable ).toHaveLength ( 0 );
            fireEvent.click ( screen.getByRole ( "button", { name: "Save and reopen fixture" } ) );
            expect ( currentDraft ().chart.draftTransitions [ 0 ]?.rememberedEvent ).toBe ( "x" );
            const identifier = currentDraft ().chart.draftTransitions [ 0 ]?.id;
            dragGrip ( screen.getByRole ( "button", { name: `Move draft transition ${endpoint} endpoint ${identifier}` } ),
                { x: 850, y: 450 } );
            expect ( currentDraft ().chart.draftTransitions ).toHaveLength ( 0 );
            expect ( currentDraft ().stateMachine.transitionTable ).toEqual ( [ {
                state: endpoint === "source" ? "C" : "A", event: "x", stateNext: endpoint === "source" ? "B" : "C",
            } ] );
            expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
        },
    );

    it ( "retains the unfinished relation when automatic restoration conflicts", () =>
    {
        const fixture = createFixture ();
        render ( <RepairHarness initial={ {
            ...fixture,
            stateMachine: { ...fixture.stateMachine, transitionTable: [
                { state: "A", event: "x", stateNext: "B" }, { state: "C", event: "x", stateNext: "A" },
            ] },
        } } /> );
        fireEvent.click ( screen.getByRole ( "button", { name: "Select A, x, B" } ) );
        dragGrip ( screen.getByRole ( "button", { name: "Reconnect transition source endpoint A, x, B" } ),
            { x: 550, y: 350 } );
        const identifier = currentDraft ().chart.draftTransitions [ 0 ]?.id;
        dragGrip ( screen.getByRole ( "button", { name: `Move draft transition source endpoint ${identifier}` } ),
            { x: 850, y: 450 } );
        expect ( currentDraft ().stateMachine.transitionTable ).toEqual ( [ { state: "C", event: "x", stateNext: "A" } ] );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.rememberedEvent ).toBe ( "x" );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.targetState ).toBe ( "B" );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.sourceState ).toBeNull ();
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
    } );

    it ( "cancels a semantic detach without changing the model or creating a draft", () =>
    {
        const fixture = createFixture ();
        const initial = {
            ...fixture,
            stateMachine: { ...fixture.stateMachine, transitionTable: [ { state: "A", event: "x", stateNext: "B" } ] },
        };
        render ( <RepairHarness initial={ initial } /> );
        fireEvent.click ( screen.getByRole ( "button", { name: "Select A, x, B" } ) );
        dragGrip ( screen.getByRole ( "button", { name: "Reconnect transition target endpoint A, x, B" } ),
            { x: 550, y: 350 }, true );
        expect ( currentDraft () ).toEqual ( initial );
    } );

    it.each ( [ [ "ordinary", false, false ], [ "loop", true, false ], [ "parallel", false, true ] ] as const ) (
        "uses the same routed geometry for an attached draft and semantic relation: %s",
        async ( _scenario, selfTransition, parallel ) =>
        {
            const fixture = createFixture ();
            const route = vi.fn<ChartRoutingPort[ "route" ]> ( async request => routeChartRelations ( request ) );
            const routingPort: ChartRoutingPort = { route, cancel: async () => undefined };
            const targetState = selfTransition ? "A" : "B";
            const targetPoint = selfTransition ? { x: 250, y: 150 } : { x: 850, y: 150 };
            const view = render ( <RepairHarness routingPort={ routingPort } initial={ {
                ...fixture,
                stateMachine: { ...fixture.stateMachine, transitionTable: parallel
                    ? [ { state: "A", event: "y", stateNext: targetState } ] : [] },
                chart: { ...fixture.chart, draftTransitions: [ {
                    id: 42, sourceState: "A", targetState, source: { x: 250, y: 150 }, target: targetPoint,
                    rememberedEvent: "x", rememberedTransitionIndex: 0,
                } ] },
            } } /> );
            await waitFor ( () => expect ( route ).toHaveBeenCalled () );
            const draftRequest = route.mock.calls.at ( -1 )?.[ 0 ].relations.at ( -1 );
            await waitFor ( () =>
            {
                const node = flowRender.mock.calls.at ( -1 )?.[ 0 ].nodes?.find ( candidate => candidate.type === "draftTransition" );
                expect ( node?.type === "draftTransition" ? node.data.routedGeometry : undefined ).toBeDefined ();
            } );
            const draftNode = flowRender.mock.calls.at ( -1 )?.[ 0 ].nodes?.find ( node => node.type === "draftTransition" );
            const draftGeometry = draftNode?.type === "draftTransition" ? draftTransitionDisplayGeometry ( draftNode.data ) : null;
            view.unmount ();
            route.mockClear ();
            render ( <RepairHarness routingPort={ routingPort } initial={ {
                ...fixture,
                stateMachine: { ...fixture.stateMachine, transitionTable: [
                    { state: "A", event: "x", stateNext: targetState },
                    ...( parallel ? [ { state: "A", event: "y", stateNext: targetState } ] : [] ),
                ] },
            } } /> );
            await waitFor ( () => expect ( route ).toHaveBeenCalled () );
            const semanticRequest = route.mock.calls.at ( -1 )?.[ 0 ].relations [ 0 ];
            expect ( { ...draftRequest, identifier: "relation" } ).toEqual ( { ...semanticRequest, identifier: "relation" } );
            await waitFor ( () => expect ( flowRender.mock.calls.at ( -1 )?.[ 0 ].edges?.[ 0 ]?.data?.routedGeometry ).toBeDefined () );
            const edge = flowRender.mock.calls.at ( -1 )?.[ 0 ].edges?.[ 0 ];
            expect ( edge?.data ).toBeDefined ();
            if ( edge?.data === undefined )
            {
                throw new Error ( "The semantic edge must expose its shared geometry." );
            }
            const semanticGeometry = calculateCenterRoutedEdgeGeometryFromCenters ( { x: 250, y: 150 }, targetPoint, edge.data );
            if ( parallel )
            {
                expect ( draftGeometry?.path ).toBe ( semanticGeometry.path );
                expect ( draftGeometry?.source ).toEqual ( semanticGeometry.source );
                expect ( draftGeometry?.target ).toEqual ( semanticGeometry.target );
            }
            else
            {
                expect ( draftGeometry ).toEqual ( semanticGeometry );
            }
        },
    );
} );

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

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NodeChange } from "@xyflow/react";
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
import type { AuthoringDraft, ChartIndicatorReference } from "../../src/domain/model/contracts.js";
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
    readonly onNodesChange?: ( changes: NodeChange<StateChartNode>[] ) => void;
    readonly onInit?: ( instance: {
        readonly getNodes: () => StateChartNode[];
        readonly getViewport: () => { readonly x: number; readonly y: number; readonly zoom: number };
        readonly screenToFlowPosition: ( point: { readonly x: number; readonly y: number },
            options?: { readonly snapToGrid?: boolean } ) => { readonly x: number; readonly y: number };
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
                { properties.edges?.map ( edge => <button className="react-flow__edge" data-id={ edge.id } key={ edge.id } onClick={ () =>
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

function RepairHarness ( properties: { readonly initial: AuthoringDraft; readonly routingPort?: ChartRoutingPort;
    readonly deleteOrphanedItems?: boolean } )
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
            { ...( properties.deleteOrphanedItems === undefined ? {}
                : { deleteOrphanedChartItemsDuringAutomaticLayout: properties.deleteOrphanedItems } ) }
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
// Function: initializeMockCanvas
//
// Description:
//
//   Starts the real scene-readiness and deferred-focus lifecycle after a mocked canvas remount.
//--------------------------------------------------------------------------------------------------

function initializeMockCanvas ( gridSize: number | null = null ): void
{
    act ( () => flowRender.mock.calls.at ( -1 )?.[ 0 ].onInit?. ( {
        getNodes: () => [ ...flowRender.mock.calls.at ( -1 )?.[ 0 ].nodes ?? [] ],
        getViewport: () => ( { x: 0, y: 0, zoom: 1 } ),
        screenToFlowPosition: ( point, options ) => gridSize !== null && options?.snapToGrid !== false ? {
            x: Math.round ( point.x / gridSize ) * gridSize, y: Math.round ( point.y / gridSize ) * gridSize,
        } : point,
    } ) );
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

//--------------------------------------------------------------------------------------------------
// Function: createIndicatorFixture
//
// Description:
//
//   Places two indicator symbols and one eventless palette draft at independent coordinates.
//--------------------------------------------------------------------------------------------------

function createIndicatorFixture (): AuthoringDraft
{
    const fixture = createFixture ();
    return {
        ...fixture,
        chart: {
            ...fixture.chart,
            indicators: {
                initialStateIndicator: { x: 0, y: 150, state: null },
                terminalStateIndicators: [ { id: 0, x: 600, y: 450 } ],
                terminalStateTransitions: [],
            },
            draftTransitions: [ { id: 42, source: { x: 0, y: 300 }, target: { x: 500, y: 300 } } ],
        },
    };
}

describe ( "indicator draft connections", () =>
{
    it.each ( [ "initial", "terminal" ] as const ) ( "attaches either role to %s and completes in either order", kind =>
    {
        for ( const indicatorEndpoint of [ "source", "target" ] as const )
        {
            for ( const indicatorFirst of [ true, false ] )
            {
                const indicator: ChartIndicatorReference = kind === "initial" ? { kind } : { kind, id: 0 };
                const fixture = createIndicatorFixture ();
                const view = render ( <RepairHarness initial={ fixture } /> );
                const stateEndpoint = indicatorEndpoint === "source" ? "target" : "source";
                const attachedEndpoint = kind === "initial" ? "source" : "target";
                const freeEndpoint = kind === "initial" ? "target" : "source";
                const connectIndicator = () => dragGrip (
                    screen.getByRole ( "button", { name: "Move draft transition " + indicatorEndpoint + " endpoint 42" } ),
                    kind === "initial" ? { x: 0, y: 150 } : { x: 600, y: 450 },
                );
                const connectState = () => dragGrip (
                    screen.getByRole ( "button", { name: "Move draft transition " + ( indicatorFirst ? freeEndpoint : stateEndpoint ) + " endpoint 42" } ),
                    { x: 850, y: 150 },
                );
                if ( indicatorFirst )
                {
                    connectIndicator ();
                    const draft = currentDraft ().chart.draftTransitions [ 0 ];
                    expect ( attachedEndpoint === "source" ? draft?.sourceIndicator : draft?.targetIndicator )
                        .toEqual ( indicator );
                    expect ( draft?.[ freeEndpoint ] ).toEqual ( fixture.chart.draftTransitions [ 0 ]?.[ stateEndpoint ] );
                    expect ( screen.queryByRole ( "dialog" ) ).not.toBeInTheDocument ();
                    connectState ();
                }
                else
                {
                    connectState ();
                    connectIndicator ();
                }
                expect ( currentDraft ().chart.draftTransitions ).toEqual ( [] );
                expect ( currentDraft ().stateMachine.transitionTable ).toEqual ( [] );
                expect ( screen.queryByRole ( "dialog" ) ).not.toBeInTheDocument ();
                if ( kind === "initial" )
                {
                    expect ( currentDraft ().stateMachine.initialState ).toBe ( "B" );
                    expect ( currentDraft ().chart.indicators.initialStateIndicator?.state ).toBe ( "B" );
                    expect ( flowRender.mock.calls.at ( -1 )?.[ 0 ].edges ).toContainEqual (
                        expect.objectContaining ( { id: "initial-relation", source: "initial-indicator", target: "state:B" } ),
                    );
                }
                else
                {
                    expect ( currentDraft ().stateMachine.initialState ).toBe ( "A" );
                    expect ( currentDraft ().chart.indicators.terminalStateTransitions )
                        .toEqual ( [ { state: "B", terminalStateIndicatorId: 0 } ] );
                }
                view.unmount ();
            }
        }
    } );

    it.each ( [ "initial", "terminal" ] as const ) (
        "immediately reverses a wrong %s end and keeps physical grip focus, history and free-end completion", async kind =>
    {
        const fixture = createIndicatorFixture ();
        render ( <RepairHarness initial={ fixture } /> );
        const wrongEndpoint = kind === "initial" ? "target" : "source";
        const attachedEndpoint = kind === "initial" ? "source" : "target";
        const freeEndpoint = wrongEndpoint;
        const indicator: ChartIndicatorReference = kind === "initial" ? { kind } : { kind, id: 0 };
        const center = kind === "initial" ? { x: 0, y: 150 } : { x: 600, y: 450 };
        const originalFreePoint = fixture.chart.draftTransitions [ 0 ]?.[ attachedEndpoint ];
        const grip = ( endpoint: "source" | "target" ) => screen.getByRole ( "button", {
            name: "Move draft transition " + endpoint + " endpoint 42",
        } );
        dragGrip ( grip ( wrongEndpoint ), center, true );
        expect ( currentDraft () ).toEqual ( fixture );
        dragGrip ( grip ( wrongEndpoint ), center );
        const attached = currentDraft ();
        expect ( attached.chart.draftTransitions [ 0 ]?.[ attachedEndpoint ] ).toEqual ( center );
        expect ( attached.chart.draftTransitions [ 0 ]?.[ freeEndpoint ] ).toEqual ( originalFreePoint );
        expect ( attachedEndpoint === "source" ? attached.chart.draftTransitions [ 0 ]?.sourceIndicator
            : attached.chart.draftTransitions [ 0 ]?.targetIndicator ).toEqual ( indicator );
        initializeMockCanvas ();
        await waitFor ( () => expect ( grip ( attachedEndpoint ) ).toHaveFocus () );
        const attachedGrip = grip ( attachedEndpoint );
        dragGrip ( attachedGrip, {
            x: Number.parseFloat ( attachedGrip.style.left ), y: Number.parseFloat ( attachedGrip.style.top ),
        } );
        expect ( currentDraft () ).toEqual ( attached );
        fireEvent.click ( screen.getByRole ( "button", { name: "Undo fixture" } ) );
        expect ( currentDraft () ).toEqual ( fixture );
        fireEvent.click ( screen.getByRole ( "button", { name: "Redo fixture" } ) );
        expect ( currentDraft () ).toEqual ( attached );
        fireEvent.click ( screen.getByRole ( "button", { name: "Save and reopen fixture" } ) );
        const reopened = currentDraft ().chart.draftTransitions [ 0 ];
        expect ( reopened?.[ attachedEndpoint ] ).toEqual ( center );
        expect ( reopened?.[ freeEndpoint ] ).toEqual ( originalFreePoint );
        expect ( attachedEndpoint === "source" ? reopened?.sourceIndicator : reopened?.targetIndicator ).toEqual ( indicator );
        dragGrip ( grip ( freeEndpoint ), { x: 850, y: 150 } );
        expect ( currentDraft ().chart.draftTransitions ).toEqual ( [] );
        expect ( screen.queryByRole ( "dialog" ) ).not.toBeInTheDocument ();
        expect ( kind === "initial" ? currentDraft ().chart.indicators.initialStateIndicator?.state
            : currentDraft ().chart.indicators.terminalStateTransitions [ 0 ]?.state ).toBe ( "B" );
    } );

    it.each ( [ "initial", "terminal" ] as const ) (
        "remaps deferred keyboard focus after a wrong %s end attaches", async kind =>
    {
        const fixture = createIndicatorFixture ();
        const wrongEndpoint = kind === "initial" ? "target" : "source";
        const attachedEndpoint = kind === "initial" ? "source" : "target";
        const nearIndicator = kind === "initial" ? { x: -30, y: 150 } : { x: 565, y: 450 };
        const freePoint = { x: -300, y: nearIndicator.y };
        render ( <RepairHarness initial={ { ...fixture, chart: { ...fixture.chart, draftTransitions: [ {
            id: 42,
            source: wrongEndpoint === "source" ? nearIndicator : freePoint,
            target: wrongEndpoint === "target" ? nearIndicator : freePoint,
        } ] } } } /> );
        const grip = ( endpoint: "source" | "target" ) => screen.getByRole ( "button", {
            name: "Move draft transition " + endpoint + " endpoint 42",
        } );
        grip ( wrongEndpoint ).focus ();
        fireEvent.keyDown ( grip ( wrongEndpoint ), { key: "ArrowRight" } );
        await waitFor ( () => expect ( attachedEndpoint === "source"
            ? currentDraft ().chart.draftTransitions [ 0 ]?.sourceIndicator
            : currentDraft ().chart.draftTransitions [ 0 ]?.targetIndicator ).toEqual (
            kind === "initial" ? { kind } : { kind, id: 0 },
        ) );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.[ wrongEndpoint ] ).toEqual ( freePoint );
        initializeMockCanvas ();
        await waitFor ( () => expect ( grip ( attachedEndpoint ) ).toHaveFocus () );
        fireEvent.keyDown ( grip ( attachedEndpoint ), { key: "ArrowLeft" } );
        await waitFor ( () => expect ( attachedEndpoint === "source"
            ? currentDraft ().chart.draftTransitions [ 0 ]?.sourceIndicator
            : currentDraft ().chart.draftTransitions [ 0 ]?.targetIndicator ).toBeNull () );
        expect ( screen.queryByRole ( "dialog" ) ).not.toBeInTheDocument ();
    } );

    it.each ( [ "initial", "terminal" ] as const ) (
        "consumes a completed draft for an already connected %s relation without duplicating it", kind =>
    {
        const fixture = createIndicatorFixture ();
        const indicators = { ...fixture.chart.indicators,
            initialStateIndicator: { x: 0, y: 150, state: "A" },
            terminalStateTransitions: kind === "terminal" ? [ { state: "A", terminalStateIndicatorId: 0 } ] : [],
        };
        render ( <RepairHarness initial={ { ...fixture, chart: { ...fixture.chart, indicators } } } /> );
        const wrongEndpoint = kind === "initial" ? "target" : "source";
        const grip = () => screen.getByRole ( "button", {
            name: "Move draft transition " + wrongEndpoint + " endpoint 42",
        } );
        dragGrip ( grip (), kind === "initial" ? { x: 0, y: 150 } : { x: 600, y: 450 } );
        const attached = currentDraft ();
        dragGrip ( grip (), { x: 250, y: 150 } );
        const completed = currentDraft ();
        expect ( completed.chart.draftTransitions ).toEqual ( [] );
        expect ( completed.chart.indicators ).toEqual ( indicators );
        expect ( completed.stateMachine ).toEqual ( fixture.stateMachine );
        expect ( screen.queryByRole ( "dialog" ) ).not.toBeInTheDocument ();
        expect ( flowRender.mock.calls.at ( -1 )?.[ 0 ].edges?.filter (
            edge => edge.data?.kind === kind,
        ) ).toHaveLength ( 1 );
        fireEvent.click ( screen.getByRole ( "button", { name: "Undo fixture" } ) );
        expect ( currentDraft () ).toEqual ( attached );
        fireEvent.click ( screen.getByRole ( "button", { name: "Redo fixture" } ) );
        expect ( currentDraft () ).toEqual ( completed );
    } );

    it ( "keeps half-attached circle grips on the boundary and preserves them through history and Save/Open", () =>
    {
        render ( <RepairHarness initial={ createIndicatorFixture () } /> );
        dragGrip ( screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } ), { x: 0, y: 150 } );
        const attached = currentDraft ();
        const grip = () => screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        expect ( Math.hypot ( Number.parseFloat ( grip ().style.left ), Number.parseFloat ( grip ().style.top ) - 150 ) )
            .toBeCloseTo ( 25, 5 );
        fireEvent.click ( screen.getByRole ( "button", { name: "Undo fixture" } ) );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.sourceIndicator ).toBeUndefined ();
        fireEvent.click ( screen.getByRole ( "button", { name: "Redo fixture" } ) );
        expect ( currentDraft () ).toEqual ( attached );
        fireEvent.click ( screen.getByRole ( "button", { name: "Save and reopen fixture" } ) );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.sourceIndicator ).toEqual ( { kind: "initial" } );
        fireEvent.doubleClick ( grip () );
        expect ( screen.queryByRole ( "dialog" ) ).not.toBeInTheDocument ();
        expect ( screen.getByRole ( "button", { name: "Move draft transition target endpoint 42" } ) ).toHaveFocus ();
    } );

    it ( "hits the visible indicator circle above a state and excludes transparent wrapper corners", () =>
    {
        const fixture = createIndicatorFixture ();
        render ( <RepairHarness initial={ {
            ...fixture, chart: { ...fixture.chart, indicators: { ...fixture.chart.indicators,
                initialStateIndicator: { x: 200, y: 150, state: null } } },
        } } /> );
        dragGrip ( screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } ), { x: 224, y: 150 } );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.sourceIndicator ).toEqual ( { kind: "initial" } );
        dragGrip ( screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } ), { x: 629, y: 450 } );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.targetIndicator ).toEqual ( { kind: "terminal", id: 0 } );
        dragGrip ( screen.getByRole ( "button", { name: "Move draft transition target endpoint 42" } ), { x: 625, y: 475 } );
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.targetIndicator ).toBeNull ();
        expect ( currentDraft ().chart.draftTransitions [ 0 ]?.targetState ).toBeNull ();
    } );

    it ( "connects and detaches an indicator by keyboard without snapping back into the same symbol", async () =>
    {
        const fixture = createIndicatorFixture ();
        render ( <RepairHarness initial={ { ...fixture, chart: { ...fixture.chart,
            draftTransitions: [ { id: 42, source: { x: -30, y: 150 }, target: { x: -300, y: 150 } } ],
        } } } /> );
        const grip = () => screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        fireEvent.keyDown ( grip (), { key: "ArrowRight" } );
        await waitFor ( () => expect ( currentDraft ().chart.draftTransitions [ 0 ]?.sourceIndicator ).toEqual ( { kind: "initial" } ) );
        fireEvent.keyDown ( grip (), { key: "ArrowLeft" } );
        await waitFor ( () => expect ( currentDraft ().chart.draftTransitions [ 0 ]?.sourceIndicator ).toBeNull () );
    } );

    it ( "preserves an attached indicator on click and cancellation and rejects remembered-event indicator drops", () =>
    {
        const fixture = createIndicatorFixture ();
        const view = render ( <RepairHarness initial={ fixture } /> );
        const grip = () => screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        dragGrip ( grip (), { x: 0, y: 150 } );
        const attached = currentDraft ();
        dragGrip ( grip (), { x: Number.parseFloat ( grip ().style.left ), y: Number.parseFloat ( grip ().style.top ) } );
        expect ( currentDraft () ).toEqual ( attached );
        dragGrip ( grip (), { x: -200, y: 150 }, true );
        expect ( currentDraft () ).toEqual ( attached );
        view.unmount ();
        const remembered = { ...fixture, chart: { ...fixture.chart, draftTransitions: [ {
            id: 42, source: { x: 0, y: 300 }, target: { x: 500, y: 300 }, rememberedEvent: "x", rememberedTransitionIndex: 0,
        } ] } };
        render ( <RepairHarness initial={ remembered } /> );
        dragGrip ( grip (), { x: 0, y: 150 } );
        expect ( currentDraft () ).toEqual ( remembered );
        dragGrip ( grip (), { x: 600, y: 450 } );
        expect ( currentDraft () ).toEqual ( remembered );
        dragGrip ( screen.getByRole ( "button", { name: "Move draft transition target endpoint 42" } ), { x: 0, y: 150 } );
        expect ( currentDraft () ).toEqual ( remembered );
    } );

    it.each ( [ "initial", "terminal" ] as const ) (
        "normalizes an active legacy %s redrop on the same symbol and preserves actual no-move gestures", async kind =>
    {
        for ( const bothAttached of [ false, true ] )
        {
            const fixture = createIndicatorFixture ();
            const legacyEndpoint = kind === "initial" ? "target" : "source";
            const attachedEndpoint = kind === "initial" ? "source" : "target";
            const center = kind === "initial" ? { x: 0, y: 150 } : { x: 600, y: 450 };
            const oppositePoint = bothAttached ? { x: 850, y: 150 } : { x: 0, y: 300 };
            const oppositeState = bothAttached ? "B" : null;
            const indicator: ChartIndicatorReference = kind === "initial" ? { kind } : { kind, id: 0 };
            const transition = kind === "initial" ? {
                id: 42, source: oppositePoint, sourceState: oppositeState, target: center, targetIndicator: indicator,
            } : {
                id: 42, source: center, sourceIndicator: indicator, target: oppositePoint, targetState: oppositeState,
            };
            const initial = { ...fixture, chart: { ...fixture.chart, draftTransitions: [ transition ] } };
            const view = render ( <RepairHarness initial={ initial } /> );
            const grip = () => screen.getByRole ( "button", {
                name: "Move draft transition " + legacyEndpoint + " endpoint 42",
            } );
            dragGrip ( grip (), {
                x: Number.parseFloat ( grip ().style.left ), y: Number.parseFloat ( grip ().style.top ),
            } );
            expect ( currentDraft () ).toEqual ( initial );
            dragGrip ( grip (), center, true );
            expect ( currentDraft () ).toEqual ( initial );
            dragGrip ( grip (), center );
            if ( bothAttached )
            {
                expect ( currentDraft ().chart.draftTransitions ).toEqual ( [] );
                expect ( kind === "initial" ? currentDraft ().chart.indicators.initialStateIndicator?.state
                    : currentDraft ().chart.indicators.terminalStateTransitions [ 0 ]?.state ).toBe ( "B" );
            }
            else
            {
                const normalized = currentDraft ().chart.draftTransitions [ 0 ];
                expect ( normalized?.[ attachedEndpoint ] ).toEqual ( center );
                expect ( normalized?.[ legacyEndpoint ] ).toEqual ( oppositePoint );
                expect ( attachedEndpoint === "source" ? normalized?.sourceIndicator : normalized?.targetIndicator )
                    .toEqual ( indicator );
            }
            initializeMockCanvas ();
            await waitFor ( () => expect ( bothAttached ? document.querySelector (
                '.react-flow__node[data-id="' + ( kind === "initial" ? "initial-indicator" : "terminal:0" ) + '"]',
            ) : screen.getByRole ( "button", {
                name: "Move draft transition " + attachedEndpoint + " endpoint 42",
            } ) ).toHaveFocus () );
            expect ( screen.queryByRole ( "dialog" ) ).not.toBeInTheDocument ();
            view.unmount ();
        }
    } );

    it ( "detects real client movement within one grid cell when redropping a legacy indicator end", async () =>
    {
        const fixture = createIndicatorFixture ();
        const initial = { ...fixture, chart: { ...fixture.chart,
            indicators: { ...fixture.chart.indicators, initialStateIndicator: { x: 50, y: 50, state: null } },
            draftTransitions: [ {
                id: 42, source: { x: -150, y: 50 }, target: { x: 50, y: 50 }, targetIndicator: { kind: "initial" as const },
            } ],
        } };
        render ( <RepairHarness initial={ initial } /> );
        initializeMockCanvas ( 50 );
        const grip = () => screen.getByRole ( "button", { name: "Move draft transition target endpoint 42" } );
        const initialClientPoint = {
            x: Math.round ( Number.parseFloat ( grip ().style.left ) ) + 1,
            y: Math.round ( Number.parseFloat ( grip ().style.top ) ),
        };
        expect ( initialClientPoint ).toEqual ( { x: 26, y: 50 } );
        const pointerDown = () => fireEvent.pointerDown ( grip (), {
            button: 0, pointerId: 19, clientX: initialClientPoint.x, clientY: initialClientPoint.y,
        } );
        pointerDown ();
        fireEvent.pointerUp ( grip (), {
            button: 0, pointerId: 19, clientX: initialClientPoint.x, clientY: initialClientPoint.y,
        } );
        expect ( currentDraft () ).toEqual ( initial );
        pointerDown ();
        fireEvent.pointerMove ( grip (), { pointerId: 19, clientX: 50, clientY: 50 } );
        fireEvent.pointerUp ( grip (), { button: 0, pointerId: 19, clientX: 50, clientY: 50 } );
        expect ( currentDraft ().chart.draftTransitions [ 0 ] ).toMatchObject ( {
            source: { x: 50, y: 50 }, sourceIndicator: { kind: "initial" }, target: { x: -150, y: 50 },
        } );
        initializeMockCanvas ( 50 );
        await waitFor ( () => expect ( screen.getByRole ( "button", {
            name: "Move draft transition source endpoint 42",
        } ) ).toHaveFocus () );
        expect ( screen.queryByRole ( "dialog" ) ).not.toBeInTheDocument ();
    } );

    it ( "preserves a previously saved opposite-role indicator on passive render and Open", () =>
    {
        const fixture = createIndicatorFixture ();
        render ( <RepairHarness initial={ { ...fixture, chart: { ...fixture.chart, draftTransitions: [ {
            id: 42, source: { x: 0, y: 300 }, target: { x: 0, y: 150 }, targetIndicator: { kind: "initial" },
        } ] } } } /> );
        const beforeOpen = currentDraft ().chart.draftTransitions;
        fireEvent.click ( screen.getByRole ( "button", { name: "Save and reopen fixture" } ) );
        expect ( currentDraft ().chart.draftTransitions ).toEqual ( beforeOpen );
        const node = flowRender.mock.calls.at ( -1 )?.[ 0 ].nodes?.find ( candidate => candidate.type === "draftTransition" );
        expect ( node?.type === "draftTransition" ? node.data.targetIndicator : null ).toEqual ( { kind: "initial" } );
        expect ( screen.queryByRole ( "dialog" ) ).not.toBeInTheDocument ();
    } );

    it ( "renders and deletes a direct initial-to-terminal relation through the existing command history", () =>
    {
        render ( <RepairHarness initial={ createIndicatorFixture () } /> );
        dragGrip ( screen.getByRole ( "button", { name: "Move draft transition target endpoint 42" } ), { x: 0, y: 150 } );
        dragGrip ( screen.getByRole ( "button", { name: "Move draft transition target endpoint 42" } ), { x: 600, y: 450 } );
        expect ( currentDraft ().chart.draftTransitions ).toEqual ( [] );
        expect ( currentDraft ().chart.indicators.indicatorTransitions ).toEqual ( [ {
            id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 0 },
        } ] );
        const edge = flowRender.mock.calls.at ( -1 )?.[ 0 ].edges?.find ( candidate => candidate.id === "indicator-relation:0" );
        expect ( edge ).toMatchObject ( { source: "initial-indicator", target: "terminal:0",
            data: { sourceBoundary: { kind: "circle", radius: 25 }, targetBoundary: { kind: "circle", radius: 30 } } } );
        fireEvent.click ( screen.getByRole ( "button", { name: "Select " + edge?.ariaLabel } ) );
        fireEvent.keyDown ( document.querySelector ( ".chart-canvas" ) ?? document.body, { key: "Delete" } );
        expect ( currentDraft ().chart.indicators.indicatorTransitions ).toEqual ( [] );
        fireEvent.click ( screen.getByRole ( "button", { name: "Undo fixture" } ) );
        expect ( currentDraft ().chart.indicators.indicatorTransitions ).toHaveLength ( 1 );
    } );
    it ( "reprojects attached grips during indicator movement and whole-draft movement previews", () =>
    {
        render ( <RepairHarness initial={ createIndicatorFixture () } /> );
        dragGrip ( screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } ), { x: 0, y: 150 } );
        act ( () => flowRender.mock.calls.at ( -1 )?.[ 0 ].onNodesChange?. ( [ {
            type: "position", id: "initial-indicator", position: { x: 160, y: 110 },
        } ] ) );
        const movedDraft = flowRender.mock.calls.at ( -1 )?.[ 0 ].nodes?.find ( node => node.type === "draftTransition" );
        expect ( movedDraft?.type === "draftTransition" ? {
            x: movedDraft.position.x + movedDraft.data.source.x, y: movedDraft.position.y + movedDraft.data.source.y,
        } : null ).toEqual ( { x: 200, y: 150 } );
        const grip = screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        expect ( Math.hypot ( Number.parseFloat ( grip.style.left ) - 200, Number.parseFloat ( grip.style.top ) - 150 ) )
            .toBeCloseTo ( 25, 5 );
        if ( movedDraft === undefined )
        {
            throw new Error ( "The half-attached draft must remain visible." );
        }
        act ( () => flowRender.mock.calls.at ( -1 )?.[ 0 ].onNodesChange?. ( [ {
            type: "position", id: movedDraft.id, position: { x: movedDraft.position.x + 100, y: movedDraft.position.y + 100 },
        } ] ) );
        const translatedDraft = flowRender.mock.calls.at ( -1 )?.[ 0 ].nodes?.find ( node => node.type === "draftTransition" );
        expect ( translatedDraft?.type === "draftTransition" ? {
            source: { x: translatedDraft.position.x + translatedDraft.data.source.x,
                y: translatedDraft.position.y + translatedDraft.data.source.y },
            target: { x: translatedDraft.position.x + translatedDraft.data.target.x,
                y: translatedDraft.position.y + translatedDraft.data.target.y },
        } : null ).toEqual ( { source: { x: 200, y: 150 }, target: { x: 600, y: 400 } } );
    } );

    it ( "routes direct indicator connections through the shared worker and retains them during orphan cleanup", async () =>
    {
        const fixture = createIndicatorFixture ();
        const route = vi.fn<ChartRoutingPort[ "route" ]> ( async request => routeChartRelations ( request ) );
        render ( <RepairHarness deleteOrphanedItems routingPort={ { route, cancel: async () => undefined } } initial={ {
            ...fixture, chart: { ...fixture.chart, draftTransitions: [], indicators: { ...fixture.chart.indicators,
                terminalStateIndicators: [ ...fixture.chart.indicators.terminalStateIndicators, { id: 1, x: -300, y: 600 } ],
                indicatorTransitions: [ { id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 0 } } ],
            } },
        } } /> );
        await waitFor ( () => expect ( flowRender.mock.calls.at ( -1 )?.[ 0 ].edges?.find (
            edge => edge.id === "indicator-relation:0" )?.data?.routedGeometry ).toBeDefined () );
        expect ( route.mock.calls.at ( -1 )?.[ 0 ].relations ).toContainEqual ( expect.objectContaining ( {
            identifier: "indicator-relation:0",
            sourceBoundary: expect.objectContaining ( { kind: "circle", radius: 25 } ),
            targetBoundary: expect.objectContaining ( { kind: "circle", radius: 30 } ),
        } ) );
        fireEvent.click ( screen.getByRole ( "button", { name: "Automatic Layout" } ) );
        await waitFor ( () => expect ( currentDraft ().chart.indicators.terminalStateIndicators ).toHaveLength ( 1 ) );
        expect ( currentDraft ().chart.indicators.initialStateIndicator ).not.toBeNull ();
        expect ( currentDraft ().chart.indicators.indicatorTransitions ).toHaveLength ( 1 );
        expect ( interactionError ).not.toHaveBeenCalled ();
    } );

} );

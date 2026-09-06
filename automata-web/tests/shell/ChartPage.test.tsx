// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    State Chart Page Tests
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the Chart projection, palette-to-dialog transaction, and bounded no-document surface.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { createDocumentEditorState, executeDocumentCommand, planDocumentCommand, undoDocumentCommand } from "../../src/domain/model/commands.js";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

//--------------------------------------------------------------------------------------------------
// Interface: ReactFlowMockProperties
//
// Description:
//
//   Defines the properties accepted by the react flow mock interface.
//
//--------------------------------------------------------------------------------------------------

interface ReactFlowMockProperties
{
    readonly ariaLabelConfig?: {
        readonly "edge.a11yDescription.default"?: string;
        readonly "node.a11yDescription.default"?: string;
    };
    readonly children?: React.ReactNode;
    readonly edges?: readonly {
        readonly ariaLabel?: string;
        readonly ariaRole?: React.AriaRole;
        readonly data?: {
            readonly canonicalDirectionSign?: number;
            readonly event?: string;
            readonly kind?: string;
            readonly parallelLaneCount?: number;
            readonly parallelLanePosition?: number;
            readonly orthogonalLabelObstacles?: readonly unknown[];
            readonly orthogonalObstacles?: readonly unknown[];
            readonly selfLoopGeometry?: { readonly side?: string };
            readonly selfLoopIndex?: number | null;
            readonly state?: string;
            readonly stateNext?: string;
            readonly transitionLabelPosition?: number;
        };
        readonly id?: string;
        readonly pathOptions?: { readonly borderRadius?: number };
        readonly reconnectable?: boolean;
        readonly source?: string;
        readonly sourceHandle?: string;
        readonly target?: string;
        readonly targetHandle?: string;
        readonly type?: string;
    }[];
    readonly defaultViewport?: { readonly x: number; readonly y: number; readonly zoom: number };
    readonly edgesReconnectable?: boolean;
    readonly fitView?: boolean;
    readonly minZoom?: number;
    readonly onMoveEnd?: ( event: null, viewport: { readonly x: number; readonly y: number; readonly zoom: number } ) => void;
    readonly onEdgesChange?: ( changes: readonly {
        readonly id: string;
        readonly type: "remove";
    }[] ) => void;
    readonly onInit?: ( instance: {
        readonly getNodes?: () => NonNullable<ReactFlowMockProperties[ "nodes" ]>;
        readonly getViewport: () => { readonly x: number; readonly y: number; readonly zoom: number };
        readonly screenToFlowPosition?: ( point: { x: number; y: number } ) => { x: number; y: number };
    } ) => void;
    readonly nodes?: readonly {
        readonly ariaLabel?: string;
        readonly ariaRole?: React.AriaRole;
        readonly data?: {
            readonly draftTransitionId?: number;
            readonly indicatorId?: number | null;
            readonly kind?: string;
        };
        readonly id?: string;
        readonly type?: string;
    }[];
    readonly onConnect?: ( connection: {
        readonly source: string;
        readonly sourceHandle?: string | null;
        readonly target: string;
        readonly targetHandle?: string | null;
    } ) => void;
    readonly onNodeDoubleClick?: ( event: React.MouseEvent, node: NonNullable<ReactFlowMockProperties[ "nodes" ]>[ number ] ) => void;
    readonly onNodeClick?: ( event: React.MouseEvent, node: NonNullable<ReactFlowMockProperties[ "nodes" ]>[ number ] ) => void;
    readonly onNodeDragStop?: ( event: React.MouseEvent, node: NonNullable<ReactFlowMockProperties[ "nodes" ]>[ number ] ) => void;
    readonly onSelectionChange?: ( selection: {
        readonly edges: readonly NonNullable<ReactFlowMockProperties[ "edges" ]>[ number ][];
        readonly nodes: readonly NonNullable<ReactFlowMockProperties[ "nodes" ]>[ number ][];
    } ) => void;
}

const { reactFlowRenderSpy } = vi.hoisted ( () => ( {
    reactFlowRenderSpy: vi.fn <( properties: ReactFlowMockProperties ) => void> (),
} ) );

vi.mock ( "@xyflow/react", () => ( {
    useUpdateNodeInternals: () => () => undefined,
    Background: () => null,
    BackgroundVariant: { Dots: "dots" },
    BaseEdge: () => null,
    ConnectionLineType: { Straight: "straight" },
    ConnectionMode: { Loose: "loose" },
    Controls: () => null,
    Handle: ( properties: { readonly id?: string; readonly position: string; readonly type: string } ) => (
        <span data-handle-id={ properties.id } data-handle-position={ properties.position } data-handle-type={ properties.type } />
    ),
    MarkerType: { ArrowClosed: "arrow-closed" },
    NodeResizeControl: () => null,
    Position: { Bottom: "bottom", Left: "left", Right: "right", Top: "top" },
    ResizeControlVariant: { Line: "line" },
    ReactFlow: ( properties: ReactFlowMockProperties ) =>
    {
        reactFlowRenderSpy ( properties );

        // Return the rendered interface.

        return (
            <div>
                { properties.nodes?.map ( node => (
                    <div
                        aria-label={ node.ariaLabel }
                        className={ `react-flow__node react-flow__node-${node.type ?? "default"}` }
                        data-id={ node.id }
                        key           = { node.id }
                        onClick       = { event => properties.onNodeClick?. ( event, node ) }
                        onDoubleClick = { event => properties.onNodeDoubleClick?. ( event, node ) }
                        role          = { node.ariaRole }
                        tabIndex      = { 0 }
                    />
                ) ) }
                { properties.children }
            </div>
        );
    },
    ReactFlowProvider: ( properties: { readonly children?: React.ReactNode } ) => <>{ properties.children }</>,
    SelectionMode: { Partial: "partial" },
    ViewportPortal: ( properties: { readonly children?: React.ReactNode } ) => <>{ properties.children }</>,
    applyEdgeChanges: (
        changes: readonly { readonly id?: string; readonly type?: string }[],
        edges: readonly { readonly id?: string }[],
    ) => changes.reduce ( ( retainedEdges, change ) => change.type === "remove"
        ? retainedEdges.filter ( edge => edge.id !== change.id )
        : retainedEdges, edges ),
    applyNodeChanges: ( _changes: readonly unknown[], nodes: readonly unknown[] ) => nodes,
} ) );

import type { ChartLayoutNode, ChartLayoutPort, ChartRoutingPort } from "../../src/application/ports/contracts.js";
import type { DocumentCommandFactory } from "../../src/application/contracts.js";
import { cubicBezierCurvesFromBackbone } from "../../src/application/chart-routing-backbone.js";
import { COMPILE_TIME_CONFIGURATION } from "../../src/configuration/compile-time-configuration.js";
import
{
    MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT,
    MAXIMUM_INTERACTIVE_CHART_NODE_COUNT,
} from "../../src/application/chart-layout-limits.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { ChartPage } from "../../src/presentation/chart/ChartPage.js";
import
{
    calculateCenterRoutedEdgeGeometry,
    calculateCenterRoutedEdgeGeometryFromCenters,
    curvedBezierPathFromBackbone,
} from "../../src/presentation/chart/StateChartEdges.js";
import
{
    selfTransitionLoopAspectRatio,
    selfTransitionLoopGeometry,
    selfTransitionLoopMajorSemiAxes,
} from "../../src/application/chart-self-transition-loops.js";
import { createAuthoringChartProjection } from "../../src/presentation/chart/chart-projection.js";
import { StateChartStateNodeComponent } from "../../src/presentation/chart/StateChartNodes.js";

const layoutPort: ChartLayoutPort =
{
    layout: async nodes => ( {
        effectiveMinimumStateDistance: 500,
        states: nodes.map ( ( node, index ) => ( { state: node.state, x: index * 300, y: index * 180 } ) ),
    } ),
};

afterEach ( () =>
{
    cleanup ();
    reactFlowRenderSpy.mockReset ();
} );

//--------------------------------------------------------------------------------------------------
// Function: AttachmentHarness
//
// Description:
//
//   Applies real document revisions so endpoint completion exercises the canvas remount.
//--------------------------------------------------------------------------------------------------

function AttachmentHarness ( { keyboardReady = false }: { readonly keyboardReady?: boolean } )
{
    const [ editor, setEditor ] = useState ( () =>
    {
        const draft = createEmptyAuthoringDraft ( false );
        return createDocumentEditorState ( {
            ...draft,
            stateMachine:
            {
                ...draft.stateMachine,
                states: [ { name: "A", description: "" }, { name: "B", description: "" } ],
                events: [ { name: "go", description: "" } ],
                initialState: "A",
            },
            chart:
            {
                ...draft.chart,
                states: [ { state: "A", x: 100, y: 100 }, { state: "B", x: 700, y: 100 } ],
                draftTransitions: [ { id: 42,
                    source: keyboardReady ? { x: 90, y: 150 } : { x: 100, y: 450 },
                    target: keyboardReady ? { x: 690, y: 150 } : { x: 700, y: 450 },
                } ],
            },
        } );
    } );
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
        } }>Move A</button>
        <button onClick={ () =>
        {
            const undone = undoDocumentCommand ( editor );
            if ( undone.isSuccessful )
            {
                setEditor ( undone.state );
            }
        } }>Undo fixture</button>
        <button onClick={ () => setEditor ( createDocumentEditorState ( createEmptyAuthoringDraft ( false ) ) ) }>
            Replace fixture
        </button>
        <output data-testid="attachment-document">{ JSON.stringify ( editor.draft ) }</output>
        <ChartPage
            diagnostics={ [] } documentRevision={ editor.documentRevision } draft={ editor.draft }
            layoutPort={ layoutPort } nameWrapping={ { actionNames: false, eventNames: false, stateNames: false } }
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
            onInteractionError={ vi.fn () } onNew={ vi.fn () }
        />
    </>;
}

describe ( "State Chart page", () =>
{
    it ( "follows a state during keyboard movement before the geometry commit", () =>
    {
        render ( <AttachmentHarness keyboardReady /> );
        const gripName = "Move draft transition source endpoint 42";
        fireEvent.keyDown ( screen.getByRole ( "button", { name: gripName } ), { key: "ArrowRight" } );
        fireEvent.keyUp ( screen.getByRole ( "button", { name: gripName } ), { key: "ArrowRight" } );
        const before = Number.parseFloat ( screen.getByRole ( "button", { name: gripName } ).style.left );
        expect ( before ).toBeGreaterThan ( 100 );
        expect ( before ).toBeLessThan ( 400 );
        expect ( Number.parseFloat ( screen.getByRole ( "button", { name: gripName } ).style.top ) ).toBeCloseTo ( 100 );
        const state = screen.getByRole ( "button", { name: /^State A\./u } );
        fireEvent.keyDown ( state, { key: "ArrowRight" } );
        expect ( Number.parseFloat ( screen.getByRole ( "button", { name: gripName } ).style.left ) ).toBeGreaterThan ( before );
        expect ( Number.parseFloat ( screen.getByRole ( "button", { name: gripName } ).style.top ) ).toBeCloseTo ( 100 );
        fireEvent.keyUp ( state, { key: "ArrowRight" } );
        expect ( Number.parseFloat ( screen.getByRole ( "button", { name: gripName } ).style.left ) ).toBeGreaterThan ( before );
        expect ( Number.parseFloat ( screen.getByRole ( "button", { name: gripName } ).style.top ) ).toBeCloseTo ( 100 );
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
    } );

    it.each ( [ "pointerCancel", "lostPointerCapture" ] as const ) ( "cancels an endpoint drag on %s", eventName =>
    {
        render ( <AttachmentHarness /> );
        const before = screen.getByTestId ( "attachment-document" ).textContent;
        const grip = screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        fireEvent.pointerDown ( grip, { pointerId: 81, button: 0, clientX: 100, clientY: 450 } );
        fireEvent.pointerMove ( grip, { pointerId: 81, clientX: 250, clientY: 150 } );
        fireEvent [ eventName ] ( grip, { pointerId: 81, clientX: 250, clientY: 150 } );
        expect ( screen.getByTestId ( "attachment-document" ).textContent ).toBe ( before );
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
    } );

    it ( "discards a pending keyboard attachment when the document is replaced", async () =>
    {
        render ( <AttachmentHarness keyboardReady /> );
        const grip = screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        fireEvent.keyDown ( grip, { key: "ArrowRight" } );
        fireEvent.click ( screen.getByRole ( "button", { name: "Replace fixture" } ) );
        await act ( async () => new Promise ( resolve => setTimeout ( resolve, 200 ) ) );
        expect ( screen.getByTestId ( "attachment-document" ).textContent ).toContain ( '"draftTransitions":[]' );
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
    } );

    it.each ( [ false, true ] ) ( "completes keyboard attachments and permits escape: target-first=%s", async targetFirst =>
    {
        const user = userEvent.setup ();
        render ( <AttachmentHarness keyboardReady /> );
        const order = targetFirst ? [ "target", "source" ] : [ "source", "target" ];
        for ( const [ index, endpoint ] of order.entries () )
        {
            const grip = screen.getByRole ( "button", { name: `Move draft transition ${endpoint} endpoint 42` } );
            fireEvent.keyDown ( grip, { key: "ArrowRight" } );
            fireEvent.keyUp ( grip, { key: "ArrowRight" } );
            if ( index === 0 )
            {
                expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
            }
        }
        expect ( screen.getByRole ( "dialog", { name: "Transition" } ) ).toBeVisible ();
        await user.click ( screen.getByRole ( "button", { name: "Cancel" } ) );
        const grip = screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        fireEvent.keyDown ( grip, { key: "ArrowRight" } );
        fireEvent.keyUp ( grip, { key: "ArrowRight" } );
        expect ( screen.getByTestId ( "attachment-document" ).textContent ).toContain ( '"sourceState":null' );
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
        await user.click ( screen.getByRole ( "button", { name: "Replace fixture" } ) );
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
        expect ( screen.queryByRole ( "button", { name: /Draft transition 42/u } ) ).toBeNull ();
    } );


    it.each ( [ [ false, false ], [ true, false ], [ false, true ], [ true, true ] ] ) (
        "completes attachments across revisions: target-first=%s self=%s", async ( targetFirst, selfTransition ) =>
    {
        const user = userEvent.setup ();
        render ( <AttachmentHarness /> );
        const order = targetFirst ? [ "target", "source" ] as const : [ "source", "target" ] as const;
        for ( const [ index, endpoint ] of order.entries () )
        {
            const grip = screen.getByRole ( "button", { name: `Move draft transition ${endpoint} endpoint 42` } );
            const destinationX = endpoint === "source" || selfTransition ? 250 : 850;
            fireEvent.pointerDown ( grip, {
                clientX: endpoint === "source" ? 100 : 700, clientY: 450, pointerId: index + 1,
            } );
            fireEvent.pointerUp ( grip, { clientX: destinationX, clientY: 150, pointerId: index + 1 } );
            if ( index === 0 )
            {
                expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
            }
        }
        const dialog = screen.getByRole ( "dialog", { name: "Transition" } );
        expect ( within ( dialog ).getByRole ( "combobox", { name: "State" } ) ).toHaveValue ( "A" );
        expect ( within ( dialog ).getByRole ( "combobox", { name: "Next State" } ) )
            .toHaveValue ( selfTransition ? "A" : "B" );
        expect ( within ( dialog ).getByRole ( "combobox", { name: "Event" } ) ).toHaveValue ( "" );
        await user.click ( within ( dialog ).getByRole ( "button", { name: "Cancel" } ) );
        expect ( screen.getByTestId ( "attachment-document" ).textContent ).toContain ( '"sourceState":"A"' );
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
        await user.click ( screen.getByRole ( "button", { name: "Move A" } ) );
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
        const sourceGrip = screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } );
        const targetGrip = screen.getByRole ( "button", { name: "Move draft transition target endpoint 42" } );
        const sourceX = Number.parseFloat ( sourceGrip.style.left );
        const targetX = Number.parseFloat ( targetGrip.style.left );
        expect ( selfTransition ? ( sourceX + targetX ) / 2 : sourceX ).toBeCloseTo ( selfTransition ? 350 : 500 );
        await user.click ( screen.getByRole ( "button", { name: "Undo fixture" } ) );
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).toBeNull ();
        if ( selfTransition )
        {
            fireEvent.keyDown ( screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } ), { key: targetFirst ? " " : "Enter" } );
        }
        else
        {
            fireEvent.doubleClick ( screen.getByRole ( "button", { name: "Move draft transition source endpoint 42" } ) );
        }
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Event" } ), "go" );
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );
        expect ( screen.queryByRole ( "button", { name: /Draft transition 42/u } ) ).toBeNull ();
        expect ( screen.getByTestId ( "attachment-document" ).textContent ).toContain (
            `"transitionTable":[{"state":"A","event":"go","stateNext":"${selfTransition ? "A" : "B"}"}]`,
        );
    } );


    it ( "allows the editable Chart to zoom out to ten percent", () =>
    {
        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { createEmptyAuthoringDraft ( true ) }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const minimumZoom = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ].minZoom;

        expect ( minimumZoom ).toBe ( COMPILE_TIME_CONFIGURATION.chart.viewport.minimumZoom );
        expect ( minimumZoom ).toBeLessThanOrEqual ( 0.125 );
    } );

    it ( "preserves the viewport across state dragging, later edits, and preference projections without fitting", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                states: [ { state: "state_one", x: 20, y: 40, height: 62 } ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_one", description: "One" } ],
            },
        };
        const viewport   = { x: -420, y: 175, zoom: 0.35 };
        const properties = {
            diagnostics: [] as const,
            draft,
            layoutPort,
            nameWrapping: { actionNames: false, eventNames: false, stateNames: false },
            onCommand: vi.fn ( () => true ),
            onInteractionError: vi.fn (),
            onNew: vi.fn (),
        };
        const rendered                   = render ( <ChartPage { ...properties } documentRevision={ 1 } /> );
        const initialReactFlowProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];

        expect ( initialReactFlowProperties?.fitView ).toBe ( false );
        expect ( initialReactFlowProperties?.defaultViewport ).toBeUndefined ();

        act ( () => initialReactFlowProperties?.onInit?. ( {
            getNodes: () => initialReactFlowProperties.nodes ?? [],
            getViewport: () => viewport,
        } ) );

        // Initialize the local values needed by this operation.

        const draggableReactFlowProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];
        const stateNode                    = draggableReactFlowProperties?.nodes?.find ( node => node.type === "state" );

        // Handle the case where state node matches undefined.

        if ( stateNode === undefined )
        {
            throw new Error ( "The state node was not rendered." );
        }

        act ( () => draggableReactFlowProperties?.onNodeDragStop?. ( {} as React.MouseEvent, stateNode ) );
        rendered.rerender ( <ChartPage { ...properties } documentRevision={ 2 } /> );

        const restoredReactFlowProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];

        expect ( restoredReactFlowProperties?.fitView ).toBe ( false );
        expect ( restoredReactFlowProperties?.defaultViewport ).toEqual ( viewport );

        act ( () => restoredReactFlowProperties?.onInit?. ( {
            getViewport: () => viewport,
        } ) );
        rendered.rerender ( <ChartPage { ...properties } documentRevision={ 3 } /> );

        const laterReactFlowProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];

        expect ( laterReactFlowProperties?.fitView ).toBe ( false );
        expect ( laterReactFlowProperties?.defaultViewport ).toEqual ( viewport );

        const movedViewport = { x: 120, y: -80, zoom: 0.6 };
        act ( () => laterReactFlowProperties?.onMoveEnd?. ( null, movedViewport ) );
        rendered.rerender ( <ChartPage { ...properties } documentRevision={ 3 } gridSize={ 25 } /> );

        const resizedReactFlowProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];
        expect ( resizedReactFlowProperties?.fitView ).toBe ( false );
        expect ( resizedReactFlowProperties?.defaultViewport ).toEqual ( movedViewport );

        // A delayed move-end notification from the replaced canvas cannot change the retained view.

        act ( () =>
        {
            laterReactFlowProperties?.onMoveEnd?. ( null, viewport );
            laterReactFlowProperties?.onInit?. ( { getViewport: () => viewport } );
        } );
        rendered.rerender ( <ChartPage { ...properties } documentRevision={ 4 } gridSize={ 25 } /> );
        expect ( reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ]?.defaultViewport ).toEqual ( movedViewport );
    } );

    it ( "consumes a loaded model fit once and preserves the fitted viewport on subsequent revisions", () =>
    {
        const onFirstViewFitConsumed = vi.fn ();
        const properties = {
            diagnostics: [] as const,
            draft: createEmptyAuthoringDraft ( true ),
            layoutPort,
            nameWrapping: { actionNames: false, eventNames: false, stateNames: false },
            onCommand: vi.fn (),
            onFirstViewFitConsumed,
            onInteractionError: vi.fn (),
            onNew: vi.fn (),
        };
        const rendered = render ( <ChartPage { ...properties } documentRevision={ 1 } fitOnFirstView /> );
        const firstCanvas = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];
        expect ( firstCanvas?.fitView ).toBe ( true );

        const fittedViewport = { x: 240, y: 80, zoom: 0.4 };
        act ( () => firstCanvas?.onInit?. ( { getViewport: () => fittedViewport } ) );
        expect ( onFirstViewFitConsumed ).toHaveBeenCalledTimes ( 1 );

        // Consuming the request cannot cancel the active canvas's pending initial fit.

        rendered.rerender ( <ChartPage { ...properties } documentRevision={ 1 } fitOnFirstView={ false } /> );
        expect ( reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ]?.fitView ).toBe ( true );
        rendered.rerender ( <ChartPage { ...properties } documentRevision={ 2 } fitOnFirstView={ false } /> );
        const laterCanvas = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];
        expect ( laterCanvas?.fitView ).toBe ( false );
        expect ( laterCanvas?.defaultViewport ).toEqual ( fittedViewport );

        act ( () => firstCanvas?.onInit?. ( { getViewport: () => ( { x: 0, y: 0, zoom: 1 } ) } ) );
        expect ( onFirstViewFitConsumed ).toHaveBeenCalledTimes ( 1 );
    } );

    it ( "projects ordered duplicate action assignments into expanded state compartments", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart: { ...emptyDraft.chart, settings: { ...emptyDraft.chart.settings, expandStates: true } },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_idle", description: "Idle" } ],
                actions: [ { name: "action_log", description: "Log" } ],
                stateActions:
                {
                    entry:
                    [
                        { state: "state_idle", action: "action_log" },
                        { state: "state_idle", action: "action_log" },
                    ],
                    exit: [],
                },
            },
        };
        const projection = createAuthoringChartProjection (
            draft,
            [],
            { actionNames: false, eventNames: false, stateNames: false },
        );

        expect ( projection.states [ 0 ]?.entryActionLines ).toEqual ( [ [ "action_log" ], [ "action_log" ] ] );
        expect ( projection.states [ 0 ]?.exitActionLines ).toEqual ( [] );
        expect ( projection.states [ 0 ]?.isPersisted ).toBe ( false );
    } );

    it ( "derives fixed state dimensions and preserves only the selected expanded height", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft    = createEmptyAuthoringDraft ();
        const expandedDraft = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                settings: { expandStates: true },
                states: [ { state: "state_one", x: 20, y: 40, height: 180 } ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_one", description: "One" } ],
            },
        };
        const stateSize = {
            collapsedStateHeight: 62,
            collapsedStateWidth: 268,
            expandedStateMinimumHeight: 62,
            expandedStateWidth: 275,
            gridSize: 20,
        };
        const expandedProjection = createAuthoringChartProjection (
            expandedDraft,
            [],
            { actionNames: false, eventNames: false, stateNames: false },
            stateSize,
        );
        const collapsedProjection = createAuthoringChartProjection (
            { ...expandedDraft, chart: { ...expandedDraft.chart, settings: { expandStates: false } } },
            [],
            { actionNames: false, eventNames: false, stateNames: false },
            stateSize,
        );
        const smallestProjection = createAuthoringChartProjection (
            { ...expandedDraft, chart: { ...expandedDraft.chart, settings: { expandStates: false } } },
            [],
            { actionNames: false, eventNames: false, stateNames: false },
            { ...stateSize, collapsedStateHeight: 1, collapsedStateWidth: 1 },
        );

        expect ( expandedProjection.states [ 0 ] ).toMatchObject ( {
            height: 180,
            savedHeight: 180,
            width: 280,
            x: 20,
            y: 40,
        } );
        expect ( collapsedProjection.states [ 0 ] ).toMatchObject ( {
            height: 60,
            savedHeight: 180,
            width: 260,
        } );
        expect ( smallestProjection.states [ 0 ] ).toMatchObject ( { height: 20, width: 20 } );
    } );

    it ( "includes effective, saved, and enforced-minimum heights in an expanded state's accessible description", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ();
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_one", description: "One" } ],
            },
            chart:
            {
                ...emptyDraft.chart,
                settings: { expandStates: true },
                states: [ { state: "state_one", x: 20, y: 40, height: 180 } ],
            },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const stateNode = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ].nodes?.find (
            node => node.id === "state:state_one",
        );

        expect ( stateNode?.ariaLabel ).toContain ( "Effective height" );
        expect ( stateNode?.ariaLabel ).toContain ( "Saved height" );
        expect ( stateNode?.ariaLabel ).toContain ( "Enforced minimum height" );
    } );

    it ( "retains command-derived edges when React Flow reports a transient removal", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                states:
                [
                    { state: "state_one", x: 20, y: 40 },
                    { state: "state_two", x: 420, y: 40 },
                ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states:
                [
                    { name: "state_one", description: "One" },
                    { name: "state_two", description: "Two" },
                ],
                events: [ { name: "event_go", description: "Go" } ],
                transitionTable: [ { state: "state_one", event: "event_go", stateNext: "state_two" } ],
            },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        // Initialize the local values needed by this operation.

        const initialProperties        = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];
        const transitionEdge           = initialProperties?.edges?.find ( edge => edge.data?.kind === "transition" );
        const transitionEdgeIdentifier = transitionEdge?.id;

        expect ( transitionEdgeIdentifier ).toBeDefined ();

        // Handle the case where transition edge identifier differs from undefined.

        if ( transitionEdgeIdentifier !== undefined )
        {
            act ( () => initialProperties?.onEdgesChange?. ( [ { id: transitionEdgeIdentifier, type: "remove" } ] ) );
        }

        expect ( reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ].edges ).toContainEqual ( transitionEdge );
    } );

    it ( "maps transition label alignment to 20, 50, and 80 percent of visible curve arclength", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                states:
                [
                    { state: "state_one", x: 20, y: 40 },
                    { state: "state_two", x: 420, y: 40 },
                ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states:
                [
                    { name: "state_one", description: "One" },
                    { name: "state_two", description: "Two" },
                ],
                events: [ { name: "event_go", description: "Go" } ],
                transitionTable: [ { state: "state_one", event: "event_go", stateNext: "state_two" } ],
            },
        };
        const properties = {
            diagnostics: [] as const,
            documentRevision: 1,
            draft,
            layoutPort,
            nameWrapping: { actionNames: false, eventNames: false, stateNames: false },
            onCommand: vi.fn (),
            onInteractionError: vi.fn (),
            onNew: vi.fn (),
        };

        //------------------------------------------------------------------------------------------
        // Function: transitionLabelPosition
        //
        // Description:
        //
        //   Derives the transition label position.
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
        //------------------------------------------------------------------------------------------

        const transitionLabelPosition = (): number | undefined => reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ]
            .edges?.find ( edge => edge.data?.kind === "transition" )?.data?.transitionLabelPosition;
        const { rerender } = render ( <ChartPage { ...properties } transitionLabelAlignment="Start" /> );

        expect ( transitionLabelPosition () ).toBe ( 0.2 );

        rerender ( <ChartPage { ...properties } transitionLabelAlignment="Center" /> );
        expect ( transitionLabelPosition () ).toBe ( 0.5 );

        rerender ( <ChartPage { ...properties } transitionLabelAlignment="End" /> );
        expect ( transitionLabelPosition () ).toBe ( 0.8 );
    } );

    it ( "keeps every palette item inert until it is dragged and dropped", async () =>
    {
        // Initialize the local values needed by this operation.

        const user                                       = userEvent.setup ();
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { createEmptyAuthoringDraft ( true ) }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        await user.click ( screen.getByRole ( "button", { name: "State" } ) );
        await user.click ( screen.getByRole ( "button", { name: "Initial Indicator" } ) );
        await user.click ( screen.getByRole ( "button", { name: "Terminal Indicator" } ) );
        await user.click ( screen.getByRole ( "button", { name: "Transition" } ) );

        expect ( commandFactories ).toHaveLength ( 0 );
        expect ( screen.queryByRole ( "dialog" ) ).not.toBeInTheDocument ();
    } );

    it ( "uses the icon alone as drag feedback and preserves palette icons across revisions", () =>
    {
        // Initialize the local values needed by this operation.

        const draft        = createEmptyAuthoringDraft ( true );
        const setDragImage = vi.fn ();
        const dataTransfer = {
            effectAllowed: "none",
            getData: vi.fn ( () => "" ),
            setData: vi.fn (),
            setDragImage,
        };
        const properties = {
            diagnostics: [] as const,
            draft,
            layoutPort,
            nameWrapping: { actionNames: false, eventNames: false, stateNames: false },
            onCommand: vi.fn (),
            onInteractionError: vi.fn (),
            onNew: vi.fn (),
        };
        const { rerender } = render ( <ChartPage { ...properties } documentRevision={ 1 } /> );
        const stateButton = screen.getByRole ( "button", { name: "State" } );
        const stateIcon   = stateButton.querySelector ( "img" );

        expect ( stateIcon ).not.toBeNull ();
        Object.defineProperties ( stateIcon, {
            complete: { value: true }, naturalWidth: { value: 16 }, naturalHeight: { value: 16 },
        } );
        fireEvent.dragStart ( stateButton, { dataTransfer } );
        expect ( setDragImage ).toHaveBeenCalledWith ( stateIcon, 8, 8 );

        rerender ( <ChartPage { ...properties } documentRevision={ 2 } /> );
        expect ( screen.getByRole ( "button", { name: "State" } ).querySelector ( "img" ) ).toBe ( stateIcon );
    } );

    it ( "drops a generated state immediately and suppresses the post-drag click dialog", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states:
                [
                    { name: "state_1", description: "One" },
                    { name: "state_3", description: "Three" },
                ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];
        const transferredData                            = new Map<string, string> ();
        const dataTransfer                               = {
            effectAllowed: "none",
            getData: ( dataType: string ) => transferredData.get ( dataType ) ?? "",
            setData: ( dataType: string, value: string ) => transferredData.set ( dataType, value ),
        };

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const stateButton = screen.getByRole ( "button", { name: "State" } );

        fireEvent.dragStart ( stateButton, { dataTransfer } );
        const stateDropEvent = new Event ( "drop", { bubbles: true, cancelable: true } );

        Object.defineProperties ( stateDropEvent, {
            clientX: { value: 240 },
            clientY: { value: 180 },
            dataTransfer: { value: dataTransfer },
        } );
        fireEvent ( screen.getByLabelText ( "State Chart canvas" ), stateDropEvent );
        fireEvent.dragEnd ( stateButton, { dataTransfer } );
        fireEvent.click ( stateButton );

        expect ( screen.queryByRole ( "dialog", { name: "Named entity" } ) ).not.toBeInTheDocument ();
        expect ( commandFactories ).toHaveLength ( 1 );
        expect ( commandFactories [ 0 ]?.( 8 ) ).toEqual ( {
            kind: "add_entity",
            entityKind: "state",
            entity: { name: "state_2", description: "" },
            chartPlacement: { state: "state_2", x: 240, y: 180, height: 100 },
            expectedRevision: 8,
        } );
    } );

    it ( "keeps Transition click inert while drop creates a persistent draft without a dialog", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                draftTransitions:
                [
                    { id: 0, source: { x: 20, y: 20 }, target: { x: 200, y: 20 } },
                    { id: 2, source: { x: 20, y: 80 }, target: { x: 200, y: 80 } },
                ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_alpha", description: "Alpha" } ],
                events: [ { name: "event_go", description: "Go" } ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const transitionButton = screen.getByRole ( "button", { name: "Transition" } );

        await user.click ( transitionButton );
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).not.toBeInTheDocument ();

        const transitionDropEvent = new Event ( "drop", { bubbles: true, cancelable: true } );

        Object.defineProperties ( transitionDropEvent, {
            clientX: { value: 300 },
            clientY: { value: 220 },
            dataTransfer: { value: { getData: () => "transition" } },
        } );
        fireEvent ( screen.getByLabelText ( "State Chart canvas" ), transitionDropEvent );

        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).not.toBeInTheDocument ();
        expect ( commandFactories ).toHaveLength ( 1 );
        expect ( commandFactories [ 0 ]?.( 11 ) ).toEqual ( {
            kind: "add_chart_draft_transition",
            draftTransition:
            {
                id: 1,
                source: { x: 210, y: 220 },
                target: { x: 390, y: 220 },
            },
            expectedRevision: 11,
        } );
    } );

    it ( "does not activate palette items from the keyboard", () =>
    {
        // Initialize the local values needed by this operation.

        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { createEmptyAuthoringDraft ( true ) }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        // Initialize the local values needed by this operation.

        const stateButton      = screen.getByRole ( "button", { name: "State" } );
        const transitionButton = screen.getByRole ( "button", { name: "Transition" } );

        fireEvent.keyDown ( stateButton, { key: "Enter", shiftKey: true } );
        fireEvent.keyDown ( transitionButton, { key: "Enter", shiftKey: true } );

        expect ( screen.queryByRole ( "dialog", { name: "Named entity" } ) ).not.toBeInTheDocument ();
        expect ( screen.queryByRole ( "dialog", { name: "Transition" } ) ).not.toBeInTheDocument ();
        expect ( commandFactories ).toHaveLength ( 0 );
    } );

    it ( "configures a keyboard-editable draft atomically while Cancel preserves and refocuses it", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                draftTransitions: [ { id: 4, source: { x: 40, y: 60 }, target: { x: 220, y: 60 } } ],
                states: [ { state: "state_alpha", x: 100, y: 100 } ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_alpha", description: "Alpha" } ],
                events: [ { name: "event_go", description: "Go" } ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const draftNode = screen.getByRole ( "button", {
            name: "Draft transition 4. Press Enter or Space, or double-click, to configure this transition.",
        } );

        draftNode.focus ();
        await user.keyboard ( "{Enter}" );
        await user.click ( screen.getByRole ( "button", { name: "Cancel" } ) );
        await waitFor ( () => expect ( draftNode ).toHaveFocus () );
        expect ( commandFactories ).toHaveLength ( 0 );

        fireEvent.doubleClick ( draftNode );
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Event" } ), "event_go" );
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );

        expect ( commandFactories ).toHaveLength ( 1 );
        expect ( commandFactories [ 0 ]?.( 14 ) ).toEqual ( {
            kind: "configure_chart_draft_transition",
            draftTransitionId: 4,
            transition: { state: "state_alpha", event: "event_go", stateNext: "state_alpha" },
            chartStatePlacements: [],
            expectedRevision: 14,
        } );
    } );

    it ( "keeps a rejected draft configuration open and does not arm success focus", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                draftTransitions: [ { id: 6, source: { x: 40, y: 60 }, target: { x: 220, y: 60 } } ],
                states: [ { state: "state_alpha", x: 100, y: 100 } ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_alpha", description: "Alpha" } ],
                events: [ { name: "event_go", description: "Go" } ],
            },
        };
        const onCommand = vi.fn ( () => false );

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { onCommand }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const draftNode = screen.getByRole ( "button", {
            name: "Draft transition 6. Press Enter or Space, or double-click, to configure this transition.",
        } );

        draftNode.focus ();
        await user.keyboard ( "{Enter}" );
        await user.selectOptions ( screen.getByRole ( "combobox", { name: "Event" } ), "event_go" );
        await user.click ( screen.getByRole ( "button", { name: "Confirm" } ) );

        expect ( onCommand ).toHaveBeenCalledOnce ();
        expect ( screen.getByRole ( "dialog", { name: "Transition" } ) ).toBeVisible ();

        await user.click ( screen.getByRole ( "button", { name: "Cancel" } ) );
        await waitFor ( () => expect ( draftNode ).toHaveFocus () );
    } );

    it ( "moves either draft endpoint accessibly and snaps pointer or keyboard release to a state center", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( false );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                states: [ { state: "state_snap", x: 100, y: 100 } ],
                draftTransitions: [ { id: 8, source: { x: 90, y: 131 }, target: { x: 420, y: 131 } } ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_snap", description: "Snap target" } ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        // Initialize the local values needed by this operation.

        const sourceEndpoint = screen.getByRole ( "button", { name: "Move draft transition source endpoint 8" } );
        const targetEndpoint = screen.getByRole ( "button", { name: "Move draft transition target endpoint 8" } );

        fireEvent.pointerDown ( targetEndpoint, { clientX: 420, clientY: 131, pointerId: 3 } );
        fireEvent.pointerUp ( targetEndpoint, { clientX: 420, clientY: 131, pointerId: 3 } );

        expect ( commandFactories ).toHaveLength ( 0 );

        fireEvent.pointerDown ( targetEndpoint, { clientX: 420, clientY: 131, pointerId: 4 } );
        expect ( targetEndpoint ).toHaveFocus ();
        fireEvent.pointerUp ( targetEndpoint, { clientX: 101, clientY: 101, pointerId: 4 } );

        expect ( commandFactories ).toHaveLength ( 1 );
        expect ( commandFactories [ 0 ]?.( 9 ) ).toMatchObject ( {
            kind: "update_chart_draft_endpoint", draftTransitionId: 8, endpoint: "target",
            point: { x: 101, y: 101 }, state: null, expectedRevision: 9,
        } );

        fireEvent.pointerDown ( targetEndpoint, { clientX: 101, clientY: 101, pointerId: 5 } );
        fireEvent.pointerUp ( targetEndpoint, { clientX: 104, clientY: 104, pointerId: 5 } );

        expect ( commandFactories ).toHaveLength ( 2 );
        expect ( commandFactories [ 1 ]?.( 10 ) ).toMatchObject ( {
            kind: "update_chart_draft_endpoint", draftTransitionId: 8, endpoint: "target",
            point: { x: 250, y: 150 }, state: "state_snap", expectedRevision: 10,
        } );

        fireEvent.keyDown ( sourceEndpoint, { key: "ArrowRight" } );
        fireEvent.keyUp ( sourceEndpoint, { key: "ArrowRight" } );

        expect ( commandFactories ).toHaveLength ( 3 );
        expect ( commandFactories [ 2 ]?.( 11 ) ).toMatchObject ( {
            kind: "update_chart_draft_endpoint", draftTransitionId: 8, endpoint: "source",
            point: { x: 250, y: 150 }, state: "state_snap", expectedRevision: 11,
        } );

        expect ( [ sourceEndpoint.style.left, sourceEndpoint.style.top ] )
            .not.toEqual ( [ targetEndpoint.style.left, targetEndpoint.style.top ] );
        const visibleSource = {
            x: Number.parseFloat ( sourceEndpoint.style.left ), y: Number.parseFloat ( sourceEndpoint.style.top ),
        };
        sourceEndpoint.focus ();
        expect ( sourceEndpoint ).toHaveFocus ();

        fireEvent.keyDown ( sourceEndpoint, { key: "ArrowRight" } );
        fireEvent.keyUp ( sourceEndpoint, { key: "ArrowRight" } );

        expect ( commandFactories ).toHaveLength ( 4 );
        expect ( commandFactories [ 3 ]?.( 12 ) ).toMatchObject ( {
            kind: "update_chart_draft_endpoint", draftTransitionId: 8, endpoint: "source",
            point: { x: visibleSource.x + 10, y: visibleSource.y }, state: null, expectedRevision: 12,
        } );
        expect ( document.querySelector ( "[data-chart-announcement]" ) ).toHaveTextContent (
            "Draft transition 8 source endpoint detached from state state_snap. " +
            `New coordinates: X ${Math.round ( visibleSource.x + 10 )}, Y ${Math.round ( visibleSource.y )}.`,
        );
    } );

    it ( "deletes a selected draft through the immediate Chart selection command", async () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                draftTransitions: [ { id: 5, source: { x: 20, y: 20 }, target: { x: 200, y: 20 } } ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        // Initialize the local values needed by this operation.

        const renderedProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];
        const draftNode          = renderedProperties?.nodes?.find ( node => node.data?.draftTransitionId === 5 );

        act ( () => renderedProperties?.onSelectionChange?. ( { nodes: draftNode === undefined ? [] : [ draftNode ], edges: [] } ) );
        fireEvent.keyDown ( screen.getByRole ( "region", { name: "State Chart canvas" } ), { key: "Delete" } );

        expect ( commandFactories ).toHaveLength ( 1 );
        expect ( commandFactories [ 0 ]?.( 17 ) ).toMatchObject ( {
            kind: "delete_chart_selection",
            draftTransitionIds: [ 5 ],
            expectedRevision: 17,
        } );
    } );

    it.each ( [ [ "state_destination", false ], [ "state_source", false ], [ "state_source", true ] ] as const ) (
        "opens an ordered transition to %s with keyboard=%s", ( nextState, keyboard ) =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                events: [ { name: "event_go", description: "Go" } ],
                states:
                [
                    { name: "state_source", description: "Source" },
                    { name: "state_destination", description: "Destination" },
                ],
            },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        fireEvent.click ( screen.getByRole ( "button", { name: /State state_source/u } ) );
        const target = screen.getByRole ( "button", { name: new RegExp ( `State ${nextState}`, "u" ) } );
        if ( keyboard )
        {
            fireEvent.keyDown ( target, { key: "Enter", shiftKey: true } );
        }
        else
        {
            fireEvent.click ( target, { shiftKey: true } );
        }

        const dialog = screen.getByRole ( "dialog", { name: "Transition" } );

        expect ( within ( dialog ).getByRole ( "combobox", { name: "State" } ) ).toHaveValue ( "state_source" );
        expect ( within ( dialog ).getByRole ( "combobox", { name: "Event" } ) ).toHaveValue ( "" );
        expect ( within ( dialog ).getByRole ( "combobox", { name: "Next State" } ) )
            .toHaveValue ( nextState );
    } );

    it ( "drops an initial indicator above a state through one atomic placement command", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                states: [ { state: "state_target", x: 100, y: 100, height: 62 } ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_target", description: "Target" } ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                gridSize         = { 20 }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
                snapToGrid         = { false }
            />,
        );

        const dropEvent = new Event ( "drop", { bubbles: true, cancelable: true } );

        Object.defineProperties ( dropEvent, {
            clientX: { value: 150 },
            clientY: { value: 120 },
            dataTransfer: { value: { getData: () => "initial" } },
        } );
        fireEvent ( screen.getByLabelText ( "State Chart canvas" ), dropEvent );

        expect ( commandFactories ).toHaveLength ( 1 );
        expect ( commandFactories [ 0 ]?.( 5 ) ).toMatchObject ( {
            kind: "place_chart_indicator",
            initialState: "state_target",
            initialStateIndicator: { state: "state_target", x: 250, y: 28 },
            terminalStateIndicators: [],
            terminalStateTransitions: [],
            statePlacements: [ { state: "state_target", x: 100, y: 100, height: 62 } ],
            draftTransitions: [],
            expectedRevision: 5,
        } );
    } );

    it ( "connects an initial indicator to a state through either-order Shift-click", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                indicators:
                {
                    ...emptyDraft.chart.indicators,
                    initialStateIndicator: { x: 30, y: 40, state: null },
                },
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_target", description: "Target" } ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        fireEvent.click ( screen.getByLabelText ( "Initial-state indicator" ) );
        fireEvent.click ( screen.getByRole ( "button", { name: /State state_target/u } ), { shiftKey: true } );

        expect ( commandFactories ).toHaveLength ( 1 );
        expect ( commandFactories [ 0 ]?.( 9 ) ).toEqual ( {
            kind: "set_chart_initial_indicator",
            indicator: { x: 30, y: 40, state: "state_target" },
            expectedRevision: 9,
        } );
    } );

    it.each ( [ "source", "target" ] as const ) (
        "keeps the %s grip stable while dragging coincident draft endpoints",
        endpoint =>
        {
            // Initialize the local values needed by this operation.

            const emptyDraft = createEmptyAuthoringDraft ( false );
            const draft      = {
                ...emptyDraft,
                chart:
                {
                    ...emptyDraft.chart,
                    draftTransitions: [ { id: 12, source: { x: 200, y: 100 }, target: { x: 200, y: 100 } } ],
                },
            };
            const commandFactories: DocumentCommandFactory[] = [];

            render (
                <ChartPage
                    diagnostics      = { [] }
                    documentRevision = { 1 }
                    draft            = { draft }
                    layoutPort       = { layoutPort }
                    nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                    onCommand        = { commandFactory =>
                    {
                        commandFactories.push ( commandFactory );

                        // Return the computed result.

                        return true;
                    } }
                    onInteractionError = { vi.fn () }
                    onNew              = { vi.fn () }
                />,
            );

            // Initialize the local values needed by this operation.

            const sourceEndpoint = screen.getByRole ( "button", { name: "Move draft transition source endpoint 12" } );
            const targetEndpoint = screen.getByRole ( "button", { name: "Move draft transition target endpoint 12" } );
            const activeEndpoint = endpoint === "source" ? sourceEndpoint : targetEndpoint;
            const sourcePoint    = {
                x: Number.parseFloat ( sourceEndpoint.style.left ),
                y: Number.parseFloat ( sourceEndpoint.style.top ),
            };
            const targetPoint = {
                x: Number.parseFloat ( targetEndpoint.style.left ),
                y: Number.parseFloat ( targetEndpoint.style.top ),
            };
            const initialPoint = endpoint === "source" ? sourcePoint : targetPoint;
            const movedPoint   = { x: initialPoint.x + 30, y: initialPoint.y + 25 };

            expect ( Math.hypot ( targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y ) ).toBe ( 24 );

            fireEvent.pointerDown ( activeEndpoint, {
                clientX: initialPoint.x,
                clientY: initialPoint.y,
                pointerId: 12,
            } );

            expect ( commandFactories ).toHaveLength ( 0 );
            expect ( Number.parseFloat ( activeEndpoint.style.left ) ).toBe ( initialPoint.x );
            expect ( Number.parseFloat ( activeEndpoint.style.top ) ).toBe ( initialPoint.y );

            fireEvent.pointerMove ( activeEndpoint, {
                clientX: movedPoint.x,
                clientY: movedPoint.y,
                pointerId: 12,
            } );

            expect ( Number.parseFloat ( activeEndpoint.style.left ) ).toBe ( movedPoint.x );
            expect ( Number.parseFloat ( activeEndpoint.style.top ) ).toBe ( movedPoint.y );

            fireEvent.pointerUp ( activeEndpoint, {
                clientX: movedPoint.x,
                clientY: movedPoint.y,
                pointerId: 12,
            } );

            expect ( commandFactories ).toHaveLength ( 1 );
            expect ( commandFactories [ 0 ]?.( 13 ) ).toMatchObject ( {
                kind: "update_chart_draft_endpoint", draftTransitionId: 12, endpoint,
                point: { x: 230, y: 125 }, state: null, expectedRevision: 13,
            } );
        },
    );

    it ( "keeps near-coincident draft endpoint grips at least 24 pixels apart", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( false );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                draftTransitions: [ { id: 13, source: { x: 200, y: 100 }, target: { x: 220, y: 100 } } ],
            },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn ( () => true ) }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        // Initialize the local values needed by this operation.

        const sourceEndpoint     = screen.getByRole ( "button", { name: "Move draft transition source endpoint 13" } );
        const targetEndpoint     = screen.getByRole ( "button", { name: "Move draft transition target endpoint 13" } );
        const horizontalDistance = Number.parseFloat ( targetEndpoint.style.left ) -
            Number.parseFloat ( sourceEndpoint.style.left );
        const verticalDistance = Number.parseFloat ( targetEndpoint.style.top ) -
            Number.parseFloat ( sourceEndpoint.style.top );

        expect ( Math.hypot ( horizontalDistance, verticalDistance ) ).toBeCloseTo ( 24 );
    } );

    it ( "deletes the focused draft instead of an unrelated pointer selection", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                states: [ { state: "state_behind", x: 20, y: 20 } ],
                draftTransitions: [ { id: 5, source: { x: 20, y: 20 }, target: { x: 200, y: 20 } } ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_behind", description: "Behind the draft" } ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        // Initialize the local values needed by this operation.

        const renderedProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];
        const stateNode          = renderedProperties?.nodes?.find ( node => node.id === "state:state_behind" );

        act ( () => renderedProperties?.onSelectionChange?. ( {
            nodes: stateNode === undefined ? [] : [ stateNode ],
            edges: [],
        } ) );

        const draftNode = screen.getByRole ( "button", { name: /Draft transition 5/u } );

        draftNode.focus ();
        fireEvent.keyDown ( draftNode, { key: "Delete" } );

        expect ( commandFactories ).toHaveLength ( 1 );
        expect ( commandFactories [ 0 ]?.( 18 ) ).toMatchObject ( {
            kind: "delete_chart_selection",
            stateNames: [],
            draftTransitionIds: [ 5 ],
            expectedRevision: 18,
        } );
    } );

    it ( "keeps the palette element-only and projects multiple visual terminal indicators", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                indicators:
                {
                    initialStateIndicator: { x: 20, y: 20 },
                    terminalStateIndicators:
                    [
                        { id: 4, x: 300, y: 100 },
                        { id: 7, x: 300, y: 220 },
                    ],
                    terminalStateTransitions: [ { state: "state_idle", terminalStateIndicatorId: 7 } ],
                },
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                initialState: "state_idle",
                states: [ { name: "state_idle", description: "Idle" } ],
            },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        // Initialize the local values needed by this operation.

        const palette        = screen.getByRole ( "complementary", { name: "Palette" } );
        const paletteButtons = within ( palette ).getAllByRole ( "button" );

        expect ( paletteButtons.map ( button => button.textContent?.trim () ) ).toEqual (
            [ "State", "Initial Indicator", "Terminal Indicator", "Transition" ],
        );
        expect ( within ( palette ).getByRole ( "button", { name: "Initial Indicator" } ) ).toBeDisabled ();
        expect ( within ( palette ).getByRole ( "button", { name: "Terminal Indicator" } ) ).toBeEnabled ();
        expect ( within ( palette ).queryByRole ( "button", { name: "Automatic Layout" } ) ).not.toBeInTheDocument ();
        expect ( screen.getByRole ( "button", { name: "Automatic Layout" } ).closest ( ".chart-footer" ) ).not.toBeNull ();
        expect ( screen.getByRole ( "button", { name: "Fit Chart" } ).closest ( ".chart-footer" ) ).not.toBeNull ();
        expect ( screen.getByRole ( "button", { name: "Save As Image" } ).closest ( ".chart-footer" ) ).not.toBeNull ();
        expect ( screen.queryByRole ( "button", { name: "Delete" } ) ).not.toBeInTheDocument ();

        // Initialize the local values needed by this operation.

        const renderedProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];
        const terminalNodes      = renderedProperties?.nodes?.filter ( node => node.data?.kind === "terminal" ) ?? [];
        const terminalEdges      = renderedProperties?.edges?.filter ( edge => edge.data?.kind === "terminal" ) ?? [];

        expect ( terminalNodes ).toHaveLength ( 2 );
        expect ( terminalEdges ).toHaveLength ( 1 );
        expect ( terminalEdges [ 0 ]?.ariaLabel ).toBe (
            "Terminal-indicator connection: state_idle, Terminal indicator 7",
        );
    } );

    it ( "drops a visual-only terminal indicator with the smallest available identifier", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                indicators:
                {
                    ...emptyDraft.chart.indicators,
                    terminalStateIndicators:
                    [
                        { id: 0, x: 100, y: 100 },
                        { id: 2, x: 100, y: 160 },
                        { id: Number.MAX_SAFE_INTEGER, x: 100, y: 220 },
                    ],
                },
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const terminalDropEvent = new Event ( "drop", { bubbles: true, cancelable: true } );

        Object.defineProperties ( terminalDropEvent, {
            clientX: { value: 300 },
            clientY: { value: 220 },
            dataTransfer: { value: { getData: () => "terminal" } },
        } );
        fireEvent ( screen.getByLabelText ( "State Chart canvas" ), terminalDropEvent );

        expect ( commandFactories ).toHaveLength ( 1 );
        expect ( commandFactories [ 0 ]?.( 9 ) ).toMatchObject ( {
            kind: "add_chart_terminal_indicator",
            indicator: { id: 1 },
            expectedRevision: 9,
        } );
    } );

    it ( "adds a visual terminal relation through a keyboard-opened accessible state-selection dialog", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                indicators:
                {
                    ...emptyDraft.chart.indicators,
                    terminalStateIndicators: [ { id: 7, x: 300, y: 100 } ],
                    terminalStateTransitions: [ { state: "state_connected", terminalStateIndicatorId: 7 } ],
                },
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states:
                [
                    { name: "state_available", description: "Available" },
                    { name: "state_connected", description: "Connected" },
                ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const terminalIndicator = screen.getByRole ( "button", {
            name: "Terminal indicator 7. Press Enter or Space to connect a source state.",
        } );

        terminalIndicator.focus ();
        await user.keyboard ( " " );

        // Initialize the local values needed by this operation.

        const connectionDialog  = screen.getByRole ( "dialog", { name: "Connect Terminal Indicator" } );
        const sourceStateSelect = within ( connectionDialog ).getByRole ( "combobox", { name: "Source state" } );

        expect ( within ( connectionDialog ).getByText (
            "Choose an unconnected source state to add a visual-only relation to Terminal Indicator 7.",
        ) ).toBeVisible ();
        expect ( within ( sourceStateSelect ).getByRole ( "option", { name: "state_available" } ) ).toBeVisible ();
        expect ( within ( sourceStateSelect ).queryByRole ( "option", { name: "state_connected" } ) ).toBeNull ();

        await user.selectOptions ( sourceStateSelect, "state_available" );
        await user.click ( within ( connectionDialog ).getByRole ( "button", { name: "Confirm" } ) );

        expect ( commandFactories ).toHaveLength ( 1 );
        expect ( commandFactories [ 0 ]?.( 12 ) ).toEqual ( {
            kind: "connect_chart_terminal_indicator",
            state: "state_available",
            indicatorId: 7,
            expectedRevision: 12,
        } );
    } );

    it ( "explains when every state already has a visual terminal relation", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                indicators:
                {
                    ...emptyDraft.chart.indicators,
                    terminalStateIndicators: [ { id: 2, x: 300, y: 100 } ],
                    terminalStateTransitions: [ { state: "state_connected", terminalStateIndicatorId: 2 } ],
                },
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_connected", description: "Connected" } ],
            },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const terminalIndicator = screen.getByRole ( "button", {
            name: "Terminal indicator 2. Press Enter or Space to connect a source state.",
        } );

        terminalIndicator.focus ();
        await user.keyboard ( "{Enter}" );

        const connectionDialog = screen.getByRole ( "dialog", { name: "Connect Terminal Indicator" } );

        expect ( within ( connectionDialog ).getByText (
            "Every declared state already has a Terminal Indicator relation.",
        ) ).toBeVisible ();
        expect ( within ( connectionDialog ).getByRole ( "button", { name: "Confirm" } ) ).toBeDisabled ();
    } );

    it ( "falls back before projecting terminal visuals that exceed the total Chart node limit", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft              = createEmptyAuthoringDraft ( true );
        const terminalStateIndicators = Array.from (
            { length: MAXIMUM_INTERACTIVE_CHART_NODE_COUNT + 1 },
            ( _value, identifier ) => ( { id: identifier, x: identifier, y: 0 } ),
        );
        const draft = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                indicators: { ...emptyDraft.chart.indicators, terminalStateIndicators },
            },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const fallback = screen.getByRole ( "status" );

        expect ( within ( fallback ).getByText ( "Chart nodes" ) ).toBeVisible ();
        expect ( within ( fallback ).getByText ( String ( MAXIMUM_INTERACTIVE_CHART_NODE_COUNT + 1 ) ) ).toBeVisible ();
        expect ( reactFlowRenderSpy ).not.toHaveBeenCalled ();
    } );

    it ( "disables every Palette action that would cross an exact Chart node limit", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft              = createEmptyAuthoringDraft ( true );
        const terminalStateIndicators = Array.from (
            { length: MAXIMUM_INTERACTIVE_CHART_NODE_COUNT },
            ( _value, identifier ) => ( { id: identifier, x: identifier, y: 0 } ),
        );
        const draft = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                indicators: { ...emptyDraft.chart.indicators, terminalStateIndicators },
            },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const palette = screen.getByRole ( "complementary", { name: "Palette" } );

        expect ( within ( palette ).getByRole ( "button", { name: "State" } ) ).toBeDisabled ();
        expect ( within ( palette ).getByRole ( "button", { name: "Initial Indicator" } ) ).toBeDisabled ();
        expect ( within ( palette ).getByRole ( "button", { name: "Terminal Indicator" } ) ).toBeDisabled ();
        expect ( within ( palette ).getByRole ( "button", { name: "Transition" } ) ).toBeEnabled ();
    } );

    it ( "disables and guards every Chart relation-add path at the exact relation limit", async () =>
    {
        // Initialize the local values needed by this operation.

        const user            = userEvent.setup ();
        const emptyDraft      = createEmptyAuthoringDraft ( true );
        const transitionTable = Array.from ( { length: MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT }, () => ( {
            state: "state_source",
            event: "event_next",
            stateNext: "state_source",
        } ) );
        const draft = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                indicators:
                {
                    ...emptyDraft.chart.indicators,
                    terminalStateIndicators: [ { id: 0, x: 300, y: 100 } ],
                },
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                initialState: "state_source",
                states: [ { name: "state_source", description: "Source" } ],
                transitionTable,
            },
        };
        const onInteractionError = vi.fn ();

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { onInteractionError }
                onNew              = { vi.fn () }
            />,
        );

        const palette = screen.getByRole ( "complementary", { name: "Palette" } );

        expect ( within ( palette ).getByRole ( "button", { name: "Initial Indicator" } ) ).toBeEnabled ();
        expect ( within ( palette ).getByRole ( "button", { name: "Transition" } ) ).toBeDisabled ();

        const terminalIndicator = screen.getByRole ( "button", {
            name: "Terminal indicator 0. Press Enter or Space to connect a source state.",
        } );

        terminalIndicator.focus ();
        await user.keyboard ( "{Enter}" );

        const connectionDialog = screen.getByRole ( "dialog", { name: "Connect Terminal Indicator" } );

        expect ( within ( connectionDialog ).getByText (
            "The interactive Chart relation limit has been reached.",
        ) ).toBeVisible ();
        expect ( within ( connectionDialog ).getByRole ( "button", { name: "Confirm" } ) ).toBeDisabled ();

        const renderedProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];

        act ( () => renderedProperties?.onConnect?. ( { source: "state:state_source", target: "terminal:0" } ) );
        act ( () => renderedProperties?.onConnect?. ( {
            source: "state:state_source",
            target: "state:state_source",
        } ) );

        expect ( onInteractionError ).toHaveBeenCalledTimes ( 2 );
        expect ( onInteractionError ).toHaveBeenNthCalledWith (
            1,
            "The interactive Chart relation limit has been reached.",
        );
    } );

    it ( "includes visual terminal relations in the total Chart relation limit", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft      = createEmptyAuthoringDraft ( true );
        const transitionTable = Array.from ( { length: MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT }, () => ( {
            state: "state_source",
            event: "event_next",
            stateNext: "state_source",
        } ) );
        const draft = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                indicators:
                {
                    ...emptyDraft.chart.indicators,
                    terminalStateIndicators: [ { id: 0, x: 300, y: 100 } ],
                    terminalStateTransitions: [ { state: "state_source", terminalStateIndicatorId: 0 } ],
                },
            },
            stateMachine: { ...emptyDraft.stateMachine, transitionTable },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        const fallback = screen.getByRole ( "status" );

        expect ( within ( fallback ).getByText ( "Chart relations" ) ).toBeVisible ();
        expect ( within ( fallback ).getByText ( String ( MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT + 1 ) ) ).toBeVisible ();
        expect ( reactFlowRenderSpy ).not.toHaveBeenCalled ();
    } );

    it ( "waits for an explicit Automatic Layout command when complete state geometry is all zero", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ( false );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                events: [ { name: "event_go", description: "Go" } ],
                states:
                [
                    { name: "state_one", description: "One" },
                    { name: "state_two", description: "Two" },
                ],
                transitionTable: [ { state: "state_two", event: "event_go", stateNext: "state_one" } ],
            },
            chart:
            {
                ...emptyDraft.chart,
                states:
                [
                    { state: "state_one", x: 0, y: 0 },
                    { state: "state_two", x: 0, y: 0 },
                ],
            },
        };
        const automaticLayout = vi.fn ( async ( _nodes: readonly ChartLayoutNode[] ) => ( {
            effectiveMinimumStateDistance: 500,
            states:
            [
                { state: "state_one", x: 80, y: 40 },
                { state: "state_two", x: 80, y: 220 },
            ],
        } ) );
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { { layout: automaticLayout } }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        expect ( automaticLayout ).not.toHaveBeenCalled ();
        expect ( commandFactories ).toHaveLength ( 0 );

        await user.click ( screen.getByRole ( "button", { name: "Automatic Layout" } ) );
        await waitFor ( () => expect ( commandFactories ).toHaveLength ( 1 ) );

        expect ( automaticLayout ).toHaveBeenCalledOnce ();
        expect ( automaticLayout.mock.calls [ 0 ]?.[ 0 ] ).toEqual (
            expect.arrayContaining (
                [
                    expect.objectContaining ( { isInitial: false, state: "state_one" } ),
                    expect.objectContaining ( { isInitial: true, state: "state_two" } ),
                ],
            ),
        );
        expect ( automaticLayout.mock.calls [ 0 ]?.[ 0 ]?.[ 0 ]?.state ).toBe ( "state_two" );
        expect ( commandFactories [ 0 ]?.( 7 ) ).toMatchObject ( {
            kind: "replace_chart_geometry",
            statePlacements:
            [
                { state: "state_one", x: 80, y: 40 },
                { state: "state_two", x: 80, y: 220 },
            ],
            expectedRevision: 7,
        } );
    } );

    it ( "reports to Console when the layout raises the minimum distance above the configured value", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ( false );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states:
                [
                    { name: "state_one", description: "One" },
                    { name: "state_two", description: "Two" },
                ],
            },
        };
        const onLayoutDiagnostic = vi.fn ();

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { { layout: async () => ( {
                    effectiveMinimumStateDistance: 812.4,
                    states:
                    [
                        { state: "state_one", x: 0, y: 0 },
                        { state: "state_two", x: 0, y: 900 },
                    ],
                } ) } }
                minimumStateDistance = { 500 }
                nameWrapping         = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand            = { () => true }
                onInteractionError   = { vi.fn () }
                onLayoutDiagnostic   = { onLayoutDiagnostic }
                onNew                = { vi.fn () }
            />,
        );

        await user.click ( screen.getByRole ( "button", { name: "Automatic Layout" } ) );

        await waitFor ( () => expect ( onLayoutDiagnostic ).toHaveBeenCalledTimes ( 1 ) );

        // The reported value is the enforced distance rounded up, so the message never understates
        // the separation.

        expect ( onLayoutDiagnostic.mock.calls [ 0 ]?.[ 0 ] ).toContain ( "813" );
        expect ( onLayoutDiagnostic.mock.calls [ 0 ]?.[ 0 ] ).toContain ( "500" );
    } );

    it ( "stays silent when the layout honours the configured minimum distance", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ( false );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states:
                [
                    { name: "state_one", description: "One" },
                    { name: "state_two", description: "Two" },
                ],
            },
        };
        const onLayoutDiagnostic = vi.fn ();

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { { layout: async () => ( {
                    effectiveMinimumStateDistance: 500,
                    states:
                    [
                        { state: "state_one", x: 0, y: 0 },
                        { state: "state_two", x: 0, y: 900 },
                    ],
                } ) } }
                minimumStateDistance = { 500 }
                nameWrapping         = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand            = { () => true }
                onInteractionError   = { vi.fn () }
                onLayoutDiagnostic   = { onLayoutDiagnostic }
                onNew                = { vi.fn () }
            />,
        );

        await user.click ( screen.getByRole ( "button", { name: "Automatic Layout" } ) );
        await waitFor ( () => expect ( screen.getByRole ( "button", { name: "Automatic Layout" } ) ).toBeEnabled () );

        expect ( onLayoutDiagnostic ).not.toHaveBeenCalled ();
    } );


    it ( "commits automatic-layout geometry and orphan cleanup as one document command", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ();
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                initialState: "state_one",
                states: [ { name: "state_one", description: "One" } ],
            },
            chart:
            {
                ...emptyDraft.chart,
                states: [ { state: "state_one", x: 20, y: 40, height: 62 } ],
                draftTransitions: [ { id: 9, source: { x: 10, y: 10 }, target: { x: 80, y: 10 } } ],
                indicators:
                {
                    initialStateIndicator: { x: 10, y: 20, state: null },
                    terminalStateIndicators:
                    [
                        { id: 4, x: 300, y: 100 },
                        { id: 7, x: 400, y: 100 },
                    ],
                    terminalStateTransitions: [ { state: "state_one", terminalStateIndicatorId: 7 } ],
                },
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                deleteOrphanedChartItemsDuringAutomaticLayout = { true }
                diagnostics                                   = { [] }
                documentRevision                              = { 3 }
                draft                                         = { draft }
                layoutPort                                    = { { layout: async () => ( {
                    effectiveMinimumStateDistance: 500,
                    states: [ { state: "state_one", x: 100, y: 80 } ],
                } ) } }
                nameWrapping = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand    = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        await user.click ( screen.getByRole ( "button", { name: "Automatic Layout" } ) );
        await waitFor ( () => expect ( commandFactories ).toHaveLength ( 1 ) );

        expect ( commandFactories [ 0 ]?.( 3 ) ).toMatchObject ( {
            kind: "replace_chart_geometry",
            deleteOrphanedItems: true,
            initialStateIndicator: null,
            terminalStateIndicators: [ { id: 7 } ],
            draftTransitions: [],
            statePlacements: [ { state: "state_one", x: 100, y: 80, height: 62 } ],
            expectedRevision: 3,
        } );
    } );

    it ( "places connected terminal indicators in stable non-overlapping layout lanes", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ();
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_one", description: "One" } ],
            },
            chart:
            {
                ...emptyDraft.chart,
                states: [ { state: "state_one", x: 20, y: 40, height: 62 } ],
                indicators:
                {
                    initialStateIndicator: null,
                    terminalStateIndicators:
                    [
                        { id: 9, x: 300, y: 100 },
                        { id: 2, x: 400, y: 100 },
                    ],
                    terminalStateTransitions:
                    [
                        { state: "state_one", terminalStateIndicatorId: 9 },
                        { state: "state_one", terminalStateIndicatorId: 2 },
                    ],
                },
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 4 }
                draft            = { draft }
                layoutPort       = { { layout: async () => ( {
                    effectiveMinimumStateDistance: 500,
                    states: [ { state: "state_one", x: 100, y: 80 } ],
                } ) } }
                nameWrapping = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand    = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        await user.click ( screen.getByRole ( "button", { name: "Automatic Layout" } ) );
        await waitFor ( () => expect ( commandFactories ).toHaveLength ( 1 ) );

        const command = commandFactories [ 0 ]?.( 4 );

        expect ( command ).toMatchObject ( { kind: "replace_chart_geometry" } );

        // Handle the case where command kind matches "replace_chart_geometry".

        if ( command?.kind === "replace_chart_geometry" )
        {
            // Initialize the local values needed by this operation.

            const indicatorByIdentifier = new Map ( command.terminalStateIndicators.map ( indicator =>
                [ indicator.id, indicator ] ) );

            expect ( indicatorByIdentifier.get ( 2 )?.y ).toBeLessThan ( indicatorByIdentifier.get ( 9 )?.y ?? 0 );
            expect ( new Set ( command.terminalStateIndicators.map ( indicator => indicator.y ) ).size ).toBe ( 2 );
        }
    } );

    it ( "preserves legitimate geometry when any state coordinate is non-zero", async () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( false );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states:
                [
                    { name: "state_one", description: "One" },
                    { name: "state_two", description: "Two" },
                ],
            },
            chart:
            {
                ...emptyDraft.chart,
                states:
                [
                    { state: "state_one", x: 0, y: 0 },
                    { state: "state_two", x: 0, y: 10 },
                ],
            },
        };
        const automaticLayout = vi.fn ( async () => ( {
            effectiveMinimumStateDistance: 500,
            states: [],
        } ) );
        const onCommand = vi.fn ();

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { { layout: automaticLayout } }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { onCommand }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        await act ( async () => {} );

        expect ( automaticLayout ).not.toHaveBeenCalled ();
        expect ( onCommand ).not.toHaveBeenCalled ();
    } );

    it ( "does not dispatch when Automatic Layout returns unchanged geometry", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ( false );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_one", description: "One" } ],
            },
            chart:
            {
                ...emptyDraft.chart,
                states: [ { state: "state_one", x: 80, y: 40 } ],
            },
        };
        const automaticLayout = vi.fn ( async () => ( {
            effectiveMinimumStateDistance: 500,
            states: [ { state: "state_one", x: 80, y: 40 } ],
        } ) );
        const onCommand = vi.fn ();

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { { layout: automaticLayout } }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { onCommand }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        await user.click ( screen.getByRole ( "button", { name: "Automatic Layout" } ) );
        await waitFor ( () => expect ( automaticLayout ).toHaveBeenCalledOnce () );

        expect ( onCommand ).not.toHaveBeenCalled ();
    } );

    it ( "grid-aligns a saved expanded height during Automatic Layout without persisting content growth", async () =>
    {
        // Initialize the local values needed by this operation.

        const user       = userEvent.setup ();
        const emptyDraft = createEmptyAuthoringDraft ( false );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_one", description: "One" } ],
            },
            chart:
            {
                ...emptyDraft.chart,
                settings: { expandStates: true },
                states: [ { state: "state_one", x: 80, y: 40, height: 73 } ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];

        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 2 }
                draft            = { draft }
                gridSize         = { 20 }
                layoutPort       = { { layout: async () => ( {
                    effectiveMinimumStateDistance: 500,
                    states: [ { state: "state_one", x: 80, y: 40 } ],
                } ) } }
                nameWrapping = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand    = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
                snapToGrid         = { false }
            />,
        );

        await user.click ( screen.getByRole ( "button", { name: "Automatic Layout" } ) );
        await waitFor ( () => expect ( commandFactories ).toHaveLength ( 1 ) );

        expect ( commandFactories [ 0 ]?.( 2 ) ).toMatchObject ( {
            kind: "replace_chart_geometry",
            statePlacements: [ { state: "state_one", x: 80, y: 40, height: 80 } ],
        } );
    } );

    it ( "never publishes a self-transition loop as an obstacle to any relation", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                states:
                [
                    { state: "state_a", x: 0, y: 0 },
                    { state: "state_b", x: 0, y: 400 },
                    { state: "state_loop", x: 800, y: 0 },
                ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                initialState: "state_a",
                states:
                [
                    { name: "state_a", description: "A" },
                    { name: "state_b", description: "B" },
                    { name: "state_loop", description: "Loop" },
                ],
                events: [ { name: "event_go", description: "Go" } ],
                transitionTable:
                [
                    { state: "state_a", event: "event_go", stateNext: "state_b" },
                    { state: "state_loop", event: "event_go", stateNext: "state_loop" },
                ],
            },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { () => true }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        // Initialize the local values needed by this operation.

        const renderedEdges = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ].edges ?? [];
        const unrelatedEdge = renderedEdges.find ( edge => edge.data?.state === "state_a" );
        const loopEdge      = renderedEdges.find ( edge => edge.data?.state === "state_loop" );

        expect ( loopEdge?.data?.selfLoopGeometry ).toBeDefined ();

        // The unrelated relation excludes its own two endpoint states, leaving the third state
        // alone. A loop rectangle is never added: publishing one removes any enclosed route
        // endpoint from the visibility lattice and dashes every relation incident on the enclosed
        // state. See AL-UI-036.

        expect ( unrelatedEdge?.data?.orthogonalObstacles ).toHaveLength ( 1 );
        expect ( unrelatedEdge?.data?.orthogonalLabelObstacles ).toHaveLength ( 3 );

        // The loop's own relation sees only the two other states, likewise with no loop rectangle.

        expect ( loopEdge?.data?.orthogonalObstacles ).toHaveLength ( 2 );
    } );

    it ( "derives center-routed transition lanes and atomically reconnects semantic endpoints", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                states:
                [
                    { state: "state_idle", x: 0, y: 0 },
                    { state: "state_done", x: 400, y: 0 },
                ],
                indicators:
                {
                    ...emptyDraft.chart.indicators,
                    initialStateIndicator: { x: 20, y: 20 },
                },
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                initialState: "state_idle",
                states:
                [
                    { name: "state_idle", description: "Idle" },
                    { name: "state_done", description: "Done" },
                ],
                events:
                [
                    { name: "event_finish", description: "Finish" },
                    { name: "event_manual", description: "Manual" },
                    { name: "event_loop", description: "Loop" },
                ],
                transitionTable:
                [
                    { state: "state_idle", event: "event_finish", stateNext: "state_done" },
                    { state: "state_idle", event: "event_manual", stateNext: "state_done" },
                    { state: "state_idle", event: "event_loop", stateNext: "state_idle" },
                ],
            },
        };
        const commandFactories: DocumentCommandFactory[] = [];
        render (
            <ChartPage
                diagnostics      = { [] }
                documentRevision = { 1 }
                draft            = { draft }
                layoutPort       = { layoutPort }
                nameWrapping     = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand        = { commandFactory =>
                {
                    commandFactories.push ( commandFactory );

                    // Return the computed result.

                    return true;
                } }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        // Initialize the local values needed by this operation.

        const renderedEdges = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ].edges ?? [];
        const finishEdge    = renderedEdges.find ( edge => edge.data?.event === "event_finish" );
        const manualEdge    = renderedEdges.find ( edge => edge.data?.event === "event_manual" );
        const selfEdge      = renderedEdges.find ( edge => edge.data?.event === "event_loop" );

        expect ( renderedEdges ).toHaveLength ( 4 );
        expect ( finishEdge ).toMatchObject ( {
            ariaRole: "button",
            type: "center",
            sourceHandle: "right",
            targetHandle: "left",
            reconnectable: false,
            data: { parallelLaneCount: 2, parallelLanePosition: -0.5, selfLoopIndex: null },
        } );
        expect ( manualEdge ).toMatchObject ( {
            type: "center",
            sourceHandle: "right",
            targetHandle: "left",
            reconnectable: false,
            data: { parallelLaneCount: 2, parallelLanePosition: 0.5, selfLoopIndex: null },
        } );
        expect ( selfEdge ).toMatchObject ( {
            type: "center",
            data: { selfLoopIndex: 0 },
        } );
        expect ( selfEdge?.sourceHandle ).toBe ( selfEdge?.targetHandle );
        expect ( selfEdge?.data?.selfLoopGeometry?.side ).toBe ( selfEdge?.sourceHandle );

        // Loops are route obstacles only. Their rectangles bound an arc whose interior is empty, so
        // they are kept out of the label obstacle field, and they are withheld from the routes of
        // the state that owns them.

        expect ( finishEdge?.data?.orthogonalLabelObstacles ).toHaveLength ( 3 );
        expect ( finishEdge?.data?.orthogonalObstacles ).toHaveLength ( 1 );
        expect ( renderedEdges.filter ( edge => edge.data?.kind !== "transition" ).every (
            edge => edge.type === "center" && edge.reconnectable === false,
        ) ).toBe ( true );

        const renderedProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];

        act ( () => renderedProperties?.onInit?. ( {
            getViewport: () => ( { x: 0, y: 0, zoom: 2 } ),
            screenToFlowPosition: ( point: { x: number; y: number } ) => ( { x: point.x / 2, y: point.y / 2 } ),
        } ) );

        // Handle the case where finish edge differs from undefined.

        if ( finishEdge !== undefined )
        {
            act ( () => renderedProperties?.onSelectionChange?. ( { edges: [ finishEdge ], nodes: [] } ) );
        }

        expect ( renderedProperties?.edgesReconnectable ).toBe ( false );
        expect ( renderedProperties?.ariaLabelConfig ).toMatchObject ( {
            "edge.a11yDescription.default": expect.stringContaining ( "semantic transition" ),
            "node.a11yDescription.default": expect.stringContaining ( "activate this Chart element" ),
        } );

        // Initialize the local values needed by this operation.

        const sourceEndpoint = screen.getByRole ( "button", {
            name: "Reconnect transition source endpoint state_idle, event_finish, state_done",
        } );
        const targetEndpoint = screen.getByRole ( "button", {
            name: "Reconnect transition target endpoint state_idle, event_finish, state_done",
        } );
        const pointerSource = {
            clientX: Number.parseFloat ( sourceEndpoint.style.left ) * 2,
            clientY: Number.parseFloat ( sourceEndpoint.style.top ) * 2,
        };

        fireEvent.pointerDown ( sourceEndpoint, { ...pointerSource, pointerId: 7 } );
        fireEvent.pointerUp ( sourceEndpoint, { clientX: 802, clientY: 2, pointerId: 7 } );

        expect ( commandFactories [ 0 ]?.( 21 ) ).toMatchObject ( {
            kind: "detach_transition_endpoint", index: 0, endpoint: "source", expectedRevision: 21,
        } );

        fireEvent.pointerDown ( sourceEndpoint, { ...pointerSource, pointerId: 8 } );
        fireEvent.pointerUp ( sourceEndpoint, { clientX: 1100, clientY: 100, pointerId: 8 } );

        expect ( commandFactories [ 1 ]?.( 22 ) ).toEqual ( {
            kind: "update_transition",
            index: 0,
            transition: { state: "state_done", event: "event_finish", stateNext: "state_done" },
            chartStatePlacements: [],
            expectedRevision: 22,
        } );

        fireEvent.click ( targetEndpoint, { detail: 0 } );
        expect ( screen.getByRole ( "dialog", { name: "Transition" } ) ).toBeVisible ();
    } );

    it ( "clips neutral rectangular and circular relationships at visible boundaries and makes loops distinct", () =>
    {
        // Initialize the local values needed by this operation.

        const rectangleBoundary = { height: 80, kind: "rectangle" as const, radius: 0, width: 200 };
        const circleBoundary    = { height: 42, kind: "circle" as const, radius: 16, width: 42 };
        const curvedGeometry    = calculateCenterRoutedEdgeGeometry (
            { x: 207, y: 40 },
            { x: 372, y: 40 },
            {
                kind: "terminal",
                state: "state_a",
                canonicalDirectionSign: 1,
                parallelLaneCount: 1,
                parallelLanePosition: 0,
                selfLoopIndex: null,
                sourceBoundary: rectangleBoundary,
                sourceTechnicalSide: "right",
                targetBoundary: circleBoundary,
                targetTechnicalSide: "left",
                transitionGravityPointDistance: 12,
            },
        );

        expect ( curvedGeometry.source.x ).toBeCloseTo ( 200, 6 );
        expect ( curvedGeometry.source.y ).toBeCloseTo ( 40, 6 );
        expect ( Math.hypot ( curvedGeometry.target.x - 400, curvedGeometry.target.y - 40 ) ).toBeCloseTo ( 16, 6 );
        expect ( curvedGeometry.path ).toContain ( " C " );
        expect ( curvedGeometry.path ).not.toContain ( " L " );

        // Initialize the local values needed by this operation.

        const loopState =
        {
            center:       { x: 100, y: 40 },
            cornerRadius: 10,
            height:       94,
            width:        214,
        };
        const loopPreferences =
        {
            selfTransitionLoopAspect:    35,
            selfTransitionLoopExtension: 30,
            selfTransitionLoopSpacing:   24,
        };
        const loopAxes   = selfTransitionLoopMajorSemiAxes ( loopState, "right", loopPreferences, [ 0, 0 ] );
        const loopAspect = selfTransitionLoopAspectRatio (
            loopState,
            "right",
            loopPreferences,
            loopAxes [ 1 ] ?? 0,
        );
        const firstLoop = calculateCenterRoutedEdgeGeometry (
            { x: 214, y: 40 },
            { x: 214, y: 40 },
            {
                kind: "transition",
                state: "state_a",
                event: "event_x",
                stateNext: "state_a",
                transitionIndex: 0,
                canonicalDirectionSign: 1,
                parallelLaneCount: 1,
                parallelLanePosition: 0,
                selfLoopIndex: 0,
                selfLoopGeometry: selfTransitionLoopGeometry (
                    loopState,
                    "right",
                    loopAspect,
                    loopAxes [ 0 ] ?? 0,
                ),
                sourceBoundary: rectangleBoundary,
                sourceTechnicalSide: "right",
                targetBoundary: rectangleBoundary,
                targetTechnicalSide: "right",
                transitionGravityPointDistance: 12,
            },
        );
        const secondLoopGeometry = selfTransitionLoopGeometry (
            loopState,
            "right",
            loopAspect,
            loopAxes [ 1 ] ?? 0,
        );
        const secondLoop = calculateCenterRoutedEdgeGeometry (
            { x: 214, y: 40 },
            { x: 214, y: 40 },
            {
                kind: "transition",
                state: "state_a",
                event: "event_y",
                stateNext: "state_a",
                transitionIndex: 1,
                canonicalDirectionSign: 1,
                parallelLaneCount: 1,
                parallelLanePosition: 0,
                selfLoopIndex: 1,
                selfLoopGeometry: secondLoopGeometry,
                sourceBoundary: rectangleBoundary,
                sourceTechnicalSide: "right",
                targetBoundary: rectangleBoundary,
                targetTechnicalSide: "right",
                transitionGravityPointDistance: 12,
            },
        );

        expect ( firstLoop.path ).not.toBe ( secondLoop.path );
        expect ( secondLoopGeometry.majorSemiAxis ).toBeGreaterThan ( loopAxes [ 0 ] ?? 0 );
    } );

    it ( "clips diagonal relationships to the rounded state border instead of its transparent corner", () =>
    {
        // Initialize the local values needed by this operation.

        const roundedStateBoundary = { height: 100, kind: "rectangle" as const, radius: 0, width: 100 };
        const geometry             = calculateCenterRoutedEdgeGeometry (
            { x: 57, y: 0 },
            { x: 43, y: 90 },
            {
                kind: "transition",
                state: "state_source",
                event: "event_corner",
                stateNext: "state_target",
                transitionIndex: 0,
                canonicalDirectionSign: 1,
                parallelLaneCount: 1,
                parallelLanePosition: 0,
                selfLoopIndex: null,
                sourceBoundary: roundedStateBoundary,
                sourceTechnicalSide: "right",
                targetBoundary: roundedStateBoundary,
                targetTechnicalSide: "left",
                transitionGravityPointDistance: 12,
            },
        );

        expect ( geometry.source.x ).toBeLessThanOrEqual ( 50.000001 );
        expect ( geometry.source.y ).toBeLessThanOrEqual ( 50.000001 );
        expect ( geometry.target.x ).toBeGreaterThanOrEqual ( 49.999999 );
        expect ( geometry.target.y ).toBeGreaterThanOrEqual ( 39.999999 );
        expect ( geometry.path ).toContain ( " C " );
    } );

    it ( "derives a deterministic smooth exterior route around an unrelated opaque state", () =>
    {
        // Initialize the local values needed by this operation.

        const boundary = { height: 80, kind: "rectangle" as const, radius: 0, width: 80 };
        const geometry = calculateCenterRoutedEdgeGeometryFromCenters (
            { x: 0, y: 0 },
            { x: 240, y: 0 },
            {
                kind: "transition",
                state: "state_source",
                event: "event_go",
                stateNext: "state_target",
                transitionIndex: 0,
                canonicalDirectionSign: 1,
                orthogonalObstacles: [ { x: 90, y: -45, width: 60, height: 90 } ],
                parallelLaneCount: 1,
                parallelLanePosition: 0,
                selfLoopIndex: null,
                sourceBoundary: boundary,
                sourceTechnicalSide: "right",
                targetBoundary: boundary,
                targetTechnicalSide: "left",
                transitionGravityPointDistance: 12,
                transitionLabelPosition: 0.2,
            },
        );

        expect ( geometry.path ).toContain ( " C " );
        expect ( geometry.path ).not.toContain ( " L " );
        expect ( geometry.source.y ).toBeCloseTo ( -40, 6 );
        expect ( geometry.target.y ).toBeCloseTo ( -40, 6 );
        expect ( geometry.source.x ).not.toBeCloseTo ( 40, 6 );
        expect ( geometry.target.x ).not.toBeCloseTo ( 200, 6 );
        expect ( Math.abs ( geometry.labelY ) ).toBeGreaterThan ( 45 );

        // Initialize the local values needed by this operation.

        const values = [ ...geometry.path.matchAll ( /-?\d+(?:\.\d+)?/g ) ].map ( match => Number ( match [ 0 ] ) );
        let source   = { x: values [ 0 ] ?? 0, y: values [ 1 ] ?? 0 };

        // Repeat the operation across the bounded iteration range.

        for ( let commandIndex = 2; commandIndex + 5 < values.length; commandIndex += 6 )
        {
            // Initialize the local values needed by this operation.

            const sourceControl = { x: values [ commandIndex ] ?? 0, y: values [ commandIndex + 1 ] ?? 0 };
            const targetControl = { x: values [ commandIndex + 2 ] ?? 0, y: values [ commandIndex + 3 ] ?? 0 };
            const target        = { x: values [ commandIndex + 4 ] ?? 0, y: values [ commandIndex + 5 ] ?? 0 };

            // Repeat the operation across the bounded iteration range.

            for ( let sampleIndex = 0; sampleIndex <= 100; sampleIndex += 1 )
            {
                // Initialize the local values needed by this operation.

                const position   = sampleIndex / 100;
                const complement = 1 - position;
                const point      = {
                    x: complement ** 3 * source.x +
                        3 * complement ** 2 * position * sourceControl.x +
                        3 * complement * position ** 2 * targetControl.x +
                        position ** 3 * target.x,
                    y: complement ** 3 * source.y +
                        3 * complement ** 2 * position * sourceControl.y +
                        3 * complement * position ** 2 * targetControl.y +
                        position ** 3 * target.y,
                };

                expect ( point.x > 90 && point.x < 150 && point.y > -45 && point.y < 45 ).toBe ( false );
            }

            source = target;
        }
    } );

    it ( "uses two internal backbone points as the controls of one cubic curve", () =>
    {
        // Initialize the local values needed by this operation.

        const path = curvedBezierPathFromBackbone ( [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 200, y: 100 },
        ] );
        const values = [ ...path.matchAll ( /-?\d+(?:\.\d+)?/g ) ].map ( match => Number ( match [ 0 ] ) );

        expect ( path.match ( / C /g ) ).toHaveLength ( 1 );
        expect ( path ).not.toContain ( " L " );
        expect ( { x: values [ 2 ], y: values [ 3 ] } ).toEqual ( { x: 100, y: 0 } );
        expect ( { x: values [ 4 ], y: values [ 5 ] } ).toEqual ( { x: 100, y: 100 } );
        expect ( { x: values [ 6 ], y: values [ 7 ] } ).toEqual ( { x: 200, y: 100 } );
    } );

    it ( "converts a cubic B-spline backbone to C2-continuous cubic spans", () =>
    {
        // Initialize the local values needed by this operation.

        const path = curvedBezierPathFromBackbone ( [
            { x: 0, y: 0 },
            { x: 80, y: 0 },
            { x: 100, y: 80 },
            { x: 180, y: 100 },
            { x: 220, y: 40 },
        ] );
        const values = [ ...path.matchAll ( /-?\d+(?:\.\d+)?/g ) ].map ( match => Number ( match [ 0 ] ) );

        expect ( path.match ( / C /g ) ).toHaveLength ( 2 );

        // Initialize the local values needed by this operation.

        const firstSourceControl  = { x: values [ 2 ] ?? 0, y: values [ 3 ] ?? 0 };
        const firstTargetControl  = { x: values [ 4 ] ?? 0, y: values [ 5 ] ?? 0 };
        const join                = { x: values [ 6 ] ?? 0, y: values [ 7 ] ?? 0 };
        const secondSourceControl = { x: values [ 8 ] ?? 0, y: values [ 9 ] ?? 0 };
        const secondTargetControl = { x: values [ 10 ] ?? 0, y: values [ 11 ] ?? 0 };
        const incomingDerivative  = {
            x: join.x - firstTargetControl.x,
            y: join.y - firstTargetControl.y,
        };
        const outgoingDerivative = {
            x: secondSourceControl.x - join.x,
            y: secondSourceControl.y - join.y,
        };
        const incomingSecondDerivative = {
            x: join.x - 2 * firstTargetControl.x + firstSourceControl.x,
            y: join.y - 2 * firstTargetControl.y + firstSourceControl.y,
        };
        const outgoingSecondDerivative = {
            x: secondTargetControl.x - 2 * secondSourceControl.x + join.x,
            y: secondTargetControl.y - 2 * secondSourceControl.y + join.y,
        };

        expect ( incomingDerivative.x ).toBeCloseTo ( outgoingDerivative.x, 8 );
        expect ( incomingDerivative.y ).toBeCloseTo ( outgoingDerivative.y, 8 );
        expect ( incomingSecondDerivative.x ).toBeCloseTo ( outgoingSecondDerivative.x, 8 );
        expect ( incomingSecondDerivative.y ).toBeCloseTo ( outgoingSecondDerivative.y, 8 );
        expect ( join ).not.toEqual ( { x: 100, y: 80 } );
    } );

    it ( "renders a direct relation as a neutral straight cubic", () =>
    {
        // Initialize the local values needed by this operation.

        const path   = curvedBezierPathFromBackbone ( [ { x: 0, y: 0 }, { x: 200, y: 0 } ] );
        const values = [ ...path.matchAll ( /-?\d+(?:\.\d+)?/g ) ]
            .map ( match => Number ( match [ 0 ] ) );

        expect ( path ).toContain ( " C " );
        expect ( values [ 3 ] ).toBe ( 0 );
        expect ( values [ 5 ] ).toBe ( 0 );
    } );

    it ( "does not interpolate a single internal gravity point", () =>
    {
        // Initialize the local values needed by this operation.

        const path = curvedBezierPathFromBackbone ( [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
        ] );

        expect ( path.match ( / C /g ) ).toHaveLength ( 1 );
        expect ( path ).toMatch ( /M 0 0 C .+, 100 100$/u );
        expect ( path ).not.toMatch ( /, 100 0(?: C|$)/u );
    } );

    it ( "compacts floating-point routing noise into a neutral direct path", () =>
    {
        // Initialize the local values needed by this operation.

        const path = curvedBezierPathFromBackbone ( [
            { x: 0, y: 0 },
            { x: 0.000000001, y: 100 },
            { x: 0, y: 100 },
        ] );
        const values = [ ...path.matchAll ( /-?\d+(?:\.\d+)?/g ) ].map ( match => Number ( match [ 0 ] ) );

        expect ( path.match ( / C /g ) ).toHaveLength ( 1 );
        expect ( values [ 2 ] ).toBe ( 0 );
        expect ( values [ 4 ] ).toBe ( 0 );
    } );

    it ( "keeps a coincident coordinate-only draft relation visibly curved", () =>
    {
        // Initialize the local values needed by this operation.

        const path = curvedBezierPathFromBackbone ( [ { x: 40, y: 60 }, { x: 40, y: 60 } ] );

        expect ( path ).toContain ( "M 40 60 C" );
        expect ( path ).not.toBe ( "M 40 60 C 40 60, 40 60, 40 60" );
    } );

    it ( "keeps four invisible technical handles for React Flow while routing remains center-derived", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_handles", description: "Handles" } ],
            },
        };
        const viewModel = createAuthoringChartProjection (
            draft,
            [],
            { actionNames: false, eventNames: false, stateNames: false },
        ).states [ 0 ];

        expect ( viewModel ).toBeDefined ();

        // Handle the case where view model matches undefined.

        if ( viewModel === undefined )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const nodeProperties = {
            id: "state:state_handles",
            data: { viewModel },
            selected: false,
            dragging: false,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
            zIndex: 0,
        } as Parameters<typeof StateChartStateNodeComponent>[ 0 ];
        const { container } = render ( <StateChartStateNodeComponent { ...nodeProperties } /> );
        const handles = Array.from ( container.querySelectorAll<HTMLElement> ( "[data-handle-id]" ) );

        expect ( handles.map ( handle => handle.dataset [ "handleId" ] ) ).toEqual (
            [ "top", "right", "bottom", "left" ],
        );
        expect ( handles.every ( handle => handle.dataset [ "handleType" ] === "source" ) ).toBe ( true );
    } );

    it ( "omits state validation markers and the redundant initial-state badge", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: [ { name: "state_initial", description: "Initial state" } ],
            },
        };
        const projectedState = createAuthoringChartProjection (
            draft,
            [],
            { actionNames: false, eventNames: false, stateNames: false },
        ).states [ 0 ];

        expect ( projectedState ).toBeDefined ();

        // Handle the case where projected state matches undefined.

        if ( projectedState === undefined )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const nodeProperties = {
            id: "state:state_initial",
            data:
            {
                viewModel:
                {
                    ...projectedState,
                    isInitial: true,
                    isPersisted: true,
                    validationStatus: "passed" as const,
                },
            },
            selected: false,
            dragging: false,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
            zIndex: 0,
        } as Parameters<typeof StateChartStateNodeComponent>[ 0 ];
        const { container } = render ( <StateChartStateNodeComponent { ...nodeProperties } /> );

        expect ( screen.queryByTitle ( "Validation passed" ) ).not.toBeInTheDocument ();
        expect ( screen.queryByText ( "Initial" ) ).not.toBeInTheDocument ();
        expect ( container.querySelector ( ".chart-validation-marker" ) ).toBeNull ();
        expect ( container.querySelector ( ".chart-state-markers" ) ).toBeNull ();
    } );

    it ( "does not restart a failed route when a parent rerenders with equivalent wrapping preferences", async () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states:
                [
                    { name: "state_off", description: "Off" },
                    { name: "state_on", description: "On" },
                ],
                events: [ { name: "event_toggle", description: "Toggle" } ],
                transitionTable: [ { state: "state_off", event: "event_toggle", stateNext: "state_on" } ],
            },
        };
        const route                         = vi.fn<ChartRoutingPort[ "route" ]> ().mockRejectedValue ( new Error ( "Route failed" ) );
        const routingPort: ChartRoutingPort = { cancel: vi.fn (), route };
        const onRoutingDiagnostic           = vi.fn ();
        const properties                    = {
            diagnostics: [] as const,
            documentRevision: 1,
            draft,
            layoutPort,
            onCommand: vi.fn (),
            onInteractionError: vi.fn (),
            onNew: vi.fn (),
            onRoutingDiagnostic,
            routingPort,
            transitionGravityPointDistance: 37,
        };
        const { rerender } = render (
            <ChartPage
                { ...properties }
                nameWrapping={ { actionNames: false, eventNames: false, stateNames: false } }
            />,
        );

        await waitFor ( () => expect ( onRoutingDiagnostic ).toHaveBeenCalledOnce () );
        rerender (
            <ChartPage
                { ...properties }
                nameWrapping={ { actionNames: false, eventNames: false, stateNames: false } }
            />,
        );
        await act ( async () => Promise.resolve () );

        expect ( route ).toHaveBeenCalledOnce ();
        expect ( route ).toHaveBeenCalledWith ( expect.objectContaining ( {
            transitionGravityPointDistance: 37,
        } ) );
        expect ( reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ].edges?.[ 0 ]?.data )
            .toMatchObject ( { transitionGravityPointDistance: 37 } );
        expect ( onRoutingDiagnostic ).toHaveBeenCalledOnce ();
    } );

    it ( "marks an exterior routing fallback visibly and in accessible relation descriptions", async () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            chart:
            {
                ...emptyDraft.chart,
                draftTransitions: [ { id: 9, source: { x: 20, y: 20 }, target: { x: 180, y: 20 } } ],
            },
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states:
                [
                    { name: "state_off", description: "Off" },
                    { name: "state_on", description: "On" },
                ],
                events: [ { name: "event_toggle", description: "Toggle" } ],
                transitionTable: [ { state: "state_off", event: "event_toggle", stateNext: "state_on" } ],
            },
        };
        const route = vi.fn<ChartRoutingPort["route"]> ( async request => ( {
            documentRevision: request.documentRevision,
            geometryRevision: request.geometryRevision,
            preferenceRevision: request.preferenceRevision,
            relations: request.relations.map ( relation => ( {
                curves: cubicBezierCurvesFromBackbone ( relation.preferredPoints ),
                exteriorFallback: true,
                identifier: relation.identifier,
                label: { x: 0, y: 0, width: relation.labelWidth, height: relation.labelHeight },
                points: relation.preferredPoints,
            } ) ),
            requestId: request.requestId,
        } ) );
        const onRoutingDiagnostic = vi.fn ();

        render (
            <ChartPage
                diagnostics         = { [] }
                documentRevision    = { 1 }
                draft               = { draft }
                layoutPort          = { layoutPort }
                nameWrapping        = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand           = { vi.fn () }
                onInteractionError  = { vi.fn () }
                onNew               = { vi.fn () }
                onRoutingDiagnostic = { onRoutingDiagnostic }
                routingPort         = { { cancel: vi.fn (), route } }
            />,
        );

        await waitFor ( () => expect ( onRoutingDiagnostic ).toHaveBeenCalledOnce () );

        // Initialize the local values needed by this operation.

        const renderedProperties = reactFlowRenderSpy.mock.calls.at ( -1 )?.[ 0 ];
        const transitionEdge     = renderedProperties?.edges?.find ( edge => edge.id?.includes ( "transition" ) );
        const draftNode          = renderedProperties?.nodes?.find ( node => node.id === "draft-transition:9" );

        expect ( transitionEdge?.ariaLabel ).toContain ( "Chart routing used a stable exterior fallback" );
        expect ( draftNode?.ariaLabel ).toContain ( "Chart routing used a stable exterior fallback" );
    } );

    it ( "keeps the no-document Chart workflow keyboard reachable", () =>
    {
        // Initialize the local values needed by this operation.

        const onNew = vi.fn ();

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 0 }
                draft              = { null }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { onNew }
            />,
        );

        fireEvent.click ( screen.getByRole ( "button", { name: "Create New Document" } ) );
        expect ( onNew ).toHaveBeenCalledOnce ();
    } );

    it ( "bounds the interactive surface and directs oversized models to the Editor", () =>
    {
        // Initialize the local values needed by this operation.

        const emptyDraft = createEmptyAuthoringDraft ( true );
        const draft      = {
            ...emptyDraft,
            stateMachine:
            {
                ...emptyDraft.stateMachine,
                states: Array.from ( { length: 1_001 }, ( _value, index ) => ( {
                    name: `state_${index}`,
                    description: "",
                } ) ),
            },
        };

        render (
            <ChartPage
                diagnostics        = { [] }
                documentRevision   = { 1 }
                draft              = { draft }
                layoutPort         = { layoutPort }
                nameWrapping       = { { actionNames: false, eventNames: false, stateNames: false } }
                onCommand          = { vi.fn () }
                onInteractionError = { vi.fn () }
                onNew              = { vi.fn () }
            />,
        );

        expect ( screen.getByRole ( "heading", { name: "Interactive Chart unavailable for this model size" } ) )
            .toBeVisible ();
        expect ( screen.getByText ( /Use the complete Editor workflow to continue authoring/iu ) )
            .toBeVisible ();
    } );
} );

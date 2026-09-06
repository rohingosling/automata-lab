// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Worker Adapter Tests
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies persistent routing workers, cooperative replacement, cache-discarding recovery, and
//   stale rejection.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it, vi } from "vitest";

import type { ChartRoutingRequest } from "../../src/application/ports/contracts.js";
import
{
    BrowserChartRoutingPort,
    CHART_ROUTING_CANCELLATION_TIMEOUT_MILLISECONDS,
} from "../../src/infrastructure/chart/browser-chart-routing-port.js";
import type
{
    ChartRoutingWorkerLike,
} from "../../src/infrastructure/chart/browser-chart-routing-port.js";
import
{
    ChartRoutingReuseCache,
    routeChartRelations,
    routeChartRelationsCooperatively,
} from "../../src/infrastructure/chart/orthogonal-chart-router.js";
import
{
    CHART_ROUTING_PROTOCOL_VERSION,
    decodeChartRoutingWorkerRequest,
    decodeChartRoutingWorkerResult,
    MAXIMUM_CHART_ROUTING_OBSTACLE_COUNT,
    MAXIMUM_CHART_ROUTING_PREFERRED_POINT_COUNT,
    MAXIMUM_CHART_ROUTING_RELATION_COUNT,
    MAXIMUM_CHART_ROUTING_RESULT_CURVE_COUNT,
    MAXIMUM_CHART_ROUTING_RESULT_POINT_COUNT,
    MAXIMUM_CHART_ROUTING_TEXT_CODE_POINT_COUNT,
} from "../../src/protocol/chart-routing-worker-protocol.js";
import type { ChartRoutingWorkerRequest } from "../../src/protocol/chart-routing-worker-protocol.js";

//--------------------------------------------------------------------------------------------------
// Class: FakeErrorEvent
//
// Description:
//
//   Implements the fake error event behavior.
//
//--------------------------------------------------------------------------------------------------

class FakeErrorEvent extends Event implements ErrorEvent
{
    public readonly colno = 0;
    public readonly error: unknown = null;
    public readonly filename = "chart-routing.worker.ts";
    public readonly lineno = 0;

    //----------------------------------------------------------------------------------------------
    // Constructor: FakeErrorEvent
    //
    // Description:
    //
    //   Initializes a FakeErrorEvent instance.
    //
    // Parameters:
    //
    //   - message:
    //     The message supplied to the operation.
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

    public constructor ( public readonly message: string )
    {
        super ( "error", { cancelable: true } );
    }
}

//--------------------------------------------------------------------------------------------------
// Class: FakeChartRoutingWorker
//
// Description:
//
//   Implements the fake chart routing worker behavior.
//
//--------------------------------------------------------------------------------------------------

class FakeChartRoutingWorker implements ChartRoutingWorkerLike
{
    public onerror: ( ( event: ErrorEvent ) => void ) | null = null;
    public onmessage: ( ( event: MessageEvent<unknown> ) => void ) | null = null;
    public readonly postedRequests: ChartRoutingWorkerRequest[] = [];
    public terminated = false;

    //----------------------------------------------------------------------------------------------
    // Method: postMessage
    //
    // Description:
    //
    //   Posts the message.
    //
    // Parameters:
    //
    //   - message:
    //     The message supplied to the operation.
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

    public postMessage ( message: ChartRoutingWorkerRequest ): void
    {
        this.postedRequests.push ( message );
    }

    //----------------------------------------------------------------------------------------------
    // Method: terminate
    //
    // Description:
    //
    //   Terminates the requested value.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    public terminate (): void
    {
        this.terminated = true;
    }

    //----------------------------------------------------------------------------------------------
    // Method: emit
    //
    // Description:
    //
    //   Emits the requested value.
    //
    // Parameters:
    //
    //   - data:
    //     The data supplied to the operation.
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

    public emit ( data: unknown ): void
    {
        this.onmessage?.( new MessageEvent ( "message", { data } ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: fail
    //
    // Description:
    //
    //   Marks the operation as failed.
    //
    // Parameters:
    //
    //   - message:
    //     The message supplied to the operation.
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

    public fail ( message: string ): void
    {
        this.onerror?.( new FakeErrorEvent ( message ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: failWithoutMessage
    //
    // Description:
    //
    //   Marks the without message as failed.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    public failWithoutMessage (): void
    {
        this.onerror?.( new Event ( "error", { cancelable: true } ) as ErrorEvent );
    }
}

//--------------------------------------------------------------------------------------------------
// Class: ThrowingPostChartRoutingWorker
//
// Description:
//
//   Implements the throwing post chart routing worker behavior.
//
//--------------------------------------------------------------------------------------------------

class ThrowingPostChartRoutingWorker extends FakeChartRoutingWorker
{
    //----------------------------------------------------------------------------------------------
    // Method: postMessage
    //
    // Description:
    //
    //   Posts the message.
    //
    // Parameters:
    //
    //   - _message:
    //     The message supplied to the operation.
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

    public override postMessage ( _message: ChartRoutingWorkerRequest ): void
    {
        throw new Error ( "Worker posting blocked." );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: createRequest
//
// Description:
//
//   Creates request for the test scenario.
//
// Parameters:
//
//   - requestId:
//     The request identifier supplied to the operation.
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

function createRequest ( requestId: string ): ChartRoutingRequest
{
    // Return the assembled result.

    return {
        documentRevision: 2,
        geometryRevision: 2,
        preferenceRevision: 1,
        requestId,
        transitionGravityPointDistance: 12,
        relations:
        [
            {
                identifier: "edge",
                labelHeight: 22,
                labelObstacles: [],
                labelPosition: 0.5,
                labelWidth: 40,
                obstacles: [],
                preferredPoints: [ { x: 0, y: 0 }, { x: 12, y: 0 }, { x: 88, y: 0 }, { x: 100, y: 0 } ],
                preservePreferred: false,
            },
        ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: workerResult
//
// Description:
//
//   Derives the worker result.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - generation:
//     The generation supplied to the operation.
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

function workerResult ( request: ChartRoutingRequest, generation = 1 )
{
    // Return the assembled result.

    return {
        generation,
        kind: "result" as const,
        protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
        result: routeChartRelations ( request ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: protocolRequest
//
// Description:
//
//   Derives the protocol request.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - generation:
//     The generation supplied to the operation.
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

function protocolRequest ( request: ChartRoutingRequest, generation = 1 )
{
    // Return the assembled result.

    return {
        generation,
        kind: "route",
        protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
        request,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: simpleResultMessage
//
// Description:
//
//   Derives the simple result message.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - generation:
//     The generation supplied to the operation.
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

function simpleResultMessage ( request: ChartRoutingRequest, generation = 1 )
{
    // Return the assembled result.

    return {
        generation,
        kind: "result",
        protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
        result:
        {
            documentRevision: request.documentRevision,
            geometryRevision: request.geometryRevision,
            preferenceRevision: request.preferenceRevision,
            requestId: request.requestId,
            relations: request.relations.map ( relation => ( {
                curves:
                [
                    {
                        source: relation.preferredPoints [ 0 ]!,
                        sourceControl: relation.preferredPoints [ 0 ]!,
                        target: relation.preferredPoints.at ( -1 )!,
                        targetControl: relation.preferredPoints.at ( -1 )!,
                    },
                ],
                exteriorFallback: false,
                identifier: relation.identifier,
                label: { x: 0, y: 0, width: relation.labelWidth, height: relation.labelHeight },
                points: [ relation.preferredPoints [ 0 ]!, relation.preferredPoints.at ( -1 )! ],
            } ) ),
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: emitWorkerResult
//
// Description:
//
//   Emits the worker result.
//
// Parameters:
//
//   - worker:
//     The worker supplied to the operation.
//
//   - request:
//     The request supplied to the operation.
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

function emitWorkerResult ( worker: FakeChartRoutingWorker, request: ChartRoutingRequest ): void
{
    // Initialize the local values needed by this operation.

    const routeRequest = worker.postedRequests.findLast ( candidate =>
        candidate.kind === "route" && candidate.request.requestId === request.requestId );

    // Handle the case where at least one branch condition is satisfied.

    if ( routeRequest === undefined || routeRequest.kind !== "route" )
    {
        throw new Error ( `No posted route request exists for ${request.requestId}.` );
    }

    worker.emit ( workerResult ( request, routeRequest.generation ) );
}

//--------------------------------------------------------------------------------------------------
// Function: emitWorkerCancellation
//
// Description:
//
//   Emits the worker cancellation.
//
// Parameters:
//
//   - worker:
//     The worker supplied to the operation.
//
//   - generation:
//     The generation supplied to the operation.
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

function emitWorkerCancellation ( worker: FakeChartRoutingWorker, generation: number ): void
{
    worker.emit ( {
        generation,
        kind: "cancelled",
        protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
    } );
}

describe ( "Chart routing Worker protocol boundary", () =>
{
    it ( "accepts every exact request cap and rejects each cap plus one", () =>
    {
        // Initialize the local values needed by this operation.

        const request         = createRequest ( "request-limits" );
        const relation        = request.relations [ 0 ]!;
        const obstacle        = { x: 0, y: 0, width: 20, height: 20 };
        const boundedRelation = {
            ...relation,
            labelObstacles: Array.from ( { length: MAXIMUM_CHART_ROUTING_OBSTACLE_COUNT }, () => obstacle ),
            obstacles: Array.from ( { length: MAXIMUM_CHART_ROUTING_OBSTACLE_COUNT }, () => obstacle ),
            preferredPoints: Array.from ( { length: MAXIMUM_CHART_ROUTING_PREFERRED_POINT_COUNT },
                ( _, index ) => ( { x: index, y: index } ) ),
        };
        const boundedRelations = Array.from ( { length: MAXIMUM_CHART_ROUTING_RELATION_COUNT }, ( _, index ) => ( {
            ...relation,
            identifier: `edge-${index}`,
        } ) );

        expect ( decodeChartRoutingWorkerRequest ( protocolRequest ( {
            ...request,
            relations: [ boundedRelation ],
        } ) ) ).not.toBeNull ();
        expect ( decodeChartRoutingWorkerRequest ( protocolRequest ( {
            ...request,
            relations: boundedRelations,
        } ) ) ).not.toBeNull ();

        // Process each one over relation from the current value collection in order.

        for ( const oneOverRelation of [
            {
                ...boundedRelation,
                obstacles: [ ...boundedRelation.obstacles, obstacle ],
            },
            {
                ...boundedRelation,
                labelObstacles: [ ...boundedRelation.labelObstacles, obstacle ],
            },
            {
                ...boundedRelation,
                preferredPoints: [ ...boundedRelation.preferredPoints, { x: 17, y: 17 } ],
            },
        ] )
        {
            expect ( decodeChartRoutingWorkerRequest ( protocolRequest ( {
                ...request,
                relations: [ oneOverRelation ],
            } ) ) ).toBeNull ();
        }

        expect ( decodeChartRoutingWorkerRequest ( protocolRequest ( {
            ...request,
            relations: [ ...boundedRelations, relation ],
        } ) ) ).toBeNull ();
        expect ( decodeChartRoutingWorkerRequest ( {
            generation: 1,
            kind: "cancel",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
        } ) ).toEqual ( {
            generation: 1,
            kind: "cancel",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
        } );
        expect ( decodeChartRoutingWorkerRequest ( {
            generation: 0,
            kind: "cancel",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
        } ) ).toBeNull ();
        expect ( decodeChartRoutingWorkerRequest ( {
            generation: 1,
            kind: "cancel",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
            request,
        } ) ).toBeNull ();
    } );

    it ( "accepts exact result caps and rejects any result cap plus one", () =>
    {
        // Initialize the local values needed by this operation.

        const request       = createRequest ( "result-limits" );
        const baseMessage   = simpleResultMessage ( request );
        const baseRelation  = baseMessage.result.relations [ 0 ]!;
        const boundedPoints = Array.from ( { length: MAXIMUM_CHART_ROUTING_RESULT_POINT_COUNT },
            ( _, index ) => ( { x: index, y: index } ) );
        const boundedCurves = Array.from ( { length: MAXIMUM_CHART_ROUTING_RESULT_CURVE_COUNT }, () =>
            baseRelation.curves [ 0 ]! );
        const boundedRelations = Array.from ( { length: MAXIMUM_CHART_ROUTING_RELATION_COUNT }, ( _, index ) => ( {
            ...baseRelation,
            identifier: `edge-${index}`,
        } ) );
        const boundedPointsMessage = {
            ...baseMessage,
            result: { ...baseMessage.result, relations: [ { ...baseRelation, points: boundedPoints } ] },
        };
        const boundedCurvesMessage = {
            ...baseMessage,
            result: { ...baseMessage.result, relations: [ { ...baseRelation, curves: boundedCurves } ] },
        };
        const boundedRelationsMessage = {
            ...baseMessage,
            result: { ...baseMessage.result, relations: boundedRelations },
        };
        const decoded = decodeChartRoutingWorkerResult ( boundedPointsMessage );

        expect ( decoded ).not.toBeNull ();
        expect ( Object.isFrozen ( decoded?.result ) ).toBe ( true );
        expect ( Object.isFrozen ( decoded?.result.relations [ 0 ]?.points ) ).toBe ( true );
        expect ( decodeChartRoutingWorkerResult ( boundedCurvesMessage ) ).not.toBeNull ();
        expect ( decodeChartRoutingWorkerResult ( boundedRelationsMessage ) ).not.toBeNull ();
        expect ( decodeChartRoutingWorkerResult ( {
            ...boundedPointsMessage,
            result:
            {
                ...boundedPointsMessage.result,
                relations: [ { ...baseRelation, points: [ ...boundedPoints, { x: 4_096, y: 4_096 } ] } ],
            },
        } ) ).toBeNull ();
        expect ( decodeChartRoutingWorkerResult ( {
            ...boundedCurvesMessage,
            result:
            {
                ...boundedCurvesMessage.result,
                relations: [ { ...baseRelation, curves: [ ...boundedCurves, baseRelation.curves [ 0 ]! ] } ],
            },
        } ) ).toBeNull ();
        expect ( decodeChartRoutingWorkerResult ( {
            ...boundedRelationsMessage,
            result: { ...boundedRelationsMessage.result, relations: [ ...boundedRelations, baseRelation ] },
        } ) ).toBeNull ();
    } );

    it ( "rejects extra, prototype, accessor, cyclic, sparse, overlong, and non-finite request values", () =>
    {
        // Initialize the local values needed by this operation.

        const request           = createRequest ( "malformed" );
        const extraEnvelope     = { ...protocolRequest ( request ), unexpected: true };
        const prototypeEnvelope = structuredClone ( protocolRequest ( request ) );
        const accessorEnvelope  = structuredClone ( protocolRequest ( request ) );
        const forbiddenEnvelope = structuredClone ( protocolRequest ( request ) );
        const cyclicEnvelope    = structuredClone ( protocolRequest ( request ) );
        const sparseEnvelope    = structuredClone ( protocolRequest ( request ) );
        const overlongEnvelope  = structuredClone ( protocolRequest ( request ) );
        const nonFiniteEnvelope = structuredClone ( protocolRequest ( request ) );

        Object.setPrototypeOf ( prototypeEnvelope.request.relations [ 0 ] ?? {}, { injected: true } );
        Object.defineProperty ( accessorEnvelope.request, "requestId", { enumerable: true, get: () => "malformed" } );
        Object.defineProperty ( forbiddenEnvelope.request, "__proto__", { enumerable: true, value: {} } );

        const cyclicObstacles = cyclicEnvelope.request.relations [ 0 ]?.obstacles as unknown[] | undefined;

        cyclicObstacles?.push ( cyclicObstacles );

        const sparsePoints: { x: number; y: number }[] = [];

        sparsePoints.length = 2;

        // Handle the case where selected collection value differs from undefined.

        if ( sparseEnvelope.request.relations [ 0 ] !== undefined )
        {
            Object.defineProperty ( sparseEnvelope.request.relations [ 0 ], "preferredPoints", {
                configurable: true,
                enumerable: true,
                value: sparsePoints,
            } );
        }

        // Handle the case where selected collection value differs from undefined.

        if ( overlongEnvelope.request.relations [ 0 ] !== undefined )
        {
            Object.defineProperty ( overlongEnvelope.request.relations [ 0 ], "identifier", {
                configurable: true,
                enumerable: true,
                value: "x".repeat ( MAXIMUM_CHART_ROUTING_TEXT_CODE_POINT_COUNT + 1 ),
            } );
        }

        // Handle the case where selected collection value differs from undefined.

        if ( nonFiniteEnvelope.request.relations [ 0 ]?.preferredPoints [ 0 ] !== undefined )
        {
            Object.defineProperty ( nonFiniteEnvelope.request.relations [ 0 ].preferredPoints [ 0 ], "x", {
                configurable: true,
                enumerable: true,
                value: Number.POSITIVE_INFINITY,
            } );
        }

        // Process each malformed from the current value collection in order.

        for ( const malformed of [
            extraEnvelope,
            prototypeEnvelope,
            accessorEnvelope,
            forbiddenEnvelope,
            cyclicEnvelope,
            sparseEnvelope,
            overlongEnvelope,
            nonFiniteEnvelope,
        ] )
        {
            expect ( decodeChartRoutingWorkerRequest ( malformed ) ).toBeNull ();
        }
    } );

    it ( "reconstructs a result without retaining hostile source objects and rejects malformed result members", () =>
    {
        // Initialize the local values needed by this operation.

        const request = createRequest ( "result-shape" );
        const message = simpleResultMessage ( request );
        const decoded = decodeChartRoutingWorkerResult ( message );

        expect ( decoded?.result ).not.toBe ( message.result );
        expect ( decoded?.result.relations [ 0 ] ).not.toBe ( message.result.relations [ 0 ] );

        // Initialize the local values needed by this operation.

        const extraResult    = structuredClone ( message );
        const accessorResult = structuredClone ( message );
        const cyclicResult   = structuredClone ( message );
        const sparseResult   = structuredClone ( message );

        Object.assign ( extraResult.result.relations [ 0 ] ?? {}, { unexpected: true } );
        Object.defineProperty ( accessorResult.result.relations [ 0 ] ?? {}, "identifier", {
            enumerable: true,
            get: () => "edge",
        } );

        const cyclicPoints = cyclicResult.result.relations [ 0 ]?.points as unknown[] | undefined;

        cyclicPoints?.push ( cyclicPoints );

        const sparseRelations = sparseResult.result.relations;

        sparseRelations.length += 1;

        // Process each malformed from the current value collection in order.

        for ( const malformed of [ extraResult, accessorResult, cyclicResult, sparseResult ] )
        {
            expect ( decodeChartRoutingWorkerResult ( malformed ) ).toBeNull ();
        }
    } );
} );

describe ( "cooperative Chart routing core", () =>
{
    it ( "yields at pass, relation, and clearance boundaries without changing its complete result", async () =>
    {
        // Initialize the local values needed by this operation.

        const request                              = createRequest ( "cooperative-equivalence" );
        const searchedRequest: ChartRoutingRequest = {
            ...request,
            relations:
            [
                {
                    ...request.relations [ 0 ]!,
                    labelObstacles:
                    [
                        { x: 180, y: -120, width: 60, height: 180 },
                        { x: 360, y: -20, width: 60, height: 180 },
                        { x: 540, y: -120, width: 60, height: 180 },
                    ],
                    obstacles:
                    [
                        { x: 180, y: -120, width: 60, height: 180 },
                        { x: 360, y: -20, width: 60, height: 180 },
                        { x: 540, y: -120, width: 60, height: 180 },
                    ],
                    preferredPoints: [ { x: 0, y: 0 }, { x: 800, y: 0 } ],
                },
            ],
        };
        const checkpoints: string[] = [];
        const result                = await routeChartRelationsCooperatively (
            searchedRequest,
            new ChartRoutingReuseCache (),
            {
                isCancelled: () => false,
                yieldControl: checkpoint =>
                {
                    checkpoints.push ( checkpoint );

                    // Return the resolve result.

                    return Promise.resolve ();
                },
            },
        );

        expect ( result ).toEqual ( routeChartRelations ( searchedRequest ) );
        expect ( checkpoints ).toContain ( "pass" );
        expect ( checkpoints ).toContain ( "relation" );
        expect ( checkpoints ).toContain ( "clearance-retry" );
    } );

    it ( "returns no partial result when cancellation is observed at a clearance retry", async () =>
    {
        // Initialize the local values needed by this operation.

        const request                              = createRequest ( "cooperative-cancellation" );
        const searchedRequest: ChartRoutingRequest = {
            ...request,
            relations:
            [
                {
                    ...request.relations [ 0 ]!,
                    obstacles: [ { x: 40, y: -20, width: 20, height: 40 } ],
                    preferredPoints: [ { x: 0, y: 0 }, { x: 100, y: 0 } ],
                },
            ],
        };
        let cancelled = false;
        const result  = await routeChartRelationsCooperatively (
            searchedRequest,
            new ChartRoutingReuseCache (),
            {
                isCancelled: () => cancelled,
                yieldControl: checkpoint =>
                {
                    cancelled ||= checkpoint === "clearance-retry";

                    // Return the resolve result.

                    return Promise.resolve ();
                },
            },
        );

        expect ( cancelled ).toBe ( true );
        expect ( result ).toBeNull ();
    } );
} );

describe ( "browser Chart routing port", () =>
{
    it ( "returns a stable unavailable failure when worker construction fails and permits retry", async () =>
    {
        // Initialize the local values needed by this operation.

        const worker                 = new FakeChartRoutingWorker ();
        let constructionAttemptCount = 0;
        const port                   = new BrowserChartRoutingPort ( () =>
        {
            constructionAttemptCount++;

            // Handle the case where construction attempt count matches 1.

            if ( constructionAttemptCount === 1 )
            {
                throw new Error ( "Worker construction blocked." );
            }

            // Return the worker.

            return worker;
        } );

        await expect ( port.route ( createRequest ( "unavailable" ) ) ).rejects.toThrow (
            "The Chart routing worker is unavailable.",
        );

        // Initialize the local values needed by this operation.

        const retryRequest = createRequest ( "retry" );
        const retryPromise = port.route ( retryRequest );

        emitWorkerResult ( worker, retryRequest );

        await expect ( retryPromise ).resolves.toMatchObject ( { requestId: "retry" } );
        expect ( constructionAttemptCount ).toBe ( 2 );
    } );

    it ( "settles a posting failure, terminates its worker, and leaves the adapter retryable", async () =>
    {
        // Initialize the local values needed by this operation.

        const unavailableWorker                 = new ThrowingPostChartRoutingWorker ();
        const retryWorker                       = new FakeChartRoutingWorker ();
        const workers: ChartRoutingWorkerLike[] = [ unavailableWorker, retryWorker ];
        const port                              = new BrowserChartRoutingPort ( () => workers.shift () ?? retryWorker );

        await expect ( port.route ( createRequest ( "blocked" ) ) ).rejects.toThrow (
            "The Chart routing worker is unavailable.",
        );
        expect ( unavailableWorker.terminated ).toBe ( true );

        // Initialize the local values needed by this operation.

        const retryRequest = createRequest ( "retry" );
        const retryPromise = port.route ( retryRequest );

        emitWorkerResult ( retryWorker, retryRequest );
        await expect ( retryPromise ).resolves.toMatchObject ( { requestId: "retry" } );
    } );

    it ( "rejects an invalid active result immediately and succeeds through a fresh retry", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: FakeChartRoutingWorker[] = [];
        const port                              = new BrowserChartRoutingPort ( () =>
        {
            // Initialize the local values needed by this operation.

            const worker = new FakeChartRoutingWorker ();

            workers.push ( worker );

            // Return the worker.

            return worker;
        } );
        const invalidRequest      = createRequest ( "invalid" );
        const invalidPromise      = port.route ( invalidRequest );
        const invalidRouteRequest = workers [ 0 ]?.postedRequests.find ( message => message.kind === "route" );
        const invalidResult       = simpleResultMessage ( invalidRequest, invalidRouteRequest?.generation ?? 1 );

        Object.assign ( invalidResult.result.relations [ 0 ] ?? {}, { identifier: "unexpected-edge" } );
        workers [ 0 ]?.emit ( invalidResult );

        await expect ( invalidPromise ).rejects.toThrow ( "The Chart routing worker returned an invalid result." );
        expect ( workers [ 0 ]?.terminated ).toBe ( true );

        // Initialize the local values needed by this operation.

        const retryRequest = createRequest ( "retry" );
        const retryPromise = port.route ( retryRequest );

        emitWorkerResult ( workers [ 1 ]!, retryRequest );
        await expect ( retryPromise ).resolves.toMatchObject ( { requestId: "retry" } );
    } );

    it ( "terminates a worker after malformed output and succeeds through a fresh retry", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: FakeChartRoutingWorker[] = [];
        const port                              = new BrowserChartRoutingPort ( () =>
        {
            // Initialize the local values needed by this operation.

            const worker = new FakeChartRoutingWorker ();

            workers.push ( worker );

            // Return the worker.

            return worker;
        } );
        const malformedPromise = port.route ( createRequest ( "malformed-output" ) );

        workers [ 0 ]?.emit ( { kind: "unexpected" } );
        await expect ( malformedPromise ).rejects.toThrow ( "The Chart routing worker returned an invalid result." );
        expect ( workers [ 0 ]?.terminated ).toBe ( true );

        // Initialize the local values needed by this operation.

        const retryRequest = createRequest ( "retry-after-malformed" );
        const retryPromise = port.route ( retryRequest );

        emitWorkerResult ( workers [ 1 ]!, retryRequest );
        await expect ( retryPromise ).resolves.toMatchObject ( { requestId: "retry-after-malformed" } );
    } );

    it ( "preflights an oversized request without constructing a worker", async () =>
    {
        // Initialize the local values needed by this operation.

        let constructionAttemptCount = 0;
        const port                   = new BrowserChartRoutingPort ( () =>
        {
            constructionAttemptCount++;

            // Return the computed result.

            return new FakeChartRoutingWorker ();
        } );
        const request  = createRequest ( "oversized" );
        const relation = request.relations [ 0 ]!;

        await expect ( port.route ( {
            ...request,
            relations: Array.from ( { length: MAXIMUM_CHART_ROUTING_RELATION_COUNT + 1 }, ( _, index ) => ( {
                ...relation,
                identifier: `edge-${index}`,
            } ) ),
        } ) ).rejects.toThrow ( "The Chart routing request exceeds the bounded Chart routing worker protocol." );
        expect ( constructionAttemptCount ).toBe ( 0 );
    } );

    it ( "terminates a timed-out worker and succeeds through a fresh retry", async () =>
    {
        vi.useFakeTimers ();

        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const workers: FakeChartRoutingWorker[] = [];
            const port                              = new BrowserChartRoutingPort ( () =>
            {
                // Initialize the local values needed by this operation.

                const worker = new FakeChartRoutingWorker ();

                workers.push ( worker );

                // Return the worker.

                return worker;
            } );
            const timeoutPromise     = port.route ( createRequest ( "timeout" ) );
            const timeoutExpectation = expect ( timeoutPromise ).rejects.toThrow (
                "Chart routing exceeded its three-second bound.",
            );

            await vi.advanceTimersByTimeAsync ( 3_000 );
            await timeoutExpectation;
            expect ( workers [ 0 ]?.terminated ).toBe ( true );

            // Initialize the local values needed by this operation.

            const retryRequest = createRequest ( "retry" );
            const retryPromise = port.route ( retryRequest );

            emitWorkerResult ( workers [ 1 ]!, retryRequest );
            await expect ( retryPromise ).resolves.toMatchObject ( { requestId: "retry" } );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            vi.useRealTimers ();
        }
    } );

    it ( "returns correlated results while retaining one healthy worker", async () =>
    {
        // Initialize the local values needed by this operation.

        const worker          = new FakeChartRoutingWorker ();
        let constructionCount = 0;
        const port            = new BrowserChartRoutingPort ( () =>
        {
            constructionCount += 1;

            // Return the worker.

            return worker;
        } );
        const request = createRequest ( "one" );
        const promise = port.route ( request );

        emitWorkerResult ( worker, request );

        const result = await promise;

        expect ( result ).toMatchObject ( { requestId: "one" } );
        expect ( Object.isFrozen ( result ) ).toBe ( true );
        expect ( Object.isFrozen ( result.relations ) ).toBe ( true );
        expect ( worker.terminated ).toBe ( false );

        // Initialize the local values needed by this operation.

        const secondRequest = createRequest ( "two" );
        const secondPromise = port.route ( secondRequest );

        emitWorkerResult ( worker, secondRequest );
        await expect ( secondPromise ).resolves.toMatchObject ( { requestId: "two" } );
        expect ( constructionCount ).toBe ( 1 );
        expect ( worker.terminated ).toBe ( false );
    } );

    it ( "cooperatively replaces a request on the same worker and ignores its stale result", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: FakeChartRoutingWorker[] = [];
        const port                              = new BrowserChartRoutingPort ( () =>
        {
            // Initialize the local values needed by this operation.

            const worker = new FakeChartRoutingWorker ();

            workers.push ( worker );

            // Return the worker.

            return worker;
        } );
        const firstRequest     = createRequest ( "first" );
        const firstPromise     = port.route ( firstRequest );
        const firstExpectation = expect ( firstPromise ).rejects.toThrow ( "replaced" );
        const secondRequest    = createRequest ( "second" );
        const secondPromise    = port.route ( secondRequest );
        const worker           = workers [ 0 ]!;
        const firstRoute       = worker.postedRequests.find ( message =>
            message.kind === "route" && message.request.requestId === firstRequest.requestId );

        emitWorkerResult ( worker, firstRequest );
        emitWorkerCancellation ( worker, firstRoute?.generation ?? 1 );
        emitWorkerResult ( worker, secondRequest );

        await firstExpectation;
        await expect ( secondPromise ).resolves.toMatchObject ( { requestId: "second" } );
        expect ( workers ).toHaveLength ( 1 );
        expect ( worker.terminated ).toBe ( false );
        expect ( worker.postedRequests.map ( message => message.kind ) ).toEqual ( [ "route", "cancel", "route" ] );
    } );

    it ( "silently ignores a correlated-generation result with stale revisions", async () =>
    {
        // Initialize the local values needed by this operation.

        const worker       = new FakeChartRoutingWorker ();
        const port         = new BrowserChartRoutingPort ( () => worker );
        const request      = createRequest ( "current" );
        const promise      = port.route ( request );
        const routeRequest = worker.postedRequests.find ( message => message.kind === "route" );

        worker.emit ( workerResult ( {
            ...request,
            geometryRevision: request.geometryRevision + 1,
        }, routeRequest?.generation ?? 1 ) );
        emitWorkerResult ( worker, request );

        await expect ( promise ).resolves.toMatchObject ( { requestId: "current" } );
        expect ( worker.terminated ).toBe ( false );
    } );

    it ( "recreates an uncooperative worker and resubmits the current replacement", async () =>
    {
        vi.useFakeTimers ();

        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const workers: FakeChartRoutingWorker[] = [];
            const port                              = new BrowserChartRoutingPort ( () =>
            {
                // Initialize the local values needed by this operation.

                const worker = new FakeChartRoutingWorker ();

                workers.push ( worker );

                // Return the worker.

                return worker;
            } );
            const firstPromise       = port.route ( createRequest ( "uncooperative" ) );
            const firstExpectation   = expect ( firstPromise ).rejects.toThrow ( "replaced" );
            const replacementRequest = createRequest ( "replacement" );
            const replacementPromise = port.route ( replacementRequest );

            await vi.advanceTimersByTimeAsync ( CHART_ROUTING_CANCELLATION_TIMEOUT_MILLISECONDS );
            await firstExpectation;

            expect ( workers ).toHaveLength ( 2 );
            expect ( workers [ 0 ]?.terminated ).toBe ( true );
            expect ( workers [ 1 ]?.postedRequests ).toHaveLength ( 1 );

            emitWorkerResult ( workers [ 1 ]!, replacementRequest );
            await expect ( replacementPromise ).resolves.toMatchObject ( { requestId: "replacement" } );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            vi.useRealTimers ();
        }
    } );

    it ( "falls back to a stable diagnostic when the browser supplies no worker error message", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: FakeChartRoutingWorker[] = [];
        const port                              = new BrowserChartRoutingPort ( () =>
        {
            // Initialize the local values needed by this operation.

            const worker = new FakeChartRoutingWorker ();

            workers.push ( worker );

            // Return the worker.

            return worker;
        } );
        const silentPromise = port.route ( createRequest ( "silent" ) );

        workers [ 0 ]?.failWithoutMessage ();
        await expect ( silentPromise ).rejects.toThrow ( "The Chart routing worker crashed." );
    } );

    it ( "acknowledges cancellation, discards a crashed worker, and retries fresh", async () =>
    {
        // Initialize the local values needed by this operation.

        const workers: FakeChartRoutingWorker[] = [];
        const port                              = new BrowserChartRoutingPort ( () =>
        {
            // Initialize the local values needed by this operation.

            const worker = new FakeChartRoutingWorker ();

            workers.push ( worker );

            // Return the worker.

            return worker;
        } );
        const cancelledPromise     = port.route ( createRequest ( "cancelled" ) );
        const cancelledExpectation = expect ( cancelledPromise ).rejects.toThrow ( "cancelled" );
        const cancelledRoute       = workers [ 0 ]?.postedRequests.find ( message => message.kind === "route" );

        await port.cancel ();
        emitWorkerCancellation ( workers [ 0 ]!, cancelledRoute?.generation ?? 1 );
        await cancelledExpectation;

        const crashedPromise = port.route ( createRequest ( "crashed" ) );

        workers [ 0 ]?.fail ( "Routing crashed for test." );
        await expect ( crashedPromise ).rejects.toThrow ( "Routing crashed for test." );

        // Initialize the local values needed by this operation.

        const retryRequest = createRequest ( "retry" );
        const retryPromise = port.route ( retryRequest );

        emitWorkerResult ( workers [ 1 ]!, retryRequest );
        await expect ( retryPromise ).resolves.toMatchObject ( { requestId: "retry" } );
        expect ( workers ).toHaveLength ( 2 );
        expect ( workers [ 0 ]?.terminated ).toBe ( true );
    } );
} );

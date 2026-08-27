// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Layout Infrastructure Tests
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the disposable bounded browser-worker adapter. Layered ELK behavior is covered in
//   browser tests because the production bundle owns a browser worker lifecycle that is
//   intentionally not emulated in the Node test pool.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { COMPILE_TIME_CONFIGURATION } from "../../src/configuration/compile-time-configuration.js";
import
{
    BrowserChartLayoutPort,
    CHART_LAYOUT_TIMEOUT_MILLISECONDS,
} from "../../src/infrastructure/chart/browser-chart-layout-port.js";
import type { ChartLayoutEngine } from "../../src/infrastructure/chart/elk-chart-layout.js";

const NODES = [ { state: "state_a", width: 260, height: 70, isInitial: true } ] as const;

//--------------------------------------------------------------------------------------------------
// Function: positionedLayoutEngine
//
// Description:
//
//   Derives the positioned layout engine.
//
// Parameters:
//
//   - onTerminate:
//     The on terminate supplied to the operation.
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

function positionedLayoutEngine ( onTerminate: () => void ): ChartLayoutEngine
{
    // Return the assembled result.

    return {
        layout: async graph => graph.children === undefined
            ? graph
            : {
                ...graph,
                children: graph.children.map ( child => ( { ...child, x: 40, y: 60 } ) ),
            },
        terminateWorker: onTerminate,
    };
}

describe ( "Chart layout infrastructure", () =>
{
    it ( "returns worker-backed positions and terminates the disposable layout engine", async () =>
    {
        // Initialize the local values needed by this operation.

        let terminated                        = false;
        const received                        = { graph: null as Parameters<ChartLayoutEngine["layout"]> [ 0 ] | null };
        const layoutEngine: ChartLayoutEngine = 
        {
            layout: async graph =>
            {
                received.graph = graph;

                // Return the result selected by the current condition.

                return graph.children === undefined
                    ? graph
                    : {
                        ...graph,
                        children: graph.children.map ( child => ( { ...child, x: 40, y: 60 } ) ),
                    };
            },
            terminateWorker: () =>
            {
                terminated = true;
            },
        };
        const port   = new BrowserChartLayoutPort ( () => layoutEngine );
        const result = await port.layout (
            NODES,
            [ {
                sourceState: "state_a",
                destinationState: "state_a",
                labelHeight: 22,
                labelWidth: 80,
            } ],
            { gridSize: 20, minimumStateDistance: 100 },
        );

        expect ( result.states ).toEqual ( [ { state: "state_a", x: 40, y: 60 } ] );
        expect ( Object.isFrozen ( result ) ).toBe ( true );
        expect ( Object.isFrozen ( result.states [ 0 ] ) ).toBe ( true );
        expect ( terminated ).toBe ( true );
        expect ( received.graph ).not.toBeNull ();

        // Handle the case where received graph differs from an absent value.

        if ( received.graph !== null )
        {
            expect ( received.graph.layoutOptions?.[ "elk.layered.crossingMinimization.greedySwitch.type" ] )
                .toBe ( "TWO_SIDED" );
            expect ( received.graph.layoutOptions?.[ "elk.layered.crossingMinimization.strategy" ] )
                .toBe ( "LAYER_SWEEP" );
            expect ( received.graph.layoutOptions?.[ "elk.layered.layering.strategy" ] ).toBe ( "NETWORK_SIMPLEX" );
            expect ( received.graph.layoutOptions?.[ "elk.layered.nodePlacement.favorStraightEdges" ] ).toBe ( "true" );
            expect ( received.graph.layoutOptions?.[ "elk.layered.nodePlacement.strategy" ] )
                .toBe ( "NETWORK_SIMPLEX" );
            expect ( received.graph.layoutOptions?.[ "elk.spacing.nodeNode" ] ).toBe (
                String ( COMPILE_TIME_CONFIGURATION.chart.automaticLayout.elkWithinLayerSeedSpacing ),
            );
            expect ( received.graph.children?.[ 0 ]?.layoutOptions?.[
                "elk.layered.layering.layerConstraint"
            ] ).toBe ( "FIRST_SEPARATE" );
            expect ( received.graph.edges?.[ 0 ]?.labels?.[ 0 ] ).toMatchObject ( { height: 22, width: 80 } );
        }
    } );

    it ( "seeds ELK with the locked layer spacings rather than with the user setting", async () =>
    {
        // Initialize the local values needed by this operation.

        const received                        = { graph: null as Parameters<ChartLayoutEngine["layout"]> [ 0 ] | null };
        const layoutEngine: ChartLayoutEngine = 
        {
            layout: async graph =>
            {
                received.graph = graph;

                // Return the result selected by the current condition.

                return graph.children === undefined
                    ? graph
                    : { ...graph, children: graph.children.map ( child => ( { ...child, x: 0, y: 0 } ) ) };
            },
            terminateWorker: () => undefined,
        };
        const port = new BrowserChartLayoutPort ( () => layoutEngine );

        await port.layout ( NODES, [], { gridSize: 20, minimumStateDistance: 900 } );

        expect ( received.graph ).not.toBeNull ();

        // Handle the case where received graph differs from an absent value.

        if ( received.graph !== null )
        {
            // Minimum State Distance is enforced by scaling the returned centres, never by widening
            // the seed. A seed that tracked the setting would only widen the chart without
            // improving the guarantee.

            expect ( received.graph.layoutOptions?.[ "elk.spacing.nodeNode" ] ).toBe (
                String ( COMPILE_TIME_CONFIGURATION.chart.automaticLayout.elkWithinLayerSeedSpacing ),
            );
            expect ( received.graph.layoutOptions?.[ "elk.layered.spacing.nodeNodeBetweenLayers" ] ).toBe (
                String ( COMPILE_TIME_CONFIGURATION.chart.automaticLayout.elkBetweenLayerSeedSpacing ),
            );
        }
    } );

    it ( "raises the effective minimum above the setting when state geometry would allow an overlap", async () =>
    {
        // Initialize the local values needed by this operation.

        const tallNodes = [
            { state: "state_a", width: 400, height: 300, isInitial: true },
            { state: "state_b", width: 400, height: 300 },
        ] as const;
        const port   = new BrowserChartLayoutPort ( () => positionedLayoutEngine ( () => undefined ) );
        const result = await port.layout ( tallNodes, [], { gridSize: 20, minimumStateDistance: 100 } );

        // Two 400-by-300 states overlap unless their centres clear hypot ( 400, 300 ) = 500 pixels.

        expect ( result.effectiveMinimumStateDistance ).toBeCloseTo ( 500, 6 );
    } );

    it ( "separates every state pair by at least the effective minimum distance", async () =>
    {
        await fc.assert ( fc.asyncProperty (
            fc.array (
                fc.record ( {
                    x: fc.integer ( { max: 4_000, min: -4_000 } ),
                    y: fc.integer ( { max: 4_000, min: -4_000 } ),
                } ),
                { maxLength: 12, minLength: 2 },
            ),
            fc.integer ( { max: 2_000, min: 100 } ),
            async ( placements, minimumStateDistance ) =>
            {
                // Initialize the local values needed by this operation.

                const nodes = placements.map ( ( _, index ) => ( {
                    state:  `state_${index}`,
                    width:  120,
                    height: 40,
                    ...( index === 0 ? { isInitial: true } : {} ),
                } ) );
                const layoutEngine: ChartLayoutEngine =
                {
                    layout: async graph => graph.children === undefined
                        ? graph
                        : {
                            ...graph,
                            children: graph.children.map ( ( child, index ) => ( {
                                ...child,
                                x: placements [ index ]?.x ?? 0,
                                y: placements [ index ]?.y ?? 0,
                            } ) ),
                        },
                    terminateWorker: () => undefined,
                };
                const port    = new BrowserChartLayoutPort ( () => layoutEngine );
                const result  = await port.layout ( nodes, [], { gridSize: 20, minimumStateDistance } );
                const centres = result.states.map ( ( state, index ) => ( {
                    x: state.x + ( nodes [ index ]?.width ?? 0 ) / 2,
                    y: state.y + ( nodes [ index ]?.height ?? 0 ) / 2,
                } ) );

                // Repeat the operation across the bounded iteration range.

                for ( let left = 0; left < centres.length; left++ )
                {
                    // Repeat the operation across the bounded iteration range.

                    for ( let right = left + 1; right < centres.length; right++ )
                    {
                        // Initialize the local values needed by this operation.

                        const first  = centres [ left ];
                        const second = centres [ right ];

                        // Handle the case where at least one branch condition is satisfied.

                        if ( first === undefined || second === undefined )
                        {
                            continue;
                        }

                        // Calculate the separation value from the current inputs.

                        const separation = Math.hypot ( first.x - second.x, first.y - second.y );

                        // Distinct ELK placements can coincide only if the engine returned the same
                        // point twice, which the scale cannot separate; every genuinely distinct
                        // pair must clear the minimum.

                        if ( separation > 0 )
                        {
                            expect ( separation ).toBeGreaterThanOrEqual (
                                result.effectiveMinimumStateDistance - 1e-6,
                            );
                        }
                    }
                }
            },
        ), { numRuns: 60 } );
    } );

    it ( "rejects missing and non-finite worker coordinates as invalid immutable-boundary results", async () =>
    {
        // Process each coordinates from the current value collection in order.

        for ( const coordinates of [ { x: 40 }, { x: Number.NaN, y: 60 }, { x: 40, y: Number.POSITIVE_INFINITY } ] )
        {
            // Initialize the local values needed by this operation.

            let terminated                        = false;
            const layoutEngine: ChartLayoutEngine = {
                layout: async graph => graph.children === undefined
                    ? graph
                    : {
                        ...graph,
                        children: graph.children.map ( child => ( { ...child, ...coordinates } ) ),
                    },
                terminateWorker: () =>
                {
                    terminated = true;
                },
            };
            const port = new BrowserChartLayoutPort ( () => layoutEngine );

            await expect ( port.layout ( NODES, [] ) ).rejects.toThrow (
                "The Chart layout worker returned an invalid result.",
            );
            expect ( terminated ).toBe ( true );
        }
    } );

    it ( "returns a stable unavailable failure when ELK construction fails and permits retry", async () =>
    {
        // Initialize the local values needed by this operation.

        let constructionAttemptCount = 0;
        let retryTerminated          = false;
        const port                   = new BrowserChartLayoutPort ( () =>
        {
            constructionAttemptCount++;

            // Handle the case where construction attempt count matches 1.

            if ( constructionAttemptCount === 1 )
            {
                throw new Error ( "ELK worker construction blocked." );
            }

            // Return the positioned layout engine result.

            return positionedLayoutEngine ( () =>
            {
                retryTerminated = true;
            } );
        } );

        await expect ( port.layout ( NODES, [] ) ).rejects.toThrow ( "The Chart layout worker is unavailable." );
        await expect ( port.layout ( NODES, [] ) ).resolves.toMatchObject ( {
            states: [ { state: "state_a", x: 40, y: 60 } ],
        } );
        expect ( constructionAttemptCount ).toBe ( 2 );
        expect ( retryTerminated ).toBe ( true );
    } );

    it ( "terminates a crashed ELK engine and succeeds through a fresh retry", async () =>
    {
        // Initialize the local values needed by this operation.

        let crashedEngineTerminated        = false;
        let retryEngineTerminated          = false;
        const engines: ChartLayoutEngine[] = [
            {
                layout: () => Promise.reject ( new Error ( "ELK crashed for test." ) ),
                terminateWorker: () =>
                {
                    crashedEngineTerminated = true;
                },
            },
            positionedLayoutEngine ( () =>
            {
                retryEngineTerminated = true;
            } ),
        ];
        const port = new BrowserChartLayoutPort ( () => engines.shift () ?? positionedLayoutEngine ( () => undefined ) );

        await expect ( port.layout ( NODES, [] ) ).rejects.toThrow ( "ELK crashed for test." );
        expect ( crashedEngineTerminated ).toBe ( true );
        await expect ( port.layout ( NODES, [] ) ).resolves.toMatchObject ( {
            states: [ { state: "state_a", x: 40, y: 60 } ],
        } );
        expect ( retryEngineTerminated ).toBe ( true );
    } );

    it ( "terminates a timed-out ELK engine and succeeds through a fresh retry", async () =>
    {
        vi.useFakeTimers ();

        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            let timedOutEngineTerminated       = false;
            let retryEngineTerminated          = false;
            const engines: ChartLayoutEngine[] = [
                {
                    layout: () => new Promise ( () => undefined ),
                    terminateWorker: () =>
                    {
                        timedOutEngineTerminated = true;
                    },
                },
                positionedLayoutEngine ( () =>
                {
                    retryEngineTerminated = true;
                } ),
            ];
            const port = new BrowserChartLayoutPort (
                () => engines.shift () ?? positionedLayoutEngine ( () => undefined ),
            );
            const timeoutPromise     = port.layout ( NODES, [] );
            const timeoutExpectation = expect ( timeoutPromise ).rejects.toThrow (
                "Chart layout exceeded its three-second bound.",
            );

            await vi.advanceTimersByTimeAsync ( CHART_LAYOUT_TIMEOUT_MILLISECONDS );
            await timeoutExpectation;
            expect ( timedOutEngineTerminated ).toBe ( true );

            await expect ( port.layout ( NODES, [] ) ).resolves.toMatchObject ( {
                states: [ { state: "state_a", x: 40, y: 60 } ],
            } );
            expect ( retryEngineTerminated ).toBe ( true );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            vi.useRealTimers ();
        }
    } );
} );

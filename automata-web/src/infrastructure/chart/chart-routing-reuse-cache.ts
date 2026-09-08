// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Reuse Cache
// Version: 1.0.0
// Date:    2026-08-22
// Author:  Rohin Gosling
//
// Description:
//
//   Owns bounded exact-signature least-recently-used caches for immutable visibility profiles and
//   cubic-clearance proof outcomes. Cache state changes execution work only and never enters
//   routing selection or persisted data.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ChartRoutingCubicCurve,
    ChartRoutingRectangle,
} from "../../application/ports/contracts.js";
import type { ChartRoutingPerformanceCounters } from
    "../../application/chart-routing-performance.js";
import type { ChartRoutingCurveProofMemoization } from
    "../../application/chart-routing-backbone.js";
import type { ChartRoutingVisibilityProfile } from
    "./chart-routing-visibility-graph.js";
import { CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED } from
    "../../configuration/compile-time-configuration.js";

const DEFAULT_GRAPH_PROFILE_CAPACITY = 64;
const DEFAULT_CURVE_PROOF_CAPACITY   = 32_768;

//--------------------------------------------------------------------------------------------------
// Class: BoundedLeastRecentlyUsedCache
//
// Description:
//
//   Implements the bounded least recently used cache behavior.
//
//--------------------------------------------------------------------------------------------------

class BoundedLeastRecentlyUsedCache<Value>
{
    private readonly values = new Map<string, Value> ();

    //----------------------------------------------------------------------------------------------
    // Constructor: BoundedLeastRecentlyUsedCache
    //
    // Description:
    //
    //   Initializes a BoundedLeastRecentlyUsedCache instance.
    //
    // Parameters:
    //
    //   - capacity:
    //     The capacity supplied to the operation.
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

    public constructor ( public readonly capacity: number )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( !Number.isInteger ( capacity ) || capacity <= 0 )
        {
            throw new Error ( "A Chart routing cache capacity must be a positive integer." );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: size
    //
    // Description:
    //
    //   Derives the size.
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
    //----------------------------------------------------------------------------------------------

    public get size (): number
    {
        // Return the computed result.

        return this.values.size;
    }

    //----------------------------------------------------------------------------------------------
    // Method: clear
    //
    // Description:
    //
    //   Clears the stored state.
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

    public clear (): void
    {
        this.values.clear ();
    }

    //----------------------------------------------------------------------------------------------
    // Method: get
    //
    // Description:
    //
    //   Returns the requested value.
    //
    // Parameters:
    //
    //   - key:
    //     The key supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public get ( key: string ): Value | undefined
    {
        // Initialize the local values needed by this operation.

        const value = this.values.get ( key );

        // Handle the case where value differs from undefined.

        if ( value !== undefined )
        {
            this.values.delete ( key );
            this.values.set ( key, value );
        }

        // Return the value.

        return value;
    }

    //----------------------------------------------------------------------------------------------
    // Method: set
    //
    // Description:
    //
    //   Derives the set.
    //
    // Parameters:
    //
    //   - key:
    //     The key supplied to the operation.
    //
    //   - value:
    //     The value supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public set ( key: string, value: Value ): boolean
    {
        this.values.delete ( key );
        this.values.set ( key, value );

        // Handle the case where size does not exceed capacity.

        if ( this.values.size <= this.capacity )
        {
            // Return the computed result.

            return false;
        }

        const oldestKey = this.values.keys ().next ().value;

        // Handle the case where current value matches the string value.

        if ( typeof oldestKey === "string" )
        {
            this.values.delete ( oldestKey );
        }

        // Return the computed result.

        return true;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: pointSignature
//
// Description:
//
//   Derives the point signature.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
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

function pointSignature ( point: { readonly x: number; readonly y: number } ): string
{
    // Return the computed result.

    return `${point.x},${point.y}`;
}

//--------------------------------------------------------------------------------------------------
// Function: rectangleSignature
//
// Description:
//
//   Derives the rectangle signature.
//
// Parameters:
//
//   - rectangle:
//     The rectangle supplied to the operation.
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

function rectangleSignature ( rectangle: ChartRoutingRectangle ): string
{
    // Return the computed result.

    return `${rectangle.x},${rectangle.y},${rectangle.width},${rectangle.height}`;
}

//--------------------------------------------------------------------------------------------------
// Function: curveProofSignature
//
// Description:
//
//   Derives the curve proof signature.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
//
//   - obstacle:
//     The obstacle supplied to the operation.
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

function curveProofSignature (
    curve: ChartRoutingCubicCurve,
    obstacle: ChartRoutingRectangle,
): string
{
    // Return the computed result.

    return `${pointSignature ( curve.source )};${pointSignature ( curve.sourceControl )};` +
        `${pointSignature ( curve.targetControl )};${pointSignature ( curve.target )}|` +
        rectangleSignature ( obstacle );
}

//--------------------------------------------------------------------------------------------------
// Function: curveSignature
//
// Description:
//
//   Derives the curve signature.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
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

function curveSignature ( curve: ChartRoutingCubicCurve ): string
{
    // Return the computed result.

    return `${pointSignature ( curve.source )};${pointSignature ( curve.sourceControl )};` +
        `${pointSignature ( curve.targetControl )};${pointSignature ( curve.target )}`;
}

//--------------------------------------------------------------------------------------------------
// Class: ChartRoutingReuseCache
//
// Description:
//
//   Implements the chart routing reuse cache behavior.
//
//--------------------------------------------------------------------------------------------------

export class ChartRoutingReuseCache implements ChartRoutingCurveProofMemoization
{
    private readonly curveProofs: BoundedLeastRecentlyUsedCache<boolean>;
    private readonly graphProfiles: BoundedLeastRecentlyUsedCache<ChartRoutingVisibilityProfile>;
    private readonly sampledCurveLengths: BoundedLeastRecentlyUsedCache<number>;

    //----------------------------------------------------------------------------------------------
    // Constructor: ChartRoutingReuseCache
    //
    // Description:
    //
    //   Initializes a ChartRoutingReuseCache instance.
    //
    // Parameters:
    //
    //   - graphProfileCapacity:
    //     The graph profile capacity supplied to the operation.
    //
    //   - curveProofCapacity:
    //     The curve proof capacity supplied to the operation.
    //
    //   - sampledCurveLengthCapacity:
    //     The sampled curve length capacity supplied to the operation.
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

    public constructor (
        graphProfileCapacity       = DEFAULT_GRAPH_PROFILE_CAPACITY,
        curveProofCapacity         = DEFAULT_CURVE_PROOF_CAPACITY,
        sampledCurveLengthCapacity = curveProofCapacity,
    )
    {
        this.curveProofs         = new BoundedLeastRecentlyUsedCache ( curveProofCapacity );
        this.graphProfiles       = new BoundedLeastRecentlyUsedCache ( graphProfileCapacity );
        this.sampledCurveLengths = new BoundedLeastRecentlyUsedCache ( sampledCurveLengthCapacity );
    }

    //----------------------------------------------------------------------------------------------
    // Method: curveProofCapacity
    //
    // Description:
    //
    //   Derives the curve proof capacity.
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
    //----------------------------------------------------------------------------------------------

    public get curveProofCapacity (): number
    {
        // Return the computed result.

        return this.curveProofs.capacity;
    }

    //----------------------------------------------------------------------------------------------
    // Method: curveProofCount
    //
    // Description:
    //
    //   Derives the curve proof count.
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
    //----------------------------------------------------------------------------------------------

    public get curveProofCount (): number
    {
        // Return the computed result.

        return this.curveProofs.size;
    }

    //----------------------------------------------------------------------------------------------
    // Method: graphProfileCapacity
    //
    // Description:
    //
    //   Derives the graph profile capacity.
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
    //----------------------------------------------------------------------------------------------

    public get graphProfileCapacity (): number
    {
        // Return the computed result.

        return this.graphProfiles.capacity;
    }

    //----------------------------------------------------------------------------------------------
    // Method: sampledCurveLengthCount
    //
    // Description:
    //
    //   Derives the sampled curve length count.
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
    //----------------------------------------------------------------------------------------------

    public get sampledCurveLengthCount (): number
    {
        // Return the computed result.

        return this.sampledCurveLengths.size;
    }

    //----------------------------------------------------------------------------------------------
    // Method: graphProfileCount
    //
    // Description:
    //
    //   Derives the graph profile count.
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
    //----------------------------------------------------------------------------------------------

    public get graphProfileCount (): number
    {
        // Return the computed result.

        return this.graphProfiles.size;
    }

    //----------------------------------------------------------------------------------------------
    // Method: clear
    //
    // Description:
    //
    //   Clears the stored state.
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

    public clear (): void
    {
        this.curveProofs.clear ();
        this.graphProfiles.clear ();
        this.sampledCurveLengths.clear ();
    }

    //----------------------------------------------------------------------------------------------
    // Method: getGraphProfile
    //
    // Description:
    //
    //   Returns graph profile.
    //
    // Parameters:
    //
    //   - signature:
    //     The signature supplied to the operation.
    //
    //   - performanceCounters:
    //     The performance counters supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public getGraphProfile (
        signature: string,
        performanceCounters?: ChartRoutingPerformanceCounters,
    ): ChartRoutingVisibilityProfile | undefined
    {
        // Initialize the local values needed by this operation.

        const profile = this.graphProfiles.get ( signature );

        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.graphCacheHitCount += profile === undefined ? 0 : 1;
            performanceCounters.graphCacheMissCount += profile === undefined ? 1 : 0;
        }

        // Return the profile.

        return profile;
    }

    //----------------------------------------------------------------------------------------------
    // Method: setGraphProfile
    //
    // Description:
    //
    //   Updates graph profile.
    //
    // Parameters:
    //
    //   - signature:
    //     The signature supplied to the operation.
    //
    //   - profile:
    //     The profile supplied to the operation.
    //
    //   - performanceCounters:
    //     The performance counters supplied to the operation.
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

    public setGraphProfile (
        signature: string,
        profile: ChartRoutingVisibilityProfile,
        performanceCounters?: ChartRoutingPerformanceCounters,
    ): void
    {
        // Initialize the local values needed by this operation.

        const wasEvicted = this.graphProfiles.set ( signature, profile );

        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && wasEvicted && performanceCounters !== undefined )
        {
            performanceCounters.graphCacheEvictionCount += 1;
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: get
    //
    // Description:
    //
    //   Returns the requested value.
    //
    // Parameters:
    //
    //   - curve:
    //     The curve supplied to the operation.
    //
    //   - obstacle:
    //     The obstacle supplied to the operation.
    //
    //   - performanceCounters:
    //     The performance counters supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public get (
        curve: ChartRoutingCubicCurve,
        obstacle: ChartRoutingRectangle,
        performanceCounters?: ChartRoutingPerformanceCounters,
    ): boolean | undefined
    {
        // Initialize the local values needed by this operation.

        const result = this.curveProofs.get ( curveProofSignature ( curve, obstacle ) );

        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.memoizationHitCount += result === undefined ? 0 : 1;
            performanceCounters.memoizationMissCount += result === undefined ? 1 : 0;
        }

        // Return the result.

        return result;
    }

    //----------------------------------------------------------------------------------------------
    // Method: set
    //
    // Description:
    //
    //   Handles the set behavior.
    //
    // Parameters:
    //
    //   - curve:
    //     The curve supplied to the operation.
    //
    //   - obstacle:
    //     The obstacle supplied to the operation.
    //
    //   - isClear:
    //     The is clear supplied to the operation.
    //
    //   - performanceCounters:
    //     The performance counters supplied to the operation.
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

    public set (
        curve: ChartRoutingCubicCurve,
        obstacle: ChartRoutingRectangle,
        isClear: boolean,
        performanceCounters?: ChartRoutingPerformanceCounters,
    ): void
    {
        // Initialize the local values needed by this operation.

        const wasEvicted = this.curveProofs.set ( curveProofSignature ( curve, obstacle ), isClear );

        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && wasEvicted && performanceCounters !== undefined )
        {
            performanceCounters.memoizationEvictionCount += 1;
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: getSampledLength
    //
    // Description:
    //
    //   Returns sampled length.
    //
    // Parameters:
    //
    //   - curve:
    //     The curve supplied to the operation.
    //
    //   - performanceCounters:
    //     The performance counters supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public getSampledLength (
        curve: ChartRoutingCubicCurve,
        performanceCounters?: ChartRoutingPerformanceCounters,
    ): number | undefined
    {
        // Initialize the local values needed by this operation.

        const length = this.sampledCurveLengths.get ( curveSignature ( curve ) );

        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.memoizationHitCount += length === undefined ? 0 : 1;
            performanceCounters.memoizationMissCount += length === undefined ? 1 : 0;
        }

        // Return the length.

        return length;
    }

    //----------------------------------------------------------------------------------------------
    // Method: setSampledLength
    //
    // Description:
    //
    //   Updates sampled length.
    //
    // Parameters:
    //
    //   - curve:
    //     The curve supplied to the operation.
    //
    //   - length:
    //     The length supplied to the operation.
    //
    //   - performanceCounters:
    //     The performance counters supplied to the operation.
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

    public setSampledLength (
        curve: ChartRoutingCubicCurve,
        length: number,
        performanceCounters?: ChartRoutingPerformanceCounters,
    ): void
    {
        // Initialize the local values needed by this operation.

        const wasEvicted = this.sampledCurveLengths.set ( curveSignature ( curve ), length );

        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && wasEvicted && performanceCounters !== undefined )
        {
            performanceCounters.memoizationEvictionCount += 1;
        }
    }
}

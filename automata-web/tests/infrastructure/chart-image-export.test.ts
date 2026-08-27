// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Image Export Tests
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies export naming, physical-unit conversion, DPI conversion, and the pre-allocation raster
//   bound.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import
{
    chartImageDimensionText,
    chartRasterDimensions,
    chartRasterDimensionsToFit,
    sanitizeChartSvgClone,
    sanitizeChartImageFileStem,
} from "../../src/infrastructure/chart/browser-chart-image-export.js";

describe ( "Chart image export", () =>
{
    it ( "sanitizes the model name without losing a usable file stem", () =>
    {
        expect ( sanitizeChartImageFileStem ( "  Model: One / Two?  " ) ).toBe ( "Model- One - Two" );
        expect ( sanitizeChartImageFileStem ( "<>|*" ) ).toBe ( "state-machine" );
        expect ( sanitizeChartImageFileStem ( "   " ) ).toBe ( "state-machine" );
    } );

    it ( "declares SVG dimensions in the selected physical or pixel unit", () =>
    {
        expect ( chartImageDimensionText ( 192, "Pixels" ) ).toBe ( "192px" );
        expect ( chartImageDimensionText ( 192, "Inches" ) ).toBe ( "2.0000in" );
        expect ( chartImageDimensionText ( 192, "Centimetres" ) ).toBe ( "5.0800cm" );
    } );

    it ( "converts CSS pixels by DPI and enforces the configured megapixel limit before allocation", () =>
    {
        expect ( chartRasterDimensions ( 960, 480, 300, 1_000 ) )
            .toEqual ( { height: 1_500, width: 3_000 } );
        expect ( chartRasterDimensions ( 10_000, 10_000, 96, 1_000 ) )
            .toEqual ( { height: 10_000, width: 10_000 } );
        expect ( () => chartRasterDimensions ( 10_000, 10_000, 96, 99 ) )
            .toThrow ( "configured 99-megapixel" );
    } );

    it ( "uniformly fits a print raster within both pixel-count and browser-dimension limits", () =>
    {
        expect ( chartRasterDimensionsToFit ( 960, 480, 300, 16 ) )
            .toEqual ( { height: 1_500, scale: 3.125, width: 3_000 } );

        // Initialize the local values needed by this operation.

        const pixelLimited     = chartRasterDimensionsToFit ( 100_000, 10_000, 300, 16 );
        const dimensionLimited = chartRasterDimensionsToFit ( 100_000, 100, 300, 1_000 );

        expect ( pixelLimited.width * pixelLimited.height ).toBeLessThanOrEqual ( 16_000_000 );
        expect ( pixelLimited.width / pixelLimited.height ).toBeCloseTo ( 10, 1 );
        expect ( dimensionLimited.width ).toBe ( 16_384 );
        expect ( dimensionLimited.width * dimensionLimited.height ).toBeLessThanOrEqual ( 1_000_000_000 );
    } );

    it ( "allowlists the cloned SVG scene and leaves malicious model text inert", () =>
    {
        // Initialize the local values needed by this operation.

        const root = document.createElement ( "div" );

        root.innerHTML = '<section class="chart-state-node" onclick="attack()" style="color: red">' +
            '<h3 data-chart-state="safe"></h3><script>attack()</script><iframe src="https://example.test"></iframe>' +
            '<svg viewBox="0 0 10 10"><defs><marker id="safe-marker"></marker></defs>' +
            '<path d="M 0 0 L 10 10" marker-end="url(\'#safe-marker\')"></path>' +
            '<path d="M 0 0" marker-end="url(\'#safe-marker\') trailing" href="javascript:attack()" ' +
            'fill="url(https://example.test/fill)" stroke="javascript:attack()" ' +
            'style="fill: red; background-image: url(https://example.test/pixel)"></path></svg></section>';
        const heading = root.querySelector ( "h3" );

        // Handle the case where heading matches an absent value.

        if ( heading === null )
        {
            throw new Error ( "The hostile Chart fixture is incomplete." );
        }

        heading.textContent = '<img src=x onerror="attack()">';
        sanitizeChartSvgClone ( root );

        // Initialize the local values needed by this operation.

        const serialized = new XMLSerializer ().serializeToString ( root );
        const paths      = root.querySelectorAll ( "path" );

        expect ( root.querySelector ( "script, iframe" ) ).toBeNull ();
        expect ( root.querySelector ( "section" ) ).not.toHaveAttribute ( "onclick" );
        expect ( paths [ 0 ] ).toHaveAttribute ( "marker-end", "url('#safe-marker')" );
        expect ( paths [ 1 ] ).not.toHaveAttribute ( "marker-end" );
        expect ( paths [ 1 ] ).not.toHaveAttribute ( "href" );
        expect ( paths [ 1 ] ).not.toHaveAttribute ( "fill" );
        expect ( paths [ 1 ] ).not.toHaveAttribute ( "stroke" );
        expect ( paths [ 1 ] ).not.toHaveAttribute ( "style" );
        expect ( heading.textContent ).toBe ( '<img src=x onerror="attack()">' );
        expect ( serialized ).toContain ( '&lt;img src=x onerror="attack()"&gt;' );
        expect ( serialized ).not.toContain ( "<script" );
        expect ( serialized ).not.toContain ( "https://example.test" );
        expect ( serialized ).not.toContain ( "javascript:" );
    } );
} );

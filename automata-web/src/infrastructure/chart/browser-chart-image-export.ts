// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Chart Image Export
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Captures the complete React Flow scene as inert SVG and writes SVG or bounded raster output.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ApplicationPreferences } from "../../application/ports/contracts.js";
import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";

const CSS_PIXELS_PER_INCH                  = 96;
const CENTIMETRES_PER_INCH                 = 2.54;
const MAXIMUM_EXPORTED_CHART_ELEMENT_COUNT = 100_000;
const ALLOWED_CHART_EXPORT_ELEMENTS        = new Set (
    [
        "defs",
        "div",
        "g",
        "h3",
        "header",
        "li",
        "marker",
        "ol",
        "p",
        "path",
        "polygon",
        "rect",
        "section",
        "span",
        "strong",
        "svg",
        "text",
    ],
);
const ALLOWED_CHART_EXPORT_ATTRIBUTES = new Set (
    [
        "class",
        "d",
        "data-chart-state",
        "data-handleid",
        "data-handlepos",
        "data-id",
        "data-indicator-id",
        "data-nodeid",
        "data-persisted",
        "data-testid",
        "data-validation",
        "dy",
        "fill",
        "height",
        "id",
        "marker-end",
        "markerheight",
        "markerunits",
        "markerwidth",
        "orient",
        "overflow",
        "points",
        "refx",
        "refy",
        "rx",
        "ry",
        "stroke",
        "stroke-linejoin",
        "stroke-opacity",
        "stroke-width",
        "style",
        "transform",
        "viewbox",
        "visibility",
        "width",
        "x",
        "xmlns",
        "y",
    ],
);
const ALLOWED_CHART_EXPORT_NAMESPACES = new Set (
    [ "http://www.w3.org/1999/xhtml", "http://www.w3.org/2000/svg" ],
);
const POTENTIALLY_URL_BEARING_ATTRIBUTES = new Set ( [ "fill", "stroke" ] );
const LOCAL_FRAGMENT_IDENTIFIER_PATTERN  = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/u;
const LOCAL_FRAGMENT_URL_PATTERN         = /^url\(\s*(["']?)#[A-Za-z_][A-Za-z0-9_.:-]*\1\s*\)$/u;

//--------------------------------------------------------------------------------------------------
// Interface: ChartImageExportRequest
//
// Description:
//
//   Describes a chart image export request.
//
//--------------------------------------------------------------------------------------------------

export interface ChartImageExportRequest
{
    readonly canvas:             HTMLElement;
    readonly fitRasterToLimits?: boolean;
    readonly modelName:          string;
    readonly preferences:        Pick <ApplicationPreferences,
        "gridColor" | "gridSize" | "gridStyle" | "imageDpi" | "imageFileFormat" | "imageUnit" |
        "maximumImageExportMegapixels" | "showGrid" | "transitionArrowHeadSize" | "transparentBackground">;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartBounds
//
// Description:
//
//   Defines the structure of chart bounds.
//
//--------------------------------------------------------------------------------------------------

interface ChartBounds
{
    readonly height: number;
    readonly width:  number;
    readonly x:      number;
    readonly y:      number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartSceneGeometry
//
// Description:
//
//   Defines the structure of chart scene geometry.
//
//--------------------------------------------------------------------------------------------------

interface ChartSceneGeometry
{
    readonly cssHeight: number;
    readonly cssWidth:  number;
    readonly padding:   number;
    readonly transform: DOMMatrixReadOnly;
    readonly world:     ChartBounds;
}

//--------------------------------------------------------------------------------------------------
// Interface: Point
//
// Description:
//
//   Defines the structure of point.
//
//--------------------------------------------------------------------------------------------------

interface Point
{
    readonly x: number;
    readonly y: number;
}

//--------------------------------------------------------------------------------------------------
// Function: sanitizeChartImageFileStem
//
// Description:
//
//   Sanitizes the chart image file stem.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
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

export function sanitizeChartImageFileStem ( value: string ): string
{
    // Initialize the local values needed by this operation.

    const printableValue = Array.from ( value.trim () ).filter ( character =>
        ( character.codePointAt ( 0 ) ?? 0 ) >= 32 ).join ( "" );
    const sanitized = printableValue
        .replace ( /[<>:"/\\|?*]/gu, "-" )
        .replace ( /-+/gu, "-" )
        .replace ( /[-. ]+$/gu, "" );

    // Return the result selected by the current condition.

    return sanitized.length === 0 ? "state-machine" : sanitized.slice ( 0, 120 );
}

//--------------------------------------------------------------------------------------------------
// Function: chartElementBounds
//
// Description:
//
//   Derives the chart element bounds.
//
// Parameters:
//
//   - canvas:
//     The canvas supplied to the operation.
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

function chartElementBounds ( canvas: HTMLElement ): ChartBounds
{
    // Initialize the local values needed by this operation.

    const elements = Array.from ( canvas.querySelectorAll<HTMLElement> (
        ".react-flow__node, .react-flow__edge",
    ) );

    // Handle the case where elements length equals 0.

    if ( elements.length === 0 )
    {
        throw new Error ( "The Chart contains no visible elements to export." );
    }

    // Initialize the local values needed by this operation.

    const canvasRectangle = canvas.getBoundingClientRect ();
    const rectangles      = elements.map ( element => element.getBoundingClientRect () );
    const minimumX        = Math.min ( ...rectangles.map ( rectangle => rectangle.left - canvasRectangle.left ) );
    const minimumY        = Math.min ( ...rectangles.map ( rectangle => rectangle.top - canvasRectangle.top ) );
    const maximumX        = Math.max ( ...rectangles.map ( rectangle => rectangle.right - canvasRectangle.left ) );
    const maximumY        = Math.max ( ...rectangles.map ( rectangle => rectangle.bottom - canvasRectangle.top ) );

    // Return the assembled result.

    return {
        height: maximumY - minimumY,
        width:  maximumX - minimumX,
        x:      minimumX,
        y:      minimumY,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: inlineComputedStyles
//
// Description:
//
//   Handles the inline computed styles behavior.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - clone:
//     The clone supplied to the operation.
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

function inlineComputedStyles ( source: Element, clone: Element ): void
{
    // Handle the case where at least one branch condition is satisfied.

    if ( source instanceof HTMLElement || source instanceof SVGElement )
    {
        // Initialize the local values needed by this operation.

        const computedStyle = window.getComputedStyle ( source );
        const cloneElement  = clone as HTMLElement | SVGElement;

        // Process each property name from the computed style collection in order.

        for ( const propertyName of computedStyle )
        {
            cloneElement.style.setProperty (
                propertyName,
                computedStyle.getPropertyValue ( propertyName ),
                computedStyle.getPropertyPriority ( propertyName ),
            );
        }
    }

    // Initialize the local values needed by this operation.

    const sourceChildren = Array.from ( source.children );
    const cloneChildren  = Array.from ( clone.children );

    sourceChildren.forEach ( ( sourceChild, index ) =>
    {
        // Initialize the local values needed by this operation.

        const cloneChild = cloneChildren [ index ];

        // Handle the case where clone child differs from undefined.

        if ( cloneChild !== undefined )
        {
            inlineComputedStyles ( sourceChild, cloneChild );
        }
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: containsOnlyLocalCssUrls
//
// Description:
//
//   Derives the contains only local CSS urls.
//
// Parameters:
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
//--------------------------------------------------------------------------------------------------

function containsOnlyLocalCssUrls ( value: string ): boolean
{
    // Handle the case where test result is enabled.

    if ( /(?:@import|expression\s*\(|javascript:|vbscript:|-moz-binding|data:text\/html)/iu.test ( value ) )
    {
        // Return the computed result.

        return false;
    }

    // Process each match from the match all result collection in order.

    for ( const match of value.matchAll ( /url\(\s*(["']?)(.*?)\1\s*\)/giu ) )
    {
        // Handle the case where the test result condition is not satisfied.

        if ( !LOCAL_FRAGMENT_IDENTIFIER_PATTERN.test ( match [ 2 ] ?? "" ) )
        {
            // Return the computed result.

            return false;
        }
    }

    // Return the computed result.

    return true;
}

//--------------------------------------------------------------------------------------------------
// Function: sanitizeChartSvgClone
//
// Description:
//
//   Sanitizes the chart SVG clone.
//
// Parameters:
//
//   - root:
//     The root supplied to the operation.
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

export function sanitizeChartSvgClone ( root: Element ): void
{
    // Initialize the local values needed by this operation.

    const elements = [ root, ...root.querySelectorAll ( "*" ) ];

    // Handle the case where elements length exceeds maximum exported chart element count.

    if ( elements.length > MAXIMUM_EXPORTED_CHART_ELEMENT_COUNT )
    {
        throw new Error ( "The Chart export scene contains too many elements." );
    }

    // Process each element from the elements collection in order.

    for ( const element of elements )
    {
        // Handle the case where the has result condition is not satisfied.

        if ( !ALLOWED_CHART_EXPORT_ELEMENTS.has ( element.localName.toLocaleLowerCase () ) )
        {
            element.remove ();
            continue;
        }

        // Process each attribute from the current value collection in order.

        for ( const attribute of [ ...element.attributes ] )
        {
            // Initialize the local values needed by this operation.

            const attributeName  = attribute.name.toLocaleLowerCase ();
            const attributeValue = attribute.value;
            const allowed        = ALLOWED_CHART_EXPORT_ATTRIBUTES.has ( attributeName ) &&
                ( attributeName !== "style" || containsOnlyLocalCssUrls ( attributeValue ) ) &&
                ( !POTENTIALLY_URL_BEARING_ATTRIBUTES.has ( attributeName ) ||
                    containsOnlyLocalCssUrls ( attributeValue ) ) &&
                ( attributeName !== "marker-end" || attributeValue === "none" ||
                    LOCAL_FRAGMENT_URL_PATTERN.test ( attributeValue ) ) &&
                ( attributeName !== "xmlns" || ALLOWED_CHART_EXPORT_NAMESPACES.has ( attributeValue ) );

            // Handle the case where the allowed condition is not satisfied.

            if ( !allowed )
            {
                element.removeAttributeNode ( attribute );
            }
        }
    }
}

//--------------------------------------------------------------------------------------------------
// Function: chartImageDimensionText
//
// Description:
//
//   Derives the chart image dimension text.
//
// Parameters:
//
//   - cssPixels:
//     The CSS pixels supplied to the operation.
//
//   - unit:
//     The unit supplied to the operation.
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

export function chartImageDimensionText (
    cssPixels: number,
    unit: ApplicationPreferences["imageUnit"],
): string
{
    // Handle the case where unit matches the Pixels value.

    if ( unit === "Pixels" )
    {
        // Return the computed result.

        return `${Math.ceil ( cssPixels )}px`;
    }

    // Calculate the inches value from the current inputs.

    const inches = cssPixels / CSS_PIXELS_PER_INCH;

    // Return the result selected by the current condition.

    return unit === "Inches"
        ? `${inches.toFixed ( 4 )}in`
        : `${( inches * CENTIMETRES_PER_INCH ).toFixed ( 4 )}cm`;
}

// Both export paths draw the grid from this one description, so an exported grid cannot disagree
// with the live one about style, color, or whether it appears at all. A transparent background
// carries no grid: there is no canvas for it to sit on.
//
// The lattice matches the live chart's. A dot is a one-pixel mark on each vertex; the line styles
// rule a full line through each vertex, dotted differing from solid only in its dash. Because the
// exported image has its own origin, the lattice is phase-shifted by wherever world coordinate zero
// landed after the export translation.

//--------------------------------------------------------------------------------------------------
// Interface: ChartExportGrid
//
// Description:
//
//   Defines the structure of chart export grid.
//
//--------------------------------------------------------------------------------------------------

interface ChartExportGrid
{
    readonly color:   string;
    readonly phaseX:  number;
    readonly phaseY:  number;
    readonly size:    number;
    readonly style:   "Dots" | "Dotted" | "Solid";
}

//--------------------------------------------------------------------------------------------------
// Function: chartExportGrid
//
// Description:
//
//   Derives the chart export grid.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - translationX:
//     The translation x supplied to the operation.
//
//   - translationY:
//     The translation y supplied to the operation.
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

function chartExportGrid (
    request: ChartImageExportRequest,
    translationX: number,
    translationY: number,
): ChartExportGrid | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !request.preferences.showGrid || request.preferences.transparentBackground )
    {
        // Return the computed result.

        return null;
    }

    const size = request.preferences.gridSize;

    // Return the assembled result.

    return {
        color:  request.preferences.gridColor,
        phaseX: ( ( translationX % size ) + size ) % size,
        phaseY: ( ( translationY % size ) + size ) % size,
        size,
        style:  request.preferences.gridStyle,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createSvgBlob
//
// Description:
//
//   Creates SVG blob.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
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

function createSvgBlob ( request: ChartImageExportRequest ): {
    readonly blob:      Blob;
    readonly cssHeight: number;
    readonly cssWidth:  number;
}
{
    // Initialize the local values needed by this operation.

    const viewport = request.canvas.querySelector<HTMLElement> ( ".react-flow__viewport" );

    // Handle the case where viewport matches an absent value.

    if ( viewport === null )
    {
        throw new Error ( "The Chart scene is not ready for image export." );
    }

    // Initialize the local values needed by this operation.

    const scene = createChartSceneGeometry ( request, viewport );
    const { cssHeight, cssWidth, padding, world: worldBounds } = scene;

    const viewportClone = viewport.cloneNode ( true ) as HTMLElement;

    inlineComputedStyles ( viewport, viewportClone );
    viewportClone.querySelectorAll (
        ".chart-transition-endpoint, .chart-draft-transition-endpoint, " +
        ".react-flow__resize-control, [data-chart-debug-overlay], [data-chart-gravity-point], " +
        "[data-chart-transition-connector]",
    ).forEach ( element => element.remove () );
    viewportClone.querySelectorAll ( ".selected, .chart-node-selected" ).forEach ( element =>
    {
        element.classList.remove ( "selected", "chart-node-selected" );
    } );
    sanitizeChartSvgClone ( viewportClone );
    viewportClone.style.height          = "100%";
    viewportClone.style.transform       = `translate(${padding - worldBounds.x}px, ${padding - worldBounds.y}px)`;
    viewportClone.style.transformOrigin = "0 0";
    viewportClone.style.width           = "100%";

    // Initialize the local values needed by this operation.

    const backgroundColor = request.preferences.transparentBackground
        ? "transparent"
        : window.getComputedStyle ( request.canvas ).backgroundColor;
    const body = document.createElement ( "div" );

    body.setAttribute ( "xmlns", "http://www.w3.org/1999/xhtml" );
    body.style.backgroundColor = backgroundColor;
    body.style.color           = window.getComputedStyle ( request.canvas ).color;
    body.style.height          = `${cssHeight}px`;
    body.style.overflow        = "hidden";
    body.style.width           = `${cssWidth}px`;
    body.append ( viewportClone );

    // Initialize the local values needed by this operation.

    const serializedBody = new XMLSerializer ().serializeToString ( body );
    const grid           = chartExportGrid ( request, padding - worldBounds.x, padding - worldBounds.y );
    const gridMarkup     = grid === null
        ? ""
        : `<defs><pattern id="chart-export-grid" x="${grid.phaseX - grid.size / 2}" ` +
            `y="${grid.phaseY - grid.size / 2}" width="${grid.size}" height="${grid.size}" ` +
            `patternUnits="userSpaceOnUse">${grid.style === "Dots"
                ? `<circle cx="${grid.size / 2}" cy="${grid.size / 2}" r="0.5" fill="${grid.color}"/>`
                : `<path d="M${grid.size / 2} 0 V${grid.size} M0 ${grid.size / 2} H${grid.size}" ` +
                    `stroke="${grid.color}" stroke-width="1" fill="none"` +
                    `${grid.style === "Dotted" ? ` stroke-dasharray="1 3"` : ""}/>`
            }</pattern></defs><rect width="100%" height="100%" fill="url(#chart-export-grid)"/>`;
    const svgText = `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `width="${chartImageDimensionText ( cssWidth, request.preferences.imageUnit )}" ` +
        `height="${chartImageDimensionText ( cssHeight, request.preferences.imageUnit )}" ` +
        `viewBox="0 0 ${cssWidth} ${cssHeight}">${gridMarkup}` +
        `<foreignObject width="100%" height="100%">${serializedBody}</foreignObject></svg>`;

    // Return the assembled result.

    return {
        blob: new Blob ( [ svgText ], { type: "image/svg+xml;charset=utf-8" } ),
        cssHeight,
        cssWidth,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createChartSceneGeometry
//
// Description:
//
//   Creates chart scene geometry.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - viewport:
//     The viewport supplied to the operation.
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

function createChartSceneGeometry (
    request: ChartImageExportRequest,
    viewport?: HTMLElement,
): ChartSceneGeometry
{
    // Initialize the local values needed by this operation.

    const resolvedViewport = viewport ?? request.canvas.querySelector<HTMLElement> ( ".react-flow__viewport" );

    // Handle the case where resolved viewport matches an absent value.

    if ( resolvedViewport === null )
    {
        throw new Error ( "The Chart scene is not ready for image export." );
    }

    // Initialize the local values needed by this operation.

    const bounds    = chartElementBounds ( request.canvas );
    const transform = new DOMMatrixReadOnly ( window.getComputedStyle ( resolvedViewport ).transform );
    const zoom      = transform.a;

    // Handle the case where at least one branch condition is satisfied.

    if ( !Number.isFinite ( zoom ) || zoom <= 0 || bounds.width <= 0 || bounds.height <= 0 )
    {
        throw new Error ( "The Chart has invalid export dimensions." );
    }

    // Initialize the local values needed by this operation.

    const padding = request.preferences.gridSize;
    const world   = {
        height: bounds.height / zoom,
        width:  bounds.width / zoom,
        x:      ( bounds.x - transform.e ) / zoom,
        y:      ( bounds.y - transform.f ) / zoom,
    };

    // Return the assembled result.

    return {
        cssHeight: Math.ceil ( world.height + padding * 2 ),
        cssWidth:  Math.ceil ( world.width + padding * 2 ),
        padding,
        transform,
        world,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: rasterizeChart
//
// Description:
//
//   Derives the rasterize chart.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - format:
//     The format supplied to the operation.
//
//   - dotsPerInch:
//     The dots per inch supplied to the operation.
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

async function rasterizeChart (
    request: ChartImageExportRequest,
    format: "JPG" | "PNG",
    dotsPerInch: number,
): Promise<Blob>
{
    // Initialize the local values needed by this operation.

    const scene = createChartSceneGeometry ( request );
    const { cssHeight, cssWidth } = scene;
    const rasterGeometry = request.fitRasterToLimits
        ? chartRasterDimensionsToFit (
            cssWidth,
            cssHeight,
            dotsPerInch,
            request.preferences.maximumImageExportMegapixels,
        )
        : {
            ...chartRasterDimensions (
                cssWidth,
                cssHeight,
                dotsPerInch,
                request.preferences.maximumImageExportMegapixels,
            ),
            scale: dotsPerInch / CSS_PIXELS_PER_INCH,
        };
    const { height, scale, width } = rasterGeometry;
    const canvas = document.createElement ( "canvas" );

    canvas.height = height;
    canvas.width  = width;
    const context = canvas.getContext ( "2d" );

    // Handle the case where context matches an absent value.

    if ( context === null )
    {
        throw new Error ( "The browser could not allocate the Chart image encoder." );
    }

    // Initialize the local values needed by this operation.

    const canvasStyle  = window.getComputedStyle ( request.canvas );
    const translationX = scene.padding - scene.world.x;
    const translationY = scene.padding - scene.world.y;

    context.scale ( scale, scale );

    // JPEG has no alpha, so a transparent export still needs an opaque ground under it.

    if ( format === "JPG" || !request.preferences.transparentBackground )
    {
        context.fillStyle = canvasStyle.backgroundColor === "rgba(0, 0, 0, 0)" ||
            request.preferences.transparentBackground
            ? "#ffffff"
            : canvasStyle.backgroundColor;
        context.fillRect ( 0, 0, cssWidth, cssHeight );
    }

    const grid = chartExportGrid ( request, translationX, translationY );

    // Handle the case where grid differs from an absent value.

    if ( grid !== null )
    {
        context.save ();
        context.strokeStyle = grid.color;
        context.fillStyle   = grid.color;
        context.lineWidth   = 1;

        // Handle the case where grid style matches the Dotted value.

        if ( grid.style === "Dotted" )
        {
            context.setLineDash ( [ 1, 3 ] );
        }

        // Repeat the operation across the bounded iteration range.

        for ( let x = grid.phaseX - grid.size; x <= cssWidth + grid.size; x += grid.size )
        {
            // Repeat the operation across the bounded iteration range.

            for ( let y = grid.phaseY - grid.size; y <= cssHeight + grid.size; y += grid.size )
            {
                // Handle the case where grid style matches the Dots value.

                if ( grid.style === "Dots" )
                {
                    context.fillRect ( x, y, 1, 1 );
                }
            }

            // Handle the case where grid style differs from the Dots value.

            if ( grid.style !== "Dots" )
            {
                context.beginPath ();
                context.moveTo ( x + 0.5, 0 );
                context.lineTo ( x + 0.5, cssHeight );
                context.stroke ();
            }
        }

        // Handle the case where grid style differs from the Dots value.

        if ( grid.style !== "Dots" )
        {
            // Repeat the operation across the bounded iteration range.

            for ( let y = grid.phaseY - grid.size; y <= cssHeight + grid.size; y += grid.size )
            {
                context.beginPath ();
                context.moveTo ( 0, y + 0.5 );
                context.lineTo ( cssWidth, y + 0.5 );
                context.stroke ();
            }
        }

        context.restore ();
    }

    context.translate ( translationX, translationY );
    request.canvas.querySelectorAll<SVGPathElement> ( ".react-flow__edge-path" ).forEach ( path =>
    {
        // Initialize the local values needed by this operation.

        const pathData = path.getAttribute ( "d" );

        // Handle the case where path data matches an absent value.

        if ( pathData === null )
        {
            // Return control to the caller.

            return;
        }

        const style = window.getComputedStyle ( path );

        context.strokeStyle = style.stroke;
        context.lineWidth   = Number.parseFloat ( style.strokeWidth ) || 1;
        context.setLineDash ( style.strokeDasharray === "none" ? [] : style.strokeDasharray.split ( /[ ,]+/u )
            .map ( value => Number ( value ) ).filter ( Number.isFinite ) );
        context.stroke ( new Path2D ( pathData ) );

        const coordinates = Array.from ( pathData.matchAll ( /-?\d+(?:\.\d+)?/gu ), match => Number ( match [ 0 ] ) );

        // Handle the case where coordinates length is at least the 4 value.

        if ( coordinates.length >= 4 )
        {
            drawArrowhead (
                context,
                {
                    x: coordinates [ coordinates.length - 4 ] ?? 0,
                    y: coordinates [ coordinates.length - 3 ] ?? 0,
                },
                {
                    x: coordinates [ coordinates.length - 2 ] ?? 0,
                    y: coordinates [ coordinates.length - 1 ] ?? 0,
                },
                style.stroke,
                request.preferences.transitionArrowHeadSize,
            );
        }
    } );
    context.setLineDash ( [] );

    // Initialize the local values needed by this operation.

    const canvasRectangle = request.canvas.getBoundingClientRect ();
    const zoom            = scene.transform.a;

    //----------------------------------------------------------------------------------------------
    // Function: worldRectangle
    //
    // Description:
    //
    //   Derives the world rectangle.
    //
    // Parameters:
    //
    //   - element:
    //     The element supplied to the operation.
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

    const worldRectangle = ( element: Element ): ChartBounds =>
    {
        // Initialize the local values needed by this operation.

        const rectangle = element.getBoundingClientRect ();

        // Return the assembled result.

        return {
            x: ( rectangle.left - canvasRectangle.left - scene.transform.e ) / zoom,
            y: ( rectangle.top - canvasRectangle.top - scene.transform.f ) / zoom,
            width: rectangle.width / zoom,
            height: rectangle.height / zoom,
        };
    };

    request.canvas.querySelectorAll<HTMLElement> ( ".react-flow__node" ).forEach ( node =>
    {
        // Initialize the local values needed by this operation.

        const rectangle        = worldRectangle ( node );
        const stateElement     = node.querySelector<HTMLElement> ( ".chart-state-node" );
        const indicatorElement = node.querySelector<HTMLElement> ( ".chart-indicator-symbol" );

        // Handle the case where state element differs from an absent value.

        if ( stateElement !== null )
        {
            // Initialize the local values needed by this operation.

            const style = window.getComputedStyle ( stateElement );

            context.fillStyle   = style.backgroundColor;
            context.strokeStyle = style.borderColor;
            context.lineWidth   = Number.parseFloat ( style.borderWidth ) || 1;
            context.beginPath ();
            context.roundRect ( rectangle.x, rectangle.y, rectangle.width, rectangle.height, 10 );
            context.fill ();
            context.stroke ();

            stateElement.querySelectorAll<HTMLElement> ( "strong, .chart-state-markers span, h3, li, p" )
                .forEach ( textElement =>
                {
                    // Initialize the local values needed by this operation.

                    const textStyle = window.getComputedStyle ( textElement );

                    context.fillStyle = textStyle.color;
                    context.font      = `${textStyle.fontWeight} ${Number.parseFloat ( textStyle.fontSize )}px ` +
                        `${textStyle.fontFamily}`;
                    context.textBaseline = "top";
                    chartTextLineFragments ( textElement ).forEach ( fragment =>
                    {
                        context.fillText (
                            fragment.text,
                            ( fragment.rectangle.left - canvasRectangle.left - scene.transform.e ) / zoom,
                            ( fragment.rectangle.top - canvasRectangle.top - scene.transform.f ) / zoom,
                        );
                    } );
                } );
        }
        else if ( indicatorElement !== null )
        {
            // The symbol's own rendered box gives the radius. Hardcoding it, as this once did,
            // silently halved every exported indicator the moment the shapes were resized.

            const style       = window.getComputedStyle ( indicatorElement );
            const centerX     = rectangle.x + rectangle.width / 2;
            const centerY     = rectangle.y + rectangle.height / 2;
            const borderWidth = Number.parseFloat ( style.borderWidth ) || 0;
            const radius      = Number.parseFloat ( style.width ) / 2;
            const isTerminal  = node.querySelector ( ".chart-terminal-indicator" ) !== null;

            context.fillStyle   = style.backgroundColor;
            context.strokeStyle = style.borderColor;
            context.lineWidth   = borderWidth;
            context.beginPath ();
            context.arc ( centerX, centerY, Math.max ( 0, radius - borderWidth / 2 ), 0, Math.PI * 2 );
            context.fill ();
            context.stroke ();

            // A UML final state is a ring around a filled disc. Drawing only the ring, as this once
            // did, left the exported indicator hollow and unlike the chart.

            if ( isTerminal )
            {
                // Initialize the local values needed by this operation.

                const innerStyle  = window.getComputedStyle ( indicatorElement, "::after" );
                const innerRadius = Number.parseFloat ( innerStyle.width ) / 2;

                // Handle the case where all required conditions are satisfied.

                if ( Number.isFinite ( innerRadius ) && innerRadius > 0 )
                {
                    context.fillStyle = innerStyle.backgroundColor;
                    context.beginPath ();
                    context.arc ( centerX, centerY, innerRadius, 0, Math.PI * 2 );
                    context.fill ();
                }
            }
        }
        else
        {
            // Initialize the local values needed by this operation.

            const draftPath = node.querySelector<SVGPathElement> ( ".chart-draft-transition-node path" );

            // Handle the case where draft path differs from an absent value.

            if ( draftPath !== null )
            {
                // Initialize the local values needed by this operation.

                const pathData = draftPath.getAttribute ( "d" );

                // Handle the case where path data matches an absent value.

                if ( pathData === null )
                {
                    // Return control to the caller.

                    return;
                }

                // Initialize the local values needed by this operation.

                const style       = window.getComputedStyle ( draftPath );
                const coordinates = Array.from (
                    pathData.matchAll ( /-?\d+(?:\.\d+)?/gu ),
                    match => Number ( match [ 0 ] ),
                );

                context.strokeStyle = style.stroke;
                context.lineWidth   = Number.parseFloat ( style.strokeWidth ) || 1;
                context.setLineDash ( style.strokeDasharray === "none" ? [] : style.strokeDasharray.split ( /[ ,]+/u )
                    .map ( value => Number ( value ) ).filter ( Number.isFinite ) );
                context.save ();
                context.translate ( rectangle.x, rectangle.y );
                context.stroke ( new Path2D ( pathData ) );

                // Handle the case where coordinates length is at least the 4 value.

                if ( coordinates.length >= 4 )
                {
                    drawArrowhead (
                        context,
                        {
                            x: coordinates [ coordinates.length - 4 ] ?? 0,
                            y: coordinates [ coordinates.length - 3 ] ?? 0,
                        },
                        {
                            x: coordinates [ coordinates.length - 2 ] ?? 0,
                            y: coordinates [ coordinates.length - 1 ] ?? 0,
                        },
                        style.stroke,
                        request.preferences.transitionArrowHeadSize,
                    );
                }

                context.restore ();
                context.setLineDash ( [] );
            }
        }
    } );

    request.canvas.querySelectorAll<SVGGElement> ( ".react-flow__edge-textwrapper" ).forEach ( wrapper =>
    {
        // Initialize the local values needed by this operation.

        const label = wrapper.querySelector<SVGTextElement> ( ".react-flow__edge-text" );

        // Handle the case where label matches an absent value.

        if ( label === null )
        {
            // Return control to the caller.

            return;
        }

        const background = wrapper.querySelector<SVGRectElement> ( ".react-flow__edge-textbg" );

        // Handle the case where background differs from an absent value.

        if ( background !== null )
        {
            // Initialize the local values needed by this operation.

            const backgroundRectangle = worldRectangle ( background );
            const backgroundStyle     = window.getComputedStyle ( background );
            const cornerRadius        = Number.parseFloat ( background.getAttribute ( "rx" ) ?? "0" );

            context.fillStyle = backgroundStyle.fill;
            context.beginPath ();
            context.roundRect (
                backgroundRectangle.x,
                backgroundRectangle.y,
                backgroundRectangle.width,
                backgroundRectangle.height,
                Number.isFinite ( cornerRadius ) ? cornerRadius : 0,
            );
            context.fill ();
        }

        // A wrapped event name is one tspan per line, so its lines are read from the rendered line
        // boxes exactly as a state or action name is. Splitting the text content instead, as this
        // once did, stopped finding the breaks the moment the label became structured rather than
        // newline-separated.

        const style = window.getComputedStyle ( label );

        context.fillStyle    = style.fill;
        context.font         = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        context.textAlign    = "center";
        context.textBaseline = "middle";
        chartTextLineFragments ( label ).forEach ( fragment => context.fillText (
            fragment.text,
            ( fragment.rectangle.left + fragment.rectangle.width / 2 - canvasRectangle.left - scene.transform.e ) /
                zoom,
            ( fragment.rectangle.top + fragment.rectangle.height / 2 - canvasRectangle.top - scene.transform.f ) /
                zoom,
        ) );
    } );

    // Return the computed result.

    return new Promise ( ( resolve, reject ) => canvas.toBlob (
        blob => blob === null
            ? reject ( new Error ( "The browser could not encode the Chart image." ) )
            : resolve ( blob ),
        format === "JPG" ? "image/jpeg" : "image/png",
        format === "JPG" ? 0.92 : undefined,
    ) );
}

//--------------------------------------------------------------------------------------------------
// Function: drawArrowhead
//
// Description:
//
//   Handles the draw arrowhead behavior.
//
// Parameters:
//
//   - context:
//     The context supplied to the operation.
//
//   - start:
//     The start supplied to the operation.
//
//   - end:
//     The end supplied to the operation.
//
//   - color:
//     The color supplied to the operation.
//
//   - size:
//     The size supplied to the operation.
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

function drawArrowhead (
    context: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    color: string,
    size: number,
): void
{
    // Initialize the local values needed by this operation.

    const configuration = COMPILE_TIME_CONFIGURATION.chart.transitionLines;
    const angle         = Math.atan2 ( end.y - start.y, end.x - start.x );
    const length        = size;
    const halfWidth     = configuration.arrowHeadStyle === "NarrowClosed" ||
        configuration.arrowHeadStyle === "NarrowOpen" ? length / 6 : length / 2;
    const baseX          = end.x - Math.cos ( angle ) * length;
    const baseY          = end.y - Math.sin ( angle ) * length;
    const firstBasePoint = {
        x: baseX + Math.cos ( angle + Math.PI / 2 ) * halfWidth,
        y: baseY + Math.sin ( angle + Math.PI / 2 ) * halfWidth,
    };
    const secondBasePoint = {
        x: baseX + Math.cos ( angle - Math.PI / 2 ) * halfWidth,
        y: baseY + Math.sin ( angle - Math.PI / 2 ) * halfWidth,
    };
    const closed = configuration.arrowHeadStyle === "Closed" ||
        configuration.arrowHeadStyle === "NarrowClosed";

    context.save ();
    context.beginPath ();
    context.moveTo ( firstBasePoint.x, firstBasePoint.y );
    context.lineTo ( end.x, end.y );
    context.lineTo ( secondBasePoint.x, secondBasePoint.y );

    // Handle the case where closed is enabled.

    if ( closed )
    {
        context.fillStyle = color;
        context.closePath ();
        context.fill ();
    }
    else
    {
        // Handle the remaining case after the preceding condition is false.

        context.lineCap     = "round";
        context.lineJoin    = "round";
        context.lineWidth   = Math.max ( 1, size / 12 );
        context.strokeStyle = color;
        context.stroke ();
    }

    context.restore ();
}

// Every wrapped name in the Chart is rendered as one element per line. Reading an element's
// textContent therefore concatenates its lines into a single unbroken string, which is how exported
// state and action names came to ignore the wrapping the live Chart shows. Text is measured here
// from the rendered line boxes instead, so an exported name breaks exactly where the browser broke
// it, whether the break came from the name-wrapping rules or from the stylesheet reflowing a line.

//--------------------------------------------------------------------------------------------------
// Function: chartTextLineFragments
//
// Description:
//
//   Derives the chart text line fragments.
//
// Parameters:
//
//   - element:
//     The element supplied to the operation.
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

function chartTextLineFragments ( element: Element ): readonly { readonly rectangle: DOMRect; readonly text: string }[]
{
    // Initialize the local values needed by this operation.

    const walker = document.createTreeWalker ( element, NodeFilter.SHOW_TEXT );
    const fragments: { readonly rectangle: DOMRect; readonly text: string }[] = [];

    // Repeat the operation across the bounded iteration range.

    for ( let node = walker.nextNode (); node !== null; node = walker.nextNode () )
    {
        // Initialize the local values needed by this operation.

        const text = node.textContent ?? "";

        // Handle the case where at least one branch condition is satisfied.

        if ( text.trim ().length === 0 || ( node.parentElement?.closest ( ".visually-hidden" ) ?? null ) !== null )
        {
            continue;
        }

        const range = document.createRange ();

        range.selectNodeContents ( node );

        const lineRectangles = Array.from ( range.getClientRects () ).filter (
            rectangle => rectangle.width > 0 || rectangle.height > 0 );

        // Handle the case where line rectangles length is at most 1.

        if ( lineRectangles.length <= 1 )
        {
            // Initialize the local values needed by this operation.

            const rectangle = lineRectangles [ 0 ];

            // Handle the case where rectangle differs from undefined.

            if ( rectangle !== undefined )
            {
                fragments.push ( { rectangle, text } );
            }

            continue;
        }

        // The browser reflowed one text node across several lines, so the break positions are
        // recovered by extending a range one character at a time and watching for the line box
        // count to grow.

        let lineStart = 0;
        let lineIndex = 0;

        // Repeat the operation across the bounded iteration range.

        for ( let offset = 1; offset <= text.length; offset++ )
        {
            range.setStart ( node, lineStart );
            range.setEnd ( node, offset );

            const occupiedLines = Array.from ( range.getClientRects () ).filter (
                rectangle => rectangle.width > 0 || rectangle.height > 0 ).length;

            // Handle the case where all required conditions are satisfied.

            if ( occupiedLines <= 1 && offset < text.length )
            {
                continue;
            }

            // Initialize the local values needed by this operation.

            const breakAt   = occupiedLines > 1 ? offset - 1 : offset;
            const rectangle = lineRectangles [ lineIndex ];

            // Handle the case where all required conditions are satisfied.

            if ( rectangle !== undefined && breakAt > lineStart )
            {
                fragments.push ( { rectangle, text: text.slice ( lineStart, breakAt ) } );
            }

            lineStart = breakAt;
            lineIndex += 1;

            // Handle the case where line index is at least line rectangles length.

            if ( lineIndex >= lineRectangles.length )
            {
                break;
            }
        }
    }

    // Return the fragments.

    return fragments;
}

//--------------------------------------------------------------------------------------------------
// Function: chartRasterDimensions
//
// Description:
//
//   Derives the chart raster dimensions.
//
// Parameters:
//
//   - cssWidth:
//     The CSS width supplied to the operation.
//
//   - cssHeight:
//     The CSS height supplied to the operation.
//
//   - dotsPerInch:
//     The dots per inch supplied to the operation.
//
//   - maximumMegapixels:
//     The maximum megapixels supplied to the operation.
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

export function chartRasterDimensions (
    cssWidth: number,
    cssHeight: number,
    dotsPerInch: number,
    maximumMegapixels: number,
): { readonly height: number; readonly width: number }
{
    // Initialize the local values needed by this operation.

    const scale                   = dotsPerInch / CSS_PIXELS_PER_INCH;
    const width                   = Math.max ( 1, Math.ceil ( cssWidth * scale ) );
    const height                  = Math.max ( 1, Math.ceil ( cssHeight * scale ) );
    const maximumRasterPixelCount = maximumMegapixels * 1_000_000;

    // Handle the case where current value exceeds maximum raster pixel count.

    if ( width * height > maximumRasterPixelCount )
    {
        throw new Error (
            `The requested raster image exceeds the configured ${maximumMegapixels}-megapixel export limit.`,
        );
    }

    // Return the assembled result.

    return { height, width };
}

//--------------------------------------------------------------------------------------------------
// Function: chartRasterDimensionsToFit
//
// Description:
//
//   Derives the chart raster dimensions to fit.
//
// Parameters:
//
//   - cssWidth:
//     The CSS width supplied to the operation.
//
//   - cssHeight:
//     The CSS height supplied to the operation.
//
//   - dotsPerInch:
//     The dots per inch supplied to the operation.
//
//   - maximumMegapixels:
//     The maximum megapixels supplied to the operation.
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

export function chartRasterDimensionsToFit (
    cssWidth: number,
    cssHeight: number,
    dotsPerInch: number,
    maximumMegapixels: number,
): { readonly height: number; readonly scale: number; readonly width: number }
{
    // Initialize the local values needed by this operation.

    const maximumRasterDimension = 16_384;
    const requestedScale         = dotsPerInch / CSS_PIXELS_PER_INCH;
    const maximumPixelCount      = maximumMegapixels * 1_000_000;
    const scaleLimit             = Math.min (
        requestedScale,
        Math.sqrt ( maximumPixelCount / ( cssWidth * cssHeight ) ),
        maximumRasterDimension / cssWidth,
        maximumRasterDimension / cssHeight,
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( !Number.isFinite ( scaleLimit ) || scaleLimit <= 0 )
    {
        throw new Error ( "The Chart has invalid raster image dimensions." );
    }

    // Initialize the local values needed by this operation.

    const width  = Math.max ( 1, Math.floor ( cssWidth * scaleLimit ) );
    const height = Math.max ( 1, Math.floor ( cssHeight * scaleLimit ) );

    // Return the assembled result.

    return {
        height,
        scale: Math.min ( width / cssWidth, height / cssHeight ),
        width,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: writeImageBlob
//
// Description:
//
//   Writes image blob.
//
// Parameters:
//
//   - blob:
//     The blob supplied to the operation.
//
//   - suggestedName:
//     The suggested name supplied to the operation.
//
//   - extension:
//     The extension supplied to the operation.
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

async function writeImageBlob ( blob: Blob, suggestedName: string, extension: string ): Promise<string | null>
{
    // Handle the case where window show save file picker matches undefined.

    if ( window.showSaveFilePicker === undefined )
    {
        // Initialize the local values needed by this operation.

        const objectUrl = URL.createObjectURL ( blob );
        const link      = document.createElement ( "a" );

        link.download = suggestedName;
        link.href     = objectUrl;
        link.click ();
        window.setTimeout ( () => URL.revokeObjectURL ( objectUrl ), 0 );

        // Return the suggested name.

        return suggestedName;
    }

    let fileHandle: FileSystemFileHandle;

    // Run the operation that may report a recoverable failure.

    try
    {
        fileHandle = await window.showSaveFilePicker ( {
            excludeAcceptAllOption: true,
            suggestedName,
            types:
            [
                {
                    description: `${extension.toLocaleUpperCase ()} image`,
                    accept: { [ blob.type.split ( ";", 1 ) [ 0 ] ?? blob.type ]: [ `.${extension}` ] },
                },
            ],
        } );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        if ( error instanceof DOMException && error.name === "AbortError" )
        {
            // Return the computed result.

            return null;
        }

        throw error;
    }

    const writable = await fileHandle.createWritable ();

    await writable.write ( blob );
    await writable.close ();

    // Return the computed result.

    return fileHandle.name;
}

//--------------------------------------------------------------------------------------------------
// Function: exportChartImage
//
// Description:
//
//   Derives the export chart image.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
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

export async function exportChartImage ( request: ChartImageExportRequest ): Promise<string | null>
{
    // Initialize the local values needed by this operation.

    const extension     = request.preferences.imageFileFormat.toLocaleLowerCase ();
    const suggestedName = `${sanitizeChartImageFileStem ( request.modelName )}-chart.${extension}`;
    const blob          = await captureChartImage ( request );

    // Return the write image blob result.

    return writeImageBlob ( blob, suggestedName, extension );
}

//--------------------------------------------------------------------------------------------------
// Function: captureChartImage
//
// Description:
//
//   Captures the chart image.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
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

export async function captureChartImage ( request: ChartImageExportRequest ): Promise<Blob>
{
    // Return the result selected by the current condition.

    return request.preferences.imageFileFormat === "SVG"
        ? createSvgBlob ( request ).blob
        : rasterizeChart (
            request,
            request.preferences.imageFileFormat,
            request.preferences.imageDpi,
        );
}

//--------------------------------------------------------------------------------------------------
// Function: captureChartImageDataUrl
//
// Description:
//
//   Captures the chart image data URL.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
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

export async function captureChartImageDataUrl ( request: ChartImageExportRequest ): Promise<string>
{
    // Initialize the local values needed by this operation.

    const blob = await captureChartImage ( request );

    // Return the computed result.

    return new Promise<string> ( ( resolve, reject ) =>
    {
        // Initialize the local values needed by this operation.

        const reader = new FileReader ();

        reader.addEventListener ( "error", () => reject (
            reader.error ?? new Error ( "Chart image capture failed." ),
        ) );
        reader.addEventListener ( "load", () =>
        {
            // Handle the case where current value matches the string value.

            if ( typeof reader.result === "string" )
            {
                resolve ( reader.result );

                // Return control to the caller.

                return;
            }

            reject ( new Error ( "Chart image capture produced no image data." ) );
        } );
        reader.readAsDataURL ( blob );
    } );
}

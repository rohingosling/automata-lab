// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Palette Drag Image Tests
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies decoded glyph preparation, source-only compositing, native fallback and cleanup.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import
{
    prepareChartPaletteDragImage,
    prepareChartPaletteDragImages,
    setChartPaletteDragImage,
} from "../../src/presentation/chart/chart-palette-drag-image.js";

const drawImage = vi.fn ();
const fillRect  = vi.fn ();
const context  = { drawImage, fillRect, fillStyle: "", globalCompositeOperation: "source-over" };

//--------------------------------------------------------------------------------------------------
// Function: createIcon
//
// Description:
//
//   Creates a loaded palette glyph with distinct CSS and SVG intrinsic sizes.
//
//--------------------------------------------------------------------------------------------------

function createIcon ( renderedSize: number = 16 ): HTMLImageElement
{
    const icon = document.createElement ( "img" );

    icon.src = "/icons/custom/20/state-machine-state-chart-palette-state.svg";
    icon.style.color = "rgb(240, 241, 242)";
    Object.defineProperties ( icon, { clientWidth: { value: renderedSize }, clientHeight: { value: renderedSize } } );

    return icon;
}

beforeEach ( () =>
{
    vi.spyOn ( HTMLImageElement.prototype, "complete", "get" ).mockReturnValue ( true );
    vi.spyOn ( HTMLImageElement.prototype, "naturalWidth", "get" ).mockReturnValue ( 20 );
    vi.spyOn ( HTMLImageElement.prototype, "naturalHeight", "get" ).mockReturnValue ( 20 );
    Object.defineProperty ( HTMLImageElement.prototype, "decode", {
        configurable: true, value: vi.fn ( async () => undefined ), writable: true,
    } );
    vi.spyOn ( HTMLCanvasElement.prototype, "getContext" )
        .mockReturnValue ( context as unknown as CanvasRenderingContext2D );
    vi.spyOn ( HTMLCanvasElement.prototype, "toDataURL" ).mockReturnValue ( "data:image/png;base64,Z2x5cGg=" );
    context.fillStyle = "";
    context.globalCompositeOperation = "source-over";
    drawImage.mockClear ();
    fillRect.mockClear ();
} );

afterEach ( () =>
{
    document.body.replaceChildren ();
    vi.restoreAllMocks ();
} );

describe ( "Chart palette native drag image", () =>
{
    it.each ( [ 16, 32 ] ) ( "uses a decoded transparent bitmap matching a %i-pixel glyph and hotspot", async renderedSize =>
    {
        const icon = createIcon ( renderedSize );
        const dataTransfer = { setDragImage: vi.fn () };

        await prepareChartPaletteDragImage ( icon );
        setChartPaletteDragImage ( dataTransfer, icon );

        const [ image, horizontalOffset, verticalOffset ] = dataTransfer.setDragImage.mock.calls [ 0 ] ?? [];

        expect ( image ).toBeInstanceOf ( HTMLImageElement );
        expect ( image ).not.toBe ( icon );
        expect ( image.src ).toBe ( "data:image/png;base64,Z2x5cGg=" );
        expect ( [ image.width, image.height, horizontalOffset, verticalOffset ] )
            .toEqual ( [ renderedSize, renderedSize, renderedSize / 2, renderedSize / 2 ] );
        expect ( drawImage ).toHaveBeenCalledWith ( icon, 0, 0, renderedSize, renderedSize );
        expect ( context.globalCompositeOperation ).toBe ( "source-in" );
        expect ( context.fillStyle ).toBe ( "rgb(240, 241, 242)" );
        expect ( fillRect ).toHaveBeenCalledWith ( 0, 0, renderedSize, renderedSize );
        expect ( icon.parentElement ).toBeNull ();
    } );

    it ( "uses only a ready source icon while raster preparation is unavailable", async () =>
    {
        const icon = createIcon ();
        const dataTransfer = { setDragImage: vi.fn () };

        vi.mocked ( HTMLCanvasElement.prototype.getContext ).mockReturnValue ( null );
        await prepareChartPaletteDragImage ( icon );
        setChartPaletteDragImage ( dataTransfer, icon );
        expect ( dataTransfer.setDragImage ).toHaveBeenCalledWith ( icon, 8, 8 );

        vi.mocked ( Object.getOwnPropertyDescriptor ( HTMLImageElement.prototype, "naturalWidth" )!.get! )
            .mockReturnValue ( 0 );
        dataTransfer.setDragImage.mockClear ();
        setChartPaletteDragImage ( dataTransfer, icon );
        expect ( dataTransfer.setDragImage ).not.toHaveBeenCalled ();
    } );

    it ( "does not use an undecoded prepared PNG and discards preparations after palette cleanup", async () =>
    {
        const icon = createIcon ();
        const palette = document.createElement ( "aside" );
        const dataTransfer = { setDragImage: vi.fn () };
        let finishDecode: (() => void) | undefined;

        palette.append ( icon );
        document.body.append ( palette );
        vi.mocked ( HTMLImageElement.prototype.decode ).mockImplementation ( function ( this: HTMLImageElement )
        {
            return this === icon ? Promise.resolve () : new Promise<void> ( resolve => { finishDecode = resolve; } );
        } );

        const cleanup = prepareChartPaletteDragImages ( palette );

        await vi.waitFor ( () => expect ( finishDecode ).toBeDefined () );
        setChartPaletteDragImage ( dataTransfer, icon );
        expect ( dataTransfer.setDragImage ).toHaveBeenLastCalledWith ( icon, 8, 8 );
        cleanup ();
        finishDecode?. ();
        await Promise.resolve ();
        setChartPaletteDragImage ( dataTransfer, icon );
        expect ( dataTransfer.setDragImage ).toHaveBeenLastCalledWith ( icon, 8, 8 );
    } );

    it ( "prepares all four glyphs and refreshes their baked colors when the palette theme changes", async () =>
    {
        const shell = document.createElement ( "div" );
        const palette = document.createElement ( "aside" );
        const icons = Array.from ( { length: 4 }, createIcon );

        shell.className = "application-shell";
        shell.append ( palette );
        palette.append ( ...icons );
        document.body.append ( shell );
        const cleanup = prepareChartPaletteDragImages ( palette );

        await vi.waitFor ( () => expect ( drawImage ).toHaveBeenCalledTimes ( 4 ) );
        await Promise.resolve ();
        icons.forEach ( icon => { icon.style.color = "rgb(1, 2, 3)"; } );
        shell.dataset [ "theme" ] = "light";
        await vi.waitFor ( () => expect ( drawImage ).toHaveBeenCalledTimes ( 8 ) );
        expect ( context.fillStyle ).toBe ( "rgb(1, 2, 3)" );
        cleanup ();
        icons.forEach ( icon => { icon.style.color = "rgb(4, 5, 6)"; } );
        await Promise.resolve ();
        expect ( drawImage ).toHaveBeenCalledTimes ( 8 );
    } );
} );

// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Palette Vector Icon Tests
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the palette-only artwork is inert, theme-compatible vector geometry with true curves
//   and diagonal edges instead of pixel-cell silhouettes.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const paletteIconNames = [
    "state-machine-state-chart-palette-state.svg",
    "state-machine-state-chart-palette-initial-state-indicator.svg",
    "state-machine-state-chart-palette-terminal-state-indicator.svg",
    "state-machine-state-chart-palette-transition.svg",
] as const;

//--------------------------------------------------------------------------------------------------
// Function: readPaletteIcon
//
// Description:
//
//   Parses the shipped palette artwork as XML rather than relying on a filename extension.
//
//--------------------------------------------------------------------------------------------------

async function readPaletteIcon ( name: string ): Promise<Document>
{
    const source = await readFile ( resolve ( "public/icons/custom/32", name ), "utf8" );

    return new DOMParser ().parseFromString ( source, "image/svg+xml" );
}

describe ( "Smooth palette vector assets", () =>
{
    it.each ( paletteIconNames ) ( "%s remains scalable, inert and theme-compatible", async name =>
    {
        const document = await readPaletteIcon ( name );
        const svg = document.documentElement;

        expect ( document.querySelector ( "parsererror" ) ).toBeNull ();
        expect ( svg.localName ).toBe ( "svg" );
        expect ( svg.getAttribute ( "viewBox" ) ).toBe ( "0 0 32 32" );
        expect ( svg.getAttribute ( "width" ) ).toBe ( "32" );
        expect ( svg.getAttribute ( "height" ) ).toBe ( "32" );
        expect ( svg.querySelector ( "image, foreignObject, script, use, style" ) ).toBeNull ();

        for ( const element of Array.from ( svg.querySelectorAll ( "*" ) ) )
        {
            expect ( [ "path", "circle", "rect" ] ).toContain ( element.localName );

            for ( const attribute of Array.from ( element.attributes ) )
            {
                expect ( attribute.name.toLowerCase ().startsWith ( "on" ) ).toBe ( false );
                expect ( [ "href", "xlink:href" ] ).not.toContain ( attribute.name );
            }

            for ( const attribute of [ "fill", "stroke" ] )
            {
                const value = element.getAttribute ( attribute );

                if ( value !== null )
                {
                    expect ( [ "none", "currentColor" ] ).toContain ( value );
                }
            }
        }
    } );

    it ( "uses continuous rounded and circular boundaries for states and UML indicators", async () =>
    {
        const state = await readPaletteIcon ( paletteIconNames [ 0 ] );
        const initial = await readPaletteIcon ( paletteIconNames [ 1 ] );
        const terminal = await readPaletteIcon ( paletteIconNames [ 2 ] );
        const rectangle = state.querySelector ( "rect" );
        const initialCircle = initial.querySelector ( "circle" );
        const terminalCircles = Array.from ( terminal.querySelectorAll ( "circle" ) );

        expect ( Number ( rectangle?.getAttribute ( "rx" ) ) ).toBeGreaterThan ( 0 );
        expect ( initialCircle?.getAttribute ( "fill" ) ).toBe ( "currentColor" );
        expect ( terminalCircles ).toHaveLength ( 2 );
        expect ( terminalCircles [ 0 ]?.getAttribute ( "fill" ) ).toBe ( "none" );
        expect ( terminalCircles [ 1 ]?.getAttribute ( "fill" ) ).toBe ( "currentColor" );
        expect ( Number ( terminalCircles [ 0 ]?.getAttribute ( "r" ) ) )
            .toBeGreaterThan ( Number ( terminalCircles [ 1 ]?.getAttribute ( "r" ) ) );
    } );

    it ( "uses one continuous diagonal arrowhead instead of staircase pixel runs", async () =>
    {
        const transition = await readPaletteIcon ( paletteIconNames [ 3 ] );
        const arrowhead = transition.querySelector ( 'path[fill="currentColor"]' );
        const commands = arrowhead?.getAttribute ( "d" ) ?? "";

        expect ( commands ).toMatch ( /L/u );
        expect ( commands.match ( /M/gu ) ).toHaveLength ( 1 );
        expect ( commands ).not.toMatch ( /[HV]/u );
    } );
} );

// @vitest-environment jsdom

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Splitter Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies that pointer resizing remains active while each movement re-renders the controlled
//   splitter.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";

import { Splitter } from "../../src/presentation/shared/Splitter.js";

afterEach ( cleanup );

//--------------------------------------------------------------------------------------------------
// Function: ControlledSplitter
//
// Description:
//
//   Renders the controlled splitter interface.
//
// Parameters:
//
//   None.
//
// Returns:
//
//   The rendered controlled splitter interface.
//
// Preconditions:
//
//   - None.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

function ControlledSplitter ()
{
    // Initialize the local values needed by this operation.

    const [ value, setValue ] = useState ( 200 );

    // Return the rendered interface.

    return (
        <div>
            <Splitter
                controls    = "leading"
                label       = "Resize panes"
                minimum     = { 120 }
                onChange    = { setValue }
                orientation = "horizontal"
                value       = { value }
            />
            <output aria-label="Current size">{ value }</output>
        </div>
    );
}

it ( "continues a pointer drag after controlled-value re-renders", () =>
{
    render ( <ControlledSplitter /> );

    const splitter = screen.getByRole ( "separator", { name: "Resize panes" } );

    Object.defineProperty ( splitter, "setPointerCapture", { configurable: true, value: () => undefined } );
    fireEvent.pointerDown ( splitter, { clientY: 100, pointerId: 7 } );
    fireEvent.pointerMove ( window, { clientY: 80, pointerId: 7 } );
    expect ( screen.getByRole ( "status", { name: "Current size" } ) ).toHaveTextContent ( "180" );
    fireEvent.pointerMove ( window, { clientY: 40, pointerId: 7 } );
    expect ( screen.getByRole ( "status", { name: "Current size" } ) ).toHaveTextContent ( "140" );
    fireEvent.pointerUp ( window, { clientY: 40, pointerId: 7 } );
    fireEvent.pointerMove ( window, { clientY: 20, pointerId: 7 } );
    expect ( screen.getByRole ( "status", { name: "Current size" } ) ).toHaveTextContent ( "140" );
} );

it ( "ends a pointer drag when pointer capture is lost", () =>
{
    render ( <ControlledSplitter /> );

    const splitter = screen.getByRole ( "separator", { name: "Resize panes" } );

    Object.defineProperty ( splitter, "setPointerCapture", { configurable: true, value: () => undefined } );
    fireEvent.pointerDown ( splitter, { clientY: 100, pointerId: 9 } );
    fireEvent.pointerMove ( window, { clientY: 80, pointerId: 9 } );
    expect ( screen.getByRole ( "status", { name: "Current size" } ) ).toHaveTextContent ( "180" );
    fireEvent.lostPointerCapture ( splitter, { pointerId: 9 } );
    fireEvent.pointerMove ( window, { clientY: 40, pointerId: 9 } );
    expect ( screen.getByRole ( "status", { name: "Current size" } ) ).toHaveTextContent ( "180" );
} );

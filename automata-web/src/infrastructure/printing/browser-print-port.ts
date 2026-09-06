// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Print Port
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Hands the already-rendered, isolated report surface to the browser-owned print dialog.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { PrintPort } from "../../application/ports/contracts.js";

//--------------------------------------------------------------------------------------------------
// Interface: PrintableWindow
//
// Description:
//
//   Defines the structure of printable window.
//
//--------------------------------------------------------------------------------------------------

interface PrintableWindow
{
    print (): void;
}

//--------------------------------------------------------------------------------------------------
// Class: BrowserPrintPort
//
// Description:
//
//   Defines the boundary used by browser print.
//
//--------------------------------------------------------------------------------------------------

export class BrowserPrintPort implements PrintPort
{
    //----------------------------------------------------------------------------------------------
    // Constructor: BrowserPrintPort
    //
    // Description:
    //
    //   Initializes a BrowserPrintPort instance.
    //
    // Parameters:
    //
    //   - browserWindow:
    //     The browser window supplied to the operation.
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

    public constructor ( private readonly browserWindow: PrintableWindow = window )
    {
    }

    //----------------------------------------------------------------------------------------------
    // Method: print
    //
    // Description:
    //
    //   Derives the print.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    public async print (): Promise<void>
    {
        this.browserWindow.print ();
    }
}

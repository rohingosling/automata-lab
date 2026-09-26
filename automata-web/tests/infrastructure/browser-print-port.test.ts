// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Print Port Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the single browser-owned print-dialog handoff boundary.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it, vi } from "vitest";

import { BrowserPrintPort } from "../../src/infrastructure/printing/browser-print-port.js";

describe ( "AL-PRN-003 browser print handoff", () =>
{
    it ( "delegates to the browser exactly once and resolves after the call returns", async () =>
    {
        // Initialize the local values needed by this operation.

        const print     = vi.fn ();
        const printPort = new BrowserPrintPort ( { print } );

        await expect ( printPort.print () ).resolves.toBeUndefined ();
        expect ( print ).toHaveBeenCalledOnce ();
    } );
} );

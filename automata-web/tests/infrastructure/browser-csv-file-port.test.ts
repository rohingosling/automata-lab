// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser CSV File Port Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies that browser CSV reads preflight their byte limit before allocating or decoding file
//   contents.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { MAXIMUM_FILE_BYTE_COUNT } from "../../src/domain/model/limits.js";
import { BrowserCsvFilePort } from "../../src/infrastructure/files/browser-csv-file-port.js";

//--------------------------------------------------------------------------------------------------
// Function: configureOpenFilePicker
//
// Description:
//
//   Configures the open file picker.
//
// Parameters:
//
//   - file:
//     The file supplied to the operation.
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

function configureOpenFilePicker ( file: File ): void
{
    // Initialize the local values needed by this operation.

    const fileHandle = {
        getFile: async () => file,
    } as unknown as FileSystemFileHandle;

    Object.defineProperty (
        window,
        "showOpenFilePicker",
        { configurable: true, value: vi.fn ( async () => [ fileHandle ] ) },
    );
}

afterEach ( () =>
{
    Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
    vi.restoreAllMocks ();
} );

describe ( "bounded browser CSV reads", () =>
{
    it ( "returns oversized file metadata without allocating or decoding its contents", async () =>
    {
        // Initialize the local values needed by this operation.

        const arrayBuffer = vi.fn ( async () => new ArrayBuffer ( 0 ) );
        const file        = {
            arrayBuffer,
            name: "oversized.csv",
            size: MAXIMUM_FILE_BYTE_COUNT + 1,
        } as unknown as File;

        configureOpenFilePicker ( file );

        const result = await new BrowserCsvFilePort ().openCsvFile ();

        expect ( arrayBuffer ).not.toHaveBeenCalled ();
        expect ( result ).toEqual ( {
            byteCount:   MAXIMUM_FILE_BYTE_COUNT + 1,
            displayName: "oversized.csv",
            text:        "",
        } );
    } );

    it ( "reads and decodes an ordinary file", async () =>
    {
        // Initialize the local values needed by this operation.

        const text        = "state_id,description\nstate_1,Ordinary\n";
        const bytes       = new TextEncoder ().encode ( text );
        const arrayBuffer = vi.fn ( async () => bytes.buffer );
        const file        = {
            arrayBuffer,
            name: "ordinary.csv",
            size: bytes.byteLength,
        } as unknown as File;

        configureOpenFilePicker ( file );

        const result = await new BrowserCsvFilePort ().openCsvFile ();

        expect ( arrayBuffer ).toHaveBeenCalledOnce ();
        expect ( result ).toEqual ( {
            byteCount:   bytes.byteLength,
            displayName: "ordinary.csv",
            text,
        } );
    } );
} );

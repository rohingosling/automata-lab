// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser File Port Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies bounded browser JSON reads and one-destination saves without manufactured backup
//   downloads.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanonicalSerializedDocument } from "../../src/domain/model/contracts.js";
import { MAXIMUM_FILE_BYTE_COUNT } from "../../src/domain/model/limits.js";
import { BrowserFilePort } from "../../src/infrastructure/files/browser-file-port.js";

const CURRENT_DOCUMENT: CanonicalSerializedDocument  = { text: "{\"revision\":2}" };
const PREVIOUS_DOCUMENT: CanonicalSerializedDocument = { text: "{\"revision\":1}" };

//--------------------------------------------------------------------------------------------------
// Function: recordDownloads
//
// Description:
//
//   Derives the record downloads.
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
//--------------------------------------------------------------------------------------------------

function recordDownloads (): string[]
{
    // Initialize the local values needed by this operation.

    const downloads: string[] = [];

    Object.defineProperty ( URL, "createObjectURL", { configurable: true, value: vi.fn ( () => "blob:test" ) } );
    Object.defineProperty ( URL, "revokeObjectURL", { configurable: true, value: vi.fn () } );
    vi.spyOn ( HTMLAnchorElement.prototype, "click" ).mockImplementation ( function ( this: HTMLAnchorElement )
    {
        downloads.push ( this.download );
    } );

    // Return the downloads.

    return downloads;
}

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
    Object.defineProperty ( window, "showSaveFilePicker", { configurable: true, value: undefined } );
    vi.restoreAllMocks ();
} );

describe ( "bounded browser JSON reads", () =>
{
    it ( "returns oversized file metadata without allocating or decoding its contents", async () =>
    {
        // Initialize the local values needed by this operation.

        const arrayBuffer = vi.fn ( async () => new ArrayBuffer ( 0 ) );
        const file        = {
            arrayBuffer,
            name: "oversized.json",
            size: MAXIMUM_FILE_BYTE_COUNT + 1,
        } as unknown as File;

        configureOpenFilePicker ( file );

        const result = await new BrowserFilePort ().openTextDocument ();

        expect ( arrayBuffer ).not.toHaveBeenCalled ();
        expect ( result ).toMatchObject ( {
            association: {
                capability:  "download",
                displayName: "oversized.json",
            },
            byteCount: MAXIMUM_FILE_BYTE_COUNT + 1,
            text:      "",
        } );
    } );

    it ( "reads and decodes an ordinary file", async () =>
    {
        // Initialize the local values needed by this operation.

        const text        = "{\"name\":\"ordinary\"}";
        const bytes       = new TextEncoder ().encode ( text );
        const arrayBuffer = vi.fn ( async () => bytes.buffer );
        const file        = {
            arrayBuffer,
            name: "ordinary.json",
            size: bytes.byteLength,
        } as unknown as File;

        configureOpenFilePicker ( file );

        const result = await new BrowserFilePort ().openTextDocument ();

        expect ( arrayBuffer ).toHaveBeenCalledOnce ();
        expect ( result ).toMatchObject ( {
            association: {
                capability:  "download",
                displayName: "ordinary.json",
            },
            byteCount: bytes.byteLength,
            text,
        } );
    } );
} );

describe ( "AL-DOC-003 streamlined browser saves", () =>
{
    it ( "writes an associated file handle without a backup download or second picker", async () =>
    {
        // Initialize the local values needed by this operation.

        const downloads                = recordDownloads ();
        const writtenContent: string[] = [];
        const fileHandle               = {
            createWritable: async () => ( {
                close: async () => undefined,
                write: async ( content: string ) =>
                {
                    writtenContent.push ( content );
                },
            } ),
            name: "model.json",
        } as unknown as FileSystemFileHandle;
        const showSaveFilePicker = vi.fn ( async () => fileHandle );

        Object.defineProperty ( window, "showSaveFilePicker", { configurable: true, value: showSaveFilePicker } );

        // Initialize the local values needed by this operation.

        const filePort  = new BrowserFilePort ();
        const firstSave = await filePort.saveTextDocument ( {
            association:      null,
            document:         PREVIOUS_DOCUMENT,
            previousDocument: null,
            saveBackup:       true,
            suggestedName:    "model.json",
        } );

        expect ( firstSave ).not.toBeNull ();

        const secondSave = await filePort.saveTextDocument ( {
            association:      firstSave?.association ?? null,
            document:         CURRENT_DOCUMENT,
            previousDocument: PREVIOUS_DOCUMENT,
            saveBackup:       true,
            suggestedName:    "model.json",
        } );

        expect ( showSaveFilePicker ).toHaveBeenCalledOnce ();
        expect ( downloads ).toEqual ( [] );
        expect ( writtenContent ).toEqual ( [ PREVIOUS_DOCUMENT.text, CURRENT_DOCUMENT.text ] );
        expect ( secondSave ).toMatchObject ( {
            backupStrategy: "none",
            limitation: expect.stringContaining ( "without another prompt" ),
        } );
    } );

    it ( "uses one current-file download when no save-file picker is available", async () =>
    {
        // Initialize the local values needed by this operation.

        const downloads = recordDownloads ();
        const filePort  = new BrowserFilePort ();
        const result    = await filePort.saveTextDocument ( {
            association:
            {
                capability:  "download",
                displayName: "model.json",
                identifier:  "download-association",
            },
            document:         CURRENT_DOCUMENT,
            previousDocument: PREVIOUS_DOCUMENT,
            saveBackup:       true,
            suggestedName:    "model.json",
        } );

        expect ( downloads ).toEqual ( [ "model.json" ] );
        expect ( result ).toMatchObject ( {
            backupStrategy: "none",
            limitation: expect.stringContaining ( "JSON file was saved normally" ),
        } );
    } );
} );

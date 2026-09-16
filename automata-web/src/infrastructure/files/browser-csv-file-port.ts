// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser CSV File Port
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Implements explicit UTF-8 CSV selection and save/download behavior without changing document
//   file association.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    CsvFilePort,
    CsvFileReadResult,
    CsvFileWriteRequest,
} from "../../application/ports/contracts.js";
import { MAXIMUM_FILE_BYTE_COUNT } from "../../domain/model/limits.js";

//--------------------------------------------------------------------------------------------------
// Interface: BrowserCsvFilePickerAcceptType
//
// Description:
//
//   Defines the structure of browser CSV file picker accept type.
//
//--------------------------------------------------------------------------------------------------

interface BrowserCsvFilePickerAcceptType
{
    readonly description?: string;
    readonly accept: Readonly <Record <string, readonly string[]>>;
}

const CSV_FILE_TYPES: readonly BrowserCsvFilePickerAcceptType[] =
[
    {
        description: "Comma-separated values",
        accept: { "text/csv": [ ".csv" ] },
    },
];

//--------------------------------------------------------------------------------------------------
// Function: isAbortError
//
// Description:
//
//   Determines whether abort error.
//
// Parameters:
//
//   - error:
//     The error supplied to the operation.
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

function isAbortError ( error: unknown ): boolean
{
    // Return the computed result.

    return error instanceof DOMException && error.name === "AbortError";
}

//--------------------------------------------------------------------------------------------------
// Function: decodeUtf8
//
// Description:
//
//   Decodes utf8.
//
// Parameters:
//
//   - bytes:
//     The bytes supplied to the operation.
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

function decodeUtf8 ( bytes: ArrayBuffer ): string
{
    // Return the decode result.

    return new TextDecoder ( "utf-8", { fatal: true } ).decode ( bytes );
}

//--------------------------------------------------------------------------------------------------
// Function: createCsvDownload
//
// Description:
//
//   Creates CSV download.
//
// Parameters:
//
//   - displayName:
//     The display name supplied to the operation.
//
//   - content:
//     The content supplied to the operation.
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

function createCsvDownload ( displayName: string, content: string ): void
{
    // Initialize the local values needed by this operation.

    const blob      = new Blob ( [ content ], { type: "text/csv;charset=utf-8" } );
    const objectUrl = URL.createObjectURL ( blob );
    const link      = document.createElement ( "a" );

    link.download = displayName;
    link.href     = objectUrl;
    link.click ();
    URL.revokeObjectURL ( objectUrl );
}

//--------------------------------------------------------------------------------------------------
// Function: chooseFallbackCsvFile
//
// Description:
//
//   Derives the choose fallback CSV file.
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

async function chooseFallbackCsvFile (): Promise<File | null>
{
    // Return the computed result.

    return new Promise ( resolve =>
    {
        // Initialize the local values needed by this operation.

        const input = document.createElement ( "input" );

        input.accept = ".csv,text/csv";
        input.type   = "file";
        input.addEventListener ( "change", () => resolve ( input.files?.item ( 0 ) ?? null ), { once: true } );
        input.click ();
    } );
}

//--------------------------------------------------------------------------------------------------
// Class: BrowserCsvFilePort
//
// Description:
//
//   Defines the boundary used by browser CSV file.
//
//--------------------------------------------------------------------------------------------------

export class BrowserCsvFilePort implements CsvFilePort
{
    //----------------------------------------------------------------------------------------------
    // Method: openCsvFile
    //
    // Description:
    //
    //   Opens the CSV file.
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

    public async openCsvFile (): Promise<CsvFileReadResult | null>
    {
        // Initialize the local values needed by this operation.

        let file: File;

        // Handle the case where window show open file picker differs from undefined.

        if ( window.showOpenFilePicker !== undefined )
        {
            // Run the operation that may report a recoverable failure.

            try
            {
                // Initialize the local values needed by this operation.

                const handles = await window.showOpenFilePicker (
                    {
                        excludeAcceptAllOption: false,
                        multiple:               false,
                        types:                  CSV_FILE_TYPES,
                    },
                );
                const handle = handles [ 0 ];

                // Handle the case where handle matches undefined.

                if ( handle === undefined )
                {
                    // Return the computed result.

                    return null;
                }

                file = await handle.getFile ();
            }
            catch ( error )
            {
                // Recover from the reported failure without hiding its outcome.

                if ( isAbortError ( error ) )
                {
                    // Return the computed result.

                    return null;
                }

                throw error;
            }
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            const selectedFile = await chooseFallbackCsvFile ();

            // Handle the case where selected file matches an absent value.

            if ( selectedFile === null )
            {
                // Return the computed result.

                return null;
            }

            file = selectedFile;
        }

        // Handle the case where file size exceeds maximum file byte count.

        if ( file.size > MAXIMUM_FILE_BYTE_COUNT )
        {
            // Return the assembled result.

            return {
                byteCount:   file.size,
                displayName: file.name,
                text:        "",
            };
        }

        // Return the assembled result.

        return {
            byteCount:   file.size,
            displayName: file.name,
            text:        decodeUtf8 ( await file.arrayBuffer () ),
        };
    }

    //----------------------------------------------------------------------------------------------
    // Method: saveCsvFile
    //
    // Description:
    //
    //   Saves the CSV file.
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
    //----------------------------------------------------------------------------------------------

    public async saveCsvFile ( request: CsvFileWriteRequest ): Promise<string | null>
    {
        // Handle the case where window show save file picker matches undefined.

        if ( window.showSaveFilePicker === undefined )
        {
            createCsvDownload ( request.suggestedName, request.text );

            // Return the computed result.

            return request.suggestedName;
        }

        let fileHandle: FileSystemFileHandle;

        // Run the operation that may report a recoverable failure.

        try
        {
            fileHandle = await window.showSaveFilePicker (
                {
                    excludeAcceptAllOption: false,
                    suggestedName:          request.suggestedName,
                    types:                  CSV_FILE_TYPES,
                },
            );
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            if ( isAbortError ( error ) )
            {
                // Return the computed result.

                return null;
            }

            throw error;
        }

        const writable = await fileHandle.createWritable ();

        await writable.write ( request.text );
        await writable.close ();

        // Return the computed result.

        return fileHandle.name;
    }
}

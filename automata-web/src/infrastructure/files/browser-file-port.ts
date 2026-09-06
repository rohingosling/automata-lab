// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser File Port
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Implements explicit JSON file selection, same-handle writes, and single-download fallback
//   behavior.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    FileAssociation,
    FilePort,
    FileReadResult,
    FileWriteRequest,
    FileWriteResult,
} from "../../application/ports/contracts.js";
import { MAXIMUM_FILE_BYTE_COUNT } from "../../domain/model/limits.js";

//--------------------------------------------------------------------------------------------------
// Interface: BrowserFilePickerAcceptType
//
// Description:
//
//   Defines the structure of browser file picker accept type.
//
//--------------------------------------------------------------------------------------------------

interface BrowserFilePickerAcceptType
{
    readonly description?: string;
    readonly accept: Readonly <Record <string, readonly string[]>>;
}

//--------------------------------------------------------------------------------------------------
// Interface: BrowserOpenFilePickerOptions
//
// Description:
//
//   Defines the options that control browser open file picker.
//
//--------------------------------------------------------------------------------------------------

interface BrowserOpenFilePickerOptions
{
    readonly excludeAcceptAllOption?: boolean;
    readonly multiple?:               boolean;
    readonly types?:                  readonly BrowserFilePickerAcceptType[];
}

//--------------------------------------------------------------------------------------------------
// Interface: BrowserSaveFilePickerOptions
//
// Description:
//
//   Defines the options that control browser save file picker.
//
//--------------------------------------------------------------------------------------------------

interface BrowserSaveFilePickerOptions
{
    readonly excludeAcceptAllOption?: boolean;
    readonly suggestedName?:          string;
    readonly types?:                  readonly BrowserFilePickerAcceptType[];
}

declare global
{
    //----------------------------------------------------------------------------------------------
    // Interface: Window
    //
    // Description:
    //
    //   Defines the structure of window.
    //
    //----------------------------------------------------------------------------------------------

    interface Window
    {
        showOpenFilePicker?: ( options?: BrowserOpenFilePickerOptions ) => Promise<readonly FileSystemFileHandle[]>;
        showSaveFilePicker?: ( options?: BrowserSaveFilePickerOptions ) => Promise<FileSystemFileHandle>;
    }
}

const JSON_FILE_TYPES: readonly BrowserFilePickerAcceptType[] =
[
    {
        description: "JSON files",
        accept: { "application/json": [ ".json" ] },
    },
];

//--------------------------------------------------------------------------------------------------
// Function: createAssociationIdentifier
//
// Description:
//
//   Creates association identifier.
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

function createAssociationIdentifier (): string
{
    // Return the random uuid result.

    return globalThis.crypto.randomUUID ();
}

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
// Function: createDownload
//
// Description:
//
//   Creates download.
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

function createDownload ( displayName: string, content: string ): void
{
    // Initialize the local values needed by this operation.

    const blob      = new Blob ( [ content ], { type: "application/json;charset=utf-8" } );
    const objectUrl = URL.createObjectURL ( blob );
    const link      = document.createElement ( "a" );

    link.download = displayName;
    link.href     = objectUrl;
    link.click ();
    URL.revokeObjectURL ( objectUrl );
}

//--------------------------------------------------------------------------------------------------
// Function: chooseFallbackFile
//
// Description:
//
//   Derives the choose fallback file.
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

async function chooseFallbackFile (): Promise<File | null>
{
    // Return the computed result.

    return new Promise ( resolve =>
    {
        // Initialize the local values needed by this operation.

        const input = document.createElement ( "input" );

        input.accept = ".json,application/json";
        input.type   = "file";
        input.addEventListener ( "change", () => resolve ( input.files?.item ( 0 ) ?? null ), { once: true } );
        input.click ();
    } );
}

//--------------------------------------------------------------------------------------------------
// Class: BrowserFilePort
//
// Description:
//
//   Defines the boundary used by browser file.
//
//--------------------------------------------------------------------------------------------------

export class BrowserFilePort implements FilePort
{
    readonly #handles = new Map <string, FileSystemFileHandle> ();

    //----------------------------------------------------------------------------------------------
    // Method: openTextDocument
    //
    // Description:
    //
    //   Opens the text document.
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

    public async openTextDocument (): Promise<FileReadResult | null>
    {
        // Initialize the local values needed by this operation.

        let file: File;
        let association: FileAssociation;

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
                        types:                  JSON_FILE_TYPES,
                    },
                );
                const handle = handles [ 0 ];

                // Handle the case where handle matches undefined.

                if ( handle === undefined )
                {
                    // Return the computed result.

                    return null;
                }

                const identifier = createAssociationIdentifier ();

                file        = await handle.getFile ();
                association = { identifier, displayName: file.name, capability: "download" };
                this.#handles.set ( identifier, handle );
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

            const selectedFile = await chooseFallbackFile ();

            // Handle the case where selected file matches an absent value.

            if ( selectedFile === null )
            {
                // Return the computed result.

                return null;
            }

            file        = selectedFile;
            association = {
                identifier:  createAssociationIdentifier (),
                displayName: file.name,
                capability:  "download",
            };
        }

        // Handle the case where file size exceeds maximum file byte count.

        if ( file.size > MAXIMUM_FILE_BYTE_COUNT )
        {
            // Return the assembled result.

            return {
                association,
                byteCount: file.size,
                text:      "",
            };
        }

        // Return the assembled result.

        return {
            association,
            byteCount: file.size,
            text:      decodeUtf8 ( await file.arrayBuffer () ),
        };
    }

    //----------------------------------------------------------------------------------------------
    // Method: saveTextDocument
    //
    // Description:
    //
    //   Saves the text document.
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

    public async saveTextDocument ( request: FileWriteRequest ): Promise<FileWriteResult | null>
    {
        // Initialize the local values needed by this operation.

        const associatedHandle = request.association === null
            ? undefined
            : this.#handles.get ( request.association.identifier );
        let association = request.association;
        let fileHandle  = associatedHandle;

        // Handle the case where all required conditions are satisfied.

        if ( association === null && window.showSaveFilePicker !== undefined )
        {
            // Run the operation that may report a recoverable failure.

            try
            {
                fileHandle = await window.showSaveFilePicker (
                    {
                        excludeAcceptAllOption: false,
                        suggestedName:          request.suggestedName,
                        types:                  JSON_FILE_TYPES,
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

            const identifier = createAssociationIdentifier ();

            association = { identifier, displayName: fileHandle.name, capability: "download" };
            this.#handles.set ( identifier, fileHandle );
        }

        // Initialize the local values needed by this operation.

        const displayName                                       = association?.displayName ?? request.suggestedName;
        const backupStrategy: FileWriteResult["backupStrategy"] = "none";
        let limitation: string | null                           = null;

        // Handle the case where all required conditions are satisfied.

        if ( request.saveBackup && request.previousDocument !== null )
        {
            limitation = "Save Backup was skipped because this browser cannot create a sibling .json.bak file " +
                "through the selected file handle without another prompt. The JSON file was saved normally.";
        }

        // Handle the case where file handle differs from undefined.

        if ( fileHandle !== undefined )
        {
            // Initialize the local values needed by this operation.

            const writable = await fileHandle.createWritable ();

            await writable.write ( request.document.text );
            await writable.close ();
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            createDownload ( displayName, request.document.text );
            association = association ?? {
                identifier: createAssociationIdentifier (),
                displayName,
                capability: "download",
            };
        }

        // Handle the case where association matches an absent value.

        if ( association === null )
        {
            throw new Error ( "The file adapter did not establish a destination association." );
        }

        // Return the assembled result.

        return { association, backupStrategy, limitation };
    }
}

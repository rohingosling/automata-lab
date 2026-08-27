// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Versioned Automata Lab File Codec
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Dispatches strict JSON through exact file identity, version, schema, mapping, and
//   semantic-validation stages.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ErrorObject } from "ajv";
import type
{
    AuthoringDraft,
    AutomataDocument,
    JsonValue,
} from "../../domain/model/contracts.js";
import type { DocumentCodecPort } from "../../application/ports/contracts.js";
import { decodeFileDocumentV1 } from "../../domain/model/canonicalization.js";
import type { DomainDiagnostic } from "../../domain/model/diagnostics.js";
import { FILE_IDENTIFIER, FILE_VERSION } from "../../domain/model/limits.js";
import { validateAuthoringDraft, validatePersistableAuthoringDraft } from "../../domain/model/validation.js";
import validateFileDocumentV1 from "./generated/file-schema-v1-validator.js";
import { parseStrictJson } from "./strict-json.js";

//--------------------------------------------------------------------------------------------------
// Type: FileOpenResult
//
// Description:
//
//   Describes the result produced by file open.
//
//--------------------------------------------------------------------------------------------------

export type FileOpenResult<DocumentType extends AuthoringDraft = AutomataDocument> =
    | {
        readonly isSuccessful: true;
        readonly document:     DocumentType;
        readonly diagnostics:  readonly DomainDiagnostic[];
    }
    | {
        readonly isSuccessful: false;
        readonly diagnostics:  readonly DomainDiagnostic[];
    };

//--------------------------------------------------------------------------------------------------
// Type: JsonObject
//
// Description:
//
//   Defines the JSON object type.
//
//--------------------------------------------------------------------------------------------------

type JsonObject = { readonly [ propertyName: string ]: JsonValue };

//--------------------------------------------------------------------------------------------------
// Type: VersionParser
//
// Description:
//
//   Defines the version parser type.
//
//--------------------------------------------------------------------------------------------------

type VersionParser<DocumentType extends AuthoringDraft> = ( value: JsonValue ) => FileOpenResult<DocumentType>;

//--------------------------------------------------------------------------------------------------
// Function: isJsonObject
//
// Description:
//
//   Determines whether JSON object.
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

function isJsonObject ( value: JsonValue ): value is JsonObject
{
    // Return the computed result.

    return typeof value === "object" && value !== null && !Array.isArray ( value );
}

//--------------------------------------------------------------------------------------------------
// Function: createErrorDiagnostic
//
// Description:
//
//   Creates error diagnostic.
//
// Parameters:
//
//   - code:
//     The code supplied to the operation.
//
//   - source:
//     The source supplied to the operation.
//
//   - message:
//     The message supplied to the operation.
//
//   - remediation:
//     The remediation supplied to the operation.
//
//   - path:
//     The path supplied to the operation.
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

function createErrorDiagnostic (
    code: string,
    source: string,
    message: string,
    remediation: string,
    path?: string,
): DomainDiagnostic
{
    // Initialize the local values needed by this operation.

    const diagnostic: DomainDiagnostic =
    {
        code,
        severity: "error",
        source,
        message,
        remediation,
    };

    // Return the result selected by the current condition.

    return path === undefined ? diagnostic : { ...diagnostic, path };
}

//--------------------------------------------------------------------------------------------------
// Function: ajvErrorToDiagnostic
//
// Description:
//
//   Derives the ajv error to diagnostic.
//
// Parameters:
//
//   - error:
//     The error supplied to the operation.
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

function ajvErrorToDiagnostic ( error: ErrorObject ): DomainDiagnostic
{
    // Initialize the local values needed by this operation.

    const path = error.instancePath.length === 0 ? "/" : error.instancePath;

    // Return the create error diagnostic result.

    return createErrorDiagnostic (
        "FILE_SCHEMA_INVALID",
        "schema",
        `${path} ${error.message ?? "does not satisfy the file schema"}.`,
        "Correct the reported property and try opening the file again.",
        path,
    );
}

//--------------------------------------------------------------------------------------------------
// Function: parseVersion1
//
// Description:
//
//   Parses version1.
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

function parseVersion1 ( value: JsonValue ): FileOpenResult
{
    // Handle the case where the validate file document v1 result condition is not satisfied.

    if ( !validateFileDocumentV1 ( value ) )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics: ( validateFileDocumentV1.errors ?? [] ).map ( ajvErrorToDiagnostic ),
        };
    }

    const draftValidation = validateAuthoringDraft ( decodeFileDocumentV1 ( value ) );

    // Handle the case where the draft validation is valid condition is not satisfied.

    if ( !draftValidation.isValid )
    {
        // Return the assembled result.

        return { isSuccessful: false, diagnostics: draftValidation.diagnostics };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        document:     draftValidation.document,
        diagnostics:  draftValidation.diagnostics,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: parseAuthoringVersion1
//
// Description:
//
//   Parses authoring version1.
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

function parseAuthoringVersion1 ( value: JsonValue ): FileOpenResult<AuthoringDraft>
{
    // Handle the case where the validate file document v1 result condition is not satisfied.

    if ( !validateFileDocumentV1 ( value ) )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics: ( validateFileDocumentV1.errors ?? [] ).map ( ajvErrorToDiagnostic ),
        };
    }

    const draftValidation = validatePersistableAuthoringDraft ( decodeFileDocumentV1 ( value ) );

    // Handle the case where the draft validation is valid condition is not satisfied.

    if ( !draftValidation.isValid )
    {
        // Return the assembled result.

        return { isSuccessful: false, diagnostics: draftValidation.diagnostics };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        document:     draftValidation.document,
        diagnostics:  draftValidation.diagnostics,
    };
}

const VERSION_PARSERS: ReadonlyMap<string, VersionParser<AutomataDocument>> = new Map (
    [
        [ FILE_VERSION, parseVersion1 ],
    ],
);

const AUTHORING_VERSION_PARSERS: ReadonlyMap<string, VersionParser<AuthoringDraft>> = new Map (
    [
        [ FILE_VERSION, parseAuthoringVersion1 ],
    ],
);

//--------------------------------------------------------------------------------------------------
// Function: openDocument
//
// Description:
//
//   Opens the document.
//
// Parameters:
//
//   - text:
//     The text supplied to the operation.
//
//   - versionParsers:
//     The version parsers supplied to the operation.
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

function openDocument<DocumentType extends AuthoringDraft> (
    text: string,
    versionParsers: ReadonlyMap<string, VersionParser<DocumentType>>,
): FileOpenResult<DocumentType>
{
    // Initialize the local values needed by this operation.

    const jsonResult = parseStrictJson ( text );

    // Handle the case where the JSON result is successful condition is not satisfied.

    if ( !jsonResult.isSuccessful )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                createErrorDiagnostic (
                    jsonResult.error.code,
                    "json",
                    jsonResult.error.message,
                    "Correct the JSON text and try opening the file again.",
                    `/@character/${jsonResult.error.position}`,
                ),
            ],
        };
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( !isJsonObject ( jsonResult.value ) || jsonResult.value [ "file_id" ] !== FILE_IDENTIFIER )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                createErrorDiagnostic (
                    "FILE_ID_INVALID",
                    "file",
                    `The file_id property must be '${FILE_IDENTIFIER}'.`,
                    "Choose an Automata Lab state-machine file.",
                    "/file_id",
                ),
            ],
        };
    }

    const fileVersion = jsonResult.value [ "file_version" ];

    // Handle the case where current value differs from the string value.

    if ( typeof fileVersion !== "string" )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                createErrorDiagnostic (
                    "FILE_VERSION_UNSUPPORTED",
                    "file",
                    "The file_version property is missing or is not a string.",
                    `Use the supported file version '${FILE_VERSION}'.`,
                    "/file_version",
                ),
            ],
        };
    }

    const versionParser = versionParsers.get ( fileVersion );

    // Handle the case where version parser matches undefined.

    if ( versionParser === undefined )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                createErrorDiagnostic (
                    "FILE_VERSION_UNSUPPORTED",
                    "file",
                    `File version '${fileVersion}' is not supported.`,
                    `Use the supported file version '${FILE_VERSION}' or an explicit future migration adapter.`,
                    "/file_version",
                ),
            ],
        };
    }

    // Return the version parser result.

    return versionParser ( jsonResult.value );
}

//--------------------------------------------------------------------------------------------------
// Function: openAutomataDocument
//
// Description:
//
//   Opens the automata document.
//
// Parameters:
//
//   - text:
//     The text supplied to the operation.
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

export function openAutomataDocument ( text: string ): FileOpenResult
{
    // Return the open document result.

    return openDocument ( text, VERSION_PARSERS );
}

//--------------------------------------------------------------------------------------------------
// Function: openAuthoringDocument
//
// Description:
//
//   Opens the authoring document.
//
// Parameters:
//
//   - text:
//     The text supplied to the operation.
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

export function openAuthoringDocument ( text: string ): FileOpenResult<AuthoringDraft>
{
    // Return the open document result.

    return openDocument ( text, AUTHORING_VERSION_PARSERS );
}

//--------------------------------------------------------------------------------------------------
// Class: AutomataDocumentCodec
//
// Description:
//
//   Implements the automata document codec behavior.
//
//--------------------------------------------------------------------------------------------------

export class AutomataDocumentCodec implements DocumentCodecPort
{
    //----------------------------------------------------------------------------------------------
    // Method: open
    //
    // Description:
    //
    //   Opens the requested value.
    //
    // Parameters:
    //
    //   - text:
    //     The text supplied to the operation.
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

    public open ( text: string ): FileOpenResult
    {
        // Return the open automata document result.

        return openAutomataDocument ( text );
    }
}

//--------------------------------------------------------------------------------------------------
// Class: AuthoringDocumentCodec
//
// Description:
//
//   Implements the authoring document codec behavior.
//
//--------------------------------------------------------------------------------------------------

export class AuthoringDocumentCodec implements DocumentCodecPort<AuthoringDraft>
{
    //----------------------------------------------------------------------------------------------
    // Method: open
    //
    // Description:
    //
    //   Opens the requested value.
    //
    // Parameters:
    //
    //   - text:
    //     The text supplied to the operation.
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

    public open ( text: string ): FileOpenResult<AuthoringDraft>
    {
        // Return the open authoring document result.

        return openAuthoringDocument ( text );
    }
}

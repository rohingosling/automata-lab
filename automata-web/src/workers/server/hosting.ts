// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Worker Model Hosting
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Validates, canonicalizes, hashes, and compiles a complete document before it can become the
//   hosted head.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ContentHashPort,
    DocumentCodecPort,
} from "../../application/ports/contracts.js";
import
{
    serializeCanonicalDocument,
    serializeCanonicalHostedContent,
} from "../../domain/model/canonicalization.js";
import type { DomainDiagnostic } from "../../domain/model/diagnostics.js";
import { MAXIMUM_FILE_BYTE_COUNT } from "../../domain/model/limits.js";
import { compileDocument } from "../../domain/runtime/runtime.js";
import type { HostedModelSnapshot } from "./repositories.js";

//--------------------------------------------------------------------------------------------------
// Function: isHostedModelRevision
//
// Description:
//
//   Determines whether hosted model revision.
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

function isHostedModelRevision ( value: string ): value is HostedModelSnapshot [ "modelRevision" ]
{
    // Return the test result.

    return /^sha256:[0-9a-f]{64}$/u.test ( value );
}

//--------------------------------------------------------------------------------------------------
// Interface: HostedModelStagingDependencies
//
// Description:
//
//   Defines the structure of hosted model staging dependencies.
//
//--------------------------------------------------------------------------------------------------

export interface HostedModelStagingDependencies
{
    readonly contentHasher: ContentHashPort;
    readonly documentCodec: DocumentCodecPort;
}

//--------------------------------------------------------------------------------------------------
// Type: HostedModelStagingResult
//
// Description:
//
//   Describes the result produced by hosted model staging.
//
//--------------------------------------------------------------------------------------------------

export type HostedModelStagingResult =
    | {
        readonly isSuccessful: true;
        readonly hostedModel:  HostedModelSnapshot;
    }
    | {
        readonly isSuccessful: false;
        readonly diagnostics:  readonly DomainDiagnostic[];
        readonly reason:       "DOCUMENT_INVALID" | "DOCUMENT_TOO_LARGE";
    };

//--------------------------------------------------------------------------------------------------
// Function: stageHostedModel
//
// Description:
//
//   Derives the stage hosted model.
//
// Parameters:
//
//   - documentText:
//     The document text supplied to the operation.
//
//   - dependencies:
//     The services required by the operation.
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

export async function stageHostedModel (
    documentText: string,
    dependencies: HostedModelStagingDependencies,
): Promise<HostedModelStagingResult>
{
    // Initialize the local values needed by this operation.

    const decodeResult = dependencies.documentCodec.open ( documentText );

    // Handle the case where the decode result is successful condition is not satisfied.

    if ( !decodeResult.isSuccessful )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:  decodeResult.diagnostics.map ( ( diagnostic ) => ( { ...diagnostic } ) ),
            reason:       "DOCUMENT_INVALID",
        };
    }

    const canonicalDocument = serializeCanonicalDocument ( decodeResult.document ).text;

    // Handle the case where byte length exceeds maximum file byte count.

    if ( new TextEncoder ().encode ( canonicalDocument ).byteLength > MAXIMUM_FILE_BYTE_COUNT )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                {
                    code:        "DOCUMENT_TOO_LARGE",
                    severity:    "error",
                    source:      "server",
                    message:     "The canonical hosted document exceeds the 5 MiB document limit.",
                    remediation: "Reduce the complete document before retrying Push.",
                },
            ],
            reason: "DOCUMENT_TOO_LARGE",
        };
    }

    // Initialize the local values needed by this operation.

    const semanticContent = serializeCanonicalHostedContent ( decodeResult.document );
    const modelRevision   = await dependencies.contentHasher.hashCanonicalText ( semanticContent );
    const compiledModel   = compileDocument ( decodeResult.document );

    // Handle the case where the is hosted model revision result condition is not satisfied.

    if ( !isHostedModelRevision ( modelRevision ) )
    {
        throw new Error ( "The content hasher returned an invalid hosted-model revision." );
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        hostedModel:
        {
            canonicalDocumentText: canonicalDocument,
            compiledModel,
            document: decodeResult.document,
            modelRevision,
        },
    };
}

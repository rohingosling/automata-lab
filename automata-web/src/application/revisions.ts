// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Hosted Revision Projection
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Creates immutable hosted snapshots through the content-hash port without coupling application
//   code to Web Crypto.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ContentHashPort } from "./ports/contracts.js";
import { serializeCanonicalHostedContent } from "../domain/model/canonicalization.js";
import type { AutomataDocument, HostedSnapshot } from "../domain/model/contracts.js";

//--------------------------------------------------------------------------------------------------
// Function: createHostedSnapshot
//
// Description:
//
//   Creates hosted snapshot.
//
// Parameters:
//
//   - document:
//     The document to process.
//
//   - contentHasher:
//     The content hasher supplied to the operation.
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

export async function createHostedSnapshot (
    document: AutomataDocument,
    contentHasher: ContentHashPort,
): Promise<HostedSnapshot>
{
    // Initialize the local values needed by this operation.

    const canonicalContent = serializeCanonicalHostedContent ( document );
    const modelRevision    = await contentHasher.hashCanonicalText ( canonicalContent );

    // Return the assembled result.

    return { document, modelRevision };
}

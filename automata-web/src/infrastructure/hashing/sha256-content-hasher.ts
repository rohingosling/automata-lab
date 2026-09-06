// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    SHA-256 Content Hasher
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Implements the application content-hash port with the browser and Node Web Crypto standard.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ContentHashPort } from "../../application/ports/contracts.js";

//--------------------------------------------------------------------------------------------------
// Class: Sha256ContentHasher
//
// Description:
//
//   Implements the sha256 content hasher behavior.
//
//--------------------------------------------------------------------------------------------------

export class Sha256ContentHasher implements ContentHashPort
{
    //----------------------------------------------------------------------------------------------
    // Method: hashCanonicalText
    //
    // Description:
    //
    //   Hashes the canonical text.
    //
    // Parameters:
    //
    //   - canonicalText:
    //     The canonical text supplied to the operation.
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

    public async hashCanonicalText ( canonicalText: string ): Promise<string>
    {
        // Initialize the local values needed by this operation.

        const contentBytes = new TextEncoder ().encode ( canonicalText );
        const digest       = await globalThis.crypto.subtle.digest ( "SHA-256", contentBytes );
        const hexadecimal  = [ ...new Uint8Array ( digest ) ]
            .map ( ( byte ) => byte.toString ( 16 ).padStart ( 2, "0" ) )
            .join ( "" );

        // Return the computed result.

        return `sha256:${hexadecimal}`;
    }
}

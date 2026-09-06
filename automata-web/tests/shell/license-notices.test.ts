// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    License Notice Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Keeps the shipped application license notice equal to the repository LICENSE.
//
//   The About dialog reads its license text from the notice files the artifact ships, so the
//   application's own notice is necessarily a second copy of the repository LICENSE -- the
//   repository root is outside the web package and cannot be served from it. Two copies of a
//   license that can drift are worse than one copy that cannot, so the equality is asserted rather
//   than trusted.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot    = resolve ( dirname ( fileURLToPath ( import.meta.url ) ), "../.." );
const repositoryRoot = resolve ( packageRoot, ".." );

// Line endings are normalized before comparison, so the check holds across platforms and checkout
// settings rather than failing on core.autocrlf.

//--------------------------------------------------------------------------------------------------
// Function: normalizedText
//
// Description:
//
//   Derives the normalized text.
//
// Parameters:
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

function normalizedText ( path: string ): string
{
    // Return the replace result.

    return readFileSync ( path, "utf8" ).replace ( /\r\n/gu, "\n" );
}

describe ( "bundled license notices", () =>
{
    it ( "ships an application notice identical to the repository LICENSE", () =>
    {
        expect (
            normalizedText ( resolve ( packageRoot, "public/notices/automata-lab.txt" ) ),
            "public/notices/automata-lab.txt no longer matches the repository LICENSE. The About dialog displays this "
            + "file, so the two must agree. Copy LICENSE over it rather than editing either one alone.",
        ).toBe ( normalizedText ( resolve ( repositoryRoot, "LICENSE" ) ) );
    } );

    it ( "ships a Fluent notice carrying its source, subset, and copyright", () =>
    {
        // Initialize the local values needed by this operation.

        const notice = normalizedText ( resolve ( packageRoot, "public/notices/fluent-ui-system-icons.txt" ) );

        expect ( notice ).toContain ( "https://github.com/microsoft/fluentui-system-icons" );
        expect ( notice ).toContain ( "Copyright (c) 2020 Microsoft Corporation" );
        expect ( notice ).toContain ( "MIT License" );
    } );

    it ( "ships the generated production runtime inventory and complete selected elkjs license", () =>
    {
        // Initialize the local values needed by this operation.

        const notice = normalizedText ( resolve ( packageRoot, "public/notices/third-party-runtime.txt" ) );

        expect ( notice ).toContain ( "Production closure package count: 27 (4 direct, 23 transitive)." );
        expect ( notice ).toContain ( "elkjs 0.12.0 declares 'EPL-2.0 OR GPL-3.0-or-later'." );
        expect ( notice ).toContain ( "Automata Lab distributes its included elkjs copy under the" );
        expect ( notice ).toContain ( "the project's distribution choice, not legal advice." );
        expect ( notice ).toContain ( "# Eclipse Public License - v 2.0" );
    } );
} );

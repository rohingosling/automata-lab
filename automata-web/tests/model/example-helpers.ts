// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Model Example Test Helpers
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Loads the maintained public example and versioned test fixtures through the same text boundary
//   used by file tests.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { readFileSync } from "node:fs";
import type { AutomataDocument } from "../../src/domain/model/contracts.js";
import { openAutomataDocument } from "../../src/infrastructure/files/file-codec.js";

//--------------------------------------------------------------------------------------------------
// Type: ExampleFileName
//
// Description:
//
//   Defines the supported example file name alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ExampleFileName =
    | "state-machine-comprehensive.json"
    | "state-machine-light-switch.json"
    | "state-machine-solver-candidate.json";

export const EXAMPLE_FILE_NAMES: readonly ExampleFileName[] =
[
    "state-machine-light-switch.json",
    "state-machine-comprehensive.json",
    "state-machine-solver-candidate.json",
];

//--------------------------------------------------------------------------------------------------
// Function: readExampleText
//
// Description:
//
//   Returns example text.
//
// Parameters:
//
//   - fileName:
//     The file name supplied to the operation.
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

export function readExampleText ( fileName: ExampleFileName ): string
{
    // Initialize the local values needed by this operation.

    const relativePath = fileName === "state-machine-light-switch.json"
        ? `../../../examples/${fileName}`
        : `../fixtures/${fileName}`;

    // Return the read file sync result.

    return readFileSync ( new URL ( relativePath, import.meta.url ), "utf8" );
}

//--------------------------------------------------------------------------------------------------
// Function: loadExampleDocument
//
// Description:
//
//   Loads example document.
//
// Parameters:
//
//   - fileName:
//     The file name supplied to the operation.
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

export function loadExampleDocument ( fileName: ExampleFileName ): AutomataDocument
{
    // Initialize the local values needed by this operation.

    const result = openAutomataDocument ( readExampleText ( fileName ) );

    // Handle the case where the result is successful condition is not satisfied.

    if ( !result.isSuccessful )
    {
        throw new Error ( `Example '${fileName}' failed validation: ${JSON.stringify ( result.diagnostics )}` );
    }

    // Return the computed result.

    return result.document;
}

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Test Global Setup
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Hosts the built artifact in-process so browser-test teardown is deterministic on Windows.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { preview } from "vite";

//--------------------------------------------------------------------------------------------------
// Function: globalSetup
//
// Description:
//
//   Derives the global setup.
//
// Parameters:
//
//   None.
//
// Returns:
//
//   A promise that resolves when the operation is complete.
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

export default async function globalSetup (): Promise <() => Promise <void>>
{
    // Initialize the local values needed by this operation.

    const previewServer = await preview (
        {
            preview:
            {
                host:       "127.0.0.1",
                port:       4_187,
                strictPort: true,
            },
        }
    );

    // Return the computed result.

    return async () => previewServer.close ();
}

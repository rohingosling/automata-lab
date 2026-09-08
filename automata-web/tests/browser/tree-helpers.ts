// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Test Tree Helpers
// Version: 1.0.0
// Date:    2026-08-20
// Author:  Rohin Gosling
//
// Description:
//
//   Opens the master tree's Editor node the way a user would.
//
//   Editor's children are hidden while Editor is closed, and Editor stays closed unless something
//   selects one of them. A command that merely navigates to Editor -- Open, New, Pull, the toolbar,
//   the View menu -- leaves the tree as the user left it. A test that reaches a child page through
//   the tree therefore opens Editor first.
//
//   Editor is opened by its disclosure control rather than by the keyboard, because navigation
//   focuses the detail heading on a zero-delay timer: a keyboard route taken while a document is
//   still arriving can lose the focus it just took before the key is delivered. Callers are still
//   responsible for waiting until whatever they invoked has landed.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

//--------------------------------------------------------------------------------------------------
// Function: openEditorNode
//
// Description:
//
//   Opens the editor node.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
// Returns:
//
//   A promise that resolves when the operation is complete.
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

export async function openEditorNode ( page: Page ): Promise<void>
{
    // Initialize the local values needed by this operation.

    const editorNode = page.getByRole ( "treeitem", { name: "Editor" } );

    // Handle the case where current value matches "true".

    if ( await editorNode.getAttribute ( "aria-expanded" ) === "true" )
    {
        // Return control to the caller.

        return;
    }

    await editorNode.locator ( ".tree-disclosure" ).click ();
    await expect ( editorNode ).toHaveAttribute ( "aria-expanded", "true" );
}

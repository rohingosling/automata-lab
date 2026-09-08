// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Test Setup
// Version: 1.0.0
// Date:    2026-08-06
// Author:  Rohin Gosling
//
// Description:
//
//   Installs DOM assertions and deterministic media-query behavior for shell unit tests.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import "@testing-library/jest-dom/vitest";

if ( typeof window !== "undefined" )
{
    Object.defineProperty (
        window,
        "matchMedia",
        {
            value: ( query: string ): MediaQueryList => ( {
                addEventListener: () => undefined,
                addListener: () => undefined,
                dispatchEvent: () => true,
                matches: false,
                media: query,
                onchange: null,
                removeEventListener: () => undefined,
                removeListener: () => undefined,
            } ),
            writable: true,
        }
    );

    //----------------------------------------------------------------------------------------------
    // Class: TestResizeObserver
    //
    // Description:
    //
    //   Implements the test resize observer behavior.
    //
    //----------------------------------------------------------------------------------------------

    class TestResizeObserver implements ResizeObserver
    {
        //------------------------------------------------------------------------------------------
        // Method: disconnect
        //
        // Description:
        //
        //   Disconnects the requested value.
        //
        // Parameters:
        //
        //   None.
        //
        // Returns:
        //
        //   No value is returned.
        //
        // Preconditions:
        //
        //   - None.
        //
        // Postconditions:
        //
        //   - The described side effects are complete when the callable returns.
        //
        //------------------------------------------------------------------------------------------

        public disconnect (): void
        {
        }

        //------------------------------------------------------------------------------------------
        // Method: observe
        //
        // Description:
        //
        //   Handles the observe behavior.
        //
        // Parameters:
        //
        //   None.
        //
        // Returns:
        //
        //   No value is returned.
        //
        // Preconditions:
        //
        //   - None.
        //
        // Postconditions:
        //
        //   - The described side effects are complete when the callable returns.
        //
        //------------------------------------------------------------------------------------------

        public observe (): void
        {
        }

        //------------------------------------------------------------------------------------------
        // Method: unobserve
        //
        // Description:
        //
        //   Handles the unobserve behavior.
        //
        // Parameters:
        //
        //   None.
        //
        // Returns:
        //
        //   No value is returned.
        //
        // Preconditions:
        //
        //   - None.
        //
        // Postconditions:
        //
        //   - The described side effects are complete when the callable returns.
        //
        //------------------------------------------------------------------------------------------

        public unobserve (): void
        {
        }
    }

    window.ResizeObserver = TestResizeObserver;
}

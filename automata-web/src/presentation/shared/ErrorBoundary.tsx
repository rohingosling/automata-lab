// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Error Boundary
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Prevents presentation failures from replacing the application with an unlabelled blank surface.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

//--------------------------------------------------------------------------------------------------
// Interface: ErrorBoundaryProperties
//
// Description:
//
//   Defines the properties accepted by the error boundary interface.
//
//--------------------------------------------------------------------------------------------------

interface ErrorBoundaryProperties
{
    readonly children: ReactNode;
    readonly heading:  string;
    readonly message:  string;
    readonly onError:  ( error: Error, errorInformation: ErrorInfo ) => void;
}

//--------------------------------------------------------------------------------------------------
// Interface: ErrorBoundaryState
//
// Description:
//
//   Defines the structure of error boundary state.
//
//--------------------------------------------------------------------------------------------------

interface ErrorBoundaryState
{
    readonly failed: boolean;
}

//--------------------------------------------------------------------------------------------------
// Class: ErrorBoundary
//
// Description:
//
//   Implements the error boundary behavior.
//
//--------------------------------------------------------------------------------------------------

export class ErrorBoundary extends Component <ErrorBoundaryProperties, ErrorBoundaryState>
{
    public override state: ErrorBoundaryState =
    {
        failed: false,
    };

    //----------------------------------------------------------------------------------------------
    // Method: getDerivedStateFromError
    //
    // Description:
    //
    //   Returns derived state from error.
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

    public static getDerivedStateFromError (): ErrorBoundaryState
    {
        // Return the assembled result.

        return { failed: true };
    }

    //----------------------------------------------------------------------------------------------
    // Method: componentDidCatch
    //
    // Description:
    //
    //   Handles the component did catch behavior.
    //
    // Parameters:
    //
    //   - error:
    //     The error supplied to the operation.
    //
    //   - errorInformation:
    //     The error information supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public override componentDidCatch ( error: Error, errorInformation: ErrorInfo ): void
    {
        this.props.onError ( error, errorInformation );
    }

    //----------------------------------------------------------------------------------------------
    // Method: render
    //
    // Description:
    //
    //   Derives the render.
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

    public override render (): ReactNode
    {
        // Handle the case where failed is enabled.

        if ( this.state.failed )
        {
            // Return the rendered interface.

            return (
                <main className="fatal-error" role="alert">
                    <h1>{ this.props.heading }</h1>
                    <p>{ this.props.message }</p>
                </main>
            );
        }

        // Return the computed result.

        return this.props.children;
    }
}

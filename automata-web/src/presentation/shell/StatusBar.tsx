// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Status Bar
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Renders the exact document, simulation, and server status sequence with non-color connection
//   cues.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { StatusBarViewModel } from "../../application/contracts";
import { text } from "../../localization/messages";

//--------------------------------------------------------------------------------------------------
// Interface: StatusBarProperties
//
// Description:
//
//   Defines the properties accepted by the status bar interface.
//
//--------------------------------------------------------------------------------------------------

interface StatusBarProperties
{
    readonly viewModel: StatusBarViewModel;
}

//--------------------------------------------------------------------------------------------------
// Function: valueOrNotAvailable
//
// Description:
//
//   Derives the value or not available.
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

function valueOrNotAvailable ( value: number | string | null ): string
{
    // Return the result selected by the current condition.

    return value === null ? text ( "status.notAvailable" ) : String ( value );
}

//--------------------------------------------------------------------------------------------------
// Function: StatusBar
//
// Description:
//
//   Renders the status bar interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered status bar interface.
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

export function StatusBar ( properties: StatusBarProperties )
{
    // Initialize the local values needed by this operation.

    const serverText = properties.viewModel.serverConnection === "Connected"
        ? text ( "status.connected" )
        : properties.viewModel.serverConnection === "Connecting"
            ? text ( "status.connecting" )
            : text ( "status.disconnected" );

    // Return the rendered interface.

    return (
        <footer aria-label={ text ( "status.label" ) } className="status-bar">
            <span>{ text ( "status.initialState" ) }: { valueOrNotAvailable ( properties.viewModel.initialState ) }</span>
            <span>{ text ( "status.states" ) }: { valueOrNotAvailable ( properties.viewModel.stateCount ) }</span>
            <span>{ text ( "status.events" ) }: { valueOrNotAvailable ( properties.viewModel.eventCount ) }</span>
            <span>{ text ( "status.actions" ) }: { valueOrNotAvailable ( properties.viewModel.actionCount ) }</span>
            <span>{ text ( "status.entryAssignments" ) }: { valueOrNotAvailable ( properties.viewModel.entryAssignmentCount ) }</span>
            <span>{ text ( "status.exitAssignments" ) }: { valueOrNotAvailable ( properties.viewModel.exitAssignmentCount ) }</span>
            <span>{ text ( "status.transitions" ) }: { valueOrNotAvailable ( properties.viewModel.transitionCount ) }</span>
            <span className={ `connection-status connection-${properties.viewModel.serverConnection.toLocaleLowerCase ()}` }>
                <span aria-hidden="true" className="connection-symbol">
                    { properties.viewModel.serverConnection === "Connected" ? "●" : "○" }
                </span>
                { text ( "status.server" ) }:{ " " }
                <span className={ `connection-value connection-value-${properties.viewModel.serverConnection.toLocaleLowerCase ()}` }>
                    { serverText }
                </span>
            </span>
            { properties.viewModel.contextualSegments.map ( segment => <span key={ segment }>{ segment }</span> ) }
        </footer>
    );
}

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Tabs
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Renders subordinate tabs with roving focus and automatic keyboard activation.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

//--------------------------------------------------------------------------------------------------
// Interface: TabDefinition
//
// Description:
//
//   Defines the structure of tab definition.
//
//--------------------------------------------------------------------------------------------------

export interface TabDefinition <TabIdentifier extends string>
{
    readonly identifier: TabIdentifier;
    readonly label:      string;
}

//--------------------------------------------------------------------------------------------------
// Interface: TabsProperties
//
// Description:
//
//   Defines the properties accepted by the tabs interface.
//
//--------------------------------------------------------------------------------------------------

interface TabsProperties <TabIdentifier extends string>
{
    readonly activeTab: TabIdentifier;
    readonly children:  ReactNode;
    readonly label:     string;
    readonly onSelect:  ( identifier: TabIdentifier ) => void;
    readonly tabs:      readonly TabDefinition <TabIdentifier>[];
}

//--------------------------------------------------------------------------------------------------
// Function: Tabs
//
// Description:
//
//   Renders the tabs interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered tabs interface.
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

export function Tabs <TabIdentifier extends string> ( properties: TabsProperties <TabIdentifier> )
{
    // Initialize the local values needed by this operation.

    const buttonReferences = useRef <Map <TabIdentifier, HTMLButtonElement>> ( new Map () );

    //----------------------------------------------------------------------------------------------
    // Function: selectTab
    //
    // Description:
    //
    //   Selects tab.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - index:
    //     The index supplied to the operation.
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

    function selectTab ( event: KeyboardEvent <HTMLButtonElement>, index: number ): void
    {
        // Initialize the local values needed by this operation.

        const normalizedIndex = ( index + properties.tabs.length ) % properties.tabs.length;
        const tab             = properties.tabs [ normalizedIndex ];

        // Handle the case where tab differs from undefined.

        if ( tab !== undefined )
        {
            event.preventDefault ();
            properties.onSelect ( tab.identifier );
            buttonReferences.current.get ( tab.identifier )?.focus ();
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleKeyDown
    //
    // Description:
    //
    //   Handles key down.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
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

    function handleKeyDown ( event: KeyboardEvent <HTMLButtonElement> ): void
    {
        // Initialize the local values needed by this operation.

        const currentIndex = properties.tabs.findIndex ( tab => tab.identifier === properties.activeTab );

        // Handle the case where event key matches the ArrowLeft value.

        if ( event.key === "ArrowLeft" )
        {
            selectTab ( event, currentIndex - 1 );
        }
        else if ( event.key === "ArrowRight" )
        {
            selectTab ( event, currentIndex + 1 );
        }
        else if ( event.key === "Home" || event.key === "End" )
        {
            selectTab ( event, event.key === "Home" ? 0 : properties.tabs.length - 1 );
        }
    }

    // Return the rendered interface.

    return (
        <section className="tabs">
            <div aria-label={ properties.label } className="tab-list" role="tablist">
                { properties.tabs.map (
                    tab =>
                    {
                        // Initialize the local values needed by this operation.

                        const selected = tab.identifier === properties.activeTab;

                        // Return the rendered interface.

                        return (
                            <button
                                aria-controls={ `${tab.identifier}-panel` }
                                aria-selected={ selected }
                                id        = { `${tab.identifier}-tab` }
                                key       = { tab.identifier }
                                onClick   = { () => properties.onSelect ( tab.identifier ) }
                                onKeyDown = { handleKeyDown }
                                ref       = { element =>
                                {
                                    // Handle the case where element matches an absent value.

                                    if ( element === null )
                                    {
                                        buttonReferences.current.delete ( tab.identifier );
                                    }
                                    else
                                    {
                                        // Handle the remaining case after the preceding condition
                                        // is false.

                                        buttonReferences.current.set ( tab.identifier, element );
                                    }
                                } }
                                role     = "tab"
                                tabIndex = { selected ? 0 : -1 }
                                type     = "button"
                            >
                                { tab.label }
                            </button>
                        );
                    }
                ) }
            </div>
            <div
                aria-labelledby={ `${properties.activeTab}-tab` }
                className = "tab-panel"
                id        = { `${properties.activeTab}-panel` }
                role      = "tabpanel"
                tabIndex  = { 0 }
            >
                { properties.children }
            </div>
        </section>
    );
}

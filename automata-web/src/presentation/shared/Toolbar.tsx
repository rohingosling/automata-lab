// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Toolbar
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Renders the fixed application command toolbar with roving focus, choice menus, and a
//   narrow-width overflow menu.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { text } from "../../localization/messages";
import { Icon } from "./Icon";
import type { MenuIcon } from "./MenuBar";

//--------------------------------------------------------------------------------------------------
// Interface: ToolbarChoice
//
// Description:
//
//   Defines the structure of toolbar choice.
//
//--------------------------------------------------------------------------------------------------

export interface ToolbarChoice
{
    readonly checked:    boolean;
    readonly identifier: string;
    readonly label:      string;
    readonly onSelect:   () => void;
}

//--------------------------------------------------------------------------------------------------
// Type: ToolbarEntry
//
// Description:
//
//   Defines the supported toolbar entry alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ToolbarEntry =
    | {
        readonly kind: "separator";
    }
    | {
        readonly kind:       "button";
        readonly identifier: string;
        readonly label:      string;
        readonly choices?:   readonly ToolbarChoice[];
        readonly disabled?:  boolean;
        readonly icon:       MenuIcon;
        readonly onSelect?:  () => void;
        readonly pressed?:   boolean;
    };

//--------------------------------------------------------------------------------------------------
// Interface: ToolbarProperties
//
// Description:
//
//   Defines the properties accepted by the toolbar interface.
//
//--------------------------------------------------------------------------------------------------

interface ToolbarProperties
{
    readonly entries: readonly ToolbarEntry[];
}

//--------------------------------------------------------------------------------------------------
// Function: Toolbar
//
// Description:
//
//   Renders the toolbar interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered toolbar interface.
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

export function Toolbar ( properties: ToolbarProperties )
{
    // Initialize the local values needed by this operation.

    const buttons = properties.entries.filter (
        ( entry ): entry is Extract <ToolbarEntry, { kind: "button" }> => entry.kind === "button"
    );
    const firstEnabledIdentifier = buttons.find ( button => button.disabled !== true )?.identifier ?? "";
    const [ activeIdentifier, setActiveIdentifier ]     = useState ( firstEnabledIdentifier );
    const [ openMenuIdentifier, setOpenMenuIdentifier ] = useState <string | null> ( null );
    const toolbarReference          = useRef <HTMLDivElement> ( null );
    const buttonReferences          = useRef <Map <string, HTMLButtonElement>> ( new Map () );
    const choiceReferences          = useRef <Map <string, HTMLButtonElement>> ( new Map () );
    const effectiveActiveIdentifier = buttons.some (
        button => button.identifier === activeIdentifier && button.disabled !== true
    )
        ? activeIdentifier
        : firstEnabledIdentifier;

    useEffect ( () =>
    {
        //------------------------------------------------------------------------------------------
        // Function: closeFromOutside
        //
        // Description:
        //
        //   Closes the from outside.
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
        //------------------------------------------------------------------------------------------

        function closeFromOutside ( event: PointerEvent ): void
        {
            // Handle the case where contains result differs from current value.

            if ( toolbarReference.current?.contains ( event.target as Node ) !== true )
            {
                setOpenMenuIdentifier ( null );
            }
        }

        document.addEventListener ( "pointerdown", closeFromOutside );

        // Return the computed result.

        return () => document.removeEventListener ( "pointerdown", closeFromOutside );
    }, [] );

    //----------------------------------------------------------------------------------------------
    // Function: openChoices
    //
    // Description:
    //
    //   Opens the choices.
    //
    // Parameters:
    //
    //   - entry:
    //     The entry supplied to the operation.
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

    function openChoices ( entry: Extract <ToolbarEntry, { kind: "button" }> ): void
    {
        // Handle the case where entry choices matches undefined.

        if ( entry.choices === undefined )
        {
            entry.onSelect?.();

            // Return control to the caller.

            return;
        }

        const opening = openMenuIdentifier !== entry.identifier;

        setOpenMenuIdentifier ( opening ? entry.identifier : null );

        // Handle the case where opening is enabled.

        if ( opening )
        {
            window.setTimeout ( () =>
            {
                // Initialize the local values needed by this operation.

                const selectedChoice = entry.choices?.find ( choice => choice.checked ) ?? entry.choices?.[ 0 ];

                // Handle the case where selected choice differs from undefined.

                if ( selectedChoice !== undefined )
                {
                    choiceReferences.current.get ( selectedChoice.identifier )?.focus ();
                }
            }, 0 );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleButtonKeyDown
    //
    // Description:
    //
    //   Handles button key down.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - entry:
    //     The entry supplied to the operation.
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

    function handleButtonKeyDown (
        event: KeyboardEvent <HTMLButtonElement>,
        entry: Extract <ToolbarEntry, { kind: "button" }>
    ): void
    {
        // Handle the case where all required conditions are satisfied.

        if ( event.key === "ArrowDown" && entry.choices !== undefined )
        {
            event.preventDefault ();
            openChoices ( entry );

            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const enabledButtons         = buttons.filter ( button => button.disabled !== true );
        const currentIndex           = enabledButtons.findIndex ( button => button.identifier === entry.identifier );
        let nextIndex: number | null = null;

        // Handle the case where event key matches the ArrowLeft value.

        if ( event.key === "ArrowLeft" )
        {
            nextIndex = currentIndex - 1;
        }
        else if ( event.key === "ArrowRight" )
        {
            nextIndex = currentIndex + 1;
        }
        else if ( event.key === "Home" )
        {
            nextIndex = 0;
        }
        else if ( event.key === "End" )
        {
            nextIndex = enabledButtons.length - 1;
        }

        // Handle the case where all required conditions are satisfied.

        if ( nextIndex !== null && enabledButtons.length > 0 )
        {
            event.preventDefault ();

            // Initialize the local values needed by this operation.

            const normalizedIndex = ( nextIndex + enabledButtons.length ) % enabledButtons.length;
            const nextButton      = enabledButtons [ normalizedIndex ];

            // Handle the case where next button differs from undefined.

            if ( nextButton !== undefined )
            {
                setOpenMenuIdentifier ( null );
                setActiveIdentifier ( nextButton.identifier );
                buttonReferences.current.get ( nextButton.identifier )?.focus ();
            }
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleChoiceKeyDown
    //
    // Description:
    //
    //   Handles choice key down.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - entry:
    //     The entry supplied to the operation.
    //
    //   - choiceIndex:
    //     The choice index supplied to the operation.
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

    function handleChoiceKeyDown (
        event: KeyboardEvent <HTMLButtonElement>,
        entry: Extract <ToolbarEntry, { kind: "button" }>,
        choiceIndex: number
    ): void
    {
        // Handle the case where event key matches the Escape value.

        if ( event.key === "Escape" )
        {
            event.preventDefault ();
            setOpenMenuIdentifier ( null );
            buttonReferences.current.get ( entry.identifier )?.focus ();

            // Return control to the caller.

            return;
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End" )
        {
            event.preventDefault ();
            let nextIndex = choiceIndex;

            // Handle the case where event key matches the ArrowDown value.

            if ( event.key === "ArrowDown" )
            {
                nextIndex = ( choiceIndex + 1 ) % ( entry.choices?.length ?? 1 );
            }
            else if ( event.key === "ArrowUp" )
            {
                nextIndex = ( choiceIndex - 1 + ( entry.choices?.length ?? 1 ) ) % ( entry.choices?.length ?? 1 );
            }
            else if ( event.key === "Home" )
            {
                nextIndex = 0;
            }
            else if ( event.key === "End" )
            {
                nextIndex = ( entry.choices?.length ?? 1 ) - 1;
            }

            const nextChoice = entry.choices?.[ nextIndex ];

            // Handle the case where next choice differs from undefined.

            if ( nextChoice !== undefined )
            {
                choiceReferences.current.get ( nextChoice.identifier )?.focus ();
            }
        }
    }

    // Return the rendered interface.

    return (
        <nav aria-label={ text ( "toolbar.label" ) } className="toolbar-landmark">
            <div aria-label={ text ( "toolbar.label" ) } className="toolbar" ref={ toolbarReference } role="toolbar">
                <div className="toolbar-main">
                { properties.entries.map ( ( entry, entryIndex ) =>
                {
                    // Handle the case where entry kind matches the separator value.

                    if ( entry.kind === "separator" )
                    {
                        // Return the rendered interface.

                        return <span aria-hidden="true" className="toolbar-separator" key={ `separator-${entryIndex}` } />;
                    }

                    const menuOpen = openMenuIdentifier === entry.identifier;

                    // Return the rendered interface.

                    return (
                        <div className="toolbar-entry" key={ entry.identifier }>
                            <button
                                aria-expanded={ entry.choices === undefined ? undefined : menuOpen }
                                aria-haspopup={ entry.choices === undefined ? undefined : "menu" }
                                aria-label={ entry.label }
                                aria-pressed={ entry.pressed }
                                className="toolbar-button"
                                data-toolbar-entry={ entry.identifier }
                                disabled  = { entry.disabled }
                                onClick   = { () => openChoices ( entry ) }
                                onFocus   = { () => setActiveIdentifier ( entry.identifier ) }
                                onKeyDown = { event => handleButtonKeyDown ( event, entry ) }
                                ref       = { element =>
                                {
                                    // Handle the case where element matches an absent value.

                                    if ( element === null )
                                    {
                                        buttonReferences.current.delete ( entry.identifier );
                                    }
                                    else
                                    {
                                        // Handle the remaining case after the preceding condition
                                        // is false.

                                        buttonReferences.current.set ( entry.identifier, element );
                                    }
                                } }
                                tabIndex = { effectiveActiveIdentifier === entry.identifier ? 0 : -1 }
                                title    = { entry.label }
                                type     = "button"
                            >
                                <Icon name={ entry.icon.name } source={ entry.icon.source } />
                            </button>
                            { menuOpen && entry.choices !== undefined && (
                                <div aria-label={ entry.label } className="toolbar-choice-menu" role="menu">
                                    { entry.choices.map ( ( choice, choiceIndex ) => (
                                        <button
                                            aria-checked={ choice.checked }
                                            key     = { choice.identifier }
                                            onClick = { () =>
                                            {
                                                choice.onSelect ();
                                                setOpenMenuIdentifier ( null );
                                                buttonReferences.current.get ( entry.identifier )?.focus ();
                                            } }
                                            onKeyDown = { event => handleChoiceKeyDown ( event, entry, choiceIndex ) }
                                            ref       = { element =>
                                            {
                                                // Handle the case where element matches an absent
                                                // value.

                                                if ( element === null )
                                                {
                                                    choiceReferences.current.delete ( choice.identifier );
                                                }
                                                else
                                                {
                                                    // Handle the remaining case after the preceding
                                                    // condition is false.

                                                    choiceReferences.current.set ( choice.identifier, element );
                                                }
                                            } }
                                            role = "menuitemradio"
                                            type = "button"
                                        >
                                            <span aria-hidden="true">{ choice.checked ? "✓" : "" }</span>
                                            <span>{ choice.label }</span>
                                        </button>
                                    ) ) }
                                </div>
                            ) }
                        </div>
                    );
                } ) }
                </div>
                <details className="toolbar-overflow">
                    <summary aria-label={ text ( "button.more" ) }>⋯</summary>
                    <div className="toolbar-overflow-menu">
                    { buttons.flatMap ( entry =>
                    {
                        // Handle the case where entry choices differs from undefined.

                        if ( entry.choices !== undefined )
                        {
                            // Return the mapped collection.

                            return entry.choices.map ( choice => (
                                <button
                                    aria-pressed={ choice.checked }
                                    key     = { choice.identifier }
                                    onClick = { choice.onSelect }
                                    type    = "button"
                                >
                                    <Icon name={ entry.icon.name } source={ entry.icon.source } />
                                    <span>{ entry.label }: { choice.label }</span>
                                </button>
                            ) );
                        }

                        // Return the assembled result collection.

                        return [
                            <button disabled={ entry.disabled } key={ entry.identifier } onClick={ entry.onSelect } type="button">
                                <Icon name={ entry.icon.name } source={ entry.icon.source } />
                                <span>{ entry.label }</span>
                            </button>,
                        ];
                    } ) }
                    </div>
                </details>
            </div>
        </nav>
    );
}

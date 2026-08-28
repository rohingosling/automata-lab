// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Menu Bar
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Renders the keyboard-operable desktop menu bar and nested menu choices.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import { Icon } from "./Icon";

//--------------------------------------------------------------------------------------------------
// Interface: MenuIcon
//
// Description:
//
//   Defines the structure of menu icon.
//
//--------------------------------------------------------------------------------------------------

export interface MenuIcon
{
    readonly name:   string;
    readonly source: "custom" | "fluent";
}

//--------------------------------------------------------------------------------------------------
// Type: MenuEntry
//
// Description:
//
//   Defines the supported menu entry alternatives.
//
//--------------------------------------------------------------------------------------------------

export type MenuEntry =
    | {
        readonly kind: "separator";
    }
    | {
        readonly kind:        "item";
        readonly identifier:  string;
        readonly label:       string;
        readonly checked?:    boolean;
        readonly children?:   readonly MenuEntry[];
        readonly disabled?:   boolean;
        readonly icon?:       MenuIcon;
        readonly onSelect?:   () => void;
        readonly shortcut?:   string;
    };

//--------------------------------------------------------------------------------------------------
// Interface: MenuDefinition
//
// Description:
//
//   Defines the structure of menu definition.
//
//--------------------------------------------------------------------------------------------------

export interface MenuDefinition
{
    readonly entries:    readonly MenuEntry[];
    readonly identifier: string;
    readonly label:      string;
}

//--------------------------------------------------------------------------------------------------
// Interface: MenuBarProperties
//
// Description:
//
//   Defines the properties accepted by the menu bar interface.
//
//--------------------------------------------------------------------------------------------------

interface MenuBarProperties
{
    readonly accessibleLabel: string;
    readonly menus:           readonly MenuDefinition[];
}

//--------------------------------------------------------------------------------------------------
// Interface: MenuPopupProperties
//
// Description:
//
//   Defines the properties accepted by the menu popup interface.
//
//--------------------------------------------------------------------------------------------------

interface MenuPopupProperties
{
    readonly entries:          readonly MenuEntry[];
    readonly menuIdentifier:   string;
    readonly nested?:          boolean;
    readonly onClose:          () => void;
    readonly onNavigateRoot?:  ( offset: number ) => void;
    readonly onOpenSubmenu:    ( submenuIdentifier: string | null ) => void;
    readonly onReturnFocus:    () => void;
    readonly onSelectComplete: () => void;
    readonly openSubmenu:      string | null;
}

//--------------------------------------------------------------------------------------------------
// Function: menuButtons
//
// Description:
//
//   Derives the menu buttons.
//
// Parameters:
//
//   - element:
//     The element supplied to the operation.
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

function menuButtons ( element: HTMLElement ): HTMLButtonElement[]
{
    // Return the filtered collection.

    return Array.from ( element.children )
        .map ( child => child instanceof HTMLButtonElement
            ? child
            : child.querySelector <HTMLButtonElement> ( ":scope > .menu-item" ) )
        .filter ( ( child ): child is HTMLButtonElement => child instanceof HTMLButtonElement && !child.disabled );
}

//--------------------------------------------------------------------------------------------------
// Function: focusRelativeItem
//
// Description:
//
//   Focuses the relative item.
//
// Parameters:
//
//   - event:
//     The event to process.
//
//   - offset:
//     The offset supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function focusRelativeItem ( event: KeyboardEvent <HTMLButtonElement>, offset: number ): void
{
    // Initialize the local values needed by this operation.

    const menu = event.currentTarget.closest <HTMLElement> ( "[role='menu']" );

    // Handle the case where menu matches an absent value.

    if ( menu === null )
    {
        // Return control to the caller.

        return;
    }

    // Initialize the local values needed by this operation.

    const buttons      = menuButtons ( menu );
    const currentIndex = buttons.indexOf ( event.currentTarget );
    const nextIndex    = ( currentIndex + offset + buttons.length ) % buttons.length;

    event.preventDefault ();
    buttons [ nextIndex ]?.focus ();
}

//--------------------------------------------------------------------------------------------------
// Function: MenuPopup
//
// Description:
//
//   Renders the menu popup interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered menu popup interface.
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

function MenuPopup ( properties: MenuPopupProperties )
{
    //----------------------------------------------------------------------------------------------
    // Function: handleItemKeyDown
    //
    // Description:
    //
    //   Handles item key down.
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

    function handleItemKeyDown (
        event: KeyboardEvent <HTMLButtonElement>,
        entry: Extract <MenuEntry, { kind: "item" }>
    ): void
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === "ArrowDown" || event.key === "ArrowUp" )
        {
            focusRelativeItem ( event, event.key === "ArrowDown" ? 1 : -1 );
        }
        else if ( event.key === "Home" || event.key === "End" )
        {
            // Initialize the local values needed by this operation.

            const menu    = event.currentTarget.closest <HTMLElement> ( "[role='menu']" );
            const buttons = menuButtons ( menu ?? document.body );

            event.preventDefault ();
            buttons [ event.key === "Home" ? 0 : buttons.length - 1 ]?.focus ();
        }
        else if ( properties.nested && ( event.key === "Escape" || event.key === "ArrowLeft" ) )
        {
            event.preventDefault ();
            properties.onOpenSubmenu ( null );
            properties.onReturnFocus ();
        }
        else if ( !properties.nested && event.key === "Escape" )
        {
            event.preventDefault ();
            properties.onClose ();
            properties.onReturnFocus ();
        }
        else if ( entry.children !== undefined && ( event.key === "ArrowRight" || event.key === "Enter" ) )
        {
            event.preventDefault ();
            properties.onOpenSubmenu ( entry.identifier );
            window.setTimeout ( () =>
            {
                // Initialize the local values needed by this operation.

                const submenu = document.getElementById ( `${entry.identifier}-submenu` );
                menuButtons ( submenu ?? document.body ) [ 0 ]?.focus ();
            }, 0 );
        }
        else if ( entry.children === undefined && ( event.key === "Enter" || event.key === " " ) )
        {
            event.preventDefault ();
            entry.onSelect?.();
            properties.onClose ();
            properties.onSelectComplete ();
        }
        else if ( !properties.nested && ( event.key === "ArrowRight" || event.key === "ArrowLeft" ) )
        {
            event.preventDefault ();
            properties.onNavigateRoot?.( event.key === "ArrowRight" ? 1 : -1 );
        }
        else if ( event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey )
        {
            // Initialize the local values needed by this operation.

            const menu            = event.currentTarget.closest <HTMLElement> ( "[role='menu']" );
            const buttons         = menuButtons ( menu ?? document.body );
            const searchCharacter = event.key.toLocaleLowerCase ();
            const currentIndex    = buttons.indexOf ( event.currentTarget );
            const candidates      = [ ...buttons.slice ( currentIndex + 1 ), ...buttons.slice ( 0, currentIndex + 1 ) ];
            const match           = candidates.find (
                button => button.textContent?.trim ().toLocaleLowerCase ().startsWith ( searchCharacter )
            );

            // Handle the case where match differs from undefined.

            if ( match !== undefined )
            {
                event.preventDefault ();
                match.focus ();
            }
        }
    }

    // Return the rendered interface.

    return (
        <div
            aria-label={ properties.menuIdentifier }
            className = { properties.nested ? "menu-popup menu-popup-nested" : "menu-popup" }
            id        = { properties.nested ? `${properties.menuIdentifier}-submenu` : undefined }
            role      = "menu"
        >
            { properties.entries.map ( ( entry, entryIndex ) =>
            {
                // Handle the case where entry kind matches the separator value.

                if ( entry.kind === "separator" )
                {
                    // Return the rendered interface.

                    return <div className="menu-separator" key={ `separator-${entryIndex}` } role="separator" />;
                }

                // Initialize the local values needed by this operation.

                const hasChildren = entry.children !== undefined;
                const submenuOpen = properties.openSubmenu === entry.identifier;
                const role        = entry.checked === undefined ? "menuitem" : "menuitemradio";

                // Return the rendered interface.

                return (
                    <div className="menu-item-container" key={ entry.identifier } role="none">
                        <button
                            aria-checked={ entry.checked === undefined ? undefined : entry.checked }
                            aria-expanded={ hasChildren ? submenuOpen : undefined }
                            aria-haspopup={ hasChildren ? "menu" : undefined }
                            className="menu-item"
                            data-menu-entry={ entry.identifier }
                            disabled = { entry.disabled }
                            onClick  = { () =>
                            {
                                // Handle the case where has children is enabled.

                                if ( hasChildren )
                                {
                                    properties.onOpenSubmenu ( entry.identifier );
                                }
                                else
                                {
                                    // Handle the remaining case after the preceding condition is
                                    // false.

                                    entry.onSelect?.();
                                    properties.onClose ();
                                    properties.onSelectComplete ();
                                }
                            } }
                            onKeyDown    = { event => handleItemKeyDown ( event, entry ) }
                            onMouseEnter = { () =>
                            {
                                // Handle the case where has children is enabled.

                                if ( hasChildren )
                                {
                                    properties.onOpenSubmenu ( entry.identifier );
                                }
                                else if ( !properties.nested )
                                {
                                    properties.onOpenSubmenu ( null );
                                }
                            } }
                            role     = { role }
                            tabIndex = { -1 }
                            type     = "button"
                        >
                            <span aria-hidden="true" className="menu-checkmark">{ entry.checked ? "✓" : "" }</span>
                            <span className="menu-icon-slot">
                                { entry.icon !== undefined && <Icon name={ entry.icon.name } source={ entry.icon.source } /> }
                            </span>
                            <span className="menu-label">{ entry.label }</span>
                            <span aria-hidden="true" className="menu-shortcut">{ entry.shortcut ?? "" }</span>
                            <span aria-hidden="true" className="menu-arrow">{ hasChildren ? "▶" : "" }</span>
                        </button>
                        { hasChildren && submenuOpen && (
                            <MenuPopup
                                entries        = { entry.children ?? [] }
                                menuIdentifier = { entry.identifier }
                                nested
                                onClose       = { properties.onClose }
                                onOpenSubmenu = { properties.onOpenSubmenu }
                                onReturnFocus = { () => document.querySelector <HTMLButtonElement> (
                                    `[data-menu-entry='${entry.identifier}']`
                                )?.focus () }
                                onSelectComplete = { properties.onSelectComplete }
                                openSubmenu      = { null }
                            />
                        ) }
                    </div>
                );
            } ) }
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: MenuBar
//
// Description:
//
//   Renders the menu bar interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered menu bar interface.
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

export function MenuBar ( properties: MenuBarProperties )
{
    // Initialize the local values needed by this operation.

    const [ openMenu, setOpenMenu ]               = useState <string | null> ( null );
    const [ openSubmenu, setOpenSubmenu ]         = useState <string | null> ( null );
    const [ activeMenuIndex, setActiveMenuIndex ] = useState ( 0 );
    const rootReference        = useRef <HTMLDivElement> ( null );
    const menuButtonReferences = useRef <Map <string, HTMLButtonElement>> ( new Map () );

    //----------------------------------------------------------------------------------------------
    // Function: closeMenus
    //
    // Description:
    //
    //   Closes the menus.
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
    //----------------------------------------------------------------------------------------------

    function closeMenus (): void
    {
        setOpenMenu ( null );
        setOpenSubmenu ( null );
    }

    //----------------------------------------------------------------------------------------------
    // Function: focusMenuButton
    //
    // Description:
    //
    //   Focuses the menu button.
    //
    // Parameters:
    //
    //   - menuIndex:
    //     The menu index supplied to the operation.
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

    function focusMenuButton ( menuIndex: number ): void
    {
        // Initialize the local values needed by this operation.

        const normalizedIndex = ( menuIndex + properties.menus.length ) % properties.menus.length;
        const menu            = properties.menus [ normalizedIndex ];

        // Handle the case where menu differs from undefined.

        if ( menu !== undefined )
        {
            setActiveMenuIndex ( normalizedIndex );
            menuButtonReferences.current.get ( menu.identifier )?.focus ();
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: openMenuAndFocusFirstItem
    //
    // Description:
    //
    //   Opens the menu and focus first item.
    //
    // Parameters:
    //
    //   - menu:
    //     The menu supplied to the operation.
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

    function openMenuAndFocusFirstItem ( menu: MenuDefinition ): void
    {
        setOpenMenu ( menu.identifier );
        setOpenSubmenu ( null );
        window.setTimeout ( () =>
        {
            // Initialize the local values needed by this operation.

            const menuElement = document.getElementById ( `${menu.identifier}-menu` )
                ?.querySelector <HTMLElement> ( "[role='menu']" );
            menuButtons ( menuElement ?? document.body ) [ 0 ]?.focus ();
        }, 0 );
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleMenuButtonKeyDown
    //
    // Description:
    //
    //   Handles menu button key down.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - menu:
    //     The menu supplied to the operation.
    //
    //   - menuIndex:
    //     The menu index supplied to the operation.
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

    function handleMenuButtonKeyDown (
        event: KeyboardEvent <HTMLButtonElement>,
        menu: MenuDefinition,
        menuIndex: number
    ): void
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === "ArrowRight" || event.key === "ArrowLeft" )
        {
            event.preventDefault ();
            focusMenuButton ( event.key === "ArrowRight" ? menuIndex + 1 : menuIndex - 1 );
        }
        else if ( event.key === "ArrowDown" || event.key === "Enter" || event.key === " " )
        {
            event.preventDefault ();
            openMenuAndFocusFirstItem ( menu );
        }
        else if ( event.key === "Escape" )
        {
            closeMenus ();
        }
    }

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

        function closeFromOutside ( event: globalThis.PointerEvent ): void
        {
            // Handle the case where the contains result condition is not satisfied.

            if ( !rootReference.current?.contains ( event.target as Node ) )
            {
                closeMenus ();
            }
        }

        //------------------------------------------------------------------------------------------
        // Function: focusMenuBar
        //
        // Description:
        //
        //   Focuses the menu bar.
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

        function focusMenuBar ( event: globalThis.KeyboardEvent ): void
        {
            // Handle the case where at least one branch condition is satisfied.

            if ( event.key === "F10" || event.key === "Alt" )
            {
                event.preventDefault ();
                closeMenus ();
                const activeMenu = properties.menus [ activeMenuIndex ];

                // Handle the case where active menu differs from undefined.

                if ( activeMenu !== undefined )
                {
                    menuButtonReferences.current.get ( activeMenu.identifier )?.focus ();
                }
            }
        }

        window.addEventListener ( "pointerdown", closeFromOutside );
        window.addEventListener ( "keydown", focusMenuBar );

        // Return the computed result.

        return () =>
        {
            window.removeEventListener ( "pointerdown", closeFromOutside );
            window.removeEventListener ( "keydown", focusMenuBar );
        };
    }, [ activeMenuIndex, properties.menus ] );

    // Return the rendered interface.

    return (
        <nav aria-label={ properties.accessibleLabel } className="menu-region">
            <div aria-label={ properties.accessibleLabel } className="menu-bar" ref={ rootReference } role="menubar">
                { properties.menus.map ( ( menu, menuIndex ) =>
                {
                    // Initialize the local values needed by this operation.

                    const menuOpen = openMenu === menu.identifier;

                    // Return the rendered interface.

                    return (
                        <div className="menu-root" key={ menu.identifier }>
                            <button
                                aria-controls={ `${menu.identifier}-menu` }
                                aria-expanded={ menuOpen }
                                aria-haspopup="menu"
                                className = "menu-root-button"
                                onClick   = { ( event: MouseEvent <HTMLButtonElement> ) =>
                                {
                                    event.stopPropagation ();
                                    setActiveMenuIndex ( menuIndex );
                                    setOpenMenu ( menuOpen ? null : menu.identifier );
                                    setOpenSubmenu ( null );
                                } }
                                onFocus      = { () => setActiveMenuIndex ( menuIndex ) }
                                onKeyDown    = { event => handleMenuButtonKeyDown ( event, menu, menuIndex ) }
                                onMouseEnter = { () =>
                                {
                                    // Handle the case where open menu differs from an absent value.

                                    if ( openMenu !== null )
                                    {
                                        setOpenMenu ( menu.identifier );
                                        setOpenSubmenu ( null );
                                    }
                                } }
                                ref={ element =>
                                {
                                    // Handle the case where element matches an absent value.

                                    if ( element === null )
                                    {
                                        menuButtonReferences.current.delete ( menu.identifier );
                                    }
                                    else
                                    {
                                        // Handle the remaining case after the preceding condition
                                        // is false.

                                        menuButtonReferences.current.set ( menu.identifier, element );
                                    }
                                } }
                                role     = "menuitem"
                                tabIndex = { activeMenuIndex === menuIndex ? 0 : -1 }
                                type     = "button"
                            >
                                { menu.label }
                            </button>
                            { menuOpen && (
                                <div id={ `${menu.identifier}-menu` }>
                                    <MenuPopup
                                        entries        = { menu.entries }
                                        menuIdentifier = { menu.label }
                                        onClose        = { closeMenus }
                                        onNavigateRoot = { offset =>
                                        {
                                            // Initialize the local values needed by this operation.

                                            const nextIndex = ( menuIndex + offset + properties.menus.length )
                                                % properties.menus.length;
                                            const nextMenu = properties.menus [ nextIndex ];

                                            // Handle the case where next menu differs from
                                            // undefined.

                                            if ( nextMenu !== undefined )
                                            {
                                                setActiveMenuIndex ( nextIndex );
                                                openMenuAndFocusFirstItem ( nextMenu );
                                            }
                                        } }
                                        onOpenSubmenu    = { setOpenSubmenu }
                                        onReturnFocus    = { () => menuButtonReferences.current.get ( menu.identifier )?.focus () }
                                        onSelectComplete = { () => menuButtonReferences.current.get ( menu.identifier )?.focus () }
                                        openSubmenu      = { openSubmenu }
                                    />
                                </div>
                            ) }
                        </div>
                    );
                } ) }
            </div>
        </nav>
    );
}

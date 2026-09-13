// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Navigation Tree
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Renders the exact tree-driven Automata Lab route hierarchy with the WAI-ARIA tree keyboard
//   model.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import type { ShellRoute } from "../../application/contracts";
import { text } from "../../localization/messages";
import type { MessageKey } from "../../localization/messages";
import { Icon } from "../shared/Icon";

//--------------------------------------------------------------------------------------------------
// Interface: NavigationTreeProperties
//
// Description:
//
//   Defines the properties accepted by the navigation tree interface.
//
//--------------------------------------------------------------------------------------------------

interface NavigationTreeProperties
{
    readonly activeRoute:      ShellRoute;
    readonly editorExpanded:   boolean;
    readonly onExpandedChange: ( expanded: boolean ) => void;
    readonly onSelect:         ( route: ShellRoute, focusPage: boolean ) => void;
}

//--------------------------------------------------------------------------------------------------
// Interface: TreeNode
//
// Description:
//
//   Defines the structure of tree node.
//
//--------------------------------------------------------------------------------------------------

interface TreeNode
{
    readonly iconName:   string;
    readonly labelKey:   MessageKey;
    readonly level:      number;
    readonly parent?:    ShellRoute;
    readonly route:      ShellRoute;
    readonly expandable: boolean;
}

const EDITOR_CHILDREN: readonly TreeNode[] = [
    {
        expandable: false,
        iconName: "state-machine-editor-state-machine.svg",
        labelKey: "tree.stateMachine",
        level: 2,
        parent: "editor",
        route: "stateMachine",
    },
    {
        expandable: false,
        iconName: "state-machine-editor-states.svg",
        labelKey: "tree.states",
        level: 2,
        parent: "editor",
        route: "states",
    },
    {
        expandable: false,
        iconName: "state-machine-editor-events.svg",
        labelKey: "tree.events",
        level: 2,
        parent: "editor",
        route: "events",
    },
    {
        expandable: false,
        iconName: "state-machine-editor-actions.svg",
        labelKey: "tree.actions",
        level: 2,
        parent: "editor",
        route: "actions",
    },
    {
        expandable: false,
        iconName: "state-machine-editor-transition-table.svg",
        labelKey: "tree.transitionTable",
        level: 2,
        parent: "editor",
        route: "transitionTable",
    },
];

const ROOT_NODES: readonly TreeNode[] = [
    {
        expandable: true,
        iconName: "state-machine-editor.svg",
        labelKey: "tree.editor",
        level: 1,
        route: "editor",
    },
    {
        expandable: false,
        iconName: "state-machine-state-chart.svg",
        labelKey: "tree.chart",
        level: 1,
        route: "chart",
    },
    {
        expandable: false,
        iconName: "state-machine-solver.svg",
        labelKey: "tree.solver",
        level: 1,
        route: "solver",
    },
    {
        expandable: false,
        iconName: "state-machine-simulator.svg",
        labelKey: "tree.simulator",
        level: 1,
        route: "simulator",
    },
];

//--------------------------------------------------------------------------------------------------
// Function: NavigationTree
//
// Description:
//
//   Renders the navigation tree interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered navigation tree interface.
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

export function NavigationTree ( properties: NavigationTreeProperties )
{
    // Initialize the local values needed by this operation.

    const [ focusedRoute, setFocusedRoute ] = useState <ShellRoute> ( "solver" );
    const nodeReferences = useRef <Map <ShellRoute, HTMLDivElement>> ( new Map () );
    const visibleNodes   = useMemo ( () =>
    {
        // Initialize the local values needed by this operation.

        const nodes: TreeNode[] = [];

        // Process each root node from the root nodes collection in order.

        for ( const rootNode of ROOT_NODES )
        {
            nodes.push ( rootNode );

            // Handle the case where all required conditions are satisfied.

            if ( rootNode.route === "editor" && properties.editorExpanded )
            {
                nodes.push ( ...EDITOR_CHILDREN );
            }
        }

        // Return the nodes.

        return nodes;
    }, [ properties.editorExpanded ] );

    //----------------------------------------------------------------------------------------------
    // Function: focusAndSelect
    //
    // Description:
    //
    //   Focuses the and select.
    //
    // Parameters:
    //
    //   - route:
    //     The route supplied to the operation.
    //
    //   - focusPage:
    //     The focus page supplied to the operation.
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

    function focusAndSelect ( route: ShellRoute, focusPage: boolean ): void
    {
        setFocusedRoute ( route );
        properties.onSelect ( route, focusPage );
        nodeReferences.current.get ( route )?.focus ();
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
    //   - node:
    //     The node supplied to the operation.
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

    function handleKeyDown ( event: KeyboardEvent <HTMLDivElement>, node: TreeNode ): void
    {
        // Initialize the local values needed by this operation.

        const nodeIndex = visibleNodes.findIndex ( candidate => candidate.route === node.route );

        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === "ArrowDown" || event.key === "ArrowUp" )
        {
            // Initialize the local values needed by this operation.

            const offset   = event.key === "ArrowDown" ? 1 : -1;
            const nextNode = visibleNodes [ Math.min ( visibleNodes.length - 1, Math.max ( 0, nodeIndex + offset ) ) ];

            // Handle the case where next node differs from undefined.

            if ( nextNode !== undefined )
            {
                event.preventDefault ();
                focusAndSelect ( nextNode.route, false );
            }
        }
        else if ( event.key === "Home" || event.key === "End" )
        {
            // Initialize the local values needed by this operation.

            const nextNode = event.key === "Home" ? visibleNodes [ 0 ] : visibleNodes.at ( -1 );

            // Handle the case where next node differs from undefined.

            if ( nextNode !== undefined )
            {
                event.preventDefault ();
                focusAndSelect ( nextNode.route, false );
            }
        }
        else if ( event.key === "ArrowRight" && node.route === "editor" )
        {
            event.preventDefault ();

            // Handle the case where properties editor expanded is enabled.

            if ( properties.editorExpanded )
            {
                // Initialize the local values needed by this operation.

                const firstChild = EDITOR_CHILDREN [ 0 ];

                // Handle the case where first child differs from undefined.

                if ( firstChild !== undefined )
                {
                    focusAndSelect ( firstChild.route, false );
                }
            }
            else
            {
                // Handle the remaining case after the preceding condition is false.

                properties.onExpandedChange ( true );
            }
        }
        else if ( event.key === "ArrowLeft" )
        {
            // Handle the case where all required conditions are satisfied.

            if ( node.route === "editor" && properties.editorExpanded )
            {
                event.preventDefault ();
                properties.onExpandedChange ( false );
            }
            else if ( node.parent !== undefined )
            {
                event.preventDefault ();
                focusAndSelect ( node.parent, false );
            }
        }
        else if ( event.key === "Enter" || event.key === " " )
        {
            event.preventDefault ();
            properties.onSelect ( node.route, true );
        }
        else if ( event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey )
        {
            // Initialize the local values needed by this operation.

            const searchCharacter = event.key.toLocaleLowerCase ();
            const candidates      = [ ...visibleNodes.slice ( nodeIndex + 1 ), ...visibleNodes.slice ( 0, nodeIndex + 1 ) ];
            const match           = candidates.find (
                candidate => text ( candidate.labelKey ).toLocaleLowerCase ().startsWith ( searchCharacter )
            );

            // Handle the case where match differs from undefined.

            if ( match !== undefined )
            {
                event.preventDefault ();
                focusAndSelect ( match.route, false );
            }
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: toggleEditorFromPointer
    //
    // Description:
    //
    //   Handles the toggle editor from pointer behavior.
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

    function toggleEditorFromPointer ( event: MouseEvent <HTMLSpanElement> ): void
    {
        event.stopPropagation ();
        properties.onExpandedChange ( !properties.editorExpanded );
    }

    // Return the rendered interface.

    return (
        <div aria-label={ text ( "panel.master.title" ) } className="navigation-tree" role="tree">
            { visibleNodes.map ( node =>
            {
                // Initialize the local values needed by this operation.

                const selected = node.route === properties.activeRoute;
                const focused  = node.route === focusedRoute;

                // Return the rendered interface.

                return (
                    <div
                        aria-expanded={ node.expandable ? properties.editorExpanded : undefined }
                        aria-level={ node.level }
                        aria-selected={ selected }
                        className={ selected ? "tree-row tree-row-selected" : "tree-row" }
                        data-route={ node.route }
                        key       = { node.route }
                        onClick   = { () => focusAndSelect ( node.route, false ) }
                        onKeyDown = { event => handleKeyDown ( event, node ) }
                        ref       = { element =>
                        {
                            // Handle the case where element matches an absent value.

                            if ( element === null )
                            {
                                nodeReferences.current.delete ( node.route );
                            }
                            else
                            {
                                // Handle the remaining case after the preceding condition is false.

                                nodeReferences.current.set ( node.route, element );
                            }
                        } }
                        role     = "treeitem"
                        style    = { { paddingInlineStart: `${8 + ( node.level - 1 ) * 18}px` } }
                        tabIndex = { focused ? 0 : -1 }
                    >
                        { node.expandable
                            ? (
                                <span
                                    aria-hidden="true"
                                    className = "tree-disclosure"
                                    onClick   = { toggleEditorFromPointer }
                                >
                                    { properties.editorExpanded ? "▾" : "▸" }
                                </span>
                            )
                            : <span aria-hidden="true" className="tree-disclosure-placeholder" /> }
                        <Icon
                            className = "tree-icon"
                            name      = { `16/${node.iconName}` }
                            source    = "custom"
                        />
                        <span>{ text ( node.labelKey ) }</span>
                    </div>
                );
            } ) }
        </div>
    );
}

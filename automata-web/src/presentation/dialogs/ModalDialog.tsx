// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Modal Dialog
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Provides shared modal focus containment, safe initial focus, cancellation, and invoker
//   restoration.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useLayoutEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";
import { text } from "../../localization/messages";

const FORM_LABEL_COLUMN_MARGIN_FACTOR = COMPILE_TIME_CONFIGURATION.dialog.formLayout.labelColumnMarginFactor;

//--------------------------------------------------------------------------------------------------
// Interface: ModalDialogProperties
//
// Description:
//
//   Defines the properties accepted by the modal dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface ModalDialogProperties
{
    readonly actions:               ReactNode;
    readonly children:              ReactNode;
    readonly className?:            string;
    readonly initialFocusSelector?: string;
    readonly onRequestClose:        () => void;
    readonly open:                  boolean;
    readonly title:                 string;
    readonly titleIdentifier:       string;
}

//--------------------------------------------------------------------------------------------------
// Function: focusableElements
//
// Description:
//
//   Derives the focusable elements.
//
// Parameters:
//
//   - dialog:
//     The dialog supplied to the operation.
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

function focusableElements ( dialog: HTMLDialogElement ): HTMLElement[]
{
    // Return the filtered collection.

    return Array.from ( dialog.querySelectorAll <HTMLElement> (
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), "
        + "a[href], [tabindex]:not([tabindex='-1'])"
    ) ).filter ( element => !element.hidden );
}

//--------------------------------------------------------------------------------------------------
// Function: isVisibleModalLabel
//
// Description:
//
//   Determines whether visible modal label.
//
// Parameters:
//
//   - label:
//     The label supplied to the operation.
//
//   - dialog:
//     The dialog supplied to the operation.
//
// Returns:
//
//   True when the named condition is satisfied; otherwise, false.
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

function isVisibleModalLabel ( label: HTMLElement, dialog: HTMLDialogElement ): boolean
{
    // Initialize the local values needed by this operation.

    let ancestor: HTMLElement | null = label;

    // Continue the operation while its terminating condition has not been reached.

    while ( ancestor !== null )
    {
        // Initialize the local values needed by this operation.

        const style = window.getComputedStyle ( ancestor );

        // Handle the case where at least one branch condition is satisfied.

        if ( ancestor.hidden || ancestor.getAttribute ( "aria-hidden" ) === "true" ||
            style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" )
        {
            // Return the computed result.

            return false;
        }

        // Handle the case where ancestor matches dialog.

        if ( ancestor === dialog )
        {
            break;
        }

        ancestor = ancestor.parentElement;
    }

    // Return the computed result.

    return ancestor === dialog;
}

//--------------------------------------------------------------------------------------------------
// Function: alignModalFormValues
//
// Description:
//
//   Aligns the modal form values.
//
// Parameters:
//
//   - dialog:
//     The dialog supplied to the operation.
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

function alignModalFormValues ( dialog: HTMLDialogElement ): void
{
    dialog.style.removeProperty ( "--form-label-column-width" );

    // Initialize the local values needed by this operation.

    const labels = Array.from ( dialog.querySelectorAll<HTMLElement> ( ".form-field-label-text" ) )
        .filter ( label => isVisibleModalLabel ( label, dialog ) );
    const labelWidths = labels.map ( label =>
    {
        // Initialize the local values needed by this operation.

        const measurement = label.cloneNode ( true ) as HTMLElement;

        measurement.style.display       = "block";
        measurement.style.inlineSize    = "max-content";
        measurement.style.maxInlineSize = "none";
        measurement.style.position      = "absolute";
        measurement.style.visibility    = "hidden";
        measurement.style.whiteSpace    = "nowrap";
        dialog.append ( measurement );
        const width = measurement.getBoundingClientRect ().width;

        measurement.remove ();

        // Return the width.

        return width;
    } );
    const longestLabelWidth = Math.max ( 0, ...labelWidths );

    // Handle the case where longest label width exceeds the 0 value.

    if ( longestLabelWidth > 0 )
    {
        dialog.style.setProperty (
            "--form-label-column-width",
            `${Math.ceil ( longestLabelWidth * FORM_LABEL_COLUMN_MARGIN_FACTOR )}px`,
        );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: ModalDialog
//
// Description:
//
//   Renders the modal dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered modal dialog interface.
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

export function ModalDialog ( properties: ModalDialogProperties )
{
    // Initialize the local values needed by this operation.

    const dialogReference  = useRef <HTMLDialogElement> ( null );
    const invokerReference = useRef <HTMLElement | null> ( null );
    const previouslyOpen   = useRef ( false );

    useLayoutEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const dialog = dialogReference.current;

        // Handle the case where all required conditions are satisfied.

        if ( properties.open && dialog !== null && dialog.hasAttribute ( "open" ) )
        {
            alignModalFormValues ( dialog );
        }
    } );

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const dialog = dialogReference.current;

        // Handle the case where dialog matches an absent value.

        if ( dialog === null )
        {
            // Return control to the caller.

            return;
        }

        // Handle the case where all required conditions are satisfied.

        if ( properties.open && !previouslyOpen.current )
        {
            invokerReference.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

            // Handle the case where current value matches the function value.

            if ( typeof dialog.showModal === "function" )
            {
                dialog.showModal ();
            }
            else
            {
                // Handle the remaining case after the preceding condition is false.

                dialog.setAttribute ( "open", "" );
            }

            alignModalFormValues ( dialog );

            const initialFocus = properties.initialFocusSelector === undefined
                ? focusableElements ( dialog ) [ 0 ]
                : dialog.querySelector <HTMLElement> ( properties.initialFocusSelector );
            initialFocus?.focus ();
        }
        else if ( !properties.open && previouslyOpen.current )
        {
            // Handle the case where all required conditions are satisfied.

            if ( dialog.open && typeof dialog.close === "function" )
            {
                dialog.close ();
            }
            else
            {
                // Handle the remaining case after the preceding condition is false.

                dialog.removeAttribute ( "open" );
            }

            window.setTimeout ( () => invokerReference.current?.focus (), 0 );
        }

        previouslyOpen.current = properties.open;
    }, [ properties.initialFocusSelector, properties.open ] );

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const dialog = dialogReference.current;

        // Handle the case where at least one branch condition is satisfied.

        if ( !properties.open || dialog === null )
        {
            // Return control to the caller.

            return;
        }

        //------------------------------------------------------------------------------------------
        // Function: alignValues
        //
        // Description:
        //
        //   Aligns the values.
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
        //------------------------------------------------------------------------------------------

        const alignValues = () => alignModalFormValues ( dialog );

        window.addEventListener ( "resize", alignValues );

        // Return the computed result.

        return () => window.removeEventListener ( "resize", alignValues );
    }, [ properties.open ] );

    //----------------------------------------------------------------------------------------------
    // Function: containFocus
    //
    // Description:
    //
    //   Handles the contain focus behavior.
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

    function containFocus ( event: KeyboardEvent <HTMLDialogElement> ): void
    {
        // Handle the case where event key differs from the Tab value.

        if ( event.key !== "Tab" )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const dialog    = event.currentTarget;
        const focusable = focusableElements ( dialog );
        const first     = focusable [ 0 ];
        const last      = focusable.at ( -1 );

        // Handle the case where at least one branch condition is satisfied.

        if ( first === undefined || last === undefined )
        {
            event.preventDefault ();

            // Return control to the caller.

            return;
        }

        // Handle the case where all required conditions are satisfied.

        if ( event.shiftKey && document.activeElement === first )
        {
            event.preventDefault ();
            last.focus ();
        }
        else if ( !event.shiftKey && document.activeElement === last )
        {
            event.preventDefault ();
            first.focus ();
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: closeFromBackdrop
    //
    // Description:
    //
    //   Closes the from backdrop.
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

    function closeFromBackdrop ( event: MouseEvent <HTMLDialogElement> ): void
    {
        // Handle the case where event target matches event current target.

        if ( event.target === event.currentTarget )
        {
            properties.onRequestClose ();
        }
    }

    // Return the rendered interface.

    return (
        <dialog
            aria-labelledby={ properties.titleIdentifier }
            className = { properties.className ?? "modal-dialog" }
            onCancel  = { event =>
            {
                event.preventDefault ();
                properties.onRequestClose ();
            } }
            onClick   = { closeFromBackdrop }
            onKeyDown = { containFocus }
            ref       = { dialogReference }
        >
            <div className="dialog-window">
                <header className="dialog-title-bar">
                    <h2 id={ properties.titleIdentifier }>{ properties.title }</h2>
                    <button
                        aria-label={ text ( "dialog.close.label" ) }
                        className = "dialog-close-button"
                        onClick   = { properties.onRequestClose }
                        type      = "button"
                    >
                        ×
                    </button>
                </header>
                <div className="dialog-content">{ properties.children }</div>
                <footer className="dialog-footer">{ properties.actions }</footer>
            </div>
        </dialog>
    );
}

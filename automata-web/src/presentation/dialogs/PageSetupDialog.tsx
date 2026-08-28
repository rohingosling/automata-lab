// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Page Setup Dialog
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Edits the application-owned paper, margin, orientation, and printable-section preferences
//   transactionally.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ChangeEvent } from "react";

import type { PrintPageSetup } from "../../application/printing.js";
import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";
import { text } from "../../localization/messages.js";
import { FormField, NumericField } from "../shared/SharedControls.js";
import { ModalDialog } from "./ModalDialog.js";

//--------------------------------------------------------------------------------------------------
// Interface: PageSetupDialogProperties
//
// Description:
//
//   Defines the properties accepted by the page setup dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface PageSetupDialogProperties
{
    readonly onApply:           ( pageSetup: PrintPageSetup ) => void;
    readonly onClose:           () => void;
    readonly onPageSetupChange: ( pageSetup: PrintPageSetup ) => void;
    readonly open:              boolean;
    readonly pageSetup:         PrintPageSetup;
}

const MARGIN_CONSTRAINTS = COMPILE_TIME_CONFIGURATION.applicationSettingConstraints.printing.marginMillimetres;

//--------------------------------------------------------------------------------------------------
// Interface: SectionOptionProperties
//
// Description:
//
//   Defines the properties accepted by the section option interface.
//
//--------------------------------------------------------------------------------------------------

interface SectionOptionProperties
{
    readonly checked:  boolean;
    readonly label:    string;
    readonly name:     string;
    readonly onChange: ( checked: boolean ) => void;
}

//--------------------------------------------------------------------------------------------------
// Function: SectionOption
//
// Description:
//
//   Renders the section option interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered section option interface.
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

function SectionOption ( properties: SectionOptionProperties )
{
    // Return the rendered interface.

    return (
        <label className="page-setup-section-option" htmlFor={ properties.name }>
            <input
                checked  = { properties.checked }
                id       = { properties.name }
                onChange = { event => properties.onChange ( event.currentTarget.checked ) }
                type     = "checkbox"
            />
            <span>{ properties.label }</span>
        </label>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: PageSetupDialog
//
// Description:
//
//   Renders the page setup dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered page setup dialog interface.
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

export function PageSetupDialog ( properties: PageSetupDialogProperties )
{
    //----------------------------------------------------------------------------------------------
    // Function: updatePageSetup
    //
    // Description:
    //
    //   Updates page setup.
    //
    // Parameters:
    //
    //   - partialPageSetup:
    //     The partial page setup supplied to the operation.
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

    function updatePageSetup ( partialPageSetup: Partial <PrintPageSetup> ): void
    {
        properties.onPageSetupChange ( { ...properties.pageSetup, ...partialPageSetup } );
    }

    //----------------------------------------------------------------------------------------------
    // Function: selectPaperSize
    //
    // Description:
    //
    //   Selects paper size.
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

    function selectPaperSize ( event: ChangeEvent <HTMLSelectElement> ): void
    {
        // Initialize the local values needed by this operation.

        const printPaperSize = event.currentTarget.value;

        // Handle the case where at least one branch condition is satisfied.

        if ( printPaperSize === "A4" || printPaperSize === "Legal" || printPaperSize === "Letter" )
        {
            updatePageSetup ( { printPaperSize } );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: selectOrientation
    //
    // Description:
    //
    //   Selects orientation.
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

    function selectOrientation ( event: ChangeEvent <HTMLSelectElement> ): void
    {
        // Initialize the local values needed by this operation.

        const printOrientation = event.currentTarget.value;

        // Handle the case where at least one branch condition is satisfied.

        if ( printOrientation === "Landscape" || printOrientation === "Portrait" )
        {
            updatePageSetup ( { printOrientation } );
        }
    }

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    <button onClick={ () => properties.onApply ( properties.pageSetup ) } type="button">
                        { text ( "button.apply" ) }
                    </button>
                </>
            }
            className            = "modal-dialog page-setup-dialog"
            initialFocusSelector = "#page-setup-paper-size"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( "pageSetup.title" ) }
            titleIdentifier      = "page-setup-dialog-title"
        >
            <fieldset className="page-setup-choice-group">
                <legend>{ text ( "pageSetup.paper" ) }</legend>
                <FormField label={ text ( "pageSetup.paperSize" ) } name="page-setup-paper-size">
                    <select
                        id       = "page-setup-paper-size"
                        onChange = { selectPaperSize }
                        value    = { properties.pageSetup.printPaperSize }
                    >
                        <option value="A4">{ text ( "pageSetup.paperSize.a4" ) }</option>
                        <option value="Letter">{ text ( "pageSetup.paperSize.letter" ) }</option>
                        <option value="Legal">{ text ( "pageSetup.paperSize.legal" ) }</option>
                    </select>
                </FormField>
                <FormField label={ text ( "pageSetup.orientation" ) } name="page-setup-orientation">
                    <select
                        id       = "page-setup-orientation"
                        onChange = { selectOrientation }
                        value    = { properties.pageSetup.printOrientation }
                    >
                        <option value="Portrait">{ text ( "pageSetup.orientation.portrait" ) }</option>
                        <option value="Landscape">{ text ( "pageSetup.orientation.landscape" ) }</option>
                    </select>
                </FormField>
            </fieldset>
            <fieldset className="page-setup-choice-group">
                <legend>{ text ( "pageSetup.margins" ) }</legend>
                <NumericField
                    decimalPlaces = { 1 }
                    label         = { text ( "pageSetup.margin.top" ) }
                    maximum       = { MARGIN_CONSTRAINTS.maximum }
                    minimum       = { MARGIN_CONSTRAINTS.minimum }
                    name          = "page-setup-margin-top"
                    onChange      = { printMarginTopMillimetres => updatePageSetup ( { printMarginTopMillimetres } ) }
                    value         = { properties.pageSetup.printMarginTopMillimetres }
                />
                <NumericField
                    decimalPlaces = { 1 }
                    label         = { text ( "pageSetup.margin.right" ) }
                    maximum       = { MARGIN_CONSTRAINTS.maximum }
                    minimum       = { MARGIN_CONSTRAINTS.minimum }
                    name          = "page-setup-margin-right"
                    onChange      = { printMarginRightMillimetres => updatePageSetup ( { printMarginRightMillimetres } ) }
                    value         = { properties.pageSetup.printMarginRightMillimetres }
                />
                <NumericField
                    decimalPlaces = { 1 }
                    label         = { text ( "pageSetup.margin.bottom" ) }
                    maximum       = { MARGIN_CONSTRAINTS.maximum }
                    minimum       = { MARGIN_CONSTRAINTS.minimum }
                    name          = "page-setup-margin-bottom"
                    onChange      = { printMarginBottomMillimetres => updatePageSetup ( { printMarginBottomMillimetres } ) }
                    value         = { properties.pageSetup.printMarginBottomMillimetres }
                />
                <NumericField
                    decimalPlaces = { 1 }
                    label         = { text ( "pageSetup.margin.left" ) }
                    maximum       = { MARGIN_CONSTRAINTS.maximum }
                    minimum       = { MARGIN_CONSTRAINTS.minimum }
                    name          = "page-setup-margin-left"
                    onChange      = { printMarginLeftMillimetres => updatePageSetup ( { printMarginLeftMillimetres } ) }
                    value         = { properties.pageSetup.printMarginLeftMillimetres }
                />
            </fieldset>
            <fieldset className="page-setup-choice-group page-setup-sections">
                <legend>{ text ( "pageSetup.sections" ) }</legend>
                <SectionOption
                    checked  = { properties.pageSetup.printIncludeModelSummary }
                    label    = { text ( "report.section.modelSummary" ) }
                    name     = "page-setup-section-model-summary"
                    onChange = { printIncludeModelSummary => updatePageSetup ( { printIncludeModelSummary } ) }
                />
                <SectionOption
                    checked  = { properties.pageSetup.printIncludeStates }
                    label    = { text ( "report.section.states" ) }
                    name     = "page-setup-section-states"
                    onChange = { printIncludeStates => updatePageSetup ( { printIncludeStates } ) }
                />
                <SectionOption
                    checked  = { properties.pageSetup.printIncludeEvents }
                    label    = { text ( "report.section.events" ) }
                    name     = "page-setup-section-events"
                    onChange = { printIncludeEvents => updatePageSetup ( { printIncludeEvents } ) }
                />
                <SectionOption
                    checked  = { properties.pageSetup.printIncludeActions }
                    label    = { text ( "report.section.actions" ) }
                    name     = "page-setup-section-actions"
                    onChange = { printIncludeActions => updatePageSetup ( { printIncludeActions } ) }
                />
                <SectionOption
                    checked  = { properties.pageSetup.printIncludeTransitionTable }
                    label    = { text ( "report.section.transitionTable" ) }
                    name     = "page-setup-section-transition-table"
                    onChange = { printIncludeTransitionTable => updatePageSetup ( { printIncludeTransitionTable } ) }
                />
                <SectionOption
                    checked  = { properties.pageSetup.printIncludeStateChart }
                    label    = { text ( "report.section.stateChart" ) }
                    name     = "page-setup-section-state-chart"
                    onChange = { printIncludeStateChart => updatePageSetup ( { printIncludeStateChart } ) }
                />
                <SectionOption
                    checked  = { properties.pageSetup.printIncludeChart }
                    label    = { text ( "report.section.chart" ) }
                    name     = "page-setup-section-chart"
                    onChange = { printIncludeChart => updatePageSetup ( { printIncludeChart } ) }
                />
                <SectionOption
                    checked  = { properties.pageSetup.printIncludeSolver }
                    label    = { text ( "report.section.solver" ) }
                    name     = "page-setup-section-solver"
                    onChange = { printIncludeSolver => updatePageSetup ( { printIncludeSolver } ) }
                />
                <SectionOption
                    checked  = { properties.pageSetup.printIncludeSimulator }
                    label    = { text ( "report.section.simulator" ) }
                    name     = "page-setup-section-simulator"
                    onChange = { printIncludeSimulator => updatePageSetup ( { printIncludeSimulator } ) }
                />
            </fieldset>
        </ModalDialog>
    );
}

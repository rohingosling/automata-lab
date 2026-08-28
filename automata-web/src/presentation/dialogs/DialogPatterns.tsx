// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Dialog Patterns
// Version: 1.1.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Implements reusable application dialog patterns for notices, confirmations, editing, and
//   sequence transfer.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useState } from "react";

import type
{
    ConsoleSeverity,
    DocumentCommandImpact,
    NamedEntityEditorValue,
    TransitionEditorValue,
} from "../../application/contracts";
import type { SimulatorSequence, SolverSequence, SolverStartContext } from "../../domain/model/contracts";
import type { DomainDiagnostic } from "../../domain/model/diagnostics";
import applicationLicense from "../../../public/notices/automata-lab.txt?raw";
import fluentIconLicense from "../../../public/notices/fluent-ui-system-icons.txt?raw";
import releaseNotes from "../../../public/release-notes.txt?raw";
import { text } from "../../localization/messages";
import { ProgressiveSelect } from "../shared/DropDownListBox";
import { FormField } from "../shared/SharedControls";
import { Icon } from "../shared/Icon";
import { Tabs } from "../shared/Tabs";
import { ModalDialog } from "./ModalDialog";

//--------------------------------------------------------------------------------------------------
// Interface: BasicDialogProperties
//
// Description:
//
//   Defines the properties accepted by the basic dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface BasicDialogProperties
{
    readonly onClose: () => void;
    readonly open:    boolean;
}

type AboutTabIdentifier = "about-licences" | "about-release-notes";

// Tall enough to read a paragraph of license text without the dialog outgrowing a modest window.
// Each control scrolls over its whole license rather than being sized to it.

const LICENSE_ROW_COUNT = 8;

//--------------------------------------------------------------------------------------------------
// Interface: LicenseNoticeProperties
//
// Description:
//
//   Defines the properties accepted by the license notice interface.
//
//--------------------------------------------------------------------------------------------------

interface LicenseNoticeProperties
{
    readonly identifier: string;
    readonly label:      string;
    readonly text:       string;
}

// A read-only text control rather than static markup: a license is something a user copies, and a
// text control comes with selection, keyboard scrolling, and a focus stop already correct.

//--------------------------------------------------------------------------------------------------
// Function: LicenseNotice
//
// Description:
//
//   Renders the license notice interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered license notice interface.
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

function LicenseNotice ( properties: LicenseNoticeProperties )
{
    // Initialize the local values needed by this operation.

    const titleIdentifier = `${properties.identifier}-title`;

    // Return the rendered interface.

    return (
        <section className="about-license">
            <h3 id={ titleIdentifier }>{ properties.label }</h3>
            <textarea
                aria-labelledby={ titleIdentifier }
                className = "about-license-text"
                id        = { properties.identifier }
                readOnly
                rows       = { LICENSE_ROW_COUNT }
                spellCheck = { false }
                value      = { properties.text }
            />
        </section>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: AboutDialog
//
// Description:
//
//   Renders the about dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered about dialog interface.
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

export function AboutDialog ( properties: BasicDialogProperties )
{
    // Initialize the local values needed by this operation.

    const [ activeTab, setActiveTab ] = useState <AboutTabIdentifier> ( "about-licences" );

    //----------------------------------------------------------------------------------------------
    // Function: closeDialog
    //
    // Description:
    //
    //   Closes the dialog and restores its default tab for the next opening.
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
    //   - The dialog requests closure with Licences selected for its next opening.
    //
    //----------------------------------------------------------------------------------------------

    function closeDialog (): void
    {
        setActiveTab ( "about-licences" );
        properties.onClose ();
    }

    // Return the rendered interface.

    return (
        <ModalDialog
            actions         = { <button onClick={ closeDialog } type="button">{ text ( "button.close" ) }</button> }
            className       = "modal-dialog about-dialog"
            onRequestClose  = { closeDialog }
            open            = { properties.open }
            title           = { text ( "dialog.about.title" ) }
            titleIdentifier = "about-dialog-title"
        >
            <div className="about-content">
                <Icon className="about-application-icon" name="40/state-machine-application.png" source="custom" />
                <div>
                    <strong>{ text ( "application.name" ) }</strong>
                    <span>{ text ( "application.version" ) }</span>
                </div>
            </div>
            <p>{ text ( "dialog.about.description" ) }</p>
            <Tabs
                activeTab = { activeTab }
                label     = { text ( "dialog.about.tabs.label" ) }
                onSelect  = { setActiveTab }
                tabs      = {
                    [
                        { identifier: "about-licences", label: text ( "dialog.about.tabs.licences" ) },
                        { identifier: "about-release-notes", label: text ( "dialog.about.tabs.releaseNotes" ) },
                    ]
                }
            >
                { activeTab === "about-licences"
                    ? (
                        <div className="about-licences">
                            <LicenseNotice
                                identifier = "about-application-license"
                                label      = { text ( "dialog.about.license.application" ) }
                                text       = { applicationLicense }
                            />
                            <LicenseNotice
                                identifier = "about-fluent-license"
                                label      = { text ( "dialog.about.license.fluent" ) }
                                text       = { fluentIconLicense }
                            />
                        </div>
                    )
                    : (
                        <div className="about-release-notes">
                            <LicenseNotice
                                identifier = "about-release-notes"
                                label      = { text ( "dialog.about.tabs.releaseNotes" ) }
                                text       = { releaseNotes }
                            />
                        </div>
                    ) }
            </Tabs>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: MessageDialogProperties
//
// Description:
//
//   Defines the properties accepted by the message dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface MessageDialogProperties extends BasicDialogProperties
{
    readonly body:          string;
    readonly onAcknowledge: () => void;
    readonly severity:      ConsoleSeverity;
}

//--------------------------------------------------------------------------------------------------
// Function: MessageDialog
//
// Description:
//
//   Renders the message dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered message dialog interface.
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

export function MessageDialog ( properties: MessageDialogProperties )
{
    // Initialize the local values needed by this operation.

    const title = properties.severity === "message"
        ? text ( "dialog.message.message" )
        : properties.severity === "warning"
            ? text ( "dialog.message.warning" )
            : text ( "dialog.message.error" );

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <button
                    onClick={ () =>
                    {
                        properties.onAcknowledge ();
                        properties.onClose ();
                    } }
                    type="button"
                >
                    { text ( "button.ok" ) }
                </button>
            }
            onRequestClose  = { properties.onClose }
            open            = { properties.open }
            title           = { title }
            titleIdentifier = "message-dialog-title"
        >
            <div className={ `message-dialog-body message-dialog-${properties.severity}` }>
                <span aria-hidden="true" className="severity-symbol">
                    { properties.severity === "message" ? "M" : properties.severity === "warning" ? "W" : "E" }
                </span>
                <p>{ properties.body }</p>
            </div>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: SimulatorModelDifferenceDialogProperties
//
// Description:
//
//   Defines the properties accepted by the simulator model difference dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface SimulatorModelDifferenceDialogProperties extends BasicDialogProperties
{
    readonly onPushAndStart:     () => void;
    readonly onStartWithoutPush: () => void;
}

//--------------------------------------------------------------------------------------------------
// Function: SimulatorModelDifferenceDialog
//
// Description:
//
//   Renders the simulator model difference dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered simulator model difference dialog interface.
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

export function SimulatorModelDifferenceDialog ( properties: SimulatorModelDifferenceDialogProperties )
{
    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onStartWithoutPush } type="button">
                        { text ( "button.startWithoutPushing" ) }
                    </button>
                    <button onClick={ properties.onPushAndStart } type="button">
                        { text ( "button.pushAndStartSession" ) }
                    </button>
                </>
            }
            initialFocusSelector = ".dialog-footer button:last-child"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( "dialog.simulatorModelDifference.title" ) }
            titleIdentifier      = "simulator-model-difference-dialog-title"
        >
            <div className="message-dialog-body message-dialog-warning">
                <span aria-hidden="true" className="severity-symbol">W</span>
                <p>{ text ( "dialog.simulatorModelDifference.description" ) }</p>
            </div>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Type: IncompleteDocumentWarningDialogProperties
//
// Description:
//
//   Defines the properties accepted by the incomplete document warning dialog interface.
//
//--------------------------------------------------------------------------------------------------

type IncompleteDocumentWarningDialogProperties = BasicDialogProperties & (
    | {
        readonly mode: "open";
    }
    | {
        readonly mode:         "save";
        readonly onSaveAnyway: () => void;
    }
);

//--------------------------------------------------------------------------------------------------
// Interface: IncompleteDocumentWarningContentProperties
//
// Description:
//
//   Defines the properties accepted by the incomplete document warning content interface.
//
//--------------------------------------------------------------------------------------------------

interface IncompleteDocumentWarningContentProperties
{
    readonly diagnostics: readonly DomainDiagnostic[];
    readonly mode:        "open" | "save";
}

//--------------------------------------------------------------------------------------------------
// Function: IncompleteDocumentWarningContent
//
// Description:
//
//   Renders the incomplete document warning content interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered incomplete document warning content interface.
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

function IncompleteDocumentWarningContent ( properties: IncompleteDocumentWarningContentProperties )
{
    // Return the rendered interface.

    return (
        <div className="message-dialog-body message-dialog-warning">
            <span aria-hidden="true" className="severity-symbol">W</span>
            <div className="incomplete-document-warning-content">
                <p>{ text ( properties.mode === "save"
                    ? "dialog.incompleteDocument.description.save"
                    : "dialog.incompleteDocument.description.open" ) }</p>
                <ul>
                    { properties.diagnostics.map ( diagnostic => (
                        <li key={ diagnostic.code }>
                            <span>{ diagnostic.message }</span>
                            <span>{ diagnostic.remediation }</span>
                        </li>
                    ) ) }
                </ul>
                <p>{ text ( "dialog.incompleteDocument.requirement" ) }</p>
            </div>
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: IncompleteDocumentWarningDialog
//
// Description:
//
//   Renders the incomplete document warning dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered incomplete document warning dialog interface.
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

export function IncompleteDocumentWarningDialog ( properties: IncompleteDocumentWarningDialogProperties & {
    readonly diagnostics: readonly DomainDiagnostic[];
} )
{
    // Initialize the local values needed by this operation.

    const saveMode = properties.mode === "save";

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                saveMode
                    ? (
                        <>
                            <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                            <button onClick={ properties.onSaveAnyway } type="button">
                                { text ( "button.saveAnyway" ) }
                            </button>
                        </>
                    )
                    : <button onClick={ properties.onClose } type="button">{ text ( "button.ok" ) }</button>
            }
            initialFocusSelector = ".dialog-footer button"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( saveMode
                ? "dialog.incompleteDocument.title.save"
                : "dialog.incompleteDocument.title.open" ) }
            titleIdentifier="incomplete-document-warning-dialog-title"
        >
            <IncompleteDocumentWarningContent diagnostics={ properties.diagnostics } mode={ properties.mode } />
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: TransitionCsvReferenceDialogProperties
//
// Description:
//
//   Defines the properties accepted by the transition CSV reference dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface TransitionCsvReferenceDialogProperties extends BasicDialogProperties
{
    readonly missingEvents: readonly string[];
    readonly missingStates: readonly string[];
}

//--------------------------------------------------------------------------------------------------
// Function: TransitionCsvReferenceDialog
//
// Description:
//
//   Renders the transition CSV reference dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered transition CSV reference dialog interface.
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

export function TransitionCsvReferenceDialog ( properties: TransitionCsvReferenceDialogProperties )
{
    //----------------------------------------------------------------------------------------------
    // Function: textAreaRows
    //
    // Description:
    //
    //   Derives the text area rows.
    //
    // Parameters:
    //
    //   - values:
    //     The values supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    function textAreaRows ( values: readonly string[] ): number
    {
        // Return the max result.

        return Math.max ( 2, Math.min ( 8, values.length ) );
    }

    // Return the rendered interface.

    return (
        <ModalDialog
            actions         = { <button onClick={ properties.onClose } type="button">{ text ( "button.ok" ) }</button> }
            onRequestClose  = { properties.onClose }
            open            = { properties.open }
            title           = { text ( "dialog.csvReferences.title" ) }
            titleIdentifier = "transition-csv-reference-dialog-title"
        >
            <p>{ text ( "dialog.csvReferences.description" ) }</p>
            <div className="csv-missing-reference-fields">
                <label htmlFor="transition-csv-missing-states">{ text ( "dialog.csvReferences.states" ) }</label>
                <textarea
                    id          = "transition-csv-missing-states"
                    placeholder = { text ( "dialog.csvReferences.none" ) }
                    readOnly
                    rows       = { textAreaRows ( properties.missingStates ) }
                    spellCheck = { false }
                    value      = { properties.missingStates.join ( "\n" ) }
                />
                <label htmlFor="transition-csv-missing-events">{ text ( "dialog.csvReferences.events" ) }</label>
                <textarea
                    id          = "transition-csv-missing-events"
                    placeholder = { text ( "dialog.csvReferences.none" ) }
                    readOnly
                    rows       = { textAreaRows ( properties.missingEvents ) }
                    spellCheck = { false }
                    value      = { properties.missingEvents.join ( "\n" ) }
                />
            </div>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: CsvImportConflictDialogProperties
//
// Description:
//
//   Defines the properties accepted by the CSV import conflict dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface CsvImportConflictDialogProperties extends BasicDialogProperties
{
    readonly conflictKeys: readonly string[];
    readonly onOverwrite:  () => void;
    readonly rowCount:     number;
    readonly transferName: string;
}

//--------------------------------------------------------------------------------------------------
// Function: CsvImportConflictDialog
//
// Description:
//
//   Renders the CSV import conflict dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered CSV import conflict dialog interface.
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

export function CsvImportConflictDialog ( properties: CsvImportConflictDialogProperties )
{
    // Initialize the local values needed by this operation.

    const displayedKeys  = properties.conflictKeys.slice ( 0, 10 );
    const remainingCount = properties.conflictKeys.length - displayedKeys.length;

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    <button onClick={ properties.onOverwrite } type="button">{ text ( "button.overwrite" ) }</button>
                </>
            }
            initialFocusSelector = ".dialog-footer button"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( "dialog.csvConflict.title" ) }
            titleIdentifier      = "csv-import-conflict-dialog-title"
        >
            <p>{ text ( "dialog.csvConflict.description" ) }</p>
            <p>{ `${properties.transferName}: ${properties.rowCount} row(s), ${properties.conflictKeys.length} conflict(s).` }</p>
            <ul className="csv-conflict-list">
                { displayedKeys.map ( conflictKey => <li key={ conflictKey }>{ conflictKey }</li> ) }
            </ul>
            { remainingCount > 0 && <p>{ `...and ${remainingCount} more conflict(s).` }</p> }
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: NamedEntityDialogProperties
//
// Description:
//
//   Defines the properties accepted by the named entity dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface NamedEntityDialogProperties extends BasicDialogProperties
{
    readonly initialValue: NamedEntityEditorValue;
    readonly onConfirm:    ( value: NamedEntityEditorValue ) => boolean | void;
}

//--------------------------------------------------------------------------------------------------
// Function: NamedEntityDialog
//
// Description:
//
//   Renders the named entity dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered named entity dialog interface.
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

export function NamedEntityDialog ( properties: NamedEntityDialogProperties )
{
    // Initialize the local values needed by this operation.

    const [ value, setValue ] = useState <NamedEntityEditorValue> ( properties.initialValue );

    //----------------------------------------------------------------------------------------------
    // Function: closeAndReset
    //
    // Description:
    //
    //   Closes the and reset.
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

    function closeAndReset (): void
    {
        setValue ( properties.initialValue );
        properties.onClose ();
    }

    const nameValid = value.name.trim ().length > 0;

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ closeAndReset } type="button">{ text ( "button.cancel" ) }</button>
                    <button
                        disabled = { !nameValid }
                        onClick  = { () =>
                        {
                            // Initialize the local values needed by this operation.

                            const confirmationAccepted = properties.onConfirm ( { ...value, name: value.name.trim () } );

                            // Handle the case where confirmation accepted differs from current
                            // value.

                            if ( confirmationAccepted !== false )
                            {
                                closeAndReset ();
                            }
                        } }
                        type="button"
                    >
                        { text ( "button.confirm" ) }
                    </button>
                </>
            }
            initialFocusSelector = "#entity-name"
            onRequestClose       = { closeAndReset }
            open                 = { properties.open }
            title                = { text ( "dialog.entity.title" ) }
            titleIdentifier      = "entity-dialog-title"
        >
            <p>{ text ( "dialog.entity.description" ) }</p>
            <FormField label={ text ( "dialog.entity.name" ) } name="entity-name">
                <input
                    id       = "entity-name"
                    onChange = { event => setValue ( { ...value, name: event.currentTarget.value } ) }
                    required
                    type  = "text"
                    value = { value.name }
                />
            </FormField>
            <FormField label={ text ( "field.description" ) } name="entity-description">
                <textarea
                    id       = "entity-description"
                    onChange = { event => setValue ( { ...value, description: event.currentTarget.value } ) }
                    value    = { value.description }
                />
            </FormField>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: SelectionDialogProperties
//
// Description:
//
//   Defines the properties accepted by the selection dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface SelectionDialogProperties extends BasicDialogProperties
{
    readonly description?:      string | undefined;
    readonly emptyMessage?:     string | undefined;
    readonly initialIdentifier?: string | undefined;
    readonly label?:            string | undefined;
    readonly onConfirm:          ( identifier: string ) => boolean | void;
    readonly options:            readonly { readonly identifier: string; readonly label: string }[];
    readonly title?:            string | undefined;
}

//--------------------------------------------------------------------------------------------------
// Function: SelectionDialog
//
// Description:
//
//   Renders the selection dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered selection dialog interface.
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

export function SelectionDialog ( properties: SelectionDialogProperties )
{
    // Initialize the local values needed by this operation.

    const [ selectedIdentifier, setSelectedIdentifier ] = useState ( properties.initialIdentifier ?? "" );
    const selectionLabel = properties.label ?? text ( "dialog.selection.label" );

    //----------------------------------------------------------------------------------------------
    // Function: closeAndReset
    //
    // Description:
    //
    //   Closes the and reset.
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

    function closeAndReset (): void
    {
        setSelectedIdentifier ( properties.initialIdentifier ?? "" );
        properties.onClose ();
    }

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ closeAndReset } type="button">{ text ( "button.cancel" ) }</button>
                    <button
                        disabled = { selectedIdentifier.length === 0 }
                        onClick  = { () =>
                        {
                            // Initialize the local values needed by this operation.

                            const confirmationAccepted = properties.onConfirm ( selectedIdentifier );

                            // Handle the case where confirmation accepted differs from current
                            // value.

                            if ( confirmationAccepted !== false )
                            {
                                closeAndReset ();
                            }
                        } }
                        type="button"
                    >
                        { text ( "button.confirm" ) }
                    </button>
                </>
            }
            initialFocusSelector = "#selection-entity"
            onRequestClose       = { closeAndReset }
            open                 = { properties.open }
            title                = { properties.title ?? text ( "dialog.selection.title" ) }
            titleIdentifier      = "selection-dialog-title"
        >
            { properties.description !== undefined && <p>{ properties.description }</p> }
            { properties.options.length === 0 && properties.emptyMessage !== undefined && <p>{ properties.emptyMessage }</p> }
            <FormField label={ selectionLabel } name="selection-entity">
                <ProgressiveSelect
                    identifier="selection-entity"
                    includeEmptyOption
                    key      = { String ( properties.open ) }
                    onChange = { setSelectedIdentifier }
                    options  = { properties.options.map ( option => ( {
                        label: option.label,
                        value: option.identifier,
                    } ) ) }
                    required
                    searchLabel = { `${text ( "shared.searchOptions" )}: ${selectionLabel}` }
                    value       = { selectedIdentifier }
                />
            </FormField>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: TransitionDialogProperties
//
// Description:
//
//   Defines the properties accepted by the transition dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface TransitionDialogProperties extends BasicDialogProperties
{
    readonly events:       readonly string[];
    readonly initialValue: TransitionEditorValue;
    readonly onConfirm:    ( value: TransitionEditorValue ) => boolean | void;
    readonly states:       readonly string[];
}

//--------------------------------------------------------------------------------------------------
// Function: TransitionDialog
//
// Description:
//
//   Renders the transition dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered transition dialog interface.
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

export function TransitionDialog ( properties: TransitionDialogProperties )
{
    // Initialize the local values needed by this operation.

    const [ value, setValue ] = useState <TransitionEditorValue> ( properties.initialValue );

    //----------------------------------------------------------------------------------------------
    // Function: closeAndReset
    //
    // Description:
    //
    //   Closes the and reset.
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

    function closeAndReset (): void
    {
        setValue ( properties.initialValue );
        properties.onClose ();
    }

    // Initialize the local values needed by this operation.

    const valueValid = properties.states.includes ( value.state ) &&
        properties.events.includes ( value.event ) && properties.states.includes ( value.stateNext );
    const stateOptions = properties.states.map ( state => ( { label: state, value: state } ) );
    const eventOptions = properties.events.map ( event => ( { label: event, value: event } ) );

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ closeAndReset } type="button">{ text ( "button.cancel" ) }</button>
                    <button
                        disabled = { !valueValid }
                        onClick  = { () =>
                        {
                            // Initialize the local values needed by this operation.

                            const confirmationAccepted = properties.onConfirm ( value );

                            // Handle the case where confirmation accepted differs from current
                            // value.

                            if ( confirmationAccepted !== false )
                            {
                                closeAndReset ();
                            }
                        } }
                        type="button"
                    >
                        { text ( "button.confirm" ) }
                    </button>
                </>
            }
            initialFocusSelector = "#transition-state"
            onRequestClose       = { closeAndReset }
            open                 = { properties.open }
            title                = { text ( "dialog.transition.title" ) }
            titleIdentifier      = "transition-dialog-title"
        >
            <FormField label={ text ( "field.state" ) } name="transition-state">
                <ProgressiveSelect
                    identifier="transition-state"
                    includeEmptyOption
                    key         = { String ( properties.open ) }
                    onChange    = { state => setValue ( { ...value, state } ) }
                    options     = { stateOptions }
                    searchLabel = { `${text ( "shared.searchOptions" )}: ${text ( "field.state" )}` }
                    value       = { value.state }
                />
            </FormField>
            <FormField label={ text ( "field.event" ) } name="transition-event">
                <ProgressiveSelect
                    identifier="transition-event"
                    includeEmptyOption
                    key         = { String ( properties.open ) }
                    onChange    = { event => setValue ( { ...value, event } ) }
                    options     = { eventOptions }
                    searchLabel = { `${text ( "shared.searchOptions" )}: ${text ( "field.event" )}` }
                    value       = { value.event }
                />
            </FormField>
            <FormField label={ text ( "field.nextState" ) } name="transition-next-state">
                <ProgressiveSelect
                    identifier="transition-next-state"
                    includeEmptyOption
                    key         = { String ( properties.open ) }
                    onChange    = { stateNext => setValue ( { ...value, stateNext } ) }
                    options     = { stateOptions }
                    searchLabel = { `${text ( "shared.searchOptions" )}: ${text ( "field.nextState" )}` }
                    value       = { value.stateNext }
                />
            </FormField>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: ImpactConfirmationDialogProperties
//
// Description:
//
//   Defines the properties accepted by the impact confirmation dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface ImpactConfirmationDialogProperties extends BasicDialogProperties
{
    readonly impact:    DocumentCommandImpact;
    readonly onConfirm: () => void;
}

//--------------------------------------------------------------------------------------------------
// Function: ImpactConfirmationDialog
//
// Description:
//
//   Renders the impact confirmation dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered impact confirmation dialog interface.
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

export function ImpactConfirmationDialog ( properties: ImpactConfirmationDialogProperties )
{
    // Initialize the local values needed by this operation.

    const chartReferenceCount = properties.impact.chartInitialIndicatorCount +
        properties.impact.chartStatePlacementCount + properties.impact.chartDraftTransitionCount +
        properties.impact.chartTerminalIndicatorCount + properties.impact.chartTerminalRelationCount;
    const savedSampleReferenceCount = properties.impact.solverTokenReferenceCount +
        properties.impact.simulatorEventReferenceCount;

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    <button className="danger-button" onClick={ properties.onConfirm } type="button">
                        { text ( "button.delete" ) }
                    </button>
                </>
            }
            initialFocusSelector = ".dialog-footer .danger-button"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( "dialog.impact.title" ) }
            titleIdentifier      = "impact-dialog-title"
        >
            <p>{ text ( "dialog.impact.description" ) }</p>
            <dl className="impact-summary">
                <div><dt>{ text ( "dialog.impact.declarations" ) }</dt><dd>{ properties.impact.declarationCount }</dd></div>
                <div><dt>{ text ( "dialog.impact.initialState" ) }</dt><dd>{ properties.impact.initialStateReferenceCount }</dd></div>
                <div><dt>{ text ( "dialog.impact.actionMappings" ) }</dt><dd>{ properties.impact.actionMappingCount }</dd></div>
                <div><dt>{ text ( "dialog.impact.transitions" ) }</dt><dd>{ properties.impact.transitionCount }</dd></div>
                <div><dt>{ text ( "dialog.impact.chartReferences" ) }</dt><dd>{ chartReferenceCount }</dd></div>
                <div><dt>{ text ( "dialog.impact.savedSamples" ) }</dt><dd>{ savedSampleReferenceCount }</dd></div>
            </dl>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: DirtyReplacementDialogProperties
//
// Description:
//
//   Defines the properties accepted by the dirty replacement dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface DirtyReplacementDialogProperties extends BasicDialogProperties
{
    readonly canSave:           boolean;
    readonly onDiscardContinue: () => void;
    readonly onSaveContinue:    () => void;
}

//--------------------------------------------------------------------------------------------------
// Function: DirtyReplacementDialog
//
// Description:
//
//   Renders the dirty replacement dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered dirty replacement dialog interface.
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

export function DirtyReplacementDialog ( properties: DirtyReplacementDialogProperties )
{
    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    { properties.canSave && (
                        <button onClick={ properties.onSaveContinue } type="button">
                            { text ( "button.saveAndContinue" ) }
                        </button>
                    ) }
                    <button className="danger-button" onClick={ properties.onDiscardContinue } type="button">
                        { text ( "button.discardAndContinue" ) }
                    </button>
                </>
            }
            initialFocusSelector = ".dialog-footer button"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( "dialog.dirty.title" ) }
            titleIdentifier      = "dirty-dialog-title"
        >
            <p>{ text ( "dialog.dirty.description" ) }</p>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverReplacementDialogProperties
//
// Description:
//
//   Defines the properties accepted by the solver replacement dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface SolverReplacementDialogProperties extends BasicDialogProperties
{
    readonly candidateSummary: string;
    readonly onReplace:        () => void;
}

//--------------------------------------------------------------------------------------------------
// Function: SolverReplacementDialog
//
// Description:
//
//   Renders the solver replacement dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered solver replacement dialog interface.
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

export function SolverReplacementDialog ( properties: SolverReplacementDialogProperties )
{
    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    <button className="danger-button" onClick={ properties.onReplace } type="button">
                        { text ( "button.replaceStateMachine" ) }
                    </button>
                </>
            }
            initialFocusSelector = ".dialog-footer button"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( "dialog.solver.title" ) }
            titleIdentifier      = "solver-replacement-dialog-title"
        >
            <p>{ text ( "dialog.solver.description" ) }</p>
            <p>{ properties.candidateSummary }</p>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverSequenceCsvDialogProperties
//
// Description:
//
//   Defines the properties accepted by the solver sequence CSV dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface SolverSequenceCsvDialogProperties extends BasicDialogProperties
{
    readonly mode:       "export" | "import";
    readonly onConfirm:  ( sequenceName: string ) => void;
    readonly sequences:  readonly SolverSequence[];
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverSequenceDialogProperties
//
// Description:
//
//   Defines the properties accepted by the solver sequence dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface SolverSequenceDialogProperties extends BasicDialogProperties
{
    readonly existingNames: readonly string[];
    readonly initialValue:  SolverSequence;
    readonly onConfirm:     ( sequence: SolverSequence ) => void;
}

//--------------------------------------------------------------------------------------------------
// Function: SolverSequenceDialog
//
// Description:
//
//   Renders the solver sequence dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered solver sequence dialog interface.
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

export function SolverSequenceDialog ( properties: SolverSequenceDialogProperties )
{
    // Initialize the local values needed by this operation.

    const [ value, setValue ] = useState<SolverSequence> ( properties.initialValue );
    const normalizedName             = value.name.trim ();
    const nameConflict               = properties.existingNames.includes ( normalizedName );
    const startContextDescriptionKey = 
    {
        continuation: "solver.sequence.startContinuationDescription",
        infer:        "solver.sequence.startInferDescription",
        initial:      "solver.sequence.startInitialDescription",
    } as const;

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    <button
                        disabled = { normalizedName.length === 0 || nameConflict }
                        onClick  = { () =>
                        {
                            properties.onConfirm ( { ...value, name: normalizedName } );
                            properties.onClose ();
                        } }
                        type="button"
                    >
                        { text ( "button.confirm" ) }
                    </button>
                </>
            }
            initialFocusSelector = "#solver-sequence-name"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( "dialog.solverSequence.title" ) }
            titleIdentifier      = "solver-sequence-dialog-title"
        >
            <p>{ text ( "dialog.solverSequence.description" ) }</p>
            <FormField label={ text ( "dialog.solverSequence.name" ) } name="solver-sequence-name">
                <input
                    aria-describedby={ nameConflict ? "solver-sequence-name-error" : undefined }
                    aria-invalid={ nameConflict }
                    id       = "solver-sequence-name"
                    onChange = { event => setValue ( { ...value, name: event.currentTarget.value } ) }
                    required
                    type  = "text"
                    value = { value.name }
                />
                { nameConflict && (
                    <span className="field-error" id="solver-sequence-name-error" role="alert">
                        { text ( "solver.sequence.nameDuplicate" ) }
                    </span>
                ) }
            </FormField>
            <FormField label={ text ( "field.description" ) } name="solver-sequence-description">
                <textarea
                    id       = "solver-sequence-description"
                    onChange = { event => setValue ( { ...value, description: event.currentTarget.value } ) }
                    value    = { value.description }
                />
            </FormField>
            <FormField label={ text ( "dialog.solverSequence.startContext" ) } name="solver-sequence-start-context">
                <select
                    aria-describedby="solver-sequence-start-context-description"
                    id       = "solver-sequence-start-context"
                    onChange = { event => setValue ( {
                        ...value,
                        startContext: event.currentTarget.value as SolverStartContext,
                    } ) }
                    value={ value.startContext }
                >
                    <option value="initial">{ text ( "solver.sequence.startInitial" ) }</option>
                    <option value="continuation">{ text ( "solver.sequence.startContinuation" ) }</option>
                    <option value="infer">{ text ( "solver.sequence.startInfer" ) }</option>
                </select>
                <span className="field-description" id="solver-sequence-start-context-description">
                    { text ( startContextDescriptionKey [ value.startContext ] ) }
                </span>
            </FormField>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: SolverSequenceCsvDialog
//
// Description:
//
//   Renders the solver sequence CSV dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered solver sequence CSV dialog interface.
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

export function SolverSequenceCsvDialog ( properties: SolverSequenceCsvDialogProperties )
{
    // Initialize the local values needed by this operation.

    const [ sequenceName, setSequenceName ] = useState ( properties.mode === "export"
        ? properties.sequences [ 0 ]?.name ?? ""
        : "" );
    const descriptionKey = properties.mode === "export"
        ? "dialog.csvSolver.description.export" as const
        : "dialog.csvSolver.description.import" as const;
    const titleKey = properties.mode === "export"
        ? "dialog.csvSolver.title.export" as const
        : "dialog.csvSolver.title.import" as const;

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    <button
                        disabled = { sequenceName.trim ().length === 0 }
                        onClick  = { () => properties.onConfirm ( sequenceName.trim () ) }
                        type     = "button"
                    >
                        { text ( "button.confirm" ) }
                    </button>
                </>
            }
            initialFocusSelector = "#solver-csv-sequence-name"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( titleKey ) }
            titleIdentifier      = "solver-csv-dialog-title"
        >
            <p>{ text ( descriptionKey ) }</p>
            <FormField label={ text ( "dialog.solverSequence.name" ) } name="solver-csv-sequence-name">
                { properties.mode === "export"
                    ? (
                        <ProgressiveSelect
                            identifier = "solver-csv-sequence-name"
                            key        = { String ( properties.open ) }
                            onChange   = { setSequenceName }
                            options    = { properties.sequences.map ( sequence => ( {
                                label: sequence.name,
                                value: sequence.name,
                            } ) ) }
                            searchLabel={ `${text ( "shared.searchOptions" )}: ` +
                                text ( "dialog.solverSequence.name" ) }
                            value={ sequenceName }
                        />
                    )
                    : (
                        <input
                            id       = "solver-csv-sequence-name"
                            onChange = { event => setSequenceName ( event.currentTarget.value ) }
                            required
                            type  = "text"
                            value = { sequenceName }
                        />
                    ) }
            </FormField>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: SimulatorSequenceDialogProperties
//
// Description:
//
//   Defines the properties accepted by the simulator sequence dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface SimulatorSequenceDialogProperties extends BasicDialogProperties
{
    readonly existingNames: readonly string[];
    readonly initialValue:  SimulatorSequence;
    readonly onConfirm:     ( sequence: SimulatorSequence ) => void;
}

//--------------------------------------------------------------------------------------------------
// Function: SimulatorSequenceDialog
//
// Description:
//
//   Renders the simulator sequence dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered simulator sequence dialog interface.
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

export function SimulatorSequenceDialog ( properties: SimulatorSequenceDialogProperties )
{
    // Initialize the local values needed by this operation.

    const [ value, setValue ] = useState<SimulatorSequence> ( properties.initialValue );
    const normalizedName = value.name.trim ();
    const nameConflict   = properties.existingNames.includes ( normalizedName );

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    <button
                        disabled = { normalizedName.length === 0 || nameConflict }
                        onClick  = { () =>
                        {
                            properties.onConfirm ( { ...value, name: normalizedName } );
                            properties.onClose ();
                        } }
                        type="button"
                    >
                        { text ( "button.confirm" ) }
                    </button>
                </>
            }
            initialFocusSelector = "#simulator-sequence-name"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( "dialog.simulatorSequence.title" ) }
            titleIdentifier      = "simulator-sequence-dialog-title"
        >
            <p>{ text ( "dialog.simulatorSequence.description" ) }</p>
            <FormField label={ text ( "dialog.simulatorSequence.name" ) } name="simulator-sequence-name">
                <input
                    aria-describedby={ nameConflict ? "simulator-sequence-name-error" : undefined }
                    aria-invalid={ nameConflict }
                    id       = "simulator-sequence-name"
                    onChange = { event => setValue ( { ...value, name: event.currentTarget.value } ) }
                    required
                    type  = "text"
                    value = { value.name }
                />
                { nameConflict && (
                    <span className="field-error" id="simulator-sequence-name-error" role="alert">
                        { text ( "simulator.sequence.nameDuplicate" ) }
                    </span>
                ) }
            </FormField>
            <FormField label={ text ( "field.description" ) } name="simulator-sequence-description">
                <textarea
                    id       = "simulator-sequence-description"
                    onChange = { event => setValue ( { ...value, description: event.currentTarget.value } ) }
                    value    = { value.description }
                />
            </FormField>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: SimulatorEventDialogProperties
//
// Description:
//
//   Defines the properties accepted by the simulator event dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface SimulatorEventDialogProperties extends BasicDialogProperties
{
    readonly eventNames: readonly string[];
    readonly onConfirm:  ( eventName: string ) => void;
}

//--------------------------------------------------------------------------------------------------
// Function: SimulatorEventDialog
//
// Description:
//
//   Renders the simulator event dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered simulator event dialog interface.
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

export function SimulatorEventDialog ( properties: SimulatorEventDialogProperties )
{
    // Initialize the local values needed by this operation.

    const [ eventName, setEventName ] = useState ( properties.eventNames [ 0 ] ?? "" );

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    <button
                        disabled = { eventName.length === 0 }
                        onClick  = { () =>
                        {
                            properties.onConfirm ( eventName );
                            properties.onClose ();
                        } }
                        type="button"
                    >
                        { text ( "button.confirm" ) }
                    </button>
                </>
            }
            initialFocusSelector = "#simulator-event-name"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( "dialog.simulatorEvent.title" ) }
            titleIdentifier      = "simulator-event-dialog-title"
        >
            <p>{ text ( "dialog.simulatorEvent.description" ) }</p>
            <FormField label={ text ( "dialog.simulatorEvent.event" ) } name="simulator-event-name">
                { properties.eventNames.length === 0
                    ? <p className="field-description">{ text ( "simulator.event.none" ) }</p>
                    : (
                        <ProgressiveSelect
                            identifier  = "simulator-event-name"
                            key         = { String ( properties.open ) }
                            onChange    = { setEventName }
                            options     = { properties.eventNames.map ( event => ( { label: event, value: event } ) ) }
                            searchLabel = { `${text ( "shared.searchOptions" )}: ` +
                                text ( "dialog.simulatorEvent.event" ) }
                            value={ eventName }
                        />
                    ) }
            </FormField>
        </ModalDialog>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: SimulatorSequenceCsvDialogProperties
//
// Description:
//
//   Defines the properties accepted by the simulator sequence CSV dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface SimulatorSequenceCsvDialogProperties extends BasicDialogProperties
{
    readonly mode:      "export" | "import";
    readonly onConfirm: ( sequenceName: string ) => void;
    readonly sequences: readonly SimulatorSequence[];
}

//--------------------------------------------------------------------------------------------------
// Function: SimulatorSequenceCsvDialog
//
// Description:
//
//   Renders the simulator sequence CSV dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered simulator sequence CSV dialog interface.
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

export function SimulatorSequenceCsvDialog ( properties: SimulatorSequenceCsvDialogProperties )
{
    // Initialize the local values needed by this operation.

    const [ sequenceName, setSequenceName ] = useState ( properties.mode === "export"
        ? properties.sequences [ 0 ]?.name ?? ""
        : "" );
    const descriptionKey = properties.mode === "export"
        ? "dialog.csvSimulator.description.export" as const
        : "dialog.csvSimulator.description.import" as const;
    const titleKey = properties.mode === "export"
        ? "dialog.csvSimulator.title.export" as const
        : "dialog.csvSimulator.title.import" as const;

    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    <button
                        disabled = { sequenceName.trim ().length === 0 }
                        onClick  = { () => properties.onConfirm ( sequenceName.trim () ) }
                        type     = "button"
                    >
                        { text ( "button.confirm" ) }
                    </button>
                </>
            }
            initialFocusSelector = "#simulator-csv-sequence-name"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( titleKey ) }
            titleIdentifier      = "simulator-csv-dialog-title"
        >
            <p>{ text ( descriptionKey ) }</p>
            <FormField label={ text ( "dialog.simulatorSequence.name" ) } name="simulator-csv-sequence-name">
                { properties.mode === "export"
                    ? (
                        <ProgressiveSelect
                            identifier = "simulator-csv-sequence-name"
                            key        = { String ( properties.open ) }
                            onChange   = { setSequenceName }
                            options    = { properties.sequences.map ( sequence => ( {
                                label: sequence.name,
                                value: sequence.name,
                            } ) ) }
                            searchLabel={ `${text ( "shared.searchOptions" )}: ` +
                                text ( "dialog.simulatorSequence.name" ) }
                            value={ sequenceName }
                        />
                    )
                    : (
                        <input
                            id       = "simulator-csv-sequence-name"
                            onChange = { event => setSequenceName ( event.currentTarget.value ) }
                            required
                            type  = "text"
                            value = { sequenceName }
                        />
                    ) }
            </FormField>
        </ModalDialog>
    );
}

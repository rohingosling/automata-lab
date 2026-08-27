// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Editor Pages
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Renders the data-centric Editor over typed application command factories.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type
{
    DocumentCommandFactory,
    EditorDraftViewModel,
    HostedModelStatusViewModel,
    NamedEntityEditorValue,
    ShellRoute,
    TransitionEditorValue,
} from "../../application/contracts";
import { EMPTY_HOSTED_MODEL_STATUS_VIEW_MODEL } from "../../application/contracts";
import type { DocumentValidationStatus } from "../../application/document-workspace";
import { text } from "../../localization/messages";
import
{
    NamedEntityDialog,
    SelectionDialog,
    TransitionDialog,
} from "../dialogs/DialogPatterns";
import { DropDownListBox } from "../shared/DropDownListBox";
import { DataGrid, EntityList, FormField } from "../shared/SharedControls";
import type { DataGridColumn, EntityListItem } from "../shared/SharedControls";
import { Splitter } from "../shared/Splitter";
import { Tabs } from "../shared/Tabs";

//--------------------------------------------------------------------------------------------------
// Interface: EditorWorkspaceProperties
//
// Description:
//
//   Defines the properties accepted by the editor workspace interface.
//
//--------------------------------------------------------------------------------------------------

interface EditorWorkspaceProperties
{
    readonly draft:                 EditorDraftViewModel | null;
    readonly hostedModelStatus?:    HostedModelStatusViewModel;
    readonly onCommand:             ( commandFactory: DocumentCommandFactory ) => void;
    readonly onNew:                 () => void;
    readonly onValidate:            () => void;
    readonly route:                 ShellRoute;
    readonly validationStatus:      DocumentValidationStatus;
}

//--------------------------------------------------------------------------------------------------
// Interface: ListActionsProperties
//
// Description:
//
//   Defines the properties accepted by the list actions interface.
//
//--------------------------------------------------------------------------------------------------

interface ListActionsProperties
{
    readonly canMoveDown: boolean;
    readonly canMoveUp:   boolean;
    readonly hasSelection: boolean;
    readonly onAdd:       () => void;
    readonly onDelete:    () => void;
    readonly onEdit:      () => void;
    readonly onMoveDown:  () => void;
    readonly onMoveUp:    () => void;
}

const EDITOR_LABEL_MARGIN_FACTOR       = 1.1;
const MINIMUM_EDITOR_ACTION_PANE_WIDTH = 370;

//--------------------------------------------------------------------------------------------------
// Function: ListActions
//
// Description:
//
//   Renders the list actions interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered list actions interface.
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

function ListActions ( properties: ListActionsProperties )
{
    // Return the rendered interface.

    return (
        <div className="detail-button-panel editor-list-actions">
            <button disabled={ !properties.canMoveUp } onClick={ properties.onMoveUp } type="button">
                <span aria-hidden="true">{ "\u2191" }</span> { text ( "button.moveUp" ) }
            </button>
            <button disabled={ !properties.canMoveDown } onClick={ properties.onMoveDown } type="button">
                <span aria-hidden="true">{ "\u2193" }</span> { text ( "button.moveDown" ) }
            </button>
            <button onClick={ properties.onAdd } type="button">{ text ( "button.add" ) }</button>
            <button disabled={ !properties.hasSelection } onClick={ properties.onDelete } type="button">
                { text ( "button.delete" ) }
            </button>
            <button disabled={ !properties.hasSelection } onClick={ properties.onEdit } type="button">
                { text ( "button.edit" ) }
            </button>
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: useExistingSelection
//
// Description:
//
//   Provides the existing selection hook state and behavior.
//
// Parameters:
//
//   - identifiers:
//     The identifiers supplied to the operation.
//
//   - selectedIdentifier:
//     The selected identifier supplied to the operation.
//
//   - setSelectedIdentifier:
//     The set selected identifier supplied to the operation.
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

function useExistingSelection (
    identifiers: readonly string[],
    selectedIdentifier: string | null,
    setSelectedIdentifier: ( identifier: string | null ) => void,
): void
{
    useEffect ( () =>
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( selectedIdentifier === null || !identifiers.includes ( selectedIdentifier ) )
        {
            setSelectedIdentifier ( identifiers [ 0 ] ?? null );
        }
    }, [ identifiers, selectedIdentifier, setSelectedIdentifier ] );
}

//--------------------------------------------------------------------------------------------------
// Function: NoDocumentPage
//
// Description:
//
//   Renders the no document page interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered no document page interface.
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

function NoDocumentPage ( properties: Pick <EditorWorkspaceProperties, "onNew"> )
{
    // Return the rendered interface.

    return (
        <div className="empty-state editor-no-document">
            <span aria-hidden="true" className="empty-state-mark">{"\u25c7"}</span>
            <strong>{ text ( "editor.noDocument.title" ) }</strong>
            <p>{ text ( "editor.noDocument.description" ) }</p>
            <button onClick={ properties.onNew } type="button">{ text ( "button.newDocument" ) }</button>
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: validationStatusText
//
// Description:
//
//   Derives the validation status text.
//
// Parameters:
//
//   - status:
//     The status supplied to the operation.
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

function validationStatusText ( status: DocumentValidationStatus ): string
{
    // Handle the case where status matches "passed".

    if ( status === "passed" )
    {
        // Return the text result.

        return text ( "editor.validation.passed" );
    }

    // Handle the case where status matches "failed".

    if ( status === "failed" )
    {
        // Return the text result.

        return text ( "editor.validation.failed" );
    }

    // Return the text result.

    return text ( "editor.validation.notValidated" );
}

//--------------------------------------------------------------------------------------------------
// Function: connectionStatusText
//
// Description:
//
//   Derives the connection status text.
//
// Parameters:
//
//   - connection:
//     The connection supplied to the operation.
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

function connectionStatusText ( connection: HostedModelStatusViewModel["connection"] ): string
{
    // Return the result selected by the current condition.

    return connection === "Connected"
        ? text ( "status.connected" )
        : connection === "Connecting" ? text ( "status.connecting" ) : text ( "status.disconnected" );
}

//--------------------------------------------------------------------------------------------------
// Function: synchronizationStatusText
//
// Description:
//
//   Derives the synchronization status text.
//
// Parameters:
//
//   - synchronization:
//     The synchronization supplied to the operation.
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

function synchronizationStatusText ( synchronization: HostedModelStatusViewModel["synchronization"] ): string
{
    // Handle the case where synchronization matches "Current".

    if ( synchronization === "Current" )
    {
        // Return the text result.

        return text ( "editor.info.synchronization.current" );
    }

    // Return the result selected by the current condition.

    return synchronization === "Local changes"
        ? text ( "editor.info.synchronization.localChanges" )
        : text ( "editor.info.synchronization.unknown" );
}

//--------------------------------------------------------------------------------------------------
// Function: EditorInfoPage
//
// Description:
//
//   Renders the editor info page interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered editor info page interface.
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

function EditorInfoPage ( properties: Omit <EditorWorkspaceProperties, "route"> & { readonly draft: EditorDraftViewModel } )
{
    // Initialize the local values needed by this operation.

    const stateMachine       = properties.draft.stateMachine;
    const hostedModelStatus  = properties.hostedModelStatus ?? EMPTY_HOSTED_MODEL_STATUS_VIEW_MODEL;
    const dashboardReference = useRef <HTMLDivElement> ( null );

    useLayoutEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const dashboard = dashboardReference.current;

        // Handle the case where dashboard matches an absent value.

        if ( dashboard === null )
        {
            // Return control to the caller.

            return;
        }

        const observedDashboard = dashboard;

        //------------------------------------------------------------------------------------------
        // Function: alignDashboardValues
        //
        // Description:
        //
        //   Aligns the dashboard values.
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

        function alignDashboardValues (): void
        {
            // Initialize the local values needed by this operation.

            const labelTextElements = observedDashboard.querySelectorAll <HTMLElement> ( ".editor-info-label-text" );
            const longestLabelWidth = Math.max (
                0,
                ...Array.from ( labelTextElements, element => element.getBoundingClientRect ().width ),
            );

            // Handle the case where longest label width exceeds 0.

            if ( longestLabelWidth > 0 )
            {
                observedDashboard.style.setProperty (
                    "--editor-info-label-column-width",
                    `${Math.ceil ( longestLabelWidth * EDITOR_LABEL_MARGIN_FACTOR )}px`,
                );
            }
        }

        alignDashboardValues ();
        window.addEventListener ( "resize", alignDashboardValues );

        // Return the computed result.

        return () => window.removeEventListener ( "resize", alignDashboardValues );
    }, [] );

    // Return the rendered interface.

    return (
        <div className="editor-info-page">
            <div className="editor-dashboard" ref={ dashboardReference }>
                <fieldset>
                    <legend>{ text ( "editor.info.document" ) }</legend>
                    <dl>
                        <div><dt><span className="editor-info-label-text">{ text ( "field.name" ) }</span></dt><dd>{ properties.draft.settings.name }</dd></div>
                        <div><dt><span className="editor-info-label-text">{ text ( "field.description" ) }</span></dt><dd>{ properties.draft.settings.description || text ( "shared.none" ) }</dd></div>
                        <div><dt><span className="editor-info-label-text">{ text ( "field.version" ) }</span></dt><dd>{ properties.draft.settings.version }</dd></div>
                    </dl>
                </fieldset>
                <fieldset>
                    <legend>{ text ( "editor.info.initialization" ) }</legend>
                    <dl>
                        <div><dt><span className="editor-info-label-text">{ text ( "field.initialState" ) }</span></dt><dd>{ stateMachine.initialState ?? text ( "shared.none" ) }</dd></div>
                    </dl>
                </fieldset>
                <fieldset>
                    <legend>{ text ( "editor.info.validation" ) }</legend>
                    <p className={ `validation-status validation-${properties.validationStatus.replace ( "_", "-" )}` }>
                        { validationStatusText ( properties.validationStatus ) }
                    </p>
                    <dl>
                        <div><dt><span className="editor-info-label-text">{ text ( "editor.count.states" ) }</span></dt><dd>{ stateMachine.states.length }</dd></div>
                        <div><dt><span className="editor-info-label-text">{ text ( "editor.count.events" ) }</span></dt><dd>{ stateMachine.events.length }</dd></div>
                        <div><dt><span className="editor-info-label-text">{ text ( "editor.count.actions" ) }</span></dt><dd>{ stateMachine.actions.length }</dd></div>
                        <div><dt><span className="editor-info-label-text">{ text ( "editor.count.entryAssignments" ) }</span></dt><dd>{ stateMachine.stateActions.entry.length }</dd></div>
                        <div><dt><span className="editor-info-label-text">{ text ( "editor.count.exitAssignments" ) }</span></dt><dd>{ stateMachine.stateActions.exit.length }</dd></div>
                        <div><dt><span className="editor-info-label-text">{ text ( "editor.count.transitions" ) }</span></dt><dd>{ stateMachine.transitionTable.length }</dd></div>
                    </dl>
                </fieldset>
                <fieldset>
                    <legend>{ text ( "editor.info.hosted" ) }</legend>
                    <dl>
                        <div><dt><span className="editor-info-label-text">{ text ( "editor.info.connection" ) }</span></dt><dd>{ connectionStatusText ( hostedModelStatus.connection ) }</dd></div>
                        <div><dt><span className="editor-info-label-text">{ text ( "editor.info.readiness" ) }</span></dt><dd>{ hostedModelStatus.isReady ? text ( "editor.info.ready" ) : text ( "editor.info.notReady" ) }</dd></div>
                        <div><dt><span className="editor-info-label-text">{ text ( "editor.info.revision" ) }</span></dt><dd>{ hostedModelStatus.modelRevision ?? text ( "shared.none" ) }</dd></div>
                        <div><dt><span className="editor-info-label-text">{ text ( "editor.info.synchronization" ) }</span></dt><dd>{ synchronizationStatusText ( hostedModelStatus.synchronization ) }</dd></div>
                    </dl>
                </fieldset>
                <fieldset>
                    <legend>{ text ( "editor.info.simulation" ) }</legend>
                    <p>{ text ( "shared.none" ) }</p>
                </fieldset>
            </div>
            <div className="detail-button-panel editor-info-actions">
                <button onClick={ properties.onValidate } type="button">{ text ( "button.validate" ) }</button>
            </div>
        </div>
    );
}

const SEMANTIC_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

//--------------------------------------------------------------------------------------------------
// Function: InitializationPage
//
// Description:
//
//   Renders the initialization page interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered initialization page interface.
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

function InitializationPage ( properties: Pick <EditorWorkspaceProperties, "draft" | "onCommand"> & { readonly draft: EditorDraftViewModel } )
{
    // Initialize the local values needed by this operation.

    const [ settings, setSettings ] = useState ( properties.draft.settings );
    const formReference = useRef <HTMLFormElement> ( null );

    const nameValid    = settings.name.length > 0 && settings.name === settings.name.trim () && [ ...settings.name ].length <= 128;
    const versionValid = SEMANTIC_VERSION_PATTERN.test ( settings.version );

    useLayoutEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const form = formReference.current;

        // Handle the case where form matches an absent value.

        if ( form === null )
        {
            // Return control to the caller.

            return;
        }

        const observedForm = form;

        //------------------------------------------------------------------------------------------
        // Function: alignFormControls
        //
        // Description:
        //
        //   Aligns the form controls.
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

        function alignFormControls (): void
        {
            // Initialize the local values needed by this operation.

            const labelTextElements = observedForm.querySelectorAll <HTMLElement> ( ".form-field-label-text" );
            const longestLabelWidth = Math.max (
                0,
                ...Array.from ( labelTextElements, element => element.getBoundingClientRect ().width ),
            );

            // Handle the case where longest label width exceeds 0.

            if ( longestLabelWidth > 0 )
            {
                observedForm.style.setProperty (
                    "--initialization-label-column-width",
                    `${Math.ceil ( longestLabelWidth * EDITOR_LABEL_MARGIN_FACTOR )}px`,
                );
            }
        }

        alignFormControls ();
        window.addEventListener ( "resize", alignFormControls );

        // Return the computed result.

        return () => window.removeEventListener ( "resize", alignFormControls );
    }, [] );

    //----------------------------------------------------------------------------------------------
    // Function: commitSettings
    //
    // Description:
    //
    //   Commits the settings.
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

    function commitSettings (): void
    {
        // Handle the case where all required conditions are satisfied.

        if ( nameValid && versionValid && JSON.stringify ( settings ) !== JSON.stringify ( properties.draft.settings ) )
        {
            properties.onCommand ( expectedRevision => ( {
                kind: "update_document_settings", settings, expectedRevision,
            } ) );
        }
    }

    // Return the rendered interface.

    return (
        <form className="editor-form initialization-form" onSubmit={ event => event.preventDefault () } ref={ formReference }>
            <fieldset>
                <legend>{ text ( "editor.initialization.metadata" ) }</legend>
                <FormField hint={ nameValid ? undefined : text ( "editor.field.invalidName" ) } label={ text ( "field.name" ) } name="model-name">
                    <input
                        aria-invalid={ !nameValid }
                        id       = "model-name"
                        onBlur   = { commitSettings }
                        onChange = { event => setSettings ( { ...settings, name: event.currentTarget.value } ) }
                        required
                        value={ settings.name }
                    />
                </FormField>
                <FormField label={ text ( "field.description" ) } name="model-description">
                    <textarea
                        id       = "model-description"
                        onBlur   = { commitSettings }
                        onChange = { event => setSettings ( { ...settings, description: event.currentTarget.value } ) }
                        value    = { settings.description }
                    />
                </FormField>
                <FormField hint={ versionValid ? undefined : text ( "editor.field.invalidVersion" ) } label={ text ( "field.version" ) } name="model-version">
                    <input
                        aria-invalid={ !versionValid }
                        id       = "model-version"
                        onBlur   = { commitSettings }
                        onChange = { event => setSettings ( { ...settings, version: event.currentTarget.value } ) }
                        required
                        value={ settings.version }
                    />
                </FormField>
            </fieldset>
            <fieldset>
                <legend>{ text ( "editor.initialization.state" ) }</legend>
                <FormField label={ text ( "field.initialState" ) } name="model-initial-state">
                    <select
                        id       = "model-initial-state"
                        onChange = { event => properties.onCommand ( expectedRevision => ( {
                            kind: "set_initial_state",
                            initialState: event.currentTarget.value.length === 0 ? null : event.currentTarget.value,
                            expectedRevision,
                        } ) ) }
                        value={ properties.draft.stateMachine.initialState ?? "" }
                    >
                        <option value="" />
                        { properties.draft.stateMachine.states.map ( state => (
                            <option key={ state.name } value={ state.name }>{ state.name }</option>
                        ) ) }
                    </select>
                </FormField>
            </fieldset>
        </form>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: CatalogPageProperties
//
// Description:
//
//   Defines the properties accepted by the catalog page interface.
//
//--------------------------------------------------------------------------------------------------

interface CatalogPageProperties
{
    readonly entities:     readonly NamedEntityEditorValue[];
    readonly entityKind:   "action" | "event";
    readonly label:        string;
    readonly onCommand:    ( commandFactory: DocumentCommandFactory ) => void;
}

//--------------------------------------------------------------------------------------------------
// Function: CatalogPage
//
// Description:
//
//   Renders the catalog page interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered catalog page interface.
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

function CatalogPage ( properties: CatalogPageProperties )
{
    // Initialize the local values needed by this operation.

    const [ selectedName, setSelectedName ] = useState <string | null> ( properties.entities [ 0 ]?.name ?? null );
    const [ dialogMode, setDialogMode ]     = useState <"add" | "edit" | null> ( null );
    const identifiers = properties.entities.map ( entity => entity.name );

    useExistingSelection ( identifiers, selectedName, setSelectedName );

    // Initialize the local values needed by this operation.

    const selectedIndex                    = properties.entities.findIndex ( entity => entity.name === selectedName );
    const selectedEntity                   = properties.entities [ selectedIndex ];
    const items: readonly EntityListItem[] = properties.entities.map ( entity => ( {
        identifier: entity.name,
        label:      entity.name,
    } ) );

    // Return the rendered interface.

    return (
        <div className="editor-list-page">
            <EntityList items={ items } label={ properties.label } onSelectionChange={ setSelectedName } selectedIdentifier={ selectedName } />
            <ListActions
                canMoveDown  = { selectedIndex >= 0 && selectedIndex < properties.entities.length - 1 }
                canMoveUp    = { selectedIndex > 0 }
                hasSelection = { selectedEntity !== undefined }
                onAdd        = { () => setDialogMode ( "add" ) }
                onDelete     = { () =>
                {
                    // Handle the case where selected entity differs from undefined.

                    if ( selectedEntity !== undefined )
                    {
                        properties.onCommand ( expectedRevision => ( {
                            kind: "delete_entity", entityKind: properties.entityKind, name: selectedEntity.name, expectedRevision,
                        } ) );
                    }
                } }
                onEdit     = { () => setDialogMode ( "edit" ) }
                onMoveDown = { () =>
                {
                    // Handle the case where selected entity differs from undefined.

                    if ( selectedEntity !== undefined )
                    {
                        properties.onCommand ( expectedRevision => ( {
                            kind: "move_entity", entityKind: properties.entityKind, name: selectedEntity.name,
                            direction: "down", expectedRevision,
                        } ) );
                    }
                } }
                onMoveUp={ () =>
                {
                    // Handle the case where selected entity differs from undefined.

                    if ( selectedEntity !== undefined )
                    {
                        properties.onCommand ( expectedRevision => ( {
                            kind: "move_entity", entityKind: properties.entityKind, name: selectedEntity.name,
                            direction: "up", expectedRevision,
                        } ) );
                    }
                } }
            />
            { dialogMode !== null && (
                <NamedEntityDialog
                    initialValue={ dialogMode === "edit" && selectedEntity !== undefined
                        ? selectedEntity
                        : { name: "", description: "" } }
                    onClose   = { () => setDialogMode ( null ) }
                    onConfirm = { entity => properties.onCommand ( expectedRevision => dialogMode === "add"
                        ? { kind: "add_entity", entityKind: properties.entityKind, entity, expectedRevision }
                        : {
                            kind: "update_entity", entityKind: properties.entityKind,
                            previousName: selectedEntity?.name ?? entity.name, entity, expectedRevision,
                        } ) }
                    open
                />
            ) }
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Type: StateActionKind
//
// Description:
//
//   Defines the supported state action kind alternatives.
//
//--------------------------------------------------------------------------------------------------

type StateActionKind = "entry" | "exit";

//--------------------------------------------------------------------------------------------------
// Interface: StateActionsPaneProperties
//
// Description:
//
//   Defines the properties accepted by the state actions pane interface.
//
//--------------------------------------------------------------------------------------------------

interface StateActionsPaneProperties
{
    readonly actionKind:   StateActionKind;
    readonly draft:        EditorDraftViewModel;
    readonly onCommand:    ( commandFactory: DocumentCommandFactory ) => void;
    readonly selectedState: string;
}

//--------------------------------------------------------------------------------------------------
// Function: StateActionsPane
//
// Description:
//
//   Renders the state actions pane interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered state actions pane interface.
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

function StateActionsPane ( properties: StateActionsPaneProperties )
{
    // Initialize the local values needed by this operation.

    const indexedMappings = properties.draft.stateMachine.stateActions [ properties.actionKind ].flatMap (
        ( mapping, index ) => mapping.state === properties.selectedState ? [ { index, mapping } ] : [],
    );
    const [ selectedIdentifier, setSelectedIdentifier ] = useState <string | null> (
        indexedMappings [ 0 ] === undefined ? null : String ( indexedMappings [ 0 ].index ),
    );
    const [ dialogMode, setDialogMode ] = useState <"add" | "edit" | null> ( null );
    const identifiers = indexedMappings.map ( entry => String ( entry.index ) );

    useExistingSelection ( identifiers, selectedIdentifier, setSelectedIdentifier );

    // Initialize the local values needed by this operation.

    const selectedPosition                 = indexedMappings.findIndex ( entry => String ( entry.index ) === selectedIdentifier );
    const selectedEntry                    = indexedMappings [ selectedPosition ];
    const items: readonly EntityListItem[] = indexedMappings.map ( ( entry, occurrenceIndex ) => ( {
        identifier: String ( entry.index ),
        label:      `${occurrenceIndex + 1}. ${entry.mapping.action}`,
    } ) );

    // Return the rendered interface.

    return (
        <div className="state-actions-pane">
            { items.length === 0
                ? <p className="editor-empty-message">{ text ( "editor.assignments.empty" ) }</p>
                : <EntityList items={ items } label={ text ( "editor.assignments.label" ) } onSelectionChange={ setSelectedIdentifier } selectedIdentifier={ selectedIdentifier } /> }
            <ListActions
                canMoveDown  = { selectedPosition >= 0 && selectedPosition < indexedMappings.length - 1 }
                canMoveUp    = { selectedPosition > 0 }
                hasSelection = { selectedEntry !== undefined }
                onAdd        = { () => setDialogMode ( "add" ) }
                onDelete     = { () =>
                {
                    // Handle the case where selected entry differs from undefined.

                    if ( selectedEntry !== undefined )
                    {
                        properties.onCommand ( expectedRevision => ( {
                            kind: "delete_state_action", actionKind: properties.actionKind,
                            index: selectedEntry.index, expectedRevision,
                        } ) );
                    }
                } }
                onEdit     = { () => setDialogMode ( "edit" ) }
                onMoveDown = { () =>
                {
                    // Handle the case where selected entry differs from undefined.

                    if ( selectedEntry !== undefined )
                    {
                        properties.onCommand ( expectedRevision => ( {
                            kind: "move_state_action", actionKind: properties.actionKind,
                            index: selectedEntry.index, direction: "down", expectedRevision,
                        } ) );
                    }
                } }
                onMoveUp={ () =>
                {
                    // Handle the case where selected entry differs from undefined.

                    if ( selectedEntry !== undefined )
                    {
                        properties.onCommand ( expectedRevision => ( {
                            kind: "move_state_action", actionKind: properties.actionKind,
                            index: selectedEntry.index, direction: "up", expectedRevision,
                        } ) );
                    }
                } }
            />
            { dialogMode !== null && (
                <SelectionDialog
                    initialIdentifier = { dialogMode === "edit" ? selectedEntry?.mapping.action : undefined }
                    onClose           = { () => setDialogMode ( null ) }
                    onConfirm         = { action => properties.onCommand ( expectedRevision => dialogMode === "add"
                        ? {
                            kind: "add_state_action", actionKind: properties.actionKind,
                            mapping: { state: properties.selectedState, action }, expectedRevision,
                        }
                        : {
                            kind: "update_state_action", actionKind: properties.actionKind,
                            index: selectedEntry?.index ?? -1,
                            mapping: { state: properties.selectedState, action }, expectedRevision,
                        } ) }
                    open
                    options={ properties.draft.stateMachine.actions.map ( action => ( {
                        identifier: action.name,
                        label:      action.name,
                    } ) ) }
                />
            ) }
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: StatesPage
//
// Description:
//
//   Renders the states page interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered states page interface.
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

function StatesPage ( properties: Pick <EditorWorkspaceProperties, "onCommand"> & { readonly draft: EditorDraftViewModel } )
{
    // Initialize the local values needed by this operation.

    const states = properties.draft.stateMachine.states;
    const [ selectedState, setSelectedState ] = useState <string | null> ( states [ 0 ]?.name ?? null );
    const [ dialogMode, setDialogMode ]       = useState <"add" | "edit" | null> ( null );
    const [ activeTab, setActiveTab ]         = useState <StateActionKind> ( "entry" );
    const [ listWidth, setListWidth ]         = useState ( MINIMUM_EDITOR_ACTION_PANE_WIDTH );
    const identifiers = states.map ( state => state.name );

    useExistingSelection ( identifiers, selectedState, setSelectedState );

    // Initialize the local values needed by this operation.

    const selectedIndex  = states.findIndex ( state => state.name === selectedState );
    const selectedEntity = states [ selectedIndex ];

    // Return the rendered interface.

    return (
        <div className="states-editor" style={ { "--state-list-width": `${listWidth}px` } as CSSProperties }>
            <section className="states-list-pane">
                <EntityList
                    items              = { states.map ( state => ( { identifier: state.name, label: state.name } ) ) }
                    label              = { text ( "editor.states.label" ) }
                    onSelectionChange  = { setSelectedState }
                    selectedIdentifier = { selectedState }
                />
                <ListActions
                    canMoveDown  = { selectedIndex >= 0 && selectedIndex < states.length - 1 }
                    canMoveUp    = { selectedIndex > 0 }
                    hasSelection = { selectedEntity !== undefined }
                    onAdd        = { () => setDialogMode ( "add" ) }
                    onDelete     = { () =>
                    {
                        // Handle the case where selected entity differs from undefined.

                        if ( selectedEntity !== undefined )
                        {
                            properties.onCommand ( expectedRevision => ( {
                                kind: "delete_entity", entityKind: "state", name: selectedEntity.name, expectedRevision,
                            } ) );
                        }
                    } }
                    onEdit     = { () => setDialogMode ( "edit" ) }
                    onMoveDown = { () =>
                    {
                        // Handle the case where selected entity differs from undefined.

                        if ( selectedEntity !== undefined )
                        {
                            properties.onCommand ( expectedRevision => ( {
                                kind: "move_entity", entityKind: "state", name: selectedEntity.name,
                                direction: "down", expectedRevision,
                            } ) );
                        }
                    } }
                    onMoveUp={ () =>
                    {
                        // Handle the case where selected entity differs from undefined.

                        if ( selectedEntity !== undefined )
                        {
                            properties.onCommand ( expectedRevision => ( {
                                kind: "move_entity", entityKind: "state", name: selectedEntity.name,
                                direction: "up", expectedRevision,
                            } ) );
                        }
                    } }
                />
            </section>
            <Splitter
                label           = { text ( "editor.states.label" ) }
                minimum         = { MINIMUM_EDITOR_ACTION_PANE_WIDTH }
                onChange        = { setListWidth }
                opposingMinimum = { MINIMUM_EDITOR_ACTION_PANE_WIDTH }
                orientation     = "vertical"
                value           = { listWidth }
            />
            <section className="state-association-pane">
                { selectedState === null
                    ? <p className="editor-empty-message">{ text ( "editor.assignments.empty" ) }</p>
                    : (
                        <Tabs
                            activeTab = { activeTab }
                            label     = { text ( "editor.assignments.label" ) }
                            onSelect  = { setActiveTab }
                            tabs      = {
                                [
                                    { identifier: "entry", label: text ( "editor.assignments.entry" ) },
                                    { identifier: "exit", label: text ( "editor.assignments.exit" ) },
                                ]
                            }
                        >
                            <StateActionsPane
                                actionKind    = { activeTab }
                                draft         = { properties.draft }
                                onCommand     = { properties.onCommand }
                                selectedState = { selectedState }
                            />
                        </Tabs>
                    ) }
            </section>
            { dialogMode !== null && (
                <NamedEntityDialog
                    initialValue={ dialogMode === "edit" && selectedEntity !== undefined
                        ? selectedEntity
                        : { name: "", description: "" } }
                    onClose   = { () => setDialogMode ( null ) }
                    onConfirm = { entity => properties.onCommand ( expectedRevision => dialogMode === "add"
                        ? { kind: "add_entity", entityKind: "state", entity, expectedRevision }
                        : {
                            kind: "update_entity", entityKind: "state", previousName: selectedEntity?.name ?? entity.name,
                            entity, expectedRevision,
                        } ) }
                    open
                />
            ) }
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: IndexedTransition
//
// Description:
//
//   Defines the structure of indexed transition.
//
//--------------------------------------------------------------------------------------------------

interface IndexedTransition
{
    readonly index:      number;
    readonly transition: TransitionEditorValue;
}

//--------------------------------------------------------------------------------------------------
// Function: TransitionTablePage
//
// Description:
//
//   Renders the transition table page interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered transition table page interface.
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

function TransitionTablePage ( properties: Pick <EditorWorkspaceProperties, "onCommand"> & { readonly draft: EditorDraftViewModel } )
{
    // Initialize the local values needed by this operation.

    const rows: readonly IndexedTransition[] = properties.draft.stateMachine.transitionTable.map (
        ( transition, index ) => ( { index, transition } ),
    );
    const [ selectedIdentifier, setSelectedIdentifier ] = useState <string | null> ( rows [ 0 ] === undefined ? null : "0" );
    const [ dialogMode, setDialogMode ]                 = useState <"add" | "edit" | null> ( null );
    const identifiers = rows.map ( row => String ( row.index ) );

    useExistingSelection ( identifiers, selectedIdentifier, setSelectedIdentifier );

    // Initialize the local values needed by this operation.

    const selectedPosition                       = rows.findIndex ( row => String ( row.index ) === selectedIdentifier );
    const selectedRow                            = rows [ selectedPosition ];
    const emptyTransition: TransitionEditorValue = { state: "", event: "", stateNext: "" };
    const states                                 = properties.draft.stateMachine.states.map ( state => state.name );
    const events                                 = properties.draft.stateMachine.events.map ( event => event.name );
    const stateOptions                           = states.map ( state => ( { label: state, value: state } ) );
    const eventOptions                           = events.map ( event => ( { label: event, value: event } ) );

    //----------------------------------------------------------------------------------------------
    // Function: updateTransition
    //
    // Description:
    //
    //   Updates transition.
    //
    // Parameters:
    //
    //   - index:
    //     The index supplied to the operation.
    //
    //   - transition:
    //     The transition supplied to the operation.
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

    function updateTransition ( index: number, transition: TransitionEditorValue ): void
    {
        properties.onCommand ( expectedRevision => ( {
            kind: "update_transition", index, transition, expectedRevision,
        } ) );
    }

    // Calculate the transition columns value from the current inputs.

    const transitionColumns: readonly DataGridColumn <IndexedTransition>[] =
    [
        {
            cellClassName: "editable-grid-cell",
            heading:       text ( "field.state" ),
            render:        row => (
                <DropDownListBox
                    accessibleLabel = { `${text ( "field.state" )} ${row.index + 1}` }
                    emptyMessage    = { text ( "shared.noOptions" ) }
                    onChange        = { state => updateTransition ( row.index, { ...row.transition, state } ) }
                    openButtonLabel = { `${text ( "button.openSelectionList" )}: ${text ( "field.state" )} ${row.index + 1}` }
                    options         = { stateOptions }
                    value           = { row.transition.state }
                />
            ),
        },
        {
            cellClassName: "editable-grid-cell",
            heading:       text ( "field.event" ),
            render:        row => (
                <DropDownListBox
                    accessibleLabel = { `${text ( "field.event" )} ${row.index + 1}` }
                    emptyMessage    = { text ( "shared.noOptions" ) }
                    onChange        = { event => updateTransition ( row.index, { ...row.transition, event } ) }
                    openButtonLabel = { `${text ( "button.openSelectionList" )}: ${text ( "field.event" )} ${row.index + 1}` }
                    options         = { eventOptions }
                    value           = { row.transition.event }
                />
            ),
        },
        {
            cellClassName: "editable-grid-cell",
            heading:       text ( "field.nextState" ),
            render:        row => (
                <DropDownListBox
                    accessibleLabel = { `${text ( "field.nextState" )} ${row.index + 1}` }
                    emptyMessage    = { text ( "shared.noOptions" ) }
                    onChange        = { stateNext => updateTransition ( row.index, { ...row.transition, stateNext } ) }
                    openButtonLabel = { `${text ( "button.openSelectionList" )}: ${text ( "field.nextState" )} ${row.index + 1}` }
                    options         = { stateOptions }
                    value           = { row.transition.stateNext }
                />
            ),
        },
    ];

    // Return the rendered interface.

    return (
        <div className="editor-grid-page">
            <DataGrid
                columns              = { transitionColumns }
                getKey               = { row => String ( row.index ) }
                label                = { text ( "editor.transitions.label" ) }
                onRowSelectionChange = { setSelectedIdentifier }
                rows                 = { rows }
                selectedKey          = { selectedIdentifier }
            />
            <ListActions
                canMoveDown  = { selectedPosition >= 0 && selectedPosition < rows.length - 1 }
                canMoveUp    = { selectedPosition > 0 }
                hasSelection = { selectedRow !== undefined }
                onAdd        = { () => setDialogMode ( "add" ) }
                onDelete     = { () => properties.onCommand ( expectedRevision => ( {
                    kind: "delete_transition", index: selectedRow?.index ?? -1, expectedRevision,
                } ) ) }
                onEdit     = { () => setDialogMode ( "edit" ) }
                onMoveDown = { () => properties.onCommand ( expectedRevision => ( {
                    kind: "move_transition", index: selectedRow?.index ?? -1, direction: "down", expectedRevision,
                } ) ) }
                onMoveUp={ () => properties.onCommand ( expectedRevision => ( {
                    kind: "move_transition", index: selectedRow?.index ?? -1, direction: "up", expectedRevision,
                } ) ) }
            />
            { dialogMode !== null && (
                <TransitionDialog
                    events       = { events }
                    initialValue = { dialogMode === "edit" ? selectedRow?.transition ?? emptyTransition : emptyTransition }
                    onClose      = { () => setDialogMode ( null ) }
                    onConfirm    = { transition => properties.onCommand ( expectedRevision => dialogMode === "add"
                        ? { kind: "add_transition", transition, expectedRevision }
                        : { kind: "update_transition", index: selectedRow?.index ?? -1, transition, expectedRevision } ) }
                    open
                    states={ states }
                />
            ) }
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: EditorWorkspace
//
// Description:
//
//   Renders the editor workspace interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
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

export function EditorWorkspace ( properties: EditorWorkspaceProperties )
{
    // Handle the case where properties draft matches an absent value.

    if ( properties.draft === null )
    {
        // Return the rendered interface.

        return <NoDocumentPage onNew={ properties.onNew } />;
    }

    // Dispatch according to the properties route value.

    switch ( properties.route )
    {
        // Handle the "editor" case.

        case "editor":

            // Return the rendered interface.

            return <EditorInfoPage { ...properties } draft={ properties.draft } />;

        // Handle the "stateMachine" case.

        case "stateMachine":

            // Return the rendered interface.

            return (
                <InitializationPage
                    draft     = { properties.draft }
                    key       = { JSON.stringify ( properties.draft.settings ) }
                    onCommand = { properties.onCommand }
                />
            );

        // Handle the "states" case.

        case "states":

            // Return the rendered interface.

            return <StatesPage draft={ properties.draft } onCommand={ properties.onCommand } />;

        // Handle the "events" case.

        case "events":

            // Return the rendered interface.

            return <CatalogPage entities={ properties.draft.stateMachine.events } entityKind="event" label={ text ( "editor.events.label" ) } onCommand={ properties.onCommand } />;

        // Handle the "actions" case.

        case "actions":

            // Return the rendered interface.

            return <CatalogPage entities={ properties.draft.stateMachine.actions } entityKind="action" label={ text ( "editor.actions.label" ) } onCommand={ properties.onCommand } />;

        // Handle the "transitionTable" case.

        case "transitionTable":

            // Return the rendered interface.

            return <TransitionTablePage draft={ properties.draft } onCommand={ properties.onCommand } />;

        // Handle values not matched by an earlier case.

        default:

            // Return the computed result.

            return null;
    }
}

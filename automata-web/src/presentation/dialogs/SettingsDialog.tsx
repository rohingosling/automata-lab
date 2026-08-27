// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Application Settings Dialog
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Edits a complete application-preference snapshot transactionally and commits only on Apply.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useState } from "react";

import type { ApplicationPreferences } from "../../application/ports/contracts";
import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";
import { text } from "../../localization/messages";
import type { MessageKey } from "../../localization/messages";
import { adaptChartGridColor, isChartGridColor } from "../chart/chart-grid-color.js";
import { FormField, NumericField } from "../shared/SharedControls";
import { ModalDialog } from "./ModalDialog";


//--------------------------------------------------------------------------------------------------
// Type: SettingsGroup
//
// Description:
//
//   Defines the supported settings group alternatives.
//
//--------------------------------------------------------------------------------------------------

type SettingsGroup = "appearance" | "chart" | "console" | "editor" | "general" | "print" | "server" | "simulator" | "solver";


//--------------------------------------------------------------------------------------------------
// Interface: SettingsGroupDefinition
//
// Description:
//
//   Defines the structure of settings group definition.
//
//--------------------------------------------------------------------------------------------------

interface SettingsGroupDefinition
{
    readonly enabled:  boolean;
    readonly labelKey: MessageKey;
    readonly value:    SettingsGroup;
}

const SETTINGS_GROUPS: readonly SettingsGroupDefinition[] = [
    { enabled: true, labelKey: "settings.general", value: "general" },
    { enabled: true, labelKey: "settings.appearance", value: "appearance" },
    { enabled: true, labelKey: "settings.console", value: "console" },
    { enabled: false, labelKey: "settings.solver", value: "solver" },
    { enabled: false, labelKey: "settings.editor", value: "editor" },
    { enabled: true, labelKey: "settings.chart", value: "chart" },
    { enabled: false, labelKey: "settings.simulator", value: "simulator" },
    { enabled: true, labelKey: "settings.server", value: "server" },
    { enabled: true, labelKey: "settings.print", value: "print" },
];

const APPLICATION_SETTING_CONSTRAINTS = COMPILE_TIME_CONFIGURATION.applicationSettingConstraints;


//--------------------------------------------------------------------------------------------------
// Interface: SettingsDialogProperties
//
// Description:
//
//   Defines the properties accepted by the settings dialog interface.
//
//--------------------------------------------------------------------------------------------------

interface SettingsDialogProperties
{
    readonly onApply: ( preferences: ApplicationPreferences ) => void;
    readonly onClose: () => void;
    readonly onPreferencesChange: ( preferences: ApplicationPreferences ) => void;
    readonly onTestServer?: ( serverUrl: string ) => void;
    readonly open: boolean;
    readonly preferences: ApplicationPreferences;
    readonly serverOperationPending?: boolean;
}


//--------------------------------------------------------------------------------------------------
// Interface: CheckboxSettingProperties
//
// Description:
//
//   Defines the properties accepted by the checkbox setting interface.
//
//--------------------------------------------------------------------------------------------------

interface CheckboxSettingProperties
{
    readonly checked:  boolean;
    readonly label:    string;
    readonly name:     string;
    readonly onChange: ( checked: boolean ) => void;
}


//--------------------------------------------------------------------------------------------------
// Function: CheckboxSetting
//
// Description:
//
//   Renders the checkbox setting interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered checkbox setting interface.
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

function CheckboxSetting ( properties: CheckboxSettingProperties )
{
    // Return the rendered interface.

    return (
        <FormField label={ properties.label } name={ properties.name }>
            <input
                checked  = { properties.checked }
                id       = { properties.name }
                name     = { properties.name }
                onChange = { event => properties.onChange ( event.currentTarget.checked ) }
                type     = "checkbox"
            />
        </FormField>
    );
}


interface GridColorSettingProperties
{
    readonly onChange: ( color: string ) => void;
    readonly value:    string;
}

function gridColorChannels ( color: string ): [ red: number, green: number, blue: number ]
{
    return [
        Number.parseInt ( color.slice ( 1, 3 ), 16 ),
        Number.parseInt ( color.slice ( 3, 5 ), 16 ),
        Number.parseInt ( color.slice ( 5, 7 ), 16 ),
    ];
}

function gridColorFromChannels ( red: number, green: number, blue: number ): string
{
    return `#${[ red, green, blue ].map ( channel => channel.toString ( 16 ).padStart ( 2, "0" ) ).join ( "" )}`;
}

function normalizedGridColor ( value: string ): string | null
{
    const trimmedValue = value.trim ().toLocaleLowerCase ( "en" );
    const candidate    = trimmedValue.startsWith ( "#" ) ? trimmedValue : `#${trimmedValue}`;

    return isChartGridColor ( candidate ) ? candidate : null;
}

function GridColorSetting ( properties: GridColorSettingProperties )
{
    const [ committedColor, setCommittedColor ] = useState ( properties.value );
    const [ draftColor, setDraftColor ]         = useState ( properties.value );
    const [ pickerOpen, setPickerOpen ]         = useState ( false );

    if ( properties.value !== committedColor )
    {
        setCommittedColor ( properties.value );
        setDraftColor ( properties.value );
    }

    const [ red, green, blue ] = gridColorChannels ( committedColor );

    function publishColor ( color: string ): void
    {
        setCommittedColor ( color );
        setDraftColor ( color );
        properties.onChange ( color );
    }

    function updateChannel ( channelIndex: 0 | 1 | 2, value: number ): void
    {
        const channels = gridColorChannels ( committedColor );

        channels [ channelIndex ] = value;
        publishColor ( gridColorFromChannels ( ...channels ) );
    }

    function commitDraftColor (): void
    {
        const normalizedColor = normalizedGridColor ( draftColor );

        if ( normalizedColor === null )
        {
            setDraftColor ( committedColor );
            return;
        }

        publishColor ( normalizedColor );
    }

    return (
        <FormField label={ text ( "settings.gridColor" ) } name="settings-grid-color-hex">
            <div className="grid-color-editor">
                <button
                    aria-controls = "settings-grid-color-picker"
                    aria-expanded = { pickerOpen }
                    aria-label    = { text ( "settings.gridColor.choose" ) }
                    className     = "grid-color-swatch"
                    onClick       = { () => setPickerOpen ( !pickerOpen ) }
                    style         = { { backgroundColor: committedColor } }
                    type          = "button"
                />
                <input
                    id       = "settings-grid-color-hex"
                    onBlur   = { commitDraftColor }
                    onChange = { event =>
                    {
                        const nextDraftColor  = event.currentTarget.value;
                        const normalizedColor = normalizedGridColor ( nextDraftColor );

                        setDraftColor ( nextDraftColor );

                        if ( normalizedColor !== null )
                        {
                            publishColor ( normalizedColor );
                        }
                    } }
                    onKeyDown = { event =>
                    {
                        if ( event.key === "Enter" )
                        {
                            event.preventDefault ();
                            commitDraftColor ();
                        }
                    } }
                    spellCheck = { false }
                    type       = "text"
                    value      = { draftColor }
                />
                { pickerOpen && (
                    <div
                        aria-label = { text ( "settings.gridColor.rgb" ) }
                        className  = "grid-color-channels"
                        id         = "settings-grid-color-picker"
                        role       = "group"
                    >
                    <NumericField
                        label    = { text ( "settings.gridColor.red" ) }
                        maximum  = { 255 }
                        minimum  = { 0 }
                        name     = "settings-grid-color-red"
                        onChange = { value => updateChannel ( 0, value ) }
                        value    = { red }
                    />
                    <NumericField
                        label    = { text ( "settings.gridColor.green" ) }
                        maximum  = { 255 }
                        minimum  = { 0 }
                        name     = "settings-grid-color-green"
                        onChange = { value => updateChannel ( 1, value ) }
                        value    = { green }
                    />
                    <NumericField
                        label    = { text ( "settings.gridColor.blue" ) }
                        maximum  = { 255 }
                        minimum  = { 0 }
                        name     = "settings-grid-color-blue"
                        onChange = { value => updateChannel ( 2, value ) }
                        value    = { blue }
                    />
                    </div>
                ) }
            </div>
        </FormField>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: SettingsDialog
//
// Description:
//
//   Renders the settings dialog interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered settings dialog interface.
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

export function SettingsDialog ( properties: SettingsDialogProperties )
{
    // Initialize the local values needed by this operation.

    const [ activeGroup, setActiveGroup ] = useState <SettingsGroup> ( "general" );
    const normalizedServerUrl = properties.preferences.serverUrl.trim ();
    const serverUrlIsValid    = normalizedServerUrl.length > 0 &&
        normalizedServerUrl.length <= APPLICATION_SETTING_CONSTRAINTS.server.maximumUrlLength;


    //----------------------------------------------------------------------------------------------
    // Function: updateDraft
    //
    // Description:
    //
    //   Updates draft.
    //
    // Parameters:
    //
    //   - partialPreferences:
    //     The partial preferences supplied to the operation.
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

    function updateDraft ( partialPreferences: Partial <ApplicationPreferences> ): void
    {
        properties.onPreferencesChange ( { ...properties.preferences, ...partialPreferences } );
    }


    //----------------------------------------------------------------------------------------------
    // Function: renderDetail
    //
    // Description:
    //
    //   Renders detail.
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

    function renderDetail ()
    {
        // Handle the case where active group matches the general value.

        if ( activeGroup === "general" )
        {
            // Return the rendered interface.

            return (
                <CheckboxSetting
                    checked  = { properties.preferences.saveBackup }
                    label    = { text ( "settings.saveBackup" ) }
                    name     = "settings-save-backup"
                    onChange = { saveBackup => updateDraft ( { saveBackup } ) }
                />
            );
        }


        // Handle the case where active group matches the appearance value.

        if ( activeGroup === "appearance" )
        {
            // Return the rendered interface.

            return (
                <fieldset className="settings-choice-group">
                    <legend>{ text ( "settings.theme" ) }</legend>
                    <label>
                        <input
                            checked  = { properties.preferences.theme === "Light" }
                            name     = "settings-theme"
                            onChange = { () => updateDraft ( { theme: "Light" } ) }
                            type     = "radio"
                        />
                        <span>{ text ( "menu.view.theme.light" ) }</span>
                    </label>
                    <label>
                        <input
                            checked  = { properties.preferences.theme === "Dark" }
                            name     = "settings-theme"
                            onChange = { () => updateDraft ( { theme: "Dark" } ) }
                            type     = "radio"
                        />
                        <span>{ text ( "menu.view.theme.dark" ) }</span>
                    </label>
                </fieldset>
            );
        }


        // Handle the case where active group matches the console value.

        if ( activeGroup === "console" )
        {
            // Return the rendered interface.

            return (
                <CheckboxSetting
                    checked  = { properties.preferences.followConsoleTail }
                    label    = { text ( "settings.followTail" ) }
                    name     = "settings-follow-tail"
                    onChange = { followConsoleTail => updateDraft ( { followConsoleTail } ) }
                />
            );
        }


        // Handle the case where active group matches the chart value.

        if ( activeGroup === "chart" )
        {
            // Return the rendered interface.

            return (
                <div className="settings-chart-groups">
                    <fieldset className="settings-choice-group">
                        <legend>{ text ( "settings.grid" ) }</legend>
                        <NumericField
                            label    = { text ( "settings.gridSize" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.gridSize.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.gridSize.minimum }
                            name     = "settings-grid-size"
                            onChange = { gridSize => updateDraft ( { gridSize } ) }
                            value    = { properties.preferences.gridSize }
                        />
                        <GridColorSetting
                            onChange = { gridColor => updateDraft ( {
                                gridColor,
                                gridColorTheme: properties.preferences.theme,
                            } ) }
                            value = { adaptChartGridColor (
                                properties.preferences.gridColor,
                                properties.preferences.gridColorTheme,
                                properties.preferences.theme,
                            ) }
                        />
                        <FormField
                            label = { text ( "settings.gridStyle" ) }
                            name  = "settings-grid-style"
                        >
                            <select
                                id       = "settings-grid-style"
                                onChange = { event =>
                                {
                                    // Initialize the local values needed by this operation.

                                    const gridStyle = event.currentTarget.value;


                                    // Handle the case where at least one branch condition is
                                    // satisfied.

                                    if ( gridStyle === "Dots" || gridStyle === "Dotted" || gridStyle === "Solid" )
                                    {
                                        updateDraft ( { gridStyle } );
                                    }
                                } }
                                value={ properties.preferences.gridStyle }
                            >
                                <option value="Dots">{ text ( "settings.gridStyle.dots" ) }</option>
                                <option value="Solid">{ text ( "settings.gridStyle.solid" ) }</option>
                                <option value="Dotted">{ text ( "settings.gridStyle.dotted" ) }</option>
                            </select>
                        </FormField>
                        <CheckboxSetting
                            checked  = { properties.preferences.showGrid }
                            label    = { text ( "settings.showGrid" ) }
                            name     = "settings-show-grid"
                            onChange = { showGrid => updateDraft ( { showGrid } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.snapToGrid }
                            label    = { text ( "settings.snapToGrid" ) }
                            name     = "settings-snap-to-grid"
                            onChange = { snapToGrid => updateDraft ( { snapToGrid } ) }
                        />
                    </fieldset>
                    <fieldset className="settings-choice-group">
                        <legend>{ text ( "settings.stateSize" ) }</legend>
                        <NumericField
                            label    = { text ( "settings.collapsedStateWidth" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.minimum }
                            name     = "settings-collapsed-state-width"
                            onChange = { collapsedStateWidth => updateDraft ( { collapsedStateWidth } ) }
                            value    = { properties.preferences.collapsedStateWidth }
                        />
                        <NumericField
                            label    = { text ( "settings.collapsedStateHeight" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.minimum }
                            name     = "settings-collapsed-state-height"
                            onChange = { collapsedStateHeight => updateDraft ( { collapsedStateHeight } ) }
                            value    = { properties.preferences.collapsedStateHeight }
                        />
                        <NumericField
                            label    = { text ( "settings.expandedStateWidth" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.minimum }
                            name     = "settings-expanded-state-width"
                            onChange = { expandedStateWidth => updateDraft ( { expandedStateWidth } ) }
                            value    = { properties.preferences.expandedStateWidth }
                        />
                        <NumericField
                            label    = { text ( "settings.expandedStateMinimumHeight" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.minimum }
                            name     = "settings-expanded-state-minimum-height"
                            onChange = { expandedStateMinimumHeight => updateDraft ( { expandedStateMinimumHeight } ) }
                            value    = { properties.preferences.expandedStateMinimumHeight }
                        />
                    </fieldset>
                    <fieldset className="settings-choice-group">
                        <legend>{ text ( "settings.imageExport" ) }</legend>
                        <FormField label={ text ( "settings.imageFileFormat" ) } name="settings-image-format">
                            <select
                                id       = "settings-image-format"
                                onChange = { event =>
                                {
                                    // Initialize the local values needed by this operation.

                                    const imageFileFormat = event.currentTarget.value;


                                    // Handle the case where at least one branch condition is
                                    // satisfied.

                                    if ( imageFileFormat === "JPG" || imageFileFormat === "PNG" ||
                                        imageFileFormat === "SVG" )
                                    {
                                        updateDraft ( { imageFileFormat } );
                                    }
                                } }
                                value={ properties.preferences.imageFileFormat }
                            >
                                <option value="PNG">PNG</option>
                                <option value="JPG">JPG</option>
                                <option value="SVG">SVG</option>
                            </select>
                        </FormField>
                        <FormField
                            label = { text ( "settings.transparentBackground" ) }
                            name  = "settings-transparent-background"
                        >
                            <select
                                disabled = { properties.preferences.imageFileFormat === "JPG" }
                                id       = "settings-transparent-background"
                                onChange = { event => updateDraft ( {
                                    transparentBackground: event.currentTarget.value === "Yes",
                                } ) }
                                value={ properties.preferences.transparentBackground ? "Yes" : "No" }
                            >
                                <option value="No">{ text ( "settings.transparentBackground.no" ) }</option>
                                <option value="Yes">{ text ( "settings.transparentBackground.yes" ) }</option>
                            </select>
                        </FormField>
                        <FormField label={ text ( "settings.imageUnit" ) } name="settings-image-unit">
                            <select
                                id       = "settings-image-unit"
                                onChange = { event =>
                                {
                                    // Initialize the local values needed by this operation.

                                    const imageUnit = event.currentTarget.value;


                                    // Handle the case where at least one branch condition is
                                    // satisfied.

                                    if ( imageUnit === "Centimetres" || imageUnit === "Inches" ||
                                        imageUnit === "Pixels" )
                                    {
                                        updateDraft ( { imageUnit } );
                                    }
                                } }
                                value={ properties.preferences.imageUnit }
                            >
                                <option value="Centimetres">Centimetres</option>
                                <option value="Inches">Inches</option>
                                <option value="Pixels">Pixels</option>
                            </select>
                        </FormField>
                        <NumericField
                            disabled = { properties.preferences.imageFileFormat === "SVG" }
                            label    = { text ( "settings.imageDpi" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.imageDpi.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.imageDpi.minimum }
                            name     = "settings-image-dpi"
                            onChange = { imageDpi => updateDraft ( { imageDpi } ) }
                            value    = { properties.preferences.imageDpi }
                        />
                        <NumericField
                            disabled = { properties.preferences.imageFileFormat === "SVG" }
                            label    = { text ( "settings.maximumImageExportMegapixels" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.maximumImageExportMegapixels.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.maximumImageExportMegapixels.minimum }
                            name     = "settings-maximum-image-export-megapixels"
                            onChange = { maximumImageExportMegapixels => updateDraft ( {
                                maximumImageExportMegapixels,
                            } ) }
                            value={ properties.preferences.maximumImageExportMegapixels }
                        />
                    </fieldset>
                    <fieldset className="settings-choice-group">
                        <legend>{ text ( "settings.format" ) }</legend>
                        <CheckboxSetting
                            checked  = { properties.preferences.wrapStateNames }
                            label    = { text ( "settings.wrapStateNames" ) }
                            name     = "settings-wrap-state-names"
                            onChange = { wrapStateNames => updateDraft ( { wrapStateNames } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.wrapEventNames }
                            label    = { text ( "settings.wrapEventNames" ) }
                            name     = "settings-wrap-event-names"
                            onChange = { wrapEventNames => updateDraft ( { wrapEventNames } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.wrapActionNames }
                            label    = { text ( "settings.wrapActionNames" ) }
                            name     = "settings-wrap-action-names"
                            onChange = { wrapActionNames => updateDraft ( { wrapActionNames } ) }
                        />
                    </fieldset>
                    <fieldset className="settings-choice-group">
                        <legend>{ text ( "settings.layoutRouting" ) }</legend>
                        <NumericField
                            label    = { text ( "settings.minimumStateDistance" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.minimumStateDistance.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.minimumStateDistance.minimum }
                            name     = "settings-minimum-state-distance"
                            onChange = { minimumStateDistance => updateDraft ( { minimumStateDistance } ) }
                            value    = { properties.preferences.minimumStateDistance }
                        />
                        <NumericField
                            label    = { text ( "settings.transitionArrowHeadSize" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.transitionArrowHeadSize.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.transitionArrowHeadSize.minimum }
                            name     = "settings-transition-arrowhead-size"
                            onChange = { transitionArrowHeadSize => updateDraft ( { transitionArrowHeadSize } ) }
                            value    = { properties.preferences.transitionArrowHeadSize }
                        />
                        <NumericField
                            label    = { text ( "settings.transitionGravityPointDistance" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.transitionGravityPointDistance.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.transitionGravityPointDistance.minimum }
                            name     = "settings-transition-gravity-point-distance"
                            onChange = { transitionGravityPointDistance => updateDraft (
                                { transitionGravityPointDistance },
                            ) }
                            value={ properties.preferences.transitionGravityPointDistance }
                        />
                        <FormField
                            label = { text ( "settings.transitionLabelAlignment" ) }
                            name  = "settings-transition-label-alignment"
                        >
                            <select
                                id       = "settings-transition-label-alignment"
                                onChange = { event =>
                                {
                                    // Initialize the local values needed by this operation.

                                    const transitionLabelAlignment = event.currentTarget.value;


                                    // Handle the case where at least one branch condition is
                                    // satisfied.

                                    if ( transitionLabelAlignment === "Center" ||
                                        transitionLabelAlignment === "End" ||
                                        transitionLabelAlignment === "Start" )
                                    {
                                        updateDraft ( { transitionLabelAlignment } );
                                    }
                                } }
                                value={ properties.preferences.transitionLabelAlignment }
                            >
                                <option value="Start">Start</option>
                                <option value="Center">Center</option>
                                <option value="End">End</option>
                            </select>
                        </FormField>
                        <NumericField
                            label    = { text ( "settings.selfTransitionLoopExtension" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopExtension.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopExtension.minimum }
                            name     = "settings-self-transition-loop-extension"
                            onChange = { selfTransitionLoopExtension => updateDraft (
                                { selfTransitionLoopExtension },
                            ) }
                            value={ properties.preferences.selfTransitionLoopExtension }
                        />
                        <NumericField
                            label    = { text ( "settings.selfTransitionLoopSpacing" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopSpacing.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopSpacing.minimum }
                            name     = "settings-self-transition-loop-spacing"
                            onChange = { selfTransitionLoopSpacing => updateDraft (
                                { selfTransitionLoopSpacing },
                            ) }
                            value={ properties.preferences.selfTransitionLoopSpacing }
                        />
                        <NumericField
                            label    = { text ( "settings.selfTransitionLoopAspect" ) }
                            maximum  = { APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopAspect.maximum }
                            minimum  = { APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopAspect.minimum }
                            name     = "settings-self-transition-loop-aspect"
                            onChange = { selfTransitionLoopAspect => updateDraft (
                                { selfTransitionLoopAspect },
                            ) }
                            value={ properties.preferences.selfTransitionLoopAspect }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.deleteOrphanedChartItemsDuringAutomaticLayout }
                            label    = { text ( "settings.deleteOrphanedChartItemsDuringAutomaticLayout" ) }
                            name     = "settings-delete-orphaned-chart-items"
                            onChange = { deleteOrphanedChartItemsDuringAutomaticLayout => updateDraft (
                                { deleteOrphanedChartItemsDuringAutomaticLayout },
                            ) }
                        />
                    </fieldset>
                </div>
            );
        }


        // Handle the case where active group matches the print value.

        if ( activeGroup === "print" )
        {
            // Return the rendered interface.

            return (
                <div className="settings-print-groups">
                    <fieldset className="settings-choice-group settings-print-sections">
                        <legend>{ text ( "settings.print.sections" ) }</legend>
                        <CheckboxSetting
                            checked  = { properties.preferences.printIncludeModelSummary }
                            label    = { text ( "report.section.modelSummary" ) }
                            name     = "settings-print-section-model-summary"
                            onChange = { printIncludeModelSummary => updateDraft ( { printIncludeModelSummary } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.printIncludeStates }
                            label    = { text ( "report.section.states" ) }
                            name     = "settings-print-section-states"
                            onChange = { printIncludeStates => updateDraft ( { printIncludeStates } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.printIncludeEvents }
                            label    = { text ( "report.section.events" ) }
                            name     = "settings-print-section-events"
                            onChange = { printIncludeEvents => updateDraft ( { printIncludeEvents } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.printIncludeActions }
                            label    = { text ( "report.section.actions" ) }
                            name     = "settings-print-section-actions"
                            onChange = { printIncludeActions => updateDraft ( { printIncludeActions } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.printIncludeTransitionTable }
                            label    = { text ( "report.section.transitionTable" ) }
                            name     = "settings-print-section-transition-table"
                            onChange = { printIncludeTransitionTable => updateDraft ( { printIncludeTransitionTable } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.printIncludeStateChart }
                            label    = { text ( "report.section.stateChart" ) }
                            name     = "settings-print-section-state-chart"
                            onChange = { printIncludeStateChart => updateDraft ( { printIncludeStateChart } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.printIncludeChart }
                            label    = { text ( "report.section.chart" ) }
                            name     = "settings-print-section-chart"
                            onChange = { printIncludeChart => updateDraft ( { printIncludeChart } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.printIncludeSolver }
                            label    = { text ( "report.section.solver" ) }
                            name     = "settings-print-section-solver"
                            onChange = { printIncludeSolver => updateDraft ( { printIncludeSolver } ) }
                        />
                        <CheckboxSetting
                            checked  = { properties.preferences.printIncludeSimulator }
                            label    = { text ( "report.section.simulator" ) }
                            name     = "settings-print-section-simulator"
                            onChange = { printIncludeSimulator => updateDraft ( { printIncludeSimulator } ) }
                        />
                    </fieldset>
                    <fieldset className="settings-choice-group">
                        <legend>{ text ( "settings.print.styleAndFormat" ) }</legend>
                        <FormField label={ text ( "settings.print.style" ) } name="settings-print-style">
                            <select
                                id       = "settings-print-style"
                                onChange = { event =>
                                {
                                    // Initialize the local values needed by this operation.

                                    const printStyle = event.currentTarget.value;


                                    // Handle the case where at least one branch condition is
                                    // satisfied.

                                    if ( printStyle === "Academic" || printStyle === "Industry" )
                                    {
                                        updateDraft ( { printStyle } );
                                    }
                                } }
                                value={ properties.preferences.printStyle }
                            >
                                <option value="Academic">{ text ( "settings.print.style.academic" ) }</option>
                                <option value="Industry">{ text ( "settings.print.style.industry" ) }</option>
                            </select>
                        </FormField>
                    </fieldset>
                </div>
            );
        }


        // Handle the case where active group matches the server value.

        if ( activeGroup === "server" )
        {
            // Return the rendered interface.

            return (
                <div>
                    <FormField label={ text ( "field.serverUrl" ) } name="settings-server-url">
                        <input
                            aria-invalid={ !serverUrlIsValid }
                            id       = "settings-server-url"
                            onChange = { event => updateDraft ( { serverUrl: event.currentTarget.value } ) }
                            type     = "text"
                            value    = { properties.preferences.serverUrl }
                        />
                    </FormField>
                    <button
                        disabled={ !serverUrlIsValid || properties.onTestServer === undefined ||
                            properties.serverOperationPending === true }
                        onClick = { () => properties.onTestServer?.( normalizedServerUrl ) }
                        type    = "button"
                    >
                        { text ( "settings.testServer" ) }
                    </button>
                </div>
            );
        }


        // Return the rendered interface.

        return <p>{ text ( "settings.unavailable" ) }</p>;
    }


    // Return the rendered interface.

    return (
        <ModalDialog
            actions={
                <>
                    <button onClick={ properties.onClose } type="button">{ text ( "button.cancel" ) }</button>
                    <button
                        disabled = { !serverUrlIsValid || properties.serverOperationPending === true }
                        onClick  = { () =>
                        {
                            properties.onApply ( { ...properties.preferences, serverUrl: normalizedServerUrl } );
                        } }
                        type="button"
                    >
                        { text ( "button.apply" ) }
                    </button>
                </>
            }
            className            = "modal-dialog settings-dialog"
            initialFocusSelector = "[data-settings-group='general']"
            onRequestClose       = { properties.onClose }
            open                 = { properties.open }
            title                = { text ( "settings.title" ) }
            titleIdentifier      = "settings-dialog-title"
        >
            <div className="settings-layout">
                <div aria-label={ text ( "settings.title" ) } className="settings-groups" role="listbox">
                    { SETTINGS_GROUPS.map ( group => (
                        <button
                            aria-selected={ activeGroup === group.value }
                            data-settings-group={ group.value }
                            disabled = { !group.enabled }
                            key      = { group.value }
                            onClick  = { () => setActiveGroup ( group.value ) }
                            role     = "option"
                            type     = "button"
                        >
                            { text ( group.labelKey ) }
                        </button>
                    ) ) }
                </div>
                <div className="settings-detail">{ renderDetail () }</div>
            </div>
        </ModalDialog>
    );
}

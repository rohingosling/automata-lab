// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Application Ports
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Defines browser-neutral boundaries for files, preferences, transport, Solver jobs, identity,
//   time, hashing, and layout.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    AuthoringDraft,
    AutomataDocument,
    CanonicalSerializedDocument,
} from "../../domain/model/contracts.js";
import type { DomainDiagnostic } from "../../domain/model/diagnostics.js";
import type { SolverObservationInput } from "../../domain/solver/contracts.js";
import type { SolverInferenceResult } from "../../domain/solver/contracts.js";


//--------------------------------------------------------------------------------------------------
// Type: PrintOrientation
//
// Description:
//
//   Defines the supported print orientation alternatives.
//
//--------------------------------------------------------------------------------------------------

export type PrintOrientation = "Landscape" | "Portrait";

//--------------------------------------------------------------------------------------------------
// Type: PrintPaperSize
//
// Description:
//
//   Defines the supported print paper size alternatives.
//
//--------------------------------------------------------------------------------------------------

export type PrintPaperSize   = "A4" | "Legal" | "Letter";

//--------------------------------------------------------------------------------------------------
// Type: PrintStyle
//
// Description:
//
//   Defines the supported print style alternatives.
//
//--------------------------------------------------------------------------------------------------

export type PrintStyle       = "Academic" | "Industry";

//--------------------------------------------------------------------------------------------------
// Type: ChartGridStyle
//
// Description:
//
//   Defines the supported chart grid style alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ChartGridStyle   = "Dots" | "Dotted" | "Solid";


//--------------------------------------------------------------------------------------------------
// Interface: ApplicationPreferences
//
// Description:
//
//   Defines the structure of application preferences.
//
//--------------------------------------------------------------------------------------------------

export interface ApplicationPreferences
{
    readonly collapsedStateHeight: number;
    readonly collapsedStateWidth:  number;
    readonly consolePanelHeight:   number;
    readonly consoleVisible:       boolean;
    readonly deleteOrphanedChartItemsDuringAutomaticLayout: boolean;
    readonly expandedStateMinimumHeight: number;
    readonly expandedStateWidth:  number;
    readonly followConsoleTail:    boolean;
    readonly gridColor:            string;
    readonly gridColorTheme:       "Dark" | "Light";
    readonly gridSize:             number;
    readonly gridStyle:            ChartGridStyle;
    readonly imageDpi:             number;
    readonly imageFileFormat:      "JPG" | "PNG" | "SVG";
    readonly imageUnit:            "Centimetres" | "Inches" | "Pixels";
    readonly maximumImageExportMegapixels: number;
    readonly masterPanelVisible:   boolean;
    readonly masterPanelWidth:     number;
    readonly minimumStateDistance: number;
    readonly printIncludeActions:          boolean;
    readonly printIncludeChart:            boolean;
    readonly printIncludeEvents:           boolean;
    readonly printIncludeModelSummary:     boolean;
    readonly printIncludeSimulator:        boolean;
    readonly printIncludeSolver:           boolean;
    readonly printIncludeStateChart:       boolean;
    readonly printIncludeStates:           boolean;
    readonly printIncludeTransitionTable:  boolean;
    readonly printMarginBottomMillimetres: number;
    readonly printMarginLeftMillimetres:   number;
    readonly printMarginRightMillimetres:  number;
    readonly printMarginTopMillimetres:    number;
    readonly printOrientation:             PrintOrientation;
    readonly printPaperSize:               PrintPaperSize;
    readonly printStyle:                   PrintStyle;
    readonly saveBackup:           boolean;
    readonly selfTransitionLoopAspect:    number;
    readonly selfTransitionLoopExtension: number;
    readonly selfTransitionLoopSpacing:   number;
    readonly serverUrl:            string;
    readonly showGrid:             boolean;
    readonly snapToGrid:           boolean;
    readonly theme:                "Dark" | "Light";
    readonly transitionArrowHeadSize: number;
    readonly transitionGravityPointDistance: number;
    readonly transitionLabelAlignment: "Center" | "End" | "Start";
    readonly transparentBackground: boolean;
    readonly wrapActionNames:      boolean;
    readonly wrapEventNames:       boolean;
    readonly wrapStateNames:       boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: FileReadResult
//
// Description:
//
//   Describes the result produced by file read.
//
//--------------------------------------------------------------------------------------------------

export interface FileReadResult
{
    readonly association: FileAssociation;
    readonly byteCount:   number;
    readonly text:        string;
}


//--------------------------------------------------------------------------------------------------
// Interface: FileAssociation
//
// Description:
//
//   Defines the structure of file association.
//
//--------------------------------------------------------------------------------------------------

export interface FileAssociation
{
    readonly identifier:  string;
    readonly displayName: string;
    readonly capability:  "capable" | "download";
}


//--------------------------------------------------------------------------------------------------
// Interface: FileWriteRequest
//
// Description:
//
//   Describes a file write request.
//
//--------------------------------------------------------------------------------------------------

export interface FileWriteRequest
{
    readonly association:      FileAssociation | null;
    readonly suggestedName:    string;
    readonly document:         CanonicalSerializedDocument;
    readonly previousDocument: CanonicalSerializedDocument | null;
    readonly saveBackup:       boolean;
}


//--------------------------------------------------------------------------------------------------
// Interface: FileWriteResult
//
// Description:
//
//   Describes the result produced by file write.
//
//--------------------------------------------------------------------------------------------------

export interface FileWriteResult
{
    readonly association:    FileAssociation;
    readonly backupStrategy: "none" | "sibling";
    readonly limitation:     string | null;
}


//--------------------------------------------------------------------------------------------------
// Interface: FilePort
//
// Description:
//
//   Defines the boundary used by file.
//
//--------------------------------------------------------------------------------------------------

export interface FilePort
{
    openTextDocument (): Promise<FileReadResult | null>;
    saveTextDocument ( request: FileWriteRequest ): Promise<FileWriteResult | null>;
}


//--------------------------------------------------------------------------------------------------
// Interface: CsvFileReadResult
//
// Description:
//
//   Describes the result produced by CSV file read.
//
//--------------------------------------------------------------------------------------------------

export interface CsvFileReadResult
{
    readonly byteCount:   number;
    readonly displayName: string;
    readonly text:        string;
}


//--------------------------------------------------------------------------------------------------
// Interface: CsvFileWriteRequest
//
// Description:
//
//   Describes a CSV file write request.
//
//--------------------------------------------------------------------------------------------------

export interface CsvFileWriteRequest
{
    readonly suggestedName: string;
    readonly text:          string;
}


//--------------------------------------------------------------------------------------------------
// Interface: CsvFilePort
//
// Description:
//
//   Defines the boundary used by CSV file.
//
//--------------------------------------------------------------------------------------------------

export interface CsvFilePort
{
    openCsvFile (): Promise<CsvFileReadResult | null>;
    saveCsvFile ( request: CsvFileWriteRequest ): Promise<string | null>;
}


//--------------------------------------------------------------------------------------------------
// Type: DocumentDecodeResult
//
// Description:
//
//   Describes the result produced by document decode.
//
//--------------------------------------------------------------------------------------------------

export type DocumentDecodeResult<DocumentType extends AuthoringDraft = AutomataDocument> =
    | {
        readonly isSuccessful: true;
        readonly document:     DocumentType;
        readonly diagnostics:  readonly DomainDiagnostic[];
    }
    | {
        readonly isSuccessful: false;
        readonly diagnostics:  readonly DomainDiagnostic[];
    };


//--------------------------------------------------------------------------------------------------
// Interface: DocumentCodecPort
//
// Description:
//
//   Defines the boundary used by document codec.
//
//--------------------------------------------------------------------------------------------------

export interface DocumentCodecPort<DocumentType extends AuthoringDraft = AutomataDocument>
{
    open ( text: string ): DocumentDecodeResult<DocumentType>;
}


//--------------------------------------------------------------------------------------------------
// Interface: PreferencePort
//
// Description:
//
//   Defines the boundary used by preference.
//
//--------------------------------------------------------------------------------------------------

export interface PreferencePort
{
    load (): Promise<ApplicationPreferences>;
    save ( preferences: ApplicationPreferences ): Promise<void>;
}


//--------------------------------------------------------------------------------------------------
// Interface: PrintPort
//
// Description:
//
//   Defines the boundary used by print.
//
//--------------------------------------------------------------------------------------------------

export interface PrintPort
{
    print (): Promise<void>;
}


//--------------------------------------------------------------------------------------------------
// Interface: SolverJobRequest
//
// Description:
//
//   Describes a solver job request.
//
//--------------------------------------------------------------------------------------------------

export interface SolverJobRequest
{
    readonly jobId:              string;
    readonly documentRevision:   number;
    readonly solverRevision:     number;
    readonly observations:       readonly SolverObservationInput[];
}


//--------------------------------------------------------------------------------------------------
// Interface: SolverProgress
//
// Description:
//
//   Defines the structure of solver progress.
//
//--------------------------------------------------------------------------------------------------

export interface SolverProgress
{
    readonly completedWork: number;
    readonly totalWork:     number;
    readonly message:       string;
}


//--------------------------------------------------------------------------------------------------
// Interface: SolverJobPort
//
// Description:
//
//   Defines the boundary used by solver job.
//
//--------------------------------------------------------------------------------------------------

export interface SolverJobPort
{
    solve (
        request: SolverJobRequest,
        reportProgress: ( progress: SolverProgress ) => void,
    ): Promise<SolverInferenceResult>;
    cancel (): Promise<void>;
}


//--------------------------------------------------------------------------------------------------
// Interface: UuidPort
//
// Description:
//
//   Defines the boundary used by uuid.
//
//--------------------------------------------------------------------------------------------------

export interface UuidPort
{
    create (): string;
}


//--------------------------------------------------------------------------------------------------
// Interface: ClockPort
//
// Description:
//
//   Defines the boundary used by clock.
//
//--------------------------------------------------------------------------------------------------

export interface ClockPort
{
    nowUtc (): string;
}


//--------------------------------------------------------------------------------------------------
// Interface: ContentHashPort
//
// Description:
//
//   Defines the boundary used by content hash.
//
//--------------------------------------------------------------------------------------------------

export interface ContentHashPort
{
    hashCanonicalText ( canonicalText: string ): Promise<string>;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartLayoutNode
//
// Description:
//
//   Defines the structure of chart layout node.
//
//--------------------------------------------------------------------------------------------------

export interface ChartLayoutNode
{
    readonly state:      string;
    readonly width:      number;
    readonly height:     number;
    readonly isInitial?: boolean;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartLayoutEdge
//
// Description:
//
//   Defines the structure of chart layout edge.
//
//--------------------------------------------------------------------------------------------------

export interface ChartLayoutEdge
{
    readonly sourceState:      string;
    readonly destinationState: string;
    readonly labelHeight?:     number;
    readonly labelWidth?:      number;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartLayoutResult
//
// Description:
//
//   Describes the result produced by chart layout.
//
//--------------------------------------------------------------------------------------------------

export interface ChartLayoutResult
{
    // The distance actually enforced between state centres. It equals the requested Minimum State
    // Distance unless the current state geometry required a larger value to keep two states from
    // overlapping.

    readonly effectiveMinimumStateDistance: number;
    readonly states: readonly { readonly state: string; readonly x: number; readonly y: number }[];
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartLayoutOptions
//
// Description:
//
//   Defines the options that control chart layout.
//
//--------------------------------------------------------------------------------------------------

export interface ChartLayoutOptions
{
    readonly gridSize:             number;
    readonly minimumStateDistance: number;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartLayoutPort
//
// Description:
//
//   Defines the boundary used by chart layout.
//
//--------------------------------------------------------------------------------------------------

export interface ChartLayoutPort
{
    layout (
        nodes: readonly ChartLayoutNode[],
        edges: readonly ChartLayoutEdge[],
        options?: ChartLayoutOptions,
    ): Promise<ChartLayoutResult>;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingPoint
//
// Description:
//
//   Defines the structure of chart routing point.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingPoint
{
    readonly x: number;
    readonly y: number;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingRectangle
//
// Description:
//
//   Defines the structure of chart routing rectangle.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingRectangle extends ChartRoutingPoint
{
    readonly height: number;
    readonly width:  number;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingCubicCurve
//
// Description:
//
//   Defines the structure of chart routing cubic curve.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingCubicCurve
{
    readonly source:        ChartRoutingPoint;
    readonly sourceControl: ChartRoutingPoint;
    readonly target:        ChartRoutingPoint;
    readonly targetControl: ChartRoutingPoint;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingBoundary
//
// Description:
//
//   Defines the structure of chart routing boundary.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingBoundary
{
    readonly cornerRadius?: number;
    readonly height:        number;
    readonly kind:          "circle" | "rectangle";
    readonly radius:        number;
    readonly width:         number;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingRelation
//
// Description:
//
//   Defines the structure of chart routing relation.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingRelation
{
    readonly identifier:       string;
    readonly labelHeight:      number;
    readonly labelObstacles:   readonly ChartRoutingRectangle[];
    readonly labelPosition:    number;
    readonly labelWidth:       number;
    readonly obstacles:        readonly ChartRoutingRectangle[];
    readonly preferredPoints:  readonly ChartRoutingPoint[];
    readonly preservePreferred: boolean;
    readonly sourceBoundary?:  ChartRoutingBoundary;
    readonly targetBoundary?:  ChartRoutingBoundary;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingRequest
//
// Description:
//
//   Describes a chart routing request.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingRequest
{
    readonly documentRevision:                number;
    readonly geometryRevision:                number;
    readonly preferenceRevision:              number;
    readonly relations:                       readonly ChartRoutingRelation[];
    readonly requestId:                       string;
    readonly transitionGravityPointDistance: number;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingResultRelation
//
// Description:
//
//   Defines the structure of chart routing result relation.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingResultRelation
{
    readonly curves:           readonly ChartRoutingCubicCurve[];
    readonly exteriorFallback: boolean;
    readonly identifier:       string;
    readonly label:            ChartRoutingRectangle;
    readonly points:           readonly ChartRoutingPoint[];
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingResult
//
// Description:
//
//   Describes the result produced by chart routing.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingResult
{
    readonly documentRevision:   number;
    readonly geometryRevision:   number;
    readonly preferenceRevision: number;
    readonly relations:          readonly ChartRoutingResultRelation[];
    readonly requestId:          string;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingPort
//
// Description:
//
//   Defines the boundary used by chart routing.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingPort
{
    cancel (): Promise<void>;
    route ( request: ChartRoutingRequest ): Promise<ChartRoutingResult>;
}

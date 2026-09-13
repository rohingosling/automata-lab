// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Print Page Style
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Converts validated, allowlisted Page Setup values into the isolated report's @page rule.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { PrintableReport } from "../../application/printing.js";


//--------------------------------------------------------------------------------------------------
// Function: cssPaperSize
//
// Description:
//
//   Derives the CSS paper size.
//
// Parameters:
//
//   - paperSize:
//     The paper size supplied to the operation.
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

function cssPaperSize ( paperSize: PrintableReport["pageSetup"]["printPaperSize"] ): string
{
    // Dispatch according to the paper size value.

    switch ( paperSize )
    {
        // Handle the "A4" case.

        case "A4":

            // Return the computed result.

            return "A4";

        // Handle the "Legal" case.

        case "Legal":

            // Return the computed result.

            return "legal";

        // Handle the "Letter" case.

        case "Letter":

            // Return the computed result.

            return "letter";
    }
}


//--------------------------------------------------------------------------------------------------
// Interface: PaperDimensions
//
// Description:
//
//   Defines the structure of paper dimensions.
//
//--------------------------------------------------------------------------------------------------

interface PaperDimensions
{
    readonly height: number;
    readonly width:  number;
}


//--------------------------------------------------------------------------------------------------
// Function: paperDimensionsMillimetres
//
// Description:
//
//   Derives the paper dimensions millimetres.
//
// Parameters:
//
//   - paperSize:
//     The paper size supplied to the operation.
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

function paperDimensionsMillimetres (
    paperSize: PrintableReport["pageSetup"]["printPaperSize"],
): PaperDimensions
{
    // Dispatch according to the paper size value.

    switch ( paperSize )
    {
        // Handle the "A4" case.

        case "A4":

            // Return the assembled result.

            return { height: 297, width: 210 };

        // Handle the "Legal" case.

        case "Legal":

            // Return the assembled result.

            return { height: 355.6, width: 215.9 };

        // Handle the "Letter" case.

        case "Letter":

            // Return the assembled result.

            return { height: 279.4, width: 215.9 };
    }
}


//--------------------------------------------------------------------------------------------------
// Function: cssString
//
// Description:
//
//   Derives the CSS string.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
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

function cssString ( value: string ): string
{
    // Return the replace result.

    return value.replaceAll ( "\\", "\\\\" ).replaceAll ( "\"", "\\\"" ).replace ( /[\r\n]+/gu, " " );
}

//--------------------------------------------------------------------------------------------------
// Function: createPrintPageStyle
//
// Description:
//
//   Creates print page style.
//
// Parameters:
//
//   - report:
//     The report supplied to the operation.
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

export function createPrintPageStyle ( report: PrintableReport ): string
{
    // Initialize the local values needed by this operation.

    const pageSetup          = report.pageSetup;
    const orientation        = pageSetup.printOrientation.toLocaleLowerCase ();
    const paperDimensions    = paperDimensionsMillimetres ( pageSetup.printPaperSize );
    const orientedPageHeight = pageSetup.printOrientation === "Landscape"
        ? paperDimensions.width
        : paperDimensions.height;
    const chartHeight = Number ( Math.max ( 20, orientedPageHeight - pageSetup.printMarginTopMillimetres -
        pageSetup.printMarginBottomMillimetres - 18 ).toFixed ( 3 ) );
    const runningHeader     = cssString ( `Automata Lab — ${report.fileName}` );
    const runningHeaderFont = pageSetup.printStyle === "Industry"
        ? '"Segoe UI", Arial, sans-serif'
        : '"Times New Roman", Times, serif';


    // Return the computed result.

    return `@page { size: ${cssPaperSize ( pageSetup.printPaperSize )} ${orientation}; ` +
        `margin: ${pageSetup.printMarginTopMillimetres}mm ${pageSetup.printMarginRightMillimetres}mm ` +
        `${pageSetup.printMarginBottomMillimetres}mm ${pageSetup.printMarginLeftMillimetres}mm; ` +
        `@top-left { content: none; } @top-center { content: "${runningHeader}"; ` +
        `font-family: ${runningHeaderFont}; font-size: 8pt; text-align: center; } ` +
        `@top-right { content: none; } } ` +
        `.print-report { --print-state-chart-height: ${chartHeight}mm; }`;
}

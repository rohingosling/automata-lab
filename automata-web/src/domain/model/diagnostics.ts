// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Domain Diagnostics
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Defines stable, sortable diagnostics shared by validation, file parsing, commands, runtime, and
//   Solver input.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Type: DiagnosticSeverity
//
// Description:
//
//   Defines the supported diagnostic severity alternatives.
//
//--------------------------------------------------------------------------------------------------

export type DiagnosticSeverity = "error" | "warning";

//--------------------------------------------------------------------------------------------------
// Interface: DomainDiagnostic
//
// Description:
//
//   Defines the structure of domain diagnostic.
//
//--------------------------------------------------------------------------------------------------

export interface DomainDiagnostic
{
    readonly code:         string;
    readonly severity:     DiagnosticSeverity;
    readonly source:       string;
    readonly message:      string;
    readonly remediation:  string;
    readonly path?:        string;
    readonly context?:     string;
}
const SEVERITY_ORDER: Readonly<Record<DiagnosticSeverity, number>> =
{
    error:   0,
    warning: 1,
};

//--------------------------------------------------------------------------------------------------
// Function: sortDiagnostics
//
// Description:
//
//   Sorts diagnostics.
//
// Parameters:
//
//   - diagnostics:
//     The diagnostics supplied to the operation.
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

export function sortDiagnostics ( diagnostics: readonly DomainDiagnostic[] ): readonly DomainDiagnostic[]
{
    // Return the sort result.

    return [ ...diagnostics ].sort ( ( left, right ) =>
    {
        // Calculate the severity difference value from the current inputs.

        const severityDifference = SEVERITY_ORDER [ left.severity ] - SEVERITY_ORDER [ right.severity ];

        // Handle the case where severity difference differs from the 0 value.

        if ( severityDifference !== 0 )
        {
            // Return the severity difference.

            return severityDifference;
        }

        // Return the computed result.

        return left.source.localeCompare ( right.source ) ||
            ( left.path ?? left.context ?? "" ).localeCompare ( right.path ?? right.context ?? "" ) ||
            left.code.localeCompare ( right.code );
    } );
}

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Worker Request Coordination
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Serializes every server operation so asynchronous staging cannot overtake another request or
//   violate CAS order.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Class: SerializedServerExecutor
//
// Description:
//
//   Implements the serialized server executor behavior.
//
//--------------------------------------------------------------------------------------------------

export class SerializedServerExecutor
{
    private operationTail: Promise<void> = Promise.resolve ();

    //----------------------------------------------------------------------------------------------
    // Method: execute
    //
    // Description:
    //
    //   Executes the requested value.
    //
    // Parameters:
    //
    //   - operation:
    //     The operation supplied to the operation.
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

    public execute<Result> ( operation: () => Promise<Result> | Result ): Promise<Result>
    {
        // Initialize the local values needed by this operation.

        const result = this.operationTail.then ( operation, operation );

        this.operationTail = result.then (
            () => undefined,
            () => undefined,
        );

        // Return the result.

        return result;
    }
}

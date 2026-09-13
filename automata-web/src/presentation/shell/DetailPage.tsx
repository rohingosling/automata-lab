// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Detail Page
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Routes the fixed navigation model to one accessible detail-page surface.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { forwardRef } from "react";
import type { ReactNode } from "react";

import type { ShellRoute } from "../../application/contracts";
import { text } from "../../localization/messages";
import type { MessageKey } from "../../localization/messages";
import { Disclosure, EmptyState } from "../shared/SharedControls";

//--------------------------------------------------------------------------------------------------
// Interface: DetailDefinition
//
// Description:
//
//   Defines the structure of detail definition.
//
//--------------------------------------------------------------------------------------------------

interface DetailDefinition
{
    readonly descriptionKey: MessageKey;
    readonly titleKey:       MessageKey;
}

const DETAIL_DEFINITIONS: Readonly <Record <ShellRoute, DetailDefinition>> =
{
    actions:         { descriptionKey: "detail.actions.description", titleKey: "detail.actions.title" },
    chart:           { descriptionKey: "detail.chart.description", titleKey: "detail.chart.title" },
    editor:          { descriptionKey: "detail.editor.description", titleKey: "detail.editor.title" },
    events:          { descriptionKey: "detail.events.description", titleKey: "detail.events.title" },
    simulator:       { descriptionKey: "detail.simulator.description", titleKey: "detail.simulator.title" },
    solver:          { descriptionKey: "detail.solver.description", titleKey: "detail.solver.title" },
    stateMachine:    { descriptionKey: "detail.stateMachine.description", titleKey: "detail.stateMachine.title" },
    states:          { descriptionKey: "detail.states.description", titleKey: "detail.states.title" },
    transitionTable: {
        descriptionKey: "detail.transitionTable.description",
        titleKey: "detail.transitionTable.title",
    },
};

//--------------------------------------------------------------------------------------------------
// Interface: DetailPageProperties
//
// Description:
//
//   Defines the properties accepted by the detail page interface.
//
//--------------------------------------------------------------------------------------------------

interface DetailPageProperties
{
    readonly children?: ReactNode;
    readonly route: ShellRoute;
}

export const DetailPage = forwardRef <HTMLHeadingElement, DetailPageProperties> ( function DetailPage (
    properties,
    headingReference
)
{
    // Initialize the local values needed by this operation.

    const definition = DETAIL_DEFINITIONS [ properties.route ];

    // Return the rendered interface.

    return (
        <section aria-labelledby="detail-page-heading" className="detail-page" data-route={ properties.route }>
            <header className="detail-page-header">
                <h1 id="detail-page-heading" ref={ headingReference } tabIndex={ -1 }>
                    { text ( definition.titleKey ) }
                </h1>
            </header>
            <div className="detail-page-content">
                { properties.children ?? (
                    <>
                        <EmptyState
                            description = { text ( definition.descriptionKey ) }
                            title       = { text ( "emptyState.title" ) }
                        />
                        <Disclosure label={ text ( "shared.disclosure" ) }>
                            <p>{ text ( "shared.emptyDescription" ) }</p>
                        </Disclosure>
                    </>
                ) }
            </div>
        </section>
    );
} );

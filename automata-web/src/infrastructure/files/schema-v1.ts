// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Automata Lab File Schema 1.0.0
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Defines the executable JSON Schema Draft 2020-12 structural contract for Automata Lab files.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import
{
    MAXIMUM_ACTION_COUNT,
    MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
    MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
    MAXIMUM_CHART_TERMINAL_RELATION_COUNT,
    MAXIMUM_DESCRIPTION_CODE_POINTS,
    MAXIMUM_ENTRY_ACTION_COUNT,
    MAXIMUM_EVENT_BUFFER_COUNT,
    MAXIMUM_EVENT_COUNT,
    MAXIMUM_EXIT_ACTION_COUNT,
    MAXIMUM_NAME_CODE_POINT_COUNT,
    MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_TOKEN_COUNT,
    MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT,
    MAXIMUM_STATE_COUNT,
    MAXIMUM_TRANSITION_COUNT,
} from "../../domain/model/limits.js";

const nameSchema =
{
    type:      "string",
    minLength: 1,
    maxLength: MAXIMUM_NAME_CODE_POINT_COUNT,
};
const descriptionSchema =
{
    type:      "string",
    maxLength: MAXIMUM_DESCRIPTION_CODE_POINTS,
};

const namedEntitySchema =
{
    type:                 "object",
    additionalProperties: false,
    required:             [ "name", "description" ],
    properties:
    {
        name:        nameSchema,
        description: descriptionSchema,
    },
};

const stateActionMappingSchema =
{
    type:                 "object",
    additionalProperties: false,
    required:             [ "state", "action" ],
    properties:
    {
        state:  nameSchema,
        action: nameSchema,
    },
};

const pointSchema =
{
    type:                 "object",
    additionalProperties: false,
    required:             [ "x", "y" ],
    properties:
    {
        x: { type: "number" },
        y: { type: "number" },
    },
};

export const FILE_SCHEMA_V1 =
{
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id:     "https://rohingosling.github.io/automata-lab/schema/automata-lab-state-machine-1.0.0.schema.json",
    title:   "Automata Lab State Machine 1.0.0",
    type:    "object",
    additionalProperties: false,
    required:
    [
        "file_id",
        "file_version",
        "settings",
        "state_machine",
        "chart",
        "solver",
        "simulator",
    ],
    properties:
    {
        file_id:
        {
            const: "automata-lab-state-machine",
        },
        file_version:
        {
            const: "1.0.0",
        },
        settings:
        {
            type:                 "object",
            additionalProperties: false,
            required:             [ "name", "description", "version" ],
            properties:
            {
                name:        nameSchema,
                description: descriptionSchema,
                version:
                {
                    type:    "string",
                    pattern: "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
                },
            },
        },
        state_machine:
        {
            type:                 "object",
            additionalProperties: false,
            required:
            [
                "initial_state",
                "events",
                "states",
                "actions",
                "state_actions",
                "transition_table",
            ],
            properties:
            {
                initial_state: { anyOf: [ { type: "null" }, nameSchema ] },
                events:
                {
                    type:     "array",
                    maxItems: MAXIMUM_EVENT_COUNT,
                    items:    namedEntitySchema,
                },
                states:
                {
                    type:     "array",
                    maxItems: MAXIMUM_STATE_COUNT,
                    items:    namedEntitySchema,
                },
                actions:
                {
                    type:     "array",
                    maxItems: MAXIMUM_ACTION_COUNT,
                    items:    namedEntitySchema,
                },
                state_actions:
                {
                    type:                 "object",
                    additionalProperties: false,
                    required:             [ "entry", "exit" ],
                    properties:
                    {
                        entry:
                        {
                            type:     "array",
                            maxItems: MAXIMUM_ENTRY_ACTION_COUNT,
                            items:    stateActionMappingSchema,
                        },
                        exit:
                        {
                            type:     "array",
                            maxItems: MAXIMUM_EXIT_ACTION_COUNT,
                            items:    stateActionMappingSchema,
                        },
                    },
                },
                transition_table:
                {
                    type:     "array",
                    maxItems: MAXIMUM_TRANSITION_COUNT,
                    items:
                    {
                        type:                 "object",
                        additionalProperties: false,
                        required:             [ "state", "event", "state_next" ],
                        properties:
                        {
                            state:      nameSchema,
                            event:      nameSchema,
                            state_next: nameSchema,
                        },
                    },
                },
            },
        },
        chart:
        {
            type:                 "object",
            additionalProperties: false,
            required:             [ "settings", "indicators", "states" ],
            properties:
            {
                settings:
                {
                    type:                 "object",
                    additionalProperties: false,
                    required:             [ "expand_states" ],
                    properties:
                    {
                        expand_states:         { type: "boolean" },
                        state_origin_centered: { type: "boolean" },
                    },
                },
                indicators:
                {
                    type:                 "object",
                    additionalProperties: false,
                    required:             [ "initial_state_indicator" ],
                    properties:
                    {
                        initial_state_indicator:
                        {
                            anyOf:
                            [
                                { type: "null" },
                                {
                                    type:                 "object",
                                    additionalProperties: false,
                                    required:             [ "x", "y" ],
                                    properties:
                                    {
                                        state: { anyOf: [ { type: "null" }, nameSchema ] },
                                        x:     { type: "number" },
                                        y:     { type: "number" },
                                    },
                                },
                            ],
                        },
                        terminal_state_indicators:
                        {
                            type:     "array",
                            maxItems: MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
                            items:
                            {
                                type:                 "object",
                                additionalProperties: false,
                                required:             [ "id", "x", "y" ],
                                properties:
                                {
                                    id: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
                                    x:  { type: "number" },
                                    y:  { type: "number" },
                                },
                            },
                        },
                        terminal_state_transitions:
                        {
                            type:     "array",
                            maxItems: MAXIMUM_CHART_TERMINAL_RELATION_COUNT,
                            items:
                            {
                                type:                 "object",
                                additionalProperties: false,
                                required:             [ "state", "terminal_state_indicator_id" ],
                                properties:
                                {
                                    state:                       nameSchema,
                                    terminal_state_indicator_id:
                                    {
                                        type: "integer",
                                        minimum: 0,
                                        maximum: Number.MAX_SAFE_INTEGER,
                                    },
                                },
                            },
                        },
                    },
                },
                states:
                {
                    type:     "array",
                    maxItems: MAXIMUM_STATE_COUNT,
                    items:
                    {
                        type:                 "object",
                        additionalProperties: false,
                        required:             [ "state", "x", "y" ],
                        properties:
                        {
                            state: nameSchema,
                            x:     { type: "number" },
                            y:     { type: "number" },
                            width:  { type: "number", minimum: 1, maximum: 4_096 },
                            height: { type: "number", minimum: 1, maximum: 4_096 },
                        },
                    },
                },
                draft_transitions:
                {
                    type:     "array",
                    maxItems: MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
                    items:
                    {
                        type:                 "object",
                        additionalProperties: false,
                        required:             [ "id", "source", "target" ],
                        properties:
                        {
                            id:     { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
                            source: pointSchema,
                            target: pointSchema,
                        },
                    },
                },
            },
        },
        solver:
        {
            type:                 "object",
            additionalProperties: false,
            required:             [ "sequences" ],
            properties:
            {
                sequences:
                {
                    type:     "array",
                    maxItems: MAXIMUM_SOLVER_SEQUENCE_COUNT,
                    items:
                    {
                        type:                 "object",
                        additionalProperties: false,
                        required:             [ "name", "description", "start_context", "sequence" ],
                        properties:
                        {
                            name:          nameSchema,
                            description:   descriptionSchema,
                            start_context: { enum: [ "initial", "continuation", "infer" ] },
                            sequence:
                            {
                                type:     "array",
                                maxItems: MAXIMUM_SOLVER_TOKEN_COUNT,
                                items:
                                {
                                    type:      "string",
                                    maxLength: MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT,
                                },
                            },
                        },
                    },
                },
            },
        },
        simulator:
        {
            type:                 "object",
            additionalProperties: false,
            required:             [ "sequences" ],
            properties:
            {
                sequences:
                {
                    type:     "array",
                    maxItems: MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
                    items:
                    {
                        type:                 "object",
                        additionalProperties: false,
                        required:             [ "name", "description", "sequence" ],
                        properties:
                        {
                            name:        nameSchema,
                            description: descriptionSchema,
                            sequence:
                            {
                                type:     "array",
                                maxItems: MAXIMUM_EVENT_BUFFER_COUNT,
                                items:    nameSchema,
                            },
                        },
                    },
                },
            },
        },
    },
};

// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Entry Point
// Version: 1.0.0
// Date:    2026-08-06
// Author:  Rohin Gosling
//
// Description:
//
//   Mounts the Automata Lab React shell in the static browser document.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";

import { Application } from "./Application";
import "./application.css";

const rootElement = document.getElementById ( "root" );

if ( rootElement === null )
{
    throw new Error ( "Automata Lab could not find its application root." );
}

createRoot ( rootElement ).render (
    <StrictMode>
        <Application />
    </StrictMode>
);

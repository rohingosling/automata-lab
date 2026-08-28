// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    VitePress Configuration
// Version: 1.0.0
// Date:    2026-08-25
// Author:  Rohin Gosling
//
// Description:
//
//   Configures the public Automata Lab documentation site beneath its final GitHub Pages subpath.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { defineConfig } from "vitepress";

const DOCUMENTATION_BASE_PATH = "/automata-lab/docs/";

export default defineConfig (
    {
        base:        DOCUMENTATION_BASE_PATH,
        cleanUrls:   true,
        description: "User and developer documentation for Automata Lab.",
        head:
        [
            [ "meta", { name: "theme-color", content: "#f5f5f5" } ],
        ],
        lang:        "en-US",
        lastUpdated: true,
        srcExclude:
        [
            "scripts/**",
        ],
        title:       "Automata Lab Documentation",
        vite:
        {
            build:
            {
                sourcemap: false,
                target:    "es2023",
            },
        },
        themeConfig:
        {
            footer:
            {
                copyright: "Copyright © Rohin Gosling",
                message:   "Released under the MIT License.",
            },
            nav:
            [
                { text: "Application", link: "https://application.automata-lab.invalid/", target: "_self" },
                { text: "Home", link: "/" },
                { text: "User Guide", link: "/user-guide/" },
                { text: "Developer Guide", link: "/developer-guide/" },
                { text: "GitHub", link: "https://github.com/rohingosling/automata-lab" },
            ],
            outline:
            {
                label: "On this page",
                level: [ 2, 3 ],
            },
            search:
            {
                provider: "local",
            },
            sidebar:
            {
                "/user-guide/":
                [
                    {
                        text: "User Guide",
                        items:
                        [
                            { text: "1. Introduction", link: "/user-guide/" },
                            { text: "2. Getting Started", link: "/user-guide/getting-started" },
                            { text: "3. State-Machine Concepts", link: "/user-guide/state-machine-concepts" },
                            { text: "4. Application Shell", link: "/user-guide/application-shell" },
                            { text: "5. Editor", link: "/user-guide/editor" },
                            { text: "6. State Chart", link: "/user-guide/state-chart" },
                            { text: "7. Solver", link: "/user-guide/solver" },
                            { text: "8. Server and Revisions", link: "/user-guide/server-and-revisions" },
                            { text: "9. Simulator", link: "/user-guide/simulator" },
                            { text: "10. Files and Data Exchange", link: "/user-guide/files-and-data-exchange" },
                            { text: "11. Printing and Export", link: "/user-guide/printing-and-export" },
                            { text: "12. Application Settings", link: "/user-guide/application-settings" },
                            { text: "13. Accessibility", link: "/user-guide/accessibility" },
                            { text: "14. Console and Diagnostics", link: "/user-guide/console-and-diagnostics" },
                            { text: "15. Troubleshooting", link: "/user-guide/troubleshooting" },
                            { text: "16. Limits, Privacy, and Security", link: "/user-guide/limits-privacy-and-security" },
                            { text: "17. User Reference", link: "/user-guide/user-reference" },
                        ],
                    },
                ],
                "/developer-guide/":
                [
                    {
                        text: "Developer Guide",
                        items:
                        [
                            { text: "1. Introduction", link: "/developer-guide/" },
                            { text: "2. Development Setup", link: "/developer-guide/development-setup" },
                            { text: "3. Public Repository Structure", link: "/developer-guide/public-repository-structure" },
                            { text: "4. Architecture", link: "/developer-guide/architecture" },
                            { text: "5. Document and Domain Model", link: "/developer-guide/document-and-domain-model" },
                            { text: "6. File and Data Contracts", link: "/developer-guide/file-and-data-contracts" },
                            { text: "7. Command Architecture", link: "/developer-guide/command-architecture" },
                            { text: "8. State Chart Architecture", link: "/developer-guide/state-chart-architecture" },
                            { text: "9. Solver Architecture", link: "/developer-guide/solver-architecture" },
                            { text: "10. Server and Simulator Architecture", link: "/developer-guide/server-and-simulator-architecture" },
                            { text: "11. Presentation Architecture", link: "/developer-guide/presentation-architecture" },
                            { text: "12. Configuration and Preferences", link: "/developer-guide/configuration-and-preferences" },
                            { text: "13. Printing Architecture", link: "/developer-guide/printing-architecture" },
                            { text: "14. Testing", link: "/developer-guide/testing" },
                            { text: "15. Security and Privacy", link: "/developer-guide/security-and-privacy" },
                            { text: "16. Building and Deployment", link: "/developer-guide/building-and-deployment" },
                            { text: "17. Writing the Documentation", link: "/developer-guide/writing-the-documentation" },
                            { text: "18. Contributing", link: "/developer-guide/contributing" },
                            { text: "19. Developer Reference", link: "/developer-guide/developer-reference" },
                            { text: "20. Licenses and Acknowledgements", link: "/developer-guide/licenses-and-acknowledgements" },
                        ],
                    },
                ],
            },
            socialLinks:
            [
                { icon: "github", link: "https://github.com/rohingosling/automata-lab" },
            ],
        },
    }
);

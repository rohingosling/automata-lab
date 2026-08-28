rem ------------------------------------------------------------------------------------------------
rem
rem Script: build.bat
rem
rem Verifies clean application and documentation installs, browser runtime, tests, and the combined production build.
rem ------------------------------------------------------------------------------------------------
rem

@echo off
setlocal

rem Enter the web project so every npm command resolves the committed package metadata.

pushd "%~dp0automata-web" >nul
if errorlevel 1 exit /b 1

rem Install the exact locked dependency graph.

call npm.cmd ci
if errorlevel 1 goto failure

rem Install the browser runtime required by the verification suite.

call npm.cmd run test:browser:install
if errorlevel 1 goto failure

rem Run the complete verification workflow and preserve its exit status.

call npm.cmd run verify
set "AUTOMATA_BUILD_EXIT_CODE=%ERRORLEVEL%"

popd >nul
exit /b %AUTOMATA_BUILD_EXIT_CODE%

rem Preserve the first failing command status after restoring the caller's directory.

:failure
set "AUTOMATA_BUILD_EXIT_CODE=%ERRORLEVEL%"
popd >nul
exit /b %AUTOMATA_BUILD_EXIT_CODE%

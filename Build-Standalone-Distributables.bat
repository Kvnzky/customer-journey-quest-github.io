@echo off
title Build Standalone Desktop Distributables
cd /d "%~dp0"

echo ========================================================
echo    Packaging Standalone Applications for Distribution
echo ========================================================
echo.

echo 1. Compiling production web bundles...
call npm run build
if %errorlevel% neq 0 (
    echo Error during build! Exiting.
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Packaging Standalone Game & Admin Portal Executables...
call node scripts/package-standalone.cjs
if %errorlevel% neq 0 (
    echo Error during packaging! Exiting.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo  SUCCESS! Standalone portable desktop packages created:
echo.
echo  [1] Standalone Game Application:
echo      release\CustomerJourneyQuest-Game-Standalone\CustomerJourneyQuest-Game.exe
echo.
echo  [2] Standalone Admin Portal Application:
echo      release\CustomerJourneyQuest-Admin-Standalone\CustomerJourneyQuest-Admin.exe
echo.
echo  Both folders can be copied to a USB drive or transferred
echo  to any Windows PC and launched with double-click!
echo ========================================================
echo.
pause

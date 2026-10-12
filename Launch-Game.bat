@echo off
title Customer Journey Quest - Standalone Game
cd /d "%~dp0"

if exist "release\CustomerJourneyQuest-Game-Standalone\CustomerJourneyQuest-Game.exe" (
    start "" "release\CustomerJourneyQuest-Game-Standalone\CustomerJourneyQuest-Game.exe"
    exit
)

start "" npx electron electron/main-game.cjs
exit

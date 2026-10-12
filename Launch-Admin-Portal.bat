@echo off
title Customer Journey Quest - Admin Portal
cd /d "%~dp0"

if exist "release\CustomerJourneyQuest-Admin-Standalone\CustomerJourneyQuest-Admin.exe" (
    start "" "release\CustomerJourneyQuest-Admin-Standalone\CustomerJourneyQuest-Admin.exe"
    exit
)

start "" npx electron electron/main-admin.cjs
exit

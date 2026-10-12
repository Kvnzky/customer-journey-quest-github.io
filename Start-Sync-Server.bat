@echo off
title Customer Journey Quest - Local Synchronization Service
cd /d "%~dp0"

echo ========================================================
echo    Starting Local Synchronization Service
echo    Port: 4820 (http://localhost:4820)
echo ========================================================
echo.
echo Preserves published revisions and aggregates session rankings.
echo Keep this window open if you want live LAN synchronization.
echo Both the Game and Admin Portal work 100%% offline if closed.
echo.

node server/sync-server.cjs
pause

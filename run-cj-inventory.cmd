
@echo off
setlocal

cd /d "%~dp0" || exit /b 1

set "CJ_INVENTORY_BATCH_SIZE=20"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not "%~1"=="" set "CJ_INVENTORY_BATCH_SIZE=%~1"

if not exist "logs" mkdir "logs"

echo ========================= >> logs\inventory-sync.log
echo Started: %date% %time% >> logs\inventory-sync.log

"%NODE_EXE%" services\syncCJInventory.js >> logs\inventory-sync.log 2>&1

set "RESULT=%ERRORLEVEL%"

echo Finished: %date% %time% >> logs\inventory-sync.log
echo Exit code: %RESULT% >> logs\inventory-sync.log

exit /b %RESULT%

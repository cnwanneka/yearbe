
@echo off
setlocal

cd /d "%~dp0" || exit /b 1

set "CJ_VARIANT_BATCH_SIZE=20"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not "%~1"=="" set "CJ_VARIANT_BATCH_SIZE=%~1"

if not exist "logs" mkdir "logs"

echo ========================= >> logs\variant-sync.log
echo Started: %date% %time% >> logs\variant-sync.log

"%NODE_EXE%" services\syncCJVariants.js >> logs\variant-sync.log 2>&1

set "RESULT=%ERRORLEVEL%"

echo Finished: %date% %time% >> logs\variant-sync.log
echo Exit code: %RESULT% >> logs\variant-sync.log

exit /b %RESULT%

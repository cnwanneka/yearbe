

@echo off
setlocal

cd /d "%~dp0" || exit /b 1

set "CJ_CATALOGUE_MAX_REQUESTS=150"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not "%~1"=="" set "CJ_CATALOGUE_MAX_REQUESTS=%~1"

if not exist "logs" mkdir "logs"

echo ========================= >> logs\catalogue-sync.log
echo Started: %date% %time% >> logs\catalogue-sync.log

"%NODE_EXE%" services\syncCJCatalogue.js >> logs\catalogue-sync.log 2>&1

set "RESULT=%ERRORLEVEL%"

echo Finished: %date% %time% >> logs\catalogue-sync.log
echo Exit code: %RESULT% >> logs\catalogue-sync.log

exit /b %RESULT%


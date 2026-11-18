
@echo off
setlocal

cd /d "%~dp0" || exit /b 1

set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not exist "logs" mkdir "logs"

echo ========================= >> logs\pricing-sync.log
echo Started: %date% %time% >> logs\pricing-sync.log

"%NODE_EXE%" services\updateCJCostsGBP.js >> logs\pricing-sync.log 2>&1

set "RESULT=%ERRORLEVEL%"

echo Finished: %date% %time% >> logs\pricing-sync.log
echo Exit code: %RESULT% >> logs\pricing-sync.log

exit /b %RESULT%

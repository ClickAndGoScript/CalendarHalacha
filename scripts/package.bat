@echo off
REM Package Otzaria Plugin for Windows

echo Building plugin...
call npm run build
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

echo Packaging plugin...

REM Get plugin info from manifest (requires Node.js)
for /f "delims=" %%i in ('node -p "require('./manifest.json').id"') do set PLUGIN_ID=%%i
for /f "delims=" %%i in ('node -p "require('./manifest.json').version"') do set PLUGIN_VERSION=%%i
set OUTPUT_FILE=%PLUGIN_ID%-%PLUGIN_VERSION%.otzplugin

REM Create temporary directory
set TEMP_DIR=%TEMP%\otzaria-plugin-%RANDOM%
mkdir "%TEMP_DIR%"

echo Copying files...
xcopy /E /I /Q src "%TEMP_DIR%\src"
copy manifest.json "%TEMP_DIR%\" >nul
copy LICENSE "%TEMP_DIR%\" >nul 2>&1
copy TERMS.md "%TEMP_DIR%\" >nul 2>&1

echo Creating archive...
REM Use PowerShell to create zip
powershell -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%OUTPUT_FILE%.zip' -Force"
move /Y "%OUTPUT_FILE%.zip" "%OUTPUT_FILE%" >nul

REM Cleanup
rmdir /S /Q "%TEMP_DIR%"

echo Plugin packaged successfully: %OUTPUT_FILE%
for %%A in ("%OUTPUT_FILE%") do echo File size: %%~zA bytes

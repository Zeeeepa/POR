@echo off
echo ===================================================
echo POR - Project Orchestration and Reporting
echo Clean and Re-Pull Script
echo ===================================================
echo.

echo Stopping any running processes...
taskkill /f /im node.exe >nul 2>&1

echo Cleaning up temporary files...
if exist "node_modules" (
    echo Removing node_modules folder...
    rmdir /s /q node_modules
)

if exist "package-lock.json" (
    echo Removing package-lock.json...
    del /f /q package-lock.json
)

if exist ".cache" (
    echo Removing .cache folder...
    rmdir /s /q .cache
)

if exist "dist" (
    echo Removing dist folder...
    rmdir /s /q dist
)

if exist "build" (
    echo Removing build folder...
    rmdir /s /q build
)

echo.
echo Resetting Git repository...
git reset --hard

echo.
echo Pulling latest changes from repository...
git pull origin main

echo.
echo Installing dependencies...
call npm install

echo.
echo ===================================================
echo Clean and Re-Pull completed successfully!
echo Run FullDeployLocal^&Start.bat to start the application
echo ===================================================
echo.

pause

@echo off
setlocal enabledelayedexpansion

:: POR - Project Orchestration and Reporting
:: Unified Management Script
:: ===================================================

:: Set colors for better UI
set "BLUE=[94m"
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "RESET=[0m"

:: Set title
title POR Manager

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

:: Log file for this session
set "LOG_FILE=logs\por-manager-%date:~-4,4%%date:~-7,2%%date:~-10,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log"
set "LOG_FILE=%LOG_FILE: =0%"

:: Function to log messages
:log
echo %date% %time% - %~1 >> "%LOG_FILE%"
exit /b

:: Function to display header
:header
cls
echo %BLUE%===================================================
echo POR - Project Orchestration and Reporting
echo Unified Management Script
echo ===================================================%RESET%
echo.
call :log "Displayed header"
exit /b

:: Function to check prerequisites
:check_prerequisites
echo %YELLOW%Checking prerequisites...%RESET%
call :log "Checking prerequisites"

:: Check for Node.js
echo Checking for Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %RED%Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/%RESET%
    call :log "ERROR: Node.js not found"
    pause
    exit /b 1
)
echo %GREEN%Node.js found: %RESET%
node --version
call :log "Node.js found"

:: Check for Git
echo Checking for Git...
git --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %RED%Git is not installed or not in PATH.
    echo Please install Git from https://git-scm.com/%RESET%
    call :log "ERROR: Git not found"
    pause
    exit /b 1
)
echo %GREEN%Git found: %RESET%
git --version
call :log "Git found"

echo %GREEN%All prerequisites are met!%RESET%
echo.
call :log "All prerequisites are met"
exit /b 0

:: Function to configure environment variables
:configure_env
call :header
echo %YELLOW%Environment Configuration%RESET%
echo This will help you set up your .env file for POR.
echo.
call :log "Starting environment configuration"

:: Check if .env already exists
if exist ".env" (
    echo %YELLOW%An existing .env file was found.%RESET%
    choice /C YN /M "Do you want to reconfigure it"
    if !ERRORLEVEL! EQU 2 (
        echo Configuration cancelled.
        call :log "Environment configuration cancelled - .env exists"
        pause
        exit /b 0
    )
)

:: Create .env file from example if it doesn't exist
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul 2>&1
        call :log "Created .env from .env.example"
    ) else (
        echo # POR Environment Configuration > .env
        echo # Created on %date% %time% >> .env
        call :log "Created new empty .env file"
    )
)

:: Configure GitHub token
echo.
echo %YELLOW%GitHub Configuration:%RESET%
echo A GitHub token is required for repository access.
echo You can create one at https://github.com/settings/tokens
echo.
set /p GITHUB_TOKEN="Enter your GitHub token (leave empty to skip): "

if not "%GITHUB_TOKEN%"=="" (
    call :log "Setting GitHub token in .env"
    
    :: Check if GITHUB_TOKEN already exists in .env
    findstr /C:"GITHUB_TOKEN=" .env >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        :: Replace existing token
        powershell -Command "(Get-Content .env) -replace 'GITHUB_TOKEN=.*', 'GITHUB_TOKEN=%GITHUB_TOKEN%' | Set-Content .env"
    ) else (
        :: Add new token
        echo GITHUB_TOKEN=%GITHUB_TOKEN% >> .env
    )
    echo %GREEN%GitHub token configured.%RESET%
) else (
    echo %YELLOW%GitHub token configuration skipped.%RESET%
    call :log "GitHub token configuration skipped"
)

:: Configure port
echo.
echo %YELLOW%Application Configuration:%RESET%
set /p PORT="Enter the port number for the application (default: 3000): "

if "%PORT%"=="" set PORT=3000
call :log "Setting port to %PORT% in .env"

:: Check if PORT already exists in .env
findstr /C:"PORT=" .env >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    :: Replace existing port
    powershell -Command "(Get-Content .env) -replace 'PORT=.*', 'PORT=%PORT%' | Set-Content .env"
) else (
    :: Add new port
    echo PORT=%PORT% >> .env
)

:: Configure log level
echo.
set /p LOG_LEVEL="Enter log level (error, warn, info, debug - default: info): "

if "%LOG_LEVEL%"=="" set LOG_LEVEL=info
call :log "Setting log level to %LOG_LEVEL% in .env"

:: Check if LOG_LEVEL already exists in .env
findstr /C:"LOG_LEVEL=" .env >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    :: Replace existing log level
    powershell -Command "(Get-Content .env) -replace 'LOG_LEVEL=.*', 'LOG_LEVEL=%LOG_LEVEL%' | Set-Content .env"
) else (
    :: Add new log level
    echo LOG_LEVEL=%LOG_LEVEL% >> .env
)

echo %GREEN%Environment configuration completed!%RESET%
call :log "Environment configuration completed"
pause
exit /b 0

:: Function to deploy and start the application
:deploy_and_start
call :header
echo %YELLOW%Deploying and Starting POR%RESET%
echo This will build and start the application.
echo.
call :log "Starting deployment and application startup"

:: Check prerequisites
call :check_prerequisites
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

:: Check for .env file
if not exist ".env" (
    echo %YELLOW%No .env file found. Running configuration...%RESET%
    call :log "No .env file found, running configuration"
    call :configure_env
)

:: Build the application
echo.
echo %YELLOW%Building the application...%RESET%
call :log "Building the application"
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo %RED%Build failed! Please check the error messages above.%RESET%
    call :log "ERROR: Build failed with code %ERRORLEVEL%"
    pause
    exit /b 1
)

echo %GREEN%Build completed successfully!%RESET%
call :log "Build completed successfully"

:: Start the application
echo.
echo %YELLOW%Starting the application...%RESET%
call :log "Starting the application"

:: Start the server in a new window
start cmd /k "echo %BLUE%POR Application Server%RESET% && npm run start"
call :log "Started application server"

:: Start the development server in a new window
start cmd /k "echo %BLUE%POR Development Server%RESET% && npm run dev"
call :log "Started development server"

echo.
echo %GREEN%===================================================
echo POR application has been deployed and started!
echo.
echo Server is running at: http://localhost:%PORT%
echo API is available at: http://localhost:%PORT%/api
echo.
echo Press any key to return to the main menu
echo ===================================================%RESET%
call :log "Deployment and startup completed"
pause
exit /b 0

:: Function to upgrade the application
:upgrade
call :header
echo %YELLOW%Upgrading POR%RESET%
echo This will pull the latest changes and reinstall dependencies.
echo.
call :log "Starting application upgrade"

:: Confirm upgrade
choice /C YN /M "This will reset any local changes. Continue"
if %ERRORLEVEL% EQU 2 (
    echo Upgrade cancelled.
    call :log "Upgrade cancelled by user"
    pause
    exit /b 0
)

:: Stop any running processes
echo %YELLOW%Stopping any running processes...%RESET%
call :log "Stopping running processes"
taskkill /f /im node.exe >nul 2>&1
call :log "Attempted to stop Node.js processes"

:: Backup .env file
if exist ".env" (
    echo %YELLOW%Backing up .env file...%RESET%
    copy .env .env.backup >nul 2>&1
    call :log "Backed up .env to .env.backup"
)

:: Clean up
echo %YELLOW%Cleaning up temporary files...%RESET%
call :log "Cleaning up temporary files"

if exist "node_modules" (
    echo Removing node_modules folder...
    rmdir /s /q node_modules
    call :log "Removed node_modules folder"
)

if exist "package-lock.json" (
    echo Removing package-lock.json...
    del /f /q package-lock.json
    call :log "Removed package-lock.json"
)

if exist ".cache" (
    echo Removing .cache folder...
    rmdir /s /q .cache
    call :log "Removed .cache folder"
)

if exist "dist" (
    echo Removing dist folder...
    rmdir /s /q dist
    call :log "Removed dist folder"
)

if exist "build" (
    echo Removing build folder...
    rmdir /s /q build
    call :log "Removed build folder"
)

:: Reset and pull
echo.
echo %YELLOW%Resetting Git repository...%RESET%
call :log "Resetting Git repository"
git reset --hard
call :log "Git reset completed"

echo.
echo %YELLOW%Pulling latest changes from repository...%RESET%
call :log "Pulling latest changes"
git pull origin main
if %ERRORLEVEL% NEQ 0 (
    echo %RED%Failed to pull latest changes. Please check your internet connection and repository access.%RESET%
    call :log "ERROR: Git pull failed with code %ERRORLEVEL%"
    pause
    exit /b 1
)
call :log "Git pull completed"

:: Restore .env file
if exist ".env.backup" (
    echo %YELLOW%Restoring .env file...%RESET%
    copy .env.backup .env >nul 2>&1
    call :log "Restored .env from backup"
)

:: Install dependencies
echo.
echo %YELLOW%Installing dependencies...%RESET%
call :log "Installing dependencies"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo %RED%Failed to install dependencies. Please check the error messages above.%RESET%
    call :log "ERROR: npm install failed with code %ERRORLEVEL%"
    pause
    exit /b 1
)
call :log "Dependencies installed successfully"

echo.
echo %GREEN%===================================================
echo Upgrade completed successfully!
echo Run option 2 from the main menu to start the application
echo ===================================================%RESET%
call :log "Upgrade completed successfully"
pause
exit /b 0

:: Function to clean and re-pull the repository
:clean_and_repull
call :header
echo %YELLOW%Clean and Re-Pull%RESET%
echo This will completely reset the repository and pull the latest changes.
echo %RED%WARNING: All local changes will be lost!%RESET%
echo.
call :log "Starting clean and re-pull operation"

:: Confirm clean and re-pull
choice /C YN /M "Are you sure you want to proceed"
if %ERRORLEVEL% EQU 2 (
    echo Operation cancelled.
    call :log "Clean and re-pull cancelled by user"
    pause
    exit /b 0
)

:: Execute the upgrade function with full cleaning
call :upgrade
call :log "Clean and re-pull completed via upgrade function"
exit /b 0

:: Main menu function
:main_menu
call :header
echo %YELLOW%Main Menu%RESET%
echo.
echo 1. Deploy and Start Application
echo 2. Configure Environment Variables
echo 3. Upgrade Application
echo 4. Clean and Re-Pull Repository
echo 5. Exit
echo.
call :log "Displayed main menu"

choice /C 12345 /M "Select an option"
echo.

if %ERRORLEVEL% EQU 1 (
    call :deploy_and_start
    goto main_menu
)
if %ERRORLEVEL% EQU 2 (
    call :configure_env
    goto main_menu
)
if %ERRORLEVEL% EQU 3 (
    call :upgrade
    goto main_menu
)
if %ERRORLEVEL% EQU 4 (
    call :clean_and_repull
    goto main_menu
)
if %ERRORLEVEL% EQU 5 (
    call :log "Exiting application"
    echo %GREEN%Thank you for using POR Manager!%RESET%
    exit /b 0
)

goto main_menu

:: Start the script
call :main_menu

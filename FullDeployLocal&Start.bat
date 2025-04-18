@echo off
echo ===================================================
echo POR - Project Orchestration and Reporting
echo Full Deploy and Start Script
echo ===================================================
echo.

echo Checking for Node.js installation...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Checking for Git installation...
git --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Git is not installed or not in PATH.
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

echo.
echo Building the application...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Build failed! Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo Setting up environment...
if not exist ".env" (
    echo Creating default .env file...
    copy .env.example .env >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: Could not create .env file. You may need to configure it manually.
    )
)

echo.
echo Starting the application...
start cmd /k "echo POR Application Server && npm run start"

echo.
echo Starting the development server...
start cmd /k "echo POR Development Server && npm run dev"

echo.
echo ===================================================
echo POR application has been deployed and started!
echo.
echo Server is running at: http://localhost:3000
echo API is available at: http://localhost:3000/api
echo.
echo Press any key to exit this script (servers will continue running)
echo ===================================================
echo.

pause

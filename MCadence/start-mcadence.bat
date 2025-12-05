@echo off
echo Starting mcadence development server...
echo.

REM Add Node.js to PATH for this session
set PATH=%PATH%;C:\Program Files\nodejs

REM Check if node_modules exists, if not install dependencies
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Start the development server
echo Starting Next.js development server...
echo App will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.
call npx next dev

pause

@echo off
chcp 65001 > nul
cd /d "%~dp0"
cls

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║        FieldSync  —  Demo Launcher       ║
echo   ║     Remote Expert Platform  v0.1.0       ║
echo   ╚══════════════════════════════════════════╝
echo.

:: ── Step 1 · Check Node.js ────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [ERROR]  Node.js is not installed.
    echo.
    echo   Download the LTS installer from: https://nodejs.org
    echo   Install it, then double-click this file again.
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('npm -v 2^>nul')  do set NPM_VER=%%v
echo   [OK]  Node.js %NODE_VER%  (npm %NPM_VER%)

:: ── Step 2 · Install dependencies (first run only) ────────────
if not exist "node_modules\" (
    echo.
    echo   [SETUP]  Installing dependencies — first run only (~1 min)...
    call npm install --silent
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo   [ERROR]  npm install failed.
        echo   Check your internet connection and try again.
        pause
        exit /b 1
    )
    echo   [OK]  Dependencies installed
) else (
    echo   [OK]  Dependencies ready
)

:: ── Step 3 · Set up database (first run only) ─────────────────
if not exist "prisma\dev.db" (
    echo.
    echo   [SETUP]  Setting up database — first run only...
    call npx prisma migrate dev --name init --skip-generate > nul 2>&1
    call npm run db:seed > nul 2>&1
    echo   [OK]  Database ready
) else (
    echo   [OK]  Database ready
)

:: ── Step 4 · Start app in a separate window ───────────────────
echo.
echo   Launching FieldSync server...
echo.
start "FieldSync Server — keep this open" cmd /k "npm run dev"

:: ── Step 5 · Wait for server to start ────────────────────────
echo   Waiting for server to start
timeout /t 2 /nobreak > nul
echo   .
timeout /t 2 /nobreak > nul
echo   ..
timeout /t 2 /nobreak > nul
echo   ...
timeout /t 2 /nobreak > nul
echo   ....
timeout /t 2 /nobreak > nul

:: ── Step 6 · Open browser and print demo instructions ─────────
echo.
echo   ╔══════════════════════════════════════════╗
echo   ║   OK  FieldSync is running!             ║
echo   ╚══════════════════════════════════════════╝
echo.
echo   URL:  http://localhost:3000
echo.
echo   ── Demo tip ──────────────────────────────────────────
echo.
echo   To run the full demo you need TWO browser windows:
echo.
echo   Window 1  ^>  http://localhost:3000              (Worker)
echo   Window 2  ^>  http://localhost:3000  InPrivate   (Expert)
echo.
echo   Open Window 2 in InPrivate mode (Ctrl+Shift+N in Edge/Chrome)
echo   so each window has its own separate identity.
echo.
echo   ──────────────────────────────────────────────────────
echo.
echo   Keep the "FieldSync Server" window open while using the demo.
echo   Close it to stop the server.
echo.

start http://localhost:3000

pause

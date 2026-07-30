@echo off
title cappy.ai — Launcher
color 0A
cls

echo  ============================================================
echo   cappy.ai — Starting...
echo  ============================================================

REM ── Kill any previous instances on port 8000 and 5173 ──────────────────────
echo  [1/4] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1

REM ── Start Backend ───────────────────────────────────────────────────────────
echo  [2/4] Starting Backend (FastAPI on port 8000)...
start "cappy.ai — Backend" cmd /k "color 0B && cd /d "d:\Study\extra\codes\cappy.ai\backend" && echo Backend starting... && .\venv\Scripts\uvicorn app:app --reload --port 8000"

REM ── Wait for backend to be ready ────────────────────────────────────────────
echo  [3/4] Waiting for backend to initialize on port 8000...
powershell -Command "while (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -InformationLevel Quiet)) { Start-Sleep -Seconds 1 }"

REM ── Start Frontend ──────────────────────────────────────────────────────────
echo  [4/4] Starting Frontend (Vite on port 6969)...
start "cappy.ai — Frontend" cmd /k "color 0E && cd /d "d:\Study\extra\codes\cappy.ai\frontend" && echo Frontend starting... && npm run dev"

REM ── Wait for frontend ───────────────────────────────────────────────────────
timeout /t 5 /nobreak > nul

REM ── Open browser ────────────────────────────────────────────────────────────
echo.
echo  Opening browser...
start http://localhost:6969

echo.
echo  ============================================================
echo   cappy.ai is RUNNING!
echo.
echo   App:      http://localhost:6969
echo   API:      http://localhost:8000
echo   API Docs: http://localhost:8000/api/docs
echo  ============================================================
echo.
echo  Close the Backend and Frontend terminal windows to stop.
echo  Press any key to close this launcher...
pause > nul

@echo off
title Lotus Crossing 5-07 Classroom Service
cd /d "%~dp0"

if not exist "dist\index.html" (
  echo.
  echo   [First run] Installing dependencies and building front-end...
  echo.
  call npm install
  call npm run build
)

node --no-warnings start-classroom.cjs

echo.
echo   Service stopped. Press any key to close this window.
pause >nul

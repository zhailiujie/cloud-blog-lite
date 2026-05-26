@echo off
setlocal
cd /d "%~dp0..\.."

echo Starting Cloud Blog Lite Worker dev server...
echo URL: http://localhost:8787
echo.
pnpm dev:worker

if errorlevel 1 (
  echo.
  echo Worker dev server exited with an error.
  pause
)

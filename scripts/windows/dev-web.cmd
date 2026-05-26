@echo off
setlocal
cd /d "%~dp0..\.."

echo Starting Cloud Blog Lite Web dev server...
echo URL: http://localhost:5173
echo.
pnpm dev:web

if errorlevel 1 (
  echo.
  echo Web dev server exited with an error.
  pause
)

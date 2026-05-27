@echo off
setlocal
cd /d "%~dp0..\.."

echo Cloud Blog Lite Wrangler re-authentication
echo ===========================================
echo.

where pnpm >nul 2>nul
if errorlevel 1 (
  echo ERROR: pnpm is not available in PATH.
  echo Please install pnpm first.
  pause
  exit /b 1
)

echo This will log out the current Wrangler session and open Cloudflare login again.
echo Make sure you sign in with an account that has access to the target zone.
echo Required permissions include Workers Scripts Edit, Workers Routes Edit, and Zone Read.
echo.
pause

echo [1/2] Logging out Wrangler...
call pnpm --filter @cloud-blog-lite/worker exec wrangler logout
if errorlevel 1 goto failed

echo.
echo [2/2] Logging in Wrangler...
call pnpm --filter @cloud-blog-lite/worker exec wrangler login
if errorlevel 1 goto failed

echo.
echo Wrangler re-authentication completed.
echo You can now run scripts\windows\deploy-cloudflare.cmd again.
echo.
pause
exit /b 0

:failed
echo.
echo Wrangler re-authentication failed. See the error above.
echo.
pause
exit /b 1

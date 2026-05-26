@echo off
setlocal
cd /d "%~dp0..\.."

echo Cloud Blog Lite manual Cloudflare deployment
echo ============================================
echo.

if not exist "apps\worker\wrangler.production.toml" (
  echo ERROR: apps\worker\wrangler.production.toml not found.
  echo.
  echo Copy apps\worker\wrangler.production.example.toml to apps\worker\wrangler.production.toml,
  echo then fill production domain, zone, D1 database_id and other production values.
  echo.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo ERROR: pnpm is not available in PATH.
  echo Please install pnpm first.
  pause
  exit /b 1
)

echo [1/5] Checking Worker types...
call pnpm typecheck:worker
if errorlevel 1 goto failed

echo.
echo [2/5] Building Web...
call pnpm build:web
if errorlevel 1 goto failed

echo.
echo [3/5] Deploying Worker API...
call pnpm deploy:worker
if errorlevel 1 goto failed

echo.
echo [4/5] Deploying Cloudflare Pages...
call pnpm --filter @cloud-blog-lite/worker exec wrangler pages deploy ../web/dist --project-name cloud-blog-lite --commit-dirty=true
if errorlevel 1 goto failed

echo.
echo [5/5] Deployment completed successfully.
echo.
pause
exit /b 0

:failed
echo.
echo Deployment failed. See the error above.
echo.
pause
exit /b 1

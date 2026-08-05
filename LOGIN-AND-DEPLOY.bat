@echo off
cd /d C:\Users\jjhou\jjhouse-site
echo ============================================
echo  STEP 1: Building the site...
echo ============================================
call npx astro build
if errorlevel 1 (
  echo.
  echo BUILD FAILED - screenshot this window for Claude.
  pause
  exit /b 1
)
echo.
echo ============================================
echo  STEP 2: Deploying to production...
echo  (If your Vercel login expired, it will
echo   prompt you to log in - follow the browser.)
echo ============================================
call npx --yes vercel@latest whoami >nul 2>&1
if errorlevel 1 call npx --yes vercel@latest login
call npx --yes vercel@latest --prod --yes
echo.
echo DONE! Check https://www.jj.house
pause

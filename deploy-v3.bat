@echo off
cd /d C:\Users\jjhou\jjhouse-site
echo === DEPLOY START === > deploy-log2.txt
call npx --yes vercel@latest --prod --yes >> deploy-log2.txt 2>&1
if errorlevel 1 (
  echo DEPLOY_FAILED >> deploy-log2.txt
  exit /b 1
)
echo ALL_DONE >> deploy-log2.txt

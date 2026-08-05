@echo off
cd /d C:\Users\jjhou\jjhouse-site
echo === DEPLOY === > deploy-log3.txt
call npx --yes vercel@latest --prod --yes >> deploy-log3.txt 2>&1
echo EXIT %errorlevel% >> deploy-log3.txt

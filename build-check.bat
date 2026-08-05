@echo off
cd /d C:\Users\jjhou\jjhouse-site
echo === BUILD CHECK === > build-check.log
call npx astro build >> build-check.log 2>&1
if errorlevel 1 ( echo BUILD_FAILED >> build-check.log ) else ( echo BUILD_OK >> build-check.log )

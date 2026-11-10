@echo off
cd /d "%~dp0"
echo Starting roorin Character Studio at http://127.0.0.1:5173/
call npm run dev -- --hostname 127.0.0.1
pause

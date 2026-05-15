@echo off
cd /d "%~dp0"
start "" cmd /c "node server.js & pause"
timeout /t 3 >nul
start http://localhost:3000

@echo off
cd /d "C:\Users\Ido Bahir\Documents\Gemini\SneakerMonitor"
echo Installing dependencies...
call npm install
echo Starting SneakerMonitor...
node src/monitor.js
echo.
echo Monitor finished (or crashed). Press any key to close.
pause

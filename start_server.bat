@echo off
title Lucky Draw Server
color 0A
cls
echo ========================================================
echo                 LUCKY DRAW SERVER
echo ========================================================
echo.
echo  Currently hosting on your machine (192.168.1.191).
echo  
echo  1. Keep this window OPEN.
echo  2. Connect your phone/tablet to the SAME Wi-Fi.
echo  3. Open this URL in your browser:
echo.
echo     http://192.168.1.191:8000
echo.
echo ========================================================
echo  Press Ctrl+C to stop the server.
echo ========================================================
echo.

python -m http.server 8000 --bind 0.0.0.0
pause

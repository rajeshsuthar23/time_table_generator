@echo off
echo ===================================================
echo Starting Gradwise Timetable System...
echo ===================================================
echo.

echo Starting the Backend Server (Database API)...
start "Gradwise Backend" cmd /k "cd backend && npm run dev"

echo Starting the Frontend Server (Web Interface)...
start "Gradwise Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are launching in separate windows!
echo Please wait a few seconds for them to initialize.
echo The application should automatically open in your web browser.
echo If it doesn't open automatically, navigate to: http://localhost:5173
echo.
pause
